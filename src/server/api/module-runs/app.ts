import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

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

export interface ProgramRestartPreview {
  firstLesson: { slug: string; title: string } | null;
  programId: string;
  programTitle: string;
  preserved: ModuleRestartPreview['preserved'] & {
    stageAssessmentSubmissions: number;
  };
  reset: RestartCounts & { modules: number; stages: number };
}

export interface ProgramRestartResult extends ProgramRestartPreview {
  idempotent: boolean;
  runIds: string[];
}

export interface ProgramRestartRepository {
  preview(
    programId: string,
    userId: string,
  ): Promise<ProgramRestartPreview | null>;
  restart(
    programId: string,
    restartKey: string,
    userId: string,
  ): Promise<ProgramRestartResult | null>;
}

interface ModuleRunsAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  programRepository?: ProgramRestartRepository;
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

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002',
  );
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
  const programLessonWhere = {
    module: { stage: { programId } },
  } as const;
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
              transaction.resourceProgress.updateMany({
                where: { resource: { lesson: { moduleId } }, userId },
                data: {
                  completedAt: null,
                  status: ResourceProgressStatus.NOT_STARTED,
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
        if (!isUniqueConstraintError(error)) {
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
          const runIds: string[] = [];

          for (const module of modules) {
            const existingRunId = existingByModuleId.get(module.id);
            if (existingRunId) {
              runIds.push(existingRunId);
              continue;
            }
            let current = await getCurrentModuleRun(
              transaction,
              module.id,
              userId,
            );
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

          const programLessonWhere = {
            module: { stage: { programId } },
          } as const;
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
                status:
                  index === 0
                    ? StageProgressStatus.AVAILABLE
                    : StageProgressStatus.LOCKED,
                userId,
              },
              update: {
                completedAt: null,
                lastViewedAt: null,
                percent: 0,
                startedAt: null,
                status:
                  index === 0
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
              create: {
                expandedStageId: firstStage.id,
                programId,
                userId,
              },
              update: { expandedStageId: firstStage.id },
            });
          }

          const preview = await buildProgramPreview(
            transaction,
            programId,
            userId,
          );
          return preview
            ? {
                ...preview,
                idempotent: false,
                runIds,
              }
            : null;
          },
        );
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        const program = await readRestartableProgram(client, programId, userId);
        if (!program) return null;
        const moduleIds = program.stages.flatMap((stage) =>
          stage.modules.map((module) => module.id),
        );
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

async function getRepository() {
  const { prisma } = await import('../../prisma.js');
  return createPrismaModuleRestartRepository(prisma);
}

async function getProgramRepository() {
  const { prisma } = await import('../../prisma.js');
  return createPrismaProgramRestartRepository(prisma);
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

  app.get('/api/programs/:programId/restart-preview', async (context) => {
    const programId = parseIdentifier(context.req.param('programId'));
    const repository =
      options.programRepository ?? (await getProgramRepository());
    const preview = await repository.preview(
      programId,
      context.get('user').id,
    );
    if (!preview) throw notFound();
    return context.json({ preview });
  });

  app.post('/api/programs/:programId/restart', async (context) => {
    assertCapability(context.get('user').role, 'learning.write.own');
    const programId = parseIdentifier(context.req.param('programId'));
    const parsed = await parseBody(context.req.raw);
    if (!parsed.success) throw invalidRequest();
    const repository =
      options.programRepository ?? (await getProgramRepository());
    const result = await repository.restart(
      programId,
      parsed.data.restartKey,
      context.get('user').id,
    );
    if (!result) throw notFound();
    return context.json({ result });
  });

  return app;
}

export const moduleRunsApp = createModuleRunsApp();
