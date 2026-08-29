import { createPaymentsApp } from './app';
import { signRevolutPayload } from '../../payments/revolut-webhook-signature';

const NOW = new Date('2026-08-29T12:00:00.000Z');
const PAYLOAD = JSON.stringify({
  event: 'ORDER_COMPLETED',
  event_id: 'evt_1',
  order_id: 'ord_1',
});

function post(app: ReturnType<typeof createPaymentsApp>, signature: string) {
  return app.request('/api/payments/revolut/webhook', {
    body: PAYLOAD,
    headers: {
      'content-type': 'application/json',
      'revolut-request-timestamp': String(NOW.getTime()),
      'revolut-signature': signature,
    },
    method: 'POST',
  });
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
    vi.stubEnv('LEARNX_REVOLUT_WEBHOOK_SECRET', 'wsk_secret');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepte une livraison signée', async () => {
    const signature = signRevolutPayload({
      payload: PAYLOAD,
      secret: 'wsk_secret',
      timestamp: NOW.getTime(),
    });
    const response = await post(build(), `v1=${signature}`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      outcome: 'APPLIED',
      received: true,
    });
  });

  it('refuse une signature invalide sans dire ce qui a échoué', async () => {
    // A caller learning which check failed learns how to pass it.
    const response = await post(build(), 'v1=deadbeef');
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ received: false });
  });

  it('répond 200 sur un rejeu pour que le fournisseur cesse de réessayer', async () => {
    const signature = signRevolutPayload({
      payload: PAYLOAD,
      secret: 'wsk_secret',
      timestamp: NOW.getTime(),
    });
    const response = await post(
      build({ recordEvent: vi.fn(async () => false) }),
      `v1=${signature}`,
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
    const signature = signRevolutPayload({
      payload: PAYLOAD,
      secret: 'wsk_secret',
      timestamp: NOW.getTime(),
    });
    const response = await post(build({ findOrder }), `v1=${signature}`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      outcome: 'DISABLED',
    });
    expect(findOrder).not.toHaveBeenCalled();
  });
});
