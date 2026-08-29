import { beforeEach, describe, expect, it, vi } from 'vitest';

const transaction = {
  $executeRaw: vi.fn(),
  accessRequest: {
    create: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  emailVerification: {
    create: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  user: { findUnique: vi.fn() },
};

const prisma = {
  $transaction: vi.fn(
    async (operation: (client: typeof transaction) => Promise<unknown>) =>
      operation(transaction),
  ),
  emailVerification: { updateMany: vi.fn() },
};

vi.mock('../../prisma.js', () => ({ prisma }));

import { prismaEmailVerificationRepository } from './email-verification.js';

const now = new Date('2026-08-28T12:00:00.000Z');

function verification(overrides: Record<string, unknown> = {}) {
  return {
    accessRequest: { status: 'PENDING_EMAIL' },
    accessRequestId: 'request-1',
    consumedAt: null,
    expiresAt: new Date('2026-08-29T12:00:00.000Z'),
    id: 'verification-1',
    invalidatedAt: null,
    ...overrides,
  };
}

function issueInput() {
  return {
    accessRequestId: 'request-1',
    email: 'learner@example.com',
    expiresAt: new Date('2026-08-29T12:00:00.000Z'),
    locale: 'fr' as const,
    now,
    tokenHash: 'token-hash',
    verificationId: 'verification-1',
  };
}

describe('prismaEmailVerificationRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (operation: (client: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    );
  });

  it.each([
    null,
    verification({ consumedAt: now }),
    verification({ invalidatedAt: now }),
    verification({ expiresAt: now }),
    verification({ accessRequest: { status: 'PENDING_APPROVAL' } }),
  ])('does not consume an unusable verification', async (candidate) => {
    transaction.emailVerification.findUnique.mockResolvedValueOnce(candidate);
    await expect(
      prismaEmailVerificationRepository.consume({ now, tokenHash: 'hash' }),
    ).resolves.toBe(false);
    expect(transaction.emailVerification.updateMany).not.toHaveBeenCalled();
  });

  it('consumes and transitions a valid pending request atomically', async () => {
    transaction.emailVerification.findUnique.mockResolvedValueOnce(
      verification(),
    );
    transaction.emailVerification.updateMany.mockResolvedValueOnce({
      count: 1,
    });
    transaction.accessRequest.updateMany.mockResolvedValueOnce({ count: 1 });

    await expect(
      prismaEmailVerificationRepository.consume({ now, tokenHash: 'hash' }),
    ).resolves.toBe(true);
    expect(transaction.accessRequest.updateMany).toHaveBeenCalledWith({
      data: {
        emailVerifiedAt: now,
        status: 'PENDING_APPROVAL',
        version: { increment: 1 },
      },
      where: { id: 'request-1', status: 'PENDING_EMAIL' },
    });
  });

  it('maps both optimistic consume races to a safe false result', async () => {
    transaction.emailVerification.findUnique.mockResolvedValue(verification());
    transaction.emailVerification.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    transaction.accessRequest.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      prismaEmailVerificationRepository.consume({ now, tokenHash: 'one' }),
    ).resolves.toBe(false);
    await expect(
      prismaEmailVerificationRepository.consume({ now, tokenHash: 'two' }),
    ).resolves.toBe(false);
  });

  it('rethrows unexpected persistence failures', async () => {
    prisma.$transaction.mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    await expect(
      prismaEmailVerificationRepository.consume({ now, tokenHash: 'hash' }),
    ).rejects.toThrow('database unavailable');
  });

  it('invalidates only an outstanding verification', async () => {
    prisma.emailVerification.updateMany.mockResolvedValueOnce({ count: 1 });
    await prismaEmailVerificationRepository.invalidate({
      now,
      verificationId: 'verification-1',
    });
    expect(prisma.emailVerification.updateMany).toHaveBeenCalledWith({
      data: { invalidatedAt: now },
      where: {
        consumedAt: null,
        id: 'verification-1',
        invalidatedAt: null,
      },
    });
  });

  it('does not issue for an existing account or an approved request', async () => {
    transaction.user.findUnique.mockResolvedValueOnce({ id: 'user-1' });
    await expect(
      prismaEmailVerificationRepository.issue(issueInput()),
    ).resolves.toBeNull();

    transaction.user.findUnique.mockResolvedValueOnce(null);
    transaction.accessRequest.findFirst.mockResolvedValueOnce({
      id: 'request-1',
      status: 'APPROVED',
    });
    await expect(
      prismaEmailVerificationRepository.issue(issueInput()),
    ).resolves.toBeNull();
  });

  it('creates a request and verification while invalidating older tokens', async () => {
    transaction.user.findUnique.mockResolvedValueOnce(null);
    transaction.accessRequest.findFirst.mockResolvedValueOnce(null);
    transaction.accessRequest.create.mockResolvedValueOnce({
      id: 'request-1',
      locale: 'fr',
      status: 'PENDING_EMAIL',
    });
    transaction.emailVerification.updateMany.mockResolvedValueOnce({
      count: 1,
    });
    transaction.emailVerification.create.mockResolvedValueOnce({
      id: 'verification-1',
    });

    await expect(
      prismaEmailVerificationRepository.issue(issueInput()),
    ).resolves.toEqual({
      expiresAt: issueInput().expiresAt,
      locale: 'fr',
      recipientEmail: 'learner@example.com',
      verificationId: 'verification-1',
    });
    expect(transaction.accessRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ locale: 'fr', updatedAt: now }),
    });
    expect(transaction.emailVerification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accessRequestId: 'request-1',
        tokenHash: 'token-hash',
      }),
    });
  });

  it('reuses a pending request and preserves its normalized locale', async () => {
    transaction.user.findUnique.mockResolvedValueOnce(null);
    transaction.accessRequest.findFirst.mockResolvedValueOnce({
      id: 'request-existing',
      locale: 'en',
      status: 'PENDING_EMAIL',
    });
    transaction.emailVerification.updateMany.mockResolvedValueOnce({
      count: 0,
    });
    transaction.emailVerification.create.mockResolvedValueOnce({ id: 'new' });

    await expect(
      prismaEmailVerificationRepository.issue(issueInput()),
    ).resolves.toMatchObject({ locale: 'en' });
    expect(transaction.accessRequest.create).not.toHaveBeenCalled();
  });
});
