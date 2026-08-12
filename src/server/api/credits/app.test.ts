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
});
