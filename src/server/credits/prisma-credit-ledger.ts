import { randomUUID } from 'node:crypto';
import {
  AuditAction,
  CreditCurrency,
  CreditLedgerEntryType,
  CreditProvenance,
  CreditReservationStatus,
  Prisma,
  Role,
  type PrismaClient,
} from '../../../generated/prisma/client.js';
import { createAuditIdempotencyKey, writeAuditEvent } from '../api/_lib/audit.js';
import {
  CreditLedgerError,
  allocateCreditLots,
  assertAdjustmentReason,
  assertCreditAmount,
  assertIdempotencyKey,
  creditRequestFingerprint,
  planCreditSettlement,
  reconstructCreditBalance,
  type CreditBalance,
  type CreditProvenanceValue,
  type SpendableCreditLot,
} from './credit-ledger.js';

const MAX_TRANSACTION_ATTEMPTS = 3;
const TRANSACTION_MAX_WAIT_MS = 5_000;
const TRANSACTION_TIMEOUT_MS = 15_000;

type Transaction = Prisma.TransactionClient;

export interface CreditReference {
  id: string;
  type: string;
}

export interface GrantCreditsInput {
  amount: bigint;
  expiresAt?: Date;
  idempotencyKey: string;
  provenance: CreditProvenanceValue;
  reference: CreditReference;
  userId: string;
}

export interface ReserveCreditsInput {
  amount: bigint;
  expiresAt: Date;
  idempotencyKey: string;
  priorityLotIds: readonly string[];
  reference: CreditReference;
  userId: string;
}

export interface SettleCreditsInput {
  amount: bigint;
  reservationId: string;
  userId: string;
}

export interface ReleaseCreditsInput {
  reservationId: string;
  userId: string;
}

export interface AdjustCreditsInput {
  actorUserId: string;
  amount: bigint;
  compensatesEntryId?: string;
  expiresAt?: Date;
  idempotencyKey: string;
  provenance: CreditProvenanceValue;
  reason: string;
  userId: string;
}

export interface CreditOperationResult {
  balance: CreditBalance;
  lotId?: string;
  reservation?: {
    ceilingAmount: bigint;
    id: string;
    settledAmount: bigint | null;
    status: CreditReservationStatus;
  };
}

export function isRetryableCreditTransactionError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as Record<string, unknown>;
  if (
    candidate.code === 'P2034' ||
    candidate.code === 'P2002' ||
    candidate.code === '40001'
  ) {
    return true;
  }
  if (
    typeof candidate.message === 'string' &&
    candidate.message.includes('could not serialize access') &&
    candidate.message.includes('40001')
  ) {
    return true;
  }
  if (typeof candidate.meta !== 'object' || candidate.meta === null) return false;
  const meta = candidate.meta as Record<string, unknown>;
  return (
    meta.code === '40001' ||
    (typeof meta.message === 'string' &&
      meta.message.includes('could not serialize access'))
  );
}

function assertReference(reference: CreditReference): void {
  if (!reference.type.trim() || !reference.id.trim()) {
    throw new CreditLedgerError('REFERENCE_NOT_FOUND');
  }
}

function dbProvenance(value: CreditProvenanceValue): CreditProvenance {
  return value === 'FREE_ALLOCATION'
    ? CreditProvenance.FREE_ALLOCATION
    : CreditProvenance.PURCHASED;
}

function domainProvenance(value: CreditProvenance): CreditProvenanceValue {
  return value === CreditProvenance.FREE_ALLOCATION
    ? 'FREE_ALLOCATION'
    : 'PURCHASED';
}

function balance(free: bigint, purchased: bigint): CreditBalance {
  return { free, purchased, total: free + purchased };
}

export class PrismaCreditLedger {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  private async transaction<T>(
    operation: (transaction: Transaction) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: TRANSACTION_MAX_WAIT_MS,
          timeout: TRANSACTION_TIMEOUT_MS,
        });
      } catch (error) {
        if (
          !isRetryableCreditTransactionError(error) ||
          attempt === MAX_TRANSACTION_ATTEMPTS
        ) {
          throw error;
        }
      }
    }
    throw new CreditLedgerError('LEDGER_INCONSISTENT');
  }

  private async lockAccount(transaction: Transaction, userId: string) {
    const account = await transaction.creditAccount.upsert({
      where: {
        userId_currency: { currency: CreditCurrency.LEARNX_CREDIT, userId },
      },
      create: { currency: CreditCurrency.LEARNX_CREDIT, userId },
      update: {},
    });
    await transaction.$queryRaw(
      Prisma.sql`SELECT "id" FROM "credit_accounts" WHERE "id" = ${account.id}::uuid FOR UPDATE`,
    );
    return transaction.creditAccount.findUniqueOrThrow({ where: { id: account.id } });
  }

  private async balanceFromLedger(
    transaction: Transaction,
    accountId: string,
  ): Promise<CreditBalance> {
    const entries = await transaction.creditLedgerEntry.findMany({
      where: { accountId },
      select: { amount: true, provenance: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return reconstructCreditBalance(
      entries.map((entry) => ({
        amount: entry.amount,
        provenance: domainProvenance(entry.provenance),
      })),
    );
  }

  private async result(
    transaction: Transaction,
    accountId: string,
    extra: Omit<CreditOperationResult, 'balance'> = {},
  ): Promise<CreditOperationResult> {
    return { ...extra, balance: await this.balanceFromLedger(transaction, accountId) };
  }

  private async assertProjection(
    transaction: Transaction,
    accountId: string,
  ): Promise<void> {
    await this.balanceFromLedger(transaction, accountId);
  }

  private async expireFreeLots(
    transaction: Transaction,
    accountId: string,
    userId: string,
    now: Date,
  ): Promise<void> {
    const lots = await transaction.creditLot.findMany({
      where: {
        accountId,
        expiresAt: { lte: now },
        provenance: CreditProvenance.FREE_ALLOCATION,
      },
      include: { ledgerEntries: { select: { amount: true } } },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    for (const lot of lots) {
      const availableAmount = lot.ledgerEntries.reduce(
        (total, entry) => total + entry.amount,
        0n,
      );
      if (availableAmount <= 0n) continue;
      const operationKey = `expiration:${lot.id}`;
      const sequence =
        (await transaction.creditLedgerEntry.count({
          where: { accountId, operationKey },
        })) + 1;
      const fingerprint = creditRequestFingerprint({
        amount: availableAmount,
        expiresAt: lot.expiresAt,
        lotId: lot.id,
        sequence,
        type: 'EXPIRATION',
      });
      await transaction.creditLedgerEntry.create({
        data: {
          accountId,
          amount: -availableAmount,
          currency: CreditCurrency.LEARNX_CREDIT,
          lotId: lot.id,
          operationKey,
          operationSequence: sequence,
          provenance: CreditProvenance.FREE_ALLOCATION,
          referenceId: lot.id,
          referenceType: 'CREDIT_LOT',
          requestFingerprint: fingerprint,
          type: CreditLedgerEntryType.EXPIRATION,
          userId,
        },
      });
    }
  }

  private async spendableLots(
    transaction: Transaction,
    accountId: string,
  ): Promise<SpendableCreditLot[]> {
    const lots = await transaction.creditLot.findMany({
      where: { accountId },
      select: {
        createdAt: true,
        expiresAt: true,
        id: true,
        provenance: true,
        ledgerEntries: { select: { amount: true } },
      },
    });
    return lots.flatMap((lot) => {
      const remainingAmount = lot.ledgerEntries.reduce(
        (total, entry) => total + entry.amount,
        0n,
      );
      if (remainingAmount <= 0n) return [];
      return [{
        createdAt: lot.createdAt,
        expiresAt: lot.expiresAt,
        id: lot.id,
        provenance: domainProvenance(lot.provenance),
        remainingAmount,
      }];
    });
  }

  public async getBalance(userId: string): Promise<CreditBalance> {
    const account = await this.prisma.creditAccount.findUnique({
      where: {
        userId_currency: { currency: CreditCurrency.LEARNX_CREDIT, userId },
      },
    });
    if (!account) return balance(0n, 0n);
    return this.transaction(async (transaction) => {
      const locked = await this.lockAccount(transaction, userId);
      await this.expireFreeLots(transaction, locked.id, userId, this.clock());
      await this.assertProjection(transaction, locked.id);
      return this.balanceFromLedger(transaction, locked.id);
    });
  }

  public async grant(input: GrantCreditsInput): Promise<CreditOperationResult> {
    assertCreditAmount(input.amount);
    assertIdempotencyKey(input.idempotencyKey);
    assertReference(input.reference);
    const now = this.clock();
    if (
      (input.provenance === 'FREE_ALLOCATION' &&
        input.expiresAt !== undefined &&
        input.expiresAt.getTime() <= now.getTime()) ||
      (input.provenance === 'PURCHASED' && input.expiresAt !== undefined)
    ) {
      throw new CreditLedgerError('INVALID_EXPIRATION');
    }
    const operationKey = `grant:${input.idempotencyKey}`;
    const fingerprint = creditRequestFingerprint({ ...input, type: 'GRANT' });
    return this.transaction(async (transaction) => {
      const account = await this.lockAccount(transaction, input.userId);
      const existing = await transaction.creditLedgerEntry.findFirst({
        where: { accountId: account.id, operationKey },
      });
      if (existing) {
        if (existing.requestFingerprint !== fingerprint) {
          throw new CreditLedgerError('IDEMPOTENCY_CONFLICT');
        }
        return this.result(transaction, account.id, { lotId: existing.lotId });
      }
      const provenance = dbProvenance(input.provenance);
      const lot = await transaction.creditLot.create({
        data: {
          accountId: account.id,
          expiresAt: input.expiresAt,
          initialAmount: input.amount,
          provenance,
          remainingAmount: input.amount,
          sourceReferenceId: input.reference.id,
          sourceReferenceType: input.reference.type,
        },
      });
      await transaction.creditLedgerEntry.create({
        data: {
          accountId: account.id,
          amount: input.amount,
          currency: CreditCurrency.LEARNX_CREDIT,
          lotId: lot.id,
          operationKey,
          operationSequence: 1,
          provenance,
          referenceId: input.reference.id,
          referenceType: input.reference.type,
          requestFingerprint: fingerprint,
          type: CreditLedgerEntryType.GRANT,
          userId: input.userId,
        },
      });
      await this.assertProjection(transaction, account.id);
      return this.result(transaction, account.id, { lotId: lot.id });
    });
  }

  public async reserve(input: ReserveCreditsInput): Promise<CreditOperationResult> {
    assertCreditAmount(input.amount);
    assertIdempotencyKey(input.idempotencyKey);
    assertReference(input.reference);
    const now = this.clock();
    if (input.expiresAt.getTime() <= now.getTime()) {
      throw new CreditLedgerError('INVALID_EXPIRATION');
    }
    const fingerprint = creditRequestFingerprint({ ...input, type: 'RESERVATION' });
    return this.transaction(async (transaction) => {
      const account = await this.lockAccount(transaction, input.userId);
      const existing = await transaction.creditReservation.findUnique({
        where: {
          accountId_idempotencyKey: {
            accountId: account.id,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (existing) {
        if (existing.requestFingerprint !== fingerprint) {
          throw new CreditLedgerError('IDEMPOTENCY_CONFLICT');
        }
        return this.result(transaction, account.id, {
          reservation: {
            ceilingAmount: existing.ceilingAmount,
            id: existing.id,
            settledAmount: existing.settledAmount,
            status: existing.status,
          },
        });
      }
      await this.expireFreeLots(transaction, account.id, input.userId, now);
      const allocations = allocateCreditLots(
        await this.spendableLots(transaction, account.id),
        input.amount,
        now,
        input.priorityLotIds,
      );
      const reservation = await transaction.creditReservation.create({
        data: {
          accountId: account.id,
          ceilingAmount: input.amount,
          expiresAt: input.expiresAt,
          idempotencyKey: input.idempotencyKey,
          referenceId: input.reference.id,
          referenceType: input.reference.type,
          requestFingerprint: fingerprint,
          userId: input.userId,
        },
      });
      for (const [index, allocation] of allocations.entries()) {
        const provenance = dbProvenance(allocation.provenance);
        await transaction.creditReservationAllocation.create({
          data: {
            accountId: account.id,
            amount: allocation.amount,
            lotId: allocation.lotId,
            position: index + 1,
            reservationId: reservation.id,
          },
        });
        await transaction.creditLedgerEntry.create({
          data: {
            accountId: account.id,
            amount: -allocation.amount,
            currency: CreditCurrency.LEARNX_CREDIT,
            lotId: allocation.lotId,
            operationKey: `reserve:${reservation.id}`,
            operationSequence: index + 1,
            provenance,
            referenceId: input.reference.id,
            referenceType: input.reference.type,
            requestFingerprint: fingerprint,
            reservationId: reservation.id,
            type: CreditLedgerEntryType.RESERVATION_HOLD,
            userId: input.userId,
          },
        });
      }
      await this.assertProjection(transaction, account.id);
      return this.result(transaction, account.id, {
        reservation: {
          ceilingAmount: reservation.ceilingAmount,
          id: reservation.id,
          settledAmount: null,
          status: reservation.status,
        },
      });
    });
  }

  private async finalizeReservation(
    transaction: Transaction,
    reservation: Awaited<ReturnType<Transaction['creditReservation']['findFirstOrThrow']>>,
    amount: bigint,
    expired: boolean,
  ): Promise<CreditOperationResult> {
    const allocations = await transaction.creditReservationAllocation.findMany({
      where: { reservationId: reservation.id },
      include: { lot: true },
      orderBy: { position: 'asc' },
    });
    let sequence = 1;
    const operationKey =
      amount === 0n ? `release:${reservation.id}` : `settle:${reservation.id}`;
    const fingerprint = creditRequestFingerprint({
      amount,
      expired,
      reservationId: reservation.id,
      type: amount === 0n ? 'RELEASE' : 'SETTLEMENT',
    });

    const settlementPlan = planCreditSettlement(
      allocations.map((allocation) => ({
        amount: allocation.amount,
        lotId: allocation.lotId,
        provenance: domainProvenance(allocation.lot.provenance),
      })),
      amount,
    );
    for (const [allocationIndex, allocation] of allocations.entries()) {
      const planned = settlementPlan[allocationIndex];
      const used = planned.settledAmount;
      await transaction.creditLedgerEntry.create({
        data: {
          accountId: reservation.accountId,
          amount: allocation.amount,
          currency: CreditCurrency.LEARNX_CREDIT,
          lotId: allocation.lotId,
          operationKey,
          operationSequence: sequence,
          provenance: allocation.lot.provenance,
          referenceId: reservation.referenceId,
          referenceType: reservation.referenceType,
          requestFingerprint: fingerprint,
          reservationId: reservation.id,
          type: CreditLedgerEntryType.RESERVATION_RELEASE,
          userId: reservation.userId,
        },
      });
      sequence += 1;
      if (used > 0n) {
        await transaction.creditLedgerEntry.create({
          data: {
            accountId: reservation.accountId,
            amount: -used,
            currency: CreditCurrency.LEARNX_CREDIT,
            lotId: allocation.lotId,
            operationKey,
            operationSequence: sequence,
            provenance: allocation.lot.provenance,
            referenceId: reservation.referenceId,
            referenceType: reservation.referenceType,
            requestFingerprint: fingerprint,
            reservationId: reservation.id,
            type: CreditLedgerEntryType.SETTLEMENT,
            userId: reservation.userId,
          },
        });
        sequence += 1;
      }
    }
    const isRelease = amount === 0n;
    const status = isRelease
      ? expired
        ? CreditReservationStatus.EXPIRED_RELEASED
        : CreditReservationStatus.RELEASED
      : CreditReservationStatus.SETTLED;
    await transaction.creditReservation.update({
      where: { id: reservation.id },
      data: isRelease
        ? { releasedAt: this.clock(), status }
        : { settledAmount: amount, settledAt: this.clock(), status },
    });
    await this.expireFreeLots(
      transaction,
      reservation.accountId,
      reservation.userId,
      this.clock(),
    );
    await this.assertProjection(transaction, reservation.accountId);
    return this.result(transaction, reservation.accountId, {
      reservation: {
        ceilingAmount: reservation.ceilingAmount,
        id: reservation.id,
        settledAmount: isRelease ? null : amount,
        status,
      },
    });
  }

  public async settle(input: SettleCreditsInput): Promise<CreditOperationResult> {
    assertCreditAmount(input.amount, { allowZero: true });
    return this.transaction(async (transaction) => {
      const account = await this.lockAccount(transaction, input.userId);
      const reservation = await transaction.creditReservation.findFirst({
        where: { accountId: account.id, id: input.reservationId, userId: input.userId },
      });
      if (!reservation) throw new CreditLedgerError('RESERVATION_NOT_FOUND');
      if (reservation.status === CreditReservationStatus.SETTLED) {
        if (reservation.settledAmount !== input.amount) {
          throw new CreditLedgerError('IDEMPOTENCY_CONFLICT');
        }
        return this.result(transaction, account.id, {
          reservation: {
            ceilingAmount: reservation.ceilingAmount,
            id: reservation.id,
            settledAmount: reservation.settledAmount,
            status: reservation.status,
          },
        });
      }
      if (reservation.status !== CreditReservationStatus.RESERVED) {
        throw new CreditLedgerError('RESERVATION_STATE_CONFLICT');
      }
      if (reservation.expiresAt.getTime() <= this.clock().getTime()) {
        throw new CreditLedgerError('RESERVATION_EXPIRED');
      }
      if (input.amount > reservation.ceilingAmount) {
        throw new CreditLedgerError('INVALID_AMOUNT');
      }
      return this.finalizeReservation(transaction, reservation, input.amount, false);
    });
  }

  public async release(input: ReleaseCreditsInput): Promise<CreditOperationResult> {
    return this.transaction(async (transaction) => {
      const account = await this.lockAccount(transaction, input.userId);
      const reservation = await transaction.creditReservation.findFirst({
        where: { accountId: account.id, id: input.reservationId, userId: input.userId },
      });
      if (!reservation) throw new CreditLedgerError('RESERVATION_NOT_FOUND');
      if (
        reservation.status === CreditReservationStatus.RELEASED ||
        reservation.status === CreditReservationStatus.EXPIRED_RELEASED
      ) {
        return this.result(transaction, account.id, {
          reservation: {
            ceilingAmount: reservation.ceilingAmount,
            id: reservation.id,
            settledAmount: null,
            status: reservation.status,
          },
        });
      }
      if (reservation.status !== CreditReservationStatus.RESERVED) {
        throw new CreditLedgerError('RESERVATION_STATE_CONFLICT');
      }
      return this.finalizeReservation(transaction, reservation, 0n, false);
    });
  }

  public async expireReservations(): Promise<number> {
    const now = this.clock();
    const reservations = await this.prisma.creditReservation.findMany({
      where: { expiresAt: { lte: now }, status: CreditReservationStatus.RESERVED },
      select: { id: true, userId: true },
      orderBy: { expiresAt: 'asc' },
    });
    let expired = 0;
    for (const candidate of reservations) {
      const didExpire = await this.transaction(async (transaction) => {
        const account = await this.lockAccount(transaction, candidate.userId);
        const reservation = await transaction.creditReservation.findFirst({
          where: {
            accountId: account.id,
            expiresAt: { lte: this.clock() },
            id: candidate.id,
            status: CreditReservationStatus.RESERVED,
          },
        });
        if (!reservation) return false;
        await this.finalizeReservation(transaction, reservation, 0n, true);
        return true;
      });
      if (didExpire) expired += 1;
    }
    return expired;
  }

  public async expireAllocations(userId: string): Promise<CreditBalance> {
    return this.transaction(async (transaction) => {
      const account = await this.lockAccount(transaction, userId);
      await this.expireFreeLots(transaction, account.id, userId, this.clock());
      await this.assertProjection(transaction, account.id);
      return this.balanceFromLedger(transaction, account.id);
    });
  }

  public async adjust(input: AdjustCreditsInput): Promise<CreditOperationResult> {
    if (input.amount === 0n) throw new CreditLedgerError('INVALID_AMOUNT');
    assertIdempotencyKey(input.idempotencyKey);
    assertAdjustmentReason(input.reason);
    if (input.provenance === 'PURCHASED') {
      throw new CreditLedgerError('PURCHASED_CREDITS_PROTECTED');
    }
    const now = this.clock();
    if (
      input.amount > 0n &&
      input.expiresAt !== undefined &&
      input.expiresAt.getTime() <= now.getTime()
    ) {
      throw new CreditLedgerError('INVALID_EXPIRATION');
    }
    const operationKey = `admin:${input.idempotencyKey}`;
    const fingerprint = creditRequestFingerprint({ ...input, type: 'ADMIN_ADJUSTMENT' });
    return this.transaction(async (transaction) => {
      const actor = await transaction.user.findUnique({
        where: { id: input.actorUserId },
        select: { role: true },
      });
      if (actor?.role !== Role.ADMIN) throw new CreditLedgerError('ADMIN_REQUIRED');
      const account = await this.lockAccount(transaction, input.userId);
      const existing = await transaction.creditLedgerEntry.findFirst({
        where: { accountId: account.id, operationKey },
      });
      if (existing) {
        if (existing.requestFingerprint !== fingerprint) {
          throw new CreditLedgerError('IDEMPOTENCY_CONFLICT');
        }
        return this.result(transaction, account.id);
      }
      const compensated = input.compensatesEntryId
        ? await transaction.creditLedgerEntry.findFirst({
            where: { accountId: account.id, id: input.compensatesEntryId },
          })
        : null;
      if (
        input.amount < 0n &&
        (!compensated ||
          compensated.amount <= 0n ||
          compensated.provenance !== CreditProvenance.FREE_ALLOCATION)
      ) {
        throw new CreditLedgerError('REFERENCE_NOT_FOUND');
      }
      await this.expireFreeLots(transaction, account.id, input.userId, now);
      const provenance = dbProvenance(input.provenance);
      const createdEntryIds: string[] = [];
      if (input.amount > 0n) {
        const lot = await transaction.creditLot.create({
          data: {
            accountId: account.id,
            expiresAt: input.expiresAt,
            initialAmount: input.amount,
            provenance,
            remainingAmount: input.amount,
            sourceReferenceId: input.compensatesEntryId ?? input.idempotencyKey,
            sourceReferenceType: input.compensatesEntryId
              ? 'CREDIT_LEDGER_ENTRY'
              : 'ADMIN_CREDIT_ADJUSTMENT',
          },
        });
        const entryId = randomUUID();
        createdEntryIds.push(entryId);
        await transaction.creditLedgerEntry.create({
          data: {
            accountId: account.id,
            actorUserId: input.actorUserId,
            amount: input.amount,
            currency: CreditCurrency.LEARNX_CREDIT,
            id: entryId,
            lotId: lot.id,
            operationKey,
            operationSequence: 1,
            provenance,
            reason: input.reason.trim(),
            referenceId: input.compensatesEntryId ?? input.idempotencyKey,
            referenceType: input.compensatesEntryId
              ? 'CREDIT_LEDGER_ENTRY'
              : 'ADMIN_CREDIT_ADJUSTMENT',
            requestFingerprint: fingerprint,
            type: CreditLedgerEntryType.ADMIN_ADJUSTMENT,
            userId: input.userId,
          },
        });
      } else {
        if (!compensated) throw new CreditLedgerError('REFERENCE_NOT_FOUND');
        const allocations = allocateCreditLots(
          (await this.spendableLots(transaction, account.id)).filter(
            (lot) => lot.provenance === input.provenance,
          ),
          -input.amount,
          now,
          [compensated.lotId],
        );
        for (const [index, allocation] of allocations.entries()) {
          const entryId = randomUUID();
          createdEntryIds.push(entryId);
          await transaction.creditLedgerEntry.create({
            data: {
              accountId: account.id,
              actorUserId: input.actorUserId,
              amount: -allocation.amount,
              currency: CreditCurrency.LEARNX_CREDIT,
              id: entryId,
              lotId: allocation.lotId,
              operationKey,
              operationSequence: index + 1,
              provenance,
              reason: input.reason.trim(),
              referenceId: compensated.id,
              referenceType: 'CREDIT_LEDGER_ENTRY',
              requestFingerprint: fingerprint,
              type: CreditLedgerEntryType.ADMIN_ADJUSTMENT,
              userId: input.userId,
            },
          });
        }
      }
      await writeAuditEvent(transaction, {
        action: AuditAction.CREDIT_ADMIN_ADJUSTMENT,
        actorUserId: input.actorUserId,
        idempotencyKey: createAuditIdempotencyKey(
          AuditAction.CREDIT_ADMIN_ADJUSTMENT,
          createdEntryIds[0],
          {
            amount: input.amount.toString(),
            compensatesEntryId: input.compensatesEntryId,
            provenance: input.provenance,
            reason: input.reason.trim(),
            userId: input.userId,
          },
        ),
        metadata: {
          amount: input.amount.toString(),
          provenance: input.provenance,
          reason: input.reason.trim(),
        },
        targetId: createdEntryIds[0],
        targetType: 'credit_ledger_entry',
      });
      await this.assertProjection(transaction, account.id);
      return this.result(transaction, account.id);
    });
  }

  public async rebuildProjection(userId: string): Promise<CreditBalance> {
    return this.transaction(async (transaction) => {
      const account = await this.lockAccount(transaction, userId);
      return this.balanceFromLedger(transaction, account.id);
    });
  }
}
