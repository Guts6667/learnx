/**
 * The correction circuit breaker, V4.5-140. Implements §6 of the quality
 * contract.
 *
 * Pure: it decides from counts a caller has already gathered, so the rule can
 * be read, tested and reasoned about without a database. Lives in src/lib
 * because the regression suite evaluates the same rule offline, and src/lib may
 * never import src/server.
 *
 * Three independent conditions, each with its own rate and its own threshold.
 * One number for three rules would lie: a supplier degradation and a
 * miscalibrated confidence table are different failures and cross different
 * lines.
 */

export type BreakerReason =
  /** The independent checker contradicts the correction too often. */
  | 'CHECKER_DISAGREEMENT'
  /** Too many corrections deliver nothing at all. */
  | 'UNUSABLE_RATE'
  /** Learners contradict criteria we labelled HIGH. */
  | 'LEARNER_CONTRADICTION_AT_HIGH';

export const BREAKER_THRESHOLDS = {
  checkerDisagreement: 0.4,
  unusable: 0.05,
  wrongAtHigh: 0.1,
} as const;

/** Rolling window of recent corrections the first two rules are measured on. */
export const BREAKER_WINDOW_SIZE = 50;

/**
 * Votes needed before the learner rule can fire — counted in HIGH-labelled
 * criteria that actually received a vote, not in corrections. Feedback only
 * began to exist in V4.5-112, so this rule is provably inert until enough of it
 * accumulates. Arming a threshold against a metric nobody has ever seen values
 * for is the mistake V4 made with self-reported confidence.
 */
export const BREAKER_WRONG_AT_HIGH_QUORUM = 20;

export interface BreakerObservations {
  /** Corrections in the window whose checker contradicted a criterion. */
  checkerDisagreed: number;
  /** Corrections in the window that delivered nothing. */
  unusable: number;
  /** Corrections observed in the window; below the window size early on. */
  windowObserved: number;
  /** HIGH-labelled criteria that received any learner verdict. */
  highCriteriaVoted: number;
  /** Of those, the ones the learner called wrong. */
  highCriteriaVotedWrong: number;
}

export interface BreakerRates {
  checkerDisagreement: number | null;
  unusable: number | null;
  wrongAtHigh: number | null;
}

/**
 * Rates are null below quorum rather than zero. Zero reads as health; null
 * reads as "not enough data", which is what an empty window actually means and
 * what the admin page must be able to say.
 */
export function breakerRates(input: BreakerObservations): BreakerRates {
  const windowed = input.windowObserved >= BREAKER_WINDOW_SIZE;
  return {
    checkerDisagreement: windowed
      ? input.checkerDisagreed / input.windowObserved
      : null,
    unusable: windowed ? input.unusable / input.windowObserved : null,
    wrongAtHigh:
      input.highCriteriaVoted >= BREAKER_WRONG_AT_HIGH_QUORUM
        ? input.highCriteriaVotedWrong / input.highCriteriaVoted
        : null,
  };
}

/**
 * The reason to trip on, or null. Order is the order of the contract, and it
 * matters only for which reason is recorded when several cross at once — the
 * supplier-side ones come first because they explain the others.
 */
export function breakerTripReason(rates: BreakerRates): BreakerReason | null {
  if (
    rates.checkerDisagreement !== null &&
    rates.checkerDisagreement > BREAKER_THRESHOLDS.checkerDisagreement
  ) {
    return 'CHECKER_DISAGREEMENT';
  }
  if (rates.unusable !== null && rates.unusable > BREAKER_THRESHOLDS.unusable) {
    return 'UNUSABLE_RATE';
  }
  if (
    rates.wrongAtHigh !== null &&
    rates.wrongAtHigh > BREAKER_THRESHOLDS.wrongAtHigh
  ) {
    return 'LEARNER_CONTRADICTION_AT_HIGH';
  }
  return null;
}
