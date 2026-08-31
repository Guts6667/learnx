import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { requireCapability } from '../_lib/authorization.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import { ENTRY_TIER_PACK_KEY } from '../../maintenance/credit-pack-seed.js';
import { startCheckout, type CheckoutPorts } from '../../payments/checkout.js';
import { readPaymentsConfiguration } from '../../payments/payments-configuration.js';

/**
 * `POST /api/credits/checkout` (V4.5-161).
 *
 * Answers with the suspension state rather than refusing on it: purchased
 * credits keep their value when corrections return, so the honest response is
 * to sell while saying so.
 */
export function createCheckoutRoute(
  options: {
    authentication?: MiddlewareHandler<AuthEnvironment>;
    ports?: CheckoutPorts;
  } = {},
) {
  const app = new Hono<AuthEnvironment>();

  app.onError((error, context) => {
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
    return context.json(toApiErrorBody(apiError), apiError.status);
  });

  app.post(
    '/api/credits/checkout',
    options.authentication ?? requireUser,
    requireCapability('ai.assessment.correct'),
    async (context) => {
      const body = z
        .object({ packKey: z.string().trim().min(1).max(64) })
        .strict()
        .safeParse(await context.req.json().catch(() => null));
      if (!body.success) {
        throw new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
      }

      let ports = options.ports;
      if (!ports) {
        const { createPrismaCheckoutPorts } =
          await import('../../payments/prisma-checkout-ports.js');
        ports = await createPrismaCheckoutPorts();
      }
      const result = await startCheckout({
        enabled: readPaymentsConfiguration().enabled,
        entryTierPackKey: ENTRY_TIER_PACK_KEY,
        packKey: body.data.packKey,
        ports,
        userId: context.get('user').id,
      });

      if (result.kind === 'PAYMENTS_DISABLED') {
        throw new ApiError(
          'PRICING_UNAVAILABLE',
          'Purchases are unavailable.',
          503,
        );
      }
      // Unknown and inactive answer alike, so a caller cannot learn which keys
      // exist by watching the difference.
      if (result.kind === 'PACK_UNAVAILABLE') {
        throw new ApiError('RESOURCE_NOT_FOUND', 'Pack not found.', 404);
      }
      // 409 and a code of its own: the learner asked for something reasonable
      // that their account is not entitled to twice, which is neither a
      // missing resource nor a fault. The screen has something true to say.
      if (result.kind === 'ENTRY_TIER_ALREADY_PURCHASED') {
        throw new ApiError(
          'ENTRY_TIER_ALREADY_PURCHASED',
          'The entry tier can only be purchased once per account.',
          409,
        );
      }

      return context.json({
        resource: {
          checkout: {
            correctionSuspended: result.correctionSuspended,
            orderId: result.orderId,
            url: result.checkoutUrl,
          },
        },
      });
    },
  );

  return app;
}
