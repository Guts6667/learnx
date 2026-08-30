import type { PaymentOrderStatus } from '../../../generated/prisma/client.js';
import { splitRefund } from './refund-split.js';
import {
  refundRefusal,
  REFUSAL_MESSAGES,
  type RefundRefusalCode,
} from './refund-service.js';
import { voluntaryRefundMinor } from './voluntary-refund.js';

/**
 * What the administration screen needs before offering a refund (V4.5-162B).
 *
 * The figures are computed here, from the same `refundRefusal`, `splitRefund`
 * and `voluntaryRefundMinor` the refund itself uses, so the preview and the
 * action cannot drift into disagreeing. A screen that offers a button the
 * endpoint refuses, or shows an amount the endpoint does not pay, is worse
 * than a screen that offers nothing.
 */

export type RefundPreviewSource = {
  amountMinor: bigint;
  createdAt: Date;
  creditLotId: string | null;
  currency: string;
  fulfilledAt: Date | null;
  id: string;
  learner: {
    accountStatus: string;
    displayName: string;
    email: string;
    userId: string;
  };
  packCredits: bigint;
  packKey: string;
  packPriceMinor: bigint;
  refundedCredits: bigint;
  remainingOnLot: bigint;
  status: PaymentOrderStatus;
  writtenOffCredits: bigint;
};

export type RefundPreview = {
  computation: {
    /** Sent back with the refund so a lot that moved is refused, not paid. */
    expectedRemainingOnLot: bigint;
    packCredits: bigint;
    packPriceMinor: bigint;
    /**
     * Always zero under the voluntary policy: what is requested *is* what
     * remains, so nothing can be absorbed — `assertNoWriteOff` makes that an
     * invariant rather than a coincidence. The field stays because a
     * chargeback does write off and will share this shape.
     */
    projectedWriteOffCredits: bigint;
    reclaimedCredits: bigint;
    refundedMinor: bigint;
    remainingOnLot: bigint;
  } | null;
  order: {
    amountMinor: bigint;
    createdAt: Date;
    currency: string;
    fulfilledAt: Date | null;
    id: string;
    learner: {
      displayName: string | null;
      email: string | null;
      userId: string;
    };
    packKey: string;
    refundedCredits: bigint;
    status: PaymentOrderStatus;
    writtenOffCredits: bigint;
  };
  refundable: boolean;
  refusal: { code: RefundRefusalCode; message: string } | null;
};

export function buildRefundPreview(source: RefundPreviewSource): RefundPreview {
  const refusal = refundRefusal(source);

  // An erased account keeps its orders — the ledger is never rewritten and the
  // books stay whole — but its identity is gone. Null says that; an empty
  // string or a placeholder name would invite the screen to render something
  // that looks like a person.
  const erased = source.learner.accountStatus === 'PSEUDONYMISED';
  const order = {
    amountMinor: source.amountMinor,
    createdAt: source.createdAt,
    currency: source.currency,
    fulfilledAt: source.fulfilledAt,
    id: source.id,
    learner: {
      displayName: erased ? null : source.learner.displayName,
      email: erased ? null : source.learner.email,
      userId: source.learner.userId,
    },
    packKey: source.packKey,
    refundedCredits: source.refundedCredits,
    status: source.status,
    writtenOffCredits: source.writtenOffCredits,
  };

  if (refusal) {
    // Deliberately not a block of zeros. An already-refunded order computes
    // reclaimed 0 and refundedMinor 0 — precisely the false figure the
    // V4.5-162B defect wrote into the database — and rendering it would put
    // "refund 0.00" on screen as though it were a choice. What was actually
    // refunded stays readable under `order`.
    return {
      computation: null,
      order,
      refundable: false,
      refusal: { code: refusal, message: REFUSAL_MESSAGES[refusal] },
    };
  }

  const split = splitRefund({
    remainingOnLot: source.remainingOnLot,
    requested: source.remainingOnLot,
  });

  return {
    computation: {
      expectedRemainingOnLot: source.remainingOnLot,
      packCredits: source.packCredits,
      packPriceMinor: source.packPriceMinor,
      projectedWriteOffCredits: split.writtenOff,
      reclaimedCredits: split.reclaimed,
      refundedMinor: voluntaryRefundMinor({
        packCredits: source.packCredits,
        packPriceMinor: source.packPriceMinor,
        unspentCredits: split.reclaimed,
      }),
      remainingOnLot: source.remainingOnLot,
    },
    order,
    refundable: true,
    refusal: null,
  };
}

export type PaymentOrderRow = {
  amountMinor: bigint;
  createdAt: Date;
  currency: string;
  fulfilledAt: Date | null;
  id: string;
  packKey: string;
  refundedCredits: bigint;
  status: PaymentOrderStatus;
  writtenOffCredits: bigint;
};

export interface PaymentReadPorts {
  listOrders(input: {
    page: number;
    pageSize: number;
    userId: string;
  }): Promise<{ rows: PaymentOrderRow[]; total: number }>;
  loadPreview(orderId: string): Promise<RefundPreviewSource | null>;
}
