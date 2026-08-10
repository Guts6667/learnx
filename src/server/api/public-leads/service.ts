import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { SupportedLocale } from '@/shared/locale';

export type PublicLeadPurpose = 'LAUNCH_UPDATES' | 'EARLY_ADOPTER';
export type PublicLeadStatus =
  'PENDING_CONFIRMATION' | 'CONFIRMED' | 'UNSUBSCRIBED' | 'DELETED';

export interface PublicLeadRepository {
  convertToAccessRequest(leadId: string, now: Date): Promise<string | null>;
  confirm(tokenHash: string, now: Date): Promise<boolean>;
  delete(tokenHash: string, now: Date): Promise<boolean>;
  export(input: {
    limit: number;
    purpose?: PublicLeadPurpose;
    status?: PublicLeadStatus;
  }): Promise<
    Array<{
      confirmedAt: Date | null;
      createdAt: Date;
      emailNormalized: string;
      id: string;
      locale: string;
      motivation: string | null;
      purpose: PublicLeadPurpose;
      status: PublicLeadStatus;
    }>
  >;
  issue(input: {
    confirmationExpiresAt: Date;
    confirmationTokenHash: string;
    consentVersion: string;
    email: string;
    id: string;
    locale: SupportedLocale;
    managementTokenHash: string;
    motivation?: string;
    now: Date;
    purpose: PublicLeadPurpose;
  }): Promise<string>;
  unsubscribe(tokenHash: string, now: Date): Promise<boolean>;
}

export interface PublicLeadEmailProvider {
  send(input: {
    confirmationUrl: string;
    deletionUrl: string;
    email: string;
    idempotencyKey: string;
    locale: SupportedLocale;
    purpose: PublicLeadPurpose;
    unsubscribeUrl: string;
  }): Promise<void>;
}

export interface PublicLeadServiceDependencies {
  appUrl: string;
  createId(): string;
  createToken(): string;
  emailProvider: PublicLeadEmailProvider;
  now(): Date;
  repository: PublicLeadRepository;
  ttlMilliseconds: number;
}

const consentVersion = 'landing-v1';

export function hashPublicLeadToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function buildActionUrl(appUrl: string, action: string, token: string): string {
  const url = new URL('/interest', appUrl);
  url.hash = new URLSearchParams({ action, token }).toString();
  return url.toString();
}

export const prismaPublicLeadRepository: PublicLeadRepository = {
  async convertToAccessRequest(leadId, now) {
    const { prisma } = await import('../../prisma.js');
    return prisma.$transaction(async (transaction) => {
      const lead = await transaction.publicLead.findFirst({
        select: {
          convertedAccessRequestId: true,
          emailNormalized: true,
          locale: true,
        },
        where: { id: leadId, status: 'CONFIRMED' },
      });
      if (!lead) return null;
      if (lead.convertedAccessRequestId) return lead.convertedAccessRequestId;

      const existingRequest = await transaction.accessRequest.findFirst({
        orderBy: { createdAt: 'desc' },
        where: {
          emailNormalized: lead.emailNormalized,
          status: { in: ['PENDING_APPROVAL', 'APPROVED'] },
        },
      });
      const requestId =
        existingRequest?.id ??
        (
          await transaction.accessRequest.create({
            data: {
              emailNormalized: lead.emailNormalized,
              emailVerifiedAt: now,
              locale: lead.locale,
              status: 'PENDING_APPROVAL',
              updatedAt: now,
            },
          })
        ).id;
      await transaction.publicLead.update({
        data: { convertedAccessRequestId: requestId },
        where: { id: leadId },
      });
      return requestId;
    });
  },
  async issue(input) {
    const { prisma } = await import('../../prisma.js');
    const lead = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${input.purpose}:${input.email}`}, 0))`;
      return transaction.publicLead.upsert({
        create: {
          confirmationExpiresAt: input.confirmationExpiresAt,
          confirmationTokenHash: input.confirmationTokenHash,
          consentVersion: input.consentVersion,
          emailNormalized: input.email,
          id: input.id,
          locale: input.locale,
          managementTokenHash: input.managementTokenHash,
          motivation: input.motivation,
          purpose: input.purpose,
          updatedAt: input.now,
        },
        update: {
          confirmationExpiresAt: input.confirmationExpiresAt,
          confirmationTokenHash: input.confirmationTokenHash,
          consentVersion: input.consentVersion,
          deletedAt: null,
          locale: input.locale,
          managementTokenHash: input.managementTokenHash,
          motivation: input.motivation,
          status: 'PENDING_CONFIRMATION',
          unsubscribedAt: null,
          updatedAt: input.now,
        },
        where: {
          emailNormalized_purpose: {
            emailNormalized: input.email,
            purpose: input.purpose,
          },
        },
        select: { id: true },
      });
    });
    return lead.id;
  },
  async confirm(tokenHash, now) {
    const { prisma } = await import('../../prisma.js');
    const result = await prisma.publicLead.updateMany({
      data: {
        confirmationExpiresAt: null,
        confirmationTokenHash: null,
        confirmedAt: now,
        status: 'CONFIRMED',
      },
      where: {
        confirmationExpiresAt: { gt: now },
        confirmationTokenHash: tokenHash,
        status: 'PENDING_CONFIRMATION',
      },
    });
    return result.count === 1;
  },
  async unsubscribe(tokenHash, now) {
    const { prisma } = await import('../../prisma.js');
    const result = await prisma.publicLead.updateMany({
      data: { status: 'UNSUBSCRIBED', unsubscribedAt: now },
      where: {
        managementTokenHash: tokenHash,
        status: { in: ['CONFIRMED', 'PENDING_CONFIRMATION'] },
      },
    });
    return result.count === 1;
  },
  async delete(tokenHash, now) {
    const { prisma } = await import('../../prisma.js');
    const lead = await prisma.publicLead.findUnique({
      select: { id: true },
      where: { managementTokenHash: tokenHash },
    });
    if (!lead) return false;
    await prisma.publicLead.update({
      data: {
        confirmationExpiresAt: null,
        confirmationTokenHash: null,
        deletedAt: now,
        emailNormalized: `deleted-${lead.id}@invalid.local`,
        managementTokenHash: null,
        motivation: null,
        status: 'DELETED',
      },
      where: { id: lead.id },
    });
    return true;
  },
  async export(input) {
    const { prisma } = await import('../../prisma.js');
    return prisma.publicLead.findMany({
      orderBy: { createdAt: 'desc' },
      take: input.limit,
      where: {
        purpose: input.purpose,
        status: input.status,
      },
      select: {
        confirmedAt: true,
        createdAt: true,
        emailNormalized: true,
        id: true,
        locale: true,
        motivation: true,
        purpose: true,
        status: true,
      },
    });
  },
};

export async function requestPublicLead(
  input: {
    email: string;
    locale: SupportedLocale;
    motivation?: string;
    purpose: PublicLeadPurpose;
  },
  dependencies: PublicLeadServiceDependencies,
): Promise<void> {
  const confirmationToken = dependencies.createToken();
  const managementToken = dependencies.createToken();
  const now = dependencies.now();
  const idempotencyKey = await dependencies.repository.issue({
    confirmationExpiresAt: new Date(
      now.getTime() + dependencies.ttlMilliseconds,
    ),
    confirmationTokenHash: hashPublicLeadToken(confirmationToken),
    consentVersion,
    email: input.email,
    id: dependencies.createId(),
    locale: input.locale,
    managementTokenHash: hashPublicLeadToken(managementToken),
    motivation: input.motivation,
    now,
    purpose: input.purpose,
  });
  try {
    await dependencies.emailProvider.send({
      confirmationUrl: buildActionUrl(
        dependencies.appUrl,
        'confirm',
        confirmationToken,
      ),
      deletionUrl: buildActionUrl(
        dependencies.appUrl,
        'delete',
        managementToken,
      ),
      email: input.email,
      idempotencyKey,
      locale: input.locale,
      purpose: input.purpose,
      unsubscribeUrl: buildActionUrl(
        dependencies.appUrl,
        'unsubscribe',
        managementToken,
      ),
    });
  } catch {
    console.error('Public lead confirmation delivery failed.', {
      leadId: idempotencyKey,
    });
  }
}

export function createPublicLeadServiceDependencies(
  environment: NodeJS.ProcessEnv = process.env,
): PublicLeadServiceDependencies | undefined {
  if (environment.LEARNX_PUBLIC_LEADS_ENABLED === 'false') return undefined;
  const apiKey = environment.RESEND_API_KEY;
  const appUrl = environment.APP_URL;
  const from = environment.LEARNX_EMAIL_FROM;
  if (!apiKey || !appUrl || !from) return undefined;
  const origin = new URL(appUrl).origin;
  return {
    appUrl: origin,
    createId: randomUUID,
    createToken: () => randomBytes(32).toString('base64url'),
    emailProvider: {
      async send(input) {
        const early = input.purpose === 'EARLY_ADOPTER';
        const english = input.locale === 'en';
        const subject = english
          ? early
            ? 'Confirm your LearnX early-adopter application'
            : 'Confirm your LearnX launch updates'
          : early
            ? 'Confirme ta candidature early adopter LearnX'
            : 'Confirme ton suivi du lancement LearnX';
        const heading = english
          ? 'Confirm your email address'
          : 'Confirme ton adresse e-mail';
        const confirmLabel = english
          ? 'Confirm my request'
          : 'Confirmer ma demande';
        const unsubscribeLabel = english ? 'Unsubscribe' : 'Se désinscrire';
        const deleteLabel = english
          ? 'Delete my data'
          : 'Supprimer mes données';
        const html = `<h1>${heading}</h1><p><a href="${input.confirmationUrl}">${confirmLabel}</a></p><p><a href="${input.unsubscribeUrl}">${unsubscribeLabel}</a> · <a href="${input.deletionUrl}">${deleteLabel}</a></p>`;
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
            'idempotency-key': `public-lead-${input.idempotencyKey}`,
          },
          body: JSON.stringify({
            from,
            html,
            subject,
            text: `${heading}\n\n${input.confirmationUrl}\n\n${unsubscribeLabel}: ${input.unsubscribeUrl}\n${deleteLabel}: ${input.deletionUrl}`,
            to: [input.email],
          }),
        });
        if (!response.ok)
          throw new Error(
            `Email provider rejected the request (${response.status}).`,
          );
      },
    },
    now: () => new Date(),
    repository: prismaPublicLeadRepository,
    ttlMilliseconds: 24 * 60 * 60 * 1_000,
  };
}
