import {
  AiCorrectionAttemptStatus,
  AiCorrectionStatus,
  ExerciseSubmissionStatus,
  Prisma,
  type PrismaClient,
  StageAssessmentSubmissionStatus,
} from '../../../generated/prisma/client.js';
import {
  CorrectionEngineError,
  type ClaimedCorrection,
  type CorrectionAttemptFailure,
  type CorrectionAttemptSuccess,
  type CorrectionReservationInput,
  type CorrectionStatus,
  type PersistentCorrectionRecord,
  type PersistentCorrectionRepository,
} from './persistent-correction.js';

const MAX_TRANSACTION_ATTEMPTS = 3;

export class CorrectionPersistenceError extends Error {
  public constructor(
    public readonly code:
      | 'CORRECTION_NOT_FOUND'
      | 'SUBMISSION_NOT_CORRECTABLE'
      | 'TRANSITION_CONFLICT',
  ) {
    super(code);
    this.name = 'CorrectionPersistenceError';
  }
}

type DbClient = Prisma.TransactionClient | PrismaClient;

function isRetryableTransactionError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2034'
  );
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function mapCorrection(record: {
  confidence: number | null;
  contractSnapshot: Prisma.JsonValue;
  decision: string | null;
  id: string;
  idempotencyKey: string;
  method: string;
  promptSnapshot: Prisma.JsonValue;
  requestFingerprint: string;
  score: number | null;
  status: string;
  structuredResult: Prisma.JsonValue | null;
  submissionSnapshot: Prisma.JsonValue;
  userId: string;
}): PersistentCorrectionRecord {
  return {
    confidence: record.confidence,
    contractSnapshot: record.contractSnapshot,
    decision: record.decision as PersistentCorrectionRecord['decision'],
    id: record.id,
    idempotencyKey: record.idempotencyKey,
    method: record.method as PersistentCorrectionRecord['method'],
    promptSnapshot: record.promptSnapshot,
    requestFingerprint: record.requestFingerprint,
    score: record.score,
    status: record.status as CorrectionStatus,
    structuredResult: record.structuredResult,
    submissionSnapshot: record.submissionSnapshot,
    userId: record.userId,
  };
}

export class PrismaCorrectionRepository implements PersistentCorrectionRepository {
  public constructor(private readonly prisma: PrismaClient) {}

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
        if (
          !isRetryableTransactionError(error) ||
          attempt === MAX_TRANSACTION_ATTEMPTS
        ) {
          throw error;
        }
      }
    }
    throw new CorrectionPersistenceError('TRANSITION_CONFLICT');
  }

  private async findByIdempotency(
    client: DbClient,
    userId: string,
    idempotencyKey: string,
  ) {
    return client.aiCorrection.findUnique({
      where: { userId_idempotencyKey: { idempotencyKey, userId } },
    });
  }

  private async submissionSnapshot(
    client: DbClient,
    input: CorrectionReservationInput,
  ): Promise<Prisma.InputJsonObject> {
    if (input.target.kind === 'EXERCISE') {
      const submission = await client.exerciseSubmission.findFirst({
        where: {
          id: input.target.exerciseSubmissionId,
          status: ExerciseSubmissionStatus.SUBMITTED,
          userId: input.userId,
        },
        select: {
          contentMarkdown: true,
          exerciseId: true,
          id: true,
          moduleRunId: true,
          submittedAt: true,
        },
      });
      if (!submission) {
        throw new CorrectionPersistenceError('SUBMISSION_NOT_CORRECTABLE');
      }
      return {
        contentMarkdown: submission.contentMarkdown,
        exerciseId: submission.exerciseId,
        id: submission.id,
        kind: 'EXERCISE',
        moduleRunId: submission.moduleRunId,
        submittedAt: submission.submittedAt?.toISOString() ?? null,
      };
    }

    const submission = await client.stageAssessmentSubmission.findFirst({
      where: {
        id: input.target.stageAssessmentSubmissionId,
        status: StageAssessmentSubmissionStatus.SUBMITTED,
        userId: input.userId,
      },
      select: {
        attachmentUrl: true,
        contentMarkdown: true,
        id: true,
        stageAssessmentId: true,
        submittedAt: true,
      },
    });
    if (!submission) {
      throw new CorrectionPersistenceError('SUBMISSION_NOT_CORRECTABLE');
    }
    return {
      attachmentUrl: submission.attachmentUrl,
      contentMarkdown: submission.contentMarkdown,
      id: submission.id,
      kind: 'STAGE_ASSESSMENT',
      stageAssessmentId: submission.stageAssessmentId,
      submittedAt: submission.submittedAt?.toISOString() ?? null,
    };
  }

  public async reserve(
    input: CorrectionReservationInput,
  ): Promise<PersistentCorrectionRecord> {
    const reserveOnce = async () =>
      this.transaction(async (transaction) => {
        const existing = await this.findByIdempotency(
          transaction,
          input.userId,
          input.idempotencyKey,
        );
        if (existing) {
          if (existing.requestFingerprint !== input.requestFingerprint) {
            throw new CorrectionEngineError('DUPLICATE_OPERATION_CONFLICT');
          }
          return mapCorrection(existing);
        }

        const submissionSnapshot = await this.submissionSnapshot(
          transaction,
          input,
        );
        const created = await transaction.aiCorrection.create({
          data: {
            contractSnapshot: asJson(input.contractSnapshot),
            exerciseSubmissionId:
              input.target.kind === 'EXERCISE'
                ? input.target.exerciseSubmissionId
                : null,
            idempotencyKey: input.idempotencyKey,
            method: input.method,
            modelRole: input.modelRole,
            promptSnapshot: asJson(input.promptSnapshot),
            promptVersion: input.promptVersion,
            requestFingerprint: input.requestFingerprint,
            stageAssessmentSubmissionId:
              input.target.kind === 'STAGE_ASSESSMENT'
                ? input.target.stageAssessmentSubmissionId
                : null,
            submissionSnapshot,
            userId: input.userId,
          },
        });
        return mapCorrection(created);
      });

    try {
      return await reserveOnce();
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const existing = await this.findByIdempotency(
        this.prisma,
        input.userId,
        input.idempotencyKey,
      );
      if (!existing) throw error;
      if (existing.requestFingerprint !== input.requestFingerprint) {
        throw new CorrectionEngineError('DUPLICATE_OPERATION_CONFLICT');
      }
      return mapCorrection(existing);
    }
  }

  public async claim(correctionId: string): Promise<ClaimedCorrection | null> {
    return this.transaction(async (transaction) => {
      const correction = await transaction.aiCorrection.findUnique({
        where: { id: correctionId },
      });
      if (!correction) {
        throw new CorrectionPersistenceError('CORRECTION_NOT_FOUND');
      }
      if (
        correction.status !== AiCorrectionStatus.RESERVED &&
        correction.status !== AiCorrectionStatus.RETRY_PENDING
      ) {
        return null;
      }
      const claimed = await transaction.aiCorrection.updateMany({
        data: { status: AiCorrectionStatus.PROCESSING },
        where: {
          id: correctionId,
          status: correction.status,
        },
      });
      if (claimed.count !== 1) return null;

      const attemptSequence =
        (await transaction.aiCorrectionAttempt.count({
          where: { correctionId },
        })) + 1;
      const attempt = await transaction.aiCorrectionAttempt.create({
        data: {
          correctionId,
          modelRole: correction.modelRole,
          sequence: attemptSequence,
        },
      });
      return {
        attemptId: attempt.id,
        attemptSequence,
        correction: mapCorrection({
          ...correction,
          status: AiCorrectionStatus.PROCESSING,
        }),
      };
    });
  }

  public async complete(
    input: CorrectionAttemptSuccess,
  ): Promise<PersistentCorrectionRecord> {
    return this.transaction(async (transaction) => {
      const attempt = await transaction.aiCorrectionAttempt.updateMany({
        data: {
          completedAt: new Date(),
          completionTokens: input.metadata.usage.completionTokens,
          costUsd: input.metadata.usage.costUsd,
          generationId: input.metadata.generationId,
          latencyMs: input.metadata.latencyMs,
          modelId: input.metadata.modelId,
          promptTokens: input.metadata.usage.promptTokens,
          provider: input.metadata.provider,
          retryable: false,
          status: AiCorrectionAttemptStatus.SUCCEEDED,
          structuredResult: asJson(input.output),
          totalTokens: input.metadata.usage.totalTokens,
        },
        where: {
          correctionId: input.correctionId,
          id: input.attemptId,
          status: AiCorrectionAttemptStatus.PROCESSING,
        },
      });
      const correction = await transaction.aiCorrection.updateMany({
        data: {
          completedAt: new Date(),
          confidence: input.confidence,
          decision: input.decision,
          modelId: input.metadata.modelId,
          provider: input.metadata.provider,
          score: input.score,
          status: input.status,
          structuredResult: asJson(input.output),
        },
        where: {
          id: input.correctionId,
          status: AiCorrectionStatus.PROCESSING,
        },
      });
      if (attempt.count !== 1 || correction.count !== 1) {
        throw new CorrectionPersistenceError('TRANSITION_CONFLICT');
      }
      return this.getWithClient(transaction, input.correctionId);
    });
  }

  public async fail(
    input: CorrectionAttemptFailure,
  ): Promise<PersistentCorrectionRecord> {
    return this.transaction(async (transaction) => {
      const attempt = await transaction.aiCorrectionAttempt.updateMany({
        data: {
          completedAt: new Date(),
          errorCode: input.errorCode,
          retryable: input.retryable,
          status: AiCorrectionAttemptStatus.FAILED,
        },
        where: {
          correctionId: input.correctionId,
          id: input.attemptId,
          status: AiCorrectionAttemptStatus.PROCESSING,
        },
      });
      const correction = await transaction.aiCorrection.updateMany({
        data: {
          completedAt: input.retryable ? null : new Date(),
          status: input.retryable
            ? AiCorrectionStatus.RETRY_PENDING
            : AiCorrectionStatus.FAILED_RELEASED,
        },
        where: {
          id: input.correctionId,
          status: AiCorrectionStatus.PROCESSING,
        },
      });
      if (attempt.count !== 1 || correction.count !== 1) {
        throw new CorrectionPersistenceError('TRANSITION_CONFLICT');
      }
      return this.getWithClient(transaction, input.correctionId);
    });
  }

  private async getWithClient(
    client: DbClient,
    correctionId: string,
  ): Promise<PersistentCorrectionRecord> {
    const correction = await client.aiCorrection.findUnique({
      where: { id: correctionId },
    });
    if (!correction) {
      throw new CorrectionPersistenceError('CORRECTION_NOT_FOUND');
    }
    return mapCorrection(correction);
  }

  public get(correctionId: string): Promise<PersistentCorrectionRecord> {
    return this.getWithClient(this.prisma, correctionId);
  }
}
