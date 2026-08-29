import { startCheckout } from './checkout';

const PACK = {
  active: true,
  credits: 500n,
  currency: 'EUR',
  key: 'starter',
  label: 'Démarrage',
  priceMinor: 900n,
};

function build(options: { packs?: unknown[]; suspended?: boolean } = {}) {
  const created: unknown[] = [];
  const recorded: unknown[] = [];
  const ports = {
    correctionSuspended: vi.fn(async () => options.suspended ?? false),
    createProviderOrder: vi.fn(async (input: unknown) => {
      created.push(input);
      return {
        checkoutUrl: 'https://pay.example/ord_1',
        providerOrderId: 'ord_1',
      };
    }),
    listPacks: vi.fn(async () => options.packs ?? [PACK]),
    recordOrder: vi.fn(async (input: unknown) => {
      recorded.push(input);
      return { id: 'order-1' };
    }),
  };
  return { created, ports, recorded };
}

function run(
  harness: ReturnType<typeof build>,
  enabled = true,
  key = 'starter',
) {
  return startCheckout({
    enabled,
    packKey: key,
    ports: harness.ports as never,
    userId: 'user-1',
  });
}

describe('startCheckout', () => {
  it('ouvre un paiement pour un pack actif', async () => {
    const harness = build();
    await expect(run(harness)).resolves.toEqual({
      checkoutUrl: 'https://pay.example/ord_1',
      correctionSuspended: false,
      kind: 'STARTED',
      orderId: 'order-1',
      providerOrderId: 'ord_1',
    });
  });

  it('vend en le disant quand la correction est suspendue', async () => {
    // Not refused: purchased credits keep their value when the feature
    // returns. What would be wrong is selling while silent.
    const harness = build({ suspended: true });
    await expect(run(harness)).resolves.toMatchObject({
      correctionSuspended: true,
      kind: 'STARTED',
    });
  });

  it.each([
    ['inactif', [{ ...PACK, active: false }]],
    ['inexistant', []],
  ])('refuse un pack %s sans dire lequel', async (_label, packs) => {
    // Collapsed to one answer so a caller cannot enumerate which keys exist.
    const harness = build({ packs });
    await expect(run(harness)).resolves.toEqual({ kind: 'PACK_UNAVAILABLE' });
    expect(harness.created).toEqual([]);
    expect(harness.recorded).toEqual([]);
  });

  it('ne crée rien quand l’encaissement est coupé', async () => {
    const harness = build();
    await expect(run(harness, false)).resolves.toEqual({
      kind: 'PAYMENTS_DISABLED',
    });
    expect(harness.ports.listPacks).not.toHaveBeenCalled();
  });

  it('crée l’ordre fournisseur avant le nôtre', async () => {
    // The reverse would leave rows in our table referring to nothing when the
    // provider call fails.
    const harness = build();
    await run(harness);
    expect(harness.recorded[0]).toMatchObject({ providerOrderId: 'ord_1' });
  });
});
