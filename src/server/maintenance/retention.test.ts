import { describe, expect, it, vi } from 'vitest';

import {
  defaultRetentionPolicy,
  getRetentionPolicy,
  runRetentionCleanup,
  type RetentionRepository,
} from './retention';

function createRepository(
  candidates = {
    accessInvitations: 2,
    emailVerifications: 3,
    rateLimits: 4,
    publicLeads: 6,
    sessions: 5,
    trialMarkers: 7,
  },
): RetentionRepository {
  return {
    countExpiredAccessInvitations: vi.fn(
      async () => candidates.accessInvitations,
    ),
    countExpiredEmailVerifications: vi.fn(
      async () => candidates.emailVerifications,
    ),
    countExpiredRateLimits: vi.fn(async () => candidates.rateLimits),
    countExpiredPublicLeads: vi.fn(async () => candidates.publicLeads),
    countExpiredSessions: vi.fn(async () => candidates.sessions),
    countExpiredTrialMarkers: vi.fn(async () => candidates.trialMarkers),
    deleteExpiredAccessInvitations: vi.fn(async () => 2),
    deleteExpiredEmailVerifications: vi.fn(async () => 3),
    deleteExpiredRateLimits: vi.fn(async () => 4),
    deleteExpiredPublicLeads: vi.fn(async () => 6),
    deleteExpiredSessions: vi.fn(async () => 5),
    deleteExpiredTrialMarkers: vi.fn(async () => 7),
  };
}

describe('retention cleanup', () => {
  it('counts expired technical records without deleting in dry-run mode', async () => {
    const repository = createRepository();

    const result = await runRetentionCleanup(repository, {
      apply: false,
      now: new Date('2026-08-09T12:00:00.000Z'),
    });

    expect(result).toMatchObject({
      accessInvitations: { candidates: 2, deleted: 0, hasMore: true },
      applied: false,
      emailVerifications: { candidates: 3, deleted: 0, hasMore: true },
      rateLimits: { candidates: 4, deleted: 0, hasMore: true },
      publicLeads: { candidates: 6, deleted: 0, hasMore: true },
      sessions: { candidates: 5, deleted: 0, hasMore: true },
    });
    expect(repository.deleteExpiredSessions).not.toHaveBeenCalled();
    expect(repository.deleteExpiredRateLimits).not.toHaveBeenCalled();
    expect(repository.deleteExpiredPublicLeads).not.toHaveBeenCalled();
    expect(repository.deleteExpiredEmailVerifications).not.toHaveBeenCalled();
    expect(repository.deleteExpiredAccessInvitations).not.toHaveBeenCalled();
  });

  it('uses distinct conservative cutoffs for sessions, rate limits and tokens', async () => {
    const repository = createRepository({
      accessInvitations: 0,
      emailVerifications: 0,
      rateLimits: 0,
      publicLeads: 0,
      sessions: 0,
      trialMarkers: 0,
    });
    const now = new Date('2026-08-09T12:00:00.000Z');

    await runRetentionCleanup(repository, { apply: false, now });

    expect(repository.countExpiredSessions).toHaveBeenCalledWith(
      new Date(now.getTime() - defaultRetentionPolicy.sessionGraceMs),
    );
    expect(repository.countExpiredRateLimits).toHaveBeenCalledWith(
      new Date(now.getTime() - defaultRetentionPolicy.rateLimitRetentionMs),
    );
    expect(repository.countExpiredEmailVerifications).toHaveBeenCalledWith(
      new Date(now.getTime() - defaultRetentionPolicy.tokenRetentionMs),
    );
    expect(repository.countExpiredAccessInvitations).toHaveBeenCalledWith(
      new Date(now.getTime() - defaultRetentionPolicy.tokenRetentionMs),
    );
    expect(repository.countExpiredPublicLeads).toHaveBeenCalledWith(
      new Date(now.getTime() - defaultRetentionPolicy.publicLeadRetentionMs),
    );
  });

  it('bounds applied deletion by batch size and maximum batches', async () => {
    const repository = createRepository({
      accessInvitations: 0,
      emailVerifications: 0,
      rateLimits: 0,
      publicLeads: 0,
      sessions: 12,
      trialMarkers: 0,
    });
    vi.mocked(repository.deleteExpiredSessions)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(5);

    const result = await runRetentionCleanup(repository, {
      apply: true,
      now: new Date('2026-08-09T12:00:00.000Z'),
      policy: {
        ...defaultRetentionPolicy,
        batchSize: 5,
        maxBatches: 2,
      },
    });

    expect(result.sessions).toEqual({
      candidates: 12,
      deleted: 10,
      hasMore: true,
    });
    expect(repository.deleteExpiredSessions).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid retention configuration instead of silently widening deletion', () => {
    expect(() =>
      getRetentionPolicy({ LEARNX_RETENTION_BATCH_SIZE: '0' }),
    ).toThrow('LEARNX_RETENTION_BATCH_SIZE must be a positive safe integer.');
  });
});

describe('rétention des marqueurs anti-abus (V4.5-163)', () => {
  it('les purge à douze mois, bien après les seaux de limitation', async () => {
    // A marker that never expires is a permanent record about someone we
    // cannot name and who may have left; twelve months is the deterrent
    // bounded.
    const repository = createRepository({
      accessInvitations: 0,
      emailVerifications: 0,
      rateLimits: 0,
      publicLeads: 0,
      sessions: 0,
      trialMarkers: 3,
    });
    const now = new Date('2027-01-01T00:00:00.000Z');

    await runRetentionCleanup(repository, { apply: false, now });

    const markerCutoff = vi.mocked(repository.countExpiredTrialMarkers).mock
      .calls[0]?.[0] as Date;
    const rateLimitCutoff = vi.mocked(repository.countExpiredRateLimits).mock
      .calls[0]?.[0] as Date;
    expect(markerCutoff.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(markerCutoff.getTime()).toBeLessThan(rateLimitCutoff.getTime());
  });

  it('compte sans supprimer en simulation', async () => {
    const repository = createRepository();
    const result = await runRetentionCleanup(repository, { apply: false });
    expect(result.trialMarkers).toMatchObject({ candidates: 7, deleted: 0 });
    expect(repository.deleteExpiredTrialMarkers).not.toHaveBeenCalled();
  });
});
