import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import {
  AuditAction,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { createAuditIdempotencyKey, writeAuditEvent } from '../_lib/audit.js';
import { assertCapability, requireCapability } from '../_lib/authorization.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import {
  createPrismaAdminNavigationService,
  type AdminNavigationService,
} from './navigation-service.js';
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
  updateLesson(
    lessonId: string,
    input: LessonUpdate,
    audit: { actorUserId: string; idempotencyKey: string },
  ): Promise<AdminLesson | null>;
  updateModule(
    moduleId: string,
    input: ModuleUpdate,
    audit: { actorUserId: string; idempotencyKey: string },
  ): Promise<AdminModule | null>;
}

interface AdminAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  navigationService?: AdminNavigationService;
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
    async updateLesson(lessonId, input, audit) {
      return client.$transaction(async (transaction) => {
        const ownedLesson = await transaction.lesson.findFirst({
          where: {
            id: lessonId,
            module: { stage: { program: { ownerId: audit.actorUserId } } },
          },
          select: { id: true },
        });
        if (!ownedLesson) return null;

        const lesson = await transaction.lesson.update({
          where: { id: lessonId },
          data: input,
          select: lessonSelect,
        });
        await writeAuditEvent(transaction, {
          action: AuditAction.LESSON_UPDATE,
          actorUserId: audit.actorUserId,
          idempotencyKey: audit.idempotencyKey,
          metadata: { changedFields: Object.keys(input).sort() },
          targetId: lessonId,
          targetType: 'lesson',
        });
        return lesson;
      });
    },
    async updateModule(moduleId, input, audit) {
      return client.$transaction(async (transaction) => {
        const ownedModule = await transaction.module.findFirst({
          where: {
            id: moduleId,
            stage: { program: { ownerId: audit.actorUserId } },
          },
          select: { id: true },
        });
        if (!ownedModule) return null;

        const module = await transaction.module.update({
          where: { id: moduleId },
          data: input,
          select: moduleSelect,
        });
        await writeAuditEvent(transaction, {
          action: AuditAction.MODULE_UPDATE,
          actorUserId: audit.actorUserId,
          idempotencyKey: audit.idempotencyKey,
          metadata: { changedFields: Object.keys(input).sort() },
          targetId: moduleId,
          targetType: 'module',
        });
        return module;
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
  let defaultNavigationService: AdminNavigationService | undefined;
  const getNavigationService = async () => {
    if (options.navigationService) return options.navigationService;
    if (!defaultNavigationService) {
      const { prisma } = await import('../../prisma.js');
      defaultNavigationService = createPrismaAdminNavigationService(prisma);
    }
    return defaultNavigationService;
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

  app.use('/api/admin/*', options.authentication ?? requireUser);
  app.use('/api/admin/*', requireCapability('program.admin.read'));
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

  app.get('/api/admin/programs', async (context) => {
    const programs = await (
      await getNavigationService()
    ).listPrograms(context.get('user').id);
    return context.json({ kind: 'PROGRAMS', programs });
  });

  app.get('/api/admin/programs/:programId', async (context) => {
    const program = await (
      await getNavigationService()
    ).findProgram(
      parseIdentifier(context.req.param('programId')),
      context.get('user').id,
    );
    if (!program) throw notFound();
    return context.json({ kind: 'PROGRAM', program });
  });

  app.get('/api/admin/stages/:stageId', async (context) => {
    const stage = await (
      await getNavigationService()
    ).findStage(
      parseIdentifier(context.req.param('stageId')),
      context.get('user').id,
    );
    if (!stage) throw notFound();
    return context.json({ kind: 'STAGE', stage });
  });

  app.get('/api/admin/modules/:moduleId', async (context) => {
    const module = await (
      await getNavigationService()
    ).findModule(
      parseIdentifier(context.req.param('moduleId')),
      context.get('user').id,
    );
    if (!module) throw notFound();
    return context.json({ kind: 'MODULE', module });
  });

  app.get('/api/admin/lessons/:lessonId', async (context) => {
    const lesson = await (
      await getNavigationService()
    ).findLesson(
      parseIdentifier(context.req.param('lessonId')),
      context.get('user').id,
    );
    if (!lesson) throw notFound();
    return context.json({ kind: 'LESSON', lesson });
  });

  app.post('/api/admin/publication/preview', async (context) => {
    assertCapability(context.get('user').role, 'program.admin.publish');
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
    assertCapability(context.get('user').role, 'program.admin.publish');
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
    assertCapability(context.get('user').role, 'program.admin.edit');
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
    const updatedModule = await repository.updateModule(moduleId, parsed.data, {
      actorUserId: context.get('user').id,
      idempotencyKey: createAuditIdempotencyKey(
        AuditAction.MODULE_UPDATE,
        moduleId,
        parsed.data,
      ),
    });
    if (!updatedModule) throw notFound();
    return context.json({
      module: updatedModule,
    });
  });

  app.patch('/api/admin/lessons/:lessonId', async (context) => {
    assertCapability(context.get('user').role, 'program.admin.edit');
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

    const updatedLesson = await repository.updateLesson(lessonId, parsed.data, {
      actorUserId: context.get('user').id,
      idempotencyKey: createAuditIdempotencyKey(
        AuditAction.LESSON_UPDATE,
        lessonId,
        parsed.data,
      ),
    });
    if (!updatedLesson) throw notFound();

    return context.json({
      lesson: updatedLesson,
    });
  });

  return app;
}

export const adminApp = createAdminApp();
