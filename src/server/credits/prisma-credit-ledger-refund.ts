import { randomUUID } from 'node:crypto';

import {
  CreditCurrency,
  CreditLedgerEntryType,
  CreditProvenance,
  type PrismaClient,
} from '../../../generated/prisma/client.js';

/**
 * Reversing purchased credits (V4.5-162).
 *
 * A separate operation rather than an administrative adjustment, and not by
 * preference: `adjustCredits` refuses a negative adjustment unless it
 * compensates a FREE_ALLOCATION entry, which is a deliberate protection —
 * an administrator cannot claw back credits a learner paid for. A refund is
 * allowed to, because the money is going back with them.
 *
 * Append-only: this writes a REFUND entry against the purchased lot and never
 * touches the GRANT it compensates.
 */

export interface RefundLedgerResult {
  entryId: string;
}

export async function refundPurchasedCredits(
  prisma: PrismaClient,
  input: {
    /**
     * Null when no person acted: a refund issued from the provider's dashboard
     * reaches us as a webhook (V4.5-203). The column has always been nullable;
     * this signature was tighter than the schema.
     */
    actorUserId: string | null;
    amount: bigint;
    lotId: string;
    orderId: string;
    reason: string;
    userId: string;
  },
): Promise<RefundLedgerResult | null> {
  if (input.amount <= 0n) return null;
  const operationKey = `refund:${input.orderId}`;

  return prisma.$transaction(async (transaction) => {
    const lot = await transaction.creditLot.findFirst({
      select: { accountId: true, id: true },
      where: { id: input.lotId, provenance: CreditProvenance.PURCHASED },
    });
    // A lot that is not a purchase is not refundable here. Silence would let a
    // mis-referenced order quietly reverse a free allocation.
    if (!lot) return null;

    // Idempotent on the order: a redelivered dispute outcome, or an
    // administrator clicking twice, writes one entry.
    const existing = await transaction.creditLedgerEntry.findFirst({
      select: { id: true },
      where: { accountId: lot.accountId, operationKey },
    });
    if (existing) return { entryId: existing.id };

    const id = randomUUID();
    await transaction.creditLedgerEntry.create({
      data: {
        accountId: lot.accountId,
        actorUserId: input.actorUserId,
        amount: -input.amount,
        currency: CreditCurrency.LEARNX_CREDIT,
        id,
        lotId: lot.id,
        operationKey,
        operationSequence: 1,
        provenance: CreditProvenance.PURCHASED,
        reason: input.reason.trim(),
        referenceId: input.orderId,
        referenceType: 'PAYMENT_ORDER',
        requestFingerprint: operationKey,
        type: CreditLedgerEntryType.REFUND,
        userId: input.userId,
      },
    });
    return { entryId: id };
  });
}
