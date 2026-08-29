/**
 * Anti-abuse limits on the trial allocation (V4.5-163B).
 *
 * Two rules, deliberately separate. A cap answers "how many trial accounts has
 * this address ever fed", a velocity answers "how many in the last day". A
 * single number cannot do both: a shared office IP legitimately accumulates
 * accounts over months, and the thing worth refusing is a burst.
 */

export interface TrialAbuseLimits {
  /** Trial grants ever made under one key. */
  maxGrantsPerKey: number;
  /** Grants under one key inside the velocity window. */
  maxGrantsPerWindow: number;
  velocityWindowMs: number;
}

export const DEFAULT_TRIAL_ABUSE_LIMITS: TrialAbuseLimits = {
  maxGrantsPerKey: 3,
  maxGrantsPerWindow: 2,
  velocityWindowMs: 24 * 60 * 60 * 1_000,
};

export interface TrialAbuseMarker {
  firstSeenAt: Date;
  grants: number;
  lastSeenAt: Date;
}

export type TrialAbuseVerdict = 'ALLOWED' | 'CAP_REACHED' | 'TOO_FAST';

/**
 * Absent marker means never seen, which is allowed — the default answer for a
 * first-time visitor has to be yes, or the trial never starts for anyone.
 */
export function evaluateTrialAbuse(input: {
  limits?: TrialAbuseLimits;
  marker: TrialAbuseMarker | null;
  now: Date;
}): TrialAbuseVerdict {
  const limits = input.limits ?? DEFAULT_TRIAL_ABUSE_LIMITS;
  if (!input.marker) return 'ALLOWED';
  if (input.marker.grants >= limits.maxGrantsPerKey) return 'CAP_REACHED';

  const windowStart = new Date(input.now.getTime() - limits.velocityWindowMs);
  // Only the recency of the last grant is known, not each one, so the velocity
  // rule reads as "another grant within the window, having already reached the
  // per-window count". That is coarser than tracking every timestamp and it is
  // the trade: the marker stays a single row that names nobody.
  if (
    input.marker.lastSeenAt > windowStart &&
    input.marker.grants >= limits.maxGrantsPerWindow
  ) {
    return 'TOO_FAST';
  }
  return 'ALLOWED';
}
