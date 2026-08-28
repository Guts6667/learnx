import { Hono } from 'hono';

import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { requireCapability } from '../_lib/authorization.js';
import { InvalidCursorError } from '../_lib/cursor-pagination.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import { createPrismaRepository } from './repository.js';
import { registerQuizRoutes } from './routes.js';
import type { QuizRepository, QuizzesAppOptions } from './types.js';
import { invalidQuizRequest } from './validation.js';

export { createPrismaRepository } from './repository.js';
export type { QuizRepository } from './types.js';

async function getPrismaRepository(): Promise<QuizRepository> {
  const { prisma } = await import('../../prisma.js');
  return createPrismaRepository(prisma);
}

function installQuizErrorHandling(app: Hono<AuthEnvironment>) {
  app.onError((error, context) => {
    if (error instanceof InvalidCursorError) {
      const apiError = invalidQuizRequest();
      return context.json(toApiErrorBody(apiError), apiError.status);
    }
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
}

export function createQuizzesApp(options: QuizzesAppOptions = {}) {
  const app = new Hono<AuthEnvironment>();
  const getRepository = async () => options.repository
    ?? getPrismaRepository();
  app.use('*', options.authentication ?? requireUser);
  app.use('*', requireCapability('learning.read'));
  installQuizErrorHandling(app);
  registerQuizRoutes(app, getRepository, options.now ?? (() => new Date()));

  return app;
}

export const quizzesApp = createQuizzesApp();
