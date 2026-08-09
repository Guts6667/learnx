import 'dotenv/config';

import { z } from 'zod';

import {
  recalculateLessonProgress,
  runSerializableProgressTransaction,
} from '../src/server/api/_lib/progress-recalculation';
import { prisma } from '../src/server/prisma';

const identifierSchema = z.uuid();

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

async function main() {
  const apply = process.argv.includes('--apply');
  const allowAll = process.argv.includes('--all');
  const programId = parseIdentifierOption('--program-id');
  const userId = parseIdentifierOption('--user-id');

  if (!allowAll && !programId && !userId) {
    throw new Error(
      'Provide --user-id, --program-id or the explicit --all flag.',
    );
  }

  const progressRecords = await prisma.lessonProgress.findMany({
    where: {
      ...(userId ? { userId } : {}),
      ...(programId
        ? {
            lesson: {
              module: { stage: { programId } },
            },
          }
        : {}),
    },
    select: {
      lessonId: true,
      userId: true,
    },
  });

  console.info(
    `${apply ? 'Applying' : 'Dry run:'} ${progressRecords.length} existing lesson progress recalculation(s).`,
  );

  if (!apply) {
    console.info('No data changed. Add --apply to persist the recalculation.');
    return;
  }

  const now = new Date();
  for (const progress of progressRecords) {
    await runSerializableProgressTransaction(prisma, (transaction) =>
      recalculateLessonProgress(
        transaction,
        progress.lessonId,
        progress.userId,
        now,
        { preserveTimestamps: true, startIfMissing: false },
      ),
    );
  }

  console.info(`Recalculated ${progressRecords.length} lesson progress record(s).`);
}

try {
  await main();
} catch (error) {
  console.error('Progress recalculation failed.', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
