import {
  Prisma,
  type PrismaClient,
} from '../../../generated/prisma/client.js';

import type {
  AcceptedQuoteSnapshot,
  OrchestratedCorrectionResult,
  RuntimeCorrectionAttempt,
} from './correction-orchestration';
import { PROMOTED_CORRECTION_IDENTITY } from './promoted-identity';

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

  public readonly corrections = {
    findByQuote: async (input: {
      userId: string;
      requestFingerprint: string;
    }): Promise<OrchestratedCorrectionResult | null> => {
      const correction = await this.prisma.aiCorrection.findFirst({
        where: {
          requestFingerprint: input.requestFingerprint,
          userId: input.userId,
        },
      });
      if (!correction || correction.status === 'RESERVED') {
        return null;
      }
      const structured = (correction.structuredResult ?? {}) as {
        correction?: OrchestratedCorrectionResult['correction'];
        settlement?: OrchestratedCorrectionResult['settlement'];
      };
      if (!structured.correction || !structured.settlement) {
        return null;
      }
      return {
        correction: structured.correction,
        settlement: structured.settlement,
        replay: true,
      };
    },
    persist: async (input: {
      attempts: RuntimeCorrectionAttempt[];
      userId: string;
      quote: AcceptedQuoteSnapshot;
      result: OrchestratedCorrectionResult['correction'];
    }): Promise<{ id: string }> => {
      const created = await this.prisma.aiCorrection.create({
        data: {
          contractSnapshot: input.quote.contract as object,
          exerciseSubmissionId: input.quote.target.id,
          completedAt: new Date(),
          idempotencyKey: `quote:${input.quote.quoteId}`,
          method: 'AI',
          modelId: PROMOTED_CORRECTION_IDENTITY.modelId,
          modelRole: 'CORRECTION_PRIMARY',
          provider: PROMOTED_CORRECTION_IDENTITY.provider,
          promptSnapshot: {},
          promptVersion: input.quote.promptVersion,
          requestFingerprint: input.quote.requestFingerprint,
          status:
            input.result.status === 'COMPLETED'
              ? 'COMPLETED'
              : 'AI_REVIEW_REQUIRED',
          structuredResult: {
            correction: input.result,
            settlement: {
              releasedCredits: (
                input.quote.maximumReservedCredits -
                input.quote.estimatedCredits
              ).toString(),
              reservedCredits: input.quote.maximumReservedCredits.toString(),
              settledCredits: input.quote.estimatedCredits.toString(),
            },
          },
          submissionSnapshot: { text: input.quote.submissionText },
          attempts: {
            create: input.attempts.map((attempt) => ({
              completedAt: new Date(),
              completionTokens: attempt.visibleOutputTokens,
              costUsd: attempt.actualCostUsd,
              errorCode: attempt.errorCode,
              generationId: attempt.providerRequestId,
              latencyMs: attempt.latencyMs,
              modelId:
                attempt.modelSnapshot ?? PROMOTED_CORRECTION_IDENTITY.modelId,
              modelRole: 'CORRECTION_PRIMARY',
              promptTokens: attempt.inputTokens,
              provider:
                attempt.providerRoute ?? PROMOTED_CORRECTION_IDENTITY.provider,
              retryable: false,
              sequence: attempt.sequence,
              status: attempt.status,
              structuredResult:
                attempt.output === undefined
                  ? undefined
                  : (attempt.output as Prisma.InputJsonValue),
              totalTokens:
                attempt.inputTokens === undefined ||
                attempt.visibleOutputTokens === undefined
                  ? undefined
                  : attempt.inputTokens +
                    attempt.visibleOutputTokens +
                    (attempt.reasoningTokens ?? 0),
            })),
          },
          userId: input.userId,
        },
      });
      return { id: created.id };
    },
  };
}
