import {
  Role,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => ({
  listReviewRequests: vi.fn(),
  toReviewItem: vi.fn((request: { id: string }) => ({ id: request.id })),
}));

vi.mock('./access-request-review-query.js', () => ({
  listReviewRequests: query.listReviewRequests,
  reviewInclude: {},
  toReviewItem: query.toReviewItem,
}));

import { createPrismaAccessRequestReviewRepository } from './access-request-review-repository.js';

const createdAt = new Date('2026-08-28T12:00:00.000Z');
const invitation = {
  createdAt,
  expiresAt: new Date('2026-08-29T12:00:00.000Z'),
  id: 'invitation-2',
  tokenHash: 'hash',
};

function harness() {
  const transaction = {
    accessInvitation: {
      create: vi.fn().mockResolvedValue(undefined),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    accessRequest: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'updated' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditEvent: { upsert: vi.fn().mockResolvedValue(undefined) },
  };
  const client = {
    $transaction: vi.fn(
      async (operation: (value: typeof transaction) => unknown) =>
        operation(transaction),
    ),
    accessInvitation: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  return {
    client,
    repository: createPrismaAccessRequestReviewRepository(
      client as unknown as PrismaClient,
    ),
    transaction,
  };
}

function request(
  status: 'APPROVED' | 'PENDING_APPROVAL' | 'PENDING_EMAIL' | 'REJECTED',
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 'request-1',
    invitations: [{ assignedRole: Role.USER }],
    rejectionReason: null,
    status,
    version: 2,
    ...overrides,
  };
}

describe('PrismaAccessRequestReviewRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([null, request('PENDING_EMAIL')])(
    'reports a missing non-reviewable approval request',
    async (existing) => {
      const { repository, transaction } = harness();
      transaction.accessRequest.findUnique.mockResolvedValue(existing);
      await expect(
        repository.approve(
          'actor',
          'request-1',
          { expectedVersion: 2, role: Role.USER },
          invitation,
        ),
      ).resolves.toEqual({ kind: 'NOT_FOUND' });
    },
  );

  it('distinguishes idempotent and conflicting approvals', async () => {
    const { repository, transaction } = harness();
    transaction.accessRequest.findUnique
      .mockResolvedValueOnce(request('APPROVED'))
      .mockResolvedValueOnce(
        request('APPROVED', { invitations: [{ assignedRole: Role.ADMIN }] }),
      );
    await expect(
      repository.approve(
        'actor',
        'request-1',
        { expectedVersion: 2, role: Role.USER },
        invitation,
      ),
    ).resolves.toEqual({ kind: 'IDEMPOTENT', request: { id: 'request-1' } });
    await expect(
      repository.approve(
        'actor',
        'request-1',
        { expectedVersion: 2, role: Role.USER },
        invitation,
      ),
    ).resolves.toEqual({ kind: 'CONFLICT' });
  });

  it.each([request('REJECTED'), request('PENDING_APPROVAL', { version: 3 })])(
    'rejects an approval transition with stale state',
    async (existing) => {
      const { repository, transaction } = harness();
      transaction.accessRequest.findUnique.mockResolvedValue(existing);
      await expect(
        repository.approve(
          'actor',
          'request-1',
          { expectedVersion: 2, role: Role.USER },
          invitation,
        ),
      ).resolves.toEqual({ kind: 'CONFLICT' });
    },
  );

  it('applies an approval and writes its three audit records', async () => {
    const { repository, transaction } = harness();
    transaction.accessRequest.findUnique.mockResolvedValue(
      request('PENDING_APPROVAL'),
    );
    await expect(
      repository.approve(
        'actor',
        'request-1',
        { expectedVersion: 2, role: Role.USER },
        invitation,
      ),
    ).resolves.toEqual({ kind: 'APPLIED', request: { id: 'updated' } });
    expect(transaction.accessInvitation.create).toHaveBeenCalledOnce();
    expect(transaction.auditEvent.upsert).toHaveBeenCalledTimes(3);
  });

  it('reports a raced approval update', async () => {
    const { repository, transaction } = harness();
    transaction.accessRequest.findUnique.mockResolvedValue(
      request('PENDING_APPROVAL'),
    );
    transaction.accessRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      repository.approve(
        'actor',
        'request-1',
        { expectedVersion: 2, role: Role.USER },
        invitation,
      ),
    ).resolves.toEqual({ kind: 'CONFLICT' });
  });

  it.each([null, request('PENDING_EMAIL')])(
    'reports a missing non-reviewable rejection request',
    async (existing) => {
      const { repository, transaction } = harness();
      transaction.accessRequest.findUnique.mockResolvedValue(existing);
      await expect(
        repository.reject(
          'actor',
          'request-1',
          { expectedVersion: 2, reason: 'No fit' },
          createdAt,
        ),
      ).resolves.toEqual({ kind: 'NOT_FOUND' });
    },
  );

  it('distinguishes idempotent and conflicting rejections', async () => {
    const { repository, transaction } = harness();
    transaction.accessRequest.findUnique
      .mockResolvedValueOnce(request('REJECTED', { rejectionReason: 'No fit' }))
      .mockResolvedValueOnce(request('REJECTED', { rejectionReason: 'Other' }));
    await expect(
      repository.reject(
        'actor',
        'request-1',
        { expectedVersion: 2, reason: 'No fit' },
        createdAt,
      ),
    ).resolves.toEqual({ kind: 'IDEMPOTENT', request: { id: 'request-1' } });
    await expect(
      repository.reject(
        'actor',
        'request-1',
        { expectedVersion: 2, reason: 'No fit' },
        createdAt,
      ),
    ).resolves.toEqual({ kind: 'CONFLICT' });
  });

  it.each([request('APPROVED'), request('PENDING_APPROVAL', { version: 3 })])(
    'rejects a stale rejection transition',
    async (existing) => {
      const { repository, transaction } = harness();
      transaction.accessRequest.findUnique.mockResolvedValue(existing);
      await expect(
        repository.reject(
          'actor',
          'request-1',
          { expectedVersion: 2, reason: 'No fit' },
          createdAt,
        ),
      ).resolves.toEqual({ kind: 'CONFLICT' });
    },
  );

  it('applies a rejection, invalidates invitations and audits it', async () => {
    const { repository, transaction } = harness();
    transaction.accessRequest.findUnique.mockResolvedValue(
      request('PENDING_APPROVAL'),
    );
    await expect(
      repository.reject(
        'actor',
        'request-1',
        { expectedVersion: 2, reason: 'No fit' },
        createdAt,
      ),
    ).resolves.toEqual({ kind: 'APPLIED', request: { id: 'updated' } });
    expect(transaction.accessInvitation.updateMany).toHaveBeenCalledOnce();
    expect(transaction.auditEvent.upsert).toHaveBeenCalledOnce();
  });

  it('reports a raced rejection update', async () => {
    const { repository, transaction } = harness();
    transaction.accessRequest.findUnique.mockResolvedValue(
      request('PENDING_APPROVAL'),
    );
    transaction.accessRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      repository.reject(
        'actor',
        'request-1',
        { expectedVersion: 2, reason: 'No fit' },
        createdAt,
      ),
    ).resolves.toEqual({ kind: 'CONFLICT' });
  });

  it.each([
    null,
    request('PENDING_APPROVAL'),
    request('APPROVED', { invitations: [] }),
  ])(
    'reports a request that cannot receive a replacement invitation',
    async (existing) => {
      const { repository, transaction } = harness();
      transaction.accessRequest.findUnique.mockResolvedValue(existing);
      await expect(
        repository.resend(
          'actor',
          'request-1',
          { expectedVersion: 2 },
          invitation,
        ),
      ).resolves.toEqual({ kind: 'NOT_FOUND' });
    },
  );

  it('detects stale and raced invitation resends', async () => {
    const { repository, transaction } = harness();
    transaction.accessRequest.findUnique
      .mockResolvedValueOnce(request('APPROVED', { version: 3 }))
      .mockResolvedValueOnce(request('APPROVED'));
    await expect(
      repository.resend(
        'actor',
        'request-1',
        { expectedVersion: 2 },
        invitation,
      ),
    ).resolves.toEqual({ kind: 'CONFLICT' });
    transaction.accessRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      repository.resend(
        'actor',
        'request-1',
        { expectedVersion: 2 },
        invitation,
      ),
    ).resolves.toEqual({ kind: 'CONFLICT' });
  });

  it('replaces an invitation and exposes list and invalidation operations', async () => {
    const { client, repository, transaction } = harness();
    transaction.accessRequest.findUnique.mockResolvedValue(request('APPROVED'));
    await expect(
      repository.resend(
        'actor',
        'request-1',
        { expectedVersion: 2 },
        invitation,
      ),
    ).resolves.toEqual({ kind: 'APPLIED', request: { id: 'updated' } });
    expect(transaction.accessInvitation.updateMany).toHaveBeenCalledOnce();
    expect(transaction.accessInvitation.create).toHaveBeenCalledOnce();
    expect(transaction.auditEvent.upsert).toHaveBeenCalledOnce();

    await repository.invalidateInvitation('invitation-1', createdAt);
    expect(client.accessInvitation.updateMany).toHaveBeenCalledOnce();

    const page = { items: [], page: 1, pageSize: 10, total: 0, totalPages: 1 };
    query.listReviewRequests.mockResolvedValue(page);
    await expect(repository.list({ page: 1, pageSize: 10 })).resolves.toBe(
      page,
    );
  });
});
