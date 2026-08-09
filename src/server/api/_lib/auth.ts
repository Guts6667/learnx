import { createMiddleware } from 'hono/factory';
import { deleteCookie, setCookie } from 'hono/cookie';

import { ApiError, toApiErrorBody } from './errors.js';
import { prismaAuthRepository } from './auth-repository.js';
import {
  createSessionToken,
  getSessionExpiry,
  hashSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
} from './session.js';
import type {
  AuthRepository,
  AuthenticatedUser,
  StoredAccountUser,
} from './auth-types.js';
import type { SupportedLocale } from '../../../shared/locale.js';

export interface AuthEnvironment {
  Variables: {
    user: AuthenticatedUser;
  };
}

export interface AuthDependencies {
  createSessionToken: () => string;
  getSessionExpiry: (now?: Date) => Date;
  hashPassword: (password: string) => Promise<string>;
  hashSessionToken: (token: string) => string;
  now: () => Date;
  repository: AuthRepository;
  verifyPassword: (passwordHash: string, password: string) => Promise<boolean>;
}

export interface AuthResult {
  sessionToken: string;
  user: AuthenticatedUser;
}

const defaultDependencies: AuthDependencies = {
  createSessionToken,
  getSessionExpiry,
  hashPassword: async (password) => {
    const { hashPassword } = await import('./password.js');

    return hashPassword(password);
  },
  hashSessionToken,
  now: () => new Date(),
  repository: prismaAuthRepository,
  verifyPassword: async (passwordHash, password) => {
    const { verifyPassword } = await import('./password.js');

    return verifyPassword(passwordHash, password);
  },
};

function toAuthenticatedUser(user: StoredAccountUser): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    locale: user.locale,
    role: user.role,
  };
}

function getCookieValue(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  for (const cookie of cookieHeader.split(';')) {
    const [name, ...valueParts] = cookie.trim().split('=');

    if (name === SESSION_COOKIE_NAME) {
      return valueParts.join('=') || undefined;
    }
  }

  return undefined;
}

async function createSession(
  dependencies: AuthDependencies,
  user: AuthenticatedUser,
): Promise<AuthResult> {
  const sessionToken = dependencies.createSessionToken();

  const session = await dependencies.repository.createSession({
    userId: user.id,
    tokenHash: dependencies.hashSessionToken(sessionToken),
    expiresAt: dependencies.getSessionExpiry(dependencies.now()),
  });

  if (!session) {
    throw new ApiError(
      'INVALID_CREDENTIALS',
      'Invalid email address or password.',
      401,
    );
  }

  return { sessionToken, user };
}

export async function registerUser(
  input: {
    email: string;
    password: string;
    displayName: string;
    locale: SupportedLocale;
  },
  dependencies = defaultDependencies,
): Promise<AuthResult> {
  const existingUser = await dependencies.repository.findUserByEmail(
    input.email,
  );

  if (existingUser) {
    throw new ApiError(
      'EMAIL_ALREADY_REGISTERED',
      'An account already exists for this email address.',
      409,
    );
  }

  try {
    const user = await dependencies.repository.createUser({
      email: input.email,
      passwordHash: await dependencies.hashPassword(input.password),
      displayName: input.displayName,
      locale: input.locale,
    });

    return createSession(dependencies, toAuthenticatedUser(user));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'EMAIL_ALREADY_REGISTERED'
    ) {
      throw new ApiError(
        'EMAIL_ALREADY_REGISTERED',
        'An account already exists for this email address.',
        409,
      );
    }

    throw error;
  }
}

export async function updateUserLocale(
  userId: string,
  locale: SupportedLocale,
  dependencies = defaultDependencies,
): Promise<AuthenticatedUser | null> {
  const user = await dependencies.repository.updateUserLocale(userId, locale);
  return user ? toAuthenticatedUser(user) : null;
}

export async function loginUser(
  input: { email: string; password: string },
  dependencies = defaultDependencies,
): Promise<AuthResult> {
  const user = await dependencies.repository.findUserByEmail(input.email);
  const passwordIsValid = user
    ? await dependencies.verifyPassword(user.passwordHash, input.password)
    : false;

  if (!user || !passwordIsValid || user.accountStatus !== 'ACTIVE') {
    throw new ApiError(
      'INVALID_CREDENTIALS',
      'Invalid email address or password.',
      401,
    );
  }

  return createSession(dependencies, toAuthenticatedUser(user));
}

export async function getSessionUser(
  request: Request,
  dependencies = defaultDependencies,
): Promise<AuthenticatedUser | null> {
  const sessionToken = getCookieValue(
    request.headers.get('cookie') ?? undefined,
  );

  if (!sessionToken) {
    return null;
  }

  const sessionWithUser =
    await dependencies.repository.findSessionWithUserByTokenHash(
      dependencies.hashSessionToken(sessionToken),
    );

  if (
    !sessionWithUser ||
    sessionWithUser.session.expiresAt <= dependencies.now() ||
    sessionWithUser.user.accountStatus !== 'ACTIVE'
  ) {
    if (sessionWithUser) {
      await dependencies.repository.deleteSessionByTokenHash(
        dependencies.hashSessionToken(sessionToken),
      );
    }
    return null;
  }

  const sessionStillActive = await dependencies.repository.touchSession(
    sessionWithUser.session.id,
    dependencies.now(),
  );

  if (!sessionStillActive) return null;

  return toAuthenticatedUser(sessionWithUser.user);
}

export async function logoutUser(
  request: Request,
  dependencies = defaultDependencies,
): Promise<void> {
  const sessionToken = getCookieValue(
    request.headers.get('cookie') ?? undefined,
  );

  if (sessionToken) {
    await dependencies.repository.deleteSessionByTokenHash(
      dependencies.hashSessionToken(sessionToken),
    );
  }
}

export function createRequireUser(dependencies = defaultDependencies) {
  return createMiddleware<AuthEnvironment>(async (context, next) => {
    const user = await getSessionUser(context.req.raw, dependencies);

    if (!user) {
      const error = new ApiError(
        'AUTHENTICATION_REQUIRED',
        'Authentication is required.',
        401,
      );

      return context.json(toApiErrorBody(error), error.status);
    }

    context.set('user', user);
    await next();
  });
}

export const requireUser = createRequireUser();

export function setSessionCookie(
  context: Parameters<typeof setCookie>[0],
  sessionToken: string,
  secure: boolean,
): void {
  setCookie(context, SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    maxAge: Math.floor(SESSION_DURATION_MS / 1000),
    path: '/',
    sameSite: 'Lax',
    secure,
  });
}

export function clearSessionCookie(
  context: Parameters<typeof deleteCookie>[0],
  secure: boolean,
): void {
  deleteCookie(context, SESSION_COOKIE_NAME, {
    httpOnly: true,
    path: '/',
    sameSite: 'Lax',
    secure,
  });
}
