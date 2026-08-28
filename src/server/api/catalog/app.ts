import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import {
  ProgramEnrollmentStatus,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { requireCapability } from '../_lib/authorization.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import {
  createPrismaProgramDirectoryService,
  InvalidProgramDirectoryCursorError,
  type ProgramDirectoryService,
} from '../_lib/program-directory/index.js';
import {
  createPrismaProgramEnrollmentService,
  type ProgramEnrollmentService,
  type ProgramEnrollmentSummary,
} from '../_lib/program-enrollment.js';
import { normalizeLocale } from '../../../shared/locale.js';

const directoryQuerySchema = z.object({
  cursor: z.string().min(1).max(1_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().max(100).optional(),
});

const catalogQuerySchema = directoryQuerySchema.extend({
  locale: z.enum(['fr', 'en']).optional(),
});

const enrolledQuerySchema = directoryQuerySchema.extend({
  status: z.nativeEnum(ProgramEnrollmentStatus).default(
    ProgramEnrollmentStatus.ACTIVE,
  ),
});

const programIdentifierSchema = z.string().uuid();

interface CatalogAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  directoryService?: ProgramDirectoryService;
  enrollmentService?: ProgramEnrollmentService;
  getClient?: () => Promise<PrismaClient>;
}

async function getPrismaClient(): Promise<PrismaClient> {
  const { prisma } = await import('../../prisma.js');
  return prisma;
}

function invalidRequest() {
  return new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
}

function notFound() {
  return new ApiError('RESOURCE_NOT_FOUND', 'Resource not found.', 404);
}

function serializeEnrollment(enrollment: ProgramEnrollmentSummary) {
  return {
    ...enrollment,
    enrolledAt: enrollment.enrolledAt.toISOString(),
    withdrawnAt: enrollment.withdrawnAt?.toISOString() ?? null,
  };
}

export function createCatalogApp(options: CatalogAppOptions = {}) {
  const app = new Hono<AuthEnvironment>();
  const getClient = options.getClient ?? getPrismaClient;
  let directoryService = options.directoryService;
  let enrollmentService = options.enrollmentService;

  const getDirectoryService = async () => {
    directoryService ??= createPrismaProgramDirectoryService(await getClient());
    return directoryService;
  };
  const getEnrollmentService = async () => {
    enrollmentService ??= createPrismaProgramEnrollmentService(
      await getClient(),
    );
    return enrollmentService;
  };

  app.use('*', options.authentication ?? requireUser);
  app.onError((error, context) => {
    const apiError =
      error instanceof InvalidProgramDirectoryCursorError
        ? invalidRequest()
        : error;
    if (apiError instanceof ApiError) {
      return context.json(toApiErrorBody(apiError), apiError.status);
    }
    return context.json(
      toApiErrorBody(
        new ApiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500),
      ),
      500,
    );
  });

  app.get(
    '/api/catalog/programs',
    requireCapability('program.catalog.read'),
    async (context) => {
      const query = catalogQuerySchema.safeParse(context.req.query());
      if (!query.success) throw invalidRequest();
      const user = context.get('user');
      const page = await (
        await getDirectoryService()
      ).listCatalog({
        ...query.data,
        locale: normalizeLocale(query.data.locale ?? user.locale),
        userId: user.id,
      });
      return context.json(page);
    },
  );

  app.get(
    '/api/me/programs',
    requireCapability('program.catalog.read'),
    async (context) => {
      const query = enrolledQuerySchema.safeParse(context.req.query());
      if (!query.success) throw invalidRequest();
      const user = context.get('user');
      const page = await (
        await getDirectoryService()
      ).listEnrolled({ ...query.data, userId: user.id });
      return context.json(page);
    },
  );

  app.post(
    '/api/programs/:programId/enrollment',
    requireCapability('program.enroll'),
    async (context) => {
      const programId = programIdentifierSchema.safeParse(
        context.req.param('programId'),
      );
      if (!programId.success) throw invalidRequest();
      const enrollment = await (
        await getEnrollmentService()
      ).enroll(context.get('user').id, programId.data);
      if (!enrollment) throw notFound();
      return context.json({ enrollment: serializeEnrollment(enrollment) });
    },
  );

  app.delete(
    '/api/programs/:programId/enrollment',
    requireCapability('program.enroll'),
    async (context) => {
      const programId = programIdentifierSchema.safeParse(
        context.req.param('programId'),
      );
      if (!programId.success) throw invalidRequest();
      const enrollment = await (
        await getEnrollmentService()
      ).withdraw(context.get('user').id, programId.data);
      if (!enrollment) throw notFound();
      return context.json({ enrollment: serializeEnrollment(enrollment) });
    },
  );

  return app;
}

export const catalogApp = createCatalogApp();
