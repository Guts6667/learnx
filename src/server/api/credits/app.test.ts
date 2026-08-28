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

function authentication(role: 'ADMIN' | 'USER'): MiddlewareHandler<AuthEnvironment> {
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
        allocation: [{ id: 'allocation-1', key: 'friends', status: 'DRAFT', version: 1 }],
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
  ] as const)('maps the %s service failure to HTTP %s', async (code, status) => {
    const app = createCreditsApp({
      authentication: authentication('USER'),
      service: service({
        getOwnCredits: vi.fn().mockRejectedValue(new Error(code)),
      }),
    });

    expect((await app.request('/api/credits')).status).toBe(status);
  });

  it('returns not found when no credit account detail exists', async () => {
    const app = createCreditsApp({
      authentication: authentication('USER'),
      service: service({ getOwnCredits: vi.fn().mockResolvedValue(null) }),
    });

    expect((await app.request('/api/credits')).status).toBe(404);
  });
});
