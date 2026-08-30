import type { Hono } from 'hono';
import { z } from 'zod';

import type { AuthEnvironment } from '../_lib/auth.js';
import { assertCapability } from '../_lib/authorization.js';
import { ApiError } from '../_lib/errors.js';
import {
  buildRefundPreview,
  type PaymentOrderRow,
  type PaymentReadPorts,
  type RefundPreview,
} from '../../payments/refund-preview.js';
import {
  refundOrder,
  type RefundPorts,
  type RefundRefusalCode,
} from '../../payments/refund-service.js';

/**
 * Administrative refund (V4.5-162).
 *
 * The amount is never sent by the caller: a voluntary refund reverses the
 * unspent credits and repays their pro-rata share, computed in one place from
 * the order's own pack. An amount in the request would be an amount someone
 * could get wrong.
 */
/**
 * One error code per refusal rather than a single state conflict: the screen
 * has to say why, and "already refunded", "under dispute" and "never
 * fulfilled" call for three different sentences and three different next
 * steps.
 */
const REFUSALS: Record<
  RefundRefusalCode,
  { code: ApiErrorCodeForRefusal; message: string }
> = {
  ALREADY_REFUNDED: {
    code: 'PAYMENT_ALREADY_REFUNDED',
    message: 'This order has already been refunded.',
  },
  DISPUTE_LOST: {
    code: 'PAYMENT_DISPUTE_LOST',
    message: 'This order was already reclaimed through a lost dispute.',
  },
  NOT_FULFILLED: {
    code: 'PAYMENT_ORDER_NOT_FULFILLED',
    message: 'This order was never fulfilled.',
  },
  REFUND_PENDING: {
    code: 'PAYMENT_REFUND_PENDING',
    message: 'A refund is already in progress for this order.',
  },
  UNDER_DISPUTE: {
    code: 'PAYMENT_UNDER_DISPUTE',
    message: 'This order is under dispute.',
  },
};

type ApiErrorCodeForRefusal =
  | 'PAYMENT_ALREADY_REFUNDED'
  | 'PAYMENT_DISPUTE_LOST'
  | 'PAYMENT_ORDER_NOT_FULFILLED'
  | 'PAYMENT_REFUND_PENDING'
  | 'PAYMENT_UNDER_DISPUTE';

/** Money and credits cross the wire as strings: a BigInt does not survive a */
/** JavaScript number, and a rounded amount is a wrong amount. */
const amount = (value: bigint) => value.toString();

function serialisePreview(preview: RefundPreview) {
  return {
    computation: preview.computation
      ? {
          expectedRemainingOnLot: amount(
            preview.computation.expectedRemainingOnLot,
          ),
          packCredits: amount(preview.computation.packCredits),
          packPriceMinor: amount(preview.computation.packPriceMinor),
          projectedWriteOffCredits: amount(
            preview.computation.projectedWriteOffCredits,
          ),
          reclaimedCredits: amount(preview.computation.reclaimedCredits),
          refundedMinor: amount(preview.computation.refundedMinor),
          remainingOnLot: amount(preview.computation.remainingOnLot),
        }
      : null,
    order: {
      amountMinor: amount(preview.order.amountMinor),
      createdAt: preview.order.createdAt.toISOString(),
      currency: preview.order.currency,
      fulfilledAt: preview.order.fulfilledAt?.toISOString() ?? null,
      id: preview.order.id,
      learner: preview.order.learner,
      packKey: preview.order.packKey,
      refundedCredits: amount(preview.order.refundedCredits),
      status: preview.order.status,
      writtenOffCredits: amount(preview.order.writtenOffCredits),
    },
    refundable: preview.refundable,
    refusal: preview.refusal,
  };
}

function serialiseOrder(row: PaymentOrderRow) {
  return {
    amountMinor: amount(row.amountMinor),
    createdAt: row.createdAt.toISOString(),
    currency: row.currency,
    fulfilledAt: row.fulfilledAt?.toISOString() ?? null,
    id: row.id,
    packKey: row.packKey,
    refundedCredits: amount(row.refundedCredits),
    status: row.status,
    writtenOffCredits: amount(row.writtenOffCredits),
  };
}

const orderListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export function registerPaymentRefundRoutes(
  app: Hono<AuthEnvironment>,
  options: { ports?: RefundPorts; readPorts?: PaymentReadPorts } = {},
) {
  async function readPorts(): Promise<PaymentReadPorts> {
    if (options.readPorts) return options.readPorts;
    const { createPrismaPaymentReadPorts } =
      await import('../../payments/prisma-refund-ports.js');

    return createPrismaPaymentReadPorts();
  }

  app.get('/api/admin/payments/:orderId/refund-preview', async (context) => {
    assertCapability(context.get('user').role, 'credit.admin.manage');
    const orderId = z.uuid().safeParse(context.req.param('orderId'));
    if (!orderId.success) {
      throw new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
    }

    const source = await (await readPorts()).loadPreview(orderId.data);
    if (!source) {
      throw new ApiError('RESOURCE_NOT_FOUND', 'Order not found.', 404);
    }

    // Always 200 when the order exists, refusal included: "you may not refund
    // this, and here is why" is an answer about a resource that is there, not
    // an error about one that is not.
    return context.json({
      resource: serialisePreview(buildRefundPreview(source)),
    });
  });

  app.get('/api/admin/credits/members/:userId/orders', async (context) => {
    assertCapability(context.get('user').role, 'credit.admin.manage');
    const userId = z.uuid().safeParse(context.req.param('userId'));
    const query = orderListSchema.safeParse(context.req.query());
    if (!userId.success || !query.success) {
      throw new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
    }

    const { rows, total } = await (
      await readPorts()
    ).listOrders({
      page: query.data.page,
      pageSize: query.data.pageSize,
      userId: userId.data,
    });

    return context.json({
      page: {
        items: rows.map(serialiseOrder),
        page: query.data.page,
        pageSize: query.data.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.data.pageSize)),
      },
    });
  });

  app.post('/api/admin/payments/:orderId/refund', async (context) => {
    assertCapability(context.get('user').role, 'credit.admin.manage');
    const orderId = z.uuid().safeParse(context.req.param('orderId'));
    if (!orderId.success) {
      throw new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
    }
    const body = z
      .object({
        // The figure the administrator was shown. Sent back so a lot that
        // moved while they were reading is refused instead of quietly
        // refunding an amount nobody approved.
        expectedRemainingOnLot: z.string().regex(/^\d{1,20}$/),
        note: z.string().trim().min(1).max(500).optional(),
      })
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
      expectedRemainingOnLot: BigInt(body.data.expectedRemainingOnLot),
      kind: 'VOLUNTARY',
      ...(body.data.note === undefined ? {} : { note: body.data.note }),
      orderId: orderId.data,
      ports,
    });

    if (result.kind === 'ORDER_NOT_FOUND') {
      throw new ApiError('RESOURCE_NOT_FOUND', 'Order not found.', 404);
    }

    if (result.kind === 'PREVIEW_STALE') {
      throw new ApiError(
        'PAYMENT_REFUND_PREVIEW_STALE',
        'The balance changed since the refund was previewed.',
        409,
      );
    }

    if (result.kind === 'REFUSED') {
      const refusal = REFUSALS[result.reason];
      throw new ApiError(refusal.code, refusal.message, 409);
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
