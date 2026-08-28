import type { PrismaClient } from '../../../generated/prisma/client.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const helpers = vi.hoisted(() => ({
  activateReservationLease: vi.fn(),
  adjustCredits: vi.fn(),
  expireReservations: vi.fn(),
  grantCredits: vi.fn(),
  releaseCredits: vi.fn(),
  reserveCredits: vi.fn(),
  settleCredits: vi.fn(),
}));

vi.mock('./prisma-credit-ledger-grants.js', () => ({
  adjustCredits: helpers.adjustCredits,
  grantCredits: helpers.grantCredits,
}));
vi.mock('./prisma-credit-ledger-lifecycle.js', () => ({
  activateReservationLease: helpers.activateReservationLease,
  expireReservations: helpers.expireReservations,
  releaseCredits: helpers.releaseCredits,
  settleCredits: helpers.settleCredits,
}));
vi.mock('./prisma-credit-ledger-reserve.js', () => ({
  reserveCredits: helpers.reserveCredits,
}));

import { PrismaCreditLedger } from './prisma-credit-ledger.js';

const now = new Date('2026-08-28T12:00:00.000Z');

function harness() {
  const client = {
    $transaction: vi.fn(),
    creditAccount: { findUnique: vi.fn() },
    creditLot: { findMany: vi.fn() },
  };
  const ledger = new PrismaCreditLedger(
    client as unknown as PrismaClient,
    () => now,
  );
  const context = (
    ledger as unknown as {
      context: {
        assertProjection: (transaction: never, accountId: string) => Promise<void>;
        balanceFromLedger: (
          transaction: never,
          accountId: string,
        ) => Promise<{ free: bigint; purchased: bigint; total: bigint }>;
        expireFreeLots: (
          transaction: never,
          accountId: string,
          userId: string,
          at: Date,
        ) => Promise<void>;
        lockAccount: (
          transaction: never,
          userId: string,
        ) => Promise<{ id: string }>;
        transaction: <T>(
          operation: (transaction: never) => Promise<T>,
        ) => Promise<T>;
      };
    }
  ).context;
  return { client, context, ledger };
}

describe('PrismaCreditLedger facade', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns only non-expired offered lots with a positive balance', async () => {
    const { client, ledger } = harness();
    client.creditLot.findMany.mockResolvedValueOnce([
      { id: 'positive', ledgerEntries: [{ amount: 8n }, { amount: -3n }] },
      { id: 'empty', ledgerEntries: [{ amount: 5n }, { amount: -5n }] },
      { id: 'negative', ledgerEntries: [{ amount: -1n }] },
    ]);

    await expect(ledger.offeredLotIds('user-1')).resolves.toEqual(['positive']);
    expect(client.creditLot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          account: { userId: 'user-1' },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        }),
      }),
    );
  });

  it('returns an empty balance without creating an account', async () => {
    const { client, ledger } = harness();
    client.creditAccount.findUnique.mockResolvedValueOnce(null);
    await expect(ledger.getBalance('user-1')).resolves.toEqual({
      free: 0n,
      purchased: 0n,
      total: 0n,
    });
  });

  it('expires free lots before reading an existing balance', async () => {
    const { client, context, ledger } = harness();
    const transaction = {};
    client.creditAccount.findUnique.mockResolvedValueOnce({ id: 'account-1' });
    vi.spyOn(context, 'transaction').mockImplementation(async (operation) =>
      operation(transaction as never),
    );
    vi.spyOn(context, 'lockAccount').mockResolvedValue({ id: 'account-1' });
    const expireFreeLots = vi
      .spyOn(context, 'expireFreeLots')
      .mockResolvedValue(undefined);
    const assertProjection = vi
      .spyOn(context, 'assertProjection')
      .mockResolvedValue(undefined);
    vi.spyOn(context, 'balanceFromLedger').mockResolvedValue({
      free: 7n,
      purchased: 2n,
      total: 9n,
    });

    await expect(ledger.getBalance('user-1')).resolves.toEqual({
      free: 7n,
      purchased: 2n,
      total: 9n,
    });
    expect(expireFreeLots).toHaveBeenCalledWith(
      transaction,
      'account-1',
      'user-1',
      now,
    );
    expect(assertProjection).toHaveBeenCalledWith(transaction, 'account-1');
  });

  it('expires allocations and rebuilds projections transactionally', async () => {
    const { context, ledger } = harness();
    const transaction = {};
    vi.spyOn(context, 'transaction').mockImplementation(async (operation) =>
      operation(transaction as never),
    );
    vi.spyOn(context, 'lockAccount').mockResolvedValue({ id: 'account-1' });
    vi.spyOn(context, 'expireFreeLots').mockResolvedValue(undefined);
    vi.spyOn(context, 'assertProjection').mockResolvedValue(undefined);
    vi.spyOn(context, 'balanceFromLedger')
      .mockResolvedValueOnce({ free: 4n, purchased: 1n, total: 5n })
      .mockResolvedValueOnce({ free: 3n, purchased: 2n, total: 5n });

    await expect(ledger.expireAllocations('user-1')).resolves.toEqual({
      free: 4n,
      purchased: 1n,
      total: 5n,
    });
    await expect(ledger.rebuildProjection('user-1')).resolves.toEqual({
      free: 3n,
      purchased: 2n,
      total: 5n,
    });
  });

  it('delegates every mutation to the specialized ledger operation', async () => {
    const { ledger } = harness();
    const result = { balance: { free: 1n, purchased: 0n, total: 1n } };
    for (const helper of Object.values(helpers)) helper.mockResolvedValue(result);

    await expect(ledger.grant({} as never)).resolves.toBe(result);
    await expect(ledger.reserve({} as never)).resolves.toBe(result);
    await expect(ledger.settle({} as never)).resolves.toBe(result);
    await expect(ledger.activateReservationLease({} as never)).resolves.toBe(
      result,
    );
    await expect(ledger.release({} as never)).resolves.toBe(result);
    await expect(ledger.expireReservations()).resolves.toBe(result);
    await expect(ledger.adjust({} as never)).resolves.toBe(result);

    expect(helpers.grantCredits).toHaveBeenCalledOnce();
    expect(helpers.reserveCredits).toHaveBeenCalledOnce();
    expect(helpers.settleCredits).toHaveBeenCalledOnce();
    expect(helpers.activateReservationLease).toHaveBeenCalledOnce();
    expect(helpers.releaseCredits).toHaveBeenCalledOnce();
    expect(helpers.expireReservations).toHaveBeenCalledOnce();
    expect(helpers.adjustCredits).toHaveBeenCalledOnce();
  });
});
