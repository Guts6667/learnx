import {
  AuditAction,
  type PrismaClient,
} from '../../../generated/prisma/client.js';
import {
  createAuditIdempotencyKey,
  writeAuditEvent,
} from '../api/_lib/audit.js';
import { refundPurchasedCredits } from '../credits/prisma-credit-ledger-refund.js';
import type { RefundPorts } from './refund-service.js';

export async function createPrismaRefundPorts(): Promise<RefundPorts> {
  const { prisma }: { prisma: PrismaClient } = await import('../prisma.js');

  return {
    async applyRefund(input) {
      if (input.reclaimed > 0n) {
        const order = await prisma.paymentOrder.findUniqueOrThrow({
          select: { creditLotId: true },
          where: { id: input.orderId },
        });
        if (order.creditLotId) {
          await refundPurchasedCredits(prisma, {
            actorUserId: input.actorUserId,
            amount: input.reclaimed,
            lotId: order.creditLotId,
            orderId: input.orderId,
            reason: input.note ?? `Remboursement ${input.kind}`,
            userId: input.userId,
          });
        }
      }

      await prisma.$transaction(async (transaction) => {
        await transaction.paymentOrder.update({
          data: {
            refundedCredits: input.reclaimed,
            status: input.kind === 'DISPUTE_LOST' ? 'DISPUTE_LOST' : 'REFUNDED',
            writtenOffCredits: input.writtenOff,
          },
          where: { id: input.orderId },
        });
        // Audited like the breaker reopen: who acted on someone's money, and
        // why, has to be recoverable afterwards.
        const values = {
          kind: input.kind,
          reclaimed: input.reclaimed.toString(),
          refundedMinor: input.refundedMinor.toString(),
          writtenOff: input.writtenOff.toString(),
        };
        await writeAuditEvent(transaction, {
          action: AuditAction.PAYMENT_REFUND,
          actorUserId: input.actorUserId,
          idempotencyKey: createAuditIdempotencyKey(
            AuditAction.PAYMENT_REFUND,
            input.orderId,
            values,
          ),
          metadata: values,
          ...(input.note === undefined ? {} : { note: input.note }),
          targetId: input.orderId,
          targetType: 'payment_order',
        });
      });
    },
    async loadOrder(orderId) {
      const order = await prisma.paymentOrder.findUnique({
        select: {
          creditLotId: true,
          packKey: true,
          userId: true,
        },
        where: { id: orderId },
      });
      if (!order) return null;
      const [pack, lot] = await Promise.all([
        prisma.creditPack.findUnique({
          select: { credits: true, priceMinor: true },
          where: { key: order.packKey },
        }),
        order.creditLotId
          ? prisma.creditLot.findUnique({
              select: { ledgerEntries: { select: { amount: true } } },
              where: { id: order.creditLotId },
            })
          : null,
      ]);
      if (!pack) return null;
      return {
        creditLotId: order.creditLotId,
        packCredits: pack.credits,
        packPriceMinor: pack.priceMinor,
        // Derived from the entries rather than a stored figure: the ledger is
        // the record, and a cached remaining amount is one more thing that can
        // disagree with it.
        remainingOnLot: (lot?.ledgerEntries ?? []).reduce(
          (total, entry) => total + entry.amount,
          0n,
        ),
        userId: order.userId,
      };
    },
  };
}
