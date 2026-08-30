import { Hono } from 'hono';

import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { requireCapability } from '../_lib/authorization.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import { createPrismaTodayRepository } from './repository.js';
import { getTodayDashboard } from './service.js';
import type { TodayAppOptions, TodayRepository } from './types.js';
import { parseTodayTimeZone } from './validation.js';

export type { TodayRepository } from './types.js';
export { createPrismaTodayRepository } from './repository.js';

async function getPrismaClient(): Promise<PrismaClient> {
  const { prisma } = await import('../../prisma.js');
  return prisma;
}

export function createTodayApp(options: TodayAppOptions = {}) {
  const app = new Hono<AuthEnvironment>();
  const now = options.now ?? (() => new Date());
  let defaultRepository: TodayRepository | undefined;
  const getRepository = async () => {
    if (options.repository) return options.repository;
    defaultRepository ??= createPrismaTodayRepository(await getPrismaClient());
    return defaultRepository;
  };

  // Scoped to the routes this app serves, never `*`: a wildcard guard runs for
  // every request reaching the app and so authenticates whatever is mounted
  // after it (V4.5-186). A route missing from this list is unguarded, and
  // `route-guards.test.ts` names it.
  const guardedPaths = ['/api/today'] as const;

  for (const path of guardedPaths) {
    app.use(path, options.authentication ?? requireUser);
    app.use(path, requireCapability('learning.read'));
  }
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

  app.get('/api/today', async (context) => {
    const timeZone = parseTodayTimeZone(context.req.url);
    const dashboard = await getTodayDashboard(
      await getRepository(),
      context.get('user').id,
      now(),
      timeZone,
    );
    return context.json(dashboard);
  });

  return app;
}

export const todayApp = createTodayApp();
