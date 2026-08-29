import 'dotenv/config';

import { z } from 'zod';

import {
  recalculateLessonProgress,
  runSerializableProgressTransaction,
} from '../src/server/api/_lib/progress-recalculation';
import { prisma } from '../src/server/prisma';
import { processCursorBatches } from '../src/server/maintenance/cursor-batches';

const identifierSchema = z.uuid();
const batchSizeSchema = z.coerce.number().int().min(1).max(1_000);

function readOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);

  return index >= 0 ? process.argv[index + 1] : undefined;
}

function parseIdentifierOption(name: string): string | undefined {
  const value = readOption(name);

  if (!value) return undefined;

  const parsed = identifierSchema.safeParse(value);
  if (!parsed.success) throw new Error(`${name} must be a UUID.`);

  return parsed.data;
}

function parseBatchSize(): number {
  const value = readOption('--batch-size');
  if (!value) return 100;
  const parsed = batchSizeSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('--batch-size must be an integer between 1 and 1000.');
  }
  return parsed.data;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const allowAll = process.argv.includes('--all');
  const programId = parseIdentifierOption('--program-id');
  const userId = parseIdentifierOption('--user-id');
  const batchSize = parseBatchSize();

  if (!allowAll && !programId && !userId) {
    throw new Error(
      'Provide --user-id, --program-id or the explicit --all flag.',
    );
  }

  const where = {
    ...(userId ? { userId } : {}),
    ...(programId ? { lesson: { module: { stage: { programId } } } } : {}),
  };
  const total = await prisma.lessonProgress.count({ where });

  console.info(
    `${apply ? 'Applying' : 'Dry run:'} ${total} existing lesson progress recalculation(s), batch size ${batchSize}.`,
  );

  if (!apply) {
    console.info('No data changed. Add --apply to persist the recalculation.');
    return;
  }

  const now = new Date();
  const processed = await processCursorBatches({
    fetchBatch: (cursor) =>
      prisma.lessonProgress.findMany({
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { id: 'asc' },
        skip: cursor ? 1 : 0,
        take: batchSize,
        where,
        select: { id: true, lessonId: true, userId: true },
      }),
    onBatchComplete: (count) =>
      console.info(`Recalculated ${count}/${total} progress record(s).`),
    processRecord: async (progress) => {
      await runSerializableProgressTransaction(prisma, (transaction) =>
        recalculateLessonProgress(
          transaction,
          progress.lessonId,
          progress.userId,
          now,
          { preserveTimestamps: true, startIfMissing: false },
        ),
      );
    },
  });

  console.info(`Recalculated ${processed} lesson progress record(s).`);
}

try {
  await main();
} catch (error) {
  console.error('Progress recalculation failed.', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
