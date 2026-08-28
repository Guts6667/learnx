import type { CreditReservationStatus } from '../../../generated/prisma/client.js';
import type { CreditBalance, CreditProvenanceValue } from './credit-ledger.js';

export interface CreditReference {
  id: string;
  type: string;
}

export interface GrantCreditsInput {
  amount: bigint;
  expiresAt?: Date;
  idempotencyKey: string;
  provenance: CreditProvenanceValue;
  reference: CreditReference;
  userId: string;
}

export interface ReserveCreditsInput {
  amount: bigint;
  expiresAt: Date;
  idempotencyKey: string;
  priorityLotIds: readonly string[];
  reference: CreditReference;
  userId: string;
}

export interface SettleCreditsInput {
  amount: bigint;
  reservationId: string;
  userId: string;
}
export interface ReleaseCreditsInput {
  reservationId: string;
  userId: string;
}
export interface ActivateReservationLeaseInput {
  expiresAt: Date;
  reservationId: string;
  userId: string;
}

export interface AdjustCreditsInput {
  actorUserId: string;
  amount: bigint;
  compensatesEntryId?: string;
  expiresAt?: Date;
  idempotencyKey: string;
  provenance: CreditProvenanceValue;
  reason: string;
  userId: string;
}

export interface CreditOperationResult {
  balance: CreditBalance;
  lotId?: string;
  reservation?: {
    ceilingAmount: bigint;
    id: string;
    settledAmount: bigint | null;
    status: CreditReservationStatus;
  };
}

export function isRetryableCreditTransactionError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as Record<string, unknown>;
  if (
    typeof candidate.code === 'string' &&
    ['P2034', 'P2002', '40001'].includes(candidate.code)
  )
    return true;
  if (
    typeof candidate.message === 'string' &&
    candidate.message.includes('could not serialize access') &&
    candidate.message.includes('40001')
  )
    return true;
  if (typeof candidate.meta !== 'object' || candidate.meta === null)
    return false;
  const meta = candidate.meta as Record<string, unknown>;
  return (
    meta.code === '40001' ||
    (typeof meta.message === 'string' &&
      meta.message.includes('could not serialize access'))
  );
}
