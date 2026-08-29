import { Hono } from 'hono';

import {
  createRequireUser,
  type AuthDependencies,
  type AuthEnvironment,
} from '../../src/server/api/_lib/auth';
import type {
  AuthRepository,
  StoredSession,
  StoredUser,
} from '../../src/server/api/_lib/auth-types';
import {
  InMemoryLoginRateLimiter,
  SharedLoginRateLimiter,
  type LoginRateLimitRecord,
  type LoginRateLimitRepository,
} from '../../src/server/api/_lib/login-rate-limit';
import { hashSessionToken } from '../../src/server/api/_lib/session';
import { createAuthApp } from '../../src/server/api/auth/app';

const testNow = new Date('2026-08-02T12:00:00.000Z');

function createTestDependencies() {
  const users = new Map<string, StoredUser>();
  const sessions = new Map<string, StoredSession>();
  let userSequence = 0;
  let sessionSequence = 0;
  let touchCount = 0;

  const repository: AuthRepository = {
    async createSession(input) {
      sessionSequence += 1;
      const session: StoredSession = {
        id: `session-${sessionSequence}`,
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        createdAt: testNow,
        lastUsedAt: testNow,
      };

      sessions.set(session.tokenHash, session);
      return session;
    },
    async createUser(input) {
      userSequence += 1;
      const user: StoredUser = {
        accountStatus: 'ACTIVE',
        id: `user-${userSequence}`,
        email: input.email,
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        locale: input.locale,
        role: 'USER',
      };

      users.set(user.email, user);
      return user;
    },
    async deleteSessionByTokenHash(tokenHash) {
      sessions.delete(tokenHash);
    },
    async findSessionWithUserByTokenHash(tokenHash) {
      const session = sessions.get(tokenHash);

      if (!session) {
        return null;
      }

      const user = [...users.values()].find(
        (candidate) => candidate.id === session.userId,
      );

      if (!user) {
        return null;
      }

      return {
        session,
        user: {
          accountStatus: user.accountStatus,
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          locale: user.locale,
          role: user.role,
        },
      };
    },
    async findUserByEmail(email) {
      return users.get(email) ?? null;
    },
    async touchSession(id, lastUsedAt) {
      touchCount += 1;
      const session = [...sessions.values()].find(
        (candidate) => candidate.id === id,
      );

      if (session) {
        session.lastUsedAt = lastUsedAt;
      }

      return Boolean(session);
    },
    async updateUserLocale(userId, locale) {
      const user = [...users.values()].find(
        (candidate) => candidate.id === userId,
      );
      if (!user || user.accountStatus !== 'ACTIVE') return null;
      user.locale = locale;
      return user;
    },
  };

  let tokenSequence = 0;
  const dependencies: AuthDependencies = {
    createSessionToken: () => {
      tokenSequence += 1;
      return `token-${tokenSequence}`;
    },
    getSessionExpiry: (now = testNow) =>
      new Date(now.getTime() + 1000 * 60 * 60),
    hashPassword: async (password) => `hashed:${password}`,
    hashSessionToken,
    now: () => testNow,
    repository,
    verifyPassword: async (passwordHash, password) =>
      passwordHash === `hashed:${password}`,
  };

  return { dependencies, getTouchCount: () => touchCount, sessions, users };
}

function getSessionCookie(response: Response): string {
  const setCookie = response.headers.get('set-cookie');

  if (!setCookie) {
    throw new Error('Expected a session cookie.');
  }

  return setCookie.split(';')[0];
}

describe('auth API', () => {
  it('borne les écritures lastUsedAt sans différer les contrôles de compte', async () => {
    const { dependencies, getTouchCount } = createTestDependencies();
    const app = createAuthApp({ dependencies });
    const registerResponse = await app.request(
      'http://localhost/api/auth/register',
      {
        body: JSON.stringify({
          displayName: 'Learner',
          email: 'touch@example.com',
          password: 'correct-horse-battery-staple',
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );
    const cookie = getSessionCookie(registerResponse);

    expect(
      (
        await app.request('http://localhost/api/auth/session', {
          headers: { cookie },
        })
      ).status,
    ).toBe(200);
    expect(getTouchCount()).toBe(0);

    dependencies.now = () => new Date(testNow.getTime() + 5 * 60 * 1_000);
    expect(
      (
        await app.request('http://localhost/api/auth/session', {
          headers: { cookie },
        })
      ).status,
    ).toBe(200);
    expect(getTouchCount()).toBe(1);
  });

  it('disables public registration when production policy is active', async () => {
    const { dependencies, users } = createTestDependencies();
    const app = createAuthApp({
      allowRegistration: false,
      dependencies,
      secureCookies: true,
    });

    const response = await app.request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'learner@example.com',
        password: 'correct-horse-battery-staple',
        displayName: 'Learner',
      }),
      headers: { 'content-type': 'application/json' },
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: {
        code: 'REGISTRATION_DISABLED',
        message: 'Public registration is not available.',
      },
    });
    expect(users.size).toBe(0);
  });

  it('registers a user, stores only a password hash and sets a secure production cookie', async () => {
    const { dependencies, users } = createTestDependencies();
    const app = createAuthApp({ dependencies, secureCookies: true });

    const response = await app.request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: ' LEARNER@example.com ',
        password: 'correct-horse-battery-staple',
        displayName: 'Learner',
      }),
      headers: { 'content-type': 'application/json' },
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      user: {
        id: 'user-1',
        email: 'learner@example.com',
        displayName: 'Learner',
        locale: 'fr',
        role: 'USER',
      },
    });
    expect(users.get('learner@example.com')?.passwordHash).toBe(
      'hashed:correct-horse-battery-staple',
    );
    expect(response.headers.get('set-cookie')).toMatch(
      /HttpOnly; Secure; SameSite=Lax/i,
    );
  });

  it('recharge le rôle courant sans conserver celui mis en cache à la création de session', async () => {
    const { dependencies, users } = createTestDependencies();
    const app = createAuthApp({ dependencies });
    const registerResponse = await app.request(
      'http://localhost/api/auth/register',
      {
        body: JSON.stringify({
          displayName: 'Future creator',
          email: 'creator@example.com',
          password: 'correct-horse-battery-staple',
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );
    const user = users.get('creator@example.com');
    if (!user) throw new Error('Expected registered user.');
    user.role = 'CREATOR';

    const sessionResponse = await app.request(
      'http://localhost/api/auth/session',
      { headers: { cookie: getSessionCookie(registerResponse) } },
    );

    expect(sessionResponse.status).toBe(200);
    expect(await sessionResponse.json()).toMatchObject({
      user: { id: user.id, role: 'CREATOR' },
    });
  });

  it('persists an authenticated locale preference across sessions', async () => {
    const { dependencies } = createTestDependencies();
    const app = createAuthApp({ dependencies });
    const registerResponse = await app.request(
      'http://localhost/api/auth/register',
      {
        body: JSON.stringify({
          displayName: 'Learner',
          email: 'locale@example.com',
          locale: 'fr',
          password: 'correct-horse-battery-staple',
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );
    const cookie = getSessionCookie(registerResponse);
    const updateResponse = await app.request(
      'http://localhost/api/auth/locale',
      {
        body: JSON.stringify({ locale: 'en' }),
        headers: {
          'content-type': 'application/json',
          cookie,
        },
        method: 'PATCH',
      },
    );
    const sessionResponse = await app.request(
      'http://localhost/api/auth/session',
      { headers: { cookie } },
    );

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.headers.get('cache-control')).toBe(
      'private, no-store',
    );
    expect(await updateResponse.json()).toMatchObject({
      user: { email: 'locale@example.com', locale: 'en' },
    });
    expect(await sessionResponse.json()).toMatchObject({
      user: { email: 'locale@example.com', locale: 'en' },
    });
  });

  it('rejects unauthenticated or unsupported locale changes', async () => {
    const { dependencies } = createTestDependencies();
    const app = createAuthApp({ dependencies });
    const unauthenticated = await app.request(
      'http://localhost/api/auth/locale',
      {
        body: JSON.stringify({ locale: 'en' }),
        headers: { 'content-type': 'application/json' },
        method: 'PATCH',
      },
    );
    const registerResponse = await app.request(
      'http://localhost/api/auth/register',
      {
        body: JSON.stringify({
          displayName: 'Learner',
          email: 'invalid-locale@example.com',
          password: 'correct-horse-battery-staple',
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );
    const invalid = await app.request('http://localhost/api/auth/locale', {
      body: JSON.stringify({ locale: 'de' }),
      headers: {
        'content-type': 'application/json',
        cookie: getSessionCookie(registerResponse),
      },
      method: 'PATCH',
    });

    expect(unauthenticated.status).toBe(401);
    expect(invalid.status).toBe(400);
  });

  it('refuse un compte suspendu et invalide sa session existante', async () => {
    const { dependencies, sessions, users } = createTestDependencies();
    const app = createAuthApp({ dependencies });
    const registerResponse = await app.request(
      'http://localhost/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({
          email: 'suspended@example.com',
          password: 'correct-horse-battery-staple',
          displayName: 'Suspended learner',
        }),
        headers: { 'content-type': 'application/json' },
      },
    );
    const user = users.get('suspended@example.com');
    if (!user) throw new Error('Expected registered user.');
    user.accountStatus = 'SUSPENDED';

    const loginResponse = await app.request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: user.email,
        password: 'correct-horse-battery-staple',
      }),
      headers: { 'content-type': 'application/json' },
    });
    const sessionResponse = await app.request(
      'http://localhost/api/auth/session',
      { headers: { cookie: getSessionCookie(registerResponse) } },
    );

    expect(loginResponse.status).toBe(401);
    expect(await loginResponse.json()).toEqual({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email address or password.',
      },
    });
    expect(await sessionResponse.json()).toEqual({ user: null });
    expect(sessionResponse.headers.get('set-cookie')).toMatch(/Max-Age=0/i);
    expect(sessions.size).toBe(0);
  });

  it('refuse la session si le compte est suspendu pendant la connexion', async () => {
    const { dependencies, users } = createTestDependencies();
    const app = createAuthApp({ dependencies });
    await app.request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'concurrent@example.com',
        password: 'correct-horse-battery-staple',
        displayName: 'Concurrent learner',
      }),
      headers: { 'content-type': 'application/json' },
    });
    dependencies.repository.createSession = vi.fn(async () => null);

    const response = await app.request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'concurrent@example.com',
        password: 'correct-horse-battery-staple',
      }),
      headers: { 'content-type': 'application/json' },
    });

    expect(users.get('concurrent@example.com')?.accountStatus).toBe('ACTIVE');
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: { code: 'INVALID_CREDENTIALS' },
    });
  });

  it('rejects duplicate registration and invalid request bodies', async () => {
    const { dependencies } = createTestDependencies();
    const app = createAuthApp({ dependencies });
    const request = {
      method: 'POST',
      body: JSON.stringify({
        email: 'learner@example.com',
        password: 'correct-horse-battery-staple',
        displayName: 'Learner',
      }),
      headers: { 'content-type': 'application/json' },
    };

    await app.request('http://localhost/api/auth/register', request);
    const duplicateResponse = await app.request(
      'http://localhost/api/auth/register',
      request,
    );
    const invalidResponse = await app.request(
      'http://localhost/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ email: 'not-an-email' }),
        headers: { 'content-type': 'application/json' },
      },
    );

    expect(duplicateResponse.status).toBe(409);
    expect(await duplicateResponse.json()).toEqual({
      error: {
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'An account already exists for this email address.',
      },
    });
    expect(invalidResponse.status).toBe(400);
  });

  it('logs in, restores the session and logs out', async () => {
    const { dependencies } = createTestDependencies();
    const app = createAuthApp({ dependencies });
    const registerResponse = await app.request(
      'http://localhost/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({
          email: 'learner@example.com',
          password: 'correct-horse-battery-staple',
          displayName: 'Learner',
        }),
        headers: { 'content-type': 'application/json' },
      },
    );

    const loginResponse = await app.request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'learner@example.com',
        password: 'correct-horse-battery-staple',
      }),
      headers: { 'content-type': 'application/json' },
    });
    const sessionCookie = getSessionCookie(loginResponse);
    const sessionResponse = await app.request(
      'http://localhost/api/auth/session',
      {
        headers: { cookie: sessionCookie },
      },
    );
    const logoutResponse = await app.request(
      'http://localhost/api/auth/logout',
      {
        method: 'POST',
        headers: { cookie: sessionCookie },
      },
    );
    const clearedSessionResponse = await app.request(
      'http://localhost/api/auth/session',
      { headers: { cookie: sessionCookie } },
    );

    expect(registerResponse.status).toBe(201);
    expect(loginResponse.status).toBe(200);
    expect(await sessionResponse.json()).toMatchObject({
      user: { email: 'learner@example.com' },
    });
    expect(logoutResponse.status).toBe(204);
    expect(logoutResponse.headers.get('set-cookie')).toMatch(/Max-Age=0/i);
    expect(await clearedSessionResponse.json()).toEqual({ user: null });
  });

  it('returns a generic error for incorrect login details', async () => {
    const { dependencies } = createTestDependencies();
    const app = createAuthApp({ dependencies });

    const response = await app.request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'missing@example.com',
        password: 'correct-horse-battery-staple',
      }),
      headers: { 'content-type': 'application/json' },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email address or password.',
      },
    });
  });

  it('limits repeated invalid login attempts', async () => {
    const { dependencies } = createTestDependencies();
    const app = createAuthApp({
      dependencies,
      loginRateLimiter: new InMemoryLoginRateLimiter({
        maxFailures: 1,
        windowMs: 60_000,
      }),
    });
    const request = {
      method: 'POST',
      body: JSON.stringify({
        email: 'missing@example.com',
        password: 'correct-horse-battery-staple',
      }),
      headers: { 'content-type': 'application/json' },
    };

    const firstResponse = await app.request(
      'http://localhost/api/auth/login',
      request,
    );
    const limitedResponse = await app.request(
      'http://localhost/api/auth/login',
      request,
    );

    expect(firstResponse.status).toBe(401);
    expect(limitedResponse.status).toBe(429);
    expect(await limitedResponse.json()).toMatchObject({
      error: { code: 'TOO_MANY_LOGIN_ATTEMPTS' },
    });
  });

  it('shares login failures across serverless limiter instances', async () => {
    const records = new Map<string, LoginRateLimitRecord>();
    const repository: LoginRateLimitRepository = {
      async clear(keyHash) {
        records.delete(keyHash);
      },
      async find(keyHash) {
        return records.get(keyHash) ?? null;
      },
      async recordFailure({ keyHash, now, windowStartedAfter }) {
        const current = records.get(keyHash);
        const active =
          current && current.windowStartedAt >= windowStartedAfter
            ? current
            : null;

        records.set(keyHash, {
          failures: (active?.failures ?? 0) + 1,
          windowStartedAt: active?.windowStartedAt ?? now,
        });
      },
    };
    const options = { maxFailures: 1, windowMs: 60_000 };
    const firstInstance = new SharedLoginRateLimiter(repository, options);
    const secondInstance = new SharedLoginRateLimiter(repository, options);

    await firstInstance.registerFailure(
      '203.0.113.1:learner@example.com',
      testNow,
    );

    await expect(
      secondInstance.assertAllowed('203.0.113.1:learner@example.com', testNow),
    ).rejects.toMatchObject({
      code: 'TOO_MANY_LOGIN_ATTEMPTS',
      status: 429,
    });
    expect([...records.keys()][0]).not.toContain('learner@example.com');
  });

  it('makes the authenticated user available through requireUser', async () => {
    const { dependencies } = createTestDependencies();
    const authApp = createAuthApp({ dependencies });
    const registerResponse = await authApp.request(
      'http://localhost/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({
          email: 'learner@example.com',
          password: 'correct-horse-battery-staple',
          displayName: 'Learner',
        }),
        headers: { 'content-type': 'application/json' },
      },
    );
    const protectedApp = new Hono<AuthEnvironment>();
    protectedApp.get('/protected', createRequireUser(dependencies), (context) =>
      context.json({ user: context.get('user') }),
    );

    const unauthenticatedResponse = await protectedApp.request(
      'http://localhost/protected',
    );
    const authenticatedResponse = await protectedApp.request(
      'http://localhost/protected',
      { headers: { cookie: getSessionCookie(registerResponse) } },
    );

    expect(unauthenticatedResponse.status).toBe(401);
    expect(await authenticatedResponse.json()).toMatchObject({
      user: { email: 'learner@example.com' },
    });
  });
});
