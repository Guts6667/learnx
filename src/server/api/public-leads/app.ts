import { Hono, type MiddlewareHandler } from 'hono';

import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import {
  SharedAccessRequestRateLimiter,
  type AccessRequestRateLimiter,
} from '../_lib/access-request-rate-limit.js';
import {
  createPublicLeadConversionHandler,
  createPublicLeadExportHandler,
  createPublicLeadListHandler,
  createPublicLeadRequestHandler,
  createPublicLeadTokenHandler,
} from './handlers.js';
import {
  createPublicLeadServiceDependencies,
  prismaPublicLeadRepository,
  type PublicLeadRepository,
  type PublicLeadServiceDependencies,
} from './service.js';

interface PublicLeadsAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  dependencies?: PublicLeadServiceDependencies;
  rateLimiter?: AccessRequestRateLimiter;
  repository?: PublicLeadRepository;
}

const limiter = new SharedAccessRequestRateLimiter();

export function createPublicLeadsApp(options: PublicLeadsAppOptions = {}) {
  const app = new Hono<AuthEnvironment>();
  const repository = options.repository ?? prismaPublicLeadRepository;
  const authentication = options.authentication ?? requireUser;
  const dependencies =
    options.dependencies ?? createPublicLeadServiceDependencies();
  const rateLimiter = options.rateLimiter ?? limiter;

  app.onError((error, context) => {
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500);
    return context.json(toApiErrorBody(apiError), apiError.status);
  });
  app.post(
    '/api/public-leads',
    createPublicLeadRequestHandler(dependencies, rateLimiter),
  );
  app.post(
    '/api/public-leads/confirm',
    createPublicLeadTokenHandler('confirm', repository),
  );
  app.post(
    '/api/public-leads/unsubscribe',
    createPublicLeadTokenHandler('unsubscribe', repository),
  );
  app.post(
    '/api/public-leads/delete',
    createPublicLeadTokenHandler('delete', repository),
  );
  app.use('/api/admin/public-leads/*', authentication);
  app.get(
    '/api/admin/public-leads',
    authentication,
    createPublicLeadListHandler(repository),
  );
  app.get(
    '/api/admin/public-leads/export',
    createPublicLeadExportHandler(repository),
  );
  app.post(
    '/api/admin/public-leads/:leadId/convert-to-access-request',
    createPublicLeadConversionHandler(repository),
  );
  return app;
}

export const publicLeadsApp = createPublicLeadsApp();
