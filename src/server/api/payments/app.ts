import { Hono } from 'hono';

import { handleRevolutWebhook } from '../../payments/payment-webhook.js';
import { readPaymentsConfiguration } from '../../payments/payments-configuration.js';
import { createPrismaPaymentWebhookPorts } from '../../payments/prisma-payment-webhook-ports.js';

/**
 * The Stripe webhook endpoint (ADR_004 §2).
 *
 * Unauthenticated by design: the caller is Stripe, not a session, and the
 * signature is the authentication. It is mounted outside the authenticated
 * router for that reason, and it is the only place a purchase is fulfilled.
 */

export interface PaymentWebhookLogEvent {
  event: 'payment_webhook';
  outcome: string;
  providerEventId: string | null;
  reason: string | null;
  status: number;
}

const defaultWrite = (event: PaymentWebhookLogEvent) => {
  // Same shape as `observability.ts`: one JSON object per line, so a Vercel
  // function log can be filtered on `event`.
  console.info(JSON.stringify(event));
};
export function createPaymentsApp(
  options: {
    now?: () => Date;
    ports?: Parameters<typeof handleRevolutWebhook>[0]['ports'];
    write?: (event: PaymentWebhookLogEvent) => void;
  } = {},
) {
  const app = new Hono();
  const write = options.write ?? defaultWrite;

  // One endpoint for both processors: the path names the feature, not the
  // vendor, so switching provider does not change a URL configured on their
  // side and forgotten on ours.
  app.post('/api/payments/webhook', async (context) => {
    // Read as bytes, never re-serialised: the signature covers what was sent,
    // and JSON.stringify of a parsed body changes key order and whitespace.
    const rawPayload = await context.req.text();
    const ports = options.ports ?? (await createPrismaPaymentWebhookPorts());
    const result = await handleRevolutWebhook({
      configuration: readPaymentsConfiguration(),
      now: options.now?.() ?? new Date(),
      ports,
      rawPayload,
      // Stripe carries its timestamp inside the signature header.
      signatureHeader: context.req.header('stripe-signature') ?? null,
    });

    // Withheld from the caller, kept for us. A caller learning which check
    // failed learns how to pass it; withholding the same fact from our own
    // logs protects nobody and leaves diagnosis to guesswork exactly when it
    // costs most — a delivery that answered 200 and stored nothing looks
    // identical, from the provider's dashboard, to one that was never sent.
    write({
      event: 'payment_webhook',
      outcome: result.kind,
      providerEventId:
        'providerEventId' in result ? result.providerEventId : null,
      reason: result.kind === 'REJECTED' ? result.reason : null,
      status: result.kind === 'REJECTED' ? 400 : 200,
    });

    // A rejected signature answers 400 and says nothing about why. Everything
    // accepted answers 200, including duplicates and out-of-order events, so
    // the provider stops retrying something we have already handled correctly.
    if (result.kind === 'REJECTED') {
      return context.json({ received: false }, 400);
    }
    return context.json({ received: true, outcome: result.kind });
  });

  return app;
}

export const paymentsApp = createPaymentsApp();
