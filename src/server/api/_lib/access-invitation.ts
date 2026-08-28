import { createHash, randomBytes } from 'node:crypto';

import type {
  PrismaClient,
  Role,
} from '../../../../generated/prisma/client.js';
import {
  ResendEmailProvider,
  type AccessInvitationEmailProvider,
} from '../../email/email-provider.js';
import { hashPassword } from './password.js';
import {
  createSessionToken,
  getSessionExpiry,
  hashSessionToken,
} from './session.js';
import type { SupportedLocale } from '../../../shared/locale.js';

const minimumTtlMilliseconds = 5 * 60 * 1_000;
const maximumTtlMilliseconds = 7 * 24 * 60 * 60 * 1_000;
const defaultTtlMilliseconds = 7 * 24 * 60 * 60 * 1_000;

export interface AccessInvitationDeliveryInput {
  expiresAt: Date;
  invitationId: string;
  locale: SupportedLocale;
  recipientEmail: string;
  token: string;
}

export interface AccessInvitationDelivery {
  send(input: AccessInvitationDeliveryInput): Promise<void>;
}

interface AccessInvitationActivationResult {
  sessionToken: string;
  user: {
    displayName: string;
    email: string;
    id: string;
    locale: SupportedLocale;
    role: Role;
  };
}

export interface AccessInvitationActivationService {
  activate(input: {
    displayName: string;
    password: string;
    token: string;
  }): Promise<AccessInvitationActivationResult | null>;
}

export function hashAccessInvitationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function createAccessInvitationToken(): string {
  return randomBytes(32).toString('base64url');
}

export function buildAccessInvitationUrl(appUrl: string, token: string): string {
  const url = new URL('/activate', appUrl);
  url.hash = new URLSearchParams({ token }).toString();
  return url.toString();
}

function readTtl(environment: NodeJS.ProcessEnv): number {
  const value = environment.LEARNX_ACCESS_INVITATION_TTL_MS;
  const parsed = value ? Number(value) : defaultTtlMilliseconds;
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < minimumTtlMilliseconds ||
    parsed > maximumTtlMilliseconds
  ) {
    throw new Error('Invalid access invitation TTL configuration.');
  }
  return parsed;
}

function readApplicationUrl(environment: NodeJS.ProcessEnv): URL {
  if (!environment.APP_URL) {
    throw new Error('Access invitation delivery requires APP_URL.');
  }
  const url = new URL(environment.APP_URL);
  if (
    url.protocol !== 'https:' &&
    !(environment.NODE_ENV !== 'production' && url.hostname === 'localhost')
  ) {
    throw new Error('APP_URL must use HTTPS outside local development.');
  }
  return url;
}

export function getAccessInvitationTtlMilliseconds(
  environment: NodeJS.ProcessEnv = process.env,
): number {
  return readTtl(environment);
}

export function createAccessInvitationDelivery(
  environment: NodeJS.ProcessEnv = process.env,
  provider?: AccessInvitationEmailProvider,
): AccessInvitationDelivery | undefined {
  if (environment.LEARNX_EMAIL_VERIFICATION_ENABLED !== 'true') {
    return undefined;
  }
  const apiKey = environment.RESEND_API_KEY;
  const from = environment.LEARNX_EMAIL_FROM;
  if ((!apiKey || !from) && !provider) {
    throw new Error('Access invitation provider is not fully configured.');
  }
  const appUrl = readApplicationUrl(environment);
  const emailProvider = provider
    ? provider
    : new ResendEmailProvider({ apiKey: apiKey ?? '', from: from ?? '' });

  return {
    async send(input) {
      await emailProvider.sendAccessInvitationEmail({
        activationUrl: buildAccessInvitationUrl(appUrl.origin, input.token),
        expiresAt: input.expiresAt,
        idempotencyKey: input.invitationId,
        locale: input.locale,
        recipientEmail: input.recipientEmail,
      });
    },
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

export function createPrismaAccessInvitationActivationService(
  client: PrismaClient,
  dependencies: {
    createSessionToken?: () => string;
    hashPassword?: (password: string) => Promise<string>;
    now?: () => Date;
  } = {},
): AccessInvitationActivationService {
  const createToken = dependencies.createSessionToken ?? createSessionToken;
  const hashPasswordValue = dependencies.hashPassword ?? hashPassword;
  const now = dependencies.now ?? (() => new Date());

  return {
    async activate(input) {
      const activationTime = now();
      const invitationTokenHash = hashAccessInvitationToken(input.token);
      const candidate = await client.accessInvitation.findUnique({
        include: { accessRequest: true },
        where: { tokenHash: invitationTokenHash },
      });
      if (
        !candidate ||
        candidate.consumedAt ||
        candidate.invalidatedAt ||
        candidate.expiresAt <= activationTime ||
        candidate.accessRequest.status !== 'APPROVED' ||
        candidate.accessRequest.activatedUserId
      ) {
        return null;
      }
      const passwordHash = await hashPasswordValue(input.password);
      const sessionToken = createToken();

      try {
        return await client.$transaction(async (transaction) => {
          const invitation = await transaction.accessInvitation.findUnique({
            include: { accessRequest: true },
            where: { tokenHash: invitationTokenHash },
          });
          if (
            !invitation ||
            invitation.consumedAt ||
            invitation.invalidatedAt ||
            invitation.expiresAt <= activationTime ||
            invitation.accessRequest.status !== 'APPROVED' ||
            invitation.accessRequest.activatedUserId
          ) {
            return null;
          }

          const consumed = await transaction.accessInvitation.updateMany({
            data: { consumedAt: activationTime },
            where: {
              consumedAt: null,
              expiresAt: { gt: activationTime },
              id: invitation.id,
              invalidatedAt: null,
            },
          });
          if (consumed.count !== 1) return null;

          const user = await transaction.user.create({
            data: {
              accountStatus: 'ACTIVE',
              displayName: input.displayName,
              email: invitation.accessRequest.emailNormalized,
              locale:
                invitation.accessRequest.locale === 'en' ? 'en' : 'fr',
              passwordHash,
              role: invitation.assignedRole,
            },
          });
          const linked = await transaction.accessRequest.updateMany({
            data: {
              activatedUserId: user.id,
              version: { increment: 1 },
            },
            where: {
              activatedUserId: null,
              id: invitation.accessRequestId,
              status: 'APPROVED',
            },
          });
          if (linked.count !== 1) {
            throw new Error('ACCESS_INVITATION_CONFLICT');
          }
          await transaction.accessInvitation.updateMany({
            data: { invalidatedAt: activationTime },
            where: {
              accessRequestId: invitation.accessRequestId,
              consumedAt: null,
              id: { not: invitation.id },
              invalidatedAt: null,
            },
          });
          await transaction.session.create({
            data: {
              expiresAt: getSessionExpiry(activationTime),
              tokenHash: hashSessionToken(sessionToken),
              userId: user.id,
            },
          });

          return {
            sessionToken,
            user: {
              displayName: user.displayName,
              email: user.email,
              id: user.id,
              locale: user.locale === 'en' ? 'en' : 'fr',
              role: user.role,
            },
          };
        });
      } catch (error) {
        if (
          isUniqueConstraintError(error) ||
          (error instanceof Error &&
            error.message === 'ACCESS_INVITATION_CONFLICT')
        ) {
          return null;
        }
        throw error;
      }
    },
  };
}
