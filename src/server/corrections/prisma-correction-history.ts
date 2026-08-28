import type { PrismaClient } from '../../../generated/prisma/client.js';
import type {
  CorrectionHistoryEntry,
  OrchestratedCorrectionResult,
} from './correction-orchestration-contracts.js';

function settledResult(correction: {
  creditReservation: { settledAmount: unknown; status: string } | null;
  structuredResult: unknown;
}): OrchestratedCorrectionResult | null {
  if (!correction.creditReservation) return null;
  const structured = (correction.structuredResult ?? {}) as {
    correction?: OrchestratedCorrectionResult['correction'];
    settlement?: OrchestratedCorrectionResult['settlement'];
  };
  if (!structured.correction || !structured.settlement) return null;
  if (
    correction.creditReservation.status !== 'SETTLED' ||
    String(correction.creditReservation.settledAmount) !==
      structured.settlement.settledCredits
  ) {
    return null;
  }
  return {
    correction: structured.correction,
    replay: true,
    settlement: structured.settlement,
  };
}

export class PrismaCorrectionHistoryRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async findLatest(input: {
    submissionId: string;
    userId: string;
  }): Promise<OrchestratedCorrectionResult | null> {
    const correction = await this.prisma.aiCorrection.findFirst({
      include: {
        creditReservation: { select: { settledAmount: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      where: {
        exerciseSubmissionId: input.submissionId,
        userId: input.userId,
      },
    });
    return correction ? settledResult(correction) : null;
  }

  public async list(input: {
    submissionId: string;
    userId: string;
  }): Promise<CorrectionHistoryEntry[]> {
    const corrections = await this.prisma.aiCorrection.findMany({
      include: {
        creditReservation: { select: { settledAmount: true, status: true } },
        pricingQuote: { select: { action: true } },
      },
      orderBy: { createdAt: 'asc' },
      where: {
        exerciseSubmissionId: input.submissionId,
        userId: input.userId,
      },
    });
    return corrections.flatMap((correction) => {
      const result = settledResult(correction);
      if (!result) return [];
      return [
        {
          action:
            correction.pricingQuote?.action === 'RECONSIDERATION'
              ? ('RECONSIDERATION' as const)
              : ('STANDARD' as const),
          createdAt: correction.createdAt,
          sourceCorrectionId: correction.reconsiderationOfId,
          result,
        },
      ];
    });
  }
}
