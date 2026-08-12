import { randomUUID } from 'node:crypto';

import {
  AiCorrectionFinancialStatus,
  AiCorrectionMethod,
  AiCorrectionPipelineKind,
  AiCorrectionRole,
  AiCorrectionRoleExecutionStatus,
  AiCorrectionStatus,
  Prisma,
  type PrismaClient,
} from '../../../generated/prisma/client.js';
import type { CompositeSettlementPreview } from '../pricing/ai-pricing.js';
import type {
  AcceptedCorrectionOperation,
  CompositeCorrectionOperationRepository,
  OrchestratedProviderCall,
} from './composite-correction-orchestrator.js';
import type { CompositePipelineState } from './composite-correction.js';

const MAX_TRANSACTION_ATTEMPTS = 3;

function jsonSafe(value: unknown): Prisma.InputJsonValue {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, jsonSafe(child)]),
    );
  }
  return value as Prisma.InputJsonValue;
}

const asJson = jsonSafe;

function parseSettlementSnapshot(value: Prisma.JsonValue | null):
  | AcceptedCorrectionOperation['pendingFinalization'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const resultState = record.resultState;
  const settlement = record.settlement;
  if (
    (resultState !== 'COMPLETED' &&
      resultState !== 'PROVISIONAL' &&
      resultState !== 'UNCERTAIN' &&
      resultState !== 'UNUSABLE_RELEASED') ||
    !settlement ||
    typeof settlement !== 'object' ||
    Array.isArray(settlement)
  ) {
    return null;
  }
  const source = settlement as Record<string, unknown>;
  const readCredits = (key: string): bigint => {
    const raw = source[key];
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
      throw new Error('COMPOSITE_SETTLEMENT_SNAPSHOT_INVALID');
    }
    return BigInt(raw);
  };
  return {
    resultState,
    settlement: {
      absorbedCeilingOverrunCredits: readCredits('absorbedCeilingOverrunCredits'),
      absorbedProviderCostCredits: readCredits('absorbedProviderCostCredits'),
      billableProviderCostCredits: readCredits('billableProviderCostCredits'),
      providerCostCredits: readCredits('providerCostCredits'),
      releasedCredits: readCredits('releasedCredits'),
      settledCredits: readCredits('settledCredits'),
    },
  };
}

function retryable(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'P2034' || error.code === '40001')
  );
}

function financialState(value: string): AcceptedCorrectionOperation['financialState'] {
  if (
    value === 'PENDING' ||
    value === 'READY_TO_SETTLE' ||
    value === 'RECONCILIATION_REQUIRED' ||
    value === 'RELEASED' ||
    value === 'SETTLED'
  ) {
    return value;
  }
  throw new Error('COMPOSITE_FINANCIAL_STATE_INVALID');
}

function terminalResult(value: string): CompositePipelineState | null {
  switch (value) {
    case AiCorrectionStatus.COMPLETED:
      return 'COMPLETED';
    case AiCorrectionStatus.PROVISIONAL:
      return 'PROVISIONAL';
    case AiCorrectionStatus.UNCERTAIN:
      return 'UNCERTAIN';
    case AiCorrectionStatus.UNUSABLE_RELEASED:
      return 'UNUSABLE_RELEASED';
    default:
      return null;
  }
}

function correctionStatus(value: CompositePipelineState): AiCorrectionStatus {
  switch (value) {
    case 'COMPLETED':
      return AiCorrectionStatus.COMPLETED;
    case 'PROVISIONAL':
      return AiCorrectionStatus.PROVISIONAL;
    case 'UNCERTAIN':
      return AiCorrectionStatus.UNCERTAIN;
    case 'UNUSABLE_RELEASED':
      return AiCorrectionStatus.UNUSABLE_RELEASED;
  }
}

async function targetSnapshots(
  transaction: Prisma.TransactionClient,
  input: {
    target: { id: string; kind: string };
    userId: string;
  },
): Promise<{
  contract: Prisma.InputJsonValue;
  exerciseSubmissionId: string | null;
  stageAssessmentSubmissionId: string | null;
  submission: Prisma.InputJsonValue;
}> {
  if (input.target.kind === 'EXERCISE_SUBMISSION') {
    const submission = await transaction.exerciseSubmission.findFirst({
      where: { id: input.target.id, status: 'SUBMITTED', userId: input.userId },
      select: {
        contentMarkdown: true,
        exerciseId: true,
        id: true,
        moduleRunId: true,
        submittedAt: true,
        exercise: { select: { rubric: true } },
      },
    });
    if (!submission) throw new Error('COMPOSITE_TARGET_NOT_CORRECTABLE');
    return {
      contract: asJson(submission.exercise.rubric),
      exerciseSubmissionId: submission.id,
      stageAssessmentSubmissionId: null,
      submission: asJson({
        contentMarkdown: submission.contentMarkdown,
        exerciseId: submission.exerciseId,
        id: submission.id,
        kind: 'EXERCISE',
        moduleRunId: submission.moduleRunId,
        submittedAt: submission.submittedAt?.toISOString() ?? null,
      }),
    };
  }
  if (input.target.kind !== 'STAGE_ASSESSMENT_SUBMISSION') {
    throw new Error('COMPOSITE_TARGET_NOT_CORRECTABLE');
  }
  const submission = await transaction.stageAssessmentSubmission.findFirst({
    where: { id: input.target.id, status: 'SUBMITTED', userId: input.userId },
    select: {
      attachmentUrl: true,
      contentMarkdown: true,
      id: true,
      stageAssessmentId: true,
      submittedAt: true,
      stageAssessment: { select: { rubric: true } },
    },
  });
  if (!submission) throw new Error('COMPOSITE_TARGET_NOT_CORRECTABLE');
  return {
    contract: asJson(submission.stageAssessment.rubric),
    exerciseSubmissionId: null,
    stageAssessmentSubmissionId: submission.id,
    submission: asJson({
      attachmentUrl: submission.attachmentUrl,
      contentMarkdown: submission.contentMarkdown,
      id: submission.id,
      kind: 'STAGE_ASSESSMENT',
      stageAssessmentId: submission.stageAssessmentId,
      submittedAt: submission.submittedAt?.toISOString() ?? null,
    }),
  };
}

export class PrismaCompositeOperationRepository
  implements CompositeCorrectionOperationRepository
{
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  private async transaction<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 15_000,
        });
      } catch (error) {
        if (!retryable(error) || attempt === MAX_TRANSACTION_ATTEMPTS) throw error;
      }
    }
    throw new Error('COMPOSITE_TRANSACTION_FAILED');
  }

  public async prepare(
    input: Parameters<CompositeCorrectionOperationRepository['prepare']>[0],
  ): Promise<AcceptedCorrectionOperation> {
    return this.transaction(async (transaction) => {
      const existing = await transaction.aiCorrection.findUnique({
        where: {
          userId_idempotencyKey: {
            idempotencyKey: input.idempotencyKey,
            userId: input.userId,
          },
        },
        include: { financialOperation: true },
      });
      if (existing) {
        if (
          existing.orchestrationFingerprint !== input.fingerprint ||
          existing.pricingQuoteId !== input.quote.id ||
          existing.creditReservationId !== input.reservationId ||
          !existing.financialOperation
        ) {
          throw new Error('COMPOSITE_IDEMPOTENCY_CONFLICT');
        }
        return {
          correctionId: existing.id,
          financialState: financialState(existing.financialOperation.status),
          pendingFinalization: parseSettlementSnapshot(
            existing.financialOperation.settlementSnapshot,
          ),
          reservationId: input.reservationId,
          terminalResult: terminalResult(existing.status),
        };
      }
      if (!input.quote.pipelineVersionId) {
        throw new Error('COMPOSITE_PIPELINE_IDENTITY_MISSING');
      }
      const [pipeline, reservation, snapshots] = await Promise.all([
        transaction.aiCorrectionPipelineVersion.findUnique({
          where: { id: input.quote.pipelineVersionId },
        }),
        transaction.creditReservation.findFirst({
          where: {
            ceilingAmount: input.quote.ceilingCredits,
            id: input.reservationId,
            status: 'RESERVED',
            userId: input.userId,
          },
          include: {
            allocations: {
              orderBy: { position: 'asc' },
              select: { amount: true, lotId: true, position: true },
            },
          },
        }),
        targetSnapshots(transaction, {
          target: input.quote.target,
          userId: input.userId,
        }),
      ]);
      if (!pipeline || !reservation) {
        throw new Error('COMPOSITE_ACCEPTANCE_INCOMPATIBLE');
      }
      const correction = await transaction.aiCorrection.create({
        data: {
          contractSnapshot: snapshots.contract,
          creditReservationId: reservation.id,
          exerciseSubmissionId: snapshots.exerciseSubmissionId,
          idempotencyKey: input.idempotencyKey,
          method: AiCorrectionMethod.AI,
          modelRole: 'COMPOSITE',
          orchestrationFingerprint: input.fingerprint,
          pipelineIdentitySnapshot: asJson(input.quote.pipelineIdentitySnapshot),
          pipelineKind: AiCorrectionPipelineKind.COMPOSITE,
          pipelineVersionId: pipeline.id,
          pricingQuoteId: input.quote.id,
          promptSnapshot: asJson({
            primary: pipeline.primaryConfig,
            verifier: pipeline.verifierConfig,
          }),
          promptVersion: input.quote.promptVersion,
          requestFingerprint: input.fingerprint,
          stageAssessmentSubmissionId: snapshots.stageAssessmentSubmissionId,
          submissionSnapshot: snapshots.submission,
          userId: input.userId,
          roleExecutions: {
            create: {
              assignmentSnapshot: asJson(pipeline.primaryConfig),
              profileSnapshot: asJson(pipeline.primaryConfig),
              promptSnapshot: asJson(pipeline.primaryConfig),
              role: AiCorrectionRole.PRIMARY,
            },
          },
        },
      });
      await transaction.aiCorrectionFinancialOperation.create({
        data: {
          acceptedCeilingCredits: input.quote.ceilingCredits,
          allocationSnapshot: asJson(input.allocationSnapshot),
          correctionId: correction.id,
          reservationId: reservation.id,
          userId: input.userId,
        },
      });
      return {
        correctionId: correction.id,
        financialState: 'PENDING',
        pendingFinalization: null,
        reservationId: reservation.id,
        terminalResult: null,
      };
    });
  }

  public async claim(
    input: Parameters<CompositeCorrectionOperationRepository['claim']>[0],
  ): Promise<boolean> {
    return this.transaction(async (transaction) => {
      const now = this.clock();
      const execution = await transaction.aiCorrectionRoleExecution.findFirst({
        where: {
          correctionId: input.correctionId,
          role: AiCorrectionRole.PRIMARY,
          OR: [
            { status: AiCorrectionRoleExecutionStatus.PENDING },
            { status: AiCorrectionRoleExecutionStatus.RETRY_PENDING },
            {
              leaseExpiresAt: { lte: now },
              status: AiCorrectionRoleExecutionStatus.PROCESSING,
            },
          ],
        },
      });
      if (!execution) return false;
      const claimed = await transaction.aiCorrectionRoleExecution.updateMany({
        where: {
          id: execution.id,
          updatedAt: execution.updatedAt,
          OR: [
            { status: AiCorrectionRoleExecutionStatus.PENDING },
            { status: AiCorrectionRoleExecutionStatus.RETRY_PENDING },
            {
              leaseExpiresAt: { lte: now },
              status: AiCorrectionRoleExecutionStatus.PROCESSING,
            },
          ],
        },
        data: {
          leaseExpiresAt: input.leaseExpiresAt,
          leaseOwner: input.workerId,
          leaseToken: randomUUID(),
          startedAt: now,
          status: AiCorrectionRoleExecutionStatus.PROCESSING,
        },
      });
      if (claimed.count !== 1) return false;
      await transaction.aiCorrection.update({
        where: { id: input.correctionId },
        data: {
          startedAt: now,
          status: AiCorrectionStatus.PROCESSING_PRIMARY,
        },
      });
      return true;
    });
  }

  public async markReconciliationRequired(input: {
    calls: readonly OrchestratedProviderCall[];
    code: 'PROVIDER_COST_MISSING';
    correctionId: string;
  }): Promise<void> {
    await this.transaction(async (transaction) => {
      await transaction.aiCorrectionFinancialOperation.update({
        where: { correctionId: input.correctionId },
        data: {
          alertRequired: true,
          reconciliationCode: input.code,
          settlementSnapshot: asJson({ calls: input.calls }),
          status: AiCorrectionFinancialStatus.RECONCILIATION_REQUIRED,
        },
      });
      await transaction.aiCorrection.update({
        where: { id: input.correctionId },
        data: { status: AiCorrectionStatus.RECONCILIATION_REQUIRED },
      });
    });
  }

  public async prepareFinancialFinalization(input: {
    absorbedProviderCostUsd: string;
    billableProviderCostUsd: string;
    correctionId: string;
    providerCostUsd: string;
    resultState: CompositePipelineState;
    settlement: CompositeSettlementPreview;
  }): Promise<void> {
    await this.transaction(async (transaction) => {
      const status =
        input.resultState === 'UNUSABLE_RELEASED'
          ? AiCorrectionStatus.RELEASE_PENDING
          : AiCorrectionStatus.SETTLEMENT_PENDING;
      await transaction.aiCorrectionFinancialOperation.update({
        where: { correctionId: input.correctionId },
        data: {
          absorbedProviderCostUsd: new Prisma.Decimal(
            input.absorbedProviderCostUsd,
          ),
          billableProviderCostUsd: new Prisma.Decimal(
            input.billableProviderCostUsd,
          ),
          providerCostUsd: new Prisma.Decimal(input.providerCostUsd),
          settlementSnapshot: asJson({
            resultState: input.resultState,
            settlement: input.settlement,
          }),
          status: AiCorrectionFinancialStatus.READY_TO_SETTLE,
        },
      });
      await transaction.aiCorrection.update({
        where: { id: input.correctionId },
        data: { status },
      });
    });
  }

  private async completeFinancial(input: {
    correctionId: string;
    financialStatus: 'RELEASED' | 'SETTLED';
    resultState: CompositePipelineState;
    settlement: CompositeSettlementPreview;
  }): Promise<void> {
    await this.transaction(async (transaction) => {
      const now = this.clock();
      await transaction.aiCorrectionFinancialOperation.update({
        where: { correctionId: input.correctionId },
        data: {
          absorbedCeilingOverrunCredits:
            input.settlement.absorbedCeilingOverrunCredits,
          completedAt: now,
          releasedCredits: input.settlement.releasedCredits,
          settledCredits: input.settlement.settledCredits,
          settlementSnapshot: asJson(input.settlement),
          status:
            input.financialStatus === 'SETTLED'
              ? AiCorrectionFinancialStatus.SETTLED
              : AiCorrectionFinancialStatus.RELEASED,
        },
      });
      await transaction.aiCorrection.update({
        where: { id: input.correctionId },
        data: {
          completedAt: now,
          status: correctionStatus(input.resultState),
        },
      });
    });
  }

  public async completeReleased(
    input: Parameters<CompositeCorrectionOperationRepository['completeReleased']>[0],
  ): Promise<void> {
    await this.completeFinancial({
      ...input,
      financialStatus: 'RELEASED',
    });
  }

  public async completeSettled(
    input: Parameters<CompositeCorrectionOperationRepository['completeSettled']>[0],
  ): Promise<void> {
    await this.completeFinancial({
      ...input,
      financialStatus: 'SETTLED',
    });
  }
}
