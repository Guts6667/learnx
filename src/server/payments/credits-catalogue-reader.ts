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
  /** Active packs only, in the order an owner arranged them. */
  listActivePacks(): Promise<PurchasablePack[]>;
  /** The caller's own orders, newest first. Never anybody else's. */
  listOwnOrders(userId: string): Promise<OwnPaymentOrder[]>;
}
