import {
  decideTransition,
  paymentOrderRank,
  shouldAttributeCredits,
} from './payment-order-state';

describe('decideTransition', () => {
  it('avance sur une transition normale', () => {
    expect(decideTransition('PENDING', 'PAID')).toEqual({
      kind: 'APPLY',
      status: 'PAID',
    });
  });

  it('ne fait pas régresser une commande déjà attribuée', () => {
    // The processor delivers out of order; a late PAID after FULFILLED is expected,
    // not exceptional.
    expect(decideTransition('FULFILLED', 'PAID')).toEqual({
      kind: 'OUT_OF_ORDER',
    });
  });

  it('ignore un événement répété au même état', () => {
    expect(decideTransition('PAID', 'PAID')).toEqual({ kind: 'OUT_OF_ORDER' });
  });

  it('laisse un paiement réessayé atteindre PAID après un échec', () => {
    // FAILED ranks below PAID deliberately: a card declined then retried
    // successfully must still be able to pay.
    expect(decideTransition('FAILED', 'PAID')).toEqual({
      kind: 'APPLY',
      status: 'PAID',
    });
  });

  it('ne laisse pas un échec tardif défaire un paiement', () => {
    expect(decideTransition('PAID', 'FAILED')).toEqual({
      kind: 'OUT_OF_ORDER',
    });
  });

  it('classe le litige et le remboursement après l’attribution', () => {
    expect(paymentOrderRank('DISPUTED')).toBeGreaterThan(
      paymentOrderRank('FULFILLED'),
    );
    expect(decideTransition('FULFILLED', 'REFUND_PENDING')).toEqual({
      kind: 'APPLY',
      status: 'REFUND_PENDING',
    });
  });
});
describe('shouldAttributeCredits', () => {
  it('attribue une fois, à la première arrivée en PAID', () => {
    // PAID is the provider's last word. Waiting for a provider "fulfilled"
    // event would leave an order at PAID for ever: money taken, nothing given.
    expect(
      shouldAttributeCredits({ current: 'PENDING', incoming: 'PAID' }),
    ).toBe(true);
  });

  it('n’attribue pas une seconde fois sur un PAID rejoué', () => {
    // The unique event id already stops a replay from being processed twice;
    // this stops a distinct event from attributing twice.
    expect(shouldAttributeCredits({ current: 'PAID', incoming: 'PAID' })).toBe(
      false,
    );
  });

  it('n’attribue rien après que nous ayons déjà honoré', () => {
    expect(
      shouldAttributeCredits({ current: 'FULFILLED', incoming: 'PAID' }),
    ).toBe(false);
  });

  it('n’attribue rien sur un FULFILLED venu du fournisseur', () => {
    // FULFILLED is our own transition. If the processor ever emits something like
    // it, it arrives after we granted and must change nothing.
    expect(
      shouldAttributeCredits({ current: 'PAID', incoming: 'FULFILLED' }),
    ).toBe(false);
  });
});
