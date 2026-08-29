import { CreditProvenance, Role } from '../../../generated/prisma/client.js';
import { describe, expect, it, vi } from 'vitest';

import { creditRequestFingerprint } from './credit-ledger.js';
import type { PrismaCreditLedgerContext } from './prisma-credit-ledger-context.js';
import { adjustCredits, grantCredits } from './prisma-credit-ledger-grants.js';

const now = new Date('2026-08-28T12:00:00.000Z');
const grantInput = {
  amount: 10n,
  idempotencyKey: 'grant-allocation-0001',
  provenance: 'FREE_ALLOCATION' as const,
  reference: { id: 'allocation-1', type: 'COHORT_ALLOCATION' },
  userId: 'user-1',
};
const adjustmentInput = {
  actorUserId: 'admin-1',
  amount: 5n,
  idempotencyKey: 'adjustment-1',
  provenance: 'FREE_ALLOCATION' as const,
  reason: '  correction manuelle documentée  ',
  userId: 'user-1',
};

function harness() {
  const transaction = {
    auditEvent: { upsert: vi.fn() },
    creditLedgerEntry: {
      create: vi.fn(async ({ data }) => ({ id: data.id ?? 'entry-1' })),
      findFirst: vi.fn(),
    },
    creditLot: {
      create: vi.fn(async () => ({ id: 'lot-created' })),
    },
    user: {
      findUnique: vi.fn(async (): Promise<{ role: Role }> => ({
        role: Role.ADMIN,
      })),
    },
  };
  const context = {
    assertProjection: vi.fn(),
    clock: vi.fn(() => now),
    expireFreeLots: vi.fn(),
    lockAccount: vi.fn(async () => ({ id: 'account-1' })),
    result: vi.fn(async (_transaction, _accountId, extra = {}) => ({
      balance: { free: 10n, purchased: 0n, total: 10n },
      ...extra,
    })),
    spendableLots: vi.fn(async () => [
      {
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
        expiresAt: new Date('2026-09-01T00:00:00.000Z'),
        id: 'lot-compensated',
        provenance: 'FREE_ALLOCATION',
        remainingAmount: 8n,
      },
    ]),
    transaction: vi.fn(
      async (operation: (client: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    ),
  } as unknown as PrismaCreditLedgerContext;
  return { context, transaction };
}

describe('grantCredits', () => {
  it('rejects incompatible expiration policies before opening a transaction', async () => {
    const { context } = harness();

    await expect(
      grantCredits(context, { ...grantInput, expiresAt: now }),
    ).rejects.toThrow('INVALID_EXPIRATION');
    await expect(
      grantCredits(context, {
        ...grantInput,
        expiresAt: new Date('2026-09-01T00:00:00.000Z'),
        provenance: 'PURCHASED',
      }),
    ).rejects.toThrow('INVALID_EXPIRATION');
    expect(context.transaction).not.toHaveBeenCalled();
  });

  it('creates a grant lot and its immutable ledger entry', async () => {
    const { context, transaction } = harness();
    transaction.creditLedgerEntry.findFirst.mockResolvedValueOnce(null);

    await expect(grantCredits(context, grantInput)).resolves.toMatchObject({
      lotId: 'lot-created',
    });
    expect(transaction.creditLot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: 'account-1',
        initialAmount: 10n,
        provenance: CreditProvenance.FREE_ALLOCATION,
        remainingAmount: 10n,
      }),
    });
    expect(transaction.creditLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 10n,
        lotId: 'lot-created',
        operationKey: 'grant:grant-allocation-0001',
      }),
    });
    expect(context.assertProjection).toHaveBeenCalledOnce();
  });

  it('returns an identical grant and rejects an idempotency conflict', async () => {
    const { context, transaction } = harness();
    const existing = {
      lotId: 'existing-lot',
      requestFingerprint: creditRequestFingerprint({
        ...grantInput,
        type: 'GRANT',
      }),
    };
    transaction.creditLedgerEntry.findFirst.mockResolvedValueOnce(existing);
    await expect(grantCredits(context, grantInput)).resolves.toMatchObject({
      lotId: 'existing-lot',
    });

    transaction.creditLedgerEntry.findFirst.mockResolvedValueOnce({
      ...existing,
      requestFingerprint: 'different',
    });
    await expect(grantCredits(context, grantInput)).rejects.toThrow(
      'IDEMPOTENCY_CONFLICT',
    );
  });
});

describe('adjustCredits', () => {
  it('enforces amount, provenance and expiration rules', async () => {
    const { context } = harness();
    await expect(
      adjustCredits(context, { ...adjustmentInput, amount: 0n }),
    ).rejects.toThrow('INVALID_AMOUNT');
    await expect(
      adjustCredits(context, {
        ...adjustmentInput,
        provenance: 'PURCHASED',
      }),
    ).rejects.toThrow('PURCHASED_CREDITS_PROTECTED');
    await expect(
      adjustCredits(context, { ...adjustmentInput, expiresAt: now }),
    ).rejects.toThrow('INVALID_EXPIRATION');
  });

  it('requires an administrator and preserves idempotency', async () => {
    const { context, transaction } = harness();
    transaction.user.findUnique.mockResolvedValueOnce({ role: Role.USER });
    await expect(adjustCredits(context, adjustmentInput)).rejects.toThrow(
      'ADMIN_REQUIRED',
    );

    transaction.creditLedgerEntry.findFirst.mockResolvedValueOnce({
      requestFingerprint: creditRequestFingerprint({
        ...adjustmentInput,
        type: 'ADMIN_ADJUSTMENT',
      }),
    });
    await expect(
      adjustCredits(context, adjustmentInput),
    ).resolves.toMatchObject({ balance: { total: 10n } });

    transaction.creditLedgerEntry.findFirst.mockResolvedValueOnce({
      requestFingerprint: 'different',
    });
    await expect(adjustCredits(context, adjustmentInput)).rejects.toThrow(
      'IDEMPOTENCY_CONFLICT',
    );
  });

  it('creates and audits a positive free-credit adjustment', async () => {
    const { context, transaction } = harness();
    transaction.creditLedgerEntry.findFirst.mockResolvedValueOnce(null);

    await expect(
      adjustCredits(context, adjustmentInput),
    ).resolves.toMatchObject({ balance: { free: 10n } });
    expect(transaction.creditLot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        initialAmount: 5n,
        sourceReferenceType: 'ADMIN_CREDIT_ADJUSTMENT',
      }),
    });
    expect(transaction.creditLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 5n,
        reason: 'correction manuelle documentée',
      }),
    });
    expect(transaction.auditEvent.upsert).toHaveBeenCalledOnce();
    expect(context.expireFreeLots).toHaveBeenCalledOnce();
  });

  it('rejects an invalid compensation and withdraws from its referenced lot', async () => {
    const { context, transaction } = harness();
    const negative = {
      ...adjustmentInput,
      amount: -3n,
      compensatesEntryId: 'grant-entry-1',
    };
    transaction.creditLedgerEntry.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    await expect(adjustCredits(context, negative)).rejects.toThrow(
      'REFERENCE_NOT_FOUND',
    );

    transaction.creditLedgerEntry.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        amount: 8n,
        id: 'grant-entry-1',
        lotId: 'lot-compensated',
        provenance: CreditProvenance.FREE_ALLOCATION,
      });
    await expect(adjustCredits(context, negative)).resolves.toMatchObject({
      balance: { total: 10n },
    });
    expect(transaction.creditLedgerEntry.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        amount: -3n,
        lotId: 'lot-compensated',
        referenceId: 'grant-entry-1',
      }),
    });
    expect(transaction.auditEvent.upsert).toHaveBeenCalledOnce();
  });
});
