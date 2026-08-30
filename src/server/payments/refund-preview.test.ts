import { buildRefundPreview, type RefundPreviewSource } from './refund-preview';

const source: RefundPreviewSource = {
  amountMinor: 900n,
  createdAt: new Date('2026-08-29T10:00:00.000Z'),
  creditLotId: 'lot-1',
  currency: 'EUR',
  fulfilledAt: new Date('2026-08-29T10:00:05.000Z'),
  id: 'order-1',
  learner: {
    accountStatus: 'ACTIVE',
    displayName: 'Camille',
    email: 'camille@example.com',
    userId: 'user-1',
  },
  packCredits: 500n,
  packKey: 'starter-500',
  packPriceMinor: 900n,
  refundedCredits: 0n,
  remainingOnLot: 250n,
  status: 'FULFILLED',
  writtenOffCredits: 0n,
};

describe('buildRefundPreview', () => {
  it('calcule ce que le remboursement ferait, avec le solde à confirmer', () => {
    const preview = buildRefundPreview(source);

    expect(preview.refundable).toBe(true);
    expect(preview.refusal).toBeNull();
    expect(preview.computation).toEqual({
      // Half the pack remains, so half the price comes back.
      expectedRemainingOnLot: 250n,
      packCredits: 500n,
      packPriceMinor: 900n,
      projectedWriteOffCredits: 0n,
      reclaimedCredits: 250n,
      refundedMinor: 450n,
      remainingOnLot: 250n,
    });
  });

  it('n’absorbe jamais de valeur sur un remboursement volontaire', () => {
    // What is requested is what remains, so nothing can be written off. The
    // field exists for chargebacks, which do absorb.
    for (const remainingOnLot of [0n, 1n, 250n, 499n, 500n]) {
      const preview = buildRefundPreview({ ...source, remainingOnLot });

      expect(preview.computation?.projectedWriteOffCredits).toBe(0n);
    }
  });

  it('ne propose rien sur une commande déjà remboursée', () => {
    const preview = buildRefundPreview({
      ...source,
      refundedCredits: 250n,
      remainingOnLot: 0n,
      status: 'REFUNDED',
    });

    // Zeros here would be the very figure the V4.5-162B defect wrote: the
    // screen would offer "refund 0.00" as though it were an action.
    expect(preview.computation).toBeNull();
    expect(preview.refundable).toBe(false);
    expect(preview.refusal?.code).toBe('ALREADY_REFUNDED');
    // What was actually refunded stays readable.
    expect(preview.order.refundedCredits).toBe(250n);
  });

  it('distingue un litige perdu d’un remboursement', () => {
    const preview = buildRefundPreview({ ...source, status: 'DISPUTE_LOST' });

    expect(preview.refusal?.code).toBe('DISPUTE_LOST');
  });

  it('refuse pendant un litige et pendant un remboursement engagé', () => {
    expect(
      buildRefundPreview({ ...source, status: 'DISPUTED' }).refusal?.code,
    ).toBe('UNDER_DISPUTE');
    expect(
      buildRefundPreview({ ...source, status: 'REFUND_PENDING' }).refusal?.code,
    ).toBe('REFUND_PENDING');
  });

  it('autorise après un litige gagné', () => {
    // The bank sided with us; a commercial refund stays the administrator's
    // decision rather than something code takes away.
    const preview = buildRefundPreview({ ...source, status: 'DISPUTE_WON' });

    expect(preview.refundable).toBe(true);
  });

  it('refuse une commande jamais honorée', () => {
    const preview = buildRefundPreview({
      ...source,
      creditLotId: null,
      fulfilledAt: null,
      status: 'PAID',
    });

    expect(preview.refusal?.code).toBe('NOT_FULFILLED');
  });

  it('tait l’identité d’un compte effacé sans effacer la commande', () => {
    const preview = buildRefundPreview({
      ...source,
      learner: { ...source.learner, accountStatus: 'PSEUDONYMISED' },
    });

    // Null rather than an empty string or a placeholder: the books stay whole,
    // the identity does not come back through the administration screen.
    expect(preview.order.learner).toEqual({
      displayName: null,
      email: null,
      userId: 'user-1',
    });
    expect(preview.refundable).toBe(true);
  });
});
