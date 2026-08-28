import { Hono } from 'hono';

import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { requireCapability } from '../_lib/authorization.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import { refreshStageValidation } from '../_lib/stage-validation.js';
import { createPrismaStageAssessmentRepository } from './repository.js';
import { registerStageAssessmentRoutes } from './routes.js';
import { createStageAssessmentService } from './service.js';
import type {
  StageAssessmentAppOptions,
  StageAssessmentRepository,
} from './types.js';

async function getPrismaClient(): Promise<PrismaClient> {
  const { prisma } = await import('../../prisma.js');
  return prisma;
}

function registerErrorHandler(app: Hono<AuthEnvironment>) {
  app.onError((error, context) => {
    if (error instanceof ApiError)
      return context.json(toApiErrorBody(error), error.status);
    return context.json(
      toApiErrorBody(
        new ApiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500),
      ),
      500,
    );
  });
}

export function createStageAssessmentsApp(
  options: StageAssessmentAppOptions = {},
) {
  const app = new Hono<AuthEnvironment>();
  const now = options.now ?? (() => new Date());
  let defaultRepository: StageAssessmentRepository | undefined;
  const getRepository = async () => {
    if (options.repository) return options.repository;
    defaultRepository ??= createPrismaStageAssessmentRepository(
      await getPrismaClient(),
    );
    return defaultRepository;
  };
  const refreshValidation =
    options.refreshValidation ??
    (options.repository
      ? async () => undefined
      : async (stageId: string, userId: string, refreshedAt: Date) => {
          await refreshStageValidation(
            await getPrismaClient(),
            stageId,
            userId,
            refreshedAt,
          );
        });
  const getService = async () =>
    createStageAssessmentService({
      now,
      refreshValidation,
      repository: await getRepository(),
    });

  app.use('*', options.authentication ?? requireUser);
  app.use('*', requireCapability('learning.read'));
  registerErrorHandler(app);
  registerStageAssessmentRoutes(app, getService);
  return app;
}

export { createPrismaStageAssessmentRepository } from './repository.js';
export type { StageAssessmentRepository } from './types.js';
export const stageAssessmentsApp = createStageAssessmentsApp();
