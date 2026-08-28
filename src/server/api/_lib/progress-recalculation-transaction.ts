import {
  Prisma,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';

const MAX_TRANSACTION_ATTEMPTS = 3;
const PROGRESS_TRANSACTION_MAX_WAIT_MS = 5_000;
const PROGRESS_TRANSACTION_TIMEOUT_MS = 15_000;

function isRetryableTransactionError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2034'
  );
}

export async function runSerializableProgressTransaction<T>(
  prisma: PrismaClient,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: PROGRESS_TRANSACTION_MAX_WAIT_MS,
        timeout: PROGRESS_TRANSACTION_TIMEOUT_MS,
      });
    } catch (error) {
      if (
        !isRetryableTransactionError(error) ||
        attempt === MAX_TRANSACTION_ATTEMPTS
      ) {
        throw error;
      }
    }
  }
  throw new Error('Progress transaction retry limit reached.');
}
