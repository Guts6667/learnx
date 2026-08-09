import { randomUUID } from 'node:crypto';

import {
  createEmailVerificationDependencies,
  issueEmailVerification,
  type EmailVerificationDependencies,
} from './email-verification.js';
import type { SupportedLocale } from '../../../shared/locale.js';

export interface AccessRequestRepository {
  createPendingUnlessUserExists(input: {
    email: string;
    id: string;
    locale: SupportedLocale;
    now: Date;
  }): Promise<void>;
}

export interface AccessRequestDependencies {
  createId(): string;
  emailVerification?: EmailVerificationDependencies;
  now(): Date;
  repository: AccessRequestRepository;
}

const prismaAccessRequestRepository: AccessRequestRepository = {
  async createPendingUnlessUserExists({ email, id, locale, now }) {
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
          ("id", "email_normalized", "locale", "status", "version", "created_at", "updated_at")
        VALUES (
          ${id}::uuid,
          ${email},
          ${locale},
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

const baseDependencies: AccessRequestDependencies = {
  createId: randomUUID,
  now: () => new Date(),
  repository: prismaAccessRequestRepository,
};

function createDefaultDependencies(): AccessRequestDependencies {
  return {
    ...baseDependencies,
    emailVerification: createEmailVerificationDependencies(),
  };
}

export async function requestAccess(
  email: string,
  locale: SupportedLocale,
  dependencies = createDefaultDependencies(),
): Promise<void> {
  if (dependencies.emailVerification) {
    await issueEmailVerification(email, locale, dependencies.emailVerification);
    return;
  }

  await dependencies.repository.createPendingUnlessUserExists({
    email,
    id: dependencies.createId(),
    locale,
    now: dependencies.now(),
  });
}
