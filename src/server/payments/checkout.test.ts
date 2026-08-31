import { startCheckout } from './checkout';

const PACK = {
  active: true,
  credits: 500n,
  currency: 'EUR',
  key: 'starter',
  label: 'Démarrage',
  priceMinor: 900n,
};

function build(
  options: {
    fulfilled?: boolean;
    packs?: unknown[];
    suspended?: boolean;
  } = {},
) {
  const created: unknown[] = [];
  const recorded: unknown[] = [];
  const ports = {
    correctionSuspended: vi.fn(async () => options.suspended ?? false),
    hasFulfilledPack: vi.fn(async () => options.fulfilled ?? false),
    createProviderOrder: vi.fn(async (input: unknown) => {
      created.push(input);
      return {
        checkoutUrl: 'https://pay.example/ord_1',
        providerOrderId: 'ord_1',
      };
    }),
    listPacks: vi.fn(async () => options.packs ?? [PACK]),
    newOrderId: vi.fn(() => 'order-1'),
    recordOrder: vi.fn(async (input: { id: string }) => {
      recorded.push(input);
      return { id: input.id };
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

describe('palier d’entrée, un achat par compte (V4.5-212)', () => {
  it('refuse un second achat du palier d’entrée', async () => {
    const harness = build({ fulfilled: true });

    await expect(
      startCheckout({
        enabled: true,
        entryTierPackKey: 'starter',
        packKey: 'starter',
        ports: harness.ports as never,
        userId: 'user-1',
      }),
    ).resolves.toEqual({ kind: 'ENTRY_TIER_ALREADY_PURCHASED' });
  });

  it('refuse avant d’appeler le fournisseur, jamais après', async () => {
    // Laisser Stripe ouvrir une session et encaisser, puis échouer de notre
    // côté, obligerait à rembourser pour appliquer une règle qui coûtait zéro
    // à appliquer — et un remboursement sur 3 € coûte plus en frais que
    // l'achat ne rapporte.
    const harness = build({ fulfilled: true });

    await startCheckout({
      enabled: true,
      entryTierPackKey: 'starter',
      packKey: 'starter',
      ports: harness.ports as never,
      userId: 'user-1',
    });

    expect(harness.ports.createProviderOrder).not.toHaveBeenCalled();
    expect(harness.ports.recordOrder).not.toHaveBeenCalled();
  });

  it('laisse acheter les autres paliers autant de fois qu’on veut', async () => {
    const harness = build({ fulfilled: true });

    const result = await startCheckout({
      enabled: true,
      entryTierPackKey: 'un-autre-palier',
      packKey: 'starter',
      ports: harness.ports as never,
      userId: 'user-1',
    });

    expect(result.kind).toBe('STARTED');
  });

  it('n’interroge rien quand aucun palier n’est limité', async () => {
    const harness = build();

    await startCheckout({
      enabled: true,
      packKey: 'starter',
      ports: harness.ports as never,
      userId: 'user-1',
    });

    expect(harness.ports.hasFulfilledPack).not.toHaveBeenCalled();
  });

  it('demande bien « déjà honoré », pas « honoré en ce moment »', async () => {
    // La distinction est toute la règle : un remboursement fait passer la
    // commande à REFUNDED sans toucher `fulfilledAt`, donc interroger le
    // statut rendrait le droit d'acheter au premier remboursement — et
    // rembourser-puis-racheter est exactement ce que la limite empêche.
    const harness = build({ fulfilled: false });

    await startCheckout({
      enabled: true,
      entryTierPackKey: 'starter',
      packKey: 'starter',
      ports: harness.ports as never,
      userId: 'user-1',
    });

    expect(harness.ports.hasFulfilledPack).toHaveBeenCalledWith({
      packKey: 'starter',
      userId: 'user-1',
    });
  });
});
