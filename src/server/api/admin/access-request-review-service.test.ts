import { describe, expect, it, vi } from 'vitest';

import { Role } from '../../../../generated/prisma/client.js';
import type { AccessRequestReviewRepository } from './access-request-review-repository.js';
import {
  createAccessRequestReviewService,
  type AccessRequestReviewItem,
} from './access-request-review-service.js';

function reviewItem(): AccessRequestReviewItem {
  return {
    assignedRole: Role.USER,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    emailNormalized: 'learner@example.com',
    emailVerifiedAt: new Date('2026-08-01T00:05:00.000Z'),
    id: 'request-1',
    invitationExpiresAt: new Date('2026-08-02T00:00:00.000Z'),
    locale: 'fr',
    rejectionReason: null,
    reviewedAt: new Date('2026-08-01T00:10:00.000Z'),
    status: 'APPROVED',
    version: 2,
  };
}

function repositoryMock(
  approveKind: 'APPLIED' | 'IDEMPOTENT' = 'APPLIED',
): AccessRequestReviewRepository {
  return {
    approve: vi.fn().mockResolvedValue({
      kind: approveKind,
      request: reviewItem(),
    }),
    invalidateInvitation: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
    }),
    reject: vi.fn().mockResolvedValue({ kind: 'NOT_FOUND' }),
    resend: vi.fn().mockResolvedValue({ kind: 'NOT_FOUND' }),
  };
}

describe('access request review service', () => {
  it('persists then delivers an applied invitation', async () => {
    const repository = repositoryMock();
    const send = vi.fn().mockResolvedValue(undefined);
    const service = createAccessRequestReviewService(repository, {
      delivery: { send },
      invitationTtlMilliseconds: 60_000,
    });

    const result = await service.approve('admin-1', 'request-1', {
      expectedVersion: 1,
      role: Role.USER,
    });

    expect(result.kind).toBe('APPLIED');
    expect(repository.approve).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'fr',
        recipientEmail: 'learner@example.com',
      }),
    );
  });

  it('invalidates a persisted invitation when delivery fails', async () => {
    const repository = repositoryMock();
    const service = createAccessRequestReviewService(repository, {
      delivery: { send: vi.fn().mockRejectedValue(new Error('mail down')) },
      invitationTtlMilliseconds: 60_000,
    });

    await expect(
      service.approve('admin-1', 'request-1', {
        expectedVersion: 1,
        role: Role.USER,
      }),
    ).rejects.toThrow('mail down');
    expect(repository.invalidateInvitation).toHaveBeenCalledOnce();
  });

  it('does not redeliver an idempotent approval', async () => {
    const repository = repositoryMock('IDEMPOTENT');
    const send = vi.fn();
    const service = createAccessRequestReviewService(repository, {
      delivery: { send },
      invitationTtlMilliseconds: 60_000,
    });

    await service.approve('admin-1', 'request-1', {
      expectedVersion: 1,
      role: Role.USER,
    });

    expect(send).not.toHaveBeenCalled();
  });
});
