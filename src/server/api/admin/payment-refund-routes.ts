import type { Hono } from 'hono';
import { z } from 'zod';

import type { AuthEnvironment } from '../_lib/auth.js';
import { assertCapability } from '../_lib/authorization.js';
import { ApiError } from '../_lib/errors.js';
import {
  refundOrder,
  type RefundPorts,
} from '../../payments/refund-service.js';

/**
 * Administrative refund (V4.5-162).
 *
 * The amount is never sent by the caller: a voluntary refund reverses the
 * unspent credits and repays their pro-rata share, computed in one place from
 * the order's own pack. An amount in the request would be an amount someone
 * could get wrong.
 */
export function registerPaymentRefundRoutes(
  app: Hono<AuthEnvironment>,
  options: { ports?: RefundPorts } = {},
) {
  app.post('/api/admin/payments/:orderId/refund', async (context) => {
    assertCapability(context.get('user').role, 'credit.admin.manage');
    const orderId = z.uuid().safeParse(context.req.param('orderId'));
    if (!orderId.success) {
      throw new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
    }
    const body = z
      .object({ note: z.string().trim().min(1).max(500).optional() })
      .strict()
      .safeParse(await context.req.json().catch(() => ({})));
    if (!body.success) {
      throw new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
    }

    let ports = options.ports;
    if (!ports) {
      const { createPrismaRefundPorts } =
        await import('../../payments/prisma-refund-ports.js');
      ports = await createPrismaRefundPorts();
    }
    const result = await refundOrder({
      actorUserId: context.get('user').id,
      kind: 'VOLUNTARY',
      ...(body.data.note === undefined ? {} : { note: body.data.note }),
      orderId: orderId.data,
      ports,
    });

    if (result.kind === 'ORDER_NOT_FOUND') {
      throw new ApiError('RESOURCE_NOT_FOUND', 'Order not found.', 404);
    }
    // An order that was never fulfilled has nothing to compensate; refunding
    // it would invent a reversal for credits never granted.
    if (result.kind === 'NOT_FULFILLED') {
      throw new ApiError(
        'INVALID_SUBMISSION_STATE',
        'This order was never fulfilled.',
        409,
      );
    }

    return context.json({
      resource: {
        refund: {
          reclaimedCredits: result.reclaimed.toString(),
          refundedMinor: result.refundedMinor.toString(),
          writtenOffCredits: result.writtenOff.toString(),
        },
      },
    });
  });
}
