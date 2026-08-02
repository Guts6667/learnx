import {
  ConceptProgressStatus,
  ProgramStatus,
  StageAssessmentSubmissionStatus,
  StageProgressStatus,
  TaskCompletionStatus,
  type PrismaClient,
} from '../../generated/prisma/client.js';
import {
  calculateStageValidation,
  type StageValidationInput,
  type StageValidationResult,
} from '../../src/lib/stage-validation.js';
import { calculateTargetEndDate } from '../../src/lib/timeline.js';

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
      program: {
        ownerId: userId,
        status: preview
          ? { in: [ProgramStatus.ACTIVE, ProgramStatus.DRAFT] }
          : ProgramStatus.ACTIVE,
      },
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
          lessons: {
            where: publicationFilter,
            orderBy: { position: 'asc' },
            select: {
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
                where: { isRequired: true },
                orderBy: { position: 'asc' },
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

  if (!stage) return null;

  const progress = stage.progress[0];
  const concepts = stage.modules.flatMap((module) =>
    module.lessons.flatMap((lesson) => lesson.concepts),
  );
  const tasks = stage.modules.flatMap((module) =>
    module.lessons.flatMap((lesson) => lesson.tasks),
  );
  const hasActivity =
    concepts.some((concept) => concept.progress.length > 0) ||
    tasks.some((task) => task.completions.length > 0) ||
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
    requiredTasks: tasks.map((task) => ({
      id: task.id,
      isValidated: task.completions[0]?.status === TaskCompletionStatus.DONE,
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
