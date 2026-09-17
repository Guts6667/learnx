/** Qualification oracles measured independently of the grader's own confidence. */
import type { BenchmarkAttempt } from './ai-correction-benchmark-artifacts.js';
import type { FalseAgreeProbeResult } from './ai-correction-false-agree-probe.js';
import { checkQuotedArithmetic } from './ai-correction-quoted-arithmetic.js';
import type {
  RegressionCaseScale,
  RegressionObservation,
  RegressionRate,
} from './ai-correction-regression-contracts.js';

function arithmeticRate(quotes: string[]): RegressionRate {
  let denominator = 0;
  let numerator = 0;
  for (const quote of quotes) {
    const checked = checkQuotedArithmetic([quote]);
    denominator += checked.coverage.quotesInScope;
    // Unit of observation is a quote, not each equation inside the quote.
    if (checked.violations.length > 0) numerator += 1;
  }
  return {
    denominator,
    numerator,
    rate: denominator ? numerator / denominator : null,
  };
}

/** The raw rejected payload is inspected only for quote strings, never repaired. */
function rawQuotes(attempt: BenchmarkAttempt): string[] {
  if (!attempt.rawModelOutput)
    return (
      attempt.output?.criteria.flatMap((c) => c.evidenceQuotes ?? []) ?? []
    );
  let raw: unknown;
  try {
    raw = JSON.parse(attempt.rawModelOutput);
  } catch {
    return [];
  }
  if (!raw || typeof raw !== 'object' || !('criteria' in raw)) return [];
  const criteria = raw.criteria;
  if (!criteria || typeof criteria !== 'object') return [];
  return Object.values(criteria).flatMap((criterion: unknown) => {
    if (
      !criterion ||
      typeof criterion !== 'object' ||
      !('evidenceQuotes' in criterion)
    )
      return [];
    return Array.isArray(criterion.evidenceQuotes)
      ? criterion.evidenceQuotes.filter(
          (quote): quote is string => typeof quote === 'string',
        )
      : [];
  });
}

export function computeQualificationMetrics(input: {
  attempts: BenchmarkAttempt[];
  observations: RegressionObservation[];
  scales: RegressionCaseScale[];
  designedCheckerProbe?: FalseAgreeProbeResult;
}): {
  quotedArithmeticCoverage: {
    delivered: { quotesInScope: number; quotesTotal: number };
    anyAttempt: { quotesInScope: number; quotesTotal: number };
    unreadableRawAttempts: number;
  };
  checkerFalseAgreeDesigned: RegressionRate;
  quotedArithmeticViolationsDelivered: RegressionRate;
  quotedArithmeticViolationsAnyAttempt: RegressionRate;
} {
  const endorsedQuotes = input.observations.flatMap((observation) => {
    const scale = input.scales.find((c) => c.caseId === observation.caseId);
    return observation.criteria.flatMap((criterion) => {
      const highest = scale?.criteria
        .find((c) => c.criterionKey === criterion.criterionKey)
        ?.orderedLevelKeys.at(-1);
      if (
        criterion.levelKey !== highest ||
        criterion.evidenceWithdrawn ||
        criterion.confidence === 'LOW'
      )
        return [];
      return criterion.evidenceQuotes ?? [];
    });
  });
  const attemptedQuotes = input.attempts.flatMap(rawQuotes);
  return {
    quotedArithmeticCoverage: {
      delivered: checkQuotedArithmetic(endorsedQuotes).coverage,
      anyAttempt: checkQuotedArithmetic(attemptedQuotes).coverage,
      unreadableRawAttempts: input.attempts.filter((attempt) => {
        if (!attempt.rawModelOutput) return !attempt.output;
        try {
          JSON.parse(attempt.rawModelOutput);
          return false;
        } catch {
          return true;
        }
      }).length,
    },
    checkerFalseAgreeDesigned: input.designedCheckerProbe
      ?.checkerFalseAgreeDesigned ?? {
      denominator: 0,
      numerator: 0,
      rate: null,
    },
    quotedArithmeticViolationsDelivered: arithmeticRate(endorsedQuotes),
    quotedArithmeticViolationsAnyAttempt: arithmeticRate(attemptedQuotes),
  };
}
