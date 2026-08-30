import { createPrismaRefundPorts } from './prisma-refund-ports';

const updateMany = vi.fn();
const findUniqueOrThrow = vi.fn(async () => ({ creditLotId: null }));

vi.mock('../prisma.js', () => ({
  prisma: {
    $transaction: async (run: (tx: unknown) => unknown) =>
      run({
        auditEvent: { upsert: vi.fn(async () => ({})) },
        paymentOrder: { updateMany },
      }),
    paymentOrder: { findUniqueOrThrow },
  },
}));

const input = {
  actorUserId: 'admin-1',
  kind: 'VOLUNTARY' as const,
  orderId: 'order-1',
  reclaimed: 0n,
  refundedMinor: 0n,
  userId: 'user-1',
  writtenOff: 0n,
};

describe('applyRefund — écriture conditionnelle (V4.5-162B)', () => {
  beforeEach(() => {
    updateMany.mockReset();
  });

  it('ne met à jour que si la commande n’est pas déjà réglée', async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const ports = await createPrismaRefundPorts();

    await ports.applyRefund(input);

    // Asserted on the clause itself, not on the outcome: a mock that ignores
    // `where` would return count 1 whatever we passed, so only reading the
    // filter proves the guard is really in the query.
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'order-1',
          status: { notIn: ['REFUNDED', 'DISPUTE_LOST'] },
        },
      }),
    );
  });

  it('rend faux quand la commande a été réglée entre-temps', async () => {
    // No row matched: another administrator settled it after our status read.
    updateMany.mockResolvedValue({ count: 0 });
    const ports = await createPrismaRefundPorts();

    await expect(ports.applyRefund(input)).resolves.toBe(false);
  });

  it('rend vrai quand l’écriture a porté', async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const ports = await createPrismaRefundPorts();

    await expect(ports.applyRefund(input)).resolves.toBe(true);
  });
});
