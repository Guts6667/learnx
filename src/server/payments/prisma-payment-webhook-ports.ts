import type { WebhookPorts } from './payment-webhook.js';

/**
 * The database side of the webhook receiver.
 *
 * `recordEvent` returns false on a unique violation rather than throwing: the
 * uniqueness of `provider_event_id` is what makes a replayed delivery harmless,
 * so a collision is the mechanism working, not an error.
 */
export async function createPrismaPaymentWebhookPorts(): Promise<WebhookPorts> {
  const { prisma } = await import('../prisma.js');
  const { Prisma } = await import('../../../generated/prisma/client.js');

  return {
    async applyTransition(input) {
      // Written on every transition that names one, not only on the grant:
      // `checkout.session.expired` carries no intent, `charge.dispute.created`
      // does, and an order first seen through a dispute still has to become
      // resolvable afterwards.
      const intent = input.paymentIntentId
        ? { providerPaymentIntentId: input.paymentIntentId }
        : {};

      if (!input.attributeCredits) {
        await prisma.paymentOrder.update({
          data: { ...intent, status: input.status },
          where: { id: input.orderId },
        });
        return;
      }

      const order = await prisma.paymentOrder.findUniqueOrThrow({
        select: { creditLotId: true, packKey: true, userId: true },
        where: { id: input.orderId },
      });
      // Already granted: the lot id on the order is the first of two guards,
      // and the ledger's own idempotency below is the second. Neither alone
      // would be enough under a concurrent redelivery.
      if (order.creditLotId) return;

      const pack = await prisma.creditPack.findUniqueOrThrow({
        select: { credits: true },
        where: { key: order.packKey },
      });
      const { PrismaCreditLedger } =
        await import('../credits/prisma-credit-ledger.js');
      const result = await new PrismaCreditLedger(prisma).grant({
        amount: pack.credits,
        // Derived from the order, so a redelivery computes the same key and
        // the ledger returns the original lot instead of creating a second.
        idempotencyKey: `purchase:${input.orderId}`,
        provenance: 'PURCHASED',
        reference: { id: input.orderId, type: 'PAYMENT_ORDER' },
        userId: order.userId,
      });
      await prisma.paymentOrder.update({
        data: {
          ...intent,
          creditLotId: result.lotId,
          fulfilledAt: new Date(),
          status: input.status,
        },
        where: { id: input.orderId },
      });
    },
    async findOrder(input) {
      // Payment intent first: it is what a charge or a dispute carries, and
      // the only handle shared by the whole lifecycle. A session id resolves
      // the purchase and nothing after it (V4.5-195).
      if (input.paymentIntentId) {
        const byIntent = await prisma.paymentOrder.findUnique({
          select: { id: true, status: true },
          where: { providerPaymentIntentId: input.paymentIntentId },
        });
        if (byIntent) return byIntent;
      }
      if (!input.reference) return null;

      return prisma.paymentOrder.findUnique({
        select: { id: true, status: true },
        where: { providerOrderId: input.reference },
      });
    },
    async recordEvent(input) {
      try {
        await prisma.paymentEvent.create({
          data: {
            eventType: input.eventType,
            orderId: input.orderId,
            outcome: input.outcome,
            payload: input.payload as never,
            providerEventId: input.providerEventId,
          },
        });
        return true;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          return false;
        }
        throw error;
      }
    },
  };
}
