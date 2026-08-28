import { createHash, randomBytes, randomUUID } from 'node:crypto';

import {
  ResendEmailProvider,
  type EmailProvider,
} from '../../email/email-provider.js';
import type { SupportedLocale } from '../../../shared/locale.js';

const defaultTtlMilliseconds = 24 * 60 * 60 * 1_000;
const minimumTtlMilliseconds = 5 * 60 * 1_000;
const maximumTtlMilliseconds = 7 * 24 * 60 * 60 * 1_000;

interface IssuedEmailVerification {
  expiresAt: Date;
  recipientEmail: string;
  locale: SupportedLocale;
  verificationId: string;
}

export interface EmailVerificationRepository {
  consume(input: { now: Date; tokenHash: string }): Promise<boolean>;
  invalidate(input: { now: Date; verificationId: string }): Promise<void>;
  issue(input: {
    accessRequestId: string;
    expiresAt: Date;
    now: Date;
    tokenHash: string;
    verificationId: string;
    email: string;
    locale: SupportedLocale;
  }): Promise<IssuedEmailVerification | null>;
}

interface EmailVerificationLogger {
  error(
    message: string,
    metadata: { provider: string; verificationId: string },
  ): void;
}

export interface EmailVerificationDependencies {
  appUrl: string;
  createAccessRequestId(): string;
  createToken(): string;
  createVerificationId(): string;
  emailProvider: EmailProvider;
  logger: EmailVerificationLogger;
  now(): Date;
  repository: EmailVerificationRepository;
  ttlMilliseconds: number;
}

class VerificationConsumeConflict extends Error {}

export function hashVerificationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function buildVerificationUrl(appUrl: string, token: string): string {
  const url = new URL('/verify-email', appUrl);
  url.hash = new URLSearchParams({ token }).toString();
  return url.toString();
}

export const prismaEmailVerificationRepository: EmailVerificationRepository = {
  async consume({ now, tokenHash }) {
    const { prisma } = await import('../../prisma.js');

    try {
      return await prisma.$transaction(async (transaction) => {
        const verification = await transaction.emailVerification.findUnique({
          include: { accessRequest: { select: { status: true } } },
          where: { tokenHash },
        });

        if (
          !verification ||
          verification.consumedAt ||
          verification.invalidatedAt ||
          verification.expiresAt <= now ||
          verification.accessRequest.status !== 'PENDING_EMAIL'
        ) {
          return false;
        }

        const consumed = await transaction.emailVerification.updateMany({
          data: { consumedAt: now },
          where: {
            consumedAt: null,
            expiresAt: { gt: now },
            id: verification.id,
            invalidatedAt: null,
          },
        });

        if (consumed.count !== 1) {
          throw new VerificationConsumeConflict();
        }

        const transitioned = await transaction.accessRequest.updateMany({
          data: {
            emailVerifiedAt: now,
            status: 'PENDING_APPROVAL',
            version: { increment: 1 },
          },
          where: {
            id: verification.accessRequestId,
            status: 'PENDING_EMAIL',
          },
        });

        if (transitioned.count !== 1) {
          throw new VerificationConsumeConflict();
        }

        return true;
      });
    } catch (error) {
      if (error instanceof VerificationConsumeConflict) {
        return false;
      }
      throw error;
    }
  },

  async invalidate({ now, verificationId }) {
    const { prisma } = await import('../../prisma.js');
    await prisma.emailVerification.updateMany({
      data: { invalidatedAt: now },
      where: {
        consumedAt: null,
        id: verificationId,
        invalidatedAt: null,
      },
    });
  },

  async issue({
    accessRequestId,
    email,
    expiresAt,
    now,
    tokenHash,
    verificationId,
    locale,
  }) {
    const { prisma } = await import('../../prisma.js');

    return prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${email}, 0))`;

      const user = await transaction.user.findUnique({
        select: { id: true },
        where: { email },
      });
      if (user) return null;

      let request = await transaction.accessRequest.findFirst({
        orderBy: { createdAt: 'desc' },
        where: {
          emailNormalized: email,
          status: { in: ['PENDING_EMAIL', 'PENDING_APPROVAL', 'APPROVED'] },
        },
      });

      if (
        request?.status === 'PENDING_APPROVAL' ||
        request?.status === 'APPROVED'
      ) {
        return null;
      }

      request ??= await transaction.accessRequest.create({
        data: {
          emailNormalized: email,
          id: accessRequestId,
          locale,
          updatedAt: now,
        },
      });

      await transaction.emailVerification.updateMany({
        data: { invalidatedAt: now },
        where: {
          accessRequestId: request.id,
          consumedAt: null,
          invalidatedAt: null,
        },
      });
      await transaction.emailVerification.create({
        data: {
          accessRequestId: request.id,
          createdAt: now,
          expiresAt,
          id: verificationId,
          tokenHash,
        },
      });

      return {
        expiresAt,
        locale: request.locale === 'en' ? 'en' : 'fr',
        recipientEmail: email,
        verificationId,
      };
    });
  },
};

function readTtl(environment: NodeJS.ProcessEnv): number {
  const value = environment.LEARNX_EMAIL_VERIFICATION_TTL_MS;
  const parsed = value ? Number(value) : defaultTtlMilliseconds;

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < minimumTtlMilliseconds ||
    parsed > maximumTtlMilliseconds
  ) {
    throw new Error('Invalid email verification TTL configuration.');
  }
  return parsed;
}

export function createEmailVerificationDependencies(
  environment: NodeJS.ProcessEnv = process.env,
): EmailVerificationDependencies | undefined {
  if (environment.LEARNX_EMAIL_VERIFICATION_ENABLED !== 'true') {
    return undefined;
  }

  const apiKey = environment.RESEND_API_KEY;
  const appUrl = environment.APP_URL;
  const from = environment.LEARNX_EMAIL_FROM;
  if (!apiKey || !appUrl || !from) {
    throw new Error('Email verification provider is not fully configured.');
  }

  const parsedAppUrl = new URL(appUrl);
  if (
    parsedAppUrl.protocol !== 'https:' &&
    !(
      environment.NODE_ENV !== 'production' &&
      parsedAppUrl.hostname === 'localhost'
    )
  ) {
    throw new Error('APP_URL must use HTTPS outside local development.');
  }

  return {
    appUrl: parsedAppUrl.origin,
    createAccessRequestId: randomUUID,
    createToken: () => randomBytes(32).toString('base64url'),
    createVerificationId: randomUUID,
    emailProvider: new ResendEmailProvider({ apiKey, from }),
    logger: {
      error(message, metadata) {
        console.error(message, metadata);
      },
    },
    now: () => new Date(),
    repository: prismaEmailVerificationRepository,
    ttlMilliseconds: readTtl(environment),
  };
}

export function createEmailVerificationConsumerDependencies() {
  return {
    now: () => new Date(),
    repository: prismaEmailVerificationRepository,
  };
}

export async function issueEmailVerification(
  email: string,
  locale: SupportedLocale,
  dependencies: EmailVerificationDependencies,
): Promise<void> {
  const now = dependencies.now();
  const token = dependencies.createToken();
  const verificationId = dependencies.createVerificationId();
  const issued = await dependencies.repository.issue({
    accessRequestId: dependencies.createAccessRequestId(),
    email,
    expiresAt: new Date(now.getTime() + dependencies.ttlMilliseconds),
    now,
    locale,
    tokenHash: hashVerificationToken(token),
    verificationId,
  });

  if (!issued) return;

  try {
    await dependencies.emailProvider.sendVerificationEmail({
      expiresAt: issued.expiresAt,
      idempotencyKey: issued.verificationId,
      recipientEmail: issued.recipientEmail,
      locale: issued.locale,
      verificationUrl: buildVerificationUrl(dependencies.appUrl, token),
    });
  } catch {
    await dependencies.repository.invalidate({
      now: dependencies.now(),
      verificationId: issued.verificationId,
    });
    dependencies.logger.error('Email verification delivery failed.', {
      provider: dependencies.emailProvider.name,
      verificationId: issued.verificationId,
    });
  }
}

export async function consumeEmailVerification(
  token: string,
  dependencies: Pick<EmailVerificationDependencies, 'now' | 'repository'>,
): Promise<boolean> {
  return dependencies.repository.consume({
    now: dependencies.now(),
    tokenHash: hashVerificationToken(token),
  });
}
