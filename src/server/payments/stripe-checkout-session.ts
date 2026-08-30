/**
 * Creating a Stripe Checkout Session (V4.5-195).
 *
 * Plain `fetch` against the REST API rather than the SDK: this makes one call
 * with eight fields, and the SDK would add a dependency to the server bundle
 * to save a form encoder. If a second call ever needs pagination, retries or
 * expandable objects, that is the moment to reconsider — not before.
 *
 * The order id is chosen by us and travels as `client_reference_id`, so the
 * session Stripe shows a human is the row we hold. Resolution does not depend
 * on it — the session id comes back as `provider_order_id` — but a dashboard
 * that cannot be matched to an order by eye is a dashboard nobody can
 * reconcile with.
 */

export type StripeCheckoutSession = {
  checkoutUrl: string;
  providerOrderId: string;
};

const ENDPOINT = 'https://api.stripe.com/v1/checkout/sessions';

export class StripeCheckoutError extends Error {
  public constructor(
    message: string,
    public readonly status: number | null,
  ) {
    super(message);
    this.name = 'StripeCheckoutError';
  }
}

export async function createStripeCheckoutSession(input: {
  amountMinor: bigint;
  appUrl: string;
  currency: string;
  fetch?: typeof globalThis.fetch;
  orderId: string;
  packLabel: string;
  secretKey: string;
}): Promise<StripeCheckoutSession> {
  const body = new URLSearchParams({
    cancel_url: `${input.appUrl}/credits?checkout=cancelled`,
    // Ours, not Stripe's. It is what makes a session recognisable in their
    // dashboard as one of our orders.
    client_reference_id: input.orderId,
    'line_items[0][price_data][currency]': input.currency.toLowerCase(),
    'line_items[0][price_data][product_data][name]': input.packLabel,
    // Minor units, as an integer string. A float here would be a rounding
    // error in someone's money.
    'line_items[0][price_data][unit_amount]': input.amountMinor.toString(),
    'line_items[0][quantity]': '1',
    mode: 'payment',
    // Carried onto the PaymentIntent, so a charge or a dispute in the
    // dashboard also names the order even before our own resolution runs.
    'payment_intent_data[metadata][orderId]': input.orderId,
    success_url: `${input.appUrl}/credits?checkout=success&order=${input.orderId}`,
  });

  const call = input.fetch ?? globalThis.fetch;
  const response = await call(ENDPOINT, {
    body,
    headers: {
      authorization: `Bearer ${input.secretKey}`,
      'content-type': 'application/x-www-form-urlencoded',
      // Same order, same session. Protects against a retried request
      // creating a second checkout for one purchase.
      'idempotency-key': `checkout:${input.orderId}`,
    },
    method: 'POST',
  });

  if (!response.ok) {
    // Stripe's own error code, never the whole body: the body echoes what we
    // sent, and what we sent is on its way to being someone's payment.
    const detail = await response
      .json()
      .then((value: unknown) => {
        const error = (value as { error?: { code?: string; type?: string } })
          .error;
        return error?.code ?? error?.type ?? 'unknown';
      })
      .catch(() => 'unreadable');

    throw new StripeCheckoutError(
      `Stripe refused the checkout session (${response.status}, ${detail}).`,
      response.status,
    );
  }

  const session = (await response.json()) as { id?: unknown; url?: unknown };
  if (typeof session.id !== 'string' || typeof session.url !== 'string') {
    // A session we cannot name is one we could never reconcile, and a missing
    // url would send the learner nowhere. Refuse rather than return a hole.
    throw new StripeCheckoutError(
      'Stripe returned a session without an id or a url.',
      response.status,
    );
  }

  return { checkoutUrl: session.url, providerOrderId: session.id };
}
