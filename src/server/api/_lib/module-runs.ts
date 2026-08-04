import type {
  Prisma,
  PrismaClient,
} from '../../../../generated/prisma/client.js';

type DatabaseClient = Prisma.TransactionClient | PrismaClient;

export interface CurrentModuleRun {
  id: string;
  moduleId: string;
  sequence: number;
  startedAt: Date;
  userId: string;
}

export async function getCurrentModuleRun(
  client: DatabaseClient,
  moduleId: string,
  userId: string,
): Promise<CurrentModuleRun | null> {
  return client.moduleRun.findFirst({
    where: { moduleId, userId },
    orderBy: { sequence: 'desc' },
    select: {
      id: true,
      moduleId: true,
      sequence: true,
      startedAt: true,
      userId: true,
    },
  });
}

export async function getCurrentModuleRunForLesson(
  client: DatabaseClient,
  lessonId: string,
  userId: string,
): Promise<CurrentModuleRun | null> {
  const lesson = await client.lesson.findUnique({
    where: { id: lessonId },
    select: { moduleId: true },
  });
  return lesson ? getCurrentModuleRun(client, lesson.moduleId, userId) : null;
}

export async function ensureCurrentModuleRunForLesson(
  client: Prisma.TransactionClient,
  lessonId: string,
  userId: string,
  now: Date,
): Promise<CurrentModuleRun> {
  const lesson = await client.lesson.findUnique({
    where: { id: lessonId },
    select: { moduleId: true },
  });

  if (!lesson) throw new Error('Lesson not found while resolving module run.');

  const current = await getCurrentModuleRun(client, lesson.moduleId, userId);
  if (current) return current;

  return client.moduleRun.upsert({
    where: {
      userId_moduleId_sequence: {
        moduleId: lesson.moduleId,
        sequence: 1,
        userId,
      },
    },
    create: {
      moduleId: lesson.moduleId,
      sequence: 1,
      startedAt: now,
      userId,
    },
    update: {},
    select: {
      id: true,
      moduleId: true,
      sequence: true,
      startedAt: true,
      userId: true,
    },
  });
}
