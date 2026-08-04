import {
  ConceptProgressStatus,
  ExerciseSubmissionStatus,
  LessonProgressStatus,
  Prisma,
  type PrismaClient,
  ResourceProgressStatus,
  StageAssessmentSubmissionStatus,
  StageProgressStatus,
  TaskCompletionStatus,
} from '../../../../generated/prisma/client.js';
import { calculateLessonProgress } from '../../../lib/progress.js';
import { calculateStageValidation } from '../../../lib/stage-validation.js';
import { calculateTargetEndDate } from '../../../lib/timeline.js';
import {
  calculateProgramPercent,
  calculateStagePercent,
} from './timeline-progress.js';

const MAX_TRANSACTION_ATTEMPTS = 3;

export interface LessonProgressSnapshot {
  canComplete: boolean;
  conceptStatusById: Map<string, ConceptProgressStatus>;
  exerciseStatusById: Map<string, ExerciseSubmissionStatus>;
  lessonProgress: {
    completedAt: Date | null;
    percent: number;
    startedAt: Date | null;
    status: LessonProgressStatus;
  } | null;
  percent: number;
  quizPassedById: Map<string, boolean>;
  resourceStatusById: Map<string, ResourceProgressStatus>;
  taskStatusById: Map<string, TaskCompletionStatus>;
}

interface RecalculationOptions {
  completeRequested?: boolean;
  requirePublished?: boolean;
  startIfMissing?: boolean;
}

function isRetryableTransactionError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2034'
  );
}

export async function runSerializableProgressTransaction<T>(
  prisma: PrismaClient,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        !isRetryableTransactionError(error) ||
        attempt === MAX_TRANSACTION_ATTEMPTS
      ) {
        throw error;
      }
    }
  }

  throw new Error('Progress transaction retry limit reached.');
}

async function readLessonState(
  prisma: Prisma.TransactionClient | PrismaClient,
  lessonId: string,
  userId: string,
  requirePublished: boolean,
) {
  const publicationFilter = requirePublished ? { isPublished: true } : {};

  return prisma.lesson.findFirst({
    where: {
      id: lessonId,
      ...publicationFilter,
      module: {
        ...publicationFilter,
        stage: {
          ...publicationFilter,
          ...(requirePublished
            ? {
                progress: {
                  none: { status: StageProgressStatus.LOCKED, userId },
                },
              }
            : {}),
          program: { ownerId: userId },
        },
      },
    },
    select: {
      concepts: {
        where: { isRequired: true },
        select: {
          id: true,
          progress: {
            where: { userId },
            take: 1,
            select: { status: true },
          },
        },
      },
      exercises: {
        where: { isRequired: true },
        select: {
          id: true,
          submissions: {
            where: { userId },
            take: 1,
            select: { status: true },
          },
        },
      },
      isPublished: true,
      module: {
        select: {
          isPublished: true,
          stage: {
            select: {
              estimatedDurationDays: true,
              id: true,
              isPublished: true,
              programId: true,
            },
          },
        },
      },
      progress: { where: { userId }, take: 1 },
      quizzes: {
        where: { isRequired: true },
        select: {
          id: true,
          _count: { select: { attempts: { where: { userId } } } },
          attempts: {
            where: { passed: true, userId },
            take: 1,
            select: { id: true },
          },
        },
      },
      resources: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          isRequired: true,
          progress: {
            where: { userId },
            take: 1,
            select: { status: true },
          },
        },
      },
      tasks: {
        orderBy: { position: 'asc' },
        select: {
          completions: {
            where: { userId },
            take: 1,
            select: { status: true },
          },
          id: true,
          isRequired: true,
        },
      },
    },
  });
}

function toLessonSnapshot(
  lesson: NonNullable<Awaited<ReturnType<typeof readLessonState>>>,
): LessonProgressSnapshot {
  const result = calculateLessonProgress({
    requiredConcepts: lesson.concepts.map(
      (concept) =>
        concept.progress[0]?.status === ConceptProgressStatus.VALIDATED,
    ),
    requiredExercises: lesson.exercises.map(
      (exercise) =>
        exercise.submissions[0]?.status === ExerciseSubmissionStatus.SUBMITTED,
    ),
    requiredQuizzes: lesson.quizzes.map((quiz) => quiz.attempts.length > 0),
    requiredResources: lesson.resources
      .filter((resource) => resource.isRequired)
      .map(
        (resource) =>
          resource.progress[0]?.status === ResourceProgressStatus.COMPLETED,
      ),
    requiredTasks: lesson.tasks
      .filter((task) => task.isRequired)
      .map((task) => task.completions[0]?.status === TaskCompletionStatus.DONE),
  });

  return {
    ...result,
    conceptStatusById: new Map(
      lesson.concepts.flatMap((concept) =>
        concept.progress[0]
          ? [[concept.id, concept.progress[0].status] as const]
          : [],
      ),
    ),
    exerciseStatusById: new Map(
      lesson.exercises.flatMap((exercise) =>
        exercise.submissions[0]
          ? [[exercise.id, exercise.submissions[0].status] as const]
          : [],
      ),
    ),
    lessonProgress: lesson.progress[0] ?? null,
    quizPassedById: new Map(
      lesson.quizzes.map((quiz) => [quiz.id, quiz.attempts.length > 0]),
    ),
    resourceStatusById: new Map(
      lesson.resources.flatMap((resource) =>
        resource.progress[0]
          ? [[resource.id, resource.progress[0].status] as const]
          : [],
      ),
    ),
    taskStatusById: new Map(
      lesson.tasks.flatMap((task) =>
        task.completions[0]
          ? [[task.id, task.completions[0].status] as const]
          : [],
      ),
    ),
  };
}

export async function getLessonProgressSnapshot(
  prisma: PrismaClient,
  lessonId: string,
  userId: string,
): Promise<LessonProgressSnapshot | null> {
  const lesson = await readLessonState(prisma, lessonId, userId, true);

  return lesson ? toLessonSnapshot(lesson) : null;
}

async function refreshStageAndProgram(
  transaction: Prisma.TransactionClient,
  stageId: string,
  programId: string,
  userId: string,
  now: Date,
) {
  const stage = await transaction.stage.findUnique({
    where: { id: stageId },
    select: {
      assessments: {
        where: { isRequired: true },
        select: {
          id: true,
          submissions: {
            where: { userId },
            take: 1,
            select: { status: true },
          },
          title: true,
        },
      },
      estimatedDurationDays: true,
      modules: {
        where: { isPublished: true },
        select: {
          lessons: {
            where: { isPublished: true },
            select: {
              concepts: {
                where: { isRequired: true },
                select: {
                  id: true,
                  progress: {
                    where: { userId },
                    take: 1,
                    select: { status: true },
                  },
                  title: true,
                },
              },
              progress: {
                where: { userId },
                take: 1,
                select: { percent: true },
              },
              tasks: {
                where: { isRequired: true },
                select: {
                  completions: {
                    where: { userId },
                    take: 1,
                    select: { status: true },
                  },
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
      },
      progress: { where: { userId }, take: 1 },
    },
  });

  if (!stage) return;

  const stageProgress = stage.progress[0];
  const concepts = stage.modules.flatMap((module) =>
    module.lessons.flatMap((lesson) => lesson.concepts),
  );
  const tasks = stage.modules.flatMap((module) =>
    module.lessons.flatMap((lesson) => lesson.tasks),
  );
  const validation = calculateStageValidation({
    currentStatus: stageProgress?.status ?? StageProgressStatus.AVAILABLE,
    finalAssessments: stage.assessments.map((assessment) => ({
      id: assessment.id,
      isValidated:
        assessment.submissions[0]?.status ===
        StageAssessmentSubmissionStatus.VALIDATED,
      title: assessment.title,
    })),
    hasStarted: true,
    requiredConcepts: concepts.map((concept) => ({
      id: concept.id,
      isValidated:
        concept.progress[0]?.status === ConceptProgressStatus.VALIDATED,
      title: concept.title,
    })),
    requiredTasks: tasks.map((task) => ({
      id: task.id,
      isValidated: task.completions[0]?.status === TaskCompletionStatus.DONE,
      title: task.title,
    })),
  });
  const stagePercent = calculateStagePercent(stage);
  const startedAt = stageProgress?.startedAt ?? now;
  const completedAt = validation.isValidated
    ? (stageProgress?.completedAt ?? now)
    : null;

  await transaction.stageProgress.upsert({
    where: { userId_stageId: { stageId, userId } },
    create: {
      completedAt,
      lastViewedAt: now,
      percent: stagePercent,
      stageId,
      startedAt,
      status: validation.status,
      targetEndAt: calculateTargetEndDate(
        startedAt,
        stage.estimatedDurationDays,
      ),
      userId,
    },
    update: {
      completedAt,
      lastViewedAt: now,
      percent: stagePercent,
      startedAt,
      status: validation.status,
    },
  });

  const program = await transaction.program.findUnique({
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

  if (!program) return;

  await transaction.programProgress.upsert({
    where: { userId_programId: { programId, userId } },
    create: {
      lastViewedAt: now,
      percent: calculateProgramPercent(program.stages),
      programId,
      userId,
    },
    update: {
      lastViewedAt: now,
      percent: calculateProgramPercent(program.stages),
    },
  });
}

export async function recalculateLessonProgress(
  transaction: Prisma.TransactionClient,
  lessonId: string,
  userId: string,
  now: Date,
  options: RecalculationOptions = {},
): Promise<LessonProgressSnapshot | null> {
  const lesson = await readLessonState(
    transaction,
    lessonId,
    userId,
    options.requirePublished ?? false,
  );

  if (!lesson) return null;

  const snapshot = toLessonSnapshot(lesson);
  const currentProgress = snapshot.lessonProgress;
  const shouldComplete = options.completeRequested === true;
  const hasActivity =
    lesson.concepts.some((concept) => concept.progress.length > 0) ||
    lesson.exercises.some((exercise) => exercise.submissions.length > 0) ||
    lesson.quizzes.some((quiz) => quiz._count.attempts > 0) ||
    lesson.resources.some((resource) => resource.progress.length > 0) ||
    lesson.tasks.some((task) => task.completions.length > 0);

  if (shouldComplete && !snapshot.canComplete) return snapshot;
  if (!currentProgress && !hasActivity && options.startIfMissing === false) {
    return snapshot;
  }

  const remainsCompleted =
    currentProgress?.status === LessonProgressStatus.COMPLETED &&
    snapshot.canComplete;
  const status =
    shouldComplete || remainsCompleted
      ? LessonProgressStatus.COMPLETED
      : LessonProgressStatus.IN_PROGRESS;
  const persistedPercent =
    status === LessonProgressStatus.COMPLETED ? 100 : snapshot.percent;
  const completedAt =
    status === LessonProgressStatus.COMPLETED
      ? (currentProgress?.completedAt ?? now)
      : null;
  const lessonProgress = await transaction.lessonProgress.upsert({
    where: { userId_lessonId: { lessonId, userId } },
    create: {
      completedAt,
      lastViewedAt: now,
      lessonId,
      percent: persistedPercent,
      startedAt: now,
      status,
      userId,
    },
    update: {
      completedAt,
      lastViewedAt: now,
      percent: persistedPercent,
      startedAt: currentProgress?.startedAt ?? now,
      status,
    },
  });

  if (
    lesson.isPublished &&
    lesson.module.isPublished &&
    lesson.module.stage.isPublished
  ) {
    await refreshStageAndProgram(
      transaction,
      lesson.module.stage.id,
      lesson.module.stage.programId,
      userId,
      now,
    );
  }

  return { ...snapshot, lessonProgress, percent: persistedPercent };
}
