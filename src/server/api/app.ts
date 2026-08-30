import { Hono } from 'hono';

import { adminApp } from './admin/app.js';
import { aiPricingApp } from './ai-pricing/app.js';
import { correctionsApp } from './corrections/app.js';
import { accessRequestsApp } from './access-requests/app.js';
import { ApiError, toApiErrorBody } from './_lib/errors.js';
import { createRequestObservability } from './_lib/observability.js';
import { authApp } from './auth/app.js';
import { catalogApp } from './catalog/app.js';
import { conceptAssessmentsApp } from './concept-assessments/app.js';
import { creditsApp } from './credits/app.js';
import { conceptsApp } from './concepts/app.js';
import { exercisesApp } from './exercises/app.js';
import { moduleRunsApp } from './module-runs/app.js';
import { notesApp } from './notes/app.js';
import { curriculumApp } from './programs/app.js';
import { progressApp } from './progress/app.js';
import { createCheckoutRoute } from './credits/checkout-route.js';
import { paymentsApp } from './payments/app.js';
import { publicLeadsApp } from './public-leads/app.js';
import { quizzesApp } from './quizzes/app.js';
import { reviewsApp } from './reviews/app.js';
import { stageAssessmentsApp } from './stage-assessments/app.js';
import { todayApp } from './today/app.js';

function createApiApp() {
  const app = new Hono();

  app.use('*', createRequestObservability());
  app.use('*', async (context, next) => {
    await next();
    context.header('Cache-Control', 'private, no-store');
  });

  app.onError((error, context) => {
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

  // Public routes are mounted first, deliberately. Several feature apps apply
  // `app.use('*', requireUser)`, and a wildcard middleware runs for every
  // request that reaches its mount point — so anything mounted after one of
  // them inherits authentication whether it wants it or not. That is how
  // `/api/public-leads` came to demand a session from visitors who by
  // definition have no account, and how the landing funnel was answering 401
  // in production (V4.5-186).
  //
  // Ordering is the hotfix, not the cure: the next public route added at the
  // bottom would break the same way and just as silently. V4.5-187 scopes those
  // middlewares to their own prefixes so the trap stops existing.
  app.route('/', authApp);
  app.route('/', publicLeadsApp);
  app.route('/', paymentsApp);
  app.route('/', accessRequestsApp);
  app.route('/', adminApp);
  app.route('/', aiPricingApp);
  app.route('/', correctionsApp);
  app.route('/', catalogApp);
  app.route('/', curriculumApp);
  app.route('/', progressApp);
  app.route('/', createCheckoutRoute());
  app.route('/', conceptsApp);
  app.route('/', conceptAssessmentsApp);
  app.route('/', creditsApp);
  app.route('/', quizzesApp);
  app.route('/', exercisesApp);
  app.route('/', moduleRunsApp);
  app.route('/', stageAssessmentsApp);
  app.route('/', notesApp);
  app.route('/', reviewsApp);
  app.route('/', todayApp);

  return app;
}

export const apiApp = createApiApp();
