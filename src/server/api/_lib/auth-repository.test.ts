import { beforeEach, describe, expect, it, vi } from 'vitest';

const transaction = {
  $queryRaw: vi.fn(),
  session: {
    create: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
};

const prisma = {
  $transaction: vi.fn(
    async (operation: (client: typeof transaction) => Promise<unknown>) =>
      operation(transaction),
  ),
  session: {
    deleteMany: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  user: {
    create: vi.fn(),
    findUnique: vi.fn(),
  },
};

vi.mock('../../prisma.js', () => ({ prisma }));

import { prismaAuthRepository } from './auth-repository.js';

const storedUser = {
  accountStatus: 'ACTIVE' as const,
  displayName: 'Ada',
  email: 'ada@example.com',
  id: 'user-1',
  locale: 'fr-CA',
  passwordHash: 'hash',
  role: 'USER' as const,
};
const createUserInput = {
  displayName: storedUser.displayName,
  email: storedUser.email,
  locale: 'fr' as const,
  passwordHash: storedUser.passwordHash,
};

describe('prismaAuthRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (operation: (client: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    );
  });

  it('creates a session only while the locked user remains active', async () => {
    transaction.$queryRaw.mockResolvedValueOnce([{ id: storedUser.id }]);
    transaction.session.create.mockResolvedValueOnce({ id: 'session-1' });

    await expect(
      prismaAuthRepository.createSession({
        expiresAt: new Date('2026-09-01T00:00:00.000Z'),
        tokenHash: 'token',
        userId: storedUser.id,
      }),
    ).resolves.toEqual({ id: 'session-1' });
    expect(transaction.session.create).toHaveBeenCalledOnce();

    transaction.$queryRaw.mockResolvedValueOnce([]);
    await expect(
      prismaAuthRepository.createSession({
        expiresAt: new Date('2026-09-01T00:00:00.000Z'),
        tokenHash: 'other-token',
        userId: storedUser.id,
      }),
    ).resolves.toBeNull();
    expect(transaction.session.create).toHaveBeenCalledOnce();
  });

  it('normalizes stored users and maps a unique e-mail conflict', async () => {
    prisma.user.create.mockResolvedValueOnce(storedUser);
    await expect(
      prismaAuthRepository.createUser(createUserInput),
    ).resolves.toMatchObject({ locale: 'fr' });

    prisma.user.create.mockRejectedValueOnce({ code: 'P2002' });
    await expect(
      prismaAuthRepository.createUser(createUserInput),
    ).rejects.toThrow('EMAIL_ALREADY_REGISTERED');

    const databaseFailure = new Error('database unavailable');
    prisma.user.create.mockRejectedValueOnce(databaseFailure);
    await expect(
      prismaAuthRepository.createUser(createUserInput),
    ).rejects.toBe(databaseFailure);
  });

  it('deletes, finds and touches sessions through the persistence boundary', async () => {
    prisma.session.deleteMany.mockResolvedValueOnce({ count: 1 });
    await prismaAuthRepository.deleteSessionByTokenHash('token');
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: 'token' },
    });

    prisma.session.findUnique.mockResolvedValueOnce(null);
    await expect(
      prismaAuthRepository.findSessionWithUserByTokenHash('missing'),
    ).resolves.toBeNull();

    prisma.session.findUnique.mockResolvedValueOnce({
      expiresAt: new Date('2026-09-01T00:00:00.000Z'),
      id: 'session-1',
      tokenHash: 'token',
      user: storedUser,
      userId: storedUser.id,
    });
    await expect(
      prismaAuthRepository.findSessionWithUserByTokenHash('token'),
    ).resolves.toMatchObject({
      session: { id: 'session-1' },
      user: { id: storedUser.id, locale: 'fr' },
    });

    prisma.session.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    await expect(
      prismaAuthRepository.touchSession(
        'session-1',
        new Date('2026-08-28T01:00:00.000Z'),
      ),
    ).resolves.toBe(true);
    await expect(
      prismaAuthRepository.touchSession(
        'session-1',
        new Date('2026-08-28T02:00:00.000Z'),
      ),
    ).resolves.toBe(false);
  });

  it('finds users and updates locale only for one active account', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(storedUser);
    await expect(
      prismaAuthRepository.findUserByEmail('missing@example.com'),
    ).resolves.toBeNull();
    await expect(
      prismaAuthRepository.findUserByEmail(storedUser.email),
    ).resolves.toMatchObject({ locale: 'fr' });

    transaction.user.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      prismaAuthRepository.updateUserLocale(storedUser.id, 'en'),
    ).resolves.toBeNull();

    transaction.user.updateMany.mockResolvedValueOnce({ count: 1 });
    transaction.user.findUnique.mockResolvedValueOnce(null);
    await expect(
      prismaAuthRepository.updateUserLocale(storedUser.id, 'en'),
    ).resolves.toBeNull();

    transaction.user.updateMany.mockResolvedValueOnce({ count: 1 });
    transaction.user.findUnique.mockResolvedValueOnce({
      ...storedUser,
      locale: 'en-US',
    });
    await expect(
      prismaAuthRepository.updateUserLocale(storedUser.id, 'en'),
    ).resolves.toMatchObject({ locale: 'en' });
  });
});
