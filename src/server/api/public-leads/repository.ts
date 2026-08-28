import { randomUUID } from 'node:crypto';

import type {
  Prisma,
  PrismaClient,
} from '../../../../generated/prisma/client.js';
import type {
  PublicContactPage,
  PublicLeadExportInput,
  PublicLeadExportRow,
  PublicLeadIssueInput,
  PublicLeadListInput,
  PublicLeadRepository,
} from './types.js';

async function findOrCreateAccessRequest(
  transaction: Prisma.TransactionClient,
  lead: { contact: { emailNormalized: string }; locale: string },
  now: Date,
) {
  const existingRequest = await transaction.accessRequest.findFirst({
    orderBy: { createdAt: 'desc' },
    where: {
      emailNormalized: lead.contact.emailNormalized,
      status: { in: ['PENDING_APPROVAL', 'APPROVED'] },
    },
  });
  if (existingRequest) return existingRequest.id;
  const created = await transaction.accessRequest.create({
    data: {
      emailNormalized: lead.contact.emailNormalized,
      emailVerifiedAt: now,
      locale: lead.locale,
      status: 'PENDING_APPROVAL',
      updatedAt: now,
    },
  });
  return created.id;
}

async function convertLead(
  client: PrismaClient,
  leadId: string,
  now: Date,
): Promise<string | null> {
  return client.$transaction(async (transaction) => {
    const lead = await transaction.publicLead.findFirst({
      select: {
        contact: { select: { emailNormalized: true } },
        convertedAccessRequestId: true,
        locale: true,
      },
      where: { id: leadId, status: 'CONFIRMED' },
    });
    if (!lead) return null;
    if (lead.convertedAccessRequestId) return lead.convertedAccessRequestId;
    const requestId = await findOrCreateAccessRequest(transaction, lead, now);
    await transaction.publicLead.update({
      data: { convertedAccessRequestId: requestId },
      where: { id: leadId },
    });
    return requestId;
  });
}

function buildLeadCreate(contactId: string, input: PublicLeadIssueInput) {
  return {
    contactId,
    confirmationExpiresAt: input.confirmationExpiresAt,
    confirmationTokenHash: input.confirmationTokenHash,
    consentVersion: input.consentVersion,
    id: randomUUID(),
    locale: input.locale,
    managementTokenHash: input.managementTokenHash,
    motivation: input.motivation,
    purpose: input.purpose,
    updatedAt: input.now,
  };
}

function buildLeadUpdate(input: PublicLeadIssueInput) {
  return {
    confirmationExpiresAt: input.confirmationExpiresAt,
    confirmationTokenHash: input.confirmationTokenHash,
    consentVersion: input.consentVersion,
    deletedAt: null,
    locale: input.locale,
    managementTokenHash: input.managementTokenHash,
    motivation: input.motivation,
    status: 'PENDING_CONFIRMATION' as const,
    unsubscribedAt: null,
    updatedAt: input.now,
  };
}

async function issueLead(client: PrismaClient, input: PublicLeadIssueInput) {
  const lead = await client.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${input.purpose}:${input.email}`}, 0))`;
    const contact = await transaction.publicContact.upsert({
      create: {
        emailNormalized: input.email,
        id: input.id,
        updatedAt: input.now,
      },
      update: { updatedAt: input.now },
      where: { emailNormalized: input.email },
    });
    return transaction.publicLead.upsert({
      create: buildLeadCreate(contact.id, input),
      update: buildLeadUpdate(input),
      where: {
        contactId_purpose: { contactId: contact.id, purpose: input.purpose },
      },
      select: { id: true },
    });
  });
  return lead.id;
}

async function anonymizeContact(
  transaction: Prisma.TransactionClient,
  contactId: string,
  now: Date,
) {
  await transaction.publicContact.update({
    data: {
      emailNormalized: `deleted-${contactId}@invalid.local`,
      updatedAt: now,
    },
    where: { id: contactId },
  });
}

async function deleteLead(client: PrismaClient, tokenHash: string, now: Date) {
  return client.$transaction(async (transaction) => {
    const lead = await transaction.publicLead.findUnique({
      select: { contactId: true, id: true },
      where: { managementTokenHash: tokenHash },
    });
    if (!lead) return false;
    await transaction.publicLead.update({
      data: {
        confirmationExpiresAt: null,
        confirmationTokenHash: null,
        deletedAt: now,
        managementTokenHash: null,
        motivation: null,
        status: 'DELETED',
      },
      where: { id: lead.id },
    });
    const remaining = await transaction.publicLead.count({
      where: { contactId: lead.contactId, status: { not: 'DELETED' } },
    });
    if (remaining === 0) {
      await anonymizeContact(transaction, lead.contactId, now);
    }
    return true;
  });
}

async function exportLeads(
  client: PrismaClient,
  input: PublicLeadExportInput,
): Promise<PublicLeadExportRow[]> {
  const rows = await client.publicLead.findMany({
    orderBy: { createdAt: 'desc' },
    take: input.limit,
    where: { purpose: input.purpose, status: input.status },
    select: {
      contact: { select: { emailNormalized: true } },
      confirmedAt: true,
      createdAt: true,
      id: true,
      locale: true,
      motivation: true,
      purpose: true,
      status: true,
    },
  });
  return rows.map(({ contact, ...row }) => ({
    ...row,
    emailNormalized: contact.emailNormalized,
  }));
}

function buildContactWhere(input: PublicLeadListInput) {
  const leadFilter = input.purpose
    ? { some: { purpose: input.purpose, status: { not: 'DELETED' as const } } }
    : { some: { status: { not: 'DELETED' as const } } };
  return {
    emailNormalized: input.search
      ? { contains: input.search, mode: 'insensitive' as const }
      : undefined,
    leads: leadFilter,
  };
}

async function listContacts(
  client: PrismaClient,
  input: PublicLeadListInput,
): Promise<PublicContactPage> {
  const where = buildContactWhere(input);
  const [contacts, total, launchUpdatesConfirmed, earlyAdopterApplications] =
    await client.$transaction([
      client.publicContact.findMany({
        orderBy: { createdAt: 'desc' },
        skip: input.offset,
        take: input.limit,
        where,
        select: {
          createdAt: true,
          emailNormalized: true,
          id: true,
          leads: {
            orderBy: { createdAt: 'asc' },
            where: { status: { not: 'DELETED' } },
            select: {
              confirmedAt: true,
              createdAt: true,
              locale: true,
              motivation: true,
              purpose: true,
              status: true,
            },
          },
        },
      }),
      client.publicContact.count({ where }),
      client.publicLead.count({
        where: { purpose: 'LAUNCH_UPDATES', status: 'CONFIRMED' },
      }),
      client.publicLead.count({
        where: { purpose: 'EARLY_ADOPTER', status: { not: 'DELETED' } },
      }),
    ]);
  return {
    earlyAdopterApplications,
    items: contacts.map(({ leads, ...contact }) => ({
      ...contact,
      purposes: leads,
    })),
    launchUpdatesConfirmed,
    limit: input.limit,
    offset: input.offset,
    total,
  };
}

export function createPrismaPublicLeadRepository(
  client: PrismaClient,
): PublicLeadRepository {
  return {
    convertToAccessRequest: (leadId, now) => convertLead(client, leadId, now),
    async confirm(tokenHash, now) {
      const result = await client.publicLead.updateMany({
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
    delete: (tokenHash, now) => deleteLead(client, tokenHash, now),
    export: (input) => exportLeads(client, input),
    issue: (input) => issueLead(client, input),
    list: (input) => listContacts(client, input),
    async unsubscribe(tokenHash, now) {
      const result = await client.publicLead.updateMany({
        data: { status: 'UNSUBSCRIBED', unsubscribedAt: now },
        where: {
          managementTokenHash: tokenHash,
          status: { in: ['CONFIRMED', 'PENDING_CONFIRMATION'] },
        },
      });
      return result.count === 1;
    },
  };
}

async function getPrismaRepository() {
  const { prisma } = await import('../../prisma.js');
  return createPrismaPublicLeadRepository(prisma);
}

export const prismaPublicLeadRepository: PublicLeadRepository = {
  async convertToAccessRequest(leadId, now) {
    return (await getPrismaRepository()).convertToAccessRequest(leadId, now);
  },
  async confirm(tokenHash, now) {
    return (await getPrismaRepository()).confirm(tokenHash, now);
  },
  async delete(tokenHash, now) {
    return (await getPrismaRepository()).delete(tokenHash, now);
  },
  async export(input) {
    return (await getPrismaRepository()).export(input);
  },
  async issue(input) {
    return (await getPrismaRepository()).issue(input);
  },
  async list(input) {
    return (await getPrismaRepository()).list(input);
  },
  async unsubscribe(tokenHash, now) {
    return (await getPrismaRepository()).unsubscribe(tokenHash, now);
  },
};
