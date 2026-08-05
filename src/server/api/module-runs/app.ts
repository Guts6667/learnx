import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import {
  ConceptProgressStatus,
  LessonProgressStatus,
  ReviewStatus,
  TaskCompletionStatus,
  type Prisma,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { assertCapability, requireCapability } from '../_lib/authorization.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import { learningProgramWhere } from '../_lib/program-access-policy.js';
import { getCurrentModuleRun } from '../_lib/module-runs.js';
import {
  refreshStageAndProgram,
  runSerializableProgressTransaction,
} from '../_lib/progress-recalculation.js';

interface RestartCounts {
  concepts: number;
  exercises: number;
  lessons: number;
  quizzes: number;
  resources: number;
  tasks: number;
}

export interface ModuleRestartPreview {
  currentRunSequence: number;
  firstLesson: { slug: string; title: string } | null;
  moduleId: string;
  moduleTitle: string;
  preserved: {
    conceptAttempts: number;
    exerciseSubmissions: number;
    notes: number;
    quizAttempts: number;
  };
  reset: RestartCounts;
}

export interface ModuleRestartResult extends ModuleRestartPreview {
  idempotent: boolean;
  runId: string;
}

export interface ModuleRestartRepository {
  preview(
    moduleId: string,
    userId: string,
  ): Promise<ModuleRestartPreview | null>;
  restart(
    moduleId: string,
    restartKey: string,
    userId: string,
  ): Promise<ModuleRestartResult | null>;
}

interface ModuleRunsAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  repository?: ModuleRestartRepository;
}

const identifierSchema = z.uuid();
const restartSchema = z.object({ restartKey: z.uuid() });

function notFound() {
  return new ApiError('RESOURCE_NOT_FOUND', 'Resource not found.', 404);
}

function invalidRequest() {
  return new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
}

function parseIdentifier(value: string): string {
  const parsed = identifierSchema.safeParse(value);
  if (!parsed.success) throw invalidRequest();
  return parsed.data;
}

async function parseBody(request: Request) {
  try {
    return restartSchema.safeParse(await request.json());
  } catch {
    return restartSchema.safeParse(null);
  }
}

async function readOwnedModule(
  client: Prisma.TransactionClient | PrismaClient,
  moduleId: string,
  userId: string,
) {
  return client.module.findFirst({
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

async function buildPreview(
  client: Prisma.TransactionClient | PrismaClient,
  moduleId: string,
  userId: string,
): Promise<ModuleRestartPreview | null> {
  const module = await readOwnedModule(client, moduleId, userId);
  if (!module) return null;
  const currentRun = await getCurrentModuleRun(client, moduleId, userId);
  const currentRunId = currentRun?.id;
  const [
    lessons,
    tasks,
    resources,
    concepts,
    quizIds,
    exercises,
    quizAttempts,
    conceptAttempts,
    exerciseSubmissions,
    notes,
  ] = await Promise.all([
    client.lessonProgress.count({ where: { lesson: { moduleId }, userId } }),
    client.taskCompletion.count({
      where: { task: { isCanonical: true, lesson: { moduleId } }, userId },
    }),
    Promise.resolve(0),
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

  return {
    currentRunSequence: currentRun?.sequence ?? 0,
    firstLesson: module.lessons[0]
      ? { slug: module.lessons[0].slug, title: module.lessons[0].title }
      : null,
    moduleId,
    moduleTitle: module.title,
    preserved: { conceptAttempts, exerciseSubmissions, notes, quizAttempts },
    reset: {
      concepts,
      exercises,
      lessons,
      quizzes: quizIds.length,
      resources,
      tasks,
    },
  };
}

export function createPrismaModuleRestartRepository(
  client: PrismaClient,
): ModuleRestartRepository {
  return {
    preview: (moduleId, userId) => buildPreview(client, moduleId, userId),
    async restart(moduleId, restartKey, userId) {
      try {
        return await runSerializableProgressTransaction(
          client,
          async (transaction) => {
            const module = await readOwnedModule(transaction, moduleId, userId);
            if (!module) return null;
            const existing = await transaction.moduleRun.findFirst({
              where: { moduleId, restartKey, userId },
            });
            if (existing) {
              const preview = await buildPreview(transaction, moduleId, userId);
              return preview
                ? { ...preview, idempotent: true, runId: existing.id }
                : null;
            }

            let current = await getCurrentModuleRun(
              transaction,
              moduleId,
              userId,
            );
            if (!current) {
              current = await transaction.moduleRun.create({
                data: { moduleId, sequence: 1, startedAt: new Date(0), userId },
              });
            }
            const now = new Date();
            const run = await transaction.moduleRun.create({
              data: {
                moduleId,
                restartKey,
                sequence: current.sequence + 1,
                startedAt: now,
                userId,
              },
            });

            await Promise.all([
              transaction.lessonProgress.updateMany({
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
              transaction.taskCompletion.updateMany({
                where: {
                  task: { isCanonical: true, lesson: { moduleId } },
                  userId,
                },
                data: { completedAt: null, status: TaskCompletionStatus.TODO },
              }),
              transaction.conceptProgress.updateMany({
                where: { concept: { lesson: { moduleId } }, userId },
                data: {
                  bestScore: null,
                  lastAttemptAt: null,
                  status: ConceptProgressStatus.NOT_STARTED,
                  validatedAt: null,
                },
              }),
              transaction.reviewItem.updateMany({
                where: { lesson: { moduleId }, userId },
                data: { completedAt: now, status: ReviewStatus.COMPLETED },
              }),
            ]);
            await refreshStageAndProgram(
              transaction,
              module.stage.id,
              module.stage.programId,
              userId,
              now,
            );
            const preview = await buildPreview(transaction, moduleId, userId);
            return preview
              ? { ...preview, idempotent: false, runId: run.id }
              : null;
          },
        );
      } catch (error) {
        if (
          !error ||
          typeof error !== 'object' ||
          !('code' in error) ||
          error.code !== 'P2002'
        ) {
          throw error;
        }
        const existing = await client.moduleRun.findFirst({
          where: { moduleId, restartKey, userId },
        });
        const preview = existing
          ? await buildPreview(client, moduleId, userId)
          : null;
        if (!existing || !preview) throw error;
        return { ...preview, idempotent: true, runId: existing.id };
      }
    },
  };
}

async function getRepository() {
  const { prisma } = await import('../../prisma.js');
  return createPrismaModuleRestartRepository(prisma);
}

export function createModuleRunsApp(options: ModuleRunsAppOptions = {}) {
  const app = new Hono<AuthEnvironment>();
  app.use('*', options.authentication ?? requireUser);
  app.use('*', requireCapability('learning.read'));
  app.onError((error, context) => {
    if (error instanceof ApiError) {
      return context.json(toApiErrorBody(error), error.status);
    }
    return context.json(
      toApiErrorBody(
        new ApiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500),
      ),
      500,
    );
  });

  app.get('/api/modules/:moduleId/restart-preview', async (context) => {
    const moduleId = parseIdentifier(context.req.param('moduleId'));
    const repository = options.repository ?? (await getRepository());
    const preview = await repository.preview(moduleId, context.get('user').id);
    if (!preview) throw notFound();
    return context.json({ preview });
  });

  app.post('/api/modules/:moduleId/restart', async (context) => {
    assertCapability(context.get('user').role, 'learning.write.own');
    const moduleId = parseIdentifier(context.req.param('moduleId'));
    const parsed = await parseBody(context.req.raw);
    if (!parsed.success) throw invalidRequest();
    const repository = options.repository ?? (await getRepository());
    const result = await repository.restart(
      moduleId,
      parsed.data.restartKey,
      context.get('user').id,
    );
    if (!result) throw notFound();
    return context.json({ result });
  });

  return app;
}

export const moduleRunsApp = createModuleRunsApp();
