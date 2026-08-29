import {
  VoluntaryRefundInvariantError,
  assertNoWriteOff,
  voluntaryRefundMinor,
} from './voluntary-refund';

describe('voluntaryRefundMinor', () => {
  it('rembourse tout un pack intact', () => {
    expect(
      voluntaryRefundMinor({
        packCredits: 500n,
        packPriceMinor: 900n,
        unspentCredits: 500n,
      }),
    ).toBe(900n);
  });

  it('rembourse la part non consommée', () => {
    expect(
      voluntaryRefundMinor({
        packCredits: 500n,
        packPriceMinor: 900n,
        unspentCredits: 250n,
      }),
    ).toBe(450n);
  });

  it('arrondit au centime, moitié vers le haut', () => {
    // 900 × 1 ÷ 8 = 112.5 → 113. Stated once here and in ADR_004: a rule that
    // is re-derived is a rule that eventually differs between two places.
    expect(
      voluntaryRefundMinor({
        packCredits: 8n,
        packPriceMinor: 900n,
        unspentCredits: 1n,
      }),
    ).toBe(113n);
  });

  it('arrondit vers le bas sous la moitié', () => {
    // 900 × 1 ÷ 9 = 100 exactly; 900 × 1 ÷ 24 = 37.5 → 38, and 900 ÷ 25 = 36.
    expect(
      voluntaryRefundMinor({
        packCredits: 24n,
        packPriceMinor: 900n,
        unspentCredits: 1n,
      }),
    ).toBe(38n);
    expect(
      voluntaryRefundMinor({
        packCredits: 100n,
        packPriceMinor: 900n,
        unspentCredits: 1n,
      }),
    ).toBe(9n);
  });

  it('ne rembourse rien sans crédit restant', () => {
    expect(
      voluntaryRefundMinor({
        packCredits: 500n,
        packPriceMinor: 900n,
        unspentCredits: 0n,
      }),
    ).toBe(0n);
  });

  it('ne rembourse jamais plus que le prix payé', () => {
    // A lot that somehow holds more than the pack sold must not refund more
    // than the learner paid.
    expect(
      voluntaryRefundMinor({
        packCredits: 500n,
        packPriceMinor: 900n,
        unspentCredits: 900n,
      }),
    ).toBe(900n);
  });
});

describe('assertNoWriteOff', () => {
  it('passe quand rien n’est absorbé', () => {
    expect(() => assertNoWriteOff(0n)).not.toThrow();
  });

  it('refuse une perte sur un remboursement volontaire', () => {
    // Under this policy the credits reversed are exactly the unspent ones. A
    // write-off means the lot held less than we believed — money and ledger
    // disagreeing, which must stop rather than settle quietly on a number.
    expect(() => assertNoWriteOff(1n)).toThrow(VoluntaryRefundInvariantError);
  });
});
