import type { Hono } from 'hono';

import type { AuthEnvironment } from '../_lib/auth.js';
import { assertCapability } from '../_lib/authorization.js';
import { ApiError } from '../_lib/errors.js';
import type { AdminDependencies } from './app-contracts.js';
import {
  PublicationPlanBlockedError,
  PublicationPlanStaleError,
} from './publication-service.js';
import {
  applyPublicationSchema,
  notFound,
  parseBody,
  publicationRequestSchema,
} from './validation.js';

function mapPublicationError(error: unknown): never {
  if (error instanceof PublicationPlanStaleError) {
    throw new ApiError(
      'PUBLICATION_PLAN_STALE',
      'The publication preview is no longer current.',
      409,
    );
  }
  if (error instanceof PublicationPlanBlockedError) {
    throw new ApiError(
      'PUBLICATION_BLOCKED',
      'Publication requirements are not satisfied.',
      409,
    );
  }
  throw error;
}

export function registerPublicationRoutes(
  app: Hono<AuthEnvironment>,
  dependencies: AdminDependencies,
) {
  app.post('/api/admin/publication/preview', async (context) => {
    assertCapability(context.get('user').role, 'program.admin.publish');
    const input = await parseBody(publicationRequestSchema, context.req.raw);
    const plan = await (
      await dependencies.publication()
    ).preview(context.get('user').id, input);
    if (!plan) throw notFound();
    return context.json({ plan });
  });

  app.post('/api/admin/publication/apply', async (context) => {
    assertCapability(context.get('user').role, 'program.admin.publish');
    const input = await parseBody(applyPublicationSchema, context.req.raw);
    try {
      const plan = await (
        await dependencies.publication()
      ).apply(context.get('user').id, input);
      if (!plan) throw notFound();
      return context.json({ plan });
    } catch (error) {
      return mapPublicationError(error);
    }
  });
}

