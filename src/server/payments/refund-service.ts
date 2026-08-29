import { splitRefund, type RefundSplit } from './refund-split.js';
import { assertNoWriteOff, voluntaryRefundMinor } from './voluntary-refund.js';

/**
 * Refunds and lost disputes (V4.5-162).
 *
 * Compensating entries only: the ledger is append-only (ADR_003 §6), so a
 * refund adds a REFUND entry and never modifies the GRANT it compensates. What
 * happened stays readable, including when what happened was a mistake.
 */

export type RefundKind = 'VOLUNTARY' | 'DISPUTE_LOST';

interface RefundOutcome extends RefundSplit {
  /** Money returned, in minor units. Zero for a dispute: the bank decided. */
  refundedMinor: bigint;
}

export interface RefundPorts {
  loadOrder(orderId: string): Promise<{
    creditLotId: string | null;
    packCredits: bigint;
    packPriceMinor: bigint;
    remainingOnLot: bigint;
    userId: string;
  } | null>;
  /** Writes the REFUND entry and the order's two figures in one transaction. */
  applyRefund(input: {
    actorUserId: string;
    kind: RefundKind;
    note?: string;
    orderId: string;
    reclaimed: bigint;
    refundedMinor: bigint;
    userId: string;
    writtenOff: bigint;
  }): Promise<void>;
}

export type RefundResult =
  | ({ kind: 'REFUNDED' } & RefundOutcome)
  | { kind: 'ORDER_NOT_FOUND' }
  | { kind: 'NOT_FULFILLED' };

export async function refundOrder(input: {
  actorUserId: string;
  /** Ignored for a voluntary refund, which computes its own. */
  disputeCredits?: bigint;
  kind: RefundKind;
  note?: string;
  orderId: string;
  ports: RefundPorts;
}): Promise<RefundResult> {
  const order = await input.ports.loadOrder(input.orderId);
  if (!order) return { kind: 'ORDER_NOT_FOUND' };
  // Nothing was granted, so there is nothing to compensate. Refusing here
  // keeps a refund from inventing a reversal for credits never given.
  if (!order.creditLotId) return { kind: 'NOT_FULFILLED' };

  const requested =
    input.kind === 'VOLUNTARY'
      ? order.remainingOnLot
      : (input.disputeCredits ?? order.packCredits);
  const split = splitRefund({
    remainingOnLot: order.remainingOnLot,
    requested,
  });

  if (input.kind === 'VOLUNTARY') {
    // Unreachable today — the amount requested is the remaining amount, so the
    // two cannot differ. Kept for the day a refactor separates them: a
    // voluntary refund that absorbed value would mean the money and the ledger
    // disagree, and that must stop rather than settle on a number.
    assertNoWriteOff(split.writtenOff);
  }

  const refundedMinor =
    input.kind === 'VOLUNTARY'
      ? voluntaryRefundMinor({
          packCredits: order.packCredits,
          packPriceMinor: order.packPriceMinor,
          unspentCredits: split.reclaimed,
        })
      : // A dispute's amount is the bank's, not ours; we record what we
        // reclaimed and absorbed, never a figure we chose.
        0n;

  await input.ports.applyRefund({
    actorUserId: input.actorUserId,
    kind: input.kind,
    ...(input.note === undefined ? {} : { note: input.note }),
    orderId: input.orderId,
    reclaimed: split.reclaimed,
    refundedMinor,
    userId: order.userId,
    writtenOff: split.writtenOff,
  });

  return { kind: 'REFUNDED', refundedMinor, ...split };
}
