import type { PrismaClient } from '../../generated/prisma/client';
import {
  createPrismaAccountAdministrationService,
  type AdministrableAccount,
} from '../../src/server/api/admin/account-administration-service';

const actorUserId = '7c777cf7-8f6b-421c-88f4-d17c8d530e93';
const accountId = 'ceffb1eb-0681-4c4d-bf50-50e673f65ca4';

function createFixture(initialRole: AdministrableAccount['role'] = 'USER') {
  let account: AdministrableAccount = {
    accountStatus: 'ACTIVE',
    createdAt: new Date('2026-08-05T08:00:00.000Z'),
    displayName: 'Learner',
    email: 'learner@example.com',
    id: accountId,
    role: initialRole,
    suspendedAt: null,
    updatedAt: new Date('2026-08-05T08:00:00.000Z'),
  };
  const sessions = new Set(['session-1', 'session-2']);
  const audits: Array<{ action: string; idempotencyKey: string }> = [];
  const transaction = {
    auditEvent: {
      upsert: vi.fn(async (input: {
        create: { action: string; idempotencyKey: string };
      }) => {
        if (
          !audits.some(
            (audit) =>
              audit.action === input.create.action &&
              audit.idempotencyKey === input.create.idempotencyKey,
          )
        ) {
          audits.push({
            action: input.create.action,
            idempotencyKey: input.create.idempotencyKey,
          });
        }
        return input.create;
      }),
    },
    session: {
      deleteMany: vi.fn(async () => {
        const count = sessions.size;
        sessions.clear();
        return { count };
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === account.id ? { ...account } : null,
      ),
      findUniqueOrThrow: vi.fn(
        async ({ where }: { where: { id: string } }) => {
          if (where.id !== account.id) throw new Error('Account not found.');
          return { ...account };
        },
      ),
      updateMany: vi.fn(
        async (input: {
          data: Partial<
            Pick<AdministrableAccount, 'accountStatus' | 'role' | 'suspendedAt'>
          >;
          where: {
            accountStatus?: AdministrableAccount['accountStatus'];
            id: string;
            role?: AdministrableAccount['role'];
            updatedAt: Date;
          };
        }) => {
          if (
            input.where.id !== account.id ||
            (input.where.accountStatus !== undefined &&
              input.where.accountStatus !== account.accountStatus) ||
            (input.where.role !== undefined && input.where.role !== account.role) ||
            input.where.updatedAt.getTime() !== account.updatedAt.getTime()
          ) {
            return { count: 0 };
          }
          account = {
            ...account,
            ...input.data,
            updatedAt: new Date(account.updatedAt.getTime() + 1_000),
          };
          return { count: 1 };
        },
      ),
    },
  };
  const client = {
    $transaction: vi.fn(async (input: unknown) => {
      if (typeof input === 'function') {
        return (
          input as (value: typeof transaction) => Promise<unknown>
        )(transaction);
      }
      return Promise.all(input as Promise<unknown>[]);
    }),
    user: {
      count: vi.fn(async () => 1),
      findMany: vi.fn(async () => [{ ...account }]),
    },
  } as unknown as PrismaClient;

  return {
    audits,
    getAccount: () => account,
    service: createPrismaAccountAdministrationService(client),
    sessions,
    transaction,
  };
}

describe('account administration service', () => {
  it('attribue Créateur atomiquement, conserve les sessions et audite', async () => {
    const fixture = createFixture();
    const before = fixture.getAccount();

    const result = await fixture.service.assignRole(actorUserId, accountId, {
      expectedRole: 'USER',
      expectedUpdatedAt: before.updatedAt,
      role: 'CREATOR',
    });

    expect(result).toMatchObject({
      account: { id: accountId, role: 'CREATOR' },
      kind: 'APPLIED',
    });
    expect(fixture.sessions.size).toBe(2);
    expect(fixture.audits).toHaveLength(1);
    expect(fixture.audits[0]?.action).toBe('ACCOUNT_ROLE_ASSIGN');
    expect(fixture.transaction.session.deleteMany).not.toHaveBeenCalled();
  });

  it('rend l’attribution concurrente idempotente sans dupliquer l’audit', async () => {
    const fixture = createFixture();
    const input = {
      expectedRole: 'USER' as const,
      expectedUpdatedAt: fixture.getAccount().updatedAt,
      role: 'CREATOR' as const,
    };

    const results = await Promise.all([
      fixture.service.assignRole(actorUserId, accountId, input),
      fixture.service.assignRole(actorUserId, accountId, input),
    ]);

    expect(results.map((result) => result.kind).sort()).toEqual([
      'APPLIED',
      'IDEMPOTENT',
    ]);
    expect(fixture.audits).toHaveLength(1);
  });

  it('rétrograde Créateur sans supprimer ses données personnelles', async () => {
    const fixture = createFixture('CREATOR');
    const before = fixture.getAccount();

    const result = await fixture.service.assignRole(actorUserId, accountId, {
      expectedRole: 'CREATOR',
      expectedUpdatedAt: before.updatedAt,
      role: 'USER',
    });

    expect(result).toMatchObject({
      account: { id: accountId, role: 'USER' },
      kind: 'APPLIED',
    });
    expect(fixture.sessions.size).toBe(2);
  });

  it('refuse de modifier un rôle Administrateur', async () => {
    const fixture = createFixture('ADMIN');

    await expect(
      fixture.service.assignRole(actorUserId, accountId, {
        expectedRole: 'USER',
        expectedUpdatedAt: fixture.getAccount().updatedAt,
        role: 'CREATOR',
      }),
    ).resolves.toEqual({ kind: 'ROLE_NOT_ASSIGNABLE' });
    expect(fixture.transaction.user.updateMany).not.toHaveBeenCalled();
    expect(fixture.audits).toHaveLength(0);
  });

  it('suspend atomiquement le compte, révoque toutes les sessions et audite', async () => {
    const fixture = createFixture();
    const before = fixture.getAccount();

    const result = await fixture.service.suspend(actorUserId, accountId, {
      expectedStatus: 'ACTIVE',
      expectedUpdatedAt: before.updatedAt,
    });

    expect(result).toMatchObject({
      account: { accountStatus: 'SUSPENDED', id: accountId },
      kind: 'APPLIED',
    });
    expect(fixture.sessions.size).toBe(0);
    expect(fixture.audits).toHaveLength(1);
    expect(fixture.audits[0]?.action).toBe('ACCOUNT_SUSPEND');
    expect(fixture.transaction.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: accountId },
    });
  });

  it('rend les retries idempotents sans dupliquer l’audit', async () => {
    const fixture = createFixture();
    const input = {
      expectedStatus: 'ACTIVE' as const,
      expectedUpdatedAt: fixture.getAccount().updatedAt,
    };

    const results = await Promise.all([
      fixture.service.suspend(actorUserId, accountId, input),
      fixture.service.suspend(actorUserId, accountId, input),
    ]);

    expect(results.map((result) => result.kind).sort()).toEqual([
      'APPLIED',
      'IDEMPOTENT',
    ]);
    expect(fixture.audits).toHaveLength(1);
  });

  it('réactive sans restaurer les sessions précédemment révoquées', async () => {
    const fixture = createFixture();
    const before = fixture.getAccount();
    await fixture.service.suspend(actorUserId, accountId, {
      expectedStatus: 'ACTIVE',
      expectedUpdatedAt: before.updatedAt,
    });
    const suspended = fixture.getAccount();

    const result = await fixture.service.reactivate(actorUserId, accountId, {
      expectedStatus: 'SUSPENDED',
      expectedUpdatedAt: suspended.updatedAt,
    });

    expect(result).toMatchObject({
      account: { accountStatus: 'ACTIVE', suspendedAt: null },
      kind: 'APPLIED',
    });
    expect(fixture.sessions.size).toBe(0);
    expect(fixture.audits.map((audit) => audit.action)).toEqual([
      'ACCOUNT_SUSPEND',
      'ACCOUNT_REACTIVATE',
    ]);
  });

  it('refuse la suspension du compte administrateur courant', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.suspend(accountId, accountId, {
        expectedStatus: 'ACTIVE',
        expectedUpdatedAt: fixture.getAccount().updatedAt,
      }),
    ).resolves.toEqual({ kind: 'SELF_SUSPENSION' });
    expect(fixture.transaction.user.updateMany).not.toHaveBeenCalled();
  });

  it('liste les comptes avec une pagination bornée', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.list({
        page: 1,
        pageSize: 20,
        search: 'learner',
        status: 'ACTIVE',
      }),
    ).resolves.toMatchObject({
      items: [{ id: accountId }],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
  });
});
