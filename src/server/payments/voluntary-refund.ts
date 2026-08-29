/**
 * Voluntary refunds (V4.5-162, owner decision `owner-refund-policy-2026-08-29`).
 *
 * A learner who asks for a refund is repaid for what they have not used:
 * price × unspent ÷ pack credits, rounded to the cent, half-up.
 *
 * The rounding rule is stated once, here and in ADR_004, because a rule that
 * is re-derived is a rule that eventually differs between two places.
 *
 * Under this policy a voluntary refund can never produce a write-off: the
 * credits reversed are exactly the unspent ones, so there is nothing consumed
 * left to absorb. `assertNoWriteOff` holds that as an invariant rather than an
 * expectation — if it ever fires, the money and the credits have disagreed.
 */

/** Half-up on integers: floor((2a + b) / 2b) with no floating point. */
function divideRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n);
}

export function voluntaryRefundMinor(input: {
  packCredits: bigint;
  packPriceMinor: bigint;
  unspentCredits: bigint;
}): bigint {
  if (input.packCredits <= 0n || input.unspentCredits <= 0n) return 0n;
  const unspent =
    input.unspentCredits > input.packCredits
      ? input.packCredits
      : input.unspentCredits;
  return divideRoundHalfUp(input.packPriceMinor * unspent, input.packCredits);
}

export class VoluntaryRefundInvariantError extends Error {
  public constructor(public readonly writtenOff: bigint) {
    super('VOLUNTARY_REFUND_WROTE_OFF');
    this.name = 'VoluntaryRefundInvariantError';
  }
}

/**
 * A voluntary refund reverses exactly the unspent credits, so a write-off means
 * the lot held less than we believed. That is a disagreement between the money
 * and the ledger, and it must stop rather than settle quietly on a number.
 */
export function assertNoWriteOff(writtenOff: bigint): void {
  if (writtenOff > 0n) throw new VoluntaryRefundInvariantError(writtenOff);
}
