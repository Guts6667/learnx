import { ENTRY_TIER_PACK_KEY } from '../maintenance/credit-pack-seed.js';
import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { CreditsCatalogueReader } from './credits-catalogue-reader.js';

export async function createPrismaCreditsCatalogueReader(): Promise<CreditsCatalogueReader> {
  const { prisma }: { prisma: PrismaClient } = await import('../prisma.js');

  return {
    async listActivePacks() {
      // Inactive packs are invisible *and* unbuyable (V4.5-161); this is the
      // invisible half. Filtering here rather than in the caller means a new
      // screen cannot forget to.
      return prisma.creditPack.findMany({
        orderBy: [{ position: 'asc' }, { key: 'asc' }],
        select: {
          credits: true,
          currency: true,
          key: true,
          label: true,
          labelEn: true,
          priceMinor: true,
        },
        where: { active: true },
      });
    },
    async purchasableByUser(input) {
      // The same predicate as the checkout's refusal — `fulfilledAt`, never
      // `status` — so the screen and the 409 cannot disagree. One place to
      // change if the answer on refunds moves.
      const fulfilled = await prisma.paymentOrder.findMany({
        distinct: ['packKey'],
        select: { packKey: true },
        where: {
          fulfilledAt: { not: null },
          packKey: { in: [...input.keys] },
          userId: input.userId,
        },
      });
      const bought = new Set(fulfilled.map((order) => order.packKey));
      return Object.fromEntries(
        input.keys.map((key) => [
          key,
          key === ENTRY_TIER_PACK_KEY ? !bought.has(key) : true,
        ]),
      );
    },
    async listOwnOrders(userId) {
      // Scoped by `userId` in the query, never filtered afterwards: a filter
      // applied after reading is one refactor away from being dropped.
      return prisma.paymentOrder.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          amountMinor: true,
          createdAt: true,
          currency: true,
          fulfilledAt: true,
          id: true,
          packKey: true,
          status: true,
        },
        where: { userId },
      });
    },
  };
}
