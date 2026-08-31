import { Hono } from 'hono';

import {
  clearSessionCookie,
  getSessionUser,
  loginUser,
  logoutUser,
  registerUser,
  setSessionCookie,
  updateUserLocale,
  updateUserCorrectionReuseConsent,
  type AuthDependencies,
  type AuthEnvironment,
} from '../_lib/auth.js';
import {
  loginInputSchema,
  localePreferenceInputSchema,
  correctionReuseConsentInputSchema,
  registerInputSchema,
} from '../_lib/auth-validation.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import {
  InMemoryLoginRateLimiter,
  SharedLoginRateLimiter,
  type LoginRateLimiter,
} from '../_lib/login-rate-limit.js';

interface AuthAppOptions {
  dependencies?: AuthDependencies;
  allowRegistration?: boolean;
  loginRateLimiter?: LoginRateLimiter;
  secureCookies?: boolean;
}

const sharedLoginRateLimiter = new SharedLoginRateLimiter();

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
  const allowRegistration =
    options.allowRegistration ?? process.env.NODE_ENV !== 'production';
  const rateLimiter =
    options.loginRateLimiter ??
    (options.dependencies
      ? new InMemoryLoginRateLimiter()
      : sharedLoginRateLimiter);

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
    if (!allowRegistration) {
      throw new ApiError(
        'REGISTRATION_DISABLED',
        'Public registration is not available.',
        403,
      );
    }

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
    await rateLimiter.assertAllowed(rateLimitKey, now);

    let result;

    try {
      result = await loginUser(parsedInput.data, options.dependencies);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') {
        await rateLimiter.registerFailure(rateLimitKey, now);
      }

      throw error;
    }

    await rateLimiter.clear(rateLimitKey);
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

    if (!user) clearSessionCookie(context, secureCookies);

    return context.json({ user });
  });

  app.patch('/api/auth/locale', async (context) => {
    const currentUser = await getSessionUser(
      context.req.raw,
      options.dependencies,
    );
    if (!currentUser) {
      throw new ApiError(
        'AUTHENTICATION_REQUIRED',
        'Authentication is required.',
        401,
      );
    }
    const parsedInput = localePreferenceInputSchema.safeParse(
      await parseBody(context.req.raw),
    );
    if (!parsedInput.success) {
      throw new ApiError('INVALID_REQUEST', 'Invalid locale preference.', 400);
    }
    const user = await updateUserLocale(
      currentUser.id,
      parsedInput.data.locale,
      options.dependencies,
    );
    if (!user) {
      throw new ApiError(
        'AUTHENTICATION_REQUIRED',
        'Authentication is required.',
        401,
      );
    }
    context.header('Cache-Control', 'private, no-store');
    return context.json({ user });
  });

  app.patch('/api/auth/correction-reuse-consent', async (context) => {
    const currentUser = await getSessionUser(
      context.req.raw,
      options.dependencies,
    );
    if (!currentUser) {
      throw new ApiError(
        'AUTHENTICATION_REQUIRED',
        'Authentication is required.',
        401,
      );
    }
    const parsedInput = correctionReuseConsentInputSchema.safeParse(
      await parseBody(context.req.raw),
    );
    if (!parsedInput.success) {
      throw new ApiError('INVALID_REQUEST', 'Invalid consent value.', 400);
    }
    const user = await updateUserCorrectionReuseConsent(
      currentUser.id,
      parsedInput.data.consent,
      options.dependencies,
    );
    if (!user) {
      throw new ApiError(
        'AUTHENTICATION_REQUIRED',
        'Authentication is required.',
        401,
      );
    }
    context.header('Cache-Control', 'private, no-store');
    return context.json({ user });
  });

  return app;
}

export const authApp = createAuthApp();
