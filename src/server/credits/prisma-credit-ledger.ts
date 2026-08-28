import {
  CreditCurrency,
  CreditProvenance,
  type PrismaClient,
} from '../../../generated/prisma/client.js';
import type { CreditBalance } from './credit-ledger.js';
import { adjustCredits, grantCredits } from './prisma-credit-ledger-grants.js';
import {
  activateReservationLease,
  expireReservations,
  releaseCredits,
  settleCredits,
} from './prisma-credit-ledger-lifecycle.js';
import { reserveCredits } from './prisma-credit-ledger-reserve.js';
import { PrismaCreditLedgerContext } from './prisma-credit-ledger-context.js';
import type {
  ActivateReservationLeaseInput,
  AdjustCreditsInput,
  CreditOperationResult,
  GrantCreditsInput,
  ReleaseCreditsInput,
  ReserveCreditsInput,
  SettleCreditsInput,
} from './prisma-credit-ledger-contracts.js';

export * from './prisma-credit-ledger-contracts.js';

export class PrismaCreditLedger {
  private readonly context: PrismaCreditLedgerContext;

  public constructor(
    prisma: PrismaClient,
    clock: () => Date = () => new Date(),
  ) {
    this.context = new PrismaCreditLedgerContext(prisma, clock);
  }

  /** V4 pilot corrections can only consume offered allocations. */
  public async offeredLotIds(userId: string): Promise<string[]> {
    const now = this.context.clock();
    const lots = await this.context.prisma.creditLot.findMany({
      where: {
        account: { userId },
        provenance: CreditProvenance.FREE_ALLOCATION,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: { ledgerEntries: { select: { amount: true } } },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    return lots.flatMap((lot) =>
      lot.ledgerEntries.reduce((total, entry) => total + entry.amount, 0n) > 0n
        ? [lot.id]
        : [],
    );
  }

  public async getBalance(userId: string): Promise<CreditBalance> {
    const account = await this.context.prisma.creditAccount.findUnique({
      where: {
        userId_currency: { currency: CreditCurrency.LEARNX_CREDIT, userId },
      },
    });
    if (!account) return { free: 0n, purchased: 0n, total: 0n };
    return this.context.transaction(async (transaction) => {
      const locked = await this.context.lockAccount(transaction, userId);
      await this.context.expireFreeLots(
        transaction,
        locked.id,
        userId,
        this.context.clock(),
      );
      await this.context.assertProjection(transaction, locked.id);
      return this.context.balanceFromLedger(transaction, locked.id);
    });
  }

  public grant(input: GrantCreditsInput): Promise<CreditOperationResult> {
    return grantCredits(this.context, input);
  }

  public reserve(input: ReserveCreditsInput): Promise<CreditOperationResult> {
    return reserveCredits(this.context, input);
  }

  public settle(input: SettleCreditsInput): Promise<CreditOperationResult> {
    return settleCredits(this.context, input);
  }

  public activateReservationLease(
    input: ActivateReservationLeaseInput,
  ): Promise<CreditOperationResult> {
    return activateReservationLease(this.context, input);
  }

  public release(input: ReleaseCreditsInput): Promise<CreditOperationResult> {
    return releaseCredits(this.context, input);
  }

  public expireReservations(): Promise<number> {
    return expireReservations(this.context);
  }

  public expireAllocations(userId: string): Promise<CreditBalance> {
    return this.context.transaction(async (transaction) => {
      const account = await this.context.lockAccount(transaction, userId);
      await this.context.expireFreeLots(
        transaction,
        account.id,
        userId,
        this.context.clock(),
      );
      await this.context.assertProjection(transaction, account.id);
      return this.context.balanceFromLedger(transaction, account.id);
    });
  }

  public adjust(input: AdjustCreditsInput): Promise<CreditOperationResult> {
    return adjustCredits(this.context, input);
  }

  public rebuildProjection(userId: string): Promise<CreditBalance> {
    return this.context.transaction(async (transaction) => {
      const account = await this.context.lockAccount(transaction, userId);
      return this.context.balanceFromLedger(transaction, account.id);
    });
  }
}
