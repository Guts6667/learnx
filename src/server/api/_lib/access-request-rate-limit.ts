import { hashBucketKey } from './bucket-key.js';
import { ApiError } from './errors.js';

interface AccessRequestRateLimitInput {
  clientAddress: string;
  email: string;
}

interface RateLimitBucketInput {
  keyHash: string;
  now: Date;
  windowStartedAfter: Date;
}

export interface AccessRequestRateLimiter {
  consume(input: AccessRequestRateLimitInput, now: Date): Promise<void>;
}

export interface RateLimitBucketRepository {
  consume(input: RateLimitBucketInput): Promise<number>;
}

export interface AccessRequestRateLimitOptions {
  maxEmailAttempts: number;
  maxIpAttempts: number;
  windowMs: number;
}

const defaultOptions: AccessRequestRateLimitOptions = {
  maxEmailAttempts: 5,
  maxIpAttempts: 20,
  windowMs: 15 * 60 * 1000,
};

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getAccessRequestRateLimitOptions(
  environment: NodeJS.ProcessEnv = process.env,
): AccessRequestRateLimitOptions {
  return {
    maxEmailAttempts: parsePositiveInteger(
      environment.LEARNX_ACCESS_REQUEST_RATE_LIMIT_MAX_EMAIL,
      defaultOptions.maxEmailAttempts,
    ),
    maxIpAttempts: parsePositiveInteger(
      environment.LEARNX_ACCESS_REQUEST_RATE_LIMIT_MAX_IP,
      defaultOptions.maxIpAttempts,
    ),
    windowMs: parsePositiveInteger(
      environment.LEARNX_ACCESS_REQUEST_RATE_LIMIT_WINDOW_MS,
      defaultOptions.windowMs,
    ),
  };
}

const prismaRateLimitBucketRepository: RateLimitBucketRepository = {
  async consume({ keyHash, now, windowStartedAfter }) {
    const { prisma } = await import('../../prisma.js');
    const records = await prisma.$queryRaw<Array<{ failures: number }>>`
      INSERT INTO "login_rate_limits"
        ("key_hash", "failures", "window_started_at", "updated_at")
      VALUES (${keyHash}, 1, ${now}, ${now})
      ON CONFLICT ("key_hash") DO UPDATE SET
        "failures" = CASE
          WHEN "login_rate_limits"."window_started_at" < ${windowStartedAfter}
            THEN 1
          ELSE "login_rate_limits"."failures" + 1
        END,
        "window_started_at" = CASE
          WHEN "login_rate_limits"."window_started_at" < ${windowStartedAfter}
            THEN ${now}
          ELSE "login_rate_limits"."window_started_at"
        END,
        "updated_at" = ${now}
      RETURNING "failures"
    `;

    return records[0]?.failures ?? 1;
  },
};

function assertPositiveOptions(options: AccessRequestRateLimitOptions): void {
  if (
    options.maxEmailAttempts < 1 ||
    options.maxIpAttempts < 1 ||
    options.windowMs < 1
  ) {
    throw new Error('Access request rate limit options must be positive.');
  }
}

export class SharedAccessRequestRateLimiter implements AccessRequestRateLimiter {
  public constructor(
    private readonly repository = prismaRateLimitBucketRepository,
    private readonly options = getAccessRequestRateLimitOptions(),
  ) {
    assertPositiveOptions(options);
  }

  public async consume(
    { clientAddress, email }: AccessRequestRateLimitInput,
    now: Date,
  ): Promise<void> {
    const windowStartedAfter = new Date(now.getTime() - this.options.windowMs);
    const [ipAttempts, emailAttempts] = await Promise.all([
      this.repository.consume({
        keyHash: hashBucketKey(`access-request:ip:${clientAddress}`),
        now,
        windowStartedAfter,
      }),
      this.repository.consume({
        keyHash: hashBucketKey(`access-request:email:${email}`),
        now,
        windowStartedAfter,
      }),
    ]);

    if (
      ipAttempts > this.options.maxIpAttempts ||
      emailAttempts > this.options.maxEmailAttempts
    ) {
      throw new ApiError(
        'TOO_MANY_ACCESS_REQUESTS',
        'Too many access requests. Please try again later.',
        429,
      );
    }
  }
}
