import {
  CanonicalActivityKind,
  ConceptProgressStatus,
  ExerciseSubmissionStatus,
  ResourceProgressStatus,
  StageProgressStatus,
  TaskCompletionStatus,
} from '../../../../generated/prisma/client.js';
import { calculateLessonProgress } from '../../../lib/progress.js';
import { getCurrentModuleRun } from './module-runs.js';
import {
  learningOrPreviewProgramWhere,
  learningProgramWhere,
} from './program-access-policy.js';
import type {
  LessonProgressSnapshot,
  ProgressReadClient,
} from './progress-recalculation-types.js';

const MISSING_MODULE_RUN_ID = '00000000-0000-0000-0000-000000000000';
type RunFilter = { moduleRunId: string } | { moduleRunId: { equals: string } };

function activityCarryoverSelection(userId: string, runFilter: RunFilter) {
  return {
    where: { ...runFilter, userId },
    select: { activityKey: true, kind: true },
  } as const;
}

function conceptSelection(userId: string) {
  return {
    where: { isRequired: true },
    select: {
      id: true,
      progress: {
        where: { userId },
        take: 1,
        select: { status: true },
      },
    },
  } as const;
}

function exerciseSelection(userId: string, runFilter: RunFilter) {
  return {
    where: { isCanonical: true, isRequired: true },
    select: {
      id: true,
      key: true,
      submissions: {
        where: { ...runFilter, userId },
        take: 1,
        select: { status: true },
      },
    },
  } as const;
}

function quizSelection(userId: string, runFilter: RunFilter) {
  return {
    where: { isRequired: true },
    select: {
      id: true,
      _count: { select: { attempts: { where: { ...runFilter, userId } } } },
      attempts: {
        where: { ...runFilter, passed: true, userId },
        take: 1,
        select: { id: true },
      },
    },
  } as const;
}

function resourceSelection(userId: string) {
  return {
    orderBy: { position: 'asc' as const },
    select: {
      id: true,
      isRequired: true,
      progress: {
        where: { userId },
        take: 1,
        select: { status: true },
      },
    },
  } as const;
}

function taskSelection(userId: string) {
  return {
    where: { isCanonical: true },
    orderBy: { position: 'asc' as const },
    select: {
      completions: {
        where: { userId },
        take: 1,
        select: { status: true },
      },
      id: true,
      isRequired: true,
      key: true,
    },
  } as const;
}

function lessonProgressSelection(userId: string) {
  return {
    where: { userId },
    take: 1,
    include: {
      currentSequenceItem: {
        select: {
          conceptAssessmentId: true,
          contentBlockId: true,
          exerciseId: true,
          kind: true,
          quizId: true,
          resourceId: true,
          taskId: true,
        },
      },
    },
  } as const;
}

async function findLessonModule(
  client: ProgressReadClient,
  lessonId: string,
  userId: string,
  requirePublished: boolean,
) {
  const published = requirePublished ? { isPublished: true } : {};
  const program = requirePublished
    ? learningProgramWhere(userId)
    : learningOrPreviewProgramWhere(userId, true);
  return client.lesson.findFirst({
    where: {
      id: lessonId,
      ...published,
      module: { ...published, stage: { ...published, program } },
    },
    select: { moduleId: true },
  });
}

function lessonAccessWhere(
  lessonId: string,
  userId: string,
  requirePublished: boolean,
) {
  const published = requirePublished ? { isPublished: true } : {};
  const program = requirePublished
    ? learningProgramWhere(userId)
    : learningOrPreviewProgramWhere(userId, true);
  return {
    id: lessonId,
    ...published,
    module: {
      ...published,
      stage: {
        ...published,
        ...(requirePublished
          ? {
              progress: {
                none: { status: StageProgressStatus.LOCKED, userId },
              },
            }
          : {}),
        program,
      },
    },
  } as const;
}

export async function readLessonState(
  client: ProgressReadClient,
  lessonId: string,
  userId: string,
  requirePublished: boolean,
) {
  const context = await findLessonModule(
    client,
    lessonId,
    userId,
    requirePublished,
  );
  if (!context) return null;
  const currentRun = await getCurrentModuleRun(
    client,
    context.moduleId,
    userId,
  );
  const runFilter: RunFilter = currentRun
    ? { moduleRunId: currentRun.id }
    : { moduleRunId: { equals: MISSING_MODULE_RUN_ID } };
  return client.lesson.findFirst({
    where: lessonAccessWhere(lessonId, userId, requirePublished),
    select: {
      activityCompletionCarryovers: activityCarryoverSelection(
        userId,
        runFilter,
      ),
      concepts: conceptSelection(userId),
      exercises: exerciseSelection(userId, runFilter),
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
      progress: lessonProgressSelection(userId),
      quizzes: quizSelection(userId, runFilter),
      resources: resourceSelection(userId),
      tasks: taskSelection(userId),
    },
  });
}

type LessonState = NonNullable<Awaited<ReturnType<typeof readLessonState>>>;

function getCarryovers(lesson: LessonState, kind: CanonicalActivityKind) {
  return new Set(
    (lesson.activityCompletionCarryovers ?? [])
      .filter((item) => item.kind === kind)
      .map((item) => item.activityKey),
  );
}

function getProgressCalculation(lesson: LessonState) {
  const taskCarryovers = getCarryovers(lesson, CanonicalActivityKind.TASK);
  const exerciseCarryovers = getCarryovers(
    lesson,
    CanonicalActivityKind.EXERCISE,
  );
  return calculateLessonProgress({
    requiredConcepts: lesson.concepts.map(
      (concept) =>
        concept.progress[0]?.status === ConceptProgressStatus.VALIDATED,
    ),
    requiredExercises: lesson.exercises.map(
      (exercise) =>
        exercise.submissions[0]?.status ===
          ExerciseSubmissionStatus.SUBMITTED ||
        exerciseCarryovers.has(exercise.key),
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
      .map(
        (task) =>
          task.completions[0]?.status === TaskCompletionStatus.DONE ||
          taskCarryovers.has(task.key),
      ),
  });
}

export function toLessonSnapshot(lesson: LessonState): LessonProgressSnapshot {
  const taskCarryovers = getCarryovers(lesson, CanonicalActivityKind.TASK);
  const exerciseCarryovers = getCarryovers(
    lesson,
    CanonicalActivityKind.EXERCISE,
  );
  return {
    ...getProgressCalculation(lesson),
    conceptStatusById: new Map(
      lesson.concepts.flatMap((item) =>
        item.progress[0] ? [[item.id, item.progress[0].status] as const] : [],
      ),
    ),
    exerciseStatusById: new Map(
      lesson.exercises.flatMap((item) =>
        item.submissions[0]
          ? [[item.id, item.submissions[0].status] as const]
          : exerciseCarryovers.has(item.key)
            ? [[item.id, ExerciseSubmissionStatus.SUBMITTED] as const]
            : [],
      ),
    ),
    lessonProgress: lesson.progress[0] ?? null,
    quizPassedById: new Map(
      lesson.quizzes.map((item) => [item.id, item.attempts.length > 0]),
    ),
    resourceStatusById: new Map(
      lesson.resources.flatMap((item) =>
        item.progress[0] ? [[item.id, item.progress[0].status] as const] : [],
      ),
    ),
    taskStatusById: new Map(
      lesson.tasks.flatMap((item) =>
        item.completions[0]
          ? [[item.id, item.completions[0].status] as const]
          : taskCarryovers.has(item.key)
            ? [[item.id, TaskCompletionStatus.DONE] as const]
            : [],
      ),
    ),
  };
}

export async function getLessonProgressSnapshot(
  client: ProgressReadClient,
  lessonId: string,
  userId: string,
): Promise<LessonProgressSnapshot | null> {
  const lesson = await readLessonState(client, lessonId, userId, true);
  return lesson ? toLessonSnapshot(lesson) : null;
}
