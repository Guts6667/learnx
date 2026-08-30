import { Hono } from 'hono';

import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { requireCapability } from '../_lib/authorization.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import { createPrismaExerciseRepository } from './repository.js';
import {
  registerExerciseRoutes,
  registerExerciseSubmissionRoutes,
} from './routes.js';
import { createExerciseService } from './service.js';
import type { ExerciseRepository, ExercisesAppOptions } from './types.js';

async function getPrismaClient(): Promise<PrismaClient> {
  const { prisma } = await import('../../prisma.js');
  return prisma;
}

function normalizeExerciseError(error: Error): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
}

export function createExercisesApp(options: ExercisesAppOptions = {}) {
  const app = new Hono<AuthEnvironment>();
  const now = options.now ?? (() => new Date());
  let defaultRepository: ExerciseRepository | undefined;
  const getRepository = async () => {
    if (options.repository) return options.repository;
    defaultRepository ??= createPrismaExerciseRepository(
      await getPrismaClient(),
    );
    return defaultRepository;
  };
  const getService = async () =>
    createExerciseService(await getRepository(), now);

  // Scoped to the routes this app serves, never `*`: a wildcard guard runs for
  // every request reaching the app and so authenticates whatever is mounted
  // after it (V4.5-186). A route missing from this list is unguarded, and
  // `route-guards.test.ts` names it.
  const guardedPaths = [
    '/api/exercise-submissions/:submissionId',
    '/api/exercise-submissions/:submissionId/submit',
    '/api/exercises/:exerciseId',
    '/api/exercises/:exerciseId/submissions',
  ] as const;

  for (const path of guardedPaths) {
    app.use(path, options.authentication ?? requireUser);
    app.use(path, requireCapability('learning.read'));
  }
  app.onError((error, context) => {
    const apiError = normalizeExerciseError(error);
    return context.json(toApiErrorBody(apiError), apiError.status);
  });
  registerExerciseRoutes(app, getService);
  registerExerciseSubmissionRoutes(app, getService);
  return app;
}

export { createPrismaExerciseRepository } from './repository.js';
export type { ExerciseRepository } from './types.js';

export const exercisesApp = createExercisesApp();
