import {
  CreditLedgerEntryType,
  CreditProvenance,
  type PrismaClient,
} from '../../../generated/prisma/client.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  deriveCreditProjection,
  PrismaCreditAdministrationService,
} from './credit-administration.js';
import { PrismaCreditLedger } from './prisma-credit-ledger.js';

const now = new Date('2026-08-28T12:00:00.000Z');

function harness() {
  const transaction = {
    auditEvent: { upsert: vi.fn() },
    creditIncreaseRequest: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  const client = {
    $transaction: vi.fn(async (operation: unknown) => {
      if (Array.isArray(operation)) return Promise.all(operation);
      return (operation as (value: typeof transaction) => Promise<unknown>)(
        transaction,
      );
    }),
    creditAllocationPolicyVersion: { findMany: vi.fn() },
    creditIncreaseRequest: { create: vi.fn(), findUnique: vi.fn() },
    creditLimitPolicyVersion: { findMany: vi.fn() },
    user: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
  };
  const service = new PrismaCreditAdministrationService(
    client as unknown as PrismaClient,
    () => now,
  );
  return { client, service, transaction };
}

function storedUser(overrides: Record<string, unknown> = {}) {
  return {
    accountStatus: 'ACTIVE',
    creditAccounts: [
      {
        ledgerEntries: [
          {
            actorUserId: 'admin-1',
            amount: 10n,
            createdAt: now,
            id: 'entry-1',
            provenance: CreditProvenance.FREE_ALLOCATION,
            reason: 'Allocation pilote',
            referenceId: 'grant-1',
            referenceType: 'GRANT',
            type: CreditLedgerEntryType.GRANT,
          },
        ],
      },
    ],
    creditIncreaseRequests: [],
    displayName: 'Learner',
    email: 'learner@example.com',
    id: 'user-1',
    ...overrides,
  };
}

describe('V4-008 credit projections', () => {
  afterEach(() => vi.restoreAllMocks());
  it('reconciles available, reserved, consumed and expired values from the ledger', () => {
    const projection = deriveCreditProjection([
      {
        amount: 100n,
        provenance: CreditProvenance.FREE_ALLOCATION,
        type: CreditLedgerEntryType.GRANT,
      },
      {
        amount: -30n,
        provenance: CreditProvenance.FREE_ALLOCATION,
        type: CreditLedgerEntryType.RESERVATION_HOLD,
      },
      {
        amount: 30n,
        provenance: CreditProvenance.FREE_ALLOCATION,
        type: CreditLedgerEntryType.RESERVATION_RELEASE,
      },
      {
        amount: -20n,
        provenance: CreditProvenance.FREE_ALLOCATION,
        type: CreditLedgerEntryType.SETTLEMENT,
      },
      {
        amount: -10n,
        provenance: CreditProvenance.FREE_ALLOCATION,
        type: CreditLedgerEntryType.EXPIRATION,
      },
      {
        amount: 50n,
        provenance: CreditProvenance.PURCHASED,
        type: CreditLedgerEntryType.GRANT,
      },
      {
        amount: -5n,
        provenance: CreditProvenance.PURCHASED,
        type: CreditLedgerEntryType.RESERVATION_HOLD,
      },
    ]);

    expect(projection).toEqual({
      free: { available: 70n, consumed: 20n, expired: 10n, reserved: 0n },
      purchased: { available: 45n, consumed: 0n, expired: 0n, reserved: 5n },
      totalAvailable: 115n,
      totalReserved: 5n,
    });
  });

  it('rejects an inconsistent negative projection', () => {
    expect(() =>
      deriveCreditProjection([
        {
          amount: -1n,
          provenance: CreditProvenance.PURCHASED,
          type: CreditLedgerEntryType.SETTLEMENT,
        },
      ]),
    ).toThrow('CREDIT_LEDGER_INCONSISTENT');
  });

  it('returns a member detail reconstructed from ledger history', async () => {
    const { client, service } = harness();
    vi.spyOn(PrismaCreditLedger.prototype, 'getBalance').mockResolvedValue({
      free: 10n,
      purchased: 0n,
      total: 10n,
    });
    client.user.findUnique.mockResolvedValueOnce(
      storedUser({
        creditIncreaseRequests: [
          { createdAt: now, id: 'request-1', reason: 'Besoin ponctuel' },
        ],
      }),
    );

    await expect(service.getOwnCredits('user-1')).resolves.toMatchObject({
      history: [
        expect.objectContaining({
          entryId: 'entry-1',
          provenance: 'FREE_ALLOCATION',
        }),
      ],
      pendingIncreaseRequest: { id: 'request-1' },
      projection: { totalAvailable: 10n },
      userId: 'user-1',
    });

    client.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.getMember('admin-1', 'missing')).resolves.toBeNull();
  });

  it('lists searched members and filters records that disappear concurrently', async () => {
    const { client, service } = harness();
    vi.spyOn(PrismaCreditLedger.prototype, 'getBalance').mockResolvedValue({
      free: 0n,
      purchased: 0n,
      total: 0n,
    });
    client.user.findMany.mockResolvedValueOnce([
      { id: 'user-1' },
      { id: 'user-deleted' },
    ]);
    client.user.count.mockResolvedValueOnce(3);
    client.user.findUnique
      .mockResolvedValueOnce(storedUser())
      .mockResolvedValueOnce(null);

    await expect(
      service.listMembers({
        actorUserId: 'admin-1',
        page: 2,
        pageSize: 2,
        search: 'learner',
      }),
    ).resolves.toMatchObject({
      items: [expect.objectContaining({ userId: 'user-1' })],
      page: 2,
      pageSize: 2,
      total: 3,
      totalPages: 2,
    });
    expect(client.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 2,
        take: 2,
        where: {
          OR: [
            {
              displayName: { contains: 'learner', mode: 'insensitive' },
            },
            { email: { contains: 'learner', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });

  it('protects purchased credits and returns the adjusted member detail', async () => {
    const { client, service } = harness();
    const adjust = vi
      .spyOn(PrismaCreditLedger.prototype, 'adjust')
      .mockResolvedValue({
        balance: { free: 5n, purchased: 0n, total: 5n },
      });
    vi.spyOn(PrismaCreditLedger.prototype, 'getBalance').mockResolvedValue({
      free: 5n,
      purchased: 0n,
      total: 5n,
    });

    await expect(
      service.adjustFreeAllocation({
        actorUserId: 'admin-1',
        amount: 1n,
        idempotencyKey: 'adjustment:1',
        provenance: 'PURCHASED',
        reason: 'Interdit',
        userId: 'user-1',
      }),
    ).rejects.toThrow('PURCHASED_CREDITS_PROTECTED');
    expect(adjust).not.toHaveBeenCalled();

    client.user.findUnique.mockResolvedValueOnce(storedUser());
    await expect(
      service.adjustFreeAllocation({
        actorUserId: 'admin-1',
        amount: 5n,
        idempotencyKey: 'adjustment:2',
        provenance: 'FREE_ALLOCATION',
        reason: 'Allocation exceptionnelle',
        userId: 'user-1',
      }),
    ).resolves.toMatchObject({ userId: 'user-1' });

    client.user.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.adjustFreeAllocation({
        actorUserId: 'admin-1',
        amount: 5n,
        idempotencyKey: 'adjustment:3',
        provenance: 'FREE_ALLOCATION',
        reason: 'Allocation exceptionnelle',
        userId: 'missing',
      }),
    ).rejects.toThrow('CREDIT_MEMBER_NOT_FOUND');
  });

  it('creates and safely replays an increase request', async () => {
    const { client, service } = harness();
    client.creditIncreaseRequest.findUnique.mockResolvedValueOnce(null);
    client.creditIncreaseRequest.create.mockResolvedValueOnce({
      id: 'request-1',
      reason: 'Besoin ponctuel',
      requestFingerprint: expect.any(String),
    });
    await expect(
      service.createIncreaseRequest({
        idempotencyKey: 'increase:request:1',
        reason: '  Besoin ponctuel  ',
        userId: 'user-1',
      }),
    ).resolves.toMatchObject({ id: 'request-1' });
    expect(client.creditIncreaseRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ reason: 'Besoin ponctuel' }),
    });

    const createdData =
      client.creditIncreaseRequest.create.mock.calls[0]?.[0]?.data;
    client.creditIncreaseRequest.findUnique.mockResolvedValueOnce({
      id: 'request-1',
      requestFingerprint: createdData?.requestFingerprint,
    });
    await expect(
      service.createIncreaseRequest({
        idempotencyKey: 'increase:request:1',
        reason: 'Besoin ponctuel',
        userId: 'user-1',
      }),
    ).resolves.toMatchObject({ id: 'request-1' });

    client.creditIncreaseRequest.findUnique.mockResolvedValueOnce({
      id: 'request-1',
      requestFingerprint: 'different',
    });
    await expect(
      service.createIncreaseRequest({
        idempotencyKey: 'increase:request:1',
        reason: 'Besoin ponctuel',
        userId: 'user-1',
      }),
    ).rejects.toThrow('IDEMPOTENCY_CONFLICT');
  });

  it('reviews a pending request idempotently and rejects conflicting states', async () => {
    const { service, transaction } = harness();
    transaction.creditIncreaseRequest.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.reviewIncreaseRequest({
        actorUserId: 'admin-1',
        idempotencyKey: 'review:request:1',
        requestId: 'missing',
        reviewReason: 'Décision documentée',
        status: 'APPROVED',
      }),
    ).rejects.toThrow('CREDIT_REQUEST_NOT_FOUND');

    transaction.creditIncreaseRequest.findUnique.mockResolvedValueOnce({
      id: 'request-1',
      status: 'APPROVED',
    });
    await expect(
      service.reviewIncreaseRequest({
        actorUserId: 'admin-1',
        idempotencyKey: 'review:request:2',
        requestId: 'request-1',
        reviewReason: 'Décision documentée',
        status: 'APPROVED',
      }),
    ).resolves.toBeUndefined();

    transaction.creditIncreaseRequest.findUnique.mockResolvedValueOnce({
      id: 'request-1',
      status: 'REJECTED',
    });
    await expect(
      service.reviewIncreaseRequest({
        actorUserId: 'admin-1',
        idempotencyKey: 'review:request:3',
        requestId: 'request-1',
        reviewReason: 'Décision documentée',
        status: 'APPROVED',
      }),
    ).rejects.toThrow('CREDIT_REQUEST_STATE_CONFLICT');

    transaction.creditIncreaseRequest.findUnique.mockResolvedValueOnce({
      id: 'request-1',
      status: 'PENDING',
    });
    transaction.creditIncreaseRequest.update.mockResolvedValueOnce({});
    transaction.auditEvent.upsert.mockResolvedValueOnce({});
    await service.reviewIncreaseRequest({
      actorUserId: 'admin-1',
      idempotencyKey: 'review:request:4',
      requestId: 'request-1',
      reviewReason: '  Décision documentée  ',
      status: 'REJECTED',
    });
    expect(transaction.creditIncreaseRequest.update).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reviewedAt: now,
        reviewReason: 'Décision documentée',
        status: 'REJECTED',
      }),
      where: { id: 'request-1' },
    });
    expect(transaction.auditEvent.upsert).toHaveBeenCalledOnce();
  });

  it('returns allocation and limit policies together', async () => {
    const { client, service } = harness();
    client.creditAllocationPolicyVersion.findMany.mockResolvedValueOnce([
      { id: 'allocation-1' },
    ]);
    client.creditLimitPolicyVersion.findMany.mockResolvedValueOnce([
      { id: 'limit-1' },
    ]);
    await expect(service.listPolicies()).resolves.toEqual({
      allocation: [{ id: 'allocation-1' }],
      limits: [{ id: 'limit-1' }],
    });
  });
});
