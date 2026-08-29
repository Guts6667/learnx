import type { CreditCohort } from '../../../generated/prisma/client.js';

/**
 * The scheduled free allocation (V4.5-163).
 *
 * The first thing in LearnX that hands out credits on a schedule, so the rules
 * are stated here rather than inferred from the code that applies them.
 */

/**
 * One grant per account per calendar month, in Europe/Paris — the timezone the
 * product speaks in, so a learner's month starts when their month does rather
 * than at 01:00 or 02:00 depending on daylight saving.
 */
export function monthlyCycleKey(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    month: '2-digit',
    timeZone: 'Europe/Paris',
    year: 'numeric',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '00';
  return `${year}-${month}`;
}

export type TrialGrantOutcome =
  | { kind: 'GRANTED'; amount: bigint; cycleKey: string }
  /** The cycle already has a grant. Repeating is not an error. */
  | { kind: 'ALREADY_GRANTED'; cycleKey: string }
  /**
   * Corrections are suspended, so a grant would be a promise we cannot keep
   * this cycle. The next cycle grants normally; there is no catch-up, because
   * a learner who missed a cycle gets the next one, not two.
   */
  | { kind: 'SUSPENDED'; cycleKey: string }
  /** No active policy serves this cohort. */
  | { kind: 'NO_POLICY'; cycleKey: string }
  /**
   * An anti-abuse rule refused it. The verdict is recorded for the weekly
   * report; the learner is told the trial is unavailable, never which rule
   * caught them, because naming the rule is a map for working around it.
   */
  | { kind: 'REFUSED'; cycleKey: string; verdict: 'CAP_REACHED' | 'TOO_FAST' };

export interface TrialAllocationPolicy {
  allocationAmount: bigint;
  cohort: CreditCohort | null;
  id: string;
}

/**
 * Picks the policy that serves a cohort: the one naming it, or the catch-all.
 * A cohort-specific policy wins, so a general allocation can exist without
 * silently overriding a cohort someone configured deliberately.
 */
export function policyForCohort(
  policies: TrialAllocationPolicy[],
  cohort: CreditCohort,
): TrialAllocationPolicy | null {
  return (
    policies.find((policy) => policy.cohort === cohort) ??
    policies.find((policy) => policy.cohort === null) ??
    null
  );
}
