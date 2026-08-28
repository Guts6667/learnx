import type { MiddlewareHandler } from 'hono';

import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { AuthEnvironment } from './_lib/auth.js';
import { InvalidCursorError } from './_lib/cursor-pagination.js';
import { createConceptAssessmentsApp } from './concept-assessments/app.js';
import type { ConceptAssessmentRepository } from './concept-assessments/types.js';
import { createProgressApp } from './progress/app.js';
import { createQuizzesApp } from './quizzes/app.js';
import type { QuizRepository } from './quizzes/types.js';
import { createStageAssessmentsApp } from './stage-assessments/app.js';
import type { StageAssessmentRepository } from './stage-assessments/types.js';

const id = '11111111-1111-4111-8111-111111111111';

function authentication(): MiddlewareHandler<AuthEnvironment> {
  return async (context, next) => {
    context.set('user', {
      displayName: 'Learner',
      email: 'learner@example.com',
      id,
      role: 'USER',
    });
    await next();
  };
}

function unexpectedFailure() {
  return Promise.reject(new Error('repository unavailable'));
}

describe('progression API error boundaries', () => {
  it('normalizes unexpected concept-assessment repository failures', async () => {
    const repository: ConceptAssessmentRepository = {
      findAssessmentForUser: unexpectedFailure,
      listAttempts: vi.fn(),
      recordAttempt: vi.fn(),
    };
    const response = await createConceptAssessmentsApp({
      authentication: authentication(),
      repository,
    }).request(`/api/concept-assessments/${id}`);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'INTERNAL_ERROR' },
    });
  });

  it('normalizes unexpected quiz repository failures', async () => {
    const repository: QuizRepository = {
      findPublishedQuizForUser: unexpectedFailure,
      listAttempts: vi.fn().mockRejectedValue(new InvalidCursorError()),
      recordAttempt: vi.fn(),
    };
    const response = await createQuizzesApp({
      authentication: authentication(),
      repository,
    }).request(`/api/quizzes/${id}`);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'INTERNAL_ERROR' },
    });
  });

  it('rejects malformed quiz cursors through the public error contract', async () => {
    const repository: QuizRepository = {
      findPublishedQuizForUser: vi.fn().mockResolvedValue({
        description: null,
        id,
        isRequired: true,
        lessonId: id,
        passingScore: 80,
        position: 1,
        questions: [],
        title: 'Quiz',
      }),
      listAttempts: vi.fn().mockRejectedValue(new InvalidCursorError()),
      recordAttempt: vi.fn(),
    };
    const response = await createQuizzesApp({
      authentication: authentication(),
      repository,
    }).request(`/api/quizzes/${id}/attempts?cursor=not-a-cursor`);

    expect(response.status).toBe(400);
    expect(repository.listAttempts).toHaveBeenCalledOnce();
  });

  it('normalizes unexpected stage-assessment repository failures', async () => {
    const repository: StageAssessmentRepository = {
      createOrGetSubmission: vi.fn(),
      findAssessmentForUser: unexpectedFailure,
      findOwnedSubmission: vi.fn(),
      findPublishedAssessmentForUser: vi.fn(),
      findSubmissionForReview: vi.fn(),
      reviewSubmission: vi.fn(),
      saveSubmission: vi.fn(),
      submitSubmission: vi.fn(),
    };
    const response = await createStageAssessmentsApp({
      authentication: authentication(),
      repository,
    }).request(`/api/stages/${id}/assessment`);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'INTERNAL_ERROR' },
    });
  });

  it('normalizes unexpected progress-client failures', async () => {
    const response = await createProgressApp({
      authentication: authentication(),
      getClient: () => unexpectedFailure() as Promise<PrismaClient>,
    }).request(`/api/lessons/${id}/progress`);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'INTERNAL_ERROR' },
    });
  });
});
