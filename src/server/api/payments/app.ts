import { Hono } from 'hono';

import { handleRevolutWebhook } from '../../payments/payment-webhook.js';
import { readPaymentsConfiguration } from '../../payments/payments-configuration.js';
import { createPrismaPaymentWebhookPorts } from '../../payments/prisma-payment-webhook-ports.js';

/**
 * The Revolut webhook endpoint (ADR_004 §2).
 *
 * Unauthenticated by design: the caller is Revolut, not a session, and the
 * signature is the authentication. It is mounted outside the authenticated
 * router for that reason, and it is the only place a purchase is fulfilled.
 */
export function createPaymentsApp(
  options: {
    now?: () => Date;
    ports?: Parameters<typeof handleRevolutWebhook>[0]['ports'];
  } = {},
) {
  const app = new Hono();

  app.post('/api/payments/revolut/webhook', async (context) => {
    // Read as bytes, never re-serialised: the signature covers what was sent,
    // and JSON.stringify of a parsed body changes key order and whitespace.
    const rawPayload = await context.req.text();
    const ports = options.ports ?? (await createPrismaPaymentWebhookPorts());
    const result = await handleRevolutWebhook({
      configuration: readPaymentsConfiguration(),
      now: options.now?.() ?? new Date(),
      ports,
      rawPayload,
      signatureHeader: context.req.header('revolut-signature') ?? null,
      timestampHeader: context.req.header('revolut-request-timestamp') ?? null,
    });

    // A rejected signature answers 400 and says nothing about why: a caller
    // learning which check failed learns how to pass it. Everything accepted
    // answers 200, including duplicates and out-of-order events, so the
    // provider stops retrying something we have already handled correctly.
    if (result.kind === 'REJECTED') {
      return context.json({ received: false }, 400);
    }
    return context.json({ received: true, outcome: result.kind });
  });

  return app;
}

export const paymentsApp = createPaymentsApp();
