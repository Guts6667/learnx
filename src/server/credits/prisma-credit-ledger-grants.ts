import { randomUUID } from 'node:crypto';
import {
  AuditAction,
  CreditCurrency,
  CreditLedgerEntryType,
  CreditProvenance,
  Role,
} from '../../../generated/prisma/client.js';
import {
  createAuditIdempotencyKey,
  writeAuditEvent,
} from '../api/_lib/audit.js';
import {
  CreditLedgerError,
  allocateCreditLots,
  assertAdjustmentReason,
  assertCreditAmount,
  assertIdempotencyKey,
  creditRequestFingerprint,
} from './credit-ledger.js';
import type {
  AdjustCreditsInput,
  CreditOperationResult,
  GrantCreditsInput,
} from './prisma-credit-ledger-contracts.js';
import {
  assertReference,
  dbProvenance,
  type LedgerTransaction,
  type PrismaCreditLedgerContext,
} from './prisma-credit-ledger-context.js';

export async function grantCredits(
  context: PrismaCreditLedgerContext,
  input: GrantCreditsInput,
): Promise<CreditOperationResult> {
  assertCreditAmount(input.amount);
  assertIdempotencyKey(input.idempotencyKey);
  assertReference(input.reference);
  const now = context.clock();
  if (
    (input.provenance === 'FREE_ALLOCATION' &&
      input.expiresAt &&
      input.expiresAt <= now) ||
    (input.provenance === 'PURCHASED' && input.expiresAt)
  ) {
    throw new CreditLedgerError('INVALID_EXPIRATION');
  }
  const operationKey = `grant:${input.idempotencyKey}`;
  const fingerprint = creditRequestFingerprint({ ...input, type: 'GRANT' });
  return context.transaction(async (transaction) => {
    const account = await context.lockAccount(transaction, input.userId);
    const existing = await transaction.creditLedgerEntry.findFirst({
      where: { accountId: account.id, operationKey },
    });
    if (existing) {
      if (existing.requestFingerprint !== fingerprint)
        throw new CreditLedgerError('IDEMPOTENCY_CONFLICT');
      return context.result(transaction, account.id, { lotId: existing.lotId });
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
    await context.assertProjection(transaction, account.id);
    return context.result(transaction, account.id, { lotId: lot.id });
  });
}

async function assertAdmin(
  transaction: LedgerTransaction,
  actorUserId: string,
): Promise<void> {
  const actor = await transaction.user.findUnique({
    where: { id: actorUserId },
    select: { role: true },
  });
  if (actor?.role !== Role.ADMIN) throw new CreditLedgerError('ADMIN_REQUIRED');
}

async function createPositiveAdjustment(
  transaction: LedgerTransaction,
  accountId: string,
  input: AdjustCreditsInput,
  operationKey: string,
  fingerprint: string,
): Promise<string[]> {
  const provenance = dbProvenance(input.provenance);
  const lot = await transaction.creditLot.create({
    data: {
      accountId,
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
  const id = randomUUID();
  await transaction.creditLedgerEntry.create({
    data: adjustmentEntryData({
      accountId,
      amount: input.amount,
      fingerprint,
      id,
      input,
      lotId: lot.id,
      operationKey,
      referenceId: input.compensatesEntryId ?? input.idempotencyKey,
      referenceType: input.compensatesEntryId
        ? 'CREDIT_LEDGER_ENTRY'
        : 'ADMIN_CREDIT_ADJUSTMENT',
      sequence: 1,
    }),
  });
  return [id];
}

function adjustmentEntryData(value: {
  accountId: string;
  amount: bigint;
  fingerprint: string;
  id: string;
  input: AdjustCreditsInput;
  lotId: string;
  operationKey: string;
  referenceId: string;
  referenceType: string;
  sequence: number;
}) {
  return {
    accountId: value.accountId,
    actorUserId: value.input.actorUserId,
    amount: value.amount,
    currency: CreditCurrency.LEARNX_CREDIT,
    id: value.id,
    lotId: value.lotId,
    operationKey: value.operationKey,
    operationSequence: value.sequence,
    provenance: dbProvenance(value.input.provenance),
    reason: value.input.reason.trim(),
    referenceId: value.referenceId,
    referenceType: value.referenceType,
    requestFingerprint: value.fingerprint,
    type: CreditLedgerEntryType.ADMIN_ADJUSTMENT,
    userId: value.input.userId,
  };
}

async function createNegativeAdjustment(
  context: PrismaCreditLedgerContext,
  transaction: LedgerTransaction,
  accountId: string,
  input: AdjustCreditsInput,
  operationKey: string,
  fingerprint: string,
  compensated: { id: string; lotId: string },
): Promise<string[]> {
  const allocations = allocateCreditLots(
    (await context.spendableLots(transaction, accountId)).filter(
      (lot) => lot.provenance === input.provenance,
    ),
    -input.amount,
    context.clock(),
    [compensated.lotId],
  );
  const ids: string[] = [];
  for (const [index, allocation] of allocations.entries()) {
    const id = randomUUID();
    ids.push(id);
    await transaction.creditLedgerEntry.create({
      data: adjustmentEntryData({
        accountId,
        amount: -allocation.amount,
        fingerprint,
        id,
        input,
        lotId: allocation.lotId,
        operationKey,
        referenceId: compensated.id,
        referenceType: 'CREDIT_LEDGER_ENTRY',
        sequence: index + 1,
      }),
    });
  }
  return ids;
}

async function auditAdjustment(
  transaction: LedgerTransaction,
  input: AdjustCreditsInput,
  targetId: string,
): Promise<void> {
  const metadata = {
    amount: input.amount.toString(),
    provenance: input.provenance,
    reason: input.reason.trim(),
  };
  await writeAuditEvent(transaction, {
    action: AuditAction.CREDIT_ADMIN_ADJUSTMENT,
    actorUserId: input.actorUserId,
    idempotencyKey: createAuditIdempotencyKey(
      AuditAction.CREDIT_ADMIN_ADJUSTMENT,
      targetId,
      {
        ...metadata,
        compensatesEntryId: input.compensatesEntryId,
        userId: input.userId,
      },
    ),
    metadata,
    targetId,
    targetType: 'credit_ledger_entry',
  });
}

function validateAdjustment(input: AdjustCreditsInput, now: Date): void {
  if (input.amount === 0n) throw new CreditLedgerError('INVALID_AMOUNT');
  assertIdempotencyKey(input.idempotencyKey);
  assertAdjustmentReason(input.reason);
  if (input.provenance === 'PURCHASED')
    throw new CreditLedgerError('PURCHASED_CREDITS_PROTECTED');
  if (input.amount > 0n && input.expiresAt && input.expiresAt <= now)
    throw new CreditLedgerError('INVALID_EXPIRATION');
}

export async function adjustCredits(
  context: PrismaCreditLedgerContext,
  input: AdjustCreditsInput,
): Promise<CreditOperationResult> {
  const now = context.clock();
  validateAdjustment(input, now);
  const operationKey = `admin:${input.idempotencyKey}`;
  const fingerprint = creditRequestFingerprint({
    ...input,
    type: 'ADMIN_ADJUSTMENT',
  });
  return context.transaction(async (transaction) => {
    await assertAdmin(transaction, input.actorUserId);
    const account = await context.lockAccount(transaction, input.userId);
    const existing = await transaction.creditLedgerEntry.findFirst({
      where: { accountId: account.id, operationKey },
    });
    if (existing) {
      if (existing.requestFingerprint !== fingerprint)
        throw new CreditLedgerError('IDEMPOTENCY_CONFLICT');
      return context.result(transaction, account.id);
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
    await context.expireFreeLots(transaction, account.id, input.userId, now);
    let ids: string[];
    if (input.amount > 0n) {
      ids = await createPositiveAdjustment(
        transaction,
        account.id,
        input,
        operationKey,
        fingerprint,
      );
    } else {
      if (!compensated) throw new CreditLedgerError('REFERENCE_NOT_FOUND');
      ids = await createNegativeAdjustment(
        context,
        transaction,
        account.id,
        input,
        operationKey,
        fingerprint,
        compensated,
      );
    }
    await auditAdjustment(transaction, input, ids[0]);
    await context.assertProjection(transaction, account.id);
    return context.result(transaction, account.id);
  });
}
