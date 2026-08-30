import {
  createStripeCheckoutSession,
  StripeCheckoutError,
} from './stripe-checkout-session';

function fakeFetch(
  response: { body?: unknown; ok?: boolean; status?: number } = {},
) {
  const calls: { body: URLSearchParams; headers: Headers; url: string }[] = [];
  const call = (async (url: string, init: RequestInit) => {
    calls.push({
      body: init.body as URLSearchParams,
      headers: new Headers(init.headers),
      url,
    });

    return {
      json: async () =>
        response.body ?? { id: 'cs_test_1', url: 'https://pay' },
      ok: response.ok ?? true,
      status: response.status ?? 200,
    } as Response;
  }) as unknown as typeof globalThis.fetch;

  return { call, calls };
}

function create(fetch: typeof globalThis.fetch) {
  return createStripeCheckoutSession({
    amountMinor: 1900n,
    appUrl: 'https://learn-x.app',
    currency: 'EUR',
    fetch,
    orderId: 'order-1',
    packLabel: 'Démarrage',
    secretKey: 'sk_test_x',
  });
}

describe('createStripeCheckoutSession', () => {
  it('rend la session comme identifiant de commande et l’adresse de paiement', async () => {
    const { call } = fakeFetch();

    // `provider_order_id` is the session id: what Stripe calls the order.
    await expect(create(call)).resolves.toEqual({
      checkoutUrl: 'https://pay',
      providerOrderId: 'cs_test_1',
    });
  });

  it('porte notre identifiant de commande dans la session', async () => {
    const { call, calls } = fakeFetch();

    await create(call);

    // Resolution does not depend on it — the session id comes back as
    // `provider_order_id` — but a dashboard nobody can match to an order by
    // eye is a dashboard nobody can reconcile with.
    expect(calls[0]?.body.get('client_reference_id')).toBe('order-1');
    expect(calls[0]?.body.get('payment_intent_data[metadata][orderId]')).toBe(
      'order-1',
    );
  });

  it('envoie le montant en unités mineures, jamais en flottant', async () => {
    const { call, calls } = fakeFetch();

    await create(call);

    // A float here would be a rounding error in someone's money.
    expect(calls[0]?.body.get('line_items[0][price_data][unit_amount]')).toBe(
      '1900',
    );
    expect(calls[0]?.body.get('line_items[0][price_data][currency]')).toBe(
      'eur',
    );
  });

  it('rend la requête rejouable sans créer deux paiements', async () => {
    const { call, calls } = fakeFetch();

    await create(call);

    // A retried request must return the same session rather than open a
    // second checkout for one purchase.
    expect(calls[0]?.headers.get('idempotency-key')).toBe('checkout:order-1');
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer sk_test_x');
  });

  it('refuse plutôt que de rendre une session sans adresse', async () => {
    const { call } = fakeFetch({ body: { id: 'cs_test_1' } });

    // A missing url would send the learner nowhere, which is worse than an
    // error they can be told about.
    await expect(create(call)).rejects.toThrow(StripeCheckoutError);
  });

  it('ne recopie pas le corps d’erreur de Stripe, seulement son code', async () => {
    const { call } = fakeFetch({
      body: {
        error: {
          code: 'amount_too_small',
          message: 'Amount must be at least 50 cents',
          param: 'line_items[0][price_data][unit_amount]',
        },
      },
      ok: false,
      status: 400,
    });

    // The body echoes what we sent, and what we sent is on its way to being
    // someone's payment.
    await expect(create(call)).rejects.toThrow(/400, amount_too_small/);
    await expect(create(call)).rejects.not.toThrow(/at least 50 cents/);
  });
});
