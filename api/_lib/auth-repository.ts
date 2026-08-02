import type { AuthRepository, StoredUser } from './auth-types';

async function getPrismaClient() {
  const { prisma } = await import('../../src/server/prisma');

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
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: StoredUser['role'];
}): StoredUser {
  return user;
}

export const prismaAuthRepository: AuthRepository = {
  async createSession(input) {
    const prisma = await getPrismaClient();

    return prisma.session.create({ data: input });
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

    return { session: storedSession, user };
  },
  async findUserByEmail(email) {
    const prisma = await getPrismaClient();
    const user = await prisma.user.findUnique({ where: { email } });

    return user ? toStoredUser(user) : null;
  },
  async touchSession(id, lastUsedAt) {
    const prisma = await getPrismaClient();
    await prisma.session.update({ where: { id }, data: { lastUsedAt } });
  },
};
