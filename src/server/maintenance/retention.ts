const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export interface RetentionPolicy {
  batchSize: number;
  maxBatches: number;
  /**
   * The raw provider body on a payment event (V4.5-197,
   * `owner-e4-2026-08-30`). Thirty days is long enough for a human to
   * reconcile a disputed charge against the provider's dashboard, and the
   * accounting trace does not depend on it: event id, type, order, amounts,
   * currency, status and timestamps are columns of their own and are kept.
   */
  /**
   * How long a correction stays attached to the learner who wrote it
   * (V4.5-168, `owner-rgpd-2026-08-29` §2). After this, their words leave the
   * correction: the judgement stays, the production, the prompt carrying it,
   * the quotes and the raw output do not. The privacy policy promises exactly
   * this, which is why the figure lives where it can be read rather than in a
   * comment.
   */
  correctionDetachRetentionMs: number;
  paymentPayloadRetentionMs: number;
  publicLeadRetentionMs: number;
  rateLimitRetentionMs: number;
  sessionGraceMs: number;
  tokenRetentionMs: number;
  /**
   * Anti-abuse markers for the trial allocation (V4.5-163). Twelve months from
   * last contact: long enough to be a deterrent, bounded because a marker that
   * never expires is a permanent record about someone we cannot name and who
   * may have left.
   */
  trialMarkerRetentionMs: number;
}

export interface RetentionRepository {
  countExpiredAccessInvitations(cutoff: Date): Promise<number>;
  countExpiredEmailVerifications(cutoff: Date): Promise<number>;
  countExpiredRateLimits(cutoff: Date): Promise<number>;
  countAttachedCorrections(cutoff: Date): Promise<number>;
  countExpiredPaymentPayloads(cutoff: Date): Promise<number>;
  countExpiredPublicLeads(cutoff: Date): Promise<number>;
  countExpiredSessions(cutoff: Date): Promise<number>;
  countExpiredTrialMarkers(cutoff: Date): Promise<number>;
  deleteExpiredAccessInvitations(cutoff: Date, limit: number): Promise<number>;
  deleteExpiredEmailVerifications(cutoff: Date, limit: number): Promise<number>;
  deleteExpiredRateLimits(cutoff: Date, limit: number): Promise<number>;
  deleteExpiredPublicLeads(cutoff: Date, limit: number): Promise<number>;
  /**
   * Strips the body and keeps the row. Not a delete, and named so: the
   * accounting trace must survive its own purge.
   */
  purgeExpiredPaymentPayloads(cutoff: Date, limit: number): Promise<number>;
  /**
   * Detaches a batch. Not a delete either: the correction survives without the
   * learner in it, and with consent their words survive without the learner
   * around them.
   */
  detachAttachedCorrections(cutoff: Date, limit: number): Promise<number>;
  deleteExpiredSessions(cutoff: Date, limit: number): Promise<number>;
  deleteExpiredTrialMarkers(cutoff: Date, limit: number): Promise<number>;
}

interface RetentionTargetResult {
  candidates: number;
  deleted: number;
  hasMore: boolean;
}

/**
 * A target whose rows are kept and emptied. Reporting it as `deleted` would
 * say rows went away that are still there — and this result is what the RGPD
 * register cites as evidence the purge ran.
 */
interface RetentionPurgeResult {
  candidates: number;
  hasMore: boolean;
  purged: number;
}

export interface RetentionCleanupResult {
  accessInvitations: RetentionTargetResult;
  applied: boolean;
  corrections: RetentionPurgeResult;
  emailVerifications: RetentionTargetResult;
  paymentPayloads: RetentionPurgeResult;
  rateLimits: RetentionTargetResult;
  publicLeads: RetentionTargetResult;
  sessions: RetentionTargetResult;
  trialMarkers: RetentionTargetResult;
}

export const defaultRetentionPolicy: RetentionPolicy = {
  batchSize: 500,
  maxBatches: 20,
  correctionDetachRetentionMs: 180 * DAY_IN_MILLISECONDS,
  paymentPayloadRetentionMs: 30 * DAY_IN_MILLISECONDS,
  publicLeadRetentionMs: 730 * DAY_IN_MILLISECONDS,
  rateLimitRetentionMs: DAY_IN_MILLISECONDS,
  sessionGraceMs: 7 * DAY_IN_MILLISECONDS,
  tokenRetentionMs: 30 * DAY_IN_MILLISECONDS,
  trialMarkerRetentionMs: 365 * DAY_IN_MILLISECONDS,
};

function readPositiveInteger(
  environment: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const value = environment[name];
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive safe integer.`);
  }

  return parsed;
}

export function getRetentionPolicy(
  environment: NodeJS.ProcessEnv = process.env,
): RetentionPolicy {
  return {
    batchSize: readPositiveInteger(
      environment,
      'LEARNX_RETENTION_BATCH_SIZE',
      defaultRetentionPolicy.batchSize,
    ),
    maxBatches: readPositiveInteger(
      environment,
      'LEARNX_RETENTION_MAX_BATCHES',
      defaultRetentionPolicy.maxBatches,
    ),
    publicLeadRetentionMs: readPositiveInteger(
      environment,
      'LEARNX_RETENTION_PUBLIC_LEAD_MS',
      defaultRetentionPolicy.publicLeadRetentionMs,
    ),
    correctionDetachRetentionMs: readPositiveInteger(
      environment,
      'LEARNX_RETENTION_CORRECTION_DETACH_MS',
      defaultRetentionPolicy.correctionDetachRetentionMs,
    ),
    paymentPayloadRetentionMs: readPositiveInteger(
      environment,
      'LEARNX_RETENTION_PAYMENT_PAYLOAD_MS',
      defaultRetentionPolicy.paymentPayloadRetentionMs,
    ),
    rateLimitRetentionMs: readPositiveInteger(
      environment,
      'LEARNX_RETENTION_RATE_LIMIT_MS',
      defaultRetentionPolicy.rateLimitRetentionMs,
    ),
    sessionGraceMs: readPositiveInteger(
      environment,
      'LEARNX_RETENTION_SESSION_GRACE_MS',
      defaultRetentionPolicy.sessionGraceMs,
    ),
    tokenRetentionMs: readPositiveInteger(
      environment,
      'LEARNX_RETENTION_TOKEN_MS',
      defaultRetentionPolicy.tokenRetentionMs,
    ),
    trialMarkerRetentionMs: readPositiveInteger(
      environment,
      'LEARNX_RETENTION_TRIAL_MARKER_MS',
      defaultRetentionPolicy.trialMarkerRetentionMs,
    ),
  };
}

interface CleanupTarget {
  count(cutoff: Date): Promise<number>;
  cutoff: Date;
  deleteBatch(cutoff: Date, limit: number): Promise<number>;
}

/**
 * Counts, then works in bounded batches. Shared by the targets that delete and
 * the one that only empties a column, so the two cannot drift apart in how
 * they honour `apply`, the batch size or the batch ceiling.
 */
async function runTarget(
  target: CleanupTarget,
  apply: boolean,
  policy: RetentionPolicy,
): Promise<{ affected: number; candidates: number; hasMore: boolean }> {
  const candidates = await target.count(target.cutoff);
  if (!apply || candidates === 0) {
    return { affected: 0, candidates, hasMore: candidates > 0 };
  }

  let affected = 0;
  for (let batch = 0; batch < policy.maxBatches; batch += 1) {
    const batchAffected = await target.deleteBatch(
      target.cutoff,
      policy.batchSize,
    );
    affected += batchAffected;
    if (batchAffected < policy.batchSize) break;
  }

  return { affected, candidates, hasMore: affected < candidates };
}

async function cleanupTarget(
  target: CleanupTarget,
  apply: boolean,
  policy: RetentionPolicy,
): Promise<RetentionTargetResult> {
  const { affected, candidates, hasMore } = await runTarget(
    target,
    apply,
    policy,
  );
  return { candidates, deleted: affected, hasMore };
}

async function purgeTarget(
  target: CleanupTarget,
  apply: boolean,
  policy: RetentionPolicy,
): Promise<RetentionPurgeResult> {
  const { affected, candidates, hasMore } = await runTarget(
    target,
    apply,
    policy,
  );
  return { candidates, hasMore, purged: affected };
}

export async function runRetentionCleanup(
  repository: RetentionRepository,
  options: {
    apply: boolean;
    now?: Date;
    policy?: RetentionPolicy;
  },
): Promise<RetentionCleanupResult> {
  const now = options.now ?? new Date();
  const policy = options.policy ?? defaultRetentionPolicy;
  const sessionCutoff = new Date(now.getTime() - policy.sessionGraceMs);
  const rateLimitCutoff = new Date(now.getTime() - policy.rateLimitRetentionMs);
  const tokenCutoff = new Date(now.getTime() - policy.tokenRetentionMs);
  const publicLeadCutoff = new Date(
    now.getTime() - policy.publicLeadRetentionMs,
  );
  const trialMarkerCutoff = new Date(
    now.getTime() - policy.trialMarkerRetentionMs,
  );
  const paymentPayloadCutoff = new Date(
    now.getTime() - policy.paymentPayloadRetentionMs,
  );

  const correctionCutoff = new Date(
    now.getTime() - policy.correctionDetachRetentionMs,
  );

  // Kept, detached. The correction survives without the learner in it; with
  // consent their words survive without the learner around them. Reported as
  // `purged` rather than `deleted` because nothing is deleted on this path
  // when consent was given — and where consent was withheld, what goes is the
  // words, never the correction.
  const corrections = await purgeTarget(
    {
      count: (cutoff) => repository.countAttachedCorrections(cutoff),
      cutoff: correctionCutoff,
      deleteBatch: (cutoff, limit) =>
        repository.detachAttachedCorrections(cutoff, limit),
    },
    options.apply,
    policy,
  );

  // Kept, emptied. The row is the accounting trace and outlives its body.
  const paymentPayloads = await purgeTarget(
    {
      count: (cutoff) => repository.countExpiredPaymentPayloads(cutoff),
      cutoff: paymentPayloadCutoff,
      deleteBatch: (cutoff, limit) =>
        repository.purgeExpiredPaymentPayloads(cutoff, limit),
    },
    options.apply,
    policy,
  );

  const sessions = await cleanupTarget(
    {
      count: (cutoff) => repository.countExpiredSessions(cutoff),
      cutoff: sessionCutoff,
      deleteBatch: (cutoff, limit) =>
        repository.deleteExpiredSessions(cutoff, limit),
    },
    options.apply,
    policy,
  );
  const rateLimits = await cleanupTarget(
    {
      count: (cutoff) => repository.countExpiredRateLimits(cutoff),
      cutoff: rateLimitCutoff,
      deleteBatch: (cutoff, limit) =>
        repository.deleteExpiredRateLimits(cutoff, limit),
    },
    options.apply,
    policy,
  );
  const emailVerifications = await cleanupTarget(
    {
      count: (cutoff) => repository.countExpiredEmailVerifications(cutoff),
      cutoff: tokenCutoff,
      deleteBatch: (cutoff, limit) =>
        repository.deleteExpiredEmailVerifications(cutoff, limit),
    },
    options.apply,
    policy,
  );
  const accessInvitations = await cleanupTarget(
    {
      count: (cutoff) => repository.countExpiredAccessInvitations(cutoff),
      cutoff: tokenCutoff,
      deleteBatch: (cutoff, limit) =>
        repository.deleteExpiredAccessInvitations(cutoff, limit),
    },
    options.apply,
    policy,
  );
  const publicLeads = await cleanupTarget(
    {
      count: (cutoff) => repository.countExpiredPublicLeads(cutoff),
      cutoff: publicLeadCutoff,
      deleteBatch: (cutoff, limit) =>
        repository.deleteExpiredPublicLeads(cutoff, limit),
    },
    options.apply,
    policy,
  );

  const trialMarkers = await cleanupTarget(
    {
      count: (cutoff) => repository.countExpiredTrialMarkers(cutoff),
      cutoff: trialMarkerCutoff,
      deleteBatch: (cutoff, limit) =>
        repository.deleteExpiredTrialMarkers(cutoff, limit),
    },
    options.apply,
    policy,
  );

  return {
    accessInvitations,
    applied: options.apply,
    corrections,
    emailVerifications,
    paymentPayloads,
    publicLeads,
    rateLimits,
    sessions,
    trialMarkers,
  };
}
