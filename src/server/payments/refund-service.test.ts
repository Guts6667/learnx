import { refundOrder } from './refund-service';

const ORDER_ID = 'b1a4c0d2-3f77-4c0e-9c6b-2f9a1d4e5b60';
const ACTOR = '11111111-1111-4111-8111-111111111111';

function build(order: unknown) {
  const applied: Record<string, unknown>[] = [];
  const ports = {
    applyRefund: vi.fn(async (input: Record<string, unknown>) => {
      applied.push(input);
      return true;
    }),
    loadOrder: vi.fn(async () => order),
  };
  return { applied, ports };
}

const fulfilled = {
  creditLotId: 'lot-1',
  packCredits: 500n,
  packPriceMinor: 900n,
  remainingOnLot: 500n,
  status: 'FULFILLED',
  userId: 'user-1',
};

function refund(
  harness: ReturnType<typeof build>,
  overrides: Record<string, unknown> = {},
) {
  return refundOrder({
    actorUserId: ACTOR,
    kind: 'VOLUNTARY',
    orderId: ORDER_ID,
    ports: harness.ports as never,
    ...overrides,
  });
}

describe('remboursement volontaire', () => {
  it('reprend les crédits non consommés et rembourse au prorata', () => {
    const harness = build({ ...fulfilled, remainingOnLot: 250n });
    return expect(refund(harness)).resolves.toEqual({
      kind: 'REFUNDED',
      reclaimed: 250n,
      refundedMinor: 450n,
      writtenOff: 0n,
    });
  });

  it('ne produit jamais de perte, quel que soit le lot', async () => {
    // Unreachable by construction rather than merely unobserved: for a
    // voluntary refund the amount requested *is* the remaining amount, so the
    // two can never differ. The guard in the service is kept for the day a
    // refactor separates them, and it is exercised directly in
    // voluntary-refund.test.ts because no input here can reach it.
    for (const remainingOnLot of [500n, 250n, 1n, 0n]) {
      const harness = build({ ...fulfilled, remainingOnLot });
      await expect(refund(harness)).resolves.toMatchObject({
        writtenOff: 0n,
      });
    }
  });

  it('ne compense rien sur une commande jamais honorée', async () => {
    // Refusing here keeps a refund from inventing a reversal for credits never
    // given.
    const harness = build({ ...fulfilled, creditLotId: null });
    await expect(refund(harness)).resolves.toEqual({
      kind: 'REFUSED',
      reason: 'NOT_FULFILLED',
    });
    expect(harness.applied).toEqual([]);
  });

  it('répond introuvable sur une commande inconnue', async () => {
    const harness = build(null);
    await expect(refund(harness)).resolves.toEqual({
      kind: 'ORDER_NOT_FOUND',
    });
  });
});

describe('litige perdu', () => {
  it('reprend ce qui reste et absorbe le consommé', async () => {
    const harness = build({ ...fulfilled, remainingOnLot: 200n });
    await expect(
      refund(harness, { disputeCredits: 500n, kind: 'DISPUTE_LOST' }),
    ).resolves.toEqual({
      kind: 'REFUNDED',
      reclaimed: 200n,
      // The bank decided the money; we record only what we reclaimed and
      // absorbed, never a figure we chose.
      refundedMinor: 0n,
      writtenOff: 300n,
    });
  });

  it('n’applique pas l’invariant de perte nulle à un litige', async () => {
    // A chargeback after the credits were spent is exactly the case where a
    // write-off is correct.
    const harness = build({ ...fulfilled, remainingOnLot: 0n });
    await expect(
      refund(harness, { disputeCredits: 500n, kind: 'DISPUTE_LOST' }),
    ).resolves.toMatchObject({ reclaimed: 0n, writtenOff: 500n });
  });

  it('transmet l’acteur et la note à l’écriture', async () => {
    const harness = build(fulfilled);
    await refund(harness, {
      kind: 'DISPUTE_LOST',
      note: 'litige perdu, dossier 42',
    });
    expect(harness.applied[0]).toMatchObject({
      actorUserId: ACTOR,
      note: 'litige perdu, dossier 42',
    });
  });
});

describe('remboursement déjà réglé (V4.5-162B)', () => {
  it('refuse un second remboursement plutôt que d’écraser les chiffres du premier', async () => {
    // The state after a first voluntary refund: the lot is empty, so a second
    // pass would compute reclaimed 0, writtenOff 0 and refundedMinor 0 — and
    // write those zeroes over what the first refund recorded. The ledger would
    // still be right; the order would deny the refund ever happened.
    const { applied, ports } = build({
      ...fulfilled,
      remainingOnLot: 0n,
      status: 'REFUNDED',
    });

    const result = await refundOrder({
      actorUserId: 'admin-1',
      kind: 'VOLUNTARY',
      orderId: 'order-1',
      ports: ports as never,
    });

    expect(result).toEqual({ kind: 'REFUSED', reason: 'ALREADY_REFUNDED' });
    expect(applied).toEqual([]);
  });

  it('refuse aussi après un litige perdu', async () => {
    const { applied, ports } = build({
      ...fulfilled,
      remainingOnLot: 0n,
      status: 'DISPUTE_LOST',
    });

    const result = await refundOrder({
      actorUserId: 'admin-1',
      kind: 'VOLUNTARY',
      orderId: 'order-1',
      ports: ports as never,
    });

    // A distinct fact from "already refunded", with the same effect: the
    // screen should say the bank took the money back, not that we refunded it.
    expect(result).toEqual({ kind: 'REFUSED', reason: 'DISPUTE_LOST' });
    expect(applied).toEqual([]);
  });

  it('refuse quand un autre administrateur a réglé la commande entre-temps', async () => {
    // The status check is a read that happened earlier. Two administrators
    // clicking together both pass it, so the write is what must refuse — the
    // port reports that it matched no row.
    const { ports } = build(fulfilled);
    ports.applyRefund = vi.fn(async () => false);

    const result = await refundOrder({
      actorUserId: 'admin-2',
      kind: 'VOLUNTARY',
      orderId: 'order-1',
      ports: ports as never,
    });

    // Reporting REFUNDED here would tell the second administrator that a
    // second refund had been made, and show them a figure to match.
    expect(result).toEqual({ kind: 'REFUSED', reason: 'ALREADY_REFUNDED' });
  });

  it('rembourse normalement une commande honorée non réglée', async () => {
    const { applied, ports } = build(fulfilled);

    const result = await refundOrder({
      actorUserId: 'admin-1',
      kind: 'VOLUNTARY',
      orderId: 'order-1',
      ports: ports as never,
    });

    // The guard must not have closed the ordinary path.
    expect(result.kind).toBe('REFUNDED');
    expect(applied).toHaveLength(1);
  });
});

describe('états de litige et fraîcheur de la prévisualisation (V4.5-162B)', () => {
  it('refuse pendant un litige en cours', async () => {
    const { applied, ports } = build({ ...fulfilled, status: 'DISPUTED' });

    const result = await refundOrder({
      actorUserId: 'admin-1',
      kind: 'VOLUNTARY',
      orderId: 'order-1',
      ports: ports as never,
    });

    // Refunding while the bank is still deciding risks paying twice for the
    // same purchase.
    expect(result).toEqual({ kind: 'REFUSED', reason: 'UNDER_DISPUTE' });
    expect(applied).toEqual([]);
  });

  it('refuse pendant un remboursement déjà engagé', async () => {
    const { applied, ports } = build({
      ...fulfilled,
      status: 'REFUND_PENDING',
    });

    const result = await refundOrder({
      actorUserId: 'admin-1',
      kind: 'VOLUNTARY',
      orderId: 'order-1',
      ports: ports as never,
    });

    expect(result).toEqual({ kind: 'REFUSED', reason: 'REFUND_PENDING' });
    expect(applied).toEqual([]);
  });

  it('autorise après un litige gagné', async () => {
    const { applied, ports } = build({ ...fulfilled, status: 'DISPUTE_WON' });

    const result = await refundOrder({
      actorUserId: 'admin-1',
      kind: 'VOLUNTARY',
      orderId: 'order-1',
      ports: ports as never,
    });

    // The bank sided with us, so the money is ours and a commercial refund
    // stays the administrator's decision. Refusing here would take that
    // decision away in code.
    expect(result.kind).toBe('REFUNDED');
    expect(applied).toHaveLength(1);
  });

  it('refuse quand le solde a bougé depuis la prévisualisation', async () => {
    const { applied, ports } = build({ ...fulfilled, remainingOnLot: 200n });

    const result = await refundOrder({
      actorUserId: 'admin-1',
      expectedRemainingOnLot: 250n,
      kind: 'VOLUNTARY',
      orderId: 'order-1',
      ports: ports as never,
    });

    // The learner spent credits while the administrator was reading. Going
    // ahead would refund an amount nobody approved.
    expect(result).toEqual({ kind: 'PREVIEW_STALE', remainingOnLot: 200n });
    expect(applied).toEqual([]);
  });

  it('rembourse quand le solde annoncé est encore exact', async () => {
    const { applied, ports } = build({ ...fulfilled, remainingOnLot: 250n });

    const result = await refundOrder({
      actorUserId: 'admin-1',
      expectedRemainingOnLot: 250n,
      kind: 'VOLUNTARY',
      orderId: 'order-1',
      ports: ports as never,
    });

    expect(result.kind).toBe('REFUNDED');
    expect(applied).toHaveLength(1);
  });

  it('reste utilisable sans solde annoncé, pour un règlement de litige', async () => {
    const { applied, ports } = build({ ...fulfilled, remainingOnLot: 250n });

    const result = await refundOrder({
      actorUserId: 'admin-1',
      disputeCredits: 500n,
      kind: 'DISPUTE_LOST',
      orderId: 'order-1',
      ports: ports as never,
    });

    // A dispute settlement has no preview and no human choosing an amount.
    expect(result.kind).toBe('REFUNDED');
    expect(applied).toHaveLength(1);
  });
});
