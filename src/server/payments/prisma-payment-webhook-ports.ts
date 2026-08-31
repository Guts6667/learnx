import type {
  PaymentOrderStatus,
  Prisma,
  PrismaClient,
} from '../../../generated/prisma/client.js';
import { ensureSystemActor } from '../system-actor.js';
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

/**
 * The transition, on whatever client it is handed (V4.5-199).
 *
 * Parameterised so it can run inside the same transaction as the event insert.
 * It used to open its own writes after that insert had already committed: when
 * it threw, the event row survived, and Stripe's retry was deduplicated away by
 * the very uniqueness that makes a replay harmless. Money taken, credits never
 * granted, nothing failing loudly.
 */
async function applyTransitionOn(
  client: Prisma.TransactionClient,
  input: {
    attributeCredits: boolean;
    orderId: string;
    paymentIntentId: string | null;
    status: PaymentOrderStatus;
  },
): Promise<void> {
  // Written on every transition that names one, not only on the grant:
  // `checkout.session.expired` carries no intent, `charge.dispute.created`
  // does, and an order first seen through a dispute still has to become
  // resolvable afterwards.
  const intent = input.paymentIntentId
    ? { providerPaymentIntentId: input.paymentIntentId }
    : {};

  if (!input.attributeCredits) {
    await client.paymentOrder.update({
      data: { ...intent, status: input.status },
      where: { id: input.orderId },
    });
    return;
  }

  const order = await client.paymentOrder.findUniqueOrThrow({
    select: { creditLotId: true, packKey: true, userId: true },
    where: { id: input.orderId },
  });
  // Already granted: the lot id on the order is the first of two guards,
  // and the ledger's own idempotency below is the second. Neither alone
  // would be enough under a concurrent redelivery.
  if (order.creditLotId) return;

  const pack = await client.creditPack.findUniqueOrThrow({
    select: { credits: true },
    where: { key: order.packKey },
  });
  const { PrismaCreditLedger } =
    await import('../credits/prisma-credit-ledger.js');
  // The ledger asks for a `PrismaClient` and uses only model access — it opens
  // no transaction of its own, which is what lets the grant join ours. The
  // cast is that fact, written down; a ledger that started calling
  // `$transaction` would need this reconsidered, not re-cast.
  const result = await new PrismaCreditLedger(
    client as unknown as PrismaClient,
  ).grant({
    amount: pack.credits,
    // Derived from the order, so a redelivery computes the same key and
    // the ledger returns the original lot instead of creating a second.
    idempotencyKey: `purchase:${input.orderId}`,
    provenance: 'PURCHASED',
    reference: { id: input.orderId, type: 'PAYMENT_ORDER' },
    userId: order.userId,
  });
  await client.paymentOrder.update({
    data: {
      ...intent,
      creditLotId: result.lotId,
      fulfilledAt: new Date(),
      status: input.status,
    },
    where: { id: input.orderId },
  });
}

/**
 * Le remboursement, sur la transaction qu'on lui donne (V4.5-211).
 *
 * Il s'exécutait après que l'événement eut été validé, dans une transaction à
 * lui : quand il échouait, la ligne d'événement survivait et la réémission de
 * Stripe était écartée comme doublon par l'unicité même qui rend un rejeu
 * inoffensif. Argent rendu chez le fournisseur, crédits jamais repris, et rien
 * qui échoue bruyamment — exactement le défaut que V4.5-199 avait corrigé pour
 * les autres transitions.
 *
 * Passe par le service de remboursement, donc par les mêmes gardes que le
 * chemin d'un administrateur : règle du prorata, grand livre en ajout seul,
 * écriture de statut conditionnelle. Seul l'acteur diffère.
 */
async function compensateRefundOn(
  client: Prisma.TransactionClient,
  orderId: string,
): Promise<boolean> {
  const { refundOrder } = await import('./refund-service.js');
  const { createPrismaRefundPorts } = await import('./prisma-refund-ports.js');

  // Créé à la première utilisation : une migration n'écrit pas dans `users`,
  // et un seed peut ne pas avoir tourné là où un remboursement atterrit.
  const actorUserId = await ensureSystemActor(client);

  const result = await refundOrder({
    actorUserId,
    kind: 'VOLUNTARY',
    note: 'Remboursement émis chez le fournisseur',
    orderId,
    ports: await createPrismaRefundPorts(client),
  });
  return result.kind === 'REFUNDED';
}

export async function createPrismaPaymentWebhookPorts(): Promise<WebhookPorts> {
  const { prisma } = await import('../prisma.js');
  const { Prisma } = await import('../../../generated/prisma/client.js');

  return {
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
    async recordDelivery(input) {
      try {
        // One transaction (V4.5-199). The insert is still what makes a replay
        // harmless, and the transition no longer outlives it: if applying
        // throws, the event row goes with it and Stripe's retry finds nothing
        // recorded, so it applies. Before, the row survived and deduplicated
        // the retry away.
        let compensated: boolean | undefined;
        await prisma.$transaction(async (transaction) => {
          await transaction.paymentEvent.create({
            data: {
              eventType: input.eventType,
              orderId: input.orderId,
              outcome: input.outcome,
              payload: input.payload as never,
              providerEventId: input.providerEventId,
            },
          });
          if (input.transition) {
            await applyTransitionOn(transaction, input.transition);
          }
          if (input.compensateRefundForOrderId) {
            compensated = await compensateRefundOn(
              transaction,
              input.compensateRefundForOrderId,
            );
          }
        });
        return { compensated, stored: true };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          return { stored: false };
        }
        throw error;
      }
    },
  };
}
