import {
  AuditAction,
  CreditIncreaseRequestStatus,
  CreditLedgerEntryType,
  CreditPolicyStatus,
  CreditProvenance,
  Prisma,
  type PrismaClient,
} from '../../../generated/prisma/client.js';
import { createAuditIdempotencyKey, writeAuditEvent } from '../api/_lib/audit.js';
import {
  assertAdjustmentReason,
  assertIdempotencyKey,
  creditRequestFingerprint,
  type CreditProvenanceValue,
} from './credit-ledger.js';
import {
  PrismaCreditLedger,
  type AdjustCreditsInput,
} from './prisma-credit-ledger.js';

export interface CreditProjectionPart {
  available: bigint;
  consumed: bigint;
  expired: bigint;
  reserved: bigint;
}

export interface CreditProjection {
  free: CreditProjectionPart;
  purchased: CreditProjectionPart;
  totalAvailable: bigint;
  totalReserved: bigint;
}

export interface CreditHistoryItem {
  actorUserId: string | null;
  amount: bigint;
  createdAt: Date;
  entryId: string;
  provenance: CreditProvenanceValue;
  reason: string | null;
  referenceId: string;
  referenceType: string;
  type: CreditLedgerEntryType;
}

export interface CreditMemberSummary {
  accountStatus: 'ACTIVE' | 'SUSPENDED';
  displayName: string;
  email: string;
  projection: CreditProjection;
  userId: string;
}

export interface CreditMemberDetail extends CreditMemberSummary {
  history: CreditHistoryItem[];
  pendingIncreaseRequest: {
    createdAt: Date;
    id: string;
    reason: string;
  } | null;
}

export interface CreditMemberPage {
  items: CreditMemberSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CreditPolicySummary {
  id: string;
  key: string;
  status: CreditPolicyStatus;
  version: string;
}

export interface CreditAdministrationService {
  adjustFreeAllocation(input: AdjustCreditsInput): Promise<CreditMemberDetail>;
  createIncreaseRequest(input: {
    idempotencyKey: string;
    reason: string;
    userId: string;
  }): Promise<{ createdAt: Date; id: string; reason: string; status: string }>;
  getMember(actorUserId: string, userId: string): Promise<CreditMemberDetail | null>;
  getOwnCredits(userId: string): Promise<CreditMemberDetail | null>;
  listMembers(input: {
    actorUserId: string;
    page: number;
    pageSize: number;
    search?: string;
  }): Promise<CreditMemberPage>;
  listPolicies(): Promise<{
    allocation: CreditPolicySummary[];
    limits: CreditPolicySummary[];
  }>;
  reviewIncreaseRequest(input: {
    actorUserId: string;
    idempotencyKey: string;
    requestId: string;
    reviewReason: string;
    status: 'APPROVED' | 'REJECTED';
  }): Promise<void>;
}

interface ProjectionEntry {
  amount: bigint;
  provenance: CreditProvenance;
  type: CreditLedgerEntryType;
}

function emptyPart(): CreditProjectionPart {
  return { available: 0n, consumed: 0n, expired: 0n, reserved: 0n };
}

export function deriveCreditProjection(
  entries: readonly ProjectionEntry[],
): CreditProjection {
  const free = emptyPart();
  const purchased = emptyPart();
  for (const entry of entries) {
    const target =
      entry.provenance === CreditProvenance.FREE_ALLOCATION
        ? free
        : purchased;
    target.available += entry.amount;
    if (entry.type === CreditLedgerEntryType.SETTLEMENT) {
      target.consumed += -entry.amount;
    }
    if (entry.type === CreditLedgerEntryType.EXPIRATION) {
      target.expired += -entry.amount;
    }
    if (
      entry.type === CreditLedgerEntryType.RESERVATION_HOLD ||
      entry.type === CreditLedgerEntryType.RESERVATION_RELEASE
    ) {
      target.reserved -= entry.amount;
    }
  }
  if (
    free.available < 0n ||
    purchased.available < 0n ||
    free.reserved < 0n ||
    purchased.reserved < 0n
  ) {
    throw new Error('CREDIT_LEDGER_INCONSISTENT');
  }
  return {
    free,
    purchased,
    totalAvailable: free.available + purchased.available,
    totalReserved: free.reserved + purchased.reserved,
  };
}

function provenance(value: CreditProvenance): CreditProvenanceValue {
  return value === CreditProvenance.FREE_ALLOCATION
    ? 'FREE_ALLOCATION'
    : 'PURCHASED';
}

export class PrismaCreditAdministrationService
  implements CreditAdministrationService
{
  private readonly ledger: PrismaCreditLedger;

  public constructor(
    private readonly client: PrismaClient,
    private readonly clock: () => Date = () => new Date(),
  ) {
    this.ledger = new PrismaCreditLedger(client, clock);
  }

  private async detail(userId: string): Promise<CreditMemberDetail | null> {
    await this.ledger.getBalance(userId);
    const user = await this.client.user.findUnique({
      where: { id: userId },
      select: {
        accountStatus: true,
        displayName: true,
        email: true,
        id: true,
        creditAccounts: {
          select: {
            ledgerEntries: {
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              select: {
                actorUserId: true,
                amount: true,
                createdAt: true,
                id: true,
                provenance: true,
                reason: true,
                referenceId: true,
                referenceType: true,
                type: true,
              },
            },
          },
        },
        creditIncreaseRequests: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          where: { status: CreditIncreaseRequestStatus.PENDING },
          select: { createdAt: true, id: true, reason: true },
        },
      },
    });
    if (!user) return null;
    const entries = user.creditAccounts.flatMap((account) => account.ledgerEntries);
    return {
      accountStatus: user.accountStatus,
      displayName: user.displayName,
      email: user.email,
      history: entries.slice(0, 100).map((entry) => ({
        actorUserId: entry.actorUserId,
        amount: entry.amount,
        createdAt: entry.createdAt,
        entryId: entry.id,
        provenance: provenance(entry.provenance),
        reason: entry.reason,
        referenceId: entry.referenceId,
        referenceType: entry.referenceType,
        type: entry.type,
      })),
      pendingIncreaseRequest: user.creditIncreaseRequests[0] ?? null,
      projection: deriveCreditProjection(entries),
      userId: user.id,
    };
  }

  public async getOwnCredits(userId: string): Promise<CreditMemberDetail | null> {
    return this.detail(userId);
  }

  public async getMember(
    _actorUserId: string,
    userId: string,
  ): Promise<CreditMemberDetail | null> {
    return this.detail(userId);
  }

  public async listMembers(input: {
    actorUserId: string;
    page: number;
    pageSize: number;
    search?: string;
  }): Promise<CreditMemberPage> {
    void input.actorUserId;
    const where: Prisma.UserWhereInput = input.search
      ? {
          OR: [
            { displayName: { contains: input.search, mode: 'insensitive' } },
            { email: { contains: input.search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [users, total] = await this.client.$transaction([
      this.client.user.findMany({
        orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
        select: { id: true },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        where,
      }),
      this.client.user.count({ where }),
    ]);
    const details = await Promise.all(users.map((user) => this.detail(user.id)));
    return {
      items: details.filter((item): item is CreditMemberDetail => item !== null),
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
    };
  }

  public async adjustFreeAllocation(
    input: AdjustCreditsInput,
  ): Promise<CreditMemberDetail> {
    if (input.provenance !== 'FREE_ALLOCATION') {
      throw new Error('PURCHASED_CREDITS_PROTECTED');
    }
    await this.ledger.adjust(input);
    const detail = await this.detail(input.userId);
    if (!detail) throw new Error('CREDIT_MEMBER_NOT_FOUND');
    return detail;
  }

  public async createIncreaseRequest(input: {
    idempotencyKey: string;
    reason: string;
    userId: string;
  }) {
    assertIdempotencyKey(input.idempotencyKey);
    assertAdjustmentReason(input.reason);
    const reason = input.reason.trim();
    const requestFingerprint = creditRequestFingerprint({ reason });
    const existing = await this.client.creditIncreaseRequest.findUnique({
      where: {
        userId_idempotencyKey: {
          idempotencyKey: input.idempotencyKey,
          userId: input.userId,
        },
      },
    });
    if (existing) {
      if (existing.requestFingerprint !== requestFingerprint) {
        throw new Error('IDEMPOTENCY_CONFLICT');
      }
      return existing;
    }
    try {
      return await this.client.creditIncreaseRequest.create({
        data: {
          idempotencyKey: input.idempotencyKey,
          reason,
          requestFingerprint,
          userId: input.userId,
        },
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
      const raced = await this.client.creditIncreaseRequest.findUnique({
        where: {
          userId_idempotencyKey: {
            idempotencyKey: input.idempotencyKey,
            userId: input.userId,
          },
        },
      });
      if (!raced || raced.requestFingerprint !== requestFingerprint) {
        throw new Error('IDEMPOTENCY_CONFLICT', { cause: error });
      }
      return raced;
    }
  }

  public async reviewIncreaseRequest(input: {
    actorUserId: string;
    idempotencyKey: string;
    requestId: string;
    reviewReason: string;
    status: 'APPROVED' | 'REJECTED';
  }): Promise<void> {
    assertIdempotencyKey(input.idempotencyKey);
    assertAdjustmentReason(input.reviewReason);
    await this.client.$transaction(async (transaction) => {
      const request = await transaction.creditIncreaseRequest.findUnique({
        where: { id: input.requestId },
      });
      if (!request) throw new Error('CREDIT_REQUEST_NOT_FOUND');
      if (request.status !== CreditIncreaseRequestStatus.PENDING) {
        if (request.status === input.status) return;
        throw new Error('CREDIT_REQUEST_STATE_CONFLICT');
      }
      await transaction.creditIncreaseRequest.update({
        where: { id: request.id },
        data: {
          reviewedAt: this.clock(),
          reviewedByUserId: input.actorUserId,
          reviewReason: input.reviewReason.trim(),
          status: input.status,
        },
      });
      await writeAuditEvent(transaction, {
        action: AuditAction.CREDIT_INCREASE_REQUEST_REVIEW,
        actorUserId: input.actorUserId,
        idempotencyKey: createAuditIdempotencyKey(
          AuditAction.CREDIT_INCREASE_REQUEST_REVIEW,
          request.id,
          {
            idempotencyKey: input.idempotencyKey,
            status: input.status,
          },
        ),
        metadata: {
          reviewReason: input.reviewReason.trim(),
          status: input.status,
        },
        targetId: request.id,
        targetType: 'credit_increase_request',
      });
    }, { isolationLevel: 'Serializable' });
  }

  public async listPolicies() {
    const [allocation, limits] = await Promise.all([
      this.client.creditAllocationPolicyVersion.findMany({
        orderBy: [{ key: 'asc' }, { version: 'desc' }],
        select: { id: true, key: true, status: true, version: true },
      }),
      this.client.creditLimitPolicyVersion.findMany({
        orderBy: [{ key: 'asc' }, { version: 'desc' }],
        select: { id: true, key: true, status: true, version: true },
      }),
    ]);
    return { allocation, limits };
  }
}
