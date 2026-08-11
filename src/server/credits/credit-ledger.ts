import { createHash } from 'node:crypto';

export type CreditProvenanceValue = 'FREE_ALLOCATION' | 'PURCHASED';

export interface CreditBalance {
  free: bigint;
  purchased: bigint;
  total: bigint;
}

export interface CreditLedgerAmount {
  amount: bigint;
  provenance: CreditProvenanceValue;
}

export interface SpendableCreditLot {
  createdAt: Date;
  expiresAt: Date | null;
  id: string;
  provenance: CreditProvenanceValue;
  remainingAmount: bigint;
}

export interface CreditLotAllocation {
  amount: bigint;
  lotId: string;
  provenance: CreditProvenanceValue;
}

export interface CreditSettlementAllocation extends CreditLotAllocation {
  restoredAmount: bigint;
  settledAmount: bigint;
}

export class CreditLedgerError extends Error {
  public constructor(
    public readonly code:
      | 'ADMIN_REQUIRED'
      | 'IDEMPOTENCY_CONFLICT'
      | 'INSUFFICIENT_CREDITS'
      | 'INVALID_AMOUNT'
      | 'INVALID_EXPIRATION'
      | 'INVALID_IDEMPOTENCY_KEY'
      | 'INVALID_REASON'
      | 'LEDGER_INCONSISTENT'
      | 'REFERENCE_NOT_FOUND'
      | 'RESERVATION_EXPIRED'
      | 'RESERVATION_NOT_FOUND'
      | 'RESERVATION_STATE_CONFLICT',
  ) {
    super(code);
    this.name = 'CreditLedgerError';
  }
}

function canonicalize(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function creditRequestFingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

export function assertCreditAmount(
  amount: bigint,
  options: { allowZero?: boolean } = {},
): void {
  if (amount < 0n || (!options.allowZero && amount === 0n)) {
    throw new CreditLedgerError('INVALID_AMOUNT');
  }
}

export function assertIdempotencyKey(key: string): void {
  if (!/^[a-zA-Z0-9._:-]{8,200}$/.test(key)) {
    throw new CreditLedgerError('INVALID_IDEMPOTENCY_KEY');
  }
}

export function assertAdjustmentReason(reason: string): void {
  if (reason.trim().length < 8 || reason.trim().length > 500) {
    throw new CreditLedgerError('INVALID_REASON');
  }
}

export function reconstructCreditBalance(
  entries: readonly CreditLedgerAmount[],
): CreditBalance {
  let free = 0n;
  let purchased = 0n;
  for (const entry of entries) {
    if (entry.provenance === 'FREE_ALLOCATION') free += entry.amount;
    else purchased += entry.amount;
  }
  if (free < 0n || purchased < 0n) {
    throw new CreditLedgerError('LEDGER_INCONSISTENT');
  }
  return { free, purchased, total: free + purchased };
}

function compareLots(left: SpendableCreditLot, right: SpendableCreditLot): number {
  if (left.provenance !== right.provenance) {
    return left.provenance === 'FREE_ALLOCATION' ? -1 : 1;
  }
  if (left.provenance === 'FREE_ALLOCATION') {
    const expirationDifference =
      (left.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
      (right.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER);
    if (expirationDifference !== 0) return expirationDifference;
  }
  const creationDifference = left.createdAt.getTime() - right.createdAt.getTime();
  return creationDifference || left.id.localeCompare(right.id);
}

export function allocateCreditLots(
  lots: readonly SpendableCreditLot[],
  amount: bigint,
  now: Date,
): CreditLotAllocation[] {
  assertCreditAmount(amount);
  let remaining = amount;
  const allocations: CreditLotAllocation[] = [];
  const eligible = lots
    .filter(
      (lot) =>
        lot.remainingAmount > 0n &&
        (lot.provenance === 'PURCHASED' ||
          (lot.expiresAt !== null && lot.expiresAt.getTime() > now.getTime())),
    )
    .sort(compareLots);

  for (const lot of eligible) {
    if (remaining === 0n) break;
    const allocated = lot.remainingAmount < remaining ? lot.remainingAmount : remaining;
    allocations.push({
      amount: allocated,
      lotId: lot.id,
      provenance: lot.provenance,
    });
    remaining -= allocated;
  }
  if (remaining !== 0n) throw new CreditLedgerError('INSUFFICIENT_CREDITS');
  return allocations;
}

export function planCreditSettlement(
  allocations: readonly CreditLotAllocation[],
  amount: bigint,
): CreditSettlementAllocation[] {
  assertCreditAmount(amount, { allowZero: true });
  const ceiling = allocations.reduce((total, allocation) => total + allocation.amount, 0n);
  if (amount > ceiling) throw new CreditLedgerError('INVALID_AMOUNT');
  let remaining = amount;
  return allocations.map((allocation) => {
    const settledAmount = remaining < allocation.amount ? remaining : allocation.amount;
    remaining -= settledAmount;
    return {
      ...allocation,
      restoredAmount: allocation.amount - settledAmount,
      settledAmount,
    };
  });
}
