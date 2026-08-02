import { ApiError } from './errors';

interface AttemptWindow {
  firstAttemptAt: number;
  failures: number;
}

export interface LoginRateLimiter {
  assertAllowed(key: string, now: Date): void;
  clear(key: string): void;
  registerFailure(key: string, now: Date): void;
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

  public assertAllowed(key: string, now: Date): void {
    const attemptWindow = this.getActiveWindow(key, now);

    if (attemptWindow && attemptWindow.failures >= this.options.maxFailures) {
      throw new ApiError(
        'TOO_MANY_LOGIN_ATTEMPTS',
        'Too many login attempts. Please try again later.',
        429,
      );
    }
  }

  public clear(key: string): void {
    this.attempts.delete(key);
  }

  public registerFailure(key: string, now: Date): void {
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
