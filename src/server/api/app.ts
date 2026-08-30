import { Hono } from 'hono';

import { adminApp } from './admin/app.js';
import { aiPricingApp } from './ai-pricing/app.js';
import { correctionsApp } from './corrections/app.js';
import { accessRequestsApp } from './access-requests/app.js';
import { ApiError, toApiErrorBody } from './_lib/errors.js';
import { createRequestObservability } from './_lib/observability.js';
import {
  normalizeLoggedPath,
  reportUnexpectedError,
} from './_lib/error-reporting.js';
import { authApp } from './auth/app.js';
import { healthApp } from './health/app.js';
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

    // An unknown error used to become a bare 500 and nothing else: no stack, no
    // message, no way to tell one cause from another after the fact. The reply
    // stays deliberately opaque to the caller, but the cause is now written
    // down, correlated to the request by the same identifier the response
    // carries in X-Request-Id.
    //
    // What is logged is the error's own shape, never the request: no body, no
    // headers, no query string, no session. A stack can name a file and a line;
    // it must not name a person.
    reportUnexpectedError(error, {
      method: context.req.method,
      path: normalizeLoggedPath(context.req.url),
      requestId: context.res.headers.get('X-Request-Id'),
    });

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
  // First of all, and public: a probe must answer even when everything that
  // needs a session is failing, which is exactly when it is being read.
  app.route('/', healthApp);
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
