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
    paymentPayloads: 8,
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
    countExpiredPaymentPayloads: vi.fn(async () => candidates.paymentPayloads),
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
    purgeExpiredPaymentPayloads: vi.fn(async () => 8),
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
      // Kept and emptied, so it reports `purged`, never `deleted`.
      paymentPayloads: { candidates: 8, hasMore: true, purged: 0 },
      rateLimits: { candidates: 4, deleted: 0, hasMore: true },
      publicLeads: { candidates: 6, deleted: 0, hasMore: true },
      sessions: { candidates: 5, deleted: 0, hasMore: true },
    });
    expect(repository.purgeExpiredPaymentPayloads).not.toHaveBeenCalled();
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
      paymentPayloads: 0,
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
      paymentPayloads: 0,
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
      paymentPayloads: 0,
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

describe('purge du corps des événements de paiement (V4.5-197)', () => {
  const NOW = new Date('2026-08-30T12:00:00.000Z');

  it('garde la ligne et vide le corps, et le dit dans ces mots-là', async () => {
    // `owner-e4-2026-08-30`: the accounting trace survives its own purge, so
    // the result reports `purged` and never `deleted`. A count of rows that
    // went away would be false — they are all still there.
    const repository = createRepository();

    const result = await runRetentionCleanup(repository, {
      apply: true,
      now: NOW,
    });

    expect(result.paymentPayloads).toEqual({
      candidates: 8,
      hasMore: false,
      purged: 8,
    });
    expect(repository.purgeExpiredPaymentPayloads).toHaveBeenCalled();
  });

  it('coupe à trente jours après réception', async () => {
    const repository = createRepository();

    await runRetentionCleanup(repository, { apply: true, now: NOW });

    const [cutoff] = vi.mocked(repository.countExpiredPaymentPayloads).mock
      .calls[0];
    expect(cutoff).toEqual(new Date('2026-07-31T12:00:00.000Z'));
  });

  it('respecte le plafond de lots comme les autres cibles', async () => {
    // A purge that runs unbounded is a purge that locks a table it shares
    // with the webhook receiver.
    const repository = createRepository({
      accessInvitations: 0,
      emailVerifications: 0,
      // More than maxBatches × batchSize, so the ceiling actually bites.
      paymentPayloads: 12_000,
      rateLimits: 0,
      publicLeads: 0,
      sessions: 0,
      trialMarkers: 0,
    });
    vi.mocked(repository.purgeExpiredPaymentPayloads).mockResolvedValue(
      defaultRetentionPolicy.batchSize,
    );

    const result = await runRetentionCleanup(repository, {
      apply: true,
      now: NOW,
    });

    expect(repository.purgeExpiredPaymentPayloads).toHaveBeenCalledTimes(
      defaultRetentionPolicy.maxBatches,
    );
    expect(result.paymentPayloads.hasMore).toBe(true);
  });

  it('se règle par variable d’environnement comme les autres rétentions', () => {
    expect(
      getRetentionPolicy({ LEARNX_RETENTION_PAYMENT_PAYLOAD_MS: '86400000' })
        .paymentPayloadRetentionMs,
    ).toBe(86_400_000);
    expect(getRetentionPolicy({}).paymentPayloadRetentionMs).toBe(
      30 * 24 * 60 * 60 * 1000,
    );
  });
});
