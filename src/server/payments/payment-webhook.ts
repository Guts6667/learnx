import type { PaymentOrderStatus } from '../../../generated/prisma/client.js';
import {
  decideTransition,
  shouldAttributeCredits,
} from './payment-order-state.js';
import { STRIPE_EVENT_STATUS, readStripeEnvelope } from './stripe-webhook.js';
import { verifyStripeSignature } from './stripe-webhook-signature.js';

/**
 * The webhook receiver (ADR_004 §2, §3, §6).
 *
 * The only place credits are attributed for a purchase. The browser redirect
 * proves nothing — it can be closed, replayed or fabricated — so it shows a
 * waiting state and nothing else.
 */

export type WebhookResult =
  | { kind: 'APPLIED'; status: PaymentOrderStatus; attributed: boolean }
  | { kind: 'DUPLICATE' }
  | { kind: 'OUT_OF_ORDER' }
  | { kind: 'DISABLED' }
  | { kind: 'UNKNOWN_ORDER' }
  | { kind: 'REJECTED'; reason: string };

export interface WebhookPorts {
  /** Records the event and returns false when the id was already stored. */
  recordEvent(input: {
    eventType: string;
    orderId: string | null;
    outcome: 'APPLIED' | 'DUPLICATE' | 'OUT_OF_ORDER' | 'DISABLED';
    payload: unknown;
    providerEventId: string;
  }): Promise<boolean>;
  /**
   * Resolves an event to an order. The payment intent is tried first because
   * it is the handle a charge or a dispute carries; the reference and the
   * session id only ever appear on `checkout.session.*` (V4.5-195).
   */
  findOrder(input: {
    paymentIntentId: string | null;
    reference: string | null;
  }): Promise<{ id: string; status: PaymentOrderStatus } | null>;
  applyTransition(input: {
    attributeCredits: boolean;
    orderId: string;
    /**
     * Recorded the first time Stripe names it, so every later charge and
     * dispute can be resolved. Null on events that do not carry one.
     */
    paymentIntentId: string | null;
    status: PaymentOrderStatus;
  }): Promise<void>;
}

interface WebhookEnvelope {
  event: string;
  event_id: string;
  /** Either handle may be absent; the parser refuses only when both are. */
  order_id: string | null;
  payment_intent_id: string | null;
}

/**
 * Stripe's envelope, reshaped to the shape the receiver speaks.
 *
 * The receiver deliberately does not speak Stripe: its rules are about the
 * absence of provider guarantees, and keeping them in provider-neutral terms is
 * what made V4.5-184's switch cost a function rather than a rewrite.
 */
function stripeEnvelope(rawPayload: string): WebhookEnvelope | null {
  const parsed = readStripeEnvelope(rawPayload);
  if (!parsed) return null;
  return {
    event: parsed.eventType,
    event_id: parsed.eventId,
    order_id: parsed.orderReference,
    payment_intent_id: parsed.paymentIntentId,
  };
}

export async function handleRevolutWebhook(input: {
  configuration: { enabled: boolean; webhookSecret: string | null };
  now: Date;
  ports: WebhookPorts;
  rawPayload: string;
  signatureHeader: string | null;
}): Promise<WebhookResult> {
  // Disabled answers without doing anything rather than failing, so a delivery
  // sent during a shutdown does not pile up as errors on the provider's side
  // and trigger their retry storm.
  if (!input.configuration.enabled || !input.configuration.webhookSecret) {
    return { kind: 'DISABLED' };
  }

  // Verified before the payload is read. Parsing first — even to find an order
  // id for a log line — would make what we read attacker-controlled.
  const verdict = verifyStripeSignature({
    now: input.now,
    rawPayload: input.rawPayload,
    secret: input.configuration.webhookSecret,
    signatureHeader: input.signatureHeader,
  });
  if (!verdict.valid) return { kind: 'REJECTED', reason: verdict.reason };

  const envelope = stripeEnvelope(input.rawPayload);
  if (!envelope) return { kind: 'REJECTED', reason: 'MALFORMED_PAYLOAD' };

  const order = await input.ports.findOrder({
    paymentIntentId: envelope.payment_intent_id,
    reference: envelope.order_id,
  });
  const status = STRIPE_EVENT_STATUS[envelope.event];

  // Stored before anything is applied, so the record of what arrived exists
  // even for events we do not act on — that is what reconciliation reads.
  const stored = await input.ports.recordEvent({
    eventType: envelope.event,
    orderId: order?.id ?? null,
    outcome: !order || !status ? 'OUT_OF_ORDER' : 'APPLIED',
    payload: JSON.parse(input.rawPayload),
    providerEventId: envelope.event_id,
  });
  if (!stored) return { kind: 'DUPLICATE' };
  if (!order) return { kind: 'UNKNOWN_ORDER' };
  if (!status) return { kind: 'OUT_OF_ORDER' };

  const decision = decideTransition(order.status, status);
  if (decision.kind === 'OUT_OF_ORDER') return { kind: 'OUT_OF_ORDER' };

  const attributeCredits = shouldAttributeCredits({
    current: order.status,
    incoming: status,
  });
  // On PAID the grant and the FULFILLED transition are one act. An order that
  // reached PAID and stopped would be money taken with nothing given, waiting
  // on an event the provider has no reason to send.
  const applied = attributeCredits ? 'FULFILLED' : decision.status;
  await input.ports.applyTransition({
    attributeCredits,
    orderId: order.id,
    paymentIntentId: envelope.payment_intent_id,
    status: applied,
  });
  return { attributed: attributeCredits, kind: 'APPLIED', status: applied };
}
