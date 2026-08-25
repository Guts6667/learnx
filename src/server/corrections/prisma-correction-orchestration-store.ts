import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';

import type {
  AcceptedQuoteSnapshot,
  CorrectionPersistencePort,
  OrchestratedCorrectionResult,
  RuntimeCorrectionAttempt,
} from './correction-orchestration';
import { PROMOTED_CORRECTION_IDENTITY } from './promoted-identity.js';

/**
 * Implémentation Prisma des ports de l'orchestration V4-009 :
 * chargement d'un devis accepté, journal de la correction consommée et
 * rejeu idempotent par empreinte de requête.
 */
export class PrismaCorrectionOrchestrationPorts {
  public constructor(private readonly prisma: PrismaClient) {}

  public readonly quotes = {
    loadAcceptedQuote: async (input: {
      quoteId: string;
      userId: string;
      now: Date;
    }): Promise<AcceptedQuoteSnapshot | null> => {
      const quote = await this.prisma.aiPricingQuote.findFirst({
        where: { id: input.quoteId, userId: input.userId },
      });
      if (!quote || quote.expiresAt.getTime() <= input.now.getTime()) {
        return null;
      }
      if (quote.targetKind !== 'EXERCISE_SUBMISSION') {
        return null;
      }
      const submission = await this.prisma.exerciseSubmission.findFirst({
        include: { exercise: true },
        where: { id: quote.targetId, userId: input.userId },
      });
      if (
        !submission ||
        submission.status !== 'SUBMITTED' ||
        !submission.exercise
      ) {
        return null;
      }
      return {
        quoteId: quote.id,
        userId: quote.userId,
        target: { id: submission.id, kind: 'EXERCISE_SUBMISSION' },
        language: quote.language,
        estimatedCredits: quote.estimatedCredits,
        maximumReservedCredits: quote.ceilingCredits,
        expiresAt: quote.expiresAt,
        promptVersion: quote.promptVersion,
        modelId: quote.modelId,
        provider: quote.provider,
        includesAutomaticSecondPass: quote.includesAutomaticSecondPass,
        contractKey: quote.contractKey,
        contractVersion: quote.contractVersion,
        requestFingerprint: quote.requestFingerprint,
        submissionText: submission.contentMarkdown,
        exerciseInstructions: submission.exercise.instructions,
        taskContext: null,
        contract: submission.exercise.rubric,
      };
    },
    // Le schéma V4 conserve le devis comme snapshot immuable sans colonne
    // d'état. La consommation est matérialisée par l'AiCorrection unique
    // sur l'empreinte et par la réservation de crédits idempotente.
    markConsumed: async (): Promise<void> => {},
  };

  public readonly corrections: CorrectionPersistencePort = {
    begin: async (input): Promise<{
      correctionId: string;
      created: boolean;
    }> => {
      try {
        const created = await this.prisma.aiCorrection.create({
          data: {
            contractSnapshot: input.quote.contract as object,
            creditReservationId: input.reservationId,
            exerciseSubmissionId: input.quote.target.id,
            idempotencyKey: `quote:${input.quote.quoteId}`,
            method: 'AI',
            modelId: PROMOTED_CORRECTION_IDENTITY.modelId,
            modelRole: 'CORRECTION_PRIMARY',
            pipelineKind: 'SINGLE_MODEL',
            pricingQuoteId: input.quote.quoteId,
            promptSnapshot: {},
            promptVersion: input.quote.promptVersion,
            provider: PROMOTED_CORRECTION_IDENTITY.provider,
            requestFingerprint: input.quote.requestFingerprint,
            startedAt: new Date(),
            status: 'RESERVED',
            submissionSnapshot: { text: input.quote.submissionText },
            userId: input.userId,
          },
        });
        return { correctionId: created.id, created: true };
      } catch (error) {
        const existing = await this.prisma.aiCorrection.findFirst({
          select: { id: true },
          where: {
            requestFingerprint: input.quote.requestFingerprint,
            userId: input.userId,
          },
        });
        if (existing) {
          return { correctionId: existing.id, created: false };
        }
        throw error;
      }
    },
    finalize: async (input): Promise<void> => {
      await this.prisma.aiCorrection.update({
        data: {
          completedAt: new Date(),
          indicativeScore: input.result.indicativeScore,
          status:
            input.result.status === 'COMPLETED' ? 'COMPLETED' : 'PROVISIONAL',
          structuredResult: {
            correction: { ...input.result, id: input.correctionId },
            settlement: {
              releasedCredits: (
                input.quote.maximumReservedCredits -
                input.quote.estimatedCredits
              ).toString(),
              reservedCredits: input.quote.maximumReservedCredits.toString(),
              settledCredits: input.quote.estimatedCredits.toString(),
            },
          },
        },
        where: { id: input.correctionId },
      });
    },
    findByQuote: async (input: {
      userId: string;
      requestFingerprint: string;
    }) => {
      const correction = await this.prisma.aiCorrection.findFirst({
        include: {
          creditReservation: {
            select: { id: true, settledAmount: true, status: true },
          },
        },
        where: {
          requestFingerprint: input.requestFingerprint,
          userId: input.userId,
        },
      });
      if (!correction) {
        return null;
      }
      if (
        correction.status === 'RESERVED' ||
        correction.status === 'PROCESSING' ||
        correction.status === 'PROCESSING_PRIMARY' ||
        correction.status === 'VERIFYING'
      ) {
        return { state: 'IN_PROGRESS' } as const;
      }
      if (correction.status === 'RECONCILIATION_REQUIRED') {
        return { state: 'RECONCILIATION_REQUIRED' } as const;
      }
      const structured = (correction.structuredResult ?? {}) as {
        correction?: OrchestratedCorrectionResult['correction'];
        settlement?: OrchestratedCorrectionResult['settlement'];
      };
      if (
        !structured.correction ||
        !structured.settlement ||
        !correction.creditReservation
      ) {
        return { state: 'RECONCILIATION_REQUIRED' } as const;
      }
      const result: OrchestratedCorrectionResult = {
        correction: structured.correction,
        settlement: structured.settlement,
        replay: true,
      };
      if (correction.creditReservation.status === 'RESERVED') {
        return {
          reservationId: correction.creditReservation.id,
          result,
          state: 'READY_TO_SETTLE',
        } as const;
      }
      if (
        correction.creditReservation.status === 'SETTLED' &&
        correction.creditReservation.settledAmount?.toString() ===
          structured.settlement.settledCredits
      ) {
        return { result, state: 'READY' } as const;
      }
      return { state: 'RECONCILIATION_REQUIRED' } as const;
    },
    markReconciliationRequired: async (input): Promise<void> => {
      await this.prisma.aiCorrection.update({
        data: { status: 'RECONCILIATION_REQUIRED' },
        where: { id: input.correctionId },
      });
    },
    recordAttemptIntent: async (input): Promise<void> => {
      await this.prisma.aiCorrectionAttempt.create({
        data: {
          correctionId: input.correctionId,
          dispatchStatus: 'CALL_INTENT',
          modelId: PROMOTED_CORRECTION_IDENTITY.modelId,
          modelRole: 'CORRECTION_PRIMARY',
          provider: PROMOTED_CORRECTION_IDENTITY.provider,
          providerIdempotencyKey: `correction:${input.correctionId}:attempt:${input.sequence}`,
          requestManifest: {
            modelId: PROMOTED_CORRECTION_IDENTITY.modelId,
            provider: PROMOTED_CORRECTION_IDENTITY.provider,
            sequence: input.sequence,
          },
          retryable: false,
          sequence: input.sequence,
          status: 'PROCESSING',
        },
      });
    },
    recordAttemptOutcome: async (input): Promise<void> => {
      const attempt: RuntimeCorrectionAttempt = input.attempt;
      await this.prisma.aiCorrectionAttempt.update({
        data: {
          completedAt: new Date(),
          completionTokens: attempt.visibleOutputTokens,
          costConfirmedAt:
            attempt.actualCostUsd === undefined ? undefined : new Date(),
          costSource:
            attempt.actualCostUsd === undefined ? undefined : 'ACTUAL',
          costUsd: attempt.actualCostUsd,
          dispatchStatus:
            attempt.providerRequestId === undefined ? 'ORPHANED' : 'CONFIRMED',
          errorCode: attempt.errorCode,
          generationId: attempt.providerRequestId,
          latencyMs: attempt.latencyMs,
          modelId:
            attempt.modelSnapshot ?? PROMOTED_CORRECTION_IDENTITY.modelId,
          promptTokens: attempt.inputTokens,
          provider:
            attempt.providerRoute ?? PROMOTED_CORRECTION_IDENTITY.provider,
          rawOutput:
            attempt.status === 'FAILED' && attempt.output !== undefined
              ? (attempt.output as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          reasoningTokens: attempt.reasoningTokens,
          status: attempt.status,
          structuredResult:
            attempt.status === 'SUCCEEDED' && attempt.output !== undefined
              ? (attempt.output as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          totalTokens:
            attempt.inputTokens === undefined ||
            attempt.visibleOutputTokens === undefined
              ? undefined
              : attempt.inputTokens +
                attempt.visibleOutputTokens +
                (attempt.reasoningTokens ?? 0),
        },
        where: {
          correctionId_sequence: {
            correctionId: input.correctionId,
            sequence: attempt.sequence,
          },
        },
      });
    },
  };
}
