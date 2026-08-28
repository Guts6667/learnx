import {
  AccountStatus,
  AuditAction,
  type PrismaClient,
  type Role,
} from '../../../../generated/prisma/client.js';
import { createAuditIdempotencyKey, writeAuditEvent } from '../_lib/audit.js';

export const administrableAccountStatuses = ['ACTIVE', 'SUSPENDED'] as const;

type AdministrableAccountStatus =
  (typeof administrableAccountStatuses)[number];

export interface AdministrableAccount {
  accountStatus: AccountStatus;
  createdAt: Date;
  displayName: string;
  email: string;
  id: string;
  role: Role;
  suspendedAt: Date | null;
  updatedAt: Date;
}

interface AccountAdministrationPage {
  items: AdministrableAccount[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface AccountAdministrationFilters {
  page: number;
  pageSize: number;
  search?: string;
  status?: AdministrableAccountStatus;
}

interface AccountTransitionInput {
  expectedStatus: AdministrableAccountStatus;
  expectedUpdatedAt: Date;
}

export type AccountTransitionResult =
  | { account: AdministrableAccount; kind: 'APPLIED' | 'IDEMPOTENT' }
  | { kind: 'CONFLICT' }
  | { kind: 'NOT_FOUND' }
  | { kind: 'ROLE_NOT_ASSIGNABLE' }
  | { kind: 'SELF_SUSPENSION' };

interface AccountRoleTransitionInput {
  expectedRole: Extract<Role, 'CREATOR' | 'USER'>;
  expectedUpdatedAt: Date;
  role: Extract<Role, 'CREATOR' | 'USER'>;
}

export interface AccountAdministrationService {
  assignRole(
    actorUserId: string,
    userId: string,
    input: AccountRoleTransitionInput,
  ): Promise<AccountTransitionResult>;
  list(
    filters: AccountAdministrationFilters,
  ): Promise<AccountAdministrationPage>;
  reactivate(
    actorUserId: string,
    userId: string,
    input: AccountTransitionInput,
  ): Promise<AccountTransitionResult>;
  suspend(
    actorUserId: string,
    userId: string,
    input: AccountTransitionInput,
  ): Promise<AccountTransitionResult>;
}

const accountSelect = {
  accountStatus: true,
  createdAt: true,
  displayName: true,
  email: true,
  id: true,
  role: true,
  suspendedAt: true,
  updatedAt: true,
} as const;

function sameTimestamp(left: Date, right: Date): boolean {
  return left.getTime() === right.getTime();
}

export function createPrismaAccountAdministrationService(
  client: PrismaClient,
): AccountAdministrationService {
  async function assignRole(
    actorUserId: string,
    userId: string,
    input: AccountRoleTransitionInput,
  ): Promise<AccountTransitionResult> {
    return client.$transaction(async (transaction) => {
      const existing = await transaction.user.findUnique({
        select: accountSelect,
        where: { id: userId },
      });
      if (!existing) return { kind: 'NOT_FOUND' } as const;
      if (existing.role !== 'USER' && existing.role !== 'CREATOR') {
        return { kind: 'ROLE_NOT_ASSIGNABLE' } as const;
      }
      if (existing.role === input.role) {
        return { account: existing, kind: 'IDEMPOTENT' } as const;
      }
      if (
        existing.role !== input.expectedRole ||
        !sameTimestamp(existing.updatedAt, input.expectedUpdatedAt)
      ) {
        return { kind: 'CONFLICT' } as const;
      }

      const update = await transaction.user.updateMany({
        data: { role: input.role },
        where: {
          id: userId,
          role: existing.role,
          updatedAt: existing.updatedAt,
        },
      });
      if (update.count !== 1) {
        const current = await transaction.user.findUnique({
          select: accountSelect,
          where: { id: userId },
        });
        if (current && current.role === input.role) {
          return { account: current, kind: 'IDEMPOTENT' } as const;
        }
        return { kind: 'CONFLICT' } as const;
      }

      const auditValues = {
        fromRole: existing.role,
        previousUpdatedAt: existing.updatedAt.toISOString(),
        toRole: input.role,
      };
      await writeAuditEvent(transaction, {
        action: AuditAction.ACCOUNT_ROLE_ASSIGN,
        actorUserId,
        idempotencyKey: createAuditIdempotencyKey(
          AuditAction.ACCOUNT_ROLE_ASSIGN,
          userId,
          auditValues,
        ),
        metadata: auditValues,
        targetId: userId,
        targetType: 'user',
      });
      const account = await transaction.user.findUniqueOrThrow({
        select: accountSelect,
        where: { id: userId },
      });
      return { account, kind: 'APPLIED' } as const;
    });
  }

  async function transition(
    actorUserId: string,
    userId: string,
    input: AccountTransitionInput,
    targetStatus: AccountStatus,
  ): Promise<AccountTransitionResult> {
    if (targetStatus === AccountStatus.SUSPENDED && actorUserId === userId) {
      return { kind: 'SELF_SUSPENSION' };
    }

    return client.$transaction(async (transaction) => {
      const existing = await transaction.user.findUnique({
        select: accountSelect,
        where: { id: userId },
      });
      if (!existing) return { kind: 'NOT_FOUND' } as const;

      if (existing.accountStatus === targetStatus) {
        if (targetStatus === AccountStatus.SUSPENDED) {
          await transaction.session.deleteMany({ where: { userId } });
        }
        return { account: existing, kind: 'IDEMPOTENT' } as const;
      }

      if (
        existing.accountStatus !== input.expectedStatus ||
        !sameTimestamp(existing.updatedAt, input.expectedUpdatedAt)
      ) {
        return { kind: 'CONFLICT' } as const;
      }

      const now = new Date();
      const update = await transaction.user.updateMany({
        data: {
          accountStatus: targetStatus,
          suspendedAt:
            targetStatus === AccountStatus.SUSPENDED ? now : null,
        },
        where: {
          accountStatus: existing.accountStatus,
          id: userId,
          updatedAt: existing.updatedAt,
        },
      });
      if (update.count !== 1) {
        const current = await transaction.user.findUnique({
          select: accountSelect,
          where: { id: userId },
        });
        if (current?.accountStatus === targetStatus) {
          if (targetStatus === AccountStatus.SUSPENDED) {
            await transaction.session.deleteMany({ where: { userId } });
          }
          return { account: current, kind: 'IDEMPOTENT' } as const;
        }
        return { kind: 'CONFLICT' } as const;
      }

      if (targetStatus === AccountStatus.SUSPENDED) {
        await transaction.session.deleteMany({ where: { userId } });
      }

      const action =
        targetStatus === AccountStatus.SUSPENDED
          ? AuditAction.ACCOUNT_SUSPEND
          : AuditAction.ACCOUNT_REACTIVATE;
      const auditValues = {
        fromStatus: existing.accountStatus,
        previousUpdatedAt: existing.updatedAt.toISOString(),
        toStatus: targetStatus,
      };
      await writeAuditEvent(transaction, {
        action,
        actorUserId,
        idempotencyKey: createAuditIdempotencyKey(
          action,
          userId,
          auditValues,
        ),
        metadata: auditValues,
        targetId: userId,
        targetType: 'user',
      });

      const account = await transaction.user.findUniqueOrThrow({
        select: accountSelect,
        where: { id: userId },
      });
      return { account, kind: 'APPLIED' } as const;
    });
  }

  return {
    assignRole,
    async list(filters) {
      const where = {
        accountStatus: filters.status,
        OR: filters.search
          ? [
              {
                displayName: {
                  contains: filters.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                email: {
                  contains: filters.search,
                  mode: 'insensitive' as const,
                },
              },
            ]
          : undefined,
      };
      const [total, accounts] = await client.$transaction([
        client.user.count({ where }),
        client.user.findMany({
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: accountSelect,
          skip: (filters.page - 1) * filters.pageSize,
          take: filters.pageSize,
          where,
        }),
      ]);

      return {
        items: accounts,
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
      };
    },
    reactivate(actorUserId, userId, input) {
      return transition(
        actorUserId,
        userId,
        input,
        AccountStatus.ACTIVE,
      );
    },
    suspend(actorUserId, userId, input) {
      return transition(
        actorUserId,
        userId,
        input,
        AccountStatus.SUSPENDED,
      );
    },
  };
}
