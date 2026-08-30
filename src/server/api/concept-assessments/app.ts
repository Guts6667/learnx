import { Hono } from 'hono';

import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { assertCapability, requireCapability } from '../_lib/authorization.js';
import {
  cursorPageQuerySchema,
  InvalidCursorError,
} from '../_lib/cursor-pagination.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import { createPrismaRepository } from './repository.js';
import { serializeAssessment, serializeAttempt } from './serialization.js';
import { submitConceptAssessment } from './service.js';
import type {
  ConceptAssessmentRepository,
  ConceptAssessmentsAppOptions,
} from './types.js';
import {
  assessmentNotFound,
  invalidAssessmentRequest,
  isAssessmentPreviewRequest,
  parseAssessmentAttempt,
  parseAssessmentIdentifier,
} from './validation.js';

export { createPrismaRepository } from './repository.js';
export type { ConceptAssessmentRepository } from './types.js';

async function getPrismaRepository(): Promise<ConceptAssessmentRepository> {
  const { prisma } = await import('../../prisma.js');
  return createPrismaRepository(prisma);
}

export function createConceptAssessmentsApp(
  options: ConceptAssessmentsAppOptions = {},
) {
  const app = new Hono<AuthEnvironment>();
  const now = options.now ?? (() => new Date());
  const refreshValidation =
    options.refreshValidation ?? (async () => undefined);
  // Scoped to the routes this app serves, never `*`: a wildcard guard runs for
  // every request reaching the app and so authenticates whatever is mounted
  // after it (V4.5-186). A route missing from this list is unguarded, and
  // `route-guards.test.ts` names it.
  const guardedPaths = [
    '/api/concept-assessments/:assessmentId',
    '/api/concept-assessments/:assessmentId/attempts',
  ] as const;

  for (const path of guardedPaths) {
    app.use(path, options.authentication ?? requireUser);
    app.use(path, requireCapability('learning.read'));
  }
  app.onError((error, context) => {
    if (error instanceof InvalidCursorError) {
      const apiError = invalidAssessmentRequest();
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

  async function getAssessment(context: {
    get(key: 'user'): AuthEnvironment['Variables']['user'];
    req: { param(name: string): string; url: string };
  }) {
    const assessmentId = parseAssessmentIdentifier(
      context.req.param('assessmentId'),
    );
    const repository = options.repository ?? (await getPrismaRepository());
    const preview = isAssessmentPreviewRequest(context.req.url);
    const assessment = await repository.findAssessmentForUser(
      assessmentId,
      context.get('user').id,
      preview,
    );
    if (!assessment) throw assessmentNotFound();
    return { assessment, assessmentId, preview, repository };
  }

  app.get('/api/concept-assessments/:assessmentId', async (context) => {
    const { assessment } = await getAssessment(context);
    return context.json({ assessment: serializeAssessment(assessment) });
  });

  app.get(
    '/api/concept-assessments/:assessmentId/attempts',
    async (context) => {
      const { assessmentId, preview, repository } =
        await getAssessment(context);
      const query = cursorPageQuerySchema.safeParse(context.req.query());
      if (!query.success) throw invalidAssessmentRequest();
      const page = await repository.listAttempts({
        ...query.data,
        assessmentId,
        preview,
        userId: context.get('user').id,
      });
      return context.json({
        attempts: page.items.map(serializeAttempt),
        nextCursor: page.nextCursor,
      });
    },
  );

  app.post(
    '/api/concept-assessments/:assessmentId/attempts',
    async (context) => {
      assertCapability(context.get('user').role, 'learning.write.own');
      const parsedAttempt = await parseAssessmentAttempt(context.req.raw);
      if (!parsedAttempt.success) throw invalidAssessmentRequest();
      const { assessment, assessmentId, preview, repository } =
        await getAssessment(context);
      const submittedAt = now();
      const result = await submitConceptAssessment({
        answers: parsedAttempt.data.answers,
        assessment,
        assessmentId,
        preview,
        repository,
        submittedAt,
        userId: context.get('user').id,
      });
      await refreshValidation(
        assessment.concept.stageId,
        context.get('user').id,
        submittedAt,
      );
      return context.json(
        {
          attempt: serializeAttempt(result.recorded.attempt),
          corrections: result.corrections,
          progress: result.recorded.progress,
        },
        201,
      );
    },
  );

  return app;
}

export const conceptAssessmentsApp = createConceptAssessmentsApp();
