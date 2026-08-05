import { randomUUID } from 'node:crypto';

export interface AccessRequestRepository {
  createPendingUnlessUserExists(input: {
    email: string;
    id: string;
    now: Date;
  }): Promise<void>;
}

export interface AccessRequestDependencies {
  createId(): string;
  now(): Date;
  repository: AccessRequestRepository;
}

const prismaAccessRequestRepository: AccessRequestRepository = {
  async createPendingUnlessUserExists({ email, id, now }) {
    const { prisma } = await import('../../prisma.js');

    await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({
        select: { id: true },
        where: { email },
      });

      if (user) {
        return;
      }

      await transaction.$executeRaw`
        INSERT INTO "access_requests"
          ("id", "email_normalized", "status", "version", "created_at", "updated_at")
        VALUES (
          ${id}::uuid,
          ${email},
          'pending_email'::"access_request_status",
          1,
          ${now},
          ${now}
        )
        ON CONFLICT ("email_normalized")
          WHERE "status" IN ('pending_email', 'pending_approval', 'approved')
        DO NOTHING
      `;
    });
  },
};

const defaultDependencies: AccessRequestDependencies = {
  createId: randomUUID,
  now: () => new Date(),
  repository: prismaAccessRequestRepository,
};

export async function requestAccess(
  email: string,
  dependencies = defaultDependencies,
): Promise<void> {
  await dependencies.repository.createPendingUnlessUserExists({
    email,
    id: dependencies.createId(),
    now: dependencies.now(),
  });
}
