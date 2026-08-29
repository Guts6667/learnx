import {
  CreditProvenance,
  CreditReservationStatus,
} from '../../../generated/prisma/client.js';
import { describe, expect, it, vi } from 'vitest';

import { creditRequestFingerprint } from './credit-ledger.js';
import type { PrismaCreditLedgerContext } from './prisma-credit-ledger-context.js';
import { reserveCredits } from './prisma-credit-ledger-reserve.js';

const now = new Date('2026-08-28T12:00:00.000Z');
const input = {
  amount: 7n,
  expiresAt: new Date('2026-08-28T13:00:00.000Z'),
  idempotencyKey: 'reserve-1',
  priorityLotIds: ['lot-purchased', 'lot-free'],
  reference: { id: 'correction-1', type: 'AI_CORRECTION' },
  userId: 'user-1',
};

function harness() {
  const transaction = {
    creditLedgerEntry: { create: vi.fn() },
    creditReservation: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    creditReservationAllocation: { create: vi.fn() },
  };
  const context = {
    assertProjection: vi.fn(),
    clock: vi.fn(() => now),
    expireFreeLots: vi.fn(),
    lockAccount: vi.fn(async () => ({ id: 'account-1' })),
    result: vi.fn(async (_transaction, _accountId, extra = {}) => ({
      balance: { free: 4n, purchased: 6n, total: 10n },
      ...extra,
    })),
    spendableLots: vi.fn(async () => [
      {
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
        expiresAt: new Date('2026-09-01T00:00:00.000Z'),
        id: 'lot-free',
        provenance: 'FREE_ALLOCATION',
        remainingAmount: 4n,
      },
      {
        createdAt: new Date('2026-08-02T00:00:00.000Z'),
        expiresAt: null,
        id: 'lot-purchased',
        provenance: 'PURCHASED',
        remainingAmount: 6n,
      },
    ]),
    transaction: vi.fn(
      async (operation: (client: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    ),
  } as unknown as PrismaCreditLedgerContext;
  return { context, transaction };
}

describe('reserveCredits', () => {
  it('rejects expired reservations before opening a transaction', async () => {
    const { context } = harness();
    await expect(
      reserveCredits(context, { ...input, expiresAt: now }),
    ).rejects.toThrow('INVALID_EXPIRATION');
  });

  it('reuses an identical idempotent reservation and rejects a conflict', async () => {
    const { context, transaction } = harness();
    const existing = {
      ceilingAmount: input.amount,
      id: 'reservation-1',
      requestFingerprint: creditRequestFingerprint({
        ...input,
        type: 'RESERVATION',
      }),
      settledAmount: null,
      status: CreditReservationStatus.RESERVED,
    };
    transaction.creditReservation.findUnique.mockResolvedValueOnce(existing);

    await expect(reserveCredits(context, input)).resolves.toMatchObject({
      reservation: { id: 'reservation-1' },
    });

    transaction.creditReservation.findUnique.mockResolvedValueOnce({
      ...existing,
      requestFingerprint: 'different',
    });
    await expect(reserveCredits(context, input)).rejects.toThrow(
      'IDEMPOTENCY_CONFLICT',
    );
  });

  it('allocates priority lots and persists holds in deterministic order', async () => {
    const { context, transaction } = harness();
    transaction.creditReservation.findUnique.mockResolvedValueOnce(null);
    transaction.creditReservation.create.mockResolvedValueOnce({
      ceilingAmount: input.amount,
      id: 'reservation-1',
      settledAmount: null,
      status: CreditReservationStatus.RESERVED,
    });

    await expect(reserveCredits(context, input)).resolves.toMatchObject({
      reservation: {
        ceilingAmount: 7n,
        id: 'reservation-1',
        status: CreditReservationStatus.RESERVED,
      },
    });
    expect(
      transaction.creditReservationAllocation.create,
    ).toHaveBeenCalledTimes(2);
    expect(
      transaction.creditReservationAllocation.create.mock.calls.map(
        ([request]) => request.data,
      ),
    ).toEqual([
      expect.objectContaining({
        amount: 6n,
        lotId: 'lot-purchased',
        position: 1,
      }),
      expect.objectContaining({ amount: 1n, lotId: 'lot-free', position: 2 }),
    ]);
    expect(transaction.creditLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: -6n,
        provenance: CreditProvenance.PURCHASED,
      }),
    });
    expect(context.expireFreeLots).toHaveBeenCalledOnce();
    expect(context.assertProjection).toHaveBeenCalledOnce();
  });
});
