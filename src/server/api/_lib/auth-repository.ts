import type { AuthRepository, StoredUser } from './auth-types.js';
import { normalizeLocale } from '../../../shared/locale.js';

async function getPrismaClient() {
  const { prisma } = await import('../../prisma.js');

  return prisma;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

function toStoredUser(user: {
  accountStatus: StoredUser['accountStatus'];
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  locale: string;
  role: StoredUser['role'];
  correctionReuseConsent: boolean;
}): StoredUser {
  return { ...user, locale: normalizeLocale(user.locale) };
}

export const prismaAuthRepository: AuthRepository = {
  async createSession(input) {
    const prisma = await getPrismaClient();

    return prisma.$transaction(async (transaction) => {
      const activeUsers = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "users"
        WHERE "id" = ${input.userId}::uuid
          AND "account_status" = 'active'::"account_status"
        FOR UPDATE
      `;

      if (activeUsers.length !== 1) return null;

      return transaction.session.create({ data: input });
    });
  },
  async createUser(input) {
    try {
      const prisma = await getPrismaClient();
      const user = await prisma.user.create({ data: input });

      return toStoredUser(user);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return Promise.reject(new Error('EMAIL_ALREADY_REGISTERED'));
      }

      throw error;
    }
  },
  async deleteSessionByTokenHash(tokenHash) {
    const prisma = await getPrismaClient();

    await prisma.session.deleteMany({ where: { tokenHash } });
  },
  async findSessionWithUserByTokenHash(tokenHash) {
    const prisma = await getPrismaClient();
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) {
      return null;
    }

    const { user, ...storedSession } = session;

    return { session: storedSession, user: toStoredUser(user) };
  },
  async findUserByEmail(email) {
    const prisma = await getPrismaClient();
    const user = await prisma.user.findUnique({ where: { email } });

    return user ? toStoredUser(user) : null;
  },
  async touchSession(id, lastUsedAt) {
    const prisma = await getPrismaClient();
    const result = await prisma.session.updateMany({
      where: { id, user: { accountStatus: 'ACTIVE' } },
      data: { lastUsedAt },
    });

    return result.count === 1;
  },
  async updateUserLocale(userId, locale) {
    const prisma = await getPrismaClient();

    return prisma.$transaction(async (transaction) => {
      const updated = await transaction.user.updateMany({
        data: { locale },
        where: { accountStatus: 'ACTIVE', id: userId },
      });
      if (updated.count !== 1) return null;

      const user = await transaction.user.findUnique({ where: { id: userId } });
      return user ? toStoredUser(user) : null;
    });
  },
  async updateUserCorrectionReuseConsent(userId, consent) {
    const prisma = await getPrismaClient();

    return prisma.$transaction(async (transaction) => {
      const updated = await transaction.user.updateMany({
        data: { correctionReuseConsent: consent },
        where: { accountStatus: 'ACTIVE', id: userId },
      });
      if (updated.count !== 1) return null;

      const user = await transaction.user.findUnique({ where: { id: userId } });
      return user ? toStoredUser(user) : null;
    });
  },
};
