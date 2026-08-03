import { Hono } from 'hono';

import {
  clearSessionCookie,
  getSessionUser,
  loginUser,
  logoutUser,
  registerUser,
  setSessionCookie,
  type AuthDependencies,
  type AuthEnvironment,
} from '../_lib/auth.js';
import {
  loginInputSchema,
  registerInputSchema,
} from '../_lib/auth-validation.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import {
  InMemoryLoginRateLimiter,
  type LoginRateLimiter,
} from '../_lib/login-rate-limit.js';

interface AuthAppOptions {
  dependencies?: AuthDependencies;
  loginRateLimiter?: LoginRateLimiter;
  secureCookies?: boolean;
}

const loginRateLimiter = new InMemoryLoginRateLimiter();

async function parseBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(
      'INVALID_REQUEST',
      'Request body must be valid JSON.',
      400,
    );
  }
}

function getLoginRateLimitKey(request: Request, email: string): string {
  const clientAddress = request.headers
    .get('x-forwarded-for')
    ?.split(',')[0]
    ?.trim();

  return `${clientAddress || 'unknown'}:${email}`;
}

export function createAuthApp(options: AuthAppOptions = {}) {
  const app = new Hono<AuthEnvironment>();
  const secureCookies =
    options.secureCookies ?? process.env.NODE_ENV === 'production';
  const rateLimiter = options.loginRateLimiter ?? loginRateLimiter;

  app.onError((error, context) => {
    if (error instanceof ApiError) {
      return context.json(toApiErrorBody(error), error.status);
    }

    return context.json(
      toApiErrorBody(
        new ApiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500),
      ),
      500,
    );
  });

  app.post('/api/auth/register', async (context) => {
    const parsedInput = registerInputSchema.safeParse(
      await parseBody(context.req.raw),
    );

    if (!parsedInput.success) {
      throw new ApiError(
        'INVALID_REQUEST',
        'Invalid registration details.',
        400,
      );
    }

    const result = await registerUser(parsedInput.data, options.dependencies);
    setSessionCookie(context, result.sessionToken, secureCookies);

    return context.json({ user: result.user }, 201);
  });

  app.post('/api/auth/login', async (context) => {
    const parsedInput = loginInputSchema.safeParse(
      await parseBody(context.req.raw),
    );

    if (!parsedInput.success) {
      throw new ApiError('INVALID_REQUEST', 'Invalid login details.', 400);
    }

    const rateLimitKey = getLoginRateLimitKey(
      context.req.raw,
      parsedInput.data.email,
    );
    const now = options.dependencies?.now() ?? new Date();
    rateLimiter.assertAllowed(rateLimitKey, now);

    let result;

    try {
      result = await loginUser(parsedInput.data, options.dependencies);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') {
        rateLimiter.registerFailure(rateLimitKey, now);
      }

      throw error;
    }

    rateLimiter.clear(rateLimitKey);
    setSessionCookie(context, result.sessionToken, secureCookies);

    return context.json({ user: result.user });
  });

  app.post('/api/auth/logout', async (context) => {
    await logoutUser(context.req.raw, options.dependencies);
    clearSessionCookie(context, secureCookies);

    return context.body(null, 204);
  });

  app.get('/api/auth/session', async (context) => {
    const user = await getSessionUser(context.req.raw, options.dependencies);

    return context.json({ user });
  });

  return app;
}

export const authApp = createAuthApp();
