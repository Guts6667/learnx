import { type PrismaClient } from '../../../generated/prisma/client.js';

import type {
  CorrectionHistoryEntry,
  CorrectionPersistencePort,
  OrchestratedCorrectionResult,
  RuntimeCorrectionAttempt,
} from './correction-orchestration';
import {
  withStoredConfidence,
  type StoredCorrection,
} from './correction-outcome.js';
import { PROMOTED_CORRECTION_IDENTITY } from './promoted-identity.js';
import { RUNTIME_RECONSIDERATION_PROMPT_VERSION } from './runtime-correction-prompt.js';
import { PrismaCorrectionHistoryRepository } from './prisma-correction-history.js';
import { toAttemptOutcomeData } from './prisma-correction-attempt-mapper.js';
import { PrismaCorrectionQuoteRepository } from './prisma-correction-quotes.js';

/**
 * The settlement figures written with a correction must match what the ledger
 * did, not what the quote asked for. A FAILED correction releases its
 * reservation, so it is stored as nothing charged; anything else settles the
 * accepted quote, partial deliveries included.
 */
function settlementFor(
  status: OrchestratedCorrectionResult['correction']['status'],
  quote: { estimatedCredits: bigint; maximumReservedCredits: bigint },
): OrchestratedCorrectionResult['settlement'] {
  const settled = status === 'FAILED' ? 0n : quote.estimatedCredits;
  return {
    releasedCredits: (quote.maximumReservedCredits - settled).toString(),
    reservedCredits: quote.maximumReservedCredits.toString(),
    settledCredits: settled.toString(),
  };
}

/**
 * Implémentation Prisma des ports de l'orchestration V4-009 :
 * chargement d'un devis accepté, journal de la correction consommée et
 * rejeu idempotent par empreinte de requête.
 */
export class PrismaCorrectionOrchestrationPorts {
  private readonly history: PrismaCorrectionHistoryRepository;
  private readonly quoteRepository: PrismaCorrectionQuoteRepository;

  public constructor(private readonly prisma: PrismaClient) {
    this.history = new PrismaCorrectionHistoryRepository(prisma);
    this.quoteRepository = new PrismaCorrectionQuoteRepository(prisma);
  }

  public async findLatestForSubmission(input: {
    submissionId: string;
    userId: string;
  }): Promise<OrchestratedCorrectionResult | null> {
    return this.history.findLatest(input);
  }

  public async listForSubmission(input: {
    submissionId: string;
    userId: string;
  }): Promise<CorrectionHistoryEntry[]> {
    return this.history.list(input);
  }

  public get quotes() {
    return this.quoteRepository.quotes;
  }

  public readonly corrections: CorrectionPersistencePort = {
    begin: async (
      input,
    ): Promise<{
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
            promptSnapshot: {
              exerciseInstructions: input.quote.exerciseInstructions,
              ...(input.quote.reconsideration
                ? {
                    reconsiderationPromptVersion:
                      RUNTIME_RECONSIDERATION_PROMPT_VERSION,
                  }
                : {}),
              taskContext: input.quote.taskContext,
            },
            promptVersion: input.quote.reconsideration
              ? `${input.quote.promptVersion}+reconsideration-${RUNTIME_RECONSIDERATION_PROMPT_VERSION}`
              : input.quote.promptVersion,
            provider: PROMOTED_CORRECTION_IDENTITY.provider,
            requestFingerprint: input.quote.requestFingerprint,
            reconsiderationArgument:
              input.quote.reconsideration?.argument ?? null,
            reconsiderationOfId:
              input.quote.reconsideration?.sourceCorrectionId ?? null,
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
            userId: input.userId,
            OR: [
              { requestFingerprint: input.quote.requestFingerprint },
              ...(input.quote.reconsideration
                ? [
                    {
                      reconsiderationOfId:
                        input.quote.reconsideration.sourceCorrectionId,
                    },
                  ]
                : []),
            ],
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
            // A correction that delivered nothing has its reservation released,
            // so persisting the quote amount here would record a charge that
            // never happens. The stored figures must describe what the ledger
            // did, because the history endpoint and any replay read them back.
            settlement: settlementFor(input.result.status, input.quote),
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
        correction?: StoredCorrection;
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
        correction: withStoredConfidence(structured.correction),
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
      // A released reservation is a settled state too, for a correction that
      // delivered nothing: the ledger closed it by giving the credits back.
      // Without this the learner gets a reconciliation error on refresh, for a
      // failure that was handled correctly.
      if (
        correction.creditReservation.status === 'RELEASED' &&
        structured.correction.status === 'FAILED' &&
        structured.settlement.settledCredits === '0'
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
        data: toAttemptOutcomeData(attempt),
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
