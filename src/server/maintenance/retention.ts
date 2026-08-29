const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export interface RetentionPolicy {
  batchSize: number;
  maxBatches: number;
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
  countExpiredPublicLeads(cutoff: Date): Promise<number>;
  countExpiredSessions(cutoff: Date): Promise<number>;
  countExpiredTrialMarkers(cutoff: Date): Promise<number>;
  deleteExpiredAccessInvitations(cutoff: Date, limit: number): Promise<number>;
  deleteExpiredEmailVerifications(cutoff: Date, limit: number): Promise<number>;
  deleteExpiredRateLimits(cutoff: Date, limit: number): Promise<number>;
  deleteExpiredPublicLeads(cutoff: Date, limit: number): Promise<number>;
  deleteExpiredSessions(cutoff: Date, limit: number): Promise<number>;
  deleteExpiredTrialMarkers(cutoff: Date, limit: number): Promise<number>;
}

interface RetentionTargetResult {
  candidates: number;
  deleted: number;
  hasMore: boolean;
}

export interface RetentionCleanupResult {
  accessInvitations: RetentionTargetResult;
  applied: boolean;
  emailVerifications: RetentionTargetResult;
  rateLimits: RetentionTargetResult;
  publicLeads: RetentionTargetResult;
  sessions: RetentionTargetResult;
  trialMarkers: RetentionTargetResult;
}

export const defaultRetentionPolicy: RetentionPolicy = {
  batchSize: 500,
  maxBatches: 20,
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

async function cleanupTarget(
  target: CleanupTarget,
  apply: boolean,
  policy: RetentionPolicy,
): Promise<RetentionTargetResult> {
  const candidates = await target.count(target.cutoff);
  if (!apply || candidates === 0) {
    return { candidates, deleted: 0, hasMore: candidates > 0 };
  }

  let deleted = 0;
  for (let batch = 0; batch < policy.maxBatches; batch += 1) {
    const batchDeleted = await target.deleteBatch(
      target.cutoff,
      policy.batchSize,
    );
    deleted += batchDeleted;
    if (batchDeleted < policy.batchSize) break;
  }

  return { candidates, deleted, hasMore: deleted < candidates };
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
    emailVerifications,
    publicLeads,
    rateLimits,
    sessions,
    trialMarkers,
  };
}
