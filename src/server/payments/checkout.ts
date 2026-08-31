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
  /**
   * The entry tier is one per account (V4.5-212). Named rather than collapsed
   * into PACK_UNAVAILABLE: the learner did nothing wrong and the screen has
   * something true to tell them, unlike a key that does not exist.
   */
  | { kind: 'ENTRY_TIER_ALREADY_PURCHASED' }
  /** Unknown and inactive collapse here: a caller must not enumerate keys. */
  | { kind: 'PACK_UNAVAILABLE' }
  | { kind: 'PAYMENTS_DISABLED' };

export interface CheckoutPorts {
  correctionSuspended(): Promise<boolean>;
  createProviderOrder(input: {
    amountMinor: bigint;
    currency: string;
    /** Ours, chosen before the call so the session can carry it. */
    orderId: string;
    packLabel: string;
  }): Promise<{ checkoutUrl: string; providerOrderId: string }>;
  /**
   * Whether this account has ever had this pack fulfilled (V4.5-212).
   *
   * *Ever*, deliberately: the question is `fulfilledAt IS NOT NULL`, never
   * `status = 'FULFILLED'`. A refund moves the status to REFUNDED and leaves
   * `fulfilledAt` untouched, so asking about the status would hand the right
   * back the moment someone refunded — and refund-then-rebuy is precisely the
   * pattern the limit exists to stop, since the fixed provider fee is paid
   * again each time.
   */
  hasFulfilledPack(input: {
    packKey: string;
    userId: string;
  }): Promise<boolean>;
  /** Injected rather than called inline so a test can pin the id. */
  newOrderId(): string;
  listPacks(): Promise<CreditPack[]>;
  recordOrder(input: {
    amountMinor: bigint;
    currency: string;
    id: string;
    packKey: string;
    providerOrderId: string;
    userId: string;
  }): Promise<{ id: string }>;
}

export async function startCheckout(input: {
  enabled: boolean;
  /** The key limited to one purchase per account, or null to limit none. */
  entryTierPackKey?: string | null;
  packKey: string;
  ports: CheckoutPorts;
  userId: string;
}): Promise<CheckoutResult> {
  if (!input.enabled) return { kind: 'PAYMENTS_DISABLED' };

  const selection = selectPack(await input.ports.listPacks(), input.packKey);
  if (selection.kind !== 'SELECTED') return { kind: 'PACK_UNAVAILABLE' };
  const { pack } = selection;

  // Refused before the provider is called, not after. Letting Stripe open a
  // session and take the money, then failing on our side, would mean refunding
  // to enforce a rule we could have applied for free — and a refund on a 3 €
  // purchase costs more in fees than the purchase earns.
  if (
    input.entryTierPackKey &&
    pack.key === input.entryTierPackKey &&
    (await input.ports.hasFulfilledPack({
      packKey: pack.key,
      userId: input.userId,
    }))
  ) {
    return { kind: 'ENTRY_TIER_ALREADY_PURCHASED' };
  }

  // The id is ours and is chosen first, so the Checkout Session can carry it
  // as `client_reference_id`. Letting the database mint it would mean the
  // session had to be created before the row existed, and then the row could
  // not be named in the session at all.
  //
  // The provider order is still created before ours is recorded, so an order
  // in our table always has a counterpart to reconcile against. The reverse
  // would leave rows referring to nothing if the provider call failed.
  const orderId = input.ports.newOrderId();
  const provider = await input.ports.createProviderOrder({
    amountMinor: pack.priceMinor,
    currency: pack.currency,
    orderId,
    packLabel: pack.label,
  });
  const order = await input.ports.recordOrder({
    amountMinor: pack.priceMinor,
    currency: pack.currency,
    id: orderId,
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
