import type { PaymentOrderStatus } from '../../../generated/prisma/client.js';

/**
 * Ordering-tolerant state for payment orders (ADR_004 §3).
 *
 * Revolut guarantees neither uniqueness nor ordering of webhook deliveries, so
 * an order's state is the most advanced state observed and never the last one
 * received. Without that, a `PAID` arriving after `FULFILLED` — which happens —
 * would walk a fulfilled purchase backwards and, worse, invite a second
 * fulfilment.
 */

/**
 * How far along the happy path a state sits. Terminal branches share the rank
 * of the state they end, because they are not progress: they are where a
 * purchase stops.
 */
const RANK: Record<PaymentOrderStatus, number> = {
  CREATED: 0,
  PENDING: 1,
  FAILED: 2,
  EXPIRED: 2,
  PAID: 3,
  FULFILLED: 4,
  DISPUTED: 5,
  REFUND_PENDING: 5,
  REFUNDED: 6,
  DISPUTE_WON: 6,
  DISPUTE_LOST: 6,
};

export function paymentOrderRank(status: PaymentOrderStatus): number {
  return RANK[status];
}

export type TransitionDecision =
  | { kind: 'APPLY'; status: PaymentOrderStatus }
  /** Already at or beyond this state: keep the event, change nothing. */
  | { kind: 'OUT_OF_ORDER' };

/**
 * A transition applies only when it moves the order forward.
 *
 * `FAILED` and `EXPIRED` rank below `PAID` on purpose: a payment that failed
 * and was retried successfully must be able to reach PAID, and a late failure
 * notice for an order that has since been paid must not undo it.
 */
export function decideTransition(
  current: PaymentOrderStatus,
  incoming: PaymentOrderStatus,
): TransitionDecision {
  if (paymentOrderRank(incoming) <= paymentOrderRank(current)) {
    return { kind: 'OUT_OF_ORDER' };
  }
  return { kind: 'APPLY', status: incoming };
}

/**
 * Credits are attributed exactly once, when an order first reaches FULFILLED.
 * The redirect never attributes anything (ADR_004 §2), and neither does a
 * repeated FULFILLED.
 */
export function shouldAttributeCredits(input: {
  current: PaymentOrderStatus;
  incoming: PaymentOrderStatus;
}): boolean {
  return (
    input.incoming === 'FULFILLED' &&
    decideTransition(input.current, input.incoming).kind === 'APPLY'
  );
}
