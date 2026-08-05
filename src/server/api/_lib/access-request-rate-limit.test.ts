import {
  getAccessRequestRateLimitOptions,
  SharedAccessRequestRateLimiter,
  type RateLimitBucketRepository,
} from './access-request-rate-limit';

const testNow = new Date('2026-08-05T10:00:00.000Z');

function createRepository() {
  const records = new Map<
    string,
    { failures: number; windowStartedAt: Date }
  >();
  const repository: RateLimitBucketRepository = {
    async consume({ keyHash, now, windowStartedAfter }) {
      const current = records.get(keyHash);
      const active =
        current && current.windowStartedAt >= windowStartedAfter
          ? current
          : null;
      const next = {
        failures: (active?.failures ?? 0) + 1,
        windowStartedAt: active?.windowStartedAt ?? now,
      };
      records.set(keyHash, next);
      return next.failures;
    },
  };

  return { records, repository };
}

describe('access request rate limit', () => {
  it('shares hashed counters without persisting raw IP or email values', async () => {
    const { records, repository } = createRepository();
    const options = {
      maxEmailAttempts: 1,
      maxIpAttempts: 10,
      windowMs: 60_000,
    };
    const firstInstance = new SharedAccessRequestRateLimiter(
      repository,
      options,
    );
    const secondInstance = new SharedAccessRequestRateLimiter(
      repository,
      options,
    );
    const input = {
      clientAddress: '2001:db8::1',
      email: 'learner@example.com',
    };

    await firstInstance.consume(input, testNow);

    await expect(secondInstance.consume(input, testNow)).rejects.toMatchObject({
      code: 'TOO_MANY_ACCESS_REQUESTS',
      status: 429,
    });
    expect(records.size).toBe(2);
    for (const key of records.keys()) {
      expect(key).toMatch(/^[a-f0-9]{64}$/);
      expect(key).not.toContain(input.clientAddress);
      expect(key).not.toContain(input.email);
    }
  });

  it('resets counters outside the configured window', async () => {
    const { repository } = createRepository();
    const limiter = new SharedAccessRequestRateLimiter(repository, {
      maxEmailAttempts: 1,
      maxIpAttempts: 1,
      windowMs: 1_000,
    });
    const input = { clientAddress: '203.0.113.1', email: 'a@example.com' };

    await limiter.consume(input, testNow);
    await expect(
      limiter.consume(input, new Date(testNow.getTime() + 1_001)),
    ).resolves.toBeUndefined();
  });

  it('loads positive environment overrides and falls back for invalid values', () => {
    expect(
      getAccessRequestRateLimitOptions({
        LEARNX_ACCESS_REQUEST_RATE_LIMIT_MAX_EMAIL: '7',
        LEARNX_ACCESS_REQUEST_RATE_LIMIT_MAX_IP: '40',
        LEARNX_ACCESS_REQUEST_RATE_LIMIT_WINDOW_MS: '120000',
      }),
    ).toEqual({
      maxEmailAttempts: 7,
      maxIpAttempts: 40,
      windowMs: 120_000,
    });
    expect(
      getAccessRequestRateLimitOptions({
        LEARNX_ACCESS_REQUEST_RATE_LIMIT_MAX_EMAIL: 'invalid',
      }),
    ).toMatchObject({ maxEmailAttempts: 5 });
  });
});
