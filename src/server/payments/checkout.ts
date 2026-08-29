import { selectPack, type CreditPack } from './credit-pack-catalogue.js';

/**
 * Starting a purchase (V4.5-161).
 *
 * The response carries the correction suspension when there is one, in the
 * same words the interface shows. The endpoint does not refuse: purchased
 * credits keep their value when the feature returns, unlike a trial cycle that
 * expires. What would be wrong is selling while silent — so the API says it
 * too, rather than relying on a screen to say it for us.
 */

export type CheckoutResult =
  | {
      kind: 'STARTED';
      checkoutUrl: string;
      correctionSuspended: boolean;
      orderId: string;
      providerOrderId: string;
    }
  /** Unknown and inactive collapse here: a caller must not enumerate keys. */
  | { kind: 'PACK_UNAVAILABLE' }
  | { kind: 'PAYMENTS_DISABLED' };

export interface CheckoutPorts {
  correctionSuspended(): Promise<boolean>;
  createProviderOrder(input: {
    amountMinor: bigint;
    currency: string;
    reference: string;
  }): Promise<{ checkoutUrl: string; providerOrderId: string }>;
  listPacks(): Promise<CreditPack[]>;
  recordOrder(input: {
    amountMinor: bigint;
    currency: string;
    packKey: string;
    providerOrderId: string;
    userId: string;
  }): Promise<{ id: string }>;
}

export async function startCheckout(input: {
  enabled: boolean;
  packKey: string;
  ports: CheckoutPorts;
  userId: string;
}): Promise<CheckoutResult> {
  if (!input.enabled) return { kind: 'PAYMENTS_DISABLED' };

  const selection = selectPack(await input.ports.listPacks(), input.packKey);
  if (selection.kind !== 'SELECTED') return { kind: 'PACK_UNAVAILABLE' };
  const { pack } = selection;

  // The provider order is created before ours is recorded, so an order in our
  // table always has a counterpart to reconcile against. The reverse would
  // leave rows referring to nothing if the provider call failed.
  const provider = await input.ports.createProviderOrder({
    amountMinor: pack.priceMinor,
    currency: pack.currency,
    reference: `${input.userId}:${pack.key}`,
  });
  const order = await input.ports.recordOrder({
    amountMinor: pack.priceMinor,
    currency: pack.currency,
    packKey: pack.key,
    providerOrderId: provider.providerOrderId,
    userId: input.userId,
  });

  return {
    checkoutUrl: provider.checkoutUrl,
    correctionSuspended: await input.ports.correctionSuspended(),
    kind: 'STARTED',
    orderId: order.id,
    providerOrderId: provider.providerOrderId,
  };
}
