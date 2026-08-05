import { Hono } from 'hono';

import {
  requestAccess,
  type AccessRequestDependencies,
} from '../_lib/access-request.js';
import {
  SharedAccessRequestRateLimiter,
  type AccessRequestRateLimiter,
} from '../_lib/access-request-rate-limit.js';
import { accessRequestInputSchema } from '../_lib/auth-validation.js';
import { getClientAddress } from '../_lib/client-address.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';

interface AccessRequestsAppOptions {
  dependencies?: AccessRequestDependencies;
  enabled?: boolean;
  rateLimiter?: AccessRequestRateLimiter;
}

const confirmation = {
  message:
    'Votre demande a été prise en compte. Les prochaines étapes vous seront communiquées par e-mail.',
} as const;

const sharedRateLimiter = new SharedAccessRequestRateLimiter();

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

export function createAccessRequestsApp(
  options: AccessRequestsAppOptions = {},
) {
  const app = new Hono();
  const enabled =
    options.enabled ?? process.env.LEARNX_ACCESS_REQUESTS_ENABLED !== 'false';
  const rateLimiter = options.rateLimiter ?? sharedRateLimiter;

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

  app.post('/api/access-requests', async (context) => {
    if (!enabled) {
      throw new ApiError(
        'ACCESS_REQUESTS_DISABLED',
        'Access requests are temporarily unavailable.',
        503,
      );
    }

    const parsedInput = accessRequestInputSchema.safeParse(
      await parseBody(context.req.raw),
    );

    if (!parsedInput.success) {
      throw new ApiError('INVALID_REQUEST', 'Invalid access request.', 400);
    }

    const now = options.dependencies?.now() ?? new Date();
    await rateLimiter.consume(
      {
        clientAddress: getClientAddress(context.req.raw),
        email: parsedInput.data.email,
      },
      now,
    );
    await requestAccess(parsedInput.data.email, options.dependencies);

    context.header('Cache-Control', 'private, no-store');
    return context.json(confirmation, 202);
  });

  return app;
}

export const accessRequestsApp = createAccessRequestsApp();
