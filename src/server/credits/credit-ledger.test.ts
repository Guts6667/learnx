import { describe, expect, it } from 'vitest';
import {
  CreditLedgerError,
  allocateCreditLots,
  assertAdjustmentReason,
  assertCreditAmount,
  assertIdempotencyKey,
  creditRequestFingerprint,
  planCreditSettlement,
  reconstructCreditBalance,
  type SpendableCreditLot,
} from './credit-ledger.js';
import { isRetryableCreditTransactionError } from './prisma-credit-ledger.js';

const now = new Date('2026-08-12T12:00:00.000Z');

function lot(
  id: string,
  provenance: SpendableCreditLot['provenance'],
  remainingAmount: bigint,
  options: { createdAt?: Date; expiresAt?: Date | null } = {},
): SpendableCreditLot {
  return {
    createdAt: options.createdAt ?? new Date('2026-08-01T00:00:00.000Z'),
    expiresAt:
      options.expiresAt === undefined
        ? provenance === 'FREE_ALLOCATION'
          ? new Date('2026-09-01T00:00:00.000Z')
          : null
        : options.expiresAt,
    id,
    provenance,
    remainingAmount,
  };
}

describe('credit ledger domain', () => {
  it('recognizes direct and Prisma-wrapped serialization conflicts', () => {
    expect(isRetryableCreditTransactionError({ code: 'P2034' })).toBe(true);
    expect(isRetryableCreditTransactionError({ code: '40001' })).toBe(true);
    expect(
      isRetryableCreditTransactionError({
        code: 'P2010',
        meta: {
          code: '40001',
          message: 'could not serialize access due to concurrent update',
        },
      }),
    ).toBe(true);
    expect(
      isRetryableCreditTransactionError({
        code: 'P2010',
        meta: { code: '23514', message: 'check constraint failed' },
      }),
    ).toBe(false);
  });

  it('reconstructs the two balances from immutable signed entries', () => {
    expect(
      reconstructCreditBalance([
        { amount: 100n, provenance: 'FREE_ALLOCATION' },
        { amount: 500n, provenance: 'PURCHASED' },
        { amount: -30n, provenance: 'FREE_ALLOCATION' },
        { amount: -125n, provenance: 'PURCHASED' },
      ]),
    ).toEqual({ free: 70n, purchased: 375n, total: 445n });
  });

  it('rejects a reconstructed negative provenance even when total is positive', () => {
    expect(() =>
      reconstructCreditBalance([
        { amount: -1n, provenance: 'FREE_ALLOCATION' },
        { amount: 100n, provenance: 'PURCHASED' },
      ]),
    ).toThrowError(new CreditLedgerError('LEDGER_INCONSISTENT'));
  });

  it('consumes free credits first, earliest expiration first, then purchased FIFO', () => {
    const allocations = allocateCreditLots(
      [
        lot('purchased-new', 'PURCHASED', 100n, {
          createdAt: new Date('2026-08-10T00:00:00.000Z'),
        }),
        lot('free-late', 'FREE_ALLOCATION', 20n, {
          expiresAt: new Date('2026-09-30T00:00:00.000Z'),
        }),
        lot('purchased-old', 'PURCHASED', 100n),
        lot('free-soon', 'FREE_ALLOCATION', 40n, {
          expiresAt: new Date('2026-08-20T00:00:00.000Z'),
        }),
      ],
      170n,
      now,
    );
    expect(allocations).toEqual([
      { amount: 40n, lotId: 'free-soon', provenance: 'FREE_ALLOCATION' },
      { amount: 20n, lotId: 'free-late', provenance: 'FREE_ALLOCATION' },
      { amount: 100n, lotId: 'purchased-old', provenance: 'PURCHASED' },
      { amount: 10n, lotId: 'purchased-new', provenance: 'PURCHASED' },
    ]);
  });

  it('never allocates expired free credits and never expires purchased credits', () => {
    expect(
      allocateCreditLots(
        [
          lot('expired-free', 'FREE_ALLOCATION', 100n, {
            expiresAt: new Date('2026-08-11T23:59:59.999Z'),
          }),
          lot('purchased', 'PURCHASED', 75n),
        ],
        75n,
        now,
      ),
    ).toEqual([
      { amount: 75n, lotId: 'purchased', provenance: 'PURCHASED' },
    ]);
  });

  it('rejects reservation ceilings above the available balance', () => {
    expect(() =>
      allocateCreditLots([lot('free', 'FREE_ALLOCATION', 10n)], 11n, now),
    ).toThrowError(new CreditLedgerError('INSUFFICIENT_CREDITS'));
  });

  it('settles in reservation order and releases the exact difference', () => {
    expect(
      planCreditSettlement(
        [
          { amount: 40n, lotId: 'free', provenance: 'FREE_ALLOCATION' },
          { amount: 60n, lotId: 'paid', provenance: 'PURCHASED' },
        ],
        55n,
      ),
    ).toEqual([
      {
        amount: 40n,
        lotId: 'free',
        provenance: 'FREE_ALLOCATION',
        restoredAmount: 0n,
        settledAmount: 40n,
      },
      {
        amount: 60n,
        lotId: 'paid',
        provenance: 'PURCHASED',
        restoredAmount: 45n,
        settledAmount: 15n,
      },
    ]);
  });

  it('fully releases a reservation when no usable result exists', () => {
    const plan = planCreditSettlement(
      [{ amount: 80n, lotId: 'free', provenance: 'FREE_ALLOCATION' }],
      0n,
    );
    expect(plan[0]).toMatchObject({ restoredAmount: 80n, settledAmount: 0n });
  });

  it('uses canonical fingerprints for idempotent payload comparison', () => {
    const left = creditRequestFingerprint({ amount: 12n, nested: { b: 2, a: 1 } });
    const right = creditRequestFingerprint({ nested: { a: 1, b: 2 }, amount: 12n });
    expect(left).toBe(right);
    expect(left).toMatch(/^[0-9a-f]{64}$/);
  });

  it('validates integer-domain operation inputs', () => {
    expect(() => assertCreditAmount(0n)).toThrowError(
      new CreditLedgerError('INVALID_AMOUNT'),
    );
    expect(() => assertIdempotencyKey('short')).toThrowError(
      new CreditLedgerError('INVALID_IDEMPOTENCY_KEY'),
    );
    expect(() => assertAdjustmentReason('tiny')).toThrowError(
      new CreditLedgerError('INVALID_REASON'),
    );
  });

  it('preserves allocation conservation over deterministic property samples', () => {
    let state = 0x1234abcd;
    const next = (): number => {
      state = (state * 1_664_525 + 1_013_904_223) >>> 0;
      return state;
    };
    for (let sample = 0; sample < 500; sample += 1) {
      const free = BigInt((next() % 500) + 1);
      const purchased = BigInt((next() % 500) + 1);
      const requested = BigInt((next() % Number(free + purchased)) + 1);
      const allocations = allocateCreditLots(
        [
          lot(`free-${sample}`, 'FREE_ALLOCATION', free),
          lot(`paid-${sample}`, 'PURCHASED', purchased),
        ],
        requested,
        now,
      );
      expect(allocations.reduce((sum, item) => sum + item.amount, 0n)).toBe(
        requested,
      );
      const freeAllocated = allocations
        .filter((item) => item.provenance === 'FREE_ALLOCATION')
        .reduce((sum, item) => sum + item.amount, 0n);
      expect(freeAllocated).toBe(requested < free ? requested : free);
      const plan = planCreditSettlement(allocations, requested / 2n);
      expect(
        plan.reduce(
          (sum, item) => sum + item.settledAmount + item.restoredAmount,
          0n,
        ),
      ).toBe(requested);
    }
  });
});
