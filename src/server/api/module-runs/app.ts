import { Hono } from 'hono';

import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { assertCapability, requireCapability } from '../_lib/authorization.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import { createPrismaModuleRestartRepository } from './module-service.js';
import { createPrismaProgramRestartRepository } from './program-service.js';
import type { ModuleRunsAppOptions } from './types.js';
import {
  invalidRestartRequest,
  parseRestartBody,
  parseRestartIdentifier,
  restartResourceNotFound,
} from './validation.js';

export { createPrismaModuleRestartRepository } from './module-service.js';
export { createPrismaProgramRestartRepository } from './program-service.js';
export type {
  ModuleRestartPreview,
  ModuleRestartRepository,
  ModuleRestartResult,
  ProgramRestartPreview,
  ProgramRestartRepository,
  ProgramRestartResult,
} from './types.js';

async function getRepository() {
  const { prisma } = await import('../../prisma.js');
  return createPrismaModuleRestartRepository(prisma);
}

async function getProgramRepository() {
  const { prisma } = await import('../../prisma.js');
  return createPrismaProgramRestartRepository(prisma);
}

export function createModuleRunsApp(options: ModuleRunsAppOptions = {}) {
  const app = new Hono<AuthEnvironment>();
  app.use('*', options.authentication ?? requireUser);
  app.use('*', requireCapability('learning.read'));
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

  app.get('/api/modules/:moduleId/restart-preview', async (context) => {
    const moduleId = parseRestartIdentifier(context.req.param('moduleId'));
    const repository = options.repository ?? (await getRepository());
    const preview = await repository.preview(moduleId, context.get('user').id);
    if (!preview) throw restartResourceNotFound();
    return context.json({ preview });
  });

  app.post('/api/modules/:moduleId/restart', async (context) => {
    assertCapability(context.get('user').role, 'learning.write.own');
    const moduleId = parseRestartIdentifier(context.req.param('moduleId'));
    const parsed = await parseRestartBody(context.req.raw);
    if (!parsed.success) throw invalidRestartRequest();
    const repository = options.repository ?? (await getRepository());
    const result = await repository.restart(
      moduleId,
      parsed.data.restartKey,
      context.get('user').id,
    );
    if (!result) throw restartResourceNotFound();
    return context.json({ result });
  });

  app.get('/api/programs/:programId/restart-preview', async (context) => {
    const programId = parseRestartIdentifier(context.req.param('programId'));
    const repository =
      options.programRepository ?? (await getProgramRepository());
    const preview = await repository.preview(
      programId,
      context.get('user').id,
    );
    if (!preview) throw restartResourceNotFound();
    return context.json({ preview });
  });

  app.post('/api/programs/:programId/restart', async (context) => {
    assertCapability(context.get('user').role, 'learning.write.own');
    const programId = parseRestartIdentifier(context.req.param('programId'));
    const parsed = await parseRestartBody(context.req.raw);
    if (!parsed.success) throw invalidRestartRequest();
    const repository =
      options.programRepository ?? (await getProgramRepository());
    const result = await repository.restart(
      programId,
      parsed.data.restartKey,
      context.get('user').id,
    );
    if (!result) throw restartResourceNotFound();
    return context.json({ result });
  });

  return app;
}

export const moduleRunsApp = createModuleRunsApp();
