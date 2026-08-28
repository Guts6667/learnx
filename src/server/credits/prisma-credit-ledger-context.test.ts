import {
  CreditProvenance,
  type PrismaClient,
} from '../../../generated/prisma/client.js';
import { describe, expect, it, vi } from 'vitest';

import { CreditLedgerError } from './credit-ledger.js';
import {
  assertReference,
  dbProvenance,
  domainProvenance,
  PrismaCreditLedgerContext,
} from './prisma-credit-ledger-context.js';

function harness() {
  const transaction = {
    $queryRaw: vi.fn(),
    creditAccount: {
      findUniqueOrThrow: vi.fn(),
      upsert: vi.fn(),
    },
    creditLedgerEntry: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    creditLot: { findMany: vi.fn() },
  };
  const transactionCall = vi.fn(
    async (operation: (client: typeof transaction) => Promise<unknown>) =>
      operation(transaction),
  );
  const prisma = { $transaction: transactionCall } as unknown as PrismaClient;
  return {
    context: new PrismaCreditLedgerContext(
      prisma,
      () => new Date('2026-08-28T12:00:00.000Z'),
    ),
    prisma,
    transaction,
    transactionCall,
  };
}

describe('PrismaCreditLedgerContext', () => {
  it('validates references and maps provenance in both directions', () => {
    expect(() => assertReference({ id: ' ', type: 'ACTION' })).toThrow(
      new CreditLedgerError('REFERENCE_NOT_FOUND'),
    );
    expect(() => assertReference({ id: 'action-1', type: '' })).toThrow(
      'REFERENCE_NOT_FOUND',
    );
    expect(() =>
      assertReference({ id: 'action-1', type: 'ACTION' }),
    ).not.toThrow();
    expect(dbProvenance('FREE_ALLOCATION')).toBe(
      CreditProvenance.FREE_ALLOCATION,
    );
    expect(dbProvenance('PURCHASED')).toBe(CreditProvenance.PURCHASED);
    expect(domainProvenance(CreditProvenance.FREE_ALLOCATION)).toBe(
      'FREE_ALLOCATION',
    );
    expect(domainProvenance(CreditProvenance.PURCHASED)).toBe('PURCHASED');
  });

  it('runs serializable transactions and retries only retryable failures', async () => {
    const { context, prisma, transaction, transactionCall } = harness();
    await expect(context.transaction(async () => 'ok')).resolves.toBe('ok');
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
      maxWait: 5_000,
      timeout: 15_000,
    });

    transactionCall
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce(async (operation) => operation(transaction));
    await expect(context.transaction(async () => 'retried')).resolves.toBe(
      'retried',
    );

    transactionCall.mockRejectedValueOnce(new Error('not retryable'));
    await expect(context.transaction(async () => 'never')).rejects.toThrow(
      'not retryable',
    );

    transactionCall
      .mockRejectedValueOnce({ code: '40001' })
      .mockRejectedValueOnce({
        message: 'could not serialize access due to concurrent update 40001',
      })
      .mockRejectedValueOnce({
        meta: { message: 'could not serialize access' },
      });
    await expect(context.transaction(async () => 'never')).rejects.toEqual({
      meta: { message: 'could not serialize access' },
    });
  });

  it('locks one LearnX credit account before returning it', async () => {
    const { context, transaction } = harness();
    transaction.creditAccount.upsert.mockResolvedValueOnce({ id: 'account-1' });
    transaction.creditAccount.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'account-1',
      userId: 'user-1',
    });

    await expect(
      context.lockAccount(transaction as never, 'user-1'),
    ).resolves.toMatchObject({ id: 'account-1' });
    expect(transaction.$queryRaw).toHaveBeenCalledOnce();
    expect(transaction.creditAccount.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_currency: expect.objectContaining({ userId: 'user-1' }),
        },
      }),
    );
  });

  it('reconstructs balances, results and projection checks from ledger entries', async () => {
    const { context, transaction } = harness();
    transaction.creditLedgerEntry.findMany.mockResolvedValue([
      { amount: 10n, provenance: CreditProvenance.FREE_ALLOCATION },
      { amount: 4n, provenance: CreditProvenance.PURCHASED },
      { amount: -2n, provenance: CreditProvenance.FREE_ALLOCATION },
    ]);

    await expect(
      context.balanceFromLedger(transaction as never, 'account-1'),
    ).resolves.toEqual({ free: 8n, purchased: 4n, total: 12n });
    await expect(
      context.result(transaction as never, 'account-1', { lotId: 'lot-1' }),
    ).resolves.toEqual({
      balance: { free: 8n, purchased: 4n, total: 12n },
      lotId: 'lot-1',
    });
    await expect(
      context.assertProjection(transaction as never, 'account-1'),
    ).resolves.toBeUndefined();
  });

  it('expires only the positive remainder of eligible free lots', async () => {
    const { context, transaction } = harness();
    transaction.creditLot.findMany.mockResolvedValueOnce([
      {
        expiresAt: new Date('2026-08-27T00:00:00.000Z'),
        id: 'empty-lot',
        ledgerEntries: [{ amount: 5n }, { amount: -5n }],
      },
      {
        expiresAt: new Date('2026-08-27T00:00:00.000Z'),
        id: 'active-lot',
        ledgerEntries: [{ amount: 8n }, { amount: -3n }],
      },
    ]);
    transaction.creditLedgerEntry.count.mockResolvedValueOnce(1);
    transaction.creditLedgerEntry.create.mockResolvedValueOnce({ id: 'entry' });

    await context.expireFreeLots(
      transaction as never,
      'account-1',
      'user-1',
      new Date('2026-08-28T12:00:00.000Z'),
    );

    expect(transaction.creditLedgerEntry.create).toHaveBeenCalledTimes(1);
    expect(transaction.creditLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: -5n,
        lotId: 'active-lot',
        operationKey: 'expiration:active-lot',
        operationSequence: 2,
        userId: 'user-1',
      }),
    });
  });

  it('returns only lots with a positive spendable remainder', async () => {
    const { context, transaction } = harness();
    transaction.creditLot.findMany.mockResolvedValueOnce([
      {
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
        expiresAt: null,
        id: 'spent',
        ledgerEntries: [{ amount: 5n }, { amount: -5n }],
        provenance: CreditProvenance.PURCHASED,
      },
      {
        createdAt: new Date('2026-08-02T00:00:00.000Z'),
        expiresAt: new Date('2026-09-01T00:00:00.000Z'),
        id: 'available',
        ledgerEntries: [{ amount: 10n }, { amount: -3n }],
        provenance: CreditProvenance.FREE_ALLOCATION,
      },
    ]);

    await expect(
      context.spendableLots(transaction as never, 'account-1'),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'available',
        provenance: 'FREE_ALLOCATION',
        remainingAmount: 7n,
      }),
    ]);
  });
});
