import type { PaymentOrderStatus } from '../../../generated/prisma/client.js';
import {
  decideTransition,
  shouldAttributeCredits,
} from './payment-order-state.js';
import { verifyRevolutSignature } from './revolut-webhook-signature.js';

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
  findOrder(providerOrderId: string): Promise<{
    id: string;
    status: PaymentOrderStatus;
  } | null>;
  applyTransition(input: {
    attributeCredits: boolean;
    orderId: string;
    status: PaymentOrderStatus;
  }): Promise<void>;
}

const EVENT_STATUS: Record<string, PaymentOrderStatus> = {
  ORDER_AUTHORISED: 'PENDING',
  ORDER_COMPLETED: 'PAID',
  // Tolerated rather than expected: if Revolut ever emits something like it,
  // it arrives after we already fulfilled and is ignored as out-of-order,
  // which is the right answer whether or not the event exists.
  ORDER_FULFILLED: 'FULFILLED',
  ORDER_FAILED: 'FAILED',
  ORDER_EXPIRED: 'EXPIRED',
  REFUND_INITIATED: 'REFUND_PENDING',
  REFUND_COMPLETED: 'REFUNDED',
  DISPUTE_OPENED: 'DISPUTED',
  DISPUTE_WON: 'DISPUTE_WON',
  DISPUTE_LOST: 'DISPUTE_LOST',
};

interface WebhookEnvelope {
  event: string;
  event_id: string;
  order_id: string;
}

function readEnvelope(rawPayload: string): WebhookEnvelope | null {
  try {
    const parsed: unknown = JSON.parse(rawPayload);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const {
      event,
      event_id: eventId,
      order_id: orderId,
    } = parsed as Record<string, unknown>;
    if (
      typeof event !== 'string' ||
      typeof eventId !== 'string' ||
      typeof orderId !== 'string'
    ) {
      return null;
    }
    return { event, event_id: eventId, order_id: orderId };
  } catch {
    return null;
  }
}

export async function handleRevolutWebhook(input: {
  configuration: { enabled: boolean; webhookSecret: string | null };
  now: Date;
  ports: WebhookPorts;
  rawPayload: string;
  signatureHeader: string | null;
  timestampHeader: string | null;
}): Promise<WebhookResult> {
  // Disabled answers without doing anything rather than failing, so a delivery
  // sent during a shutdown does not pile up as errors on the provider's side
  // and trigger their retry storm.
  if (!input.configuration.enabled || !input.configuration.webhookSecret) {
    return { kind: 'DISABLED' };
  }

  // Verified before the payload is read. Parsing first — even to find an order
  // id for a log line — would make what we read attacker-controlled.
  const verdict = verifyRevolutSignature({
    now: input.now,
    rawPayload: input.rawPayload,
    secret: input.configuration.webhookSecret,
    signatureHeader: input.signatureHeader,
    timestampHeader: input.timestampHeader,
  });
  if (!verdict.valid) return { kind: 'REJECTED', reason: verdict.reason };

  const envelope = readEnvelope(input.rawPayload);
  if (!envelope) return { kind: 'REJECTED', reason: 'MALFORMED_PAYLOAD' };

  const order = await input.ports.findOrder(envelope.order_id);
  const status = EVENT_STATUS[envelope.event];

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
    status: applied,
  });
  return { attributed: attributeCredits, kind: 'APPLIED', status: applied };
}
