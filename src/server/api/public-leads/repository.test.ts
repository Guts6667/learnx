import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { createPrismaPublicLeadRepository } from './repository.js';

const now = new Date('2026-08-28T08:00:00.000Z');

function createTransaction(overrides: Record<string, unknown> = {}) {
  return {
    $executeRaw: vi.fn(async (...arguments_: unknown[]) => {
      void arguments_;
      return 1;
    }),
    accessRequest: {
      create: vi.fn(async () => ({ id: 'request-new' })),
      findFirst: vi.fn(async () => null),
    },
    publicContact: {
      update: vi.fn(async () => ({})),
      upsert: vi.fn(async () => ({ id: 'contact-id' })),
    },
    publicLead: {
      count: vi.fn(async () => 0),
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
      upsert: vi.fn(async () => ({ id: 'lead-id' })),
    },
    ...overrides,
  };
}

function createClient(transaction: ReturnType<typeof createTransaction>) {
  return {
    $transaction: vi.fn(async (input: unknown) => {
      if (typeof input === 'function') return input(transaction);
      return Promise.all(input as Promise<unknown>[]);
    }),
    publicContact: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
    },
    publicLead: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  } as unknown as PrismaClient;
}

describe('Prisma public lead repository', () => {
  it('locks and upserts one consent independently per purpose', async () => {
    const transaction = createTransaction();
    const repository = createPrismaPublicLeadRepository(
      createClient(transaction),
    );

    await repository.issue({
      confirmationExpiresAt: new Date('2026-08-29T08:00:00.000Z'),
      confirmationTokenHash: 'confirmation-hash',
      consentVersion: 'landing-v1',
      email: 'reader@example.com',
      id: 'contact-id',
      locale: 'fr',
      managementTokenHash: 'management-hash',
      motivation: 'Je souhaite participer au pilote LearnX.',
      now,
      purpose: 'EARLY_ADOPTER',
    });

    expect(transaction.$executeRaw).toHaveBeenCalledOnce();
    expect(transaction.$executeRaw.mock.calls[0]?.[1]).toBe(
      'EARLY_ADOPTER:reader@example.com',
    );
    expect(transaction.publicLead.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          contactId_purpose: {
            contactId: 'contact-id',
            purpose: 'EARLY_ADOPTER',
          },
        },
      }),
    );
  });

  it('only confirms a pending and unexpired request', async () => {
    const transaction = createTransaction();
    const client = createClient(transaction);
    const repository = createPrismaPublicLeadRepository(client);

    await expect(repository.confirm('confirmation-hash', now)).resolves.toBe(
      true,
    );

    expect(client.publicLead.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          confirmationExpiresAt: { gt: now },
          confirmationTokenHash: 'confirmation-hash',
          status: 'PENDING_CONFIRMATION',
        },
      }),
    );
  });

  it('reuses a converted access request without creating a duplicate', async () => {
    const transaction = createTransaction({
      publicLead: {
        ...createTransaction().publicLead,
        findFirst: vi.fn(async () => ({
          contact: { emailNormalized: 'reader@example.com' },
          convertedAccessRequestId: 'request-existing',
          locale: 'fr',
        })),
      },
    });
    const repository = createPrismaPublicLeadRepository(
      createClient(transaction),
    );

    await expect(
      repository.convertToAccessRequest('lead-id', now),
    ).resolves.toBe('request-existing');
    expect(transaction.accessRequest.create).not.toHaveBeenCalled();
    expect(transaction.publicLead.update).not.toHaveBeenCalled();
  });

  it('anonymizes the contact only after its final consent is deleted', async () => {
    const publicLead = {
      ...createTransaction().publicLead,
      count: vi.fn(async () => 0),
      findUnique: vi.fn(async () => ({
        contactId: 'contact-id',
        id: 'lead-id',
      })),
    };
    const transaction = createTransaction({ publicLead });
    const repository = createPrismaPublicLeadRepository(
      createClient(transaction),
    );

    await expect(repository.delete('management-hash', now)).resolves.toBe(true);
    expect(transaction.publicContact.update).toHaveBeenCalledWith({
      data: {
        emailNormalized: 'deleted-contact-id@invalid.local',
        updatedAt: now,
      },
      where: { id: 'contact-id' },
    });
    expect(publicLead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          confirmationTokenHash: null,
          managementTokenHash: null,
          motivation: null,
          status: 'DELETED',
        }),
      }),
    );
  });
});
