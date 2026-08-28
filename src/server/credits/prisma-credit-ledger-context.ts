import {
  CreditCurrency,
  CreditLedgerEntryType,
  CreditProvenance,
  Prisma,
  type PrismaClient,
} from '../../../generated/prisma/client.js';
import {
  CreditLedgerError,
  creditRequestFingerprint,
  reconstructCreditBalance,
  type CreditBalance,
  type CreditProvenanceValue,
  type SpendableCreditLot,
} from './credit-ledger.js';
import {
  isRetryableCreditTransactionError,
  type CreditOperationResult,
  type CreditReference,
} from './prisma-credit-ledger-contracts.js';

const MAX_TRANSACTION_ATTEMPTS = 3;
export type LedgerTransaction = Prisma.TransactionClient;

export function assertReference(reference: CreditReference): void {
  if (!reference.type.trim() || !reference.id.trim()) {
    throw new CreditLedgerError('REFERENCE_NOT_FOUND');
  }
}

export function dbProvenance(value: CreditProvenanceValue): CreditProvenance {
  return value === 'FREE_ALLOCATION'
    ? CreditProvenance.FREE_ALLOCATION
    : CreditProvenance.PURCHASED;
}

export function domainProvenance(
  value: CreditProvenance,
): CreditProvenanceValue {
  return value === CreditProvenance.FREE_ALLOCATION
    ? 'FREE_ALLOCATION'
    : 'PURCHASED';
}

export class PrismaCreditLedgerContext {
  public constructor(
    public readonly prisma: PrismaClient,
    public readonly clock: () => Date,
  ) {}

  public async transaction<T>(
    operation: (transaction: LedgerTransaction) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 15_000,
        });
      } catch (error) {
        if (
          !isRetryableCreditTransactionError(error) ||
          attempt === MAX_TRANSACTION_ATTEMPTS
        )
          throw error;
      }
    }
    throw new CreditLedgerError('LEDGER_INCONSISTENT');
  }

  public async lockAccount(transaction: LedgerTransaction, userId: string) {
    const account = await transaction.creditAccount.upsert({
      where: {
        userId_currency: { currency: CreditCurrency.LEARNX_CREDIT, userId },
      },
      create: { currency: CreditCurrency.LEARNX_CREDIT, userId },
      update: {},
    });
    await transaction.$queryRaw(
      Prisma.sql`SELECT "id" FROM "credit_accounts" WHERE "id" = ${account.id}::uuid FOR UPDATE`,
    );
    return transaction.creditAccount.findUniqueOrThrow({
      where: { id: account.id },
    });
  }

  public async balanceFromLedger(
    transaction: LedgerTransaction,
    accountId: string,
  ): Promise<CreditBalance> {
    const entries = await transaction.creditLedgerEntry.findMany({
      where: { accountId },
      select: { amount: true, provenance: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return reconstructCreditBalance(
      entries.map((entry) => ({
        amount: entry.amount,
        provenance: domainProvenance(entry.provenance),
      })),
    );
  }

  public async result(
    transaction: LedgerTransaction,
    accountId: string,
    extra: Omit<CreditOperationResult, 'balance'> = {},
  ): Promise<CreditOperationResult> {
    return {
      ...extra,
      balance: await this.balanceFromLedger(transaction, accountId),
    };
  }

  public async assertProjection(
    transaction: LedgerTransaction,
    accountId: string,
  ): Promise<void> {
    await this.balanceFromLedger(transaction, accountId);
  }

  public async expireFreeLots(
    transaction: LedgerTransaction,
    accountId: string,
    userId: string,
    now: Date,
  ): Promise<void> {
    const lots = await transaction.creditLot.findMany({
      where: {
        accountId,
        expiresAt: { lte: now },
        provenance: CreditProvenance.FREE_ALLOCATION,
      },
      include: { ledgerEntries: { select: { amount: true } } },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    for (const lot of lots)
      await this.expireFreeLot(transaction, accountId, userId, lot);
  }

  private async expireFreeLot(
    transaction: LedgerTransaction,
    accountId: string,
    userId: string,
    lot: {
      expiresAt: Date | null;
      id: string;
      ledgerEntries: { amount: bigint }[];
    },
  ): Promise<void> {
    const amount = lot.ledgerEntries.reduce(
      (total, entry) => total + entry.amount,
      0n,
    );
    if (amount <= 0n) return;
    const operationKey = `expiration:${lot.id}`;
    const sequence =
      (await transaction.creditLedgerEntry.count({
        where: { accountId, operationKey },
      })) + 1;
    await transaction.creditLedgerEntry.create({
      data: {
        accountId,
        amount: -amount,
        currency: CreditCurrency.LEARNX_CREDIT,
        lotId: lot.id,
        operationKey,
        operationSequence: sequence,
        provenance: CreditProvenance.FREE_ALLOCATION,
        referenceId: lot.id,
        referenceType: 'CREDIT_LOT',
        requestFingerprint: creditRequestFingerprint({
          amount,
          expiresAt: lot.expiresAt,
          lotId: lot.id,
          sequence,
          type: 'EXPIRATION',
        }),
        type: CreditLedgerEntryType.EXPIRATION,
        userId,
      },
    });
  }

  public async spendableLots(
    transaction: LedgerTransaction,
    accountId: string,
  ): Promise<SpendableCreditLot[]> {
    const lots = await transaction.creditLot.findMany({
      where: { accountId },
      select: {
        createdAt: true,
        expiresAt: true,
        id: true,
        provenance: true,
        ledgerEntries: { select: { amount: true } },
      },
    });
    return lots.flatMap((lot) => {
      const remainingAmount = lot.ledgerEntries.reduce(
        (total, entry) => total + entry.amount,
        0n,
      );
      return remainingAmount <= 0n
        ? []
        : [
            {
              createdAt: lot.createdAt,
              expiresAt: lot.expiresAt,
              id: lot.id,
              provenance: domainProvenance(lot.provenance),
              remainingAmount,
            },
          ];
    });
  }
}
