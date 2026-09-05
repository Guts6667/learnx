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
import { captureUnexpectedError } from './_lib/sentry.js';
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
import { publicCatalogueApp } from './public-catalogue/app.js';
import { paymentsApp } from './payments/app.js';
import { publicLeadsApp } from './public-leads/app.js';
import { quizzesApp } from './quizzes/app.js';
import { reviewsApp } from './reviews/app.js';
import { stageAssessmentsApp } from './stage-assessments/app.js';
import { todayApp } from './today/app.js';

function createApiApp() {
  const app = new Hono();

  app.use('*', createRequestObservability());
  // The default, and only the default. It runs after the handler, so setting it
  // unconditionally overwrote whatever the handler had decided — which is what
  // it did to `/api/public/credit-packs`: that route asks for
  // `public, max-age=300` so the landing does not hit the database on every
  // visit, and served `private, no-store` instead. The five-minute shared cache
  // designed in V4.5-206 never existed.
  //
  // `private, no-store` stays the answer for everything that does not decide
  // for itself, which is every authenticated route: a default that has to be
  // remembered is not a default.
  app.use('*', async (context, next) => {
    await next();
    if (!context.res.headers.has('cache-control')) {
      context.header('Cache-Control', 'private, no-store');
    }
  });

  app.onError(async (error, context) => {
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
    const event = reportUnexpectedError(error, {
      method: context.req.method,
      path: normalizeLoggedPath(context.req.url),
      requestId: context.res.headers.get('X-Request-Id'),
    });

    // Awaited, not fired and forgotten: a serverless invocation is frozen the
    // moment it answers, so an unflushed event never leaves. It is bounded and
    // it cannot reject, so the caller still gets its 500 either way.
    await captureUnexpectedError(error, event);

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
  //
  // Et ce n'était pas une régression : `catalogApp` a pris son garde-fou
  // générique le 5 août 2026 (bb424544), `publicLeadsApp` a été monté en
  // dessous le 10 août (a60ba17f). Le formulaire était donc derrière une
  // session depuis sa mise en ligne — il n'a jamais répondu une seule fois en
  // production.
  // First of all, and public: a probe must answer even when everything that
  // needs a session is failing, which is exactly when it is being read.
  app.route('/', healthApp);
  app.route('/', authApp);
  app.route('/', publicLeadsApp);
  // Public too, and read-only: the price list the landing page shows. It reads
  // the same catalogue as the authenticated screen, through the same reader.
  app.route('/', publicCatalogueApp);
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
