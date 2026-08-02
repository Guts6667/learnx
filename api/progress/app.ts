import { Hono } from 'hono';
import { z } from 'zod';

import {
  LessonProgressStatus,
  ResourceProgressStatus,
  TaskCompletionStatus,
} from '../../generated/prisma/client';
import { calculateProgress } from '../../src/lib/progress';
import { requireUser, type AuthEnvironment } from '../_lib/auth';
import { ApiError, toApiErrorBody } from '../_lib/errors';

async function getPrismaClient() {
  const { prisma } = await import('../../src/server/prisma');

  return prisma;
}

const identifierSchema = z.string().uuid();
const taskStatusSchema = z.object({
  status: z.enum(['TODO', 'DONE', 'SKIPPED']),
});
const resourceStatusSchema = z.object({
  status: z.enum(['NOT_STARTED', 'STARTED', 'COMPLETED']),
});

function notFound(): ApiError {
  return new ApiError('RESOURCE_NOT_FOUND', 'Resource not found.', 404);
}

function invalidRequest(): ApiError {
  return new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
}

function assertIdentifier(value: string): string {
  const parsedIdentifier = identifierSchema.safeParse(value);

  if (!parsedIdentifier.success) {
    throw invalidRequest();
  }

  return parsedIdentifier.data;
}

async function parseBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw invalidRequest();
  }
}

async function getPublishedLessonForUser(lessonId: string, userId: string) {
  const prisma = await getPrismaClient();
  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      isPublished: true,
      module: {
        isPublished: true,
        stage: {
          isPublished: true,
          program: { ownerId: userId },
        },
      },
    },
    include: {
      resources: { orderBy: { position: 'asc' } },
      tasks: { orderBy: { position: 'asc' } },
    },
  });

  if (!lesson) {
    throw notFound();
  }

  return { lesson, prisma };
}

async function getProgressSnapshot(lessonId: string, userId: string) {
  const { lesson, prisma } = await getPublishedLessonForUser(lessonId, userId);
  const [lessonProgress, resourceProgress, taskCompletions] = await Promise.all(
    [
      prisma.lessonProgress.findUnique({
        where: { userId_lessonId: { lessonId, userId } },
      }),
      prisma.resourceProgress.findMany({
        where: {
          userId,
          resourceId: { in: lesson.resources.map((resource) => resource.id) },
        },
      }),
      prisma.taskCompletion.findMany({
        where: {
          taskId: { in: lesson.tasks.map((task) => task.id) },
          userId,
        },
      }),
    ],
  );
  const resourceStatusById = new Map(
    resourceProgress.map((progress) => [progress.resourceId, progress.status]),
  );
  const taskStatusById = new Map(
    taskCompletions.map((completion) => [completion.taskId, completion.status]),
  );
  const percent = calculateProgress([
    {
      itemProgress: lesson.tasks.map((task) => {
        const status = taskStatusById.get(task.id);

        return status === TaskCompletionStatus.DONE ? 100 : 0;
      }),
      weight: 40,
    },
    {
      itemProgress: lesson.resources
        .filter((resource) => resource.isRequired)
        .map((resource) => {
          const status = resourceStatusById.get(resource.id);

          return status === ResourceProgressStatus.COMPLETED ? 100 : 0;
        }),
      weight: 10,
    },
  ]);

  return {
    canComplete:
      lesson.tasks.length === 0 &&
      lesson.resources.every((resource) => !resource.isRequired)
        ? true
        : percent === 100,
    lesson,
    lessonProgress,
    percent,
    prisma,
    resourceStatusById,
    taskStatusById,
  };
}

function serializeSnapshot(
  snapshot: Awaited<ReturnType<typeof getProgressSnapshot>>,
) {
  return {
    lessonProgress: {
      completedAt: snapshot.lessonProgress?.completedAt ?? null,
      percent: snapshot.percent,
      startedAt: snapshot.lessonProgress?.startedAt ?? null,
      status: snapshot.lessonProgress?.status ?? LessonProgressStatus.AVAILABLE,
    },
    canComplete: snapshot.canComplete,
    resourceProgress: Object.fromEntries(snapshot.resourceStatusById),
    taskCompletions: Object.fromEntries(snapshot.taskStatusById),
  };
}

async function refreshLessonProgress(
  lessonId: string,
  userId: string,
  now: Date,
) {
  const snapshot = await getProgressSnapshot(lessonId, userId);
  const currentProgress = snapshot.lessonProgress;

  const lessonProgress = await snapshot.prisma.lessonProgress.upsert({
    where: { userId_lessonId: { lessonId, userId } },
    create: {
      lastViewedAt: now,
      lessonId,
      percent: snapshot.percent,
      startedAt: now,
      status: LessonProgressStatus.IN_PROGRESS,
      userId,
    },
    update: {
      lastViewedAt: now,
      percent: snapshot.percent,
      startedAt: currentProgress?.startedAt ?? now,
      status:
        currentProgress?.status === LessonProgressStatus.COMPLETED
          ? LessonProgressStatus.COMPLETED
          : LessonProgressStatus.IN_PROGRESS,
    },
  });

  return { ...snapshot, lessonProgress };
}

export const progressApp = new Hono<AuthEnvironment>();

progressApp.use('*', requireUser);

progressApp.onError((error, context) => {
  if (error instanceof ApiError) {
    return context.json(toApiErrorBody(error), error.status);
  }

  return context.json(
    toApiErrorBody(
      new ApiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500),
    ),
    500,
  );
});

progressApp.get('/api/lessons/:lessonId/progress', async (context) => {
  const lessonId = assertIdentifier(context.req.param('lessonId'));
  const snapshot = await getProgressSnapshot(lessonId, context.get('user').id);

  return context.json(serializeSnapshot(snapshot));
});

progressApp.post('/api/lessons/:lessonId/start', async (context) => {
  const lessonId = assertIdentifier(context.req.param('lessonId'));
  const userId = context.get('user').id;
  const now = new Date();
  const snapshot = await getProgressSnapshot(lessonId, userId);

  const lessonProgress = await snapshot.prisma.lessonProgress.upsert({
    where: { userId_lessonId: { lessonId, userId } },
    create: {
      lastViewedAt: now,
      lessonId,
      percent: snapshot.percent,
      startedAt: now,
      status: LessonProgressStatus.IN_PROGRESS,
      userId,
    },
    update: {
      lastViewedAt: now,
      percent: snapshot.percent,
      startedAt: snapshot.lessonProgress?.startedAt ?? now,
      status:
        snapshot.lessonProgress?.status === LessonProgressStatus.COMPLETED
          ? LessonProgressStatus.COMPLETED
          : LessonProgressStatus.IN_PROGRESS,
    },
  });

  return context.json({
    ...serializeSnapshot({ ...snapshot, lessonProgress }),
  });
});

progressApp.post('/api/lessons/:lessonId/complete', async (context) => {
  const lessonId = assertIdentifier(context.req.param('lessonId'));
  const userId = context.get('user').id;
  const snapshot = await getProgressSnapshot(lessonId, userId);

  if (!snapshot.canComplete) {
    throw new ApiError(
      'LESSON_NOT_READY',
      'Complete the tracked activities before completing this lesson.',
      409,
    );
  }

  const now = new Date();
  const lessonProgress = await snapshot.prisma.lessonProgress.upsert({
    where: { userId_lessonId: { lessonId, userId } },
    create: {
      completedAt: now,
      lastViewedAt: now,
      lessonId,
      percent: 100,
      startedAt: now,
      status: LessonProgressStatus.COMPLETED,
      userId,
    },
    update: {
      completedAt: now,
      lastViewedAt: now,
      percent: 100,
      startedAt: snapshot.lessonProgress?.startedAt ?? now,
      status: LessonProgressStatus.COMPLETED,
    },
  });

  return context.json({
    ...serializeSnapshot({ ...snapshot, lessonProgress, percent: 100 }),
  });
});

progressApp.patch('/api/tasks/:taskId', async (context) => {
  const taskId = assertIdentifier(context.req.param('taskId'));
  const parsedInput = taskStatusSchema.safeParse(
    await parseBody(context.req.raw),
  );

  if (!parsedInput.success) {
    throw invalidRequest();
  }

  const userId = context.get('user').id;
  const prisma = await getPrismaClient();
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      lesson: {
        isPublished: true,
        module: {
          isPublished: true,
          stage: { isPublished: true, program: { ownerId: userId } },
        },
      },
    },
  });

  if (!task) {
    throw notFound();
  }

  const now = new Date();
  await prisma.taskCompletion.upsert({
    where: { userId_taskId: { taskId, userId } },
    create: {
      completedAt: parsedInput.data.status === 'DONE' ? now : null,
      status: parsedInput.data.status,
      taskId,
      userId,
    },
    update: {
      completedAt: parsedInput.data.status === 'DONE' ? now : null,
      status: parsedInput.data.status,
    },
  });

  const snapshot = await refreshLessonProgress(task.lessonId, userId, now);

  return context.json(serializeSnapshot(snapshot));
});

progressApp.patch('/api/resources/:resourceId/progress', async (context) => {
  const resourceId = assertIdentifier(context.req.param('resourceId'));
  const parsedInput = resourceStatusSchema.safeParse(
    await parseBody(context.req.raw),
  );

  if (!parsedInput.success) {
    throw invalidRequest();
  }

  const userId = context.get('user').id;
  const prisma = await getPrismaClient();
  const resource = await prisma.resource.findFirst({
    where: {
      id: resourceId,
      lesson: {
        isPublished: true,
        module: {
          isPublished: true,
          stage: { isPublished: true, program: { ownerId: userId } },
        },
      },
    },
  });

  if (!resource) {
    throw notFound();
  }

  const now = new Date();
  await prisma.resourceProgress.upsert({
    where: { userId_resourceId: { resourceId, userId } },
    create: {
      completedAt: parsedInput.data.status === 'COMPLETED' ? now : null,
      resourceId,
      status: parsedInput.data.status,
      userId,
    },
    update: {
      completedAt: parsedInput.data.status === 'COMPLETED' ? now : null,
      status: parsedInput.data.status,
    },
  });

  const snapshot = await refreshLessonProgress(resource.lessonId, userId, now);

  return context.json(serializeSnapshot(snapshot));
});
