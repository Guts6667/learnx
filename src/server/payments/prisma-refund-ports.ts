import {
  AuditAction,
  type PrismaClient,
} from '../../../generated/prisma/client.js';
import {
  createAuditIdempotencyKey,
  writeAuditEvent,
} from '../api/_lib/audit.js';
import { refundPurchasedCredits } from '../credits/prisma-credit-ledger-refund.js';
import type {
  PaymentReadPorts,
  RefundPreviewSource,
} from './refund-preview.js';
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

      return prisma.$transaction(async (transaction) => {
        // Conditional on the state, not merely ordered after a check: the
        // service read the status earlier, and two administrators clicking
        // together would both have passed that read. Whoever writes second
        // matches no row and is told so, rather than overwriting the first
        // refund's figures with the zeroes a second computation produces from
        // an already-emptied lot.
        const settled = await transaction.paymentOrder.updateMany({
          data: {
            refundedCredits: input.reclaimed,
            status: input.kind === 'DISPUTE_LOST' ? 'DISPUTE_LOST' : 'REFUNDED',
            writtenOffCredits: input.writtenOff,
          },
          where: {
            id: input.orderId,
            status: { notIn: ['REFUNDED', 'DISPUTE_LOST'] },
          },
        });
        if (settled.count !== 1) return false;
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

        return true;
      });
    },
    async loadOrder(orderId) {
      const order = await prisma.paymentOrder.findUnique({
        select: {
          creditLotId: true,
          packKey: true,
          status: true,
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
        status: order.status,
        userId: order.userId,
      };
    },
  };
}

export async function createPrismaPaymentReadPorts(): Promise<PaymentReadPorts> {
  const { prisma }: { prisma: PrismaClient } = await import('../prisma.js');

  return {
    async listOrders(input) {
      const where = { userId: input.userId };
      const [rows, total] = await Promise.all([
        prisma.paymentOrder.findMany({
          orderBy: { createdAt: 'desc' },
          select: {
            amountMinor: true,
            createdAt: true,
            currency: true,
            fulfilledAt: true,
            id: true,
            packKey: true,
            refundedCredits: true,
            status: true,
            writtenOffCredits: true,
          },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          where,
        }),
        prisma.paymentOrder.count({ where }),
      ]);

      return { rows, total };
    },
    async loadPreview(orderId): Promise<RefundPreviewSource | null> {
      const order = await prisma.paymentOrder.findUnique({
        select: {
          amountMinor: true,
          createdAt: true,
          creditLotId: true,
          currency: true,
          fulfilledAt: true,
          id: true,
          packKey: true,
          refundedCredits: true,
          status: true,
          user: {
            select: {
              accountStatus: true,
              displayName: true,
              email: true,
              id: true,
            },
          },
          writtenOffCredits: true,
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
        amountMinor: order.amountMinor,
        createdAt: order.createdAt,
        creditLotId: order.creditLotId,
        currency: order.currency,
        fulfilledAt: order.fulfilledAt,
        id: order.id,
        learner: {
          accountStatus: order.user.accountStatus,
          displayName: order.user.displayName,
          email: order.user.email,
          userId: order.user.id,
        },
        packCredits: pack.credits,
        packKey: order.packKey,
        packPriceMinor: pack.priceMinor,
        refundedCredits: order.refundedCredits,
        // Derived from the entries, like `loadOrder`: the ledger is the
        // record, and a cached remaining amount is one more thing that can
        // disagree with it.
        remainingOnLot: (lot?.ledgerEntries ?? []).reduce(
          (total, entry) => total + entry.amount,
          0n,
        ),
        status: order.status,
        writtenOffCredits: order.writtenOffCredits,
      };
    },
  };
}
