import type { CheckoutPorts } from './checkout.js';

/**
 * The database and provider side of checkout.
 *
 * The adapter refuses rather than inventing a URL when it is unconfigured: a
 * checkout that looked like it worked and led nowhere would be worse than one
 * that plainly refuses.
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
    async createProviderOrder(input) {
      const secretKey = process.env.STRIPE_TEST_SECRET_KEY?.trim();
      const appUrl = process.env.APP_URL?.trim();
      if (!secretKey || !appUrl) {
        throw new Error('STRIPE_CHECKOUT_NOT_CONFIGURED');
      }

      const { createStripeCheckoutSession } =
        await import('./stripe-checkout-session.js');

      return createStripeCheckoutSession({ ...input, appUrl, secretKey });
    },
    newOrderId() {
      return crypto.randomUUID();
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
          id: input.id,
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
