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

/**
 * `providerEventId` is present only once the signature has been verified.
 * A rejected delivery deliberately carries none: the id would come from a
 * payload nobody has authenticated, and reading it — even to write a log line
 * — is how an unverified body starts influencing the system. Correlate a
 * rejection with the provider's dashboard by time and request id instead.
 */
export type WebhookResult =
  | {
      attributed: boolean;
      kind: 'APPLIED';
      providerEventId: string;
      status: PaymentOrderStatus;
    }
  | { kind: 'DISABLED' }
  | { kind: 'DUPLICATE'; providerEventId: string }
  | { kind: 'OUT_OF_ORDER'; providerEventId: string }
  | { kind: 'REJECTED'; reason: string }
  | { kind: 'UNKNOWN_EVENT'; providerEventId: string }
  | { kind: 'UNKNOWN_ORDER'; providerEventId: string };

/**
 * What can actually be written to `payment_events.outcome`, which is narrower
 * than the database enum. `DUPLICATE` and `DISABLED` exist in the type since
 * V4.5-160 but no row can carry them: a duplicate is never inserted at all —
 * that is what returning false means — and a disabled receiver answers before
 * any port is called. Listing them here would tell a reader that such rows
 * exist to be queried.
 */
type StoredWebhookOutcome =
  'APPLIED' | 'OUT_OF_ORDER' | 'UNKNOWN_EVENT' | 'UNKNOWN_ORDER';

export interface WebhookPorts {
  /** Records the event and returns false when the id was already stored. */
  recordEvent(input: {
    eventType: string;
    orderId: string | null;
    outcome: StoredWebhookOutcome;
    payload: unknown;
    providerEventId: string;
  }): Promise<boolean>;
  /**
   * Resolves an event to an order. The payment intent is tried first because
   * it is the handle a charge or a dispute carries; the reference and the
   * session id only ever appear on `checkout.session.*` (V4.5-195).
   */
  findOrder(input: {
    /** Ours: a `PaymentOrder.id`, looked up by primary key. */
    orderId: string | null;
    paymentIntentId: string | null;
    /** Theirs: what `providerOrderId` holds, a Checkout session id. */
    providerOrderId: string | null;
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
  /** Ours, carried back by the provider. Any handle may be absent; the
   * parser refuses only when all three are. */
  order_id: string | null;
  payment_intent_id: string | null;
  /** Theirs, for the object this event is about. */
  provider_order_id: string | null;
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
    order_id: parsed.clientReferenceId,
    payment_intent_id: parsed.paymentIntentId,
    provider_order_id: parsed.objectId,
  };
}

type ResolvedEvent =
  | { outcome: 'OUT_OF_ORDER' | 'UNKNOWN_EVENT' | 'UNKNOWN_ORDER' }
  | {
      decided: PaymentOrderStatus;
      incoming: PaymentOrderStatus;
      order: { id: string; status: PaymentOrderStatus };
      outcome: 'APPLIED';
    };

/**
 * What a verified delivery amounts to, worked out from pure inputs so that it
 * can be recorded before it is acted on.
 *
 * The three refusals are kept apart because only one of them is benign. An
 * order we cannot resolve may be another environment's traffic reaching this
 * one. An event name absent from `STRIPE_EVENT_STATUS` means the mapping table
 * is wrong, and orders will sit unfulfilled with the money taken — the single
 * failure this receiver cannot detect for itself, which is why it must not be
 * spelled like the harmless one. A genuine out-of-order delivery is neither: it
 * is the case the state machine exists to absorb.
 */
function resolveEvent(
  order: { id: string; status: PaymentOrderStatus } | null,
  incoming: PaymentOrderStatus | undefined,
): ResolvedEvent {
  if (!order) return { outcome: 'UNKNOWN_ORDER' };
  if (!incoming) return { outcome: 'UNKNOWN_EVENT' };

  const decision = decideTransition(order.status, incoming);
  return decision.kind === 'OUT_OF_ORDER'
    ? { outcome: 'OUT_OF_ORDER' }
    : { decided: decision.status, incoming, order, outcome: 'APPLIED' };
}

export async function handlePaymentWebhook(input: {
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
    orderId: envelope.order_id,
    paymentIntentId: envelope.payment_intent_id,
    providerOrderId: envelope.provider_order_id,
  });
  const status = STRIPE_EVENT_STATUS[envelope.event];

  // Stored before anything is applied, so the record of what arrived exists
  // even for events we do not act on — that is what reconciliation reads.
  // Decided before anything is written (V4.5-198). `decideTransition` is pure,
  // so moving it above the insert changes no behaviour and makes the stored
  // outcome what happened rather than what we expected to happen. Recording
  // first, it said APPLIED for a transition it then refused — an audit trail
  // asserting an attribution that never occurred — and folded an unrecognised
  // event name into OUT_OF_ORDER, which reads as a harmless late duplicate and
  // hid the one failure this receiver cannot detect on its own.
  const resolution = resolveEvent(order, status);

  // Still the first write, and still before anything is applied: the insert is
  // what makes a replay harmless, and the record of what arrived must exist
  // even for events we act on in no way.
  const stored = await input.ports.recordEvent({
    eventType: envelope.event,
    orderId: order?.id ?? null,
    outcome: resolution.outcome,
    payload: JSON.parse(input.rawPayload),
    providerEventId: envelope.event_id,
  });
  const providerEventId = envelope.event_id;
  if (!stored) return { kind: 'DUPLICATE', providerEventId };
  if (resolution.outcome !== 'APPLIED') {
    return { kind: resolution.outcome, providerEventId };
  }

  const attributeCredits = shouldAttributeCredits({
    current: resolution.order.status,
    incoming: resolution.incoming,
  });
  // On PAID the grant and the FULFILLED transition are one act. An order that
  // reached PAID and stopped would be money taken with nothing given, waiting
  // on an event the provider has no reason to send.
  const applied = attributeCredits ? 'FULFILLED' : resolution.decided;
  await input.ports.applyTransition({
    attributeCredits,
    orderId: resolution.order.id,
    paymentIntentId: envelope.payment_intent_id,
    status: applied,
  });
  return {
    attributed: attributeCredits,
    kind: 'APPLIED',
    providerEventId,
    status: applied,
  };
}
