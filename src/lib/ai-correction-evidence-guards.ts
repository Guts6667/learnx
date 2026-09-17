/**
 * Deterministic evidence guards (V4.5-210, step D0).
 *
 * Two failure modes observed in the review basis need no model to catch, and no
 * verifier can catch them: there is nothing to verify. A criterion the grader
 * never returned cannot carry a level, and a top level asserted without a single
 * resolved quote is a claim with no evidence behind it.
 *
 * These run before any verifier and stay outside the verifier's denominator.
 * They are part of the end-to-end evaluation, where they account for 2 of the
 * 18 observed failures.
 */

export const EVIDENCE_GUARD_CODES = [
  'CRITERION_ABSENT_FROM_OUTPUT',
  'TOP_LEVEL_WITHOUT_RESOLVED_EVIDENCE',
] as const;

export type EvidenceGuardCode = (typeof EVIDENCE_GUARD_CODES)[number];

export type EvidenceGuardViolation = {
  code: EvidenceGuardCode;
  criterionKey: string;
  /** The level the output claimed, when it claimed one. */
  levelKey?: string;
};

export type EvidenceGuardCriterion = {
  criterionKey: string;
  evidenceQuotes?: string[];
  levelKey: string;
};

export type EvidenceGuardInput = {
  /** Every criterion the contract requires the grader to return. */
  expectedCriterionKeys: string[];
  /** What the grader actually returned. */
  returnedCriteria: EvidenceGuardCriterion[];
  /**
   * The learner response the quotes must resolve against. A quote that does not
   * occur in the response is not evidence, whatever it says.
   */
  responseText: string;
  /** The level keys that count as the top of a scale. */
  topLevelKeys: string[];
};

/** Whitespace differences are not evidence differences. */
function normalise(value: string): string {
  return value.replace(/\s+/gu, ' ').trim().toLowerCase();
}

/**
 * Applies both guards. Returns every violation, ordered by criterion, so a
 * caller reports all of them rather than the first.
 */
export function checkEvidenceGuards(
  input: EvidenceGuardInput,
): EvidenceGuardViolation[] {
  const violations: EvidenceGuardViolation[] = [];
  const returned = new Map(
    input.returnedCriteria.map((criterion) => [
      criterion.criterionKey,
      criterion,
    ]),
  );
  const haystack = normalise(input.responseText);
  const top = new Set(input.topLevelKeys);

  for (const criterionKey of input.expectedCriterionKeys) {
    const criterion = returned.get(criterionKey);
    if (!criterion) {
      violations.push({ code: 'CRITERION_ABSENT_FROM_OUTPUT', criterionKey });
      continue;
    }
    if (!top.has(criterion.levelKey)) continue;
    const resolved = (criterion.evidenceQuotes ?? []).filter((quote) => {
      const needle = normalise(quote);
      return needle.length > 0 && haystack.includes(needle);
    });
    if (resolved.length === 0) {
      violations.push({
        code: 'TOP_LEVEL_WITHOUT_RESOLVED_EVIDENCE',
        criterionKey,
        levelKey: criterion.levelKey,
      });
    }
  }
  return violations;
}
