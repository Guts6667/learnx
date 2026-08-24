import type { AcceptedQuoteSnapshot, OrchestratedCorrectionResult } from './correction-orchestration';

interface QuoteRow {
  ceilingCredits: bigint;
  estimatedCredits: bigint;
  expiresAt: Date;
  id: string;
  status: string;
  targetType: string;
  userId: string;
}

interface SubmissionRow {
  contentMarkdown: string;
  exercise: { instructions: string; rubric: unknown } | null;
  status: string;
  userId: string;
}

interface CorrectionRow {
  id: string;
  status: string;
  structuredResult: unknown;
}

/**
 * Implémentation Prisma des ports de l'orchestration V4-009 :
 * chargement d'un devis accepté, journal de la correction consommée et
 * rejeu idempotent par empreinte de requête.
 */
export class PrismaCorrectionOrchestrationPorts {
  public constructor(
    private readonly prisma: {
      aiPricingQuote: {
        findFirst: (input: unknown) => Promise<
          (QuoteRow & {
            contractKey: string;
            contractVersion: string;
            promptVersion: string;
            requestFingerprint: string;
            targetId: string;
          }) | null
        >;
      };
      exerciseSubmission: {
        findFirst: (input: unknown) => Promise<
          (SubmissionRow & { id: string }) | null
        >;
      };
      aiCorrection: {
        findFirst: (input: unknown) => Promise<CorrectionRow | null>;
        create: (input: unknown) => Promise<CorrectionRow>;
      };
      $executeRaw: (input: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
    },
  ) {}

  public readonly quotes = {
    loadAcceptedQuote: async (input: {
      quoteId: string;
      userId: string;
    }): Promise<AcceptedQuoteSnapshot | null> => {
      const quote = await this.prisma.aiPricingQuote.findFirst({
        where: { id: input.quoteId, userId: input.userId },
      });
      if (!quote || quote.status !== 'ACTIVE') {
        return null;
      }
      if (quote.targetType !== 'EXERCISE_SUBMISSION') {
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
        contractKey: quote.contractKey,
        contractVersion: quote.contractVersion,
        requestFingerprint: quote.requestFingerprint,
        submissionText: submission.contentMarkdown,
        exerciseInstructions: submission.exercise.instructions,
        taskContext: null,
        contract: submission.exercise.rubric,
      };
    },
    markConsumed: async (input: { quoteId: string }): Promise<void> => {
      await this.prisma.$executeRaw`
        UPDATE ai_pricing_quotes SET status = 'CONSUMED'
        WHERE id = ${input.quoteId}::uuid AND status = 'ACTIVE'
      `;
    },
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
      userId: string;
      quote: AcceptedQuoteSnapshot;
      result: OrchestratedCorrectionResult['correction'];
    }): Promise<{ id: string }> => {
      const created = await this.prisma.aiCorrection.create({
        data: {
          contractSnapshot: input.quote.contract as object,
          exerciseSubmissionId: input.quote.target.id,
          idempotencyKey: `quote:${input.quote.quoteId}`,
          method: 'AI',
          modelId: 'anthropic/claude-sonnet-4.6',
          promptSnapshot: {},
          promptVersion: input.quote.promptVersion,
          requestFingerprint: input.quote.requestFingerprint,
          status: input.result.status === 'FAILED' ? 'FAILED_RELEASED' : 'COMPLETED',
          structuredResult: { correction: input.result },
          submissionSnapshot: { text: input.quote.submissionText },
          userId: input.userId,
        },
      });
      return { id: created.id };
    },
  };
}
