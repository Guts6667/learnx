import {
  ConceptProgressStatus,
  LessonProgressStatus,
  ResourceProgressStatus,
  ReviewStatus,
  TaskCompletionStatus,
  type Prisma,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import { getCurrentModuleRun } from '../_lib/module-runs.js';
import { learningProgramWhere } from '../_lib/program-access-policy.js';
import {
  refreshStageAndProgram,
  runSerializableProgressTransaction,
} from '../_lib/progress-recalculation.js';
import type { ModuleRestartPreview } from './types.js';

type DatabaseClient = Prisma.TransactionClient | PrismaClient;

function isPrismaClient(client: DatabaseClient): client is PrismaClient {
  return '$transaction' in client;
}

async function readResetCounts(
  client: DatabaseClient,
  moduleId: string,
  userId: string,
  currentRunId?: string,
) {
  const [lessons, tasks, resources, concepts, quizIds, exercises] =
    await Promise.all([
      client.lessonProgress.count({ where: { lesson: { moduleId }, userId } }),
      client.taskCompletion.count({
        where: { task: { isCanonical: true, lesson: { moduleId } }, userId },
      }),
      client.resourceProgress.count({
        where: { resource: { lesson: { moduleId } }, userId },
      }),
      client.conceptProgress.count({
        where: { concept: { lesson: { moduleId } }, userId },
      }),
      currentRunId
        ? client.quizAttempt.findMany({
            where: { moduleRunId: currentRunId, passed: true, userId },
            distinct: ['quizId'],
            select: { quizId: true },
          })
        : Promise.resolve([]),
      currentRunId
        ? client.exerciseSubmission.count({
            where: {
              exercise: { isCanonical: true },
              moduleRunId: currentRunId,
              userId,
            },
          })
        : Promise.resolve(0),
    ]);
  return {
    concepts,
    exercises,
    lessons,
    quizzes: quizIds.length,
    resources,
    tasks,
  };
}

async function readPreservedCounts(
  client: DatabaseClient,
  moduleId: string,
  userId: string,
) {
  const [quizAttempts, conceptAttempts, exerciseSubmissions, notes] =
    await Promise.all([
      client.quizAttempt.count({
        where: { quiz: { lesson: { moduleId } }, userId },
      }),
      client.conceptAssessmentAttempt.count({
        where: { assessment: { concept: { lesson: { moduleId } } }, userId },
      }),
      client.exerciseSubmission.count({
        where: { exercise: { lesson: { moduleId } }, userId },
      }),
      client.note.count({ where: { lesson: { moduleId }, userId } }),
    ]);
  return { conceptAttempts, exerciseSubmissions, notes, quizAttempts };
}

export class PrismaModuleRestartDataRepository {
  constructor(private readonly client: DatabaseClient) {}

  readOwnedModule(moduleId: string, userId: string) {
    return this.client.module.findFirst({
      where: {
        id: moduleId,
        isPublished: true,
        stage: {
          isPublished: true,
          program: learningProgramWhere(userId),
        },
      },
      select: {
        id: true,
        stage: { select: { id: true, programId: true } },
        title: true,
        lessons: {
          where: { isPublished: true },
          orderBy: { position: 'asc' },
          select: { id: true, slug: true, title: true },
        },
      },
    });
  }

  async buildPreview(
    moduleId: string,
    userId: string,
  ): Promise<ModuleRestartPreview | null> {
    const module = await this.readOwnedModule(moduleId, userId);
    if (!module) return null;
    const currentRun = await this.getCurrentRun(moduleId, userId);
    const [reset, preserved] = await Promise.all([
      readResetCounts(this.client, moduleId, userId, currentRun?.id),
      readPreservedCounts(this.client, moduleId, userId),
    ]);
    return {
      currentRunSequence: currentRun?.sequence ?? 0,
      firstLesson: module.lessons[0]
        ? { slug: module.lessons[0].slug, title: module.lessons[0].title }
        : null,
      moduleId,
      moduleTitle: module.title,
      preserved,
      reset,
    };
  }

  getCurrentRun(moduleId: string, userId: string) {
    return getCurrentModuleRun(this.client, moduleId, userId);
  }

  findRestartRun(moduleId: string, restartKey: string, userId: string) {
    return this.client.moduleRun.findFirst({
      where: { moduleId, restartKey, userId },
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

  async resetProgress(moduleId: string, userId: string, now: Date) {
    await Promise.all([
      this.client.lessonProgress.updateMany({
        where: { lesson: { moduleId }, userId },
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
        where: { task: { isCanonical: true, lesson: { moduleId } }, userId },
        data: { completedAt: null, status: TaskCompletionStatus.TODO },
      }),
      this.client.conceptProgress.updateMany({
        where: { concept: { lesson: { moduleId } }, userId },
        data: {
          bestScore: null,
          lastAttemptAt: null,
          status: ConceptProgressStatus.NOT_STARTED,
          validatedAt: null,
        },
      }),
      this.client.resourceProgress.updateMany({
        where: { resource: { lesson: { moduleId } }, userId },
        data: { completedAt: null, status: ResourceProgressStatus.NOT_STARTED },
      }),
      this.client.reviewItem.updateMany({
        where: { lesson: { moduleId }, userId },
        data: { completedAt: now, status: ReviewStatus.COMPLETED },
      }),
    ]);
  }

  refreshHierarchy(
    stageId: string,
    programId: string,
    userId: string,
    now: Date,
  ) {
    return refreshStageAndProgram(
      this.client,
      stageId,
      programId,
      userId,
      now,
    );
  }

  runTransaction<T>(
    operation: (repository: PrismaModuleRestartDataRepository) => Promise<T>,
  ): Promise<T> {
    if (!isPrismaClient(this.client)) return operation(this);
    return runSerializableProgressTransaction(this.client, (transaction) =>
      operation(new PrismaModuleRestartDataRepository(transaction)),
    );
  }
}

export function createPrismaModuleRestartDataRepository(client: PrismaClient) {
  return new PrismaModuleRestartDataRepository(client);
}
