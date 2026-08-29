import { Hono } from 'hono';

import {
  requestAccess,
  type AccessRequestDependencies,
} from '../_lib/access-request.js';
import {
  SharedAccessRequestRateLimiter,
  type AccessRequestRateLimiter,
} from '../_lib/access-request-rate-limit.js';
import {
  accessInvitationActivationInputSchema,
  accessRequestInputSchema,
  emailVerificationInputSchema,
} from '../_lib/auth-validation.js';
import {
  createPrismaAccessInvitationActivationService,
  type AccessInvitationActivationService,
} from '../_lib/access-invitation.js';
import { setSessionCookie } from '../_lib/auth.js';
import { getClientAddress } from '../_lib/client-address.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import {
  consumeEmailVerification,
  createEmailVerificationConsumerDependencies,
  type EmailVerificationDependencies,
} from '../_lib/email-verification.js';

interface AccessRequestsAppOptions {
  activationService?: AccessInvitationActivationService;
  dependencies?: AccessRequestDependencies;
  enabled?: boolean;
  emailVerification?: EmailVerificationDependencies;
  environment?: NodeJS.ProcessEnv;
  rateLimiter?: AccessRequestRateLimiter;
  secureCookies?: boolean;
}

const confirmation = {
  message:
    'Votre demande a été prise en compte. Les prochaines étapes vous seront communiquées par e-mail.',
} as const;

const sharedRateLimiter = new SharedAccessRequestRateLimiter();

export function areAccessRequestsEnabled(
  environment: NodeJS.ProcessEnv,
): boolean {
  if (environment.LEARNX_ACCESS_REQUESTS_ENABLED === 'true') return true;
  if (environment.LEARNX_ACCESS_REQUESTS_ENABLED === 'false') return false;

  return environment.NODE_ENV !== 'production';
}

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

/**
 * Hands a newly activated account its first cycle. Failures are swallowed on
 * purpose: the account exists, the learner is signed in, and a missing grant is
 * recoverable by the monthly run — losing the activation to a credit error is
 * not.
 */
async function grantFirstCycle(userId: string): Promise<void> {
  try {
    const { createDefaultTrialAllocation } =
      await import('../../credits/default-trial-allocation.js');
    const allocation = await createDefaultTrialAllocation();
    await allocation?.grantForCycle(userId);
  } catch {
    // Deliberately silent to the learner. The weekly report shows the funnel,
    // and an account that received no grant appears there as one that never
    // had a cycle rather than as a success.
  }
}

export function createAccessRequestsApp(
  options: AccessRequestsAppOptions = {},
) {
  const app = new Hono();
  const environment = options.environment ?? process.env;
  const enabled = options.enabled ?? areAccessRequestsEnabled(environment);
  const rateLimiter = options.rateLimiter ?? sharedRateLimiter;
  const secureCookies =
    options.secureCookies ?? environment.NODE_ENV === 'production';
  let defaultActivationService: AccessInvitationActivationService | undefined;
  async function getActivationService() {
    if (options.activationService) return options.activationService;
    if (!defaultActivationService) {
      const { prisma } = await import('../../prisma.js');
      defaultActivationService =
        createPrismaAccessInvitationActivationService(prisma);
    }
    return defaultActivationService;
  }

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
    await requestAccess(
      parsedInput.data.email,
      parsedInput.data.locale,
      options.dependencies && options.emailVerification
        ? {
            ...options.dependencies,
            emailVerification: options.emailVerification,
          }
        : options.dependencies,
      environment,
    );

    context.header('Cache-Control', 'private, no-store');
    return context.json(confirmation, 202);
  });

  app.post('/api/access-requests/verify-email', async (context) => {
    const parsedInput = emailVerificationInputSchema.safeParse(
      await parseBody(context.req.raw),
    );
    if (!parsedInput.success) {
      throw new ApiError(
        'INVALID_EMAIL_VERIFICATION',
        'Ce lien de vérification est invalide ou a expiré.',
        400,
      );
    }

    const emailVerification =
      options.emailVerification ??
      createEmailVerificationConsumerDependencies();

    const consumed = await consumeEmailVerification(
      parsedInput.data.token,
      emailVerification,
    );
    if (!consumed) {
      throw new ApiError(
        'INVALID_EMAIL_VERIFICATION',
        'Ce lien de vérification est invalide ou a expiré.',
        400,
      );
    }

    return context.json({
      message:
        'Ton adresse e-mail est vérifiée. Ta demande est maintenant en attente d’approbation.',
      status: 'verified' as const,
    });
  });

  app.post('/api/access-invitations/activate', async (context) => {
    const parsedInput = accessInvitationActivationInputSchema.safeParse(
      await parseBody(context.req.raw),
    );
    if (!parsedInput.success) {
      throw new ApiError(
        'INVALID_ACCESS_INVITATION',
        'Cette invitation est invalide ou a expiré.',
        400,
      );
    }

    const result = await (
      await getActivationService()
    ).activate(parsedInput.data);
    if (!result) {
      throw new ApiError(
        'INVALID_ACCESS_INVITATION',
        'Cette invitation est invalide ou a expiré.',
        400,
      );
    }
    // Granted after the activation transaction has committed, and never
    // allowed to fail it: an account must not be lost because a credit grant
    // did. The grant is idempotent per cycle, so the monthly run picks up
    // anyone missed here.
    await grantFirstCycle(result.user.id);
    setSessionCookie(context, result.sessionToken, secureCookies);
    return context.json({ user: result.user }, 201);
  });

  return app;
}

export const accessRequestsApp = createAccessRequestsApp();
