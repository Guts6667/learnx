import { createPrismaPaymentWebhookPorts } from './prisma-payment-webhook-ports';

const ORDER_ID = 'b1a4c0d2-3f77-4c0e-9c6b-2f9a1d4e5b60';

const SESSION_ID = 'cs_test_a1b2c3';
const INTENT_ID = 'pi_test_a1b2c3';

const grant = vi.fn(async () => ({ lotId: 'lot-1' }));
const state = {
  order: {
    creditLotId: null as string | null,
    packKey: 'starter',
    userId: 'user-1',
  },
  /**
   * Every `where` the port asked with, in order. Until V4.5-202 this harness
   * answered any question with the same order, so a lookup on the wrong column
   * was indistinguishable from a lookup on the right one — which is how a bug
   * that made every purchase unfulfillable passed a full suite.
   */
  eventInsertFails: false,
  events: 0,
  queries: [] as Record<string, unknown>[],
  transitionFails: false,
  /** What the database holds; anything else resolves to nothing. */
  stored: {} as Record<string, unknown>,
  updates: [] as Record<string, unknown>[],
};

const CANONICAL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function lookup(where: Record<string, unknown>) {
  state.queries.push(where);
  const [[column, value]] = Object.entries(where);
  // `id` is a Postgres `uuid` column: a malformed value is a driver error
  // (P2023), never a miss. Modelled here so a test of the guard cannot pass
  // without the guard.
  if (column === 'id' && !CANONICAL_UUID.test(String(value))) {
    throw new Error('P2023: Inconsistent column data: Error creating UUID');
  }
  return state.stored[column] === value
    ? { id: ORDER_ID, status: 'PENDING' as const }
    : null;
}

const models = {
  creditPack: { findUniqueOrThrow: async () => ({ credits: 500n }) },
  paymentEvent: {
    create: async () => {
      state.events += 1;
      if (state.eventInsertFails) throw new Error('unique violation');
      return {};
    },
  },
  paymentOrder: {
    findUnique: async (input: { where: Record<string, unknown> }) =>
      lookup(input.where),
    findUniqueOrThrow: async () => state.order,
    update: async (input: { data: Record<string, unknown> }) => {
      if (state.transitionFails) throw new Error('transition failed');
      state.updates.push(input.data);
      return {};
    },
  },
};

vi.mock('../prisma.js', () => ({
  prisma: {
    ...models,
    // Runs the callback on the same models, and lets a thrown error out, which
    // is the whole property V4.5-199 relies on.
    $transaction: async <T>(
      run: (client: typeof models) => Promise<T>,
    ): Promise<T> => run(models),
  },
}));

vi.mock('../credits/prisma-credit-ledger.js', () => ({
  PrismaCreditLedger: class {
    grant = grant;
  },
}));

describe('attribution des crédits achetés', () => {
  beforeEach(() => {
    grant.mockClear();
    state.order.creditLotId = null;
    state.eventInsertFails = false;
    state.events = 0;
    state.queries = [];
    state.transitionFails = false;
    state.updates = [];
    state.stored = { id: ORDER_ID };
  });

  it('crédite un lot ACHETÉ et honore la commande en un geste', async () => {
    const ports = await createPrismaPaymentWebhookPorts();
    await ports.recordDelivery({
      eventType: 'checkout.session.completed',
      orderId: ORDER_ID,
      outcome: 'APPLIED',
      payload: {},
      providerEventId: `evt_${state.events}`,
      transition: {
        attributeCredits: true,
        orderId: ORDER_ID,
        paymentIntentId: null,
        status: 'FULFILLED',
      },
    });

    expect(grant).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 500n,
        // Derived from the order, so a redelivery computes the same key and
        // the ledger returns the original lot instead of creating a second.
        idempotencyKey: `purchase:${ORDER_ID}`,
        provenance: 'PURCHASED',
      }),
    );
    expect(state.updates[0]).toMatchObject({
      creditLotId: 'lot-1',
      status: 'FULFILLED',
    });
  });

  it('ne crédite pas deux fois une commande déjà honorée', async () => {
    // First of two guards: the lot id on the order. The ledger's own
    // idempotency is the second, and neither alone would hold under a
    // concurrent redelivery.
    state.order.creditLotId = 'lot-1';
    const ports = await createPrismaPaymentWebhookPorts();
    await ports.recordDelivery({
      eventType: 'checkout.session.completed',
      orderId: ORDER_ID,
      outcome: 'APPLIED',
      payload: {},
      providerEventId: `evt_${state.events}`,
      transition: {
        attributeCredits: true,
        orderId: ORDER_ID,
        paymentIntentId: null,
        status: 'FULFILLED',
      },
    });

    expect(grant).not.toHaveBeenCalled();
    expect(state.updates).toEqual([]);
  });

  it('n’appelle pas le registre sur une transition sans attribution', async () => {
    const ports = await createPrismaPaymentWebhookPorts();
    await ports.recordDelivery({
      eventType: 'checkout.session.completed',
      orderId: ORDER_ID,
      outcome: 'APPLIED',
      payload: {},
      providerEventId: `evt_${state.events}`,
      transition: {
        attributeCredits: false,
        orderId: ORDER_ID,
        paymentIntentId: null,
        status: 'PENDING',
      },
    });

    expect(grant).not.toHaveBeenCalled();
    expect(state.updates[0]).toEqual({ status: 'PENDING' });
  });
});

describe('résolution de la commande derrière un événement', () => {
  beforeEach(() => {
    state.queries = [];
    state.stored = {};
  });

  it('résout un achat réel par notre propre identifiant', async () => {
    // The case V4.5-202 fixes, and the shape Rayan's purchase produced on
    // 30 August: `client_reference_id` is the PaymentOrder id we put on the
    // session, `id` is Stripe's session id. Before the fix our id was looked
    // up as `providerOrderId`, matched nothing, and the order stayed PENDING
    // with the money taken.
    state.stored = { id: ORDER_ID, providerOrderId: SESSION_ID };
    const ports = await createPrismaPaymentWebhookPorts();

    await expect(
      ports.findOrder({
        orderId: ORDER_ID,
        paymentIntentId: null,
        providerOrderId: SESSION_ID,
      }),
    ).resolves.toEqual({ id: ORDER_ID, status: 'PENDING' });
  });

  it('préfère l’intention de paiement, seule poignée de tout le cycle', async () => {
    // A refund or a dispute carries nothing else.
    state.stored = { providerPaymentIntentId: INTENT_ID };
    const ports = await createPrismaPaymentWebhookPorts();

    await expect(
      ports.findOrder({
        orderId: ORDER_ID,
        paymentIntentId: INTENT_ID,
        providerOrderId: SESSION_ID,
      }),
    ).resolves.toEqual({ id: ORDER_ID, status: 'PENDING' });
    expect(state.queries).toEqual([{ providerPaymentIntentId: INTENT_ID }]);
  });

  it('retombe sur l’identifiant de session quand le nôtre ne dit rien', async () => {
    state.stored = { providerOrderId: SESSION_ID };
    const ports = await createPrismaPaymentWebhookPorts();

    await expect(
      ports.findOrder({
        orderId: ORDER_ID,
        paymentIntentId: INTENT_ID,
        providerOrderId: SESSION_ID,
      }),
    ).resolves.toEqual({ id: ORDER_ID, status: 'PENDING' });
    // Tried in the documented order, and stopped at the first that answered.
    expect(state.queries).toEqual([
      { providerPaymentIntentId: INTENT_ID },
      { id: ORDER_ID },
      { providerOrderId: SESSION_ID },
    ]);
  });

  it('ne rattache rien quand aucune poignée ne correspond', async () => {
    // An event from another environment must not land on somebody's order.
    const ports = await createPrismaPaymentWebhookPorts();

    await expect(
      ports.findOrder({
        orderId: 'not-ours',
        paymentIntentId: 'pi_other',
        providerOrderId: 'cs_other',
      }),
    ).resolves.toBeNull();
  });

  it('n’interroge rien quand l’événement ne porte aucune poignée', async () => {
    const ports = await createPrismaPaymentWebhookPorts();

    await expect(
      ports.findOrder({
        orderId: null,
        paymentIntentId: null,
        providerOrderId: null,
      }),
    ).resolves.toBeNull();
    expect(state.queries).toEqual([]);
  });
});

describe('une référence qui n’est pas la nôtre', () => {
  beforeEach(() => {
    state.queries = [];
    state.stored = {};
  });

  it('ne cherche pas par identifiant quand la référence n’est pas un UUID', async () => {
    // Any signed session we did not create carries whatever reference its
    // author chose. `PaymentOrder.id` is a `uuid` column, so asking it for
    // `order-42` raises P2023 — and `findOrder` runs before `recordEvent`, so
    // it would be a 500 with no trace of the delivery at all.
    state.stored = { providerOrderId: SESSION_ID };
    const ports = await createPrismaPaymentWebhookPorts();

    await expect(
      ports.findOrder({
        orderId: 'order-42',
        paymentIntentId: null,
        providerOrderId: SESSION_ID,
      }),
    ).resolves.toEqual({ id: ORDER_ID, status: 'PENDING' });
    // The point is not that it survived: it is that the question was never
    // asked. It falls through to the session id, which is a plain miss.
    expect(state.queries).toEqual([{ providerOrderId: SESSION_ID }]);
  });

  it('ne rattache rien quand la référence est illisible et la session inconnue', async () => {
    const ports = await createPrismaPaymentWebhookPorts();

    await expect(
      ports.findOrder({
        orderId: 'order-42',
        paymentIntentId: null,
        providerOrderId: 'cs_other',
      }),
    ).resolves.toBeNull();
  });
});

describe('un seul acte : enregistrer et appliquer (V4.5-199)', () => {
  beforeEach(() => {
    state.eventInsertFails = false;
    state.events = 0;
    state.transitionFails = false;
    state.updates = [];
    state.stored = { id: ORDER_ID };
  });

  it('ne laisse aucune trace de l’événement quand la transition échoue', async () => {
    // The defect this closes: the insert committed, the transition threw, and
    // Stripe's retry was refused as a duplicate by the very uniqueness that
    // makes a replay harmless. The order stayed paid and uncredited, with
    // nothing failing loudly. Now the throw takes the row with it.
    state.transitionFails = true;
    const ports = await createPrismaPaymentWebhookPorts();

    await expect(
      ports.recordDelivery({
        eventType: 'checkout.session.completed',
        orderId: ORDER_ID,
        outcome: 'APPLIED',
        payload: {},
        providerEventId: 'evt_fail',
        transition: {
          attributeCredits: false,
          orderId: ORDER_ID,
          paymentIntentId: null,
          status: 'PAID',
        },
      }),
    ).rejects.toThrow('transition failed');
    // Nothing was applied, and the caller is not told the delivery was stored.
    expect(state.updates).toEqual([]);
  });

  it('enregistre sans rien appliquer quand il n’y a pas de transition', async () => {
    // An event we act on in no way still has to leave a record: that is what
    // reconciliation reads.
    const ports = await createPrismaPaymentWebhookPorts();

    await expect(
      ports.recordDelivery({
        eventType: 'invoice.upcoming',
        orderId: null,
        outcome: 'UNKNOWN_EVENT',
        payload: {},
        providerEventId: 'evt_none',
      }),
    ).resolves.toBe(true);
    expect(state.events).toBe(1);
    expect(state.updates).toEqual([]);
  });

  it('applique la transition dans la même transaction que l’insertion', async () => {
    const ports = await createPrismaPaymentWebhookPorts();

    await ports.recordDelivery({
      eventType: 'checkout.session.completed',
      orderId: ORDER_ID,
      outcome: 'APPLIED',
      payload: {},
      providerEventId: 'evt_ok',
      transition: {
        attributeCredits: false,
        orderId: ORDER_ID,
        paymentIntentId: 'pi_1',
        status: 'PAID',
      },
    });

    expect(state.events).toBe(1);
    expect(state.updates[0]).toMatchObject({
      providerPaymentIntentId: 'pi_1',
      status: 'PAID',
    });
  });
});
