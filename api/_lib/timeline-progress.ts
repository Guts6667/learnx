import {
  StageProgressStatus,
  type PrismaClient,
} from '../../generated/prisma/client.js';
import {
  calculateTargetEndDate,
  calculateTimelineSnapshot,
  clampPercent,
} from '../../src/lib/timeline.js';

interface ProgressLesson {
  progress: Array<{ percent: number }>;
}

interface ProgressModule {
  lessons: ProgressLesson[];
}

interface ProgressStage {
  modules: ProgressModule[];
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return clampPercent(
    values.reduce((total, value) => total + clampPercent(value), 0) /
      values.length,
  );
}

export function calculateStagePercent(stage: ProgressStage): number {
  return average(
    stage.modules.map((module) =>
      average(module.lessons.map((lesson) => lesson.progress[0]?.percent ?? 0)),
    ),
  );
}

export function calculateProgramPercent(stages: ProgressStage[]): number {
  return average(stages.map(calculateStagePercent));
}

const publishedProgressInclude = (userId: string) => ({
  modules: {
    where: { isPublished: true },
    orderBy: { position: 'asc' as const },
    include: {
      lessons: {
        where: { isPublished: true },
        orderBy: { position: 'asc' as const },
        include: {
          progress: {
            where: { userId },
            select: { percent: true },
          },
        },
      },
    },
  },
});

export async function getStageTimeline(
  prisma: PrismaClient,
  stageId: string,
  userId: string,
  now = new Date(),
) {
  const stage = await prisma.stage.findFirst({
    where: { id: stageId, program: { ownerId: userId } },
    include: {
      ...publishedProgressInclude(userId),
      progress: { where: { userId }, take: 1 },
    },
  });

  if (!stage) {
    return null;
  }

  const progress = stage.progress[0];

  return calculateTimelineSnapshot({
    actualProgress: calculateStagePercent(stage),
    completedAt: progress?.completedAt ?? null,
    now,
    startedAt: progress?.startedAt ?? null,
    targetEndAt: progress?.targetEndAt ?? null,
  });
}

export async function getProgramTimeline(
  prisma: PrismaClient,
  programId: string,
  userId: string,
  now = new Date(),
) {
  const program = await prisma.program.findFirst({
    where: { id: programId, ownerId: userId },
    include: {
      progress: { where: { userId }, take: 1 },
      stages: {
        where: { isPublished: true },
        orderBy: { position: 'asc' },
        include: publishedProgressInclude(userId),
      },
    },
  });

  if (!program) {
    return null;
  }

  const progress = program.progress[0];

  return calculateTimelineSnapshot({
    actualProgress: calculateProgramPercent(program.stages),
    completedAt: progress?.completedAt ?? null,
    now,
    startedAt: progress?.startedAt ?? null,
    targetEndAt: progress?.targetEndAt ?? null,
  });
}

export async function refreshTimelineForLessonActivity(
  prisma: PrismaClient,
  lessonId: string,
  userId: string,
  now: Date,
): Promise<string | null> {
  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      module: { stage: { program: { ownerId: userId } } },
    },
    select: {
      module: {
        select: {
          stage: {
            select: {
              estimatedDurationDays: true,
              id: true,
              programId: true,
              progress: { where: { userId }, take: 1 },
            },
          },
        },
      },
    },
  });

  if (!lesson) {
    return null;
  }

  const stage = lesson.module.stage;
  const [stageTimeline, programTimeline] = await Promise.all([
    getStageTimeline(prisma, stage.id, userId, now),
    getProgramTimeline(prisma, stage.programId, userId, now),
  ]);

  if (!stageTimeline || !programTimeline) {
    return null;
  }

  const currentStageProgress = stage.progress[0];
  const startedAt = currentStageProgress?.startedAt ?? now;
  const targetEndAt =
    currentStageProgress?.targetEndAt ??
    calculateTargetEndDate(startedAt, stage.estimatedDurationDays);

  await prisma.$transaction([
    prisma.stageProgress.upsert({
      where: { userId_stageId: { stageId: stage.id, userId } },
      create: {
        lastViewedAt: now,
        percent: stageTimeline.actualPercent,
        stageId: stage.id,
        startedAt,
        status: StageProgressStatus.IN_PROGRESS,
        targetEndAt,
        userId,
      },
      update: {
        lastViewedAt: now,
        percent: stageTimeline.actualPercent,
        startedAt,
        status:
          currentStageProgress?.status === StageProgressStatus.COMPLETED
            ? StageProgressStatus.COMPLETED
            : StageProgressStatus.IN_PROGRESS,
        targetEndAt,
      },
    }),
    prisma.programProgress.upsert({
      where: { userId_programId: { programId: stage.programId, userId } },
      create: {
        lastViewedAt: now,
        percent: programTimeline.actualPercent,
        programId: stage.programId,
        userId,
      },
      update: {
        lastViewedAt: now,
        percent: programTimeline.actualPercent,
      },
    }),
  ]);

  return stage.id;
}
