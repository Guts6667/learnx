import type { PrismaClient } from '../../../../generated/prisma/client.js';

export async function readProgramViewPreference(
  prisma: PrismaClient,
  userId: string,
  programId: string,
): Promise<string | null> {
  const preference = await prisma.programViewPreference.findUnique({
    where: { userId_programId: { programId, userId } },
    select: { expandedStageId: true },
  });
  return preference?.expandedStageId ?? null;
}

export async function saveProgramViewPreference(
  prisma: PrismaClient,
  userId: string,
  programId: string,
  expandedStageId: string,
): Promise<void> {
  await prisma.programViewPreference.upsert({
    where: { userId_programId: { programId, userId } },
    create: { expandedStageId, programId, userId },
    update: { expandedStageId },
  });
}
