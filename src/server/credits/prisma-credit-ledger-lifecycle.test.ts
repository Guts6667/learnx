import {
  CreditProvenance,
  CreditReservationStatus,
} from '../../../generated/prisma/client.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreditLedgerError } from './credit-ledger.js';
import type { PrismaCreditLedgerContext } from './prisma-credit-ledger-context.js';
import {
  activateReservationLease,
  expireReservations,
  releaseCredits,
  settleCredits,
} from './prisma-credit-ledger-lifecycle.js';

const now = new Date('2026-08-28T12:00:00.000Z');

function reservation(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    accountId: 'account-1',
    ceilingAmount: 10n,
    executionLeaseExpiresAt: null,
    expiresAt: new Date('2026-08-28T13:00:00.000Z'),
    id: 'reservation-1',
    referenceId: 'correction-1',
    referenceType: 'AI_CORRECTION',
    settledAmount: null,
    status: CreditReservationStatus.RESERVED,
    userId: 'user-1',
    ...overrides,
  };
}

function harness() {
  const transaction = {
    creditLedgerEntry: { create: vi.fn() },
    creditReservation: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    creditReservationAllocation: { findMany: vi.fn() },
  };
  const prisma = { creditReservation: { findMany: vi.fn() } };
  const context = {
    assertProjection: vi.fn(),
    clock: vi.fn(() => now),
    expireFreeLots: vi.fn(),
    lockAccount: vi.fn(async () => ({ id: 'account-1' })),
    prisma,
    result: vi.fn(async (_transaction, _accountId, extra = {}) => ({
      balance: { free: 8n, purchased: 2n, total: 10n },
      ...extra,
    })),
    transaction: vi.fn(
      async (operation: (client: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    ),
  } as unknown as PrismaCreditLedgerContext;
  return { context, prisma, transaction };
}

function configureFinalization(
  transaction: ReturnType<typeof harness>['transaction'],
  current = reservation(),
) {
  transaction.creditReservation.findFirst.mockResolvedValue(current);
  transaction.creditReservationAllocation.findMany.mockResolvedValue([
    {
      amount: 6n,
      lot: { provenance: CreditProvenance.FREE_ALLOCATION },
      lotId: 'lot-free',
    },
    {
      amount: 4n,
      lot: { provenance: CreditProvenance.PURCHASED },
      lotId: 'lot-purchased',
    },
  ]);
  transaction.creditReservation.update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      ...current,
      ...data,
    }),
  );
}

describe('Prisma credit reservation lifecycle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('settles a valid reservation and preserves mixed-lot allocation order', async () => {
    const { context, transaction } = harness();
    configureFinalization(transaction);

    await expect(
      settleCredits(context, {
        amount: 7n,
        reservationId: 'reservation-1',
        userId: 'user-1',
      }),
    ).resolves.toMatchObject({
      reservation: {
        id: 'reservation-1',
        settledAmount: 7n,
        status: CreditReservationStatus.SETTLED,
      },
    });

    const entries = transaction.creditLedgerEntry.create.mock.calls.map(
      ([input]) => input.data,
    );
    expect(entries).toHaveLength(4);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ amount: 6n, lotId: 'lot-free' }),
        expect.objectContaining({ amount: -6n, lotId: 'lot-free' }),
        expect.objectContaining({ amount: 4n, lotId: 'lot-purchased' }),
        expect.objectContaining({ amount: -1n, lotId: 'lot-purchased' }),
      ]),
    );
  });

  it('rejects missing, conflicting, expired and over-ceiling settlements', async () => {
    const { context, transaction } = harness();
    transaction.creditReservation.findFirst.mockResolvedValueOnce(null);
    await expect(
      settleCredits(context, {
        amount: 1n,
        reservationId: 'missing',
        userId: 'user-1',
      }),
    ).rejects.toThrow('RESERVATION_NOT_FOUND');

    transaction.creditReservation.findFirst.mockResolvedValueOnce(
      reservation({
        settledAmount: 5n,
        status: CreditReservationStatus.SETTLED,
      }),
    );
    await expect(
      settleCredits(context, {
        amount: 4n,
        reservationId: 'reservation-1',
        userId: 'user-1',
      }),
    ).rejects.toThrow('IDEMPOTENCY_CONFLICT');

    transaction.creditReservation.findFirst.mockResolvedValueOnce(
      reservation({ status: CreditReservationStatus.RELEASED }),
    );
    await expect(
      settleCredits(context, {
        amount: 1n,
        reservationId: 'reservation-1',
        userId: 'user-1',
      }),
    ).rejects.toThrow('RESERVATION_STATE_CONFLICT');

    transaction.creditReservation.findFirst.mockResolvedValueOnce(
      reservation({ expiresAt: now }),
    );
    await expect(
      settleCredits(context, {
        amount: 1n,
        reservationId: 'reservation-1',
        userId: 'user-1',
      }),
    ).rejects.toThrow('RESERVATION_EXPIRED');

    transaction.creditReservation.findFirst.mockResolvedValueOnce(reservation());
    await expect(
      settleCredits(context, {
        amount: 11n,
        reservationId: 'reservation-1',
        userId: 'user-1',
      }),
    ).rejects.toThrow('INVALID_AMOUNT');
  });

  it('returns an already settled reservation idempotently', async () => {
    const { context, transaction } = harness();
    transaction.creditReservation.findFirst.mockResolvedValueOnce(
      reservation({
        settledAmount: 5n,
        status: CreditReservationStatus.SETTLED,
      }),
    );
    await expect(
      settleCredits(context, {
        amount: 5n,
        reservationId: 'reservation-1',
        userId: 'user-1',
      }),
    ).resolves.toMatchObject({ reservation: { settledAmount: 5n } });
  });

  it('activates a bounded execution lease without shortening an existing one', async () => {
    const { context, transaction } = harness();
    await expect(
      activateReservationLease(context, {
        expiresAt: now,
        reservationId: 'reservation-1',
        userId: 'user-1',
      }),
    ).rejects.toThrow(new CreditLedgerError('INVALID_EXPIRATION'));

    transaction.creditReservation.findFirst.mockResolvedValueOnce(null);
    await expect(
      activateReservationLease(context, {
        expiresAt: new Date('2026-08-28T13:30:00.000Z'),
        reservationId: 'reservation-1',
        userId: 'user-1',
      }),
    ).rejects.toThrow('RESERVATION_NOT_FOUND');

    transaction.creditReservation.findFirst.mockResolvedValueOnce(
      reservation({ status: CreditReservationStatus.SETTLED }),
    );
    await expect(
      activateReservationLease(context, {
        expiresAt: new Date('2026-08-28T13:30:00.000Z'),
        reservationId: 'reservation-1',
        userId: 'user-1',
      }),
    ).rejects.toThrow('RESERVATION_STATE_CONFLICT');

    transaction.creditReservation.findFirst.mockResolvedValueOnce(
      reservation({ expiresAt: now, executionLeaseExpiresAt: now }),
    );
    await expect(
      activateReservationLease(context, {
        expiresAt: new Date('2026-08-28T13:30:00.000Z'),
        reservationId: 'reservation-1',
        userId: 'user-1',
      }),
    ).rejects.toThrow('RESERVATION_EXPIRED');

    const existingLease = new Date('2026-08-28T15:00:00.000Z');
    const current = reservation({ executionLeaseExpiresAt: existingLease });
    transaction.creditReservation.findFirst.mockResolvedValueOnce(current);
    transaction.creditReservation.update.mockResolvedValueOnce(current);
    await activateReservationLease(context, {
      expiresAt: new Date('2026-08-28T14:00:00.000Z'),
      reservationId: 'reservation-1',
      userId: 'user-1',
    });
    expect(transaction.creditReservation.update).toHaveBeenLastCalledWith({
      data: { executionLeaseExpiresAt: existingLease },
      where: { id: 'reservation-1' },
    });
  });

  it('releases reservations and keeps repeated releases idempotent', async () => {
    const { context, transaction } = harness();
    transaction.creditReservation.findFirst.mockResolvedValueOnce(null);
    await expect(
      releaseCredits(context, {
        reservationId: 'missing',
        userId: 'user-1',
      }),
    ).rejects.toThrow('RESERVATION_NOT_FOUND');

    transaction.creditReservation.findFirst.mockResolvedValueOnce(
      reservation({ status: CreditReservationStatus.EXPIRED_RELEASED }),
    );
    await expect(
      releaseCredits(context, {
        reservationId: 'reservation-1',
        userId: 'user-1',
      }),
    ).resolves.toMatchObject({
      reservation: { status: CreditReservationStatus.EXPIRED_RELEASED },
    });

    transaction.creditReservation.findFirst.mockResolvedValueOnce(
      reservation({ status: CreditReservationStatus.SETTLED }),
    );
    await expect(
      releaseCredits(context, {
        reservationId: 'reservation-1',
        userId: 'user-1',
      }),
    ).rejects.toThrow('RESERVATION_STATE_CONFLICT');

    configureFinalization(transaction);
    await expect(
      releaseCredits(context, {
        reservationId: 'reservation-1',
        userId: 'user-1',
      }),
    ).resolves.toMatchObject({
      reservation: { status: CreditReservationStatus.RELEASED },
    });
  });

  it('expires only candidates still eligible under the transaction lock', async () => {
    const { context, prisma, transaction } = harness();
    prisma.creditReservation.findMany.mockResolvedValueOnce([
      { id: 'gone', userId: 'user-1' },
      { id: 'expired', userId: 'user-1' },
    ]);
    transaction.creditReservation.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        reservation({
          expiresAt: now,
          id: 'expired',
        }),
      );
    configureFinalization(
      transaction,
      reservation({ expiresAt: now, id: 'expired' }),
    );
    transaction.creditReservation.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(reservation({ expiresAt: now, id: 'expired' }));

    await expect(expireReservations(context)).resolves.toBe(1);
  });
});
