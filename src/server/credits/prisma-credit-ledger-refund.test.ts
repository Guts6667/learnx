import { refundPurchasedCredits } from './prisma-credit-ledger-refund';

const ORDER_ID = 'b1a4c0d2-3f77-4c0e-9c6b-2f9a1d4e5b60';

function build(options: { existing?: unknown; lot?: unknown } = {}) {
  const created: Record<string, unknown>[] = [];
  const lotWheres: unknown[] = [];
  const transaction = {
    creditLedgerEntry: {
      create: vi.fn(async (input: { data: Record<string, unknown> }) => {
        created.push(input.data);
        return {};
      }),
      findFirst: vi.fn(async () => options.existing ?? null),
    },
    creditLot: {
      findFirst: vi.fn(async (input: { where: Record<string, unknown> }) => {
        lotWheres.push(input.where);
        return options.lot === undefined
          ? { accountId: 'account-1', id: 'lot-1' }
          : options.lot;
      }),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(transaction)),
  };
  return { created, lotWheres, prisma, transaction };
}

/**
 * Appelé avec le client de transaction directement (V4.5-211) : la fonction
 * n'ouvre plus la sienne, c'est l'appelant qui possède la transaction.
 */
function refund(client: unknown, amount = 250n) {
  return refundPurchasedCredits(client as never, {
    actorUserId: 'admin-1',
    amount,
    lotId: 'lot-1',
    orderId: ORDER_ID,
    reason: 'remboursement volontaire',
    userId: 'user-1',
  });
}

describe('refundPurchasedCredits', () => {
  it('écrit une écriture REFUND négative contre le lot acheté', async () => {
    const harness = build();
    await expect(refund(harness.transaction)).resolves.toMatchObject({
      entryId: expect.any(String),
    });
    expect(harness.created[0]).toMatchObject({
      amount: -250n,
      lotId: 'lot-1',
      operationKey: `refund:${ORDER_ID}`,
      referenceType: 'PAYMENT_ORDER',
      type: 'REFUND',
    });
  });

  it('n’écrit qu’une fois pour une même commande', async () => {
    // A redelivered dispute outcome, or an administrator clicking twice.
    const harness = build({ existing: { id: 'entry-1' } });
    await expect(refund(harness.transaction)).resolves.toEqual({
      entryId: 'entry-1',
    });
    expect(harness.created).toEqual([]);
  });

  it('ne cherche que parmi les lots achetés', async () => {
    // The provenance is part of the query, not a check after loading. Without
    // it a mis-referenced order would quietly reverse a free allocation, which
    // no refund ever pays back.
    const harness = build();
    await refund(harness.transaction);
    expect(harness.lotWheres).toEqual([
      { id: 'lot-1', provenance: 'PURCHASED' },
    ]);
  });

  it('refuse quand aucun lot acheté ne correspond', async () => {
    const harness = build({ lot: null });
    await expect(refund(harness.transaction)).resolves.toBeNull();
    expect(harness.created).toEqual([]);
  });

  it('ne fait rien pour un montant nul', async () => {
    const harness = build();
    await expect(refund(harness.transaction, 0n)).resolves.toBeNull();
    expect(harness.created).toEqual([]);
  });

  it('n’ouvre aucune transaction à lui', async () => {
    // V4.5-211 : c'est ce qui permet au webhook de rembourser dans la même
    // transaction que l'enregistrement de l'événement. Tant que cette fonction
    // en ouvrait une, l'entrée de grand livre était validée séparément, et un
    // échec ensuite laissait des crédits repris sur une commande honorée.
    const harness = build();

    await refund(harness.transaction);

    expect(harness.prisma.$transaction).not.toHaveBeenCalled();
    expect(harness.created).toHaveLength(1);
  });

  it('ne touche jamais l’attribution qu’il compense', async () => {
    // Append-only: the GRANT stays exactly as written, which is what keeps the
    // history readable when what happened was a mistake.
    const harness = build();
    await refund(harness.transaction);
    expect(harness.created).toHaveLength(1);
    expect(harness.created[0]?.type).toBe('REFUND');
  });
});
