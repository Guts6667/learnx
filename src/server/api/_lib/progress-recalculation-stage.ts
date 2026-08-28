import {
  ConceptProgressStatus,
  ExerciseSubmissionStatus,
  type Prisma,
  StageAssessmentSubmissionStatus,
  StageProgressStatus,
  TaskCompletionStatus,
} from '../../../../generated/prisma/client.js';
import { calculateStageValidation } from '../../../lib/stage-validation.js';
import { calculateTargetEndDate } from '../../../lib/timeline.js';
import { calculateStagePercent } from './timeline-progress.js';
import {
  readLessonState,
  toLessonSnapshot,
} from './progress-recalculation-lesson-snapshot.js';
import { recalculateProgramProgress } from './progress-recalculation-program.js';
import type { LessonProgressSnapshot } from './progress-recalculation-types.js';

function assessmentSelection(userId: string) {
  return {
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
  } as const;
}

function stageLessonSelection(userId: string) {
  return {
    where: { isPublished: true },
    select: {
      id: true,
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
        where: { isCanonical: true, isRequired: true },
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
      exercises: {
        where: { isCanonical: true, isRequired: true },
        select: { id: true, title: true },
      },
    },
  } as const;
}

function readStageState(
  transaction: Prisma.TransactionClient,
  stageId: string,
  userId: string,
) {
  return transaction.stage.findUnique({
    where: { id: stageId },
    select: {
      assessments: assessmentSelection(userId),
      estimatedDurationDays: true,
      modules: {
        where: { isPublished: true },
        select: { lessons: stageLessonSelection(userId) },
      },
      progress: { where: { userId }, take: 1 },
    },
  });
}

type StageState = NonNullable<Awaited<ReturnType<typeof readStageState>>>;

async function completeLessonSnapshots(
  transaction: Prisma.TransactionClient,
  stage: StageState,
  userId: string,
  known: ReadonlyMap<string, LessonProgressSnapshot>,
) {
  const snapshots = new Map(known);
  for (const module of stage.modules) {
    for (const lesson of module.lessons) {
      if (snapshots.has(lesson.id)) continue;
      const state = await readLessonState(
        transaction,
        lesson.id,
        userId,
        false,
      );
      if (state) snapshots.set(lesson.id, toLessonSnapshot(state));
    }
  }
  return snapshots;
}

function flattenStageItems(stage: StageState) {
  return {
    concepts: stage.modules.flatMap((module) =>
      module.lessons.flatMap((lesson) => lesson.concepts),
    ),
    exercises: stage.modules.flatMap((module) =>
      module.lessons.flatMap((lesson) =>
        (lesson.exercises ?? []).map((item) => ({
          ...item,
          lessonId: lesson.id,
        })),
      ),
    ),
    tasks: stage.modules.flatMap((module) =>
      module.lessons.flatMap((lesson) =>
        lesson.tasks.map((item) => ({ ...item, lessonId: lesson.id })),
      ),
    ),
  };
}

function validateStage(
  stage: StageState,
  snapshots: ReadonlyMap<string, LessonProgressSnapshot>,
) {
  const { concepts, exercises, tasks } = flattenStageItems(stage);
  return calculateStageValidation({
    currentStatus: stage.progress[0]?.status ?? StageProgressStatus.AVAILABLE,
    finalAssessments: stage.assessments.map((item) => ({
      id: item.id,
      isValidated:
        item.submissions[0]?.status ===
        StageAssessmentSubmissionStatus.VALIDATED,
      title: item.title,
    })),
    hasStarted: true,
    requiredConcepts: concepts.map((item) => ({
      id: item.id,
      isValidated: item.progress[0]?.status === ConceptProgressStatus.VALIDATED,
      title: item.title,
    })),
    requiredExercises: exercises.map((item) => ({
      id: item.id,
      isValidated:
        snapshots.get(item.lessonId)?.exerciseStatusById.get(item.id) ===
        ExerciseSubmissionStatus.SUBMITTED,
      title: item.title,
    })),
    requiredTasks: tasks.map((item) => ({
      id: item.id,
      isValidated:
        snapshots.get(item.lessonId)?.taskStatusById.get(item.id) ===
        TaskCompletionStatus.DONE,
      title: item.title,
    })),
  });
}

async function persistStageProgress(
  transaction: Prisma.TransactionClient,
  stageId: string,
  userId: string,
  stage: StageState,
  snapshots: ReadonlyMap<string, LessonProgressSnapshot>,
  now: Date,
  preserveTimestamps: boolean,
) {
  const current = stage.progress[0];
  const validation = validateStage(stage, snapshots);
  const percent = calculateStagePercent(stage);
  const startedAt = current?.startedAt ?? now;
  const completedAt = validation.isValidated
    ? (current?.completedAt ?? now)
    : null;
  await transaction.stageProgress.upsert({
    where: { userId_stageId: { stageId, userId } },
    create: {
      completedAt,
      lastViewedAt: now,
      percent,
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
      ...(preserveTimestamps ? {} : { lastViewedAt: now }),
      percent,
      startedAt,
      status: validation.status,
    },
  });
}

export async function recalculateStageAndProgram(
  transaction: Prisma.TransactionClient,
  stageId: string,
  programId: string,
  userId: string,
  now: Date,
  known: ReadonlyMap<string, LessonProgressSnapshot> = new Map(),
  preserveTimestamps = false,
): Promise<void> {
  const stage = await readStageState(transaction, stageId, userId);
  if (!stage) return;
  const snapshots = await completeLessonSnapshots(
    transaction,
    stage,
    userId,
    known,
  );
  await persistStageProgress(
    transaction,
    stageId,
    userId,
    stage,
    snapshots,
    now,
    preserveTimestamps,
  );
  await recalculateProgramProgress(
    transaction,
    programId,
    userId,
    now,
    preserveTimestamps,
  );
}
