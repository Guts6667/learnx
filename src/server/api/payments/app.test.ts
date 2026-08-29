import { createPaymentsApp } from './app';
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
      applyTransition: vi.fn(async () => undefined),
      findOrder: vi.fn(async () => ({ id: 'order-1', status: 'PENDING' })),
      recordEvent: vi.fn(async () => true),
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
      build({ recordEvent: vi.fn(async () => false) }),
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
