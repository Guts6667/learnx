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
import type { ProgramRestartPreview } from './types.js';

type DatabaseClient = Prisma.TransactionClient | PrismaClient;

function isPrismaClient(client: DatabaseClient): client is PrismaClient {
  return '$transaction' in client;
}

function getProgramLessonWhere(programId: string) {
  return { module: { stage: { programId } } } as const;
}

async function readProgramResetCounts(
  client: DatabaseClient,
  programId: string,
  userId: string,
  currentRunIds: string[],
) {
  const lesson = getProgramLessonWhere(programId);
  const [lessons, tasks, resources, concepts, quizzes, exercises] =
    await Promise.all([
      client.lessonProgress.count({ where: { lesson, userId } }),
      client.taskCompletion.count({
        where: { task: { isCanonical: true, lesson }, userId },
      }),
      client.resourceProgress.count({
        where: { resource: { lesson }, userId },
      }),
      client.conceptProgress.count({ where: { concept: { lesson }, userId } }),
      currentRunIds.length
        ? client.quizAttempt.findMany({
            where: {
              moduleRunId: { in: currentRunIds },
              passed: true,
              quiz: { lesson },
              userId,
            },
            distinct: ['quizId'],
            select: { quizId: true },
          })
        : Promise.resolve([]),
      currentRunIds.length
        ? client.exerciseSubmission.count({
            where: {
              exercise: { isCanonical: true, lesson },
              moduleRunId: { in: currentRunIds },
              userId,
            },
          })
        : Promise.resolve(0),
    ]);
  return {
    concepts,
    exercises,
    lessons,
    quizzes: quizzes.length,
    resources,
    tasks,
  };
}

async function readProgramPreservedCounts(
  client: DatabaseClient,
  programId: string,
  userId: string,
) {
  const lesson = getProgramLessonWhere(programId);
  const [quizAttempts, conceptAttempts, exerciseSubmissions, notes, stages] =
    await Promise.all([
      client.quizAttempt.count({ where: { quiz: { lesson }, userId } }),
      client.conceptAssessmentAttempt.count({
        where: { assessment: { concept: { lesson } }, userId },
      }),
      client.exerciseSubmission.count({
        where: { exercise: { lesson }, userId },
      }),
      client.note.count({ where: { lesson, userId } }),
      client.stageAssessmentSubmission.count({
        where: { stageAssessment: { stage: { programId } }, userId },
      }),
    ]);
  return {
    conceptAttempts,
    exerciseSubmissions,
    notes,
    quizAttempts,
    stageAssessmentSubmissions: stages,
  };
}

export class PrismaProgramRestartDataRepository {
  constructor(private readonly client: DatabaseClient) {}

  readProgram(programId: string, userId: string) {
    return this.client.program.findFirst({
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

  async buildPreview(
    programId: string,
    userId: string,
  ): Promise<ProgramRestartPreview | null> {
    const program = await this.readProgram(programId, userId);
    if (!program) return null;
    const modules = program.stages.flatMap((stage) => stage.modules);
    const currentRuns = await Promise.all(
      modules.map((module) => this.getCurrentRun(module.id, userId)),
    );
    const currentRunIds = currentRuns.flatMap((run) => (run ? [run.id] : []));
    const [reset, preserved] = await Promise.all([
      readProgramResetCounts(this.client, programId, userId, currentRunIds),
      readProgramPreservedCounts(this.client, programId, userId),
    ]);
    const firstLesson = modules.flatMap((module) => module.lessons)[0] ?? null;
    return {
      firstLesson: firstLesson
        ? { slug: firstLesson.slug, title: firstLesson.title }
        : null,
      programId,
      programTitle: program.title,
      preserved,
      reset: {
        ...reset,
        modules: modules.length,
        stages: program.stages.length,
      },
    };
  }

  getCurrentRun(moduleId: string, userId: string) {
    return getCurrentModuleRun(this.client, moduleId, userId);
  }

  findRestartRuns(moduleIds: string[], restartKey: string, userId: string) {
    if (moduleIds.length === 0) return Promise.resolve([]);
    return this.client.moduleRun.findMany({
      where: { moduleId: { in: moduleIds }, restartKey, userId },
      select: { id: true, moduleId: true },
    });
  }

  createRun(
    moduleId: string,
    sequence: number,
    startedAt: Date,
    userId: string,
    restartKey?: string,
  ) {
    return this.client.moduleRun.create({
      data: { moduleId, restartKey, sequence, startedAt, userId },
    });
  }

  async resetLessonProgress(programId: string, userId: string, now: Date) {
    const lesson = getProgramLessonWhere(programId);
    await Promise.all([
      this.client.lessonProgress.updateMany({
        where: { lesson, userId },
        data: {
          completedAt: null,
          currentSequenceItemId: null,
          lastViewedAt: null,
          percent: 0,
          startedAt: null,
          status: LessonProgressStatus.AVAILABLE,
        },
      }),
      this.client.taskCompletion.updateMany({
        where: { task: { isCanonical: true, lesson }, userId },
        data: { completedAt: null, status: TaskCompletionStatus.TODO },
      }),
      this.client.resourceProgress.updateMany({
        where: { resource: { lesson }, userId },
        data: { completedAt: null, status: ResourceProgressStatus.NOT_STARTED },
      }),
      this.client.conceptProgress.updateMany({
        where: { concept: { lesson }, userId },
        data: {
          bestScore: null,
          lastAttemptAt: null,
          status: ConceptProgressStatus.NOT_STARTED,
          validatedAt: null,
        },
      }),
      this.client.reviewItem.updateMany({
        where: { programId, userId },
        data: { completedAt: now, status: ReviewStatus.COMPLETED },
      }),
    ]);
  }

  resetStageProgress(
    stageId: string,
    userId: string,
    status: StageProgressStatus,
  ) {
    return this.client.stageProgress.upsert({
      where: { userId_stageId: { stageId, userId } },
      create: { percent: 0, stageId, status, userId },
      update: {
        completedAt: null,
        lastViewedAt: null,
        percent: 0,
        startedAt: null,
        status,
        targetEndAt: null,
      },
    });
  }

  resetProgramProgress(programId: string, userId: string, now: Date) {
    return this.client.programProgress.upsert({
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
  }

  saveViewPreference(programId: string, stageId: string, userId: string) {
    return this.client.programViewPreference.upsert({
      where: { userId_programId: { programId, userId } },
      create: { expandedStageId: stageId, programId, userId },
      update: { expandedStageId: stageId },
    });
  }

  runTransaction<T>(
    operation: (repository: PrismaProgramRestartDataRepository) => Promise<T>,
  ): Promise<T> {
    if (!isPrismaClient(this.client)) return operation(this);
    return runSerializableProgressTransaction(this.client, (transaction) =>
      operation(new PrismaProgramRestartDataRepository(transaction)),
    );
  }
}

export function createPrismaProgramRestartDataRepository(client: PrismaClient) {
  return new PrismaProgramRestartDataRepository(client);
}
