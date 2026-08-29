import { Hono } from 'hono';

import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { requireCapability } from '../_lib/authorization.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import { registerAccessRequestRoutes } from './access-request-routes.js';
import { registerAccountRoutes } from './account-routes.js';
import { registerPaymentRefundRoutes } from './payment-refund-routes.js';
import type { AdminAppOptions } from './app-contracts.js';
import { registerCurriculumEditRoutes } from './curriculum-edit-routes.js';
import { createAdminDependencies } from './dependencies.js';
import { registerNavigationRoutes } from './navigation-routes.js';
import { registerProgramRoutes } from './program-routes.js';
import { registerPublicationRoutes } from './publication-routes.js';

export type { AdminRepository } from './curriculum-edit-types.js';

function registerErrorHandler(app: Hono<AuthEnvironment>) {
  app.onError((error, context) => {
    if (error instanceof ApiError) {
      return context.json(toApiErrorBody(error), error.status);
    }
    console.error(error);
    return context.json(
      toApiErrorBody(
        new ApiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500),
      ),
      500,
    );
  });
}

export function createAdminApp(options: AdminAppOptions = {}) {
  const app = new Hono<AuthEnvironment>();
  const dependencies = createAdminDependencies(options);

  app.use('/api/admin/*', options.authentication ?? requireUser);
  app.use('/api/admin/*', requireCapability('program.admin.read'));
  registerErrorHandler(app);
  registerNavigationRoutes(app, dependencies);
  registerAccountRoutes(app, dependencies);
  registerPaymentRefundRoutes(app);
  registerAccessRequestRoutes(app, dependencies);
  registerProgramRoutes(app, dependencies);
  registerPublicationRoutes(app, dependencies);
  registerCurriculumEditRoutes(app, dependencies);
  return app;
}

export const adminApp = createAdminApp();
