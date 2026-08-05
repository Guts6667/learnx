import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import {
  AuditAction,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { createAuditIdempotencyKey, writeAuditEvent } from '../_lib/audit.js';
import { assertCapability, requireCapability } from '../_lib/authorization.js';
import { createAccessInvitationDelivery } from '../_lib/access-invitation.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import {
  administrableAccountStatuses,
  createPrismaAccountAdministrationService,
  type AccountAdministrationService,
  type AccountTransitionResult,
} from './account-administration-service.js';
import {
  createPrismaAccessRequestReviewService,
  reviewableAccessRequestStatuses,
  type AccessRequestReviewService,
} from './access-request-review-service.js';
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
  accountAdministrationService?: AccountAdministrationService;
  accessRequestReviewService?: AccessRequestReviewService;
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
const reviewStatusSchema = z.enum(reviewableAccessRequestStatuses);
const accessRequestListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(320).optional(),
  status: reviewStatusSchema.optional(),
});
const approveAccessRequestSchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    role: z.enum(['USER', 'CREATOR', 'ADMIN']),
  })
  .strict();
const rejectAccessRequestSchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    reason: z.string().trim().min(1).max(2_000),
  })
  .strict();
const resendAccessInvitationSchema = z
  .object({ expectedVersion: z.number().int().min(1) })
  .strict();
const accountListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(320).optional(),
  status: z.enum(administrableAccountStatuses).optional(),
});
const accountTransitionSchema = z
  .object({
    expectedStatus: z.enum(administrableAccountStatuses),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

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

function handleAccountTransition(result: AccountTransitionResult) {
  if (result.kind === 'NOT_FOUND') throw notFound();
  if (result.kind === 'CONFLICT') {
    throw new ApiError(
      'ACCOUNT_STATE_CONFLICT',
      'The account status has changed. Refresh before retrying.',
      409,
    );
  }
  if (result.kind === 'SELF_SUSPENSION') {
    throw new ApiError(
      'SELF_SUSPENSION_NOT_ALLOWED',
      'The current administrator cannot suspend their own account.',
      409,
    );
  }

  return result.account;
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
  let defaultAccessRequestReviewService:
    | AccessRequestReviewService
    | undefined;
  const getAccessRequestReviewService = async () => {
    if (options.accessRequestReviewService) {
      return options.accessRequestReviewService;
    }
    if (!defaultAccessRequestReviewService) {
      const { prisma } = await import('../../prisma.js');
      defaultAccessRequestReviewService =
        createPrismaAccessRequestReviewService(prisma, {
          delivery: createAccessInvitationDelivery(),
        });
    }
    return defaultAccessRequestReviewService;
  };
  let defaultAccountAdministrationService:
    | AccountAdministrationService
    | undefined;
  const getAccountAdministrationService = async () => {
    if (options.accountAdministrationService) {
      return options.accountAdministrationService;
    }
    if (!defaultAccountAdministrationService) {
      const { prisma } = await import('../../prisma.js');
      defaultAccountAdministrationService =
        createPrismaAccountAdministrationService(prisma);
    }
    return defaultAccountAdministrationService;
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

  app.get('/api/admin/accounts', async (context) => {
    assertCapability(context.get('user').role, 'account.suspend');
    const parsed = accountListSchema.safeParse(context.req.query());
    if (!parsed.success) throw invalidRequest();

    const page = await (await getAccountAdministrationService()).list(
      parsed.data,
    );
    return context.json({ page });
  });

  app.post('/api/admin/accounts/:userId/suspend', async (context) => {
    assertCapability(context.get('user').role, 'account.suspend');
    const userId = parseIdentifier(context.req.param('userId'));
    const parsed = accountTransitionSchema.safeParse(
      await parseJson(context.req.raw),
    );
    if (!parsed.success) throw invalidRequest();

    const result = await (await getAccountAdministrationService()).suspend(
      context.get('user').id,
      userId,
      {
        expectedStatus: parsed.data.expectedStatus,
        expectedUpdatedAt: new Date(parsed.data.expectedUpdatedAt),
      },
    );
    return context.json({ account: handleAccountTransition(result) });
  });

  app.post('/api/admin/accounts/:userId/reactivate', async (context) => {
    assertCapability(context.get('user').role, 'account.suspend');
    const userId = parseIdentifier(context.req.param('userId'));
    const parsed = accountTransitionSchema.safeParse(
      await parseJson(context.req.raw),
    );
    if (!parsed.success) throw invalidRequest();

    const result = await (
      await getAccountAdministrationService()
    ).reactivate(context.get('user').id, userId, {
      expectedStatus: parsed.data.expectedStatus,
      expectedUpdatedAt: new Date(parsed.data.expectedUpdatedAt),
    });
    return context.json({ account: handleAccountTransition(result) });
  });

  app.get('/api/admin/access-requests', async (context) => {
    assertCapability(context.get('user').role, 'account.request.review');
    const parsed = accessRequestListSchema.safeParse(context.req.query());
    if (!parsed.success) throw invalidRequest();

    const page = await (
      await getAccessRequestReviewService()
    ).list(parsed.data);
    return context.json({ page });
  });

  app.post('/api/admin/access-requests/:requestId/approve', async (context) => {
    assertCapability(context.get('user').role, 'account.request.review');
    assertCapability(context.get('user').role, 'account.invitation.issue');
    assertCapability(context.get('user').role, 'account.role.assign');
    const requestId = parseIdentifier(context.req.param('requestId'));
    const parsed = approveAccessRequestSchema.safeParse(
      await parseJson(context.req.raw),
    );
    if (!parsed.success) throw invalidRequest();

    const result = await (
      await getAccessRequestReviewService()
    ).approve(context.get('user').id, requestId, parsed.data);
    if (result.kind === 'NOT_FOUND') throw notFound();
    if (result.kind === 'CONFLICT') {
      throw new ApiError(
        'ACCESS_REQUEST_CONFLICT',
        'The access request has already been reviewed or changed.',
        409,
      );
    }
    return context.json({ request: result.request });
  });

  app.post('/api/admin/access-requests/:requestId/reject', async (context) => {
    assertCapability(context.get('user').role, 'account.request.review');
    const requestId = parseIdentifier(context.req.param('requestId'));
    const parsed = rejectAccessRequestSchema.safeParse(
      await parseJson(context.req.raw),
    );
    if (!parsed.success) throw invalidRequest();

    const result = await (
      await getAccessRequestReviewService()
    ).reject(context.get('user').id, requestId, parsed.data);
    if (result.kind === 'NOT_FOUND') throw notFound();
    if (result.kind === 'CONFLICT') {
      throw new ApiError(
        'ACCESS_REQUEST_CONFLICT',
        'The access request has already been reviewed or changed.',
        409,
      );
    }
    return context.json({ request: result.request });
  });

  app.post(
    '/api/admin/access-requests/:requestId/resend-invitation',
    async (context) => {
      assertCapability(context.get('user').role, 'account.invitation.issue');
      const requestId = parseIdentifier(context.req.param('requestId'));
      const parsed = resendAccessInvitationSchema.safeParse(
        await parseJson(context.req.raw),
      );
      if (!parsed.success) throw invalidRequest();

      const result = await (
        await getAccessRequestReviewService()
      ).resend(context.get('user').id, requestId, parsed.data);
      if (result.kind === 'NOT_FOUND') throw notFound();
      if (result.kind === 'CONFLICT') {
        throw new ApiError(
          'ACCESS_REQUEST_CONFLICT',
          'The access request has already been reviewed or changed.',
          409,
        );
      }
      return context.json({ request: result.request });
    },
  );

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
