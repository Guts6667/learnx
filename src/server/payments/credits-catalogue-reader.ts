import type { PaymentOrderStatus } from '../../../generated/prisma/client.js';

/**
 * What the buy-credits screen is allowed to read (V4.5-205).
 *
 * Deliberately narrower than the tables behind it. An order row carries the
 * provider's session and payment-intent ids; neither leaves the server. They
 * identify a Stripe object, not a purchase a learner needs to see, and a
 * screen that never receives them cannot leak them into a URL, a log or a
 * support screenshot.
 *
 * Amounts stay `bigint` here and become decimal strings at the boundary, as
 * everywhere else in this API: money through a JSON number is a rounding bug
 * waiting for a large enough amount.
 */

export interface PurchasablePack {
  credits: bigint;
  currency: string;
  key: string;
  label: string;
  /** English, served alongside French so one cached body serves everyone. */
  labelEn: string;
  priceMinor: bigint;
}

export interface OwnPaymentOrder {
  amountMinor: bigint;
  createdAt: Date;
  currency: string;
  fulfilledAt: Date | null;
  id: string;
  packKey: string;
  status: PaymentOrderStatus;
}

export interface CreditsCatalogueReader {
  /**
   * Whether this account may still buy this pack (V4.5-212).
   *
   * Per pack rather than a single `entryTierAvailable`, on the Head of UX/UI's
   * argument: a flag that says the state without saying which pack it concerns
   * forces `pack.key === 'entry'` into the screen — a hard-coded identity that
   * fails silently the day the key changes, leaving the 409 as the only
   * protection. This says it on the card it belongs to, and generalises to any
   * later per-account rule.
   */
  purchasableByUser(input: {
    keys: readonly string[];
    userId: string;
  }): Promise<Record<string, boolean>>;
  /** Active packs only, in the order an owner arranged them. */
  listActivePacks(): Promise<PurchasablePack[]>;
  /** The caller's own orders, newest first. Never anybody else's. */
  listOwnOrders(userId: string): Promise<OwnPaymentOrder[]>;
}
