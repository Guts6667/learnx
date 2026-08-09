import { randomUUID } from 'node:crypto';

import {
  createEmailVerificationDependencies,
  issueEmailVerification,
  type EmailVerificationDependencies,
} from './email-verification.js';
import { ApiError } from './errors.js';
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

function unavailable(): ApiError {
  return new ApiError(
    'ACCESS_REQUESTS_UNAVAILABLE',
    'Access requests are temporarily unavailable.',
    503,
  );
}

function createDefaultDependencies(
  environment: NodeJS.ProcessEnv,
): AccessRequestDependencies {
  let emailVerification: EmailVerificationDependencies | undefined;

  try {
    emailVerification = createEmailVerificationDependencies(environment);
  } catch {
    throw unavailable();
  }

  if (environment.NODE_ENV === 'production' && !emailVerification) {
    throw unavailable();
  }

  return {
    ...baseDependencies,
    emailVerification,
  };
}

export async function requestAccess(
  email: string,
  locale: SupportedLocale,
  dependencies?: AccessRequestDependencies,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const resolvedDependencies =
    dependencies ?? createDefaultDependencies(environment);

  if (resolvedDependencies.emailVerification) {
    await issueEmailVerification(
      email,
      locale,
      resolvedDependencies.emailVerification,
    );
    return;
  }

  await resolvedDependencies.repository.createPendingUnlessUserExists({
    email,
    id: resolvedDependencies.createId(),
    locale,
    now: resolvedDependencies.now(),
  });
}
