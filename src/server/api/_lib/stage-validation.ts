import {
  CanonicalActivityKind,
  ConceptProgressStatus,
  ExerciseSubmissionStatus,
  StageAssessmentSubmissionStatus,
  StageProgressStatus,
  TaskCompletionStatus,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import {
  calculateStageValidation,
  type StageValidationInput,
  type StageValidationResult,
} from '../../../lib/stage-validation.js';
import { calculateTargetEndDate } from '../../../lib/timeline.js';
import { getCurrentModuleRun } from './module-runs.js';
import {
  learningProgramWhere,
  previewProgramWhere,
} from './program-access-policy.js';

interface StageValidationOptions {
  preview?: boolean;
}

async function readStageValidationState(
  prisma: PrismaClient,
  stageId: string,
  userId: string,
  options: StageValidationOptions = {},
) {
  const preview = options.preview === true;
  const publicationFilter = preview ? {} : { isPublished: true };
  const stage = await prisma.stage.findFirst({
    where: {
      id: stageId,
      ...publicationFilter,
      program: preview
        ? previewProgramWhere(userId)
        : learningProgramWhere(userId),
    },
    select: {
      assessments: {
        where: { isRequired: true },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          title: true,
          submissions: {
            where: { userId },
            take: 1,
            select: { status: true },
          },
        },
      },
      estimatedDurationDays: true,
      modules: {
        where: publicationFilter,
        orderBy: { position: 'asc' },
        select: {
          id: true,
          lessons: {
            where: publicationFilter,
            orderBy: { position: 'asc' },
            select: {
              id: true,
              concepts: {
                where: { isRequired: true },
                orderBy: { position: 'asc' },
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
              tasks: {
                where: { isCanonical: true, isRequired: true },
                orderBy: { position: 'asc' },
                select: {
                  completions: {
                    where: { userId },
                    take: 1,
                    select: { status: true },
                  },
                  id: true,
                  key: true,
                  title: true,
                },
              },
              exercises: {
                where: { isCanonical: true, isRequired: true },
                orderBy: { position: 'asc' },
                select: { id: true, key: true, title: true },
              },
            },
          },
        },
      },
      progress: { where: { userId }, take: 1 },
    },
  });

  if (!stage) return null;

  const currentRuns = await Promise.all(
    stage.modules.map((module) =>
      getCurrentModuleRun(prisma, module.id, userId),
    ),
  );
  const currentRunIds = currentRuns.flatMap((run) => (run ? [run.id] : []));
  const [exerciseSubmissions, carryovers] = await Promise.all([
    currentRunIds.length > 0
      ? prisma.exerciseSubmission.findMany({
          where: {
            moduleRunId: { in: currentRunIds },
            status: ExerciseSubmissionStatus.SUBMITTED,
            userId,
          },
          select: { exerciseId: true },
        })
      : [],
    currentRunIds.length > 0
      ? prisma.activityCompletionCarryover.findMany({
          where: { moduleRunId: { in: currentRunIds }, userId },
          select: { activityKey: true, kind: true, lessonId: true },
        })
      : [],
  ]);
  const submittedExerciseIds = new Set(
    exerciseSubmissions.map((submission) => submission.exerciseId),
  );
  const taskCarryovers = new Set(
    carryovers
      .filter((item) => item.kind === CanonicalActivityKind.TASK)
      .map((item) => `${item.lessonId}:${item.activityKey}`),
  );
  const exerciseCarryovers = new Set(
    carryovers
      .filter((item) => item.kind === CanonicalActivityKind.EXERCISE)
      .map((item) => `${item.lessonId}:${item.activityKey}`),
  );

  const progress = stage.progress[0];
  const concepts = stage.modules.flatMap((module) =>
    module.lessons.flatMap((lesson) => lesson.concepts),
  );
  const tasks = stage.modules.flatMap((module) =>
    module.lessons.flatMap((lesson) =>
      lesson.tasks.map((task) => ({ ...task, lessonId: lesson.id })),
    ),
  );
  const exercises = stage.modules.flatMap((module) =>
    module.lessons.flatMap((lesson) =>
      lesson.exercises.map((exercise) => ({
        ...exercise,
        lessonId: lesson.id,
      })),
    ),
  );
  const hasActivity =
    concepts.some((concept) => concept.progress.length > 0) ||
    tasks.some((task) => task.completions.length > 0) ||
    exerciseSubmissions.length > 0 ||
    carryovers.length > 0 ||
    stage.assessments.some((assessment) => assessment.submissions.length > 0);
  const input: StageValidationInput = {
    currentStatus: progress?.status ?? StageProgressStatus.AVAILABLE,
    finalAssessments: stage.assessments.map((assessment) => ({
      id: assessment.id,
      isValidated:
        assessment.submissions[0]?.status ===
        StageAssessmentSubmissionStatus.VALIDATED,
      title: assessment.title,
    })),
    hasStarted:
      progress?.startedAt !== null && progress?.startedAt !== undefined
        ? true
        : hasActivity,
    requiredConcepts: concepts.map((concept) => ({
      id: concept.id,
      isValidated:
        concept.progress[0]?.status === ConceptProgressStatus.VALIDATED,
      title: concept.title,
    })),
    requiredExercises: exercises.map((exercise) => ({
      id: exercise.id,
      isValidated:
        submittedExerciseIds.has(exercise.id) ||
        exerciseCarryovers.has(`${exercise.lessonId}:${exercise.key}`),
      title: exercise.title,
    })),
    requiredTasks: tasks.map((task) => ({
      id: task.id,
      isValidated:
        task.completions[0]?.status === TaskCompletionStatus.DONE ||
        taskCarryovers.has(`${task.lessonId}:${task.key}`),
      title: task.title,
    })),
  };

  return {
    estimatedDurationDays: stage.estimatedDurationDays,
    progress,
    validation: calculateStageValidation(input),
  };
}

export async function getStageValidation(
  prisma: PrismaClient,
  stageId: string,
  userId: string,
  options: StageValidationOptions = {},
): Promise<StageValidationResult | null> {
  const state = await readStageValidationState(
    prisma,
    stageId,
    userId,
    options,
  );

  return state?.validation ?? null;
}

export async function refreshStageValidation(
  prisma: PrismaClient,
  stageId: string,
  userId: string,
  now: Date,
): Promise<StageValidationResult | null> {
  const state = await readStageValidationState(prisma, stageId, userId);

  if (!state) return null;

  const status =
    state.validation.status === StageProgressStatus.AVAILABLE
      ? StageProgressStatus.IN_PROGRESS
      : state.validation.status;
  const startedAt = state.progress?.startedAt ?? now;
  const completedAt =
    status === StageProgressStatus.COMPLETED
      ? (state.progress?.completedAt ?? now)
      : null;

  await prisma.stageProgress.upsert({
    where: { userId_stageId: { stageId, userId } },
    create: {
      completedAt,
      lastViewedAt: now,
      percent: state.progress?.percent ?? 0,
      stageId,
      startedAt,
      status,
      targetEndAt:
        state.progress?.targetEndAt ??
        calculateTargetEndDate(startedAt, state.estimatedDurationDays),
      userId,
    },
    update: { completedAt, lastViewedAt: now, status },
  });

  return { ...state.validation, status };
}
