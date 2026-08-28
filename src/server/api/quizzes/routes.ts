import type { Hono } from 'hono';

import type { AuthEnvironment } from '../_lib/auth.js';
import { assertCapability } from '../_lib/authorization.js';
import { cursorPageQuerySchema } from '../_lib/cursor-pagination.js';
import { serializeAttempt, serializeQuiz } from './serialization.js';
import { submitQuizAttempt } from './service.js';
import type { QuizRepository } from './types.js';
import {
  invalidQuizRequest,
  parseQuizAttempt,
  parseQuizIdentifier,
  quizNotFound,
} from './validation.js';

type GetQuizRepository = () => Promise<QuizRepository>;

function createQuizLookup(getRepository: GetQuizRepository) {
  return async (context: {
    get(key: 'user'): { id: string };
    req: { param(name: string): string };
  }) => {
    const quizId = parseQuizIdentifier(context.req.param('quizId'));
    const repository = await getRepository();
    const quiz = await repository.findPublishedQuizForUser(
      quizId,
      context.get('user').id,
    );
    if (!quiz) throw quizNotFound();
    return { quiz, quizId, repository };
  };
}

export function registerQuizRoutes(
  app: Hono<AuthEnvironment>,
  getRepository: GetQuizRepository,
  now: () => Date,
) {
  const getQuiz = createQuizLookup(getRepository);
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
}
