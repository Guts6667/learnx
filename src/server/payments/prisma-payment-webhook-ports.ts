import { SYSTEM_ACTOR_ID } from '../system-actor.js';
import type { WebhookPorts } from './payment-webhook.js';

/**
 * The database side of the webhook receiver.
 *
 * `recordEvent` returns false on a unique violation rather than throwing: the
 * uniqueness of `provider_event_id` is what makes a replayed delivery harmless,
 * so a collision is the mechanism working, not an error.
 */
/**
 * The canonical form Prisma's `uuid()` mints and the only one our own ids take.
 * Deliberately stricter than Postgres, which also accepts braces and a
 * dashless form: a valid-but-unusual uuid is skipped rather than crashed on,
 * and skipping costs nothing more than a miss.
 */
const CANONICAL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    async compensateRefund(input) {
      // Delegated to the refund service so the pro-rata rule, the append-only
      // ledger and the conditional status write stay in one place — the same
      // path an administrator takes, with the same guards. All that differs is
      // who acted (V4.5-203).
      const { refundOrder } = await import('./refund-service.js');
      const { createPrismaRefundPorts } =
        await import('./prisma-refund-ports.js');

      const result = await refundOrder({
        actorUserId: SYSTEM_ACTOR_ID,
        kind: 'VOLUNTARY',
        note: 'Remboursement émis chez le fournisseur',
        orderId: input.orderId,
        ports: await createPrismaRefundPorts(),
      });
      return result.kind === 'REFUNDED';
    },
    async findOrder(input) {
      // Payment intent first: it is what a charge or a dispute carries, and
      // the only handle shared by the whole lifecycle. A session id resolves
      // the purchase and nothing after it (V4.5-195). It is empty until the
      // first completed delivery writes it, which is why the two handles below
      // have to work on their own for a first purchase.
      if (input.paymentIntentId) {
        const byIntent = await prisma.paymentOrder.findUnique({
          select: { id: true, status: true },
          where: { providerPaymentIntentId: input.paymentIntentId },
        });
        if (byIntent) return byIntent;
      }

      // Then our own id, which we put on the session as `client_reference_id`
      // and which comes back on every `checkout.session.*`. It is a primary
      // key, not a provider identifier; looking it up as one is what V4.5-202
      // fixes, and it meant no purchase could ever be fulfilled.
      //
      // Shape-checked first, and this guard is not defensive padding. `id` is
      // a Postgres `uuid` column, so asking it for a value that is not one is
      // not a miss but a driver error (P2023) — and `findOrder` runs before
      // the event is recorded, so it would surface as a 500 with no trace of
      // the delivery anywhere. Any signed session we did not create carries
      // whatever reference its author chose: `stripe trigger` with a
      // `--override`, a future provider change, a colleague's experiment.
      // Skipping the lookup lets those fall through to the session id, which
      // is a plain miss.
      if (input.orderId && CANONICAL_UUID.test(input.orderId)) {
        const byId = await prisma.paymentOrder.findUnique({
          select: { id: true, status: true },
          where: { id: input.orderId },
        });
        if (byId) return byId;
      }

      // Last, the session id we stored when we created the order. Reached only
      // when the reference above is absent or names nothing — a session
      // created outside this code path, say. A charge id lands here too and
      // matches nothing, which is correct: Stripe's id namespaces do not
      // overlap, so it cannot resolve to somebody else's order.
      if (!input.providerOrderId) return null;

      return prisma.paymentOrder.findUnique({
        select: { id: true, status: true },
        where: { providerOrderId: input.providerOrderId },
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
