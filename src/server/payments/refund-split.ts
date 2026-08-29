/**
 * How a refund divides between credits reclaimed and value written off
 * (V4.5-162).
 *
 * A refund can arrive after the credits have been spent. What is left on the
 * purchased lot comes back; what was already consumed cannot, and is written
 * off rather than clawed back — a learner who was refunded must not end up
 * owing credits.
 *
 * The two numbers live in different places on purpose. The reclaimed credits
 * are a credit fact and become a ledger entry; the write-off is a money fact —
 * value refunded that no credit could be taken back for — and belongs to the
 * payment order. Recording the write-off in the credit ledger would move the
 * balance by exactly the amount we are declaring unreclaimable.
 */

export interface RefundSplit {
  /** Credits taken back from the purchased lot. Becomes a REFUND entry. */
  reclaimed: bigint;
  /** Value refunded that no credit covered. Recorded on the order. */
  writtenOff: bigint;
}

/**
 * `requested` is an input, never a constant: a commercial policy of pro-rata
 * refunds changes the caller and not this rule.
 */
export function splitRefund(input: {
  remainingOnLot: bigint;
  requested: bigint;
}): RefundSplit {
  if (input.requested <= 0n) return { reclaimed: 0n, writtenOff: 0n };
  const reclaimed =
    input.requested < input.remainingOnLot
      ? input.requested
      : input.remainingOnLot;
  return {
    reclaimed: reclaimed < 0n ? 0n : reclaimed,
    writtenOff: input.requested - (reclaimed < 0n ? 0n : reclaimed),
  };
}
