import { createHash } from 'node:crypto';

import { ApiError } from './errors.js';

interface AttemptWindow {
  firstAttemptAt: number;
  failures: number;
}

export interface LoginRateLimiter {
  assertAllowed(key: string, now: Date): Promise<void>;
  clear(key: string): Promise<void>;
  registerFailure(key: string, now: Date): Promise<void>;
}

export interface LoginRateLimiterOptions {
  maxFailures: number;
  windowMs: number;
}

const defaultOptions: LoginRateLimiterOptions = {
  maxFailures: 5,
  windowMs: 15 * 60 * 1000,
};

export class InMemoryLoginRateLimiter implements LoginRateLimiter {
  private readonly attempts = new Map<string, AttemptWindow>();

  public constructor(private readonly options = defaultOptions) {}

  public async assertAllowed(key: string, now: Date): Promise<void> {
    const attemptWindow = this.getActiveWindow(key, now);

    if (attemptWindow && attemptWindow.failures >= this.options.maxFailures) {
      throw new ApiError(
        'TOO_MANY_LOGIN_ATTEMPTS',
        'Too many login attempts. Please try again later.',
        429,
      );
    }
  }

  public async clear(key: string): Promise<void> {
    this.attempts.delete(key);
  }

  public async registerFailure(key: string, now: Date): Promise<void> {
    const attemptWindow = this.getActiveWindow(key, now);

    if (attemptWindow) {
      attemptWindow.failures += 1;
      return;
    }

    this.attempts.set(key, {
      failures: 1,
      firstAttemptAt: now.getTime(),
    });
  }

  private getActiveWindow(key: string, now: Date): AttemptWindow | undefined {
    const attemptWindow = this.attempts.get(key);

    if (!attemptWindow) {
      return undefined;
    }

    if (now.getTime() - attemptWindow.firstAttemptAt >= this.options.windowMs) {
      this.attempts.delete(key);
      return undefined;
    }

    return attemptWindow;
  }
}

export interface LoginRateLimitRecord {
  failures: number;
  windowStartedAt: Date;
}

export interface LoginRateLimitRepository {
  clear(keyHash: string): Promise<void>;
  find(keyHash: string): Promise<LoginRateLimitRecord | null>;
  recordFailure(input: {
    keyHash: string;
    now: Date;
    windowStartedAfter: Date;
  }): Promise<void>;
}

const prismaLoginRateLimitRepository: LoginRateLimitRepository = {
  async clear(keyHash) {
    const { prisma } = await import('../../prisma.js');
    await prisma.loginRateLimit.deleteMany({ where: { keyHash } });
  },
  async find(keyHash) {
    const { prisma } = await import('../../prisma.js');
    return prisma.loginRateLimit.findUnique({
      select: { failures: true, windowStartedAt: true },
      where: { keyHash },
    });
  },
  async recordFailure({ keyHash, now, windowStartedAfter }) {
    const { prisma } = await import('../../prisma.js');

    await prisma.$executeRaw`
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
    `;
  },
};

function hashRateLimitKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export class SharedLoginRateLimiter implements LoginRateLimiter {
  public constructor(
    private readonly repository = prismaLoginRateLimitRepository,
    private readonly options = defaultOptions,
  ) {}

  public async assertAllowed(key: string, now: Date): Promise<void> {
    const keyHash = hashRateLimitKey(key);
    const attemptWindow = await this.repository.find(keyHash);

    if (
      attemptWindow &&
      now.getTime() - attemptWindow.windowStartedAt.getTime() <
        this.options.windowMs &&
      attemptWindow.failures >= this.options.maxFailures
    ) {
      throw new ApiError(
        'TOO_MANY_LOGIN_ATTEMPTS',
        'Too many login attempts. Please try again later.',
        429,
      );
    }
  }

  public async clear(key: string): Promise<void> {
    await this.repository.clear(hashRateLimitKey(key));
  }

  public async registerFailure(key: string, now: Date): Promise<void> {
    await this.repository.recordFailure({
      keyHash: hashRateLimitKey(key),
      now,
      windowStartedAfter: new Date(now.getTime() - this.options.windowMs),
    });
  }
}
