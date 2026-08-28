import type { Prisma } from '../../../../generated/prisma/client.js';
import { calculateProgramPercent } from './timeline-progress.js';

function readProgramState(
  transaction: Prisma.TransactionClient,
  programId: string,
  userId: string,
) {
  return transaction.program.findUnique({
    where: { id: programId },
    select: {
      stages: {
        where: { isPublished: true },
        select: {
          modules: {
            where: { isPublished: true },
            select: {
              lessons: {
                where: { isPublished: true },
                select: {
                  progress: {
                    where: { userId },
                    take: 1,
                    select: { percent: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function recalculateProgramProgress(
  transaction: Prisma.TransactionClient,
  programId: string,
  userId: string,
  now: Date,
  preserveTimestamps: boolean,
): Promise<void> {
  const program = await readProgramState(transaction, programId, userId);
  if (!program) return;
  const percent = calculateProgramPercent(program.stages);
  await transaction.programProgress.upsert({
    where: { userId_programId: { programId, userId } },
    create: { lastViewedAt: now, percent, programId, userId },
    update: {
      ...(preserveTimestamps ? {} : { lastViewedAt: now }),
      percent,
    },
  });
}
