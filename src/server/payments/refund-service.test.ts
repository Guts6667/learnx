import { refundOrder } from './refund-service';

const ORDER_ID = 'b1a4c0d2-3f77-4c0e-9c6b-2f9a1d4e5b60';
const ACTOR = '11111111-1111-4111-8111-111111111111';

function build(order: unknown) {
  const applied: Record<string, unknown>[] = [];
  const ports = {
    applyRefund: vi.fn(async (input: Record<string, unknown>) => {
      applied.push(input);
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
    await expect(refund(harness)).resolves.toEqual({ kind: 'NOT_FULFILLED' });
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
