import type { MiddlewareHandler } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import type { AuthEnvironment } from '../_lib/auth.js';
import type {
  CreditAdministrationService,
  CreditMemberDetail,
} from '../../credits/credit-administration.js';
import { createCreditsApp } from './app.js';

const userId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '22222222-2222-4222-8222-222222222222';

function authentication(
  role: 'ADMIN' | 'USER',
): MiddlewareHandler<AuthEnvironment> {
  return async (context, next) => {
    context.set('user', {
      displayName: 'Test',
      email: 'test@example.com',
      id: userId,
      role,
    });
    await next();
  };
}

function detail(id = userId): CreditMemberDetail {
  return {
    accountStatus: 'ACTIVE',
    displayName: 'Test',
    email: 'test@example.com',
    history: [],
    pendingIncreaseRequest: null,
    projection: {
      free: { available: 10n, consumed: 0n, expired: 0n, reserved: 0n },
      purchased: { available: 5n, consumed: 0n, expired: 0n, reserved: 0n },
      totalAvailable: 15n,
      totalReserved: 0n,
    },
    userId: id,
  };
}

function service(overrides: Partial<CreditAdministrationService> = {}) {
  return {
    adjustFreeAllocation: vi.fn().mockResolvedValue(detail(otherUserId)),
    createIncreaseRequest: vi.fn().mockResolvedValue({
      createdAt: new Date('2026-08-12T12:00:00Z'),
      id: '33333333-3333-4333-8333-333333333333',
      reason: 'Besoin exceptionnel documenté',
      status: 'PENDING',
    }),
    getMember: vi.fn().mockResolvedValue(detail(otherUserId)),
    getOwnCredits: vi.fn().mockResolvedValue(detail()),
    listMembers: vi.fn().mockResolvedValue({
      items: [detail(otherUserId)],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    }),
    listPolicies: vi.fn().mockResolvedValue({ allocation: [], limits: [] }),
    reviewIncreaseRequest: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } satisfies CreditAdministrationService;
}

describe('V4-008 credits API', () => {
  it('always scopes the learner projection to the authenticated user', async () => {
    const repository = service();
    const app = createCreditsApp({
      authentication: authentication('USER'),
      service: repository,
    });

    const response = await app.request('/api/credits');

    expect(response.status).toBe(200);
    expect(repository.getOwnCredits).toHaveBeenCalledWith(userId);
    await expect(response.json()).resolves.toMatchObject({
      credits: { projection: { free: { available: '10' } }, userId },
    });
  });

  it('rejects an ordinary user on every administration route', async () => {
    const app = createCreditsApp({
      authentication: authentication('USER'),
      service: service(),
    });

    expect((await app.request('/api/admin/credits/members')).status).toBe(403);
    expect(
      (await app.request(`/api/admin/credits/members/${otherUserId}`)).status,
    ).toBe(403);
  });

  it('creates only a free compensating adjustment with actor and reason', async () => {
    const repository = service();
    const app = createCreditsApp({
      authentication: authentication('ADMIN'),
      service: repository,
    });
    const compensated = '44444444-4444-4444-8444-444444444444';

    const response = await app.request(
      `/api/admin/credits/members/${otherUserId}/adjustments`,
      {
        body: JSON.stringify({
          amount: '-3',
          compensatesEntryId: compensated,
          idempotencyKey: 'adjustment:test:1',
          reason: 'Correction administrative documentée',
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );

    expect(response.status).toBe(200);
    expect(repository.adjustFreeAllocation).toHaveBeenCalledWith({
      actorUserId: userId,
      amount: -3n,
      compensatesEntryId: compensated,
      expiresAt: undefined,
      idempotencyKey: 'adjustment:test:1',
      provenance: 'FREE_ALLOCATION',
      reason: 'Correction administrative documentée',
      userId: otherUserId,
    });
  });

  it('requires an explicit prior ledger entry for every reduction', async () => {
    const repository = service();
    const app = createCreditsApp({
      authentication: authentication('ADMIN'),
      service: repository,
    });
    const response = await app.request(
      `/api/admin/credits/members/${otherUserId}/adjustments`,
      {
        body: JSON.stringify({
          amount: '-3',
          idempotencyKey: 'adjustment:test:2',
          reason: 'Correction administrative documentée',
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );

    expect(response.status).toBe(400);
    expect(repository.adjustFreeAllocation).not.toHaveBeenCalled();
  });

  it('creates an increase request for the authenticated learner', async () => {
    const repository = service();
    const app = createCreditsApp({
      authentication: authentication('USER'),
      service: repository,
    });

    const response = await app.request('/api/credits/increase-requests', {
      body: JSON.stringify({
        idempotencyKey: 'increase:test:1',
        reason: 'Besoin exceptionnel documenté',
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    expect(response.status).toBe(201);
    expect(repository.createIncreaseRequest).toHaveBeenCalledWith({
      idempotencyKey: 'increase:test:1',
      reason: 'Besoin exceptionnel documenté',
      userId,
    });
    await expect(response.json()).resolves.toMatchObject({
      request: {
        createdAt: '2026-08-12T12:00:00.000Z',
        status: 'PENDING',
      },
    });
  });

  it('serializes member pages and detailed history for administrators', async () => {
    const memberDetail = detail(otherUserId);
    memberDetail.history = [
      {
        actorUserId: userId,
        amount: 7n,
        createdAt: new Date('2026-08-12T12:30:00Z'),
        entryId: 'entry-1',
        provenance: 'FREE_ALLOCATION',
        reason: 'Allocation privée',
        referenceId: 'grant-1',
        referenceType: 'GRANT',
        type: 'GRANT',
      },
    ];
    memberDetail.pendingIncreaseRequest = {
      createdAt: new Date('2026-08-12T12:00:00Z'),
      id: '33333333-3333-4333-8333-333333333333',
      reason: 'Besoin exceptionnel documenté',
    };
    const repository = service({
      getMember: vi.fn().mockResolvedValue(memberDetail),
    });
    const app = createCreditsApp({
      authentication: authentication('ADMIN'),
      service: repository,
    });

    const pageResponse = await app.request(
      '/api/admin/credits/members?page=2&pageSize=10&search=learner',
    );
    expect(pageResponse.status).toBe(200);
    expect(repository.listMembers).toHaveBeenCalledWith({
      actorUserId: userId,
      page: 2,
      pageSize: 10,
      search: 'learner',
    });

    const memberResponse = await app.request(
      `/api/admin/credits/members/${otherUserId}`,
    );
    expect(memberResponse.status).toBe(200);
    await expect(memberResponse.json()).resolves.toMatchObject({
      member: {
        history: [{ amount: '7', createdAt: '2026-08-12T12:30:00.000Z' }],
        pendingIncreaseRequest: {
          createdAt: '2026-08-12T12:00:00.000Z',
        },
      },
    });
  });

  it('lists policies and records an administrative review', async () => {
    const repository = service({
      listPolicies: vi.fn().mockResolvedValue({
        allocation: [
          { id: 'allocation-1', key: 'friends', status: 'DRAFT', version: 1 },
        ],
        limits: [],
      }),
    });
    const app = createCreditsApp({
      authentication: authentication('ADMIN'),
      service: repository,
    });

    const policies = await app.request('/api/admin/credits/policies');
    expect(policies.status).toBe(200);
    await expect(policies.json()).resolves.toMatchObject({
      policies: { allocation: [{ key: 'friends' }] },
    });

    const requestId = '55555555-5555-4555-8555-555555555555';
    const review = await app.request(
      `/api/admin/credits/increase-requests/${requestId}/review`,
      {
        body: JSON.stringify({
          idempotencyKey: 'review:test:1',
          reviewReason: 'Demande vérifiée par administration',
          status: 'APPROVED',
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );
    expect(review.status).toBe(200);
    expect(repository.reviewIncreaseRequest).toHaveBeenCalledWith({
      actorUserId: userId,
      idempotencyKey: 'review:test:1',
      requestId,
      reviewReason: 'Demande vérifiée par administration',
      status: 'APPROVED',
    });
  });

  it('rejects malformed requests before invoking the service', async () => {
    const repository = service();
    const app = createCreditsApp({
      authentication: authentication('ADMIN'),
      service: repository,
    });

    expect(
      (
        await app.request('/api/credits/increase-requests', {
          body: JSON.stringify({ idempotencyKey: 'short', reason: 'court' }),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        })
      ).status,
    ).toBe(400);
    expect(
      (await app.request('/api/admin/credits/members?page=0')).status,
    ).toBe(400);
    expect(
      (await app.request('/api/admin/credits/members/not-a-uuid')).status,
    ).toBe(400);
    expect(
      (
        await app.request(
          '/api/admin/credits/increase-requests/not-a-uuid/review',
          {
            body: JSON.stringify({
              idempotencyKey: 'review:test:2',
              reviewReason: 'Demande vérifiée par administration',
              status: 'REJECTED',
            }),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
          },
        )
      ).status,
    ).toBe(400);
    expect(repository.createIncreaseRequest).not.toHaveBeenCalled();
  });

  it.each([
    ['IDEMPOTENCY_CONFLICT', 409],
    ['CREDIT_MEMBER_NOT_FOUND', 404],
    ['CREDIT_REQUEST_NOT_FOUND', 404],
    ['CREDIT_REQUEST_STATE_CONFLICT', 409],
    ['PURCHASED_CREDITS_PROTECTED', 403],
    ['unexpected', 409],
  ] as const)(
    'maps the %s service failure to HTTP %s',
    async (code, status) => {
      const app = createCreditsApp({
        authentication: authentication('USER'),
        service: service({
          getOwnCredits: vi.fn().mockRejectedValue(new Error(code)),
        }),
      });

      expect((await app.request('/api/credits')).status).toBe(status);
    },
  );

  it('returns not found when no credit account detail exists', async () => {
    const app = createCreditsApp({
      authentication: authentication('USER'),
      service: service({ getOwnCredits: vi.fn().mockResolvedValue(null) }),
    });

    expect((await app.request('/api/credits')).status).toBe(404);
  });
});

describe('V4.5-205 contrat de l’écran d’achat', () => {
  const catalogue = {
    purchasableByUser: vi.fn(async () => ({ entry: true })),
    listActivePacks: vi.fn(async () => [
      {
        credits: 10n,
        currency: 'EUR',
        key: 'starter',
        label: 'Découverte',
        labelEn: 'Starter',
        priceMinor: 1500n,
      },
    ]),
    listOwnOrders: vi.fn(async () => [
      {
        amountMinor: 1500n,
        createdAt: new Date('2026-08-30T17:49:00.000Z'),
        currency: 'EUR',
        fulfilledAt: new Date('2026-08-30T17:49:29.000Z'),
        id: 'c725ed24-0000-4000-8000-000000000001',
        packKey: 'starter',
        status: 'FULFILLED' as const,
      },
    ]),
  };

  it('dit si la vente est ouverte, en même temps que les packs', async () => {
    // Two different facts, needed together: without this the screen learns a
    // closed sale only from the 503 on a purchase it already invited.
    const app = createCreditsApp({
      authentication: authentication('USER'),
      catalogue,
      paymentsEnabled: () => false,
    });

    const response = await app.request('/api/credits/packs');

    await expect(response.json()).resolves.toMatchObject({
      paymentsEnabled: false,
    });
  });

  it('liste quand même les packs quand la vente est fermée', async () => {
    // So the screen can explain, instead of showing an empty page that looks
    // like a fault.
    const app = createCreditsApp({
      authentication: authentication('USER'),
      catalogue,
      paymentsEnabled: () => false,
    });

    const response = await app.request('/api/credits/packs');
    const body = (await response.json()) as { packs: unknown[] };

    expect(body.packs).toHaveLength(1);
  });

  it('liste les packs actifs, montants en chaînes décimales', async () => {
    // Money through a JSON number is a rounding bug waiting for a large enough
    // amount, so amounts cross the boundary as strings, as everywhere else.
    const app = createCreditsApp({
      authentication: authentication('USER'),
      catalogue,
    });

    const response = await app.request('/api/credits/packs');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      // Derived once on the server (V4.5-212): the screen may not do
      // arithmetic on `priceMinor`, so the rate, the bonus and the capacity
      // arrive already worked out.
      correctionQuoteCredits: '30',
      correctionReservationCredits: '41',
      packs: [
        {
          approximateCorrections: '0',
          bonusCredits: '-1490',
          credits: '10',
          creditsPerEuro: '0',
          currency: 'EUR',
          key: 'starter',
          label: 'Découverte',
          labelEn: 'Starter',
          // Faux ici : la fixture n'est pas le palier d'entrée. Servi quand
          // même, et non omis, pour que la carte n'ait jamais à décider ce que
          // veut dire un champ absent (V4.5-213).
          oncePerAccount: false,
          priceMinor: '1500',
          purchasable: true,
        },
      ],
      paymentsEnabled: false,
    });
  });

  it('ne rend que les commandes de l’appelant, et les demande par sa session', async () => {
    // The caller is the session, never a path or a query: there is no id to
    // tamper with.
    const app = createCreditsApp({
      authentication: authentication('USER'),
      catalogue,
    });

    const response = await app.request('/api/credits/orders');

    expect(response.status).toBe(200);
    expect(catalogue.listOwnOrders).toHaveBeenCalledWith(userId);
  });

  it('ne divulgue aucun identifiant Stripe ni donnée personnelle', async () => {
    // The order row carries the session id and the payment intent. Neither is
    // a purchase the learner needs to see, and a screen that never receives
    // them cannot leak them into a URL, a log or a support screenshot.
    const app = createCreditsApp({
      authentication: authentication('USER'),
      catalogue,
    });

    const body = await (await app.request('/api/credits/orders')).text();

    expect(body).not.toMatch(/cs_|pi_|provider/i);
    expect(JSON.parse(body).orders[0]).toEqual({
      amountMinor: '1500',
      createdAt: '2026-08-30T17:49:00.000Z',
      currency: 'EUR',
      fulfilledAt: '2026-08-30T17:49:29.000Z',
      id: 'c725ed24-0000-4000-8000-000000000001',
      packKey: 'starter',
      status: 'FULFILLED',
    });
  });

  it('rend une commande non honorée avec fulfilledAt nul', async () => {
    const app = createCreditsApp({
      authentication: authentication('USER'),
      catalogue: {
        ...catalogue,
        listOwnOrders: vi.fn(async () => [
          {
            amountMinor: 1500n,
            createdAt: new Date('2026-08-30T17:11:00.000Z'),
            currency: 'EUR',
            fulfilledAt: null,
            id: 'e0206f7f-0000-4000-8000-000000000001',
            packKey: 'starter',
            status: 'PENDING' as const,
          },
        ]),
      },
    });

    const response = await app.request('/api/credits/orders');

    await expect(response.json()).resolves.toMatchObject({
      orders: [{ fulfilledAt: null, status: 'PENDING' }],
    });
  });
});
