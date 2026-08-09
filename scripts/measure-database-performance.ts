import 'dotenv/config';

import { writeFile } from 'node:fs/promises';

import { z } from 'zod';

import { createPrismaTodayRepository } from '../src/server/api/today/app';
import { prisma } from '../src/server/prisma';

const optionsSchema = z.object({
  environment: z.literal('isolated'),
  output: z.string().min(1).optional(),
});

function readOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function measure<T>(operation: () => Promise<T>) {
  const startedAt = performance.now();
  const value = await operation();
  return {
    durationMs: Number((performance.now() - startedAt).toFixed(1)),
    payloadBytes: Buffer.byteLength(JSON.stringify(value)),
    value,
  };
}

async function findRepresentativeUserId(): Promise<string | null> {
  const progress = await prisma.lessonProgress.groupBy({
    _count: { userId: true },
    by: ['userId'],
    orderBy: { _count: { userId: 'desc' } },
    take: 1,
  });
  if (progress[0]) return progress[0].userId;
  return (await prisma.user.findFirst({ select: { id: true } }))?.id ?? null;
}

async function main() {
  const options = optionsSchema.parse({
    environment: process.env.LEARNX_PERFORMANCE_DATABASE,
    output: readOption('--output'),
  });
  const userId = await findRepresentativeUserId();
  if (!userId)
    throw new Error('No user is available for read-only measurement.');

  const todayRepository = createPrismaTodayRepository(prisma);
  const [notes, reviews, quizAttempts, conceptAttempts, todayLessons] =
    await Promise.all([
      measure(() =>
        prisma.note.findMany({
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          select: { id: true, markdown: true, title: true, updatedAt: true },
          take: 21,
          where: { userId },
        }),
      ),
      measure(() =>
        prisma.reviewItem.findMany({
          orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
          select: { dueAt: true, id: true, sourceId: true },
          take: 21,
          where: { status: 'PENDING', userId },
        }),
      ),
      measure(() =>
        prisma.quizAttempt.findMany({
          orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
          select: { id: true, quizId: true, submittedAt: true },
          take: 21,
          where: { userId },
        }),
      ),
      measure(() =>
        prisma.conceptAssessmentAttempt.findMany({
          orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
          select: { assessmentId: true, id: true, submittedAt: true },
          take: 21,
          where: { userId },
        }),
      ),
      measure(() => todayRepository.listLessons(userId)),
    ]);
  const counts = await Promise.all([
    prisma.note.count({ where: { userId } }),
    prisma.reviewItem.count({ where: { status: 'PENDING', userId } }),
    prisma.quizAttempt.count({ where: { userId } }),
    prisma.conceptAssessmentAttempt.count({ where: { userId } }),
    prisma.lessonProgress.count({ where: { userId } }),
  ]);

  const report = {
    generatedAt: new Date().toISOString(),
    scope: 'isolated-neon-clone',
    targets: {
      conceptAttempts: {
        durationMs: conceptAttempts.durationMs,
        pageRecords: conceptAttempts.value.length,
        payloadBytes: conceptAttempts.payloadBytes,
        totalRecords: counts[3],
      },
      notes: {
        durationMs: notes.durationMs,
        pageRecords: notes.value.length,
        payloadBytes: notes.payloadBytes,
        totalRecords: counts[0],
      },
      quizAttempts: {
        durationMs: quizAttempts.durationMs,
        pageRecords: quizAttempts.value.length,
        payloadBytes: quizAttempts.payloadBytes,
        totalRecords: counts[2],
      },
      reviews: {
        durationMs: reviews.durationMs,
        pageRecords: reviews.value.length,
        payloadBytes: reviews.payloadBytes,
        totalRecords: counts[1],
      },
      todayLessons: {
        durationMs: todayLessons.durationMs,
        payloadBytes: todayLessons.payloadBytes,
        records: todayLessons.value.length,
      },
      progressRecalculation: { records: counts[4] },
    },
  };
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (options.output) await writeFile(options.output, serialized, 'utf8');
  console.info(serialized.trim());
}

try {
  await main();
} catch (error) {
  console.error('Performance measurement failed.', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
