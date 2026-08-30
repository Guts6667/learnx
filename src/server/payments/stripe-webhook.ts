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
  orderReference: string | null;
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

  // Both candidates are returned rather than collapsed into one, because the
  // caller resolves them in a deliberate order: the payment intent first,
  // since it is what a charge or a dispute carries, then the reference we put
  // on the session, then the session's own id. Collapsing them here would hide
  // which one matched, and a refund attaching to the wrong order is the worst
  // failure this file can produce.
  const paymentIntentId =
    typeof record.payment_intent === 'string' ? record.payment_intent : null;
  const reference =
    typeof record.client_reference_id === 'string'
      ? record.client_reference_id
      : typeof record.id === 'string'
        ? record.id
        : null;
  if (!paymentIntentId && !reference) return null;

  return {
    eventId: id,
    eventType: type,
    orderReference: reference,
    paymentIntentId,
  };
}
