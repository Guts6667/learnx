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

  it('reuses an active access request when the lead is not linked yet', async () => {
    const transaction = createTransaction({
      accessRequest: {
        create: vi.fn(async () => ({ id: 'request-new' })),
        findFirst: vi.fn(async () => ({ id: 'request-existing' })),
      },
      publicLead: {
        ...createTransaction().publicLead,
        findFirst: vi.fn(async () => ({
          contact: { emailNormalized: 'reader@example.com' },
          convertedAccessRequestId: null,
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
    expect(transaction.publicLead.update).toHaveBeenCalledWith({
      data: { convertedAccessRequestId: 'request-existing' },
      where: { id: 'lead-id' },
    });
  });

  it('creates an access request when no active request exists', async () => {
    const transaction = createTransaction({
      publicLead: {
        ...createTransaction().publicLead,
        findFirst: vi.fn(async () => ({
          contact: { emailNormalized: 'reader@example.com' },
          convertedAccessRequestId: null,
          locale: 'fr',
        })),
      },
    });
    const repository = createPrismaPublicLeadRepository(
      createClient(transaction),
    );

    await expect(
      repository.convertToAccessRequest('lead-id', now),
    ).resolves.toBe('request-new');
    expect(transaction.accessRequest.create).toHaveBeenCalledOnce();
    expect(transaction.publicLead.update).toHaveBeenCalledWith({
      data: { convertedAccessRequestId: 'request-new' },
      where: { id: 'lead-id' },
    });
  });

  it('serializes concurrent conversions and creates one access request', async () => {
    let convertedAccessRequestId: string | null = null;
    let createdAccessRequestId: string | null = null;
    const transaction = createTransaction({
      accessRequest: {
        create: vi.fn(async () => {
          createdAccessRequestId = 'request-new';
          return { id: createdAccessRequestId };
        }),
        findFirst: vi.fn(async () =>
          createdAccessRequestId ? { id: createdAccessRequestId } : null,
        ),
      },
      publicLead: {
        ...createTransaction().publicLead,
        findFirst: vi.fn(async () => ({
          contact: { emailNormalized: 'reader@example.com' },
          convertedAccessRequestId,
          locale: 'fr',
        })),
        update: vi.fn(async ({ data }) => {
          convertedAccessRequestId = data.convertedAccessRequestId;
          return {};
        }),
      },
    });
    let transactionQueue = Promise.resolve();
    const client = createClient(transaction);
    const concurrentTransaction = vi.fn(async (callback: unknown) => {
      const prior = transactionQueue;
      let release: () => void = () => {};
      transactionQueue = new Promise<void>((resolve) => {
        release = resolve;
      });
      await prior;
      try {
        return await (callback as (value: typeof transaction) => unknown)(
          transaction,
        );
      } finally {
        release();
      }
    });
    Object.assign(client, { $transaction: concurrentTransaction });
    const repository = createPrismaPublicLeadRepository(client);

    await expect(
      Promise.all([
        repository.convertToAccessRequest('lead-id', now),
        repository.convertToAccessRequest('lead-id', now),
      ]),
    ).resolves.toEqual(['request-new', 'request-new']);
    expect(transaction.accessRequest.create).toHaveBeenCalledOnce();
    expect(transaction.$executeRaw).toHaveBeenCalledTimes(2);
    expect(transaction.$executeRaw.mock.calls[0]?.[1]).toBe(
      'public-lead-conversion:lead-id',
    );
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

  it('preserves the contact while another consent remains active', async () => {
    const publicLead = {
      ...createTransaction().publicLead,
      count: vi.fn(async () => 1),
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
    expect(transaction.publicContact.update).not.toHaveBeenCalled();
  });

  it('keeps two purposes for the same email as distinct consents', async () => {
    const transaction = createTransaction();
    const repository = createPrismaPublicLeadRepository(
      createClient(transaction),
    );
    const common = {
      confirmationExpiresAt: new Date('2026-08-29T08:00:00.000Z'),
      confirmationTokenHash: 'confirmation-hash',
      consentVersion: 'landing-v1',
      email: 'reader@example.com',
      id: 'contact-id',
      locale: 'fr' as const,
      managementTokenHash: 'management-hash',
      now,
    };

    await repository.issue({ ...common, purpose: 'LAUNCH_UPDATES' });
    await repository.issue({ ...common, purpose: 'EARLY_ADOPTER' });

    expect(transaction.publicContact.upsert).toHaveBeenCalledTimes(2);
    expect(transaction.publicLead.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          contactId_purpose: {
            contactId: 'contact-id',
            purpose: 'LAUNCH_UPDATES',
          },
        },
      }),
    );
    expect(transaction.publicLead.upsert).toHaveBeenNthCalledWith(
      2,
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

  it('returns list metrics and applies the contact filters', async () => {
    const transaction = createTransaction();
    const findMany = vi.fn(async () => []);
    const contactCount = vi.fn(async () => 4);
    const leadCount = vi.fn().mockResolvedValueOnce(7).mockResolvedValueOnce(3);
    const client = createClient(transaction);
    Object.assign(client.publicContact, {
      count: contactCount,
      findMany,
    });
    Object.assign(client.publicLead, { count: leadCount });
    const repository = createPrismaPublicLeadRepository(client);

    await expect(
      repository.list({
        limit: 25,
        offset: 10,
        purpose: 'EARLY_ADOPTER',
        search: 'reader',
      }),
    ).resolves.toEqual({
      earlyAdopterApplications: 3,
      items: [],
      launchUpdatesConfirmed: 7,
      limit: 25,
      offset: 10,
      total: 4,
    });
    const contactWhere = {
      emailNormalized: { contains: 'reader', mode: 'insensitive' },
      leads: {
        some: { purpose: 'EARLY_ADOPTER', status: { not: 'DELETED' } },
      },
    };
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 25, where: contactWhere }),
    );
    expect(contactCount).toHaveBeenCalledWith({
      where: contactWhere,
    });
    expect(leadCount).toHaveBeenNthCalledWith(1, {
      where: { purpose: 'LAUNCH_UPDATES', status: 'CONFIRMED' },
    });
    expect(leadCount).toHaveBeenNthCalledWith(2, {
      where: { purpose: 'EARLY_ADOPTER', status: { not: 'DELETED' } },
    });
  });
});
