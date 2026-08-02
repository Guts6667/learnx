import { Hono } from 'hono';

import {
  createRequireUser,
  type AuthDependencies,
  type AuthEnvironment,
} from '../_lib/auth';
import type {
  AuthRepository,
  StoredSession,
  StoredUser,
} from '../_lib/auth-types';
import { hashSessionToken } from '../_lib/session';
import { InMemoryLoginRateLimiter } from '../_lib/login-rate-limit';
import { createAuthApp } from './app';

const testNow = new Date('2026-08-02T12:00:00.000Z');

function createTestDependencies() {
  const users = new Map<string, StoredUser>();
  const sessions = new Map<string, StoredSession>();
  let userSequence = 0;
  let sessionSequence = 0;

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
        id: `user-${userSequence}`,
        email: input.email,
        passwordHash: input.passwordHash,
        displayName: input.displayName,
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
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        },
      };
    },
    async findUserByEmail(email) {
      return users.get(email) ?? null;
    },
    async touchSession(id, lastUsedAt) {
      const session = [...sessions.values()].find(
        (candidate) => candidate.id === id,
      );

      if (session) {
        session.lastUsedAt = lastUsedAt;
      }
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

  return { dependencies, users };
}

function getSessionCookie(response: Response): string {
  const setCookie = response.headers.get('set-cookie');

  if (!setCookie) {
    throw new Error('Expected a session cookie.');
  }

  return setCookie.split(';')[0];
}

describe('auth API', () => {
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
