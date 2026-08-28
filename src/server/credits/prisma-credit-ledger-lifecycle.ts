import {
  CreditCurrency,
  CreditLedgerEntryType,
  CreditReservationStatus,
} from '../../../generated/prisma/client.js';
import {
  CreditLedgerError,
  assertCreditAmount,
  creditRequestFingerprint,
  planCreditSettlement,
  reservationEffectiveExpiration,
} from './credit-ledger.js';
import type {
  ActivateReservationLeaseInput,
  CreditOperationResult,
  ReleaseCreditsInput,
  SettleCreditsInput,
} from './prisma-credit-ledger-contracts.js';
import {
  domainProvenance,
  type LedgerTransaction,
  type PrismaCreditLedgerContext,
} from './prisma-credit-ledger-context.js';

type Reservation = Awaited<
  ReturnType<LedgerTransaction['creditReservation']['findFirstOrThrow']>
>;
type Allocation = Awaited<
  ReturnType<LedgerTransaction['creditReservationAllocation']['findMany']>
>[number] & {
  lot: {
    provenance: import('../../../generated/prisma/client.js').CreditProvenance;
  };
};

async function writeAllocationEntries(
  transaction: LedgerTransaction,
  reservation: Reservation,
  allocations: Allocation[],
  amount: bigint,
  expired: boolean,
): Promise<void> {
  const operationKey =
    amount === 0n ? `release:${reservation.id}` : `settle:${reservation.id}`;
  const fingerprint = creditRequestFingerprint({
    amount,
    expired,
    reservationId: reservation.id,
    type: amount === 0n ? 'RELEASE' : 'SETTLEMENT',
  });
  const plan = planCreditSettlement(
    allocations.map((allocation) => ({
      amount: allocation.amount,
      lotId: allocation.lotId,
      provenance: domainProvenance(allocation.lot.provenance),
    })),
    amount,
  );
  let sequence = 1;
  for (const [index, allocation] of allocations.entries()) {
    await transaction.creditLedgerEntry.create({
      data: {
        accountId: reservation.accountId,
        amount: allocation.amount,
        currency: CreditCurrency.LEARNX_CREDIT,
        lotId: allocation.lotId,
        operationKey,
        operationSequence: sequence++,
        provenance: allocation.lot.provenance,
        referenceId: reservation.referenceId,
        referenceType: reservation.referenceType,
        requestFingerprint: fingerprint,
        reservationId: reservation.id,
        type: CreditLedgerEntryType.RESERVATION_RELEASE,
        userId: reservation.userId,
      },
    });
    if (plan[index].settledAmount > 0n) {
      await transaction.creditLedgerEntry.create({
        data: {
          accountId: reservation.accountId,
          amount: -plan[index].settledAmount,
          currency: CreditCurrency.LEARNX_CREDIT,
          lotId: allocation.lotId,
          operationKey,
          operationSequence: sequence++,
          provenance: allocation.lot.provenance,
          referenceId: reservation.referenceId,
          referenceType: reservation.referenceType,
          requestFingerprint: fingerprint,
          reservationId: reservation.id,
          type: CreditLedgerEntryType.SETTLEMENT,
          userId: reservation.userId,
        },
      });
    }
  }
}

async function finalizeReservation(
  context: PrismaCreditLedgerContext,
  transaction: LedgerTransaction,
  reservation: Reservation,
  amount: bigint,
  expired: boolean,
): Promise<CreditOperationResult> {
  const allocations = await transaction.creditReservationAllocation.findMany({
    where: { reservationId: reservation.id },
    include: { lot: true },
    orderBy: { position: 'asc' },
  });
  await writeAllocationEntries(
    transaction,
    reservation,
    allocations,
    amount,
    expired,
  );
  const isRelease = amount === 0n;
  const status = isRelease
    ? expired
      ? CreditReservationStatus.EXPIRED_RELEASED
      : CreditReservationStatus.RELEASED
    : CreditReservationStatus.SETTLED;
  await transaction.creditReservation.update({
    where: { id: reservation.id },
    data: isRelease
      ? { releasedAt: context.clock(), status }
      : { settledAmount: amount, settledAt: context.clock(), status },
  });
  await context.expireFreeLots(
    transaction,
    reservation.accountId,
    reservation.userId,
    context.clock(),
  );
  await context.assertProjection(transaction, reservation.accountId);
  return context.result(transaction, reservation.accountId, {
    reservation: {
      ceilingAmount: reservation.ceilingAmount,
      id: reservation.id,
      settledAmount: isRelease ? null : amount,
      status,
    },
  });
}

export async function settleCredits(
  context: PrismaCreditLedgerContext,
  input: SettleCreditsInput,
): Promise<CreditOperationResult> {
  assertCreditAmount(input.amount, { allowZero: true });
  return context.transaction(async (transaction) => {
    const account = await context.lockAccount(transaction, input.userId);
    const reservation = await transaction.creditReservation.findFirst({
      where: {
        accountId: account.id,
        id: input.reservationId,
        userId: input.userId,
      },
    });
    if (!reservation) throw new CreditLedgerError('RESERVATION_NOT_FOUND');
    if (reservation.status === CreditReservationStatus.SETTLED) {
      if (reservation.settledAmount !== input.amount)
        throw new CreditLedgerError('IDEMPOTENCY_CONFLICT');
      return context.result(transaction, account.id, {
        reservation: {
          ceilingAmount: reservation.ceilingAmount,
          id: reservation.id,
          settledAmount: reservation.settledAmount,
          status: reservation.status,
        },
      });
    }
    if (reservation.status !== CreditReservationStatus.RESERVED)
      throw new CreditLedgerError('RESERVATION_STATE_CONFLICT');
    if (
      reservationEffectiveExpiration({
        executionLeaseExpiresAt: reservation.executionLeaseExpiresAt,
        holdExpiresAt: reservation.expiresAt,
      }) <= context.clock()
    )
      throw new CreditLedgerError('RESERVATION_EXPIRED');
    if (input.amount > reservation.ceilingAmount)
      throw new CreditLedgerError('INVALID_AMOUNT');
    return finalizeReservation(
      context,
      transaction,
      reservation,
      input.amount,
      false,
    );
  });
}

export async function activateReservationLease(
  context: PrismaCreditLedgerContext,
  input: ActivateReservationLeaseInput,
): Promise<CreditOperationResult> {
  const now = context.clock();
  if (input.expiresAt <= now) throw new CreditLedgerError('INVALID_EXPIRATION');
  return context.transaction(async (transaction) => {
    const account = await context.lockAccount(transaction, input.userId);
    const reservation = await transaction.creditReservation.findFirst({
      where: {
        accountId: account.id,
        id: input.reservationId,
        userId: input.userId,
      },
    });
    if (!reservation) throw new CreditLedgerError('RESERVATION_NOT_FOUND');
    if (reservation.status !== CreditReservationStatus.RESERVED)
      throw new CreditLedgerError('RESERVATION_STATE_CONFLICT');
    if (
      reservation.expiresAt <= now &&
      (!reservation.executionLeaseExpiresAt ||
        reservation.executionLeaseExpiresAt <= now)
    ) {
      throw new CreditLedgerError('RESERVATION_EXPIRED');
    }
    const executionLeaseExpiresAt =
      reservation.executionLeaseExpiresAt &&
      reservation.executionLeaseExpiresAt > input.expiresAt
        ? reservation.executionLeaseExpiresAt
        : input.expiresAt;
    const updated = await transaction.creditReservation.update({
      where: { id: reservation.id },
      data: { executionLeaseExpiresAt },
    });
    return context.result(transaction, account.id, {
      reservation: {
        ceilingAmount: updated.ceilingAmount,
        id: updated.id,
        settledAmount: updated.settledAmount,
        status: updated.status,
      },
    });
  });
}

export async function releaseCredits(
  context: PrismaCreditLedgerContext,
  input: ReleaseCreditsInput,
): Promise<CreditOperationResult> {
  return context.transaction(async (transaction) => {
    const account = await context.lockAccount(transaction, input.userId);
    const reservation = await transaction.creditReservation.findFirst({
      where: {
        accountId: account.id,
        id: input.reservationId,
        userId: input.userId,
      },
    });
    if (!reservation) throw new CreditLedgerError('RESERVATION_NOT_FOUND');
    if (
      reservation.status === CreditReservationStatus.RELEASED ||
      reservation.status === CreditReservationStatus.EXPIRED_RELEASED
    ) {
      return context.result(transaction, account.id, {
        reservation: {
          ceilingAmount: reservation.ceilingAmount,
          id: reservation.id,
          settledAmount: null,
          status: reservation.status,
        },
      });
    }
    if (reservation.status !== CreditReservationStatus.RESERVED)
      throw new CreditLedgerError('RESERVATION_STATE_CONFLICT');
    return finalizeReservation(context, transaction, reservation, 0n, false);
  });
}

export async function expireReservations(
  context: PrismaCreditLedgerContext,
): Promise<number> {
  const now = context.clock();
  const candidates = await context.prisma.creditReservation.findMany({
    where: {
      expiresAt: { lte: now },
      status: CreditReservationStatus.RESERVED,
      OR: [
        { executionLeaseExpiresAt: null },
        { executionLeaseExpiresAt: { lte: now } },
      ],
    },
    select: { id: true, userId: true },
    orderBy: { expiresAt: 'asc' },
  });
  let expired = 0;
  for (const candidate of candidates) {
    const didExpire = await context.transaction(async (transaction) => {
      const account = await context.lockAccount(transaction, candidate.userId);
      const current = context.clock();
      const reservation = await transaction.creditReservation.findFirst({
        where: {
          accountId: account.id,
          expiresAt: { lte: current },
          id: candidate.id,
          OR: [
            { executionLeaseExpiresAt: null },
            { executionLeaseExpiresAt: { lte: current } },
          ],
          status: CreditReservationStatus.RESERVED,
        },
      });
      if (!reservation) return false;
      await finalizeReservation(context, transaction, reservation, 0n, true);
      return true;
    });
    if (didExpire) expired += 1;
  }
  return expired;
}
