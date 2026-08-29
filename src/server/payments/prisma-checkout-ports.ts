import type { CheckoutPorts } from './checkout.js';

/**
 * The database and provider side of checkout.
 *
 * The provider adapter is a placeholder until the sandbox credentials exist
 * (ADR_004 §8.4): it throws rather than inventing a URL, because a checkout
 * that looked like it worked and led nowhere would be worse than one that
 * plainly refuses.
 */
export async function createPrismaCheckoutPorts(): Promise<CheckoutPorts> {
  const { prisma } = await import('../prisma.js');
  const { PrismaCorrectionBreaker } =
    await import('../corrections/correction-breaker.js');
  const breaker = new PrismaCorrectionBreaker(prisma);

  return {
    async correctionSuspended() {
      return (await breaker.status()).state === 'OPEN';
    },
    async createProviderOrder() {
      throw new Error('REVOLUT_ADAPTER_NOT_CONFIGURED');
    },
    async listPacks() {
      const packs = await prisma.creditPack.findMany({
        orderBy: { position: 'asc' },
        select: {
          active: true,
          credits: true,
          currency: true,
          key: true,
          label: true,
          priceMinor: true,
        },
      });
      return packs;
    },
    async recordOrder(input) {
      return prisma.paymentOrder.create({
        data: {
          amountMinor: input.amountMinor,
          currency: input.currency,
          packKey: input.packKey,
          providerOrderId: input.providerOrderId,
          status: 'PENDING',
          userId: input.userId,
        },
        select: { id: true },
      });
    },
  };
}
