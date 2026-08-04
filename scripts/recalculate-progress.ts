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

  const programs = await prisma.program.findMany({
    where: {
      ...(programId ? { id: programId } : {}),
      ...(userId ? { ownerId: userId } : {}),
    },
    select: {
      ownerId: true,
      stages: {
        select: {
          modules: {
            select: { lessons: { select: { id: true } } },
          },
        },
      },
      title: true,
    },
  });
  const lessons = programs.flatMap((program) =>
    program.stages.flatMap((stage) =>
      stage.modules.flatMap((module) =>
        module.lessons.map((lesson) => ({
          lessonId: lesson.id,
          programTitle: program.title,
          userId: program.ownerId,
        })),
      ),
    ),
  );

  console.info(
    `${apply ? 'Applying' : 'Dry run:'} ${lessons.length} lesson recalculation(s) across ${programs.length} program(s).`,
  );

  if (!apply) {
    console.info('No data changed. Add --apply to persist the recalculation.');
    return;
  }

  const now = new Date();
  for (const lesson of lessons) {
    await runSerializableProgressTransaction(prisma, (transaction) =>
      recalculateLessonProgress(
        transaction,
        lesson.lessonId,
        lesson.userId,
        now,
        { startIfMissing: false },
      ),
    );
  }

  console.info(`Recalculated ${lessons.length} lesson(s).`);
}

try {
  await main();
} catch (error) {
  console.error('Progress recalculation failed.', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
