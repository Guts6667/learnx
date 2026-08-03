import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import { Role, type PrismaClient } from '../../generated/prisma/client.js';
import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';

interface AdminLesson {
  id: string;
  isPublished: boolean;
  position: number;
  slug: string;
  summary: string;
  title: string;
}

interface AdminModule {
  description: string;
  id: string;
  isPublished: boolean;
  lessons: AdminLesson[];
  position: number;
  slug: string;
  title: string;
}

interface AdminStage {
  id: string;
  isPublished: boolean;
  modules: AdminModule[];
  position: number;
  slug: string;
  title: string;
}

interface AdminProgram {
  id: string;
  slug: string;
  stages: AdminStage[];
  title: string;
}

interface LessonPublicationState {
  concepts: Array<{ assessments: Array<{ id: string }> }>;
  id: string;
}

interface ModulePublicationState {
  id: string;
  lessons: LessonPublicationState[];
}

interface StagePublicationState {
  assessments: Array<{ id: string }>;
  id: string;
  modules: ModulePublicationState[];
}

interface ModuleUpdate {
  description?: string;
  isPublished?: boolean;
  position?: number;
  title?: string;
}

interface LessonUpdate {
  isPublished?: boolean;
  position?: number;
  summary?: string;
  title?: string;
}

interface StageUpdate {
  isPublished: boolean;
}

export interface AdminRepository {
  findLessonForOwner(
    lessonId: string,
    ownerId: string,
  ): Promise<LessonPublicationState | null>;
  findModuleForOwner(
    moduleId: string,
    ownerId: string,
  ): Promise<ModulePublicationState | null>;
  findStageForOwner(
    stageId: string,
    ownerId: string,
  ): Promise<StagePublicationState | null>;
  listCurriculum(ownerId: string): Promise<AdminProgram[]>;
  updateLesson(lessonId: string, input: LessonUpdate): Promise<AdminLesson>;
  updateModule(moduleId: string, input: ModuleUpdate): Promise<AdminModule>;
  updateStage(
    stageId: string,
    input: StageUpdate,
  ): Promise<{ id: string; isPublished: boolean }>;
}

interface AdminAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  repository?: AdminRepository;
}

const identifierSchema = z.uuid();
const positionSchema = z.number().int().min(0).max(10_000);
const moduleUpdateSchema = z
  .object({
    description: z.string().trim().min(1).max(5_000).optional(),
    isPublished: z.boolean().optional(),
    position: positionSchema.optional(),
    title: z.string().trim().min(1).max(200).optional(),
  })
  .refine((input) => Object.keys(input).length > 0);
const lessonUpdateSchema = z
  .object({
    isPublished: z.boolean().optional(),
    position: positionSchema.optional(),
    summary: z.string().trim().min(1).max(5_000).optional(),
    title: z.string().trim().min(1).max(200).optional(),
  })
  .refine((input) => Object.keys(input).length > 0);
const stageUpdateSchema = z.object({ isPublished: z.boolean() }).strict();

const lessonSelect = {
  id: true,
  isPublished: true,
  position: true,
  slug: true,
  summary: true,
  title: true,
} as const;

const moduleSelect = {
  description: true,
  id: true,
  isPublished: true,
  lessons: {
    orderBy: { position: 'asc' as const },
    select: lessonSelect,
  },
  position: true,
  slug: true,
  title: true,
} as const;

export function createPrismaAdminRepository(
  client: PrismaClient,
): AdminRepository {
  return {
    async findLessonForOwner(lessonId, ownerId) {
      return client.lesson.findFirst({
        where: {
          id: lessonId,
          module: { stage: { program: { ownerId } } },
        },
        select: {
          id: true,
          concepts: {
            where: { isRequired: true },
            select: {
              assessments: {
                where: { isRequired: true },
                select: { id: true },
              },
            },
          },
        },
      });
    },
    async findModuleForOwner(moduleId, ownerId) {
      return client.module.findFirst({
        where: { id: moduleId, stage: { program: { ownerId } } },
        select: {
          id: true,
          lessons: {
            where: { isPublished: true },
            select: {
              concepts: {
                where: { isRequired: true },
                select: {
                  assessments: {
                    where: { isRequired: true },
                    select: { id: true },
                  },
                },
              },
              id: true,
            },
          },
        },
      });
    },
    async findStageForOwner(stageId, ownerId) {
      return client.stage.findFirst({
        where: { id: stageId, program: { ownerId } },
        select: {
          assessments: {
            where: { isRequired: true },
            select: { id: true },
          },
          id: true,
          modules: {
            where: { isPublished: true },
            select: {
              id: true,
              lessons: {
                where: { isPublished: true },
                select: {
                  concepts: {
                    where: { isRequired: true },
                    select: {
                      assessments: {
                        where: { isRequired: true },
                        select: { id: true },
                      },
                    },
                  },
                  id: true,
                },
              },
            },
          },
        },
      });
    },
    async listCurriculum(ownerId) {
      return client.program.findMany({
        where: { ownerId },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          slug: true,
          stages: {
            orderBy: { position: 'asc' },
            select: {
              id: true,
              isPublished: true,
              modules: {
                orderBy: { position: 'asc' },
                select: moduleSelect,
              },
              position: true,
              slug: true,
              title: true,
            },
          },
          title: true,
        },
      });
    },
    async updateLesson(lessonId, input) {
      return client.lesson.update({
        where: { id: lessonId },
        data: input,
        select: lessonSelect,
      });
    },
    async updateModule(moduleId, input) {
      return client.module.update({
        where: { id: moduleId },
        data: input,
        select: moduleSelect,
      });
    },
    async updateStage(stageId, input) {
      return client.stage.update({
        where: { id: stageId },
        data: input,
        select: { id: true, isPublished: true },
      });
    },
  };
}

async function getPrismaRepository(): Promise<AdminRepository> {
  const { prisma } = await import('../../src/server/prisma.js');

  return createPrismaAdminRepository(prisma);
}

function invalidRequest(): ApiError {
  return new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
}

function forbidden(): ApiError {
  return new ApiError('FORBIDDEN', 'Administrator access is required.', 403);
}

function notFound(): ApiError {
  return new ApiError('RESOURCE_NOT_FOUND', 'Resource not found.', 404);
}

function lessonNotReady(): ApiError {
  return new ApiError(
    'LESSON_NOT_READY',
    'Every required concept must have a required assessment before publication.',
    409,
  );
}

function moduleNotReady(): ApiError {
  return new ApiError(
    'LESSON_NOT_READY',
    'A published module must contain at least one publishable lesson.',
    409,
  );
}

function stageNotReady(): ApiError {
  return new ApiError(
    'ASSESSMENT_NOT_READY',
    'A published stage needs a final assessment and publishable content.',
    409,
  );
}

async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw invalidRequest();
  }
}

function parseIdentifier(value: string): string {
  const result = identifierSchema.safeParse(value);

  if (!result.success) throw invalidRequest();

  return result.data;
}

function isLessonReadyForPublication(lesson: LessonPublicationState): boolean {
  return lesson.concepts.every((concept) => concept.assessments.length > 0);
}

function isModuleReadyForPublication(module: ModulePublicationState): boolean {
  return (
    module.lessons.length > 0 &&
    module.lessons.every(isLessonReadyForPublication)
  );
}

function isStageReadyForPublication(stage: StagePublicationState): boolean {
  return (
    stage.assessments.length > 0 &&
    stage.modules.length > 0 &&
    stage.modules.every(isModuleReadyForPublication)
  );
}

export function createAdminApp(options: AdminAppOptions = {}) {
  const app = new Hono<AuthEnvironment>();
  let defaultRepository: AdminRepository | undefined;
  const getRepository = async () => {
    if (options.repository) return options.repository;
    defaultRepository ??= await getPrismaRepository();
    return defaultRepository;
  };

  app.use('*', options.authentication ?? requireUser);
  app.use('*', async (context, next) => {
    if (context.get('user').role !== Role.ADMIN) throw forbidden();
    await next();
  });
  app.onError((error, context) => {
    if (error instanceof ApiError) {
      return context.json(toApiErrorBody(error), error.status);
    }

    console.error(error);
    return context.json(
      toApiErrorBody(
        new ApiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500),
      ),
      500,
    );
  });

  app.get('/api/admin/curriculum', async (context) => {
    const programs = await (
      await getRepository()
    ).listCurriculum(context.get('user').id);

    return context.json({ programs });
  });

  app.patch('/api/admin/modules/:moduleId', async (context) => {
    const moduleId = parseIdentifier(context.req.param('moduleId'));
    const parsed = moduleUpdateSchema.safeParse(
      await parseJson(context.req.raw),
    );

    if (!parsed.success) throw invalidRequest();

    const repository = await getRepository();
    const ownedModule = await repository.findModuleForOwner(
      moduleId,
      context.get('user').id,
    );

    if (!ownedModule) throw notFound();
    if (parsed.data.isPublished && !isModuleReadyForPublication(ownedModule)) {
      throw moduleNotReady();
    }

    return context.json({
      module: await repository.updateModule(moduleId, parsed.data),
    });
  });

  app.patch('/api/admin/stages/:stageId', async (context) => {
    const stageId = parseIdentifier(context.req.param('stageId'));
    const parsed = stageUpdateSchema.safeParse(
      await parseJson(context.req.raw),
    );

    if (!parsed.success) throw invalidRequest();

    const repository = await getRepository();
    const stage = await repository.findStageForOwner(
      stageId,
      context.get('user').id,
    );

    if (!stage) throw notFound();
    if (parsed.data.isPublished && !isStageReadyForPublication(stage)) {
      throw stageNotReady();
    }

    return context.json({
      stage: await repository.updateStage(stageId, parsed.data),
    });
  });

  app.patch('/api/admin/lessons/:lessonId', async (context) => {
    const lessonId = parseIdentifier(context.req.param('lessonId'));
    const parsed = lessonUpdateSchema.safeParse(
      await parseJson(context.req.raw),
    );

    if (!parsed.success) throw invalidRequest();

    const repository = await getRepository();
    const lesson = await repository.findLessonForOwner(
      lessonId,
      context.get('user').id,
    );

    if (!lesson) throw notFound();
    if (parsed.data.isPublished && !isLessonReadyForPublication(lesson)) {
      throw lessonNotReady();
    }

    return context.json({
      lesson: await repository.updateLesson(lessonId, parsed.data),
    });
  });

  return app;
}

export const adminApp = createAdminApp();
