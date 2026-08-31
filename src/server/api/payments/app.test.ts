import { createPaymentsApp, type PaymentWebhookLogEvent } from './app';
import { signStripePayload } from '../../payments/stripe-webhook-signature';

const NOW = new Date('2026-08-29T12:00:00.000Z');
const PAYLOAD = JSON.stringify({
  data: { object: { client_reference_id: 'ord_1' } },
  id: 'evt_1',
  type: 'checkout.session.completed',
});
const SECONDS = Math.floor(NOW.getTime() / 1_000);

function post(app: ReturnType<typeof createPaymentsApp>, signature: string) {
  return app.request('/api/payments/webhook', {
    body: PAYLOAD,
    headers: {
      'content-type': 'application/json',
      'stripe-signature': signature,
    },
    method: 'POST',
  });
}

function stripeHeader(secret = 'wsk_secret') {
  return `t=${SECONDS},v1=${signStripePayload({
    payload: PAYLOAD,
    secret,
    timestampSeconds: SECONDS,
  })}`;
}

function build(ports: Record<string, unknown> = {}) {
  return createPaymentsApp({
    now: () => NOW,
    ports: {
      findOrder: vi.fn(async () => ({ id: 'order-1', status: 'PENDING' })),
      recordDelivery: vi.fn(async () => ({ stored: true })),
      ...ports,
    } as never,
  });
}

describe('webhook de paiement', () => {
  beforeEach(() => {
    vi.stubEnv('LEARNX_PAYMENTS_ENABLED', 'true');
    vi.stubEnv('STRIPE_TEST_WEBHOOK_SECRET', 'wsk_secret');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepte une livraison signée', async () => {
    const response = await post(build(), stripeHeader());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      outcome: 'APPLIED',
      received: true,
    });
  });

  it('refuse une signature invalide sans dire ce qui a échoué', async () => {
    // A caller learning which check failed learns how to pass it.
    const response = await post(build(), `t=${SECONDS},v1=deadbeef`);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ received: false });
  });

  it('répond 200 sur un rejeu pour que le fournisseur cesse de réessayer', async () => {
    const response = await post(
      build({ recordDelivery: vi.fn(async () => ({ stored: false })) }),
      stripeHeader(),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      outcome: 'DUPLICATE',
      received: true,
    });
  });

  it('ne traite rien quand l’encaissement est coupé', async () => {
    vi.stubEnv('LEARNX_PAYMENTS_ENABLED', 'false');
    const findOrder = vi.fn();
    const response = await post(build({ findOrder }), stripeHeader());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      outcome: 'DISABLED',
    });
    expect(findOrder).not.toHaveBeenCalled();
  });
});

describe('journal du récepteur (V4.5-194)', () => {
  beforeEach(() => {
    vi.stubEnv('LEARNX_PAYMENTS_ENABLED', 'true');
    vi.stubEnv('STRIPE_TEST_WEBHOOK_SECRET', 'wsk_secret');
  });

  function buildLogging(ports: Record<string, unknown> = {}) {
    const written: PaymentWebhookLogEvent[] = [];
    const app = createPaymentsApp({
      now: () => NOW,
      ports: {
        findOrder: vi.fn(async () => ({ id: 'order-1', status: 'PENDING' })),
        recordDelivery: vi.fn(async () => ({ stored: true })),
        ...ports,
      } as never,
      write: (event) => written.push(event),
    });

    return { app, written };
  }

  it('écrit la raison d’un rejet côté serveur, jamais dans la réponse', async () => {
    const { app, written } = buildLogging();

    const response = await post(app, `t=${SECONDS},v1=deadbeef`);

    expect(response.status).toBe(400);
    const body = await response.text();

    // A caller learning which check failed learns how to pass it, so the
    // reason must not appear in what leaves the server.
    expect(JSON.parse(body)).toEqual({ received: false });
    expect(body).not.toContain(written[0]?.reason ?? 'SIGNATURE');

    // Withholding the same fact from our own logs protects nobody. A delivery
    // that answered 400 looks, from the provider's dashboard, exactly like one
    // whose secret was wrong and one whose body was malformed.
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({
      event: 'payment_webhook',
      outcome: 'REJECTED',
      status: 400,
    });
    expect(written[0]?.reason).toBeTruthy();
  });

  it('ne nomme jamais l’événement d’une livraison non vérifiée', async () => {
    const { app, written } = buildLogging();

    await post(app, `t=${SECONDS},v1=deadbeef`);

    // The payload carries `evt_1`, and we do not read it. An id taken from a
    // body nobody authenticated is an unverified body influencing the system,
    // even when the influence is only a log line.
    expect(written[0]?.providerEventId).toBeNull();
  });

  it('nomme l’événement dès que la signature est vérifiée', async () => {
    const { app, written } = buildLogging();

    const response = await post(app, stripeHeader());

    expect(response.status).toBe(200);
    expect(written[0]).toMatchObject({
      outcome: 'APPLIED',
      providerEventId: 'evt_1',
      reason: null,
      status: 200,
    });
  });

  it('distingue une commande inconnue d’un rejet', async () => {
    const { app, written } = buildLogging({
      findOrder: vi.fn(async () => null),
    });

    await post(app, stripeHeader());

    // Both are "nothing happened" from outside; only the log separates them.
    expect(written[0]).toMatchObject({
      outcome: 'UNKNOWN_ORDER',
      providerEventId: 'evt_1',
      status: 200,
    });
  });
});
