import {
  ConceptProgressStatus,
  LessonProgressStatus,
  ResourceProgressStatus,
  ReviewStatus,
  StageProgressStatus,
  TaskCompletionStatus,
  type Prisma,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import { getCurrentModuleRun } from '../_lib/module-runs.js';
import { learningProgramWhere } from '../_lib/program-access-policy.js';
import { runSerializableProgressTransaction } from '../_lib/progress-recalculation.js';
import type {
  ProgramRestartPreview,
  ProgramRestartRepository,
} from './types.js';
import { isUniqueConstraintError } from './validation.js';

async function readRestartableProgram(
  client: Prisma.TransactionClient | PrismaClient,
  programId: string,
  userId: string,
) {
  return client.program.findFirst({
    where: { id: programId, ...learningProgramWhere(userId) },
    select: {
      id: true,
      title: true,
      stages: {
        where: { isPublished: true },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          modules: {
            where: { isPublished: true },
            orderBy: { position: 'asc' },
            select: {
              id: true,
              lessons: {
                where: { isPublished: true },
                orderBy: { position: 'asc' },
                select: { id: true, slug: true, title: true },
              },
            },
          },
        },
      },
    },
  });
}

async function buildProgramPreview(
  client: Prisma.TransactionClient | PrismaClient,
  programId: string,
  userId: string,
): Promise<ProgramRestartPreview | null> {
  const program = await readRestartableProgram(client, programId, userId);
  if (!program) return null;
  const modules = program.stages.flatMap((stage) => stage.modules);
  const currentRuns = await Promise.all(
    modules.map((module) => getCurrentModuleRun(client, module.id, userId)),
  );
  const currentRunIds = currentRuns.flatMap((run) => (run ? [run.id] : []));
  const programLessonWhere = { module: { stage: { programId } } } as const;
  const [
    lessons,
    tasks,
    resources,
    concepts,
    quizzes,
    exercises,
    quizAttempts,
    conceptAttempts,
    exerciseSubmissions,
    notes,
    stageAssessmentSubmissions,
  ] = await Promise.all([
    client.lessonProgress.count({
      where: { lesson: programLessonWhere, userId },
    }),
    client.taskCompletion.count({
      where: {
        task: { isCanonical: true, lesson: programLessonWhere },
        userId,
      },
    }),
    client.resourceProgress.count({
      where: { resource: { lesson: programLessonWhere }, userId },
    }),
    client.conceptProgress.count({
      where: { concept: { lesson: programLessonWhere }, userId },
    }),
    currentRunIds.length
      ? client.quizAttempt.findMany({
          where: {
            moduleRunId: { in: currentRunIds },
            passed: true,
            quiz: { lesson: programLessonWhere },
            userId,
          },
          distinct: ['quizId'],
          select: { quizId: true },
        })
      : Promise.resolve([]),
    currentRunIds.length
      ? client.exerciseSubmission.count({
          where: {
            exercise: { isCanonical: true, lesson: programLessonWhere },
            moduleRunId: { in: currentRunIds },
            userId,
          },
        })
      : Promise.resolve(0),
    client.quizAttempt.count({
      where: { quiz: { lesson: programLessonWhere }, userId },
    }),
    client.conceptAssessmentAttempt.count({
      where: {
        assessment: { concept: { lesson: programLessonWhere } },
        userId,
      },
    }),
    client.exerciseSubmission.count({
      where: { exercise: { lesson: programLessonWhere }, userId },
    }),
    client.note.count({ where: { lesson: programLessonWhere, userId } }),
    client.stageAssessmentSubmission.count({
      where: { stageAssessment: { stage: { programId } }, userId },
    }),
  ]);

  const firstLesson = modules.flatMap((module) => module.lessons)[0] ?? null;
  return {
    firstLesson: firstLesson
      ? { slug: firstLesson.slug, title: firstLesson.title }
      : null,
    programId,
    programTitle: program.title,
    preserved: {
      conceptAttempts,
      exerciseSubmissions,
      notes,
      quizAttempts,
      stageAssessmentSubmissions,
    },
    reset: {
      concepts,
      exercises,
      lessons,
      modules: modules.length,
      quizzes: quizzes.length,
      resources,
      stages: program.stages.length,
      tasks,
    },
  };
}

async function createProgramRuns(
  transaction: Prisma.TransactionClient,
  modules: Array<{ id: string }>,
  existingByModuleId: Map<string, string>,
  restartKey: string,
  userId: string,
) {
  const runIds: string[] = [];
  for (const module of modules) {
    const existingRunId = existingByModuleId.get(module.id);
    if (existingRunId) {
      runIds.push(existingRunId);
      continue;
    }
    let current = await getCurrentModuleRun(transaction, module.id, userId);
    if (!current) {
      current = await transaction.moduleRun.create({
        data: {
          moduleId: module.id,
          sequence: 1,
          startedAt: new Date(0),
          userId,
        },
      });
    }
    const run = await transaction.moduleRun.create({
      data: {
        moduleId: module.id,
        restartKey,
        sequence: current.sequence + 1,
        startedAt: new Date(),
        userId,
      },
    });
    runIds.push(run.id);
  }
  return runIds;
}

async function resetProgramProgress(
  transaction: Prisma.TransactionClient,
  program: NonNullable<Awaited<ReturnType<typeof readRestartableProgram>>>,
  userId: string,
) {
  const programId = program.id;
  const programLessonWhere = { module: { stage: { programId } } } as const;
  const now = new Date();
  await Promise.all([
    transaction.lessonProgress.updateMany({
      where: { lesson: programLessonWhere, userId },
      data: {
        completedAt: null,
        currentSequenceItemId: null,
        lastViewedAt: null,
        percent: 0,
        startedAt: null,
        status: LessonProgressStatus.AVAILABLE,
      },
    }),
    transaction.taskCompletion.updateMany({
      where: {
        task: { isCanonical: true, lesson: programLessonWhere },
        userId,
      },
      data: { completedAt: null, status: TaskCompletionStatus.TODO },
    }),
    transaction.resourceProgress.updateMany({
      where: { resource: { lesson: programLessonWhere }, userId },
      data: {
        completedAt: null,
        status: ResourceProgressStatus.NOT_STARTED,
      },
    }),
    transaction.conceptProgress.updateMany({
      where: { concept: { lesson: programLessonWhere }, userId },
      data: {
        bestScore: null,
        lastAttemptAt: null,
        status: ConceptProgressStatus.NOT_STARTED,
        validatedAt: null,
      },
    }),
    transaction.reviewItem.updateMany({
      where: { programId, userId },
      data: { completedAt: now, status: ReviewStatus.COMPLETED },
    }),
  ]);

  for (const [index, stage] of program.stages.entries()) {
    await transaction.stageProgress.upsert({
      where: { userId_stageId: { stageId: stage.id, userId } },
      create: {
        percent: 0,
        stageId: stage.id,
        status: index === 0
          ? StageProgressStatus.AVAILABLE
          : StageProgressStatus.LOCKED,
        userId,
      },
      update: {
        completedAt: null,
        lastViewedAt: null,
        percent: 0,
        startedAt: null,
        status: index === 0
          ? StageProgressStatus.AVAILABLE
          : StageProgressStatus.LOCKED,
        targetEndAt: null,
      },
    });
  }

  await transaction.programProgress.upsert({
    where: { userId_programId: { programId, userId } },
    create: { lastViewedAt: now, percent: 0, programId, userId },
    update: {
      completedAt: null,
      lastViewedAt: now,
      percent: 0,
      startedAt: null,
      targetEndAt: null,
    },
  });
  const firstStage = program.stages[0];
  if (firstStage) {
    await transaction.programViewPreference.upsert({
      where: { userId_programId: { programId, userId } },
      create: { expandedStageId: firstStage.id, programId, userId },
      update: { expandedStageId: firstStage.id },
    });
  }
}

export function createPrismaProgramRestartRepository(
  client: PrismaClient,
): ProgramRestartRepository {
  return {
    preview: (programId, userId) =>
      buildProgramPreview(client, programId, userId),
    async restart(programId, restartKey, userId) {
      try {
        return await runSerializableProgressTransaction(
          client,
          async (transaction) => {
            const program = await readRestartableProgram(
              transaction,
              programId,
              userId,
            );
            if (!program) return null;
            const modules = program.stages.flatMap((stage) => stage.modules);
            const moduleIds = modules.map((module) => module.id);
            const existingRuns = moduleIds.length
              ? await transaction.moduleRun.findMany({
                  where: { moduleId: { in: moduleIds }, restartKey, userId },
                  select: { id: true, moduleId: true },
                })
              : [];
            const existingByModuleId = new Map(
              existingRuns.map((run) => [run.moduleId, run.id]),
            );
            if (modules.length > 0 && existingRuns.length === modules.length) {
              const preview = await buildProgramPreview(
                transaction,
                programId,
                userId,
              );
              return preview
                ? {
                    ...preview,
                    idempotent: true,
                    runIds: existingRuns.map((run) => run.id),
                  }
                : null;
            }

            const runIds = await createProgramRuns(
              transaction,
              modules,
              existingByModuleId,
              restartKey,
              userId,
            );
            await resetProgramProgress(transaction, program, userId);
            const preview = await buildProgramPreview(
              transaction,
              programId,
              userId,
            );
            return preview ? { ...preview, idempotent: false, runIds } : null;
          },
        );
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        const program = await readRestartableProgram(client, programId, userId);
        if (!program) return null;
        const moduleIds = program.stages.flatMap((stage) =>
          stage.modules.map((module) => module.id));
        const existingRuns = moduleIds.length
          ? await client.moduleRun.findMany({
              where: { moduleId: { in: moduleIds }, restartKey, userId },
              select: { id: true },
            })
          : [];
        if (existingRuns.length !== moduleIds.length) throw error;
        const preview = await buildProgramPreview(client, programId, userId);
        return preview
          ? {
              ...preview,
              idempotent: true,
              runIds: existingRuns.map((run) => run.id),
            }
          : null;
      }
    },
  };
}
