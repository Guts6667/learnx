import {
  CreditCurrency,
  CreditLedgerEntryType,
} from '../../../generated/prisma/client.js';
import {
  CreditLedgerError,
  allocateCreditLots,
  assertCreditAmount,
  assertIdempotencyKey,
  creditRequestFingerprint,
} from './credit-ledger.js';
import type {
  CreditOperationResult,
  ReserveCreditsInput,
} from './prisma-credit-ledger-contracts.js';
import {
  assertReference,
  dbProvenance,
  type PrismaCreditLedgerContext,
} from './prisma-credit-ledger-context.js';

export async function reserveCredits(
  context: PrismaCreditLedgerContext,
  input: ReserveCreditsInput,
): Promise<CreditOperationResult> {
  assertCreditAmount(input.amount);
  assertIdempotencyKey(input.idempotencyKey);
  assertReference(input.reference);
  const now = context.clock();
  if (input.expiresAt <= now) throw new CreditLedgerError('INVALID_EXPIRATION');
  const fingerprint = creditRequestFingerprint({
    ...input,
    type: 'RESERVATION',
  });
  return context.transaction(async (transaction) => {
    const account = await context.lockAccount(transaction, input.userId);
    const existing = await transaction.creditReservation.findUnique({
      where: {
        accountId_idempotencyKey: {
          accountId: account.id,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) {
      if (existing.requestFingerprint !== fingerprint)
        throw new CreditLedgerError('IDEMPOTENCY_CONFLICT');
      return context.result(transaction, account.id, {
        reservation: {
          ceilingAmount: existing.ceilingAmount,
          id: existing.id,
          settledAmount: existing.settledAmount,
          status: existing.status,
        },
      });
    }
    await context.expireFreeLots(transaction, account.id, input.userId, now);
    const allocations = allocateCreditLots(
      await context.spendableLots(transaction, account.id),
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
          provenance: dbProvenance(allocation.provenance),
          referenceId: input.reference.id,
          referenceType: input.reference.type,
          requestFingerprint: fingerprint,
          reservationId: reservation.id,
          type: CreditLedgerEntryType.RESERVATION_HOLD,
          userId: input.userId,
        },
      });
    }
    await context.assertProjection(transaction, account.id);
    return context.result(transaction, account.id, {
      reservation: {
        ceilingAmount: reservation.ceilingAmount,
        id: reservation.id,
        settledAmount: null,
        status: reservation.status,
      },
    });
  });
}
