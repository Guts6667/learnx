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
  userId: 'user-1',
};

describe('POST /api/admin/payments/:orderId/refund', () => {
  it('rembourse la part non consommée sans que l’appelant fixe le montant', async () => {
    // An amount in the request would be an amount someone could get wrong.
    const harness = build(fulfilled);
    const response = await post(harness, { note: 'demande du 29 août' });

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
    expect((await post(harness)).status).toBe(409);
    expect(harness.applied).toEqual([]);
  });

  it('répond introuvable sur une commande inconnue', async () => {
    expect((await post(build(null))).status).toBe(404);
  });

  it('refuse un appelant sans la capacité', async () => {
    const harness = build(fulfilled, 'USER');
    expect((await post(harness)).status).toBe(403);
    expect(harness.applied).toEqual([]);
  });

  it('refuse une note hors format', async () => {
    expect(
      (await post(build(fulfilled), { note: 'x'.repeat(501) })).status,
    ).toBe(400);
  });
});
