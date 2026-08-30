import type { PaymentOrderStatus } from '../../../generated/prisma/client.js';

/**
 * Stripe's event vocabulary, mapped to the states of ADR_003 §6.3
 * (V4.5-184).
 *
 * `checkout.session.completed` is Stripe's last word on the money: it does not
 * emit anything about fulfilment, because whether a learner received credits is
 * a fact only LearnX holds. That is the same reading V4.5-161 corrected for
 * Revolut, and it is provider-independent — no processor can know what we did
 * with the payment.
 *
 * An unknown event is a tolerated no-op: it is recorded for reconciliation and
 * applied to nothing, so a vocabulary that grows on Stripe's side leaves orders
 * untouched rather than corrupting them.
 */
export const STRIPE_EVENT_STATUS: Record<string, PaymentOrderStatus> = {
  'checkout.session.completed': 'PAID',
  'checkout.session.expired': 'EXPIRED',
  'charge.refunded': 'REFUNDED',
  'charge.dispute.created': 'DISPUTED',
  'charge.dispute.closed': 'DISPUTED',
  'payment_intent.payment_failed': 'FAILED',
};

interface StripeEnvelope {
  /**
   * Present on charge and dispute objects, and on a completed session once
   * Stripe has created the intent. It is the only handle the whole lifecycle
   * shares: a session id appears on `checkout.session.*` and nowhere else, so
   * resolving a refund by session id cannot work (V4.5-195).
   */
  paymentIntentId: string | null;
  eventId: string;
  eventType: string;
  /**
   * Ours. `client_reference_id` is the `PaymentOrder.id` we put on the session
   * when we created it, so it is looked up by primary key — never as a
   * provider identifier (V4.5-202).
   */
  clientReferenceId: string | null;
  /**
   * Stripe's. The id of the object the event carries: a session id on
   * `checkout.session.*`, which is what `providerOrderId` holds, and a charge
   * id elsewhere, which matches nothing and is meant not to.
   */
  objectId: string | null;
  /**
   * What a charge was worth and how much of it came back (V4.5-203). Present
   * only on charge events; `null` everywhere else, and the caller must not read
   * absence as "nothing was refunded".
   */
  chargeAmountMinor: number | null;
  refundedAmountMinor: number | null;
}

/**
 * Stripe nests the order reference differently per event type. Read
 * defensively: an envelope we cannot read is refused rather than guessed at,
 * because guessing here would attach an event to the wrong order.
 */
export function readStripeEnvelope(rawPayload: string): StripeEnvelope | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { id, type, data } = parsed as Record<string, unknown>;
  if (typeof id !== 'string' || typeof type !== 'string') return null;

  const object = (data as { object?: unknown } | undefined)?.object;
  if (typeof object !== 'object' || object === null) return null;
  const record = object as Record<string, unknown>;

  // Three candidates, kept apart. They are read three different ways, and
  // until V4.5-202 the last two were collapsed into one field: our own order
  // id won, and the caller then looked it up as a *provider* identifier, so a
  // paid order was never found and no purchase could ever be fulfilled.
  // Collapsing also hides which handle matched, and a refund attaching to the
  // wrong order is the worst failure this file can produce.
  const paymentIntentId =
    typeof record.payment_intent === 'string' ? record.payment_intent : null;
  const clientReferenceId =
    typeof record.client_reference_id === 'string'
      ? record.client_reference_id
      : null;
  const objectId = typeof record.id === 'string' ? record.id : null;
  if (!paymentIntentId && !clientReferenceId && !objectId) return null;

  // Read as they arrive, compared by the caller. A partial refund carries the
  // same event name as a full one, and only these two numbers separate them.
  const chargeAmountMinor =
    typeof record.amount === 'number' ? record.amount : null;
  const refundedAmountMinor =
    typeof record.amount_refunded === 'number' ? record.amount_refunded : null;

  return {
    chargeAmountMinor,
    clientReferenceId,
    eventId: id,
    eventType: type,
    objectId,
    paymentIntentId,
    refundedAmountMinor,
  };
}
