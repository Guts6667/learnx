import type { MiddlewareHandler } from 'hono';

import type { AuthEnvironment } from '../_lib/auth';
import { createCheckoutRoute } from './checkout-route';

const PACK = {
  active: true,
  credits: 500n,
  currency: 'EUR',
  key: 'starter',
  label: 'Démarrage',
  priceMinor: 900n,
};

function authenticated(): MiddlewareHandler<AuthEnvironment> {
  return async (context, next) => {
    context.set('user', {
      displayName: 'Rayan',
      email: 'rayan@example.com',
      id: '11111111-1111-4111-8111-111111111111',
      locale: 'fr',
      role: 'USER',
    });
    await next();
  };
}

function app(
  ports: Record<string, unknown> = {},
  options: { auth?: boolean } = {},
) {
  return createCheckoutRoute({
    ...(options.auth === false ? {} : { authentication: authenticated() }),
    ports: {
      correctionSuspended: vi.fn(async () => false),
      createProviderOrder: vi.fn(async () => ({
        checkoutUrl: 'https://pay.example/ord_1',
        providerOrderId: 'ord_1',
      })),
      listPacks: vi.fn(async () => [PACK]),
      newOrderId: vi.fn(() => 'order-1'),
      recordOrder: vi.fn(async () => ({ id: 'order-1' })),
      ...ports,
    } as never,
  });
}

function post(
  instance: ReturnType<typeof createCheckoutRoute>,
  body: unknown = { packKey: 'starter' },
) {
  return instance.request('/api/credits/checkout', {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
}

describe('POST /api/credits/checkout', () => {
  beforeEach(() => {
    vi.stubEnv('LEARNX_PAYMENTS_ENABLED', 'true');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exige une session', async () => {
    expect((await post(app({}, { auth: false }))).status).toBe(401);
  });

  it('ouvre un paiement et rend l’adresse hébergée', async () => {
    const response = await post(app());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      resource: {
        checkout: {
          correctionSuspended: false,
          orderId: 'order-1',
          url: 'https://pay.example/ord_1',
        },
      },
    });
  });

  it('vend en annonçant la suspension plutôt qu’en refusant', async () => {
    // Purchased credits keep their value when corrections return. Selling
    // while silent would be the promise we cannot keep.
    const response = await post(
      app({ correctionSuspended: vi.fn(async () => true) }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      resource: { checkout: { correctionSuspended: true } },
    });
  });

  it.each([
    ['inconnu', []],
    ['inactif', [{ ...PACK, active: false }]],
  ])('répond pareil pour un pack %s', async (_label, packs) => {
    // Identical answers, so watching the difference cannot enumerate keys.
    const response = await post(app({ listPacks: vi.fn(async () => packs) }));
    expect(response.status).toBe(404);
  });

  it('refuse un corps invalide', async () => {
    expect((await post(app(), { pack: 'starter' })).status).toBe(400);
  });

  it('répond indisponible quand l’encaissement est coupé', async () => {
    vi.stubEnv('LEARNX_PAYMENTS_ENABLED', 'false');
    const createProviderOrder = vi.fn();
    const response = await post(app({ createProviderOrder }));
    expect(response.status).toBe(503);
    expect(createProviderOrder).not.toHaveBeenCalled();
  });
});
