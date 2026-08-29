import type { PrismaClient } from '../../../generated/prisma/client.js';

export type CriterionFeedbackVerdict = 'HELPFUL' | 'WRONG';

/**
 * Three outcomes, kept apart because they mean different things to the caller.
 * NOT_FOUND covers a correction that is not the learner's — indistinguishable
 * from one that does not exist. UNKNOWN_CRITERION means the correction is
 * theirs but names a criterion it never mentioned, which only its owner can
 * ever see and so leaks nothing.
 */
export type RecordFeedbackOutcome =
  | { recordedAt: Date; status: 'RECORDED' }
  | { status: 'NOT_FOUND' }
  | { status: 'UNKNOWN_CRITERION' };

export interface CorrectionFeedbackPort {
  record(input: {
    correctionId: string;
    criterionKey: string;
    userId: string;
    verdict: CriterionFeedbackVerdict;
  }): Promise<RecordFeedbackOutcome>;
  listForCorrections(input: {
    correctionIds: string[];
    userId: string;
  }): Promise<Record<string, Record<string, CriterionFeedbackVerdict>>>;
}

export class PrismaCorrectionFeedbackRepository implements CorrectionFeedbackPort {
  public constructor(private readonly prisma: PrismaClient) {}

  public async record(input: {
    correctionId: string;
    criterionKey: string;
    userId: string;
    verdict: CriterionFeedbackVerdict;
  }): Promise<RecordFeedbackOutcome> {
    // Scoped by userId inside the query: another learner's correction has to be
    // indistinguishable from one that does not exist, so ownership decides
    // "not found" rather than producing a "forbidden" that confirms it exists.
    const correction = await this.prisma.aiCorrection.findFirst({
      select: { structuredResult: true },
      where: { id: input.correctionId, userId: input.userId },
    });
    if (!correction) return { status: 'NOT_FOUND' };

    // A verdict on a criterion the correction never mentioned would be a
    // learner writing arbitrary keys into a signal we intend to count, so the
    // key has to come from the correction it claims to be about. Criteria
    // returned as « à retravailler » count: "you refused to judge this and you
    // were wrong to" is the one signal no machine oracle can produce, and it
    // is what calibrates the LOW boundary.
    if (
      !addressableCriterionKeys(correction.structuredResult).has(
        input.criterionKey,
      )
    ) {
      return { status: 'UNKNOWN_CRITERION' };
    }

    // One row per (correction, learner, criterion): a second verdict replaces
    // the first. Someone changing their mind must not count twice.
    const saved = await this.prisma.aiCorrectionCriterionFeedback.upsert({
      create: {
        correctionId: input.correctionId,
        criterionKey: input.criterionKey,
        userId: input.userId,
        verdict: input.verdict,
      },
      select: { updatedAt: true },
      update: { verdict: input.verdict },
      where: {
        correctionId_userId_criterionKey: {
          correctionId: input.correctionId,
          criterionKey: input.criterionKey,
          userId: input.userId,
        },
      },
    });
    return { recordedAt: saved.updatedAt, status: 'RECORDED' };
  }

  public async listForCorrections(input: {
    correctionIds: string[];
    userId: string;
  }): Promise<Record<string, Record<string, CriterionFeedbackVerdict>>> {
    if (input.correctionIds.length === 0) return {};
    const rows = await this.prisma.aiCorrectionCriterionFeedback.findMany({
      select: { correctionId: true, criterionKey: true, verdict: true },
      where: {
        correctionId: { in: input.correctionIds },
        userId: input.userId,
      },
    });
    const byCorrection: Record<
      string,
      Record<string, CriterionFeedbackVerdict>
    > = {};
    for (const row of rows) {
      byCorrection[row.correctionId] ??= {};
      byCorrection[row.correctionId][row.criterionKey] = row.verdict;
    }
    return byCorrection;
  }
}

/** Every criterion the learner was shown: delivered, plus those sent back. */
function addressableCriterionKeys(structuredResult: unknown): Set<string> {
  const stored = (structuredResult ?? {}) as {
    correction?: { criteria?: unknown; unsureCriteria?: unknown };
  };
  const delivered = Array.isArray(stored.correction?.criteria)
    ? stored.correction.criteria.map((item) => (item as { key?: unknown }).key)
    : [];
  const unsure = Array.isArray(stored.correction?.unsureCriteria)
    ? stored.correction.unsureCriteria
    : [];
  return new Set(
    [...delivered, ...unsure].filter(
      (key): key is string => typeof key === 'string',
    ),
  );
}
