import { Hono } from 'hono';

import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { assertCapability, requireCapability } from '../_lib/authorization.js';
import {
  cursorPageQuerySchema,
  InvalidCursorError,
} from '../_lib/cursor-pagination.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import { createPrismaRepository } from './repository.js';
import { serializeAttempt, serializeQuiz } from './serialization.js';
import { submitQuizAttempt } from './service.js';
import type { QuizRepository, QuizzesAppOptions } from './types.js';
import {
  invalidQuizRequest,
  parseQuizAttempt,
  parseQuizIdentifier,
  quizNotFound,
} from './validation.js';

export { createPrismaRepository } from './repository.js';
export type { QuizRepository } from './types.js';

async function getPrismaRepository(): Promise<QuizRepository> {
  const { prisma } = await import('../../prisma.js');
  return createPrismaRepository(prisma);
}

export function createQuizzesApp(options: QuizzesAppOptions = {}) {
  const app = new Hono<AuthEnvironment>();
  const now = options.now ?? (() => new Date());
  app.use('*', options.authentication ?? requireUser);
  app.use('*', requireCapability('learning.read'));
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

  async function getQuiz(context: {
    get(key: 'user'): { id: string };
    req: { param(name: string): string };
  }) {
    const quizId = parseQuizIdentifier(context.req.param('quizId'));
    const repository = options.repository ?? (await getPrismaRepository());
    const quiz = await repository.findPublishedQuizForUser(
      quizId,
      context.get('user').id,
    );
    if (!quiz) throw quizNotFound();
    return { quiz, quizId, repository };
  }

  app.get('/api/quizzes/:quizId', async (context) => {
    const { quiz } = await getQuiz(context);
    return context.json({ quiz: serializeQuiz(quiz) });
  });

  app.get('/api/quizzes/:quizId/attempts', async (context) => {
    const { quizId, repository } = await getQuiz(context);
    const query = cursorPageQuerySchema.safeParse(context.req.query());
    if (!query.success) throw invalidQuizRequest();
    const page = await repository.listAttempts({
      ...query.data,
      quizId,
      userId: context.get('user').id,
    });
    return context.json({
      attempts: page.items.map(serializeAttempt),
      nextCursor: page.nextCursor,
    });
  });

  app.post('/api/quizzes/:quizId/attempts', async (context) => {
    assertCapability(context.get('user').role, 'learning.write.own');
    const parsedAttempt = await parseQuizAttempt(context.req.raw);
    if (!parsedAttempt.success) throw invalidQuizRequest();
    const { quiz, quizId, repository } = await getQuiz(context);
    const result = await submitQuizAttempt({
      answers: parsedAttempt.data.answers,
      now: now(),
      quiz,
      quizId,
      repository,
      userId: context.get('user').id,
    });
    return context.json(
      {
        attempt: serializeAttempt(result.attempt),
        corrections: result.corrections,
      },
      201,
    );
  });

  return app;
}

export const quizzesApp = createQuizzesApp();
