import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';

import type { AuthEnvironment } from '../_lib/auth';
import { ApiError, toApiErrorBody } from '../_lib/errors';
import { registerPaymentRefundRoutes } from './payment-refund-routes';

const ORDER_ID = 'b1a4c0d2-3f77-4c0e-9c6b-2f9a1d4e5b60';

function authentication(
  role: 'ADMIN' | 'USER' = 'ADMIN',
): MiddlewareHandler<AuthEnvironment> {
  return async (context, next) => {
    context.set('user', {
      displayName: 'Admin',
      email: 'admin@example.com',
      id: '11111111-1111-4111-8111-111111111111',
      locale: 'fr',
      role,
    });
    await next();
  };
}

function buildRead(readPorts: unknown, role: 'ADMIN' | 'USER' = 'ADMIN') {
  const app = new Hono<AuthEnvironment>();
  app.use('*', authentication(role));
  app.onError((error, context) => {
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError('INTERNAL_ERROR', 'Unexpected.', 500);
    return context.json(toApiErrorBody(apiError), apiError.status);
  });
  registerPaymentRefundRoutes(app, { readPorts: readPorts as never });
  return app;
}

function build(order: unknown, role: 'ADMIN' | 'USER' = 'ADMIN') {
  const applied: Record<string, unknown>[] = [];
  const app = new Hono<AuthEnvironment>();
  app.use('*', authentication(role));
  app.onError((error, context) => {
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError('INTERNAL_ERROR', 'Unexpected.', 500);
    return context.json(toApiErrorBody(apiError), apiError.status);
  });
  registerPaymentRefundRoutes(app, {
    ports: {
      applyRefund: vi.fn(async (input: Record<string, unknown>) => {
        applied.push(input);
        return true;
      }),
      loadOrder: vi.fn(async () => order),
    } as never,
  });
  return { app, applied };
}

function post(harness: ReturnType<typeof build>, body: unknown = {}) {
  return harness.app.request(`/api/admin/payments/${ORDER_ID}/refund`, {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
}

const fulfilled = {
  creditLotId: 'lot-1',
  packCredits: 500n,
  packPriceMinor: 900n,
  remainingOnLot: 250n,
  status: 'FULFILLED',
  userId: 'user-1',
};

/** What the preview showed. Every request must carry it back. */
const FRESH = { expectedRemainingOnLot: '250' };

describe('POST /api/admin/payments/:orderId/refund', () => {
  it('rembourse la part non consommée sans que l’appelant fixe le montant', async () => {
    // An amount in the request would be an amount someone could get wrong.
    const harness = build(fulfilled);
    const response = await post(harness, {
      ...FRESH,
      note: 'demande du 29 août',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      resource: {
        refund: {
          reclaimedCredits: '250',
          refundedMinor: '450',
          writtenOffCredits: '0',
        },
      },
    });
    expect(harness.applied[0]).toMatchObject({ note: 'demande du 29 août' });
  });

  it('refuse une commande jamais honorée', async () => {
    const harness = build({ ...fulfilled, creditLotId: null });
    const response = await post(harness, FRESH);

    expect(response.status).toBe(409);
    // One code per refusal: the screen has to say why, and each reason calls
    // for a different sentence and a different next step.
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'PAYMENT_ORDER_NOT_FULFILLED' },
    });
    expect(harness.applied).toEqual([]);
  });

  it('refuse une commande déjà remboursée', async () => {
    const harness = build({ ...fulfilled, status: 'REFUNDED' });
    const response = await post(harness, FRESH);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'PAYMENT_ALREADY_REFUNDED' },
    });
    expect(harness.applied).toEqual([]);
  });

  it('refuse une commande en litige', async () => {
    const harness = build({ ...fulfilled, status: 'DISPUTED' });
    const response = await post(harness, FRESH);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'PAYMENT_UNDER_DISPUTE' },
    });
  });

  it('refuse quand le solde a bougé depuis la prévisualisation', async () => {
    const harness = build(fulfilled);
    const response = await post(harness, { expectedRemainingOnLot: '400' });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'PAYMENT_REFUND_PREVIEW_STALE' },
    });
    expect(harness.applied).toEqual([]);
  });

  it('exige le solde annoncé', async () => {
    // Without it the two-step confirmation would approve a figure that need
    // not be the one that leaves.
    const harness = build(fulfilled);

    expect((await post(harness, { note: 'sans solde' })).status).toBe(400);
    expect(harness.applied).toEqual([]);
  });

  it('répond introuvable sur une commande inconnue', async () => {
    expect((await post(build(null), FRESH)).status).toBe(404);
  });

  it('refuse un appelant sans la capacité', async () => {
    const harness = build(fulfilled, 'USER');
    expect((await post(harness, FRESH)).status).toBe(403);
    expect(harness.applied).toEqual([]);
  });

  it('refuse une note hors format', async () => {
    expect(
      (await post(build(fulfilled), { ...FRESH, note: 'x'.repeat(501) }))
        .status,
    ).toBe(400);
  });
});

const previewSource = {
  amountMinor: 900n,
  createdAt: new Date('2026-08-29T10:00:00.000Z'),
  creditLotId: 'lot-1',
  currency: 'EUR',
  fulfilledAt: new Date('2026-08-29T10:00:05.000Z'),
  id: ORDER_ID,
  learner: {
    accountStatus: 'ACTIVE',
    displayName: 'Camille',
    email: 'camille@example.com',
    userId: '22222222-2222-4222-8222-222222222222',
  },
  packCredits: 500n,
  packKey: 'starter-500',
  packPriceMinor: 900n,
  refundedCredits: 0n,
  remainingOnLot: 250n,
  status: 'FULFILLED',
  writtenOffCredits: 0n,
};

describe('GET /api/admin/payments/:orderId/refund-preview', () => {
  it('rend chaque montant en chaîne, jamais en nombre', async () => {
    const app = buildRead({
      listOrders: vi.fn(),
      loadPreview: vi.fn(async () => previewSource),
    });

    const response = await app.request(
      `/api/admin/payments/${ORDER_ID}/refund-preview`,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      resource: { computation: Record<string, unknown> };
    };
    // A BigInt does not survive a JavaScript number, and a rounded amount is a
    // wrong amount.
    for (const value of Object.values(body.resource.computation)) {
      expect(typeof value).toBe('string');
    }
    expect(body.resource.computation).toMatchObject({
      expectedRemainingOnLot: '250',
      refundedMinor: '450',
    });
  });

  it('répond 200 avec le motif quand le remboursement est impossible', async () => {
    const app = buildRead({
      listOrders: vi.fn(),
      loadPreview: vi.fn(async () => ({
        ...previewSource,
        remainingOnLot: 0n,
        status: 'REFUNDED',
      })),
    });

    const response = await app.request(
      `/api/admin/payments/${ORDER_ID}/refund-preview`,
    );

    // "You may not refund this, and here is why" is an answer about a resource
    // that exists, not an error about one that does not.
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      resource: {
        computation: null,
        refundable: false,
        refusal: { code: 'ALREADY_REFUNDED' },
      },
    });
  });

  it('répond introuvable sur une commande inconnue', async () => {
    const app = buildRead({
      listOrders: vi.fn(),
      loadPreview: vi.fn(async () => null),
    });

    expect(
      (await app.request(`/api/admin/payments/${ORDER_ID}/refund-preview`))
        .status,
    ).toBe(404);
  });

  it('refuse un appelant sans la capacité', async () => {
    const loadPreview = vi.fn(async () => previewSource);
    const app = buildRead({ listOrders: vi.fn(), loadPreview }, 'USER');

    expect(
      (await app.request(`/api/admin/payments/${ORDER_ID}/refund-preview`))
        .status,
    ).toBe(403);
    // Refused before reading anything about the learner.
    expect(loadPreview).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/credits/members/:userId/orders', () => {
  const USER_ID = '22222222-2222-4222-8222-222222222222';

  it('pagine par offset comme la liste des membres', async () => {
    const listOrders = vi.fn(async () => ({
      rows: [
        {
          amountMinor: 900n,
          createdAt: new Date('2026-08-29T10:00:00.000Z'),
          currency: 'EUR',
          fulfilledAt: null,
          id: ORDER_ID,
          packKey: 'starter-500',
          refundedCredits: 0n,
          status: 'PAID',
          writtenOffCredits: 0n,
        },
      ],
      total: 42,
    }));
    const app = buildRead({ listOrders, loadPreview: vi.fn() });

    const response = await app.request(
      `/api/admin/credits/members/${USER_ID}/orders?page=2&pageSize=10`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      page: {
        items: [{ amountMinor: '900', fulfilledAt: null, status: 'PAID' }],
        page: 2,
        pageSize: 10,
        total: 42,
        totalPages: 5,
      },
    });
    expect(listOrders).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      userId: USER_ID,
    });
  });

  it('refuse une pagination hors bornes plutôt que de la corriger en silence', async () => {
    const listOrders = vi.fn();
    const app = buildRead({ listOrders, loadPreview: vi.fn() });

    expect(
      (
        await app.request(
          `/api/admin/credits/members/${USER_ID}/orders?pageSize=500`,
        )
      ).status,
    ).toBe(400);
    expect(listOrders).not.toHaveBeenCalled();
  });
});
