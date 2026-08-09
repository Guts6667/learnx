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
    sessions: 5,
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
    countExpiredSessions: vi.fn(async () => candidates.sessions),
    deleteExpiredAccessInvitations: vi.fn(async () => 2),
    deleteExpiredEmailVerifications: vi.fn(async () => 3),
    deleteExpiredRateLimits: vi.fn(async () => 4),
    deleteExpiredSessions: vi.fn(async () => 5),
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
      sessions: { candidates: 5, deleted: 0, hasMore: true },
    });
    expect(repository.deleteExpiredSessions).not.toHaveBeenCalled();
    expect(repository.deleteExpiredRateLimits).not.toHaveBeenCalled();
    expect(repository.deleteExpiredEmailVerifications).not.toHaveBeenCalled();
    expect(repository.deleteExpiredAccessInvitations).not.toHaveBeenCalled();
  });

  it('uses distinct conservative cutoffs for sessions, rate limits and tokens', async () => {
    const repository = createRepository({
      accessInvitations: 0,
      emailVerifications: 0,
      rateLimits: 0,
      sessions: 0,
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
  });

  it('bounds applied deletion by batch size and maximum batches', async () => {
    const repository = createRepository({
      accessInvitations: 0,
      emailVerifications: 0,
      rateLimits: 0,
      sessions: 12,
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
