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
      await prisma.paymentOrder.update({
        data: {
          status: input.status,
          ...(input.attributeCredits ? { fulfilledAt: new Date() } : {}),
        },
        where: { id: input.orderId },
      });
    },
    async findOrder(providerOrderId) {
      return prisma.paymentOrder.findUnique({
        select: { id: true, status: true },
        where: { providerOrderId },
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
