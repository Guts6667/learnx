import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import {
  Role,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import {
  createPrismaPublicationService,
  PublicationPlanBlockedError,
  PublicationPlanStaleError,
  type PublicationService,
} from './publication-service.js';

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
  status: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
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

interface ModuleUpdate {
  description?: string;
  position?: number;
  title?: string;
}

interface LessonUpdate {
  isPublished?: boolean;
  position?: number;
  summary?: string;
  title?: string;
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
  listCurriculum(ownerId: string): Promise<AdminProgram[]>;
  updateLesson(lessonId: string, input: LessonUpdate): Promise<AdminLesson>;
  updateModule(moduleId: string, input: ModuleUpdate): Promise<AdminModule>;
}

interface AdminAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  publicationService?: PublicationService;
  repository?: AdminRepository;
}

const identifierSchema = z.uuid();
const positionSchema = z.number().int().min(0).max(10_000);
const moduleUpdateSchema = z
  .object({
    description: z.string().trim().min(1).max(5_000).optional(),
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
const publicationRequestSchema = z
  .object({
    action: z.enum(['PUBLISH', 'UNPUBLISH']),
    mode: z.enum(['FULL', 'PARENT_ONLY']),
    targetId: identifierSchema,
    targetType: z.enum(['PROGRAM', 'STAGE', 'MODULE']),
  })
  .strict();
const applyPublicationSchema = publicationRequestSchema.extend({
  planId: z.string().regex(/^[a-f0-9]{64}$/),
});

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
    async listCurriculum(ownerId) {
      return client.program.findMany({
        where: { ownerId },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          slug: true,
          status: true,
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
  };
}

async function getPrismaRepository(): Promise<AdminRepository> {
  const { prisma } = await import('../../prisma.js');

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

export function createAdminApp(options: AdminAppOptions = {}) {
  const app = new Hono<AuthEnvironment>();
  let defaultRepository: AdminRepository | undefined;
  const getRepository = async () => {
    if (options.repository) return options.repository;
    defaultRepository ??= await getPrismaRepository();
    return defaultRepository;
  };
  let defaultPublicationService: PublicationService | undefined;
  const getPublicationService = async () => {
    if (options.publicationService) return options.publicationService;
    if (!defaultPublicationService) {
      const { prisma } = await import('../../prisma.js');
      defaultPublicationService = createPrismaPublicationService(prisma);
    }
    return defaultPublicationService;
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

  app.post('/api/admin/publication/preview', async (context) => {
    const parsed = publicationRequestSchema.safeParse(
      await parseJson(context.req.raw),
    );
    if (!parsed.success) throw invalidRequest();

    const plan = await (
      await getPublicationService()
    ).preview(context.get('user').id, parsed.data);
    if (!plan) throw notFound();

    return context.json({ plan });
  });

  app.post('/api/admin/publication/apply', async (context) => {
    const parsed = applyPublicationSchema.safeParse(
      await parseJson(context.req.raw),
    );
    if (!parsed.success) throw invalidRequest();

    try {
      const plan = await (
        await getPublicationService()
      ).apply(context.get('user').id, parsed.data);
      if (!plan) throw notFound();

      return context.json({ plan });
    } catch (error) {
      if (error instanceof PublicationPlanStaleError) {
        throw new ApiError(
          'PUBLICATION_PLAN_STALE',
          'The publication preview is no longer current.',
          409,
        );
      }
      if (error instanceof PublicationPlanBlockedError) {
        throw new ApiError(
          'PUBLICATION_BLOCKED',
          'Publication requirements are not satisfied.',
          409,
        );
      }
      throw error;
    }
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
    return context.json({
      module: await repository.updateModule(moduleId, parsed.data),
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
