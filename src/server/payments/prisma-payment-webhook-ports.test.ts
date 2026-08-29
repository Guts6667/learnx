import { createPrismaPaymentWebhookPorts } from './prisma-payment-webhook-ports';

const ORDER_ID = 'b1a4c0d2-3f77-4c0e-9c6b-2f9a1d4e5b60';

const grant = vi.fn(async () => ({ lotId: 'lot-1' }));
const state = {
  order: {
    creditLotId: null as string | null,
    packKey: 'starter',
    userId: 'user-1',
  },
  updates: [] as Record<string, unknown>[],
};

vi.mock('../prisma.js', () => ({
  prisma: {
    creditPack: { findUniqueOrThrow: async () => ({ credits: 500n }) },
    paymentEvent: { create: async () => ({}) },
    paymentOrder: {
      findUnique: async () => ({ id: ORDER_ID, status: 'PENDING' }),
      findUniqueOrThrow: async () => state.order,
      update: async (input: { data: Record<string, unknown> }) => {
        state.updates.push(input.data);
        return {};
      },
    },
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
    state.updates = [];
  });

  it('crédite un lot ACHETÉ et honore la commande en un geste', async () => {
    const ports = await createPrismaPaymentWebhookPorts();
    await ports.applyTransition({
      attributeCredits: true,
      orderId: ORDER_ID,
      status: 'FULFILLED',
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
    await ports.applyTransition({
      attributeCredits: true,
      orderId: ORDER_ID,
      status: 'FULFILLED',
    });

    expect(grant).not.toHaveBeenCalled();
    expect(state.updates).toEqual([]);
  });

  it('n’appelle pas le registre sur une transition sans attribution', async () => {
    const ports = await createPrismaPaymentWebhookPorts();
    await ports.applyTransition({
      attributeCredits: false,
      orderId: ORDER_ID,
      status: 'PENDING',
    });

    expect(grant).not.toHaveBeenCalled();
    expect(state.updates[0]).toEqual({ status: 'PENDING' });
  });
});
