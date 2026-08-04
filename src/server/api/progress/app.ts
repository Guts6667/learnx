import { Hono } from 'hono';
import { z } from 'zod';

import { LessonProgressStatus } from '../../../../generated/prisma/client.js';
import {
  calculateTargetEndDate,
  calculateTimelineSnapshot,
} from '../../../lib/timeline.js';
import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import {
  getProgramTimeline,
  getStageTimeline,
} from '../_lib/timeline-progress.js';
import {
  getLessonProgressSnapshot,
  type LessonProgressSnapshot,
  recalculateLessonProgress,
  runSerializableProgressTransaction,
} from '../_lib/progress-recalculation.js';

async function getPrismaClient() {
  const { prisma } = await import('../../prisma.js');

  return prisma;
}

const identifierSchema = z.string().uuid();
const taskStatusSchema = z.object({
  status: z.enum(['TODO', 'DONE', 'SKIPPED']),
});
const resourceStatusSchema = z.object({
  status: z.enum(['NOT_STARTED', 'STARTED', 'COMPLETED']),
});
const scheduleSchema = z.object({
  targetEndAt: z.iso.datetime({ offset: true }),
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

function assertTargetAfterStart(startedAt: Date, targetEndAt: Date): void {
  if (targetEndAt.getTime() <= startedAt.getTime()) {
    throw invalidRequest();
  }
}

function createTimelineResponse(
  actualProgress: number,
  progress: {
    completedAt: Date | null;
    startedAt: Date | null;
    targetEndAt: Date | null;
  },
  now: Date,
) {
  return calculateTimelineSnapshot({
    actualProgress,
    completedAt: progress.completedAt,
    now,
    startedAt: progress.startedAt,
    targetEndAt: progress.targetEndAt,
  });
}

async function getProgressSnapshot(lessonId: string, userId: string) {
  const prisma = await getPrismaClient();
  const snapshot = await getLessonProgressSnapshot(prisma, lessonId, userId);

  if (!snapshot) throw notFound();

  return snapshot;
}

function serializeSnapshot(snapshot: LessonProgressSnapshot) {
  return {
    conceptProgress: Object.fromEntries(snapshot.conceptStatusById),
    exerciseSubmissions: Object.fromEntries(snapshot.exerciseStatusById),
    lessonProgress: {
      completedAt: snapshot.lessonProgress?.completedAt ?? null,
      percent: snapshot.percent,
      startedAt: snapshot.lessonProgress?.startedAt ?? null,
      status: snapshot.lessonProgress?.status ?? LessonProgressStatus.AVAILABLE,
    },
    canComplete: snapshot.canComplete,
    quizPassed: Object.fromEntries(snapshot.quizPassedById),
    resourceProgress: Object.fromEntries(snapshot.resourceStatusById),
    taskCompletions: Object.fromEntries(snapshot.taskStatusById),
  };
}

export const progressApp = new Hono<AuthEnvironment>();

progressApp.use('*', requireUser);

progressApp.onError((error, context) => {
  if (error instanceof ApiError) {
    return context.json(toApiErrorBody(error), error.status);
  }

  if (process.env.LEARNX_INTEGRATION_DATABASE === 'ephemeral') {
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : 'UNKNOWN';
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[integration:progress] ${code}: ${message}`);
  }

  return context.json(
    toApiErrorBody(
      new ApiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500),
    ),
    500,
  );
});

progressApp.post('/api/programs/:programId/start', async (context) => {
  const programId = assertIdentifier(context.req.param('programId'));
  const userId = context.get('user').id;
  const prisma = await getPrismaClient();
  const program = await prisma.program.findFirst({
    where: { id: programId, ownerId: userId, status: 'ACTIVE' },
    select: { estimatedDurationDays: true, id: true },
  });

  if (!program) {
    throw notFound();
  }

  const now = new Date();
  const [currentProgress, timeline] = await Promise.all([
    prisma.programProgress.findUnique({
      where: { userId_programId: { programId, userId } },
    }),
    getProgramTimeline(prisma, programId, userId, now),
  ]);
  const startedAt = currentProgress?.startedAt ?? now;
  const targetEndAt =
    currentProgress?.targetEndAt ??
    calculateTargetEndDate(startedAt, program.estimatedDurationDays);
  const progress = await prisma.programProgress.upsert({
    where: { userId_programId: { programId, userId } },
    create: {
      lastViewedAt: now,
      percent: timeline?.actualPercent ?? 0,
      programId,
      startedAt,
      targetEndAt,
      userId,
    },
    update: {
      lastViewedAt: now,
      percent: timeline?.actualPercent ?? 0,
      startedAt,
      targetEndAt,
    },
  });

  return context.json({
    timeline: createTimelineResponse(progress.percent, progress, now),
  });
});

progressApp.patch('/api/programs/:programId/schedule', async (context) => {
  const programId = assertIdentifier(context.req.param('programId'));
  const parsedInput = scheduleSchema.safeParse(
    await parseBody(context.req.raw),
  );

  if (!parsedInput.success) {
    throw invalidRequest();
  }

  const userId = context.get('user').id;
  const prisma = await getPrismaClient();
  const currentProgress = await prisma.programProgress.findFirst({
    where: { programId, userId, program: { ownerId: userId } },
  });

  if (!currentProgress) {
    throw notFound();
  }

  if (!currentProgress.startedAt) {
    throw new ApiError(
      'TIMELINE_NOT_STARTED',
      'Start this program before changing its target date.',
      409,
    );
  }

  const targetEndAt = new Date(parsedInput.data.targetEndAt);
  assertTargetAfterStart(currentProgress.startedAt, targetEndAt);
  const now = new Date();
  const timeline = await getProgramTimeline(prisma, programId, userId, now);
  const progress = await prisma.programProgress.update({
    where: { userId_programId: { programId, userId } },
    data: { lastViewedAt: now, targetEndAt },
  });

  return context.json({
    timeline: createTimelineResponse(
      timeline?.actualPercent ?? progress.percent,
      progress,
      now,
    ),
  });
});

progressApp.post('/api/stages/:stageId/start', async (context) => {
  const stageId = assertIdentifier(context.req.param('stageId'));
  const userId = context.get('user').id;
  const prisma = await getPrismaClient();
  const stage = await prisma.stage.findFirst({
    where: {
      id: stageId,
      isPublished: true,
      program: { ownerId: userId, status: 'ACTIVE' },
    },
    select: { estimatedDurationDays: true, id: true },
  });

  if (!stage) {
    throw notFound();
  }

  const now = new Date();
  const [currentProgress, timeline] = await Promise.all([
    prisma.stageProgress.findUnique({
      where: { userId_stageId: { stageId, userId } },
    }),
    getStageTimeline(prisma, stageId, userId, now),
  ]);
  const startedAt = currentProgress?.startedAt ?? now;
  const targetEndAt =
    currentProgress?.targetEndAt ??
    calculateTargetEndDate(startedAt, stage.estimatedDurationDays);
  const progress = await prisma.stageProgress.upsert({
    where: { userId_stageId: { stageId, userId } },
    create: {
      lastViewedAt: now,
      percent: timeline?.actualPercent ?? 0,
      stageId,
      startedAt,
      status: 'IN_PROGRESS',
      targetEndAt,
      userId,
    },
    update: {
      lastViewedAt: now,
      percent: timeline?.actualPercent ?? 0,
      startedAt,
      status:
        currentProgress?.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS',
      targetEndAt,
    },
  });

  return context.json({
    status: progress.status,
    timeline: createTimelineResponse(progress.percent, progress, now),
  });
});

progressApp.patch('/api/stages/:stageId/schedule', async (context) => {
  const stageId = assertIdentifier(context.req.param('stageId'));
  const parsedInput = scheduleSchema.safeParse(
    await parseBody(context.req.raw),
  );

  if (!parsedInput.success) {
    throw invalidRequest();
  }

  const userId = context.get('user').id;
  const prisma = await getPrismaClient();
  const currentProgress = await prisma.stageProgress.findFirst({
    where: { stageId, userId, stage: { program: { ownerId: userId } } },
  });

  if (!currentProgress) {
    throw notFound();
  }

  if (!currentProgress.startedAt) {
    throw new ApiError(
      'TIMELINE_NOT_STARTED',
      'Start this stage before changing its target date.',
      409,
    );
  }

  const targetEndAt = new Date(parsedInput.data.targetEndAt);
  assertTargetAfterStart(currentProgress.startedAt, targetEndAt);
  const now = new Date();
  const timeline = await getStageTimeline(prisma, stageId, userId, now);
  const progress = await prisma.stageProgress.update({
    where: { userId_stageId: { stageId, userId } },
    data: { lastViewedAt: now, targetEndAt },
  });

  return context.json({
    status: progress.status,
    timeline: createTimelineResponse(
      timeline?.actualPercent ?? progress.percent,
      progress,
      now,
    ),
  });
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
  const prisma = await getPrismaClient();
  const snapshot = await runSerializableProgressTransaction(
    prisma,
    (transaction) =>
      recalculateLessonProgress(transaction, lessonId, userId, now, {
        requirePublished: true,
      }),
  );

  if (!snapshot) throw notFound();

  return context.json({
    ...serializeSnapshot(snapshot),
  });
});

progressApp.post('/api/lessons/:lessonId/complete', async (context) => {
  const lessonId = assertIdentifier(context.req.param('lessonId'));
  const userId = context.get('user').id;
  const now = new Date();
  const prisma = await getPrismaClient();
  const snapshot = await runSerializableProgressTransaction(
    prisma,
    (transaction) =>
      recalculateLessonProgress(transaction, lessonId, userId, now, {
        completeRequested: true,
        requirePublished: true,
      }),
  );

  if (!snapshot) throw notFound();

  if (!snapshot.canComplete) {
    throw new ApiError(
      'LESSON_NOT_READY',
      'Complete the tracked activities before completing this lesson.',
      409,
    );
  }

  return context.json({
    ...serializeSnapshot(snapshot),
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
  const now = new Date();
  const snapshot = await runSerializableProgressTransaction(
    prisma,
    async (transaction) => {
      const task = await transaction.task.findFirst({
        where: {
          id: taskId,
          isCanonical: true,
          lesson: {
            isPublished: true,
            module: {
              isPublished: true,
              stage: { isPublished: true, program: { ownerId: userId } },
            },
          },
        },
      });

      if (!task) throw notFound();

      await transaction.taskCompletion.upsert({
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

      return recalculateLessonProgress(
        transaction,
        task.lessonId,
        userId,
        now,
        { requirePublished: true },
      );
    },
  );

  if (!snapshot) throw notFound();

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
  const now = new Date();
  const snapshot = await runSerializableProgressTransaction(
    prisma,
    async (transaction) => {
      const resource = await transaction.resource.findFirst({
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

      if (!resource) throw notFound();

      await transaction.resourceProgress.upsert({
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

      return recalculateLessonProgress(
        transaction,
        resource.lessonId,
        userId,
        now,
        { requirePublished: true },
      );
    },
  );

  if (!snapshot) throw notFound();

  return context.json(serializeSnapshot(snapshot));
});
