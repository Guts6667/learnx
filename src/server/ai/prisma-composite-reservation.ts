import type { PrismaClient } from '../../../generated/prisma/client.js';
import { PrismaCreditLedger } from '../credits/prisma-credit-ledger.js';
import type { CompositeReservationPort } from './composite-correction-orchestrator.js';

export interface CompositeLotPriorityResolver {
  resolve(input: { userId: string }): Promise<readonly string[]>;
}

export class PrismaCompositeReservationAdapter
  implements CompositeReservationPort
{
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly ledger: PrismaCreditLedger,
    private readonly lotPriority: CompositeLotPriorityResolver,
  ) {}

  public async reserve(
    input: Parameters<CompositeReservationPort['reserve']>[0],
  ) {
    const result = await this.ledger.reserve({
      amount: input.ceilingCredits,
      expiresAt: input.expiresAt,
      idempotencyKey: input.idempotencyKey,
      priorityLotIds: await this.lotPriority.resolve({ userId: input.userId }),
      reference: { id: input.quoteId, type: 'AI_PRICING_QUOTE' },
      userId: input.userId,
    });
    if (!result.reservation) throw new Error('COMPOSITE_RESERVATION_MISSING');
    const allocations = await this.prisma.creditReservationAllocation.findMany({
      where: { reservationId: result.reservation.id },
      orderBy: { position: 'asc' },
      select: { amount: true, lotId: true, position: true },
    });
    return {
      allocationSnapshot: allocations.map((allocation) => ({
        amount: allocation.amount.toString(),
        lotId: allocation.lotId,
        position: allocation.position,
      })),
      reservationId: result.reservation.id,
    };
  }

  public async activateLease(
    input: Parameters<CompositeReservationPort['activateLease']>[0],
  ): Promise<void> {
    await this.ledger.activateReservationLease({
      expiresAt: input.expiresAt,
      reservationId: input.reservationId,
      userId: input.userId,
    });
  }

  public async release(
    input: Parameters<CompositeReservationPort['release']>[0],
  ): Promise<void> {
    await this.ledger.release(input);
  }

  public async settle(
    input: Parameters<CompositeReservationPort['settle']>[0],
  ): Promise<void> {
    await this.ledger.settle(input);
  }
}
