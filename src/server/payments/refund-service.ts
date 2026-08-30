import type { PaymentOrderStatus } from '../../../generated/prisma/client.js';
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
    status: PaymentOrderStatus;
    userId: string;
  } | null>;
  /**
   * Writes the REFUND entry and the order's two figures in one transaction.
   *
   * Returns false when the order had already been refunded by someone else
   * between `loadOrder` and here. The status check below is a read that
   * happened earlier; two administrators clicking together would both pass it,
   * so the write itself has to be the one that refuses.
   */
  applyRefund(input: {
    actorUserId: string;
    kind: RefundKind;
    note?: string;
    orderId: string;
    reclaimed: bigint;
    refundedMinor: bigint;
    userId: string;
    writtenOff: bigint;
  }): Promise<boolean>;
}

export type RefundResult =
  | ({ kind: 'REFUNDED' } & RefundOutcome)
  | { kind: 'ORDER_NOT_FOUND' }
  | { kind: 'REFUSED'; reason: RefundRefusalCode }
  | { kind: 'PREVIEW_STALE'; remainingOnLot: bigint };

export type RefundRefusalCode =
  | 'NOT_FULFILLED'
  | 'ALREADY_REFUNDED'
  | 'DISPUTE_LOST'
  | 'UNDER_DISPUTE'
  | 'REFUND_PENDING';

/**
 * Why this order cannot be refunded, or null when it can. Stated once so the
 * preview and the refund itself cannot drift into disagreeing — a screen that
 * offers a button the endpoint refuses is worse than one that offers nothing.
 *
 * `ALREADY_REFUNDED` is the case that motivated V4.5-162B. Refunding twice
 * does not reclaim twice, because the ledger refuses a second
 * `refund:<orderId>`. But the second pass recomputes from a lot that is now
 * empty, gets zero, and writes that zero over what the first refund recorded:
 * the ledger stays right while the order denies the refund ever happened, on
 * the two fields the administration screen reads.
 *
 * `DISPUTE_WON` is deliberately absent. The bank sided with us and the money
 * is ours, so a commercial refund remains the administrator's decision.
 */
export const REFUSAL_MESSAGES: Record<RefundRefusalCode, string> = {
  ALREADY_REFUNDED: 'This order has already been refunded.',
  DISPUTE_LOST: 'This order was already reclaimed through a lost dispute.',
  NOT_FULFILLED: 'This order was never fulfilled.',
  REFUND_PENDING: 'A refund is already in progress for this order.',
  UNDER_DISPUTE: 'This order is under dispute.',
};

export function refundRefusal(order: {
  creditLotId: string | null;
  status: PaymentOrderStatus;
}): RefundRefusalCode | null {
  // Nothing was granted, so there is nothing to compensate. Refusing here
  // keeps a refund from inventing a reversal for credits never given.
  if (!order.creditLotId) return 'NOT_FULFILLED';

  switch (order.status) {
    case 'REFUNDED':
      return 'ALREADY_REFUNDED';
    case 'DISPUTE_LOST':
      return 'DISPUTE_LOST';
    case 'DISPUTED':
      return 'UNDER_DISPUTE';
    case 'REFUND_PENDING':
      return 'REFUND_PENDING';
    default:
      return null;
  }
}

export async function refundOrder(input: {
  actorUserId: string;
  /**
   * The remaining balance the administrator was shown. Optional so a dispute
   * settlement — which has no preview and no human choosing an amount — can
   * still call this; required by the administration route, where confirming a
   * figure that has since moved would approve a number that is not the one
   * that leaves.
   */
  expectedRemainingOnLot?: bigint;
  /** Ignored for a voluntary refund, which computes its own. */
  disputeCredits?: bigint;
  kind: RefundKind;
  note?: string;
  orderId: string;
  ports: RefundPorts;
}): Promise<RefundResult> {
  const order = await input.ports.loadOrder(input.orderId);
  if (!order) return { kind: 'ORDER_NOT_FOUND' };

  const refusal = refundRefusal(order);
  if (refusal) return { kind: 'REFUSED', reason: refusal };

  if (
    input.expectedRemainingOnLot !== undefined &&
    input.expectedRemainingOnLot !== order.remainingOnLot
  ) {
    // The lot moved between the preview and the confirmation — the learner
    // spent credits while the administrator was reading. Refunding now would
    // pay back an amount nobody approved.
    return { kind: 'PREVIEW_STALE', remainingOnLot: order.remainingOnLot };
  }

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

  const applied = await input.ports.applyRefund({
    actorUserId: input.actorUserId,
    kind: input.kind,
    ...(input.note === undefined ? {} : { note: input.note }),
    orderId: input.orderId,
    reclaimed: split.reclaimed,
    refundedMinor,
    userId: order.userId,
    writtenOff: split.writtenOff,
  });

  // Lost the race: another refund settled the order first. The status check
  // above is a read that happened earlier, and `expectedRemainingOnLot` does
  // not cover this — two administrators on an untouched lot both hold a valid
  // figure. Reporting success would tell the second one a refund had been made.
  if (!applied) return { kind: 'REFUSED', reason: 'ALREADY_REFUNDED' };

  return { kind: 'REFUNDED', refundedMinor, ...split };
}
