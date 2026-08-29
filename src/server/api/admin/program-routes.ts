import type { Hono } from 'hono';

import type { AuthEnvironment } from '../_lib/auth.js';
import { assertCapability } from '../_lib/authorization.js';
import { ApiError } from '../_lib/errors.js';
import type { AdminDependencies } from './app-contracts.js';
import {
  notFound,
  parseBody,
  parseIdentifier,
  programVisibilityUpdateSchema,
  translationWorkflowTransitionSchema,
} from './validation.js';

function visibilityConflict() {
  return new ApiError(
    'PROGRAM_VISIBILITY_CONFLICT',
    'Program visibility changed. Refresh before retrying.',
    409,
  );
}

function translationError(
  kind: 'CONFLICT' | 'INVALID_SOURCE' | 'INVALID_TRANSITION',
) {
  if (kind === 'CONFLICT') {
    return new ApiError(
      'TRANSLATION_WORKFLOW_CONFLICT',
      'The translation workflow changed. Refresh before retrying.',
      409,
    );
  }
  if (kind === 'INVALID_SOURCE') {
    return new ApiError(
      'INVALID_TRANSLATION_SOURCE',
      'The source must be a published French version of the same canonical program.',
      409,
    );
  }
  return new ApiError(
    'INVALID_TRANSLATION_TRANSITION',
    'The requested translation workflow transition is not allowed.',
    409,
  );
}

export function registerProgramRoutes(
  app: Hono<AuthEnvironment>,
  dependencies: AdminDependencies,
) {
  app.patch('/api/admin/programs/:programId/visibility', async (context) => {
    assertCapability(context.get('user').role, 'program.admin.edit');
    const programId = parseIdentifier(context.req.param('programId'));
    const input = await parseBody(
      programVisibilityUpdateSchema,
      context.req.raw,
    );
    const result = await (
      await dependencies.programVisibility()
    ).update(context.get('user').id, programId, {
      expectedUpdatedAt: new Date(input.expectedUpdatedAt),
      visibility: input.visibility,
    });
    if (result.kind === 'NOT_FOUND') throw notFound();
    if (result.kind === 'CONFLICT') throw visibilityConflict();
    return context.json({ program: result.program });
  });

  app.get(
    '/api/admin/programs/:programId/translation-workflow',
    async (context) => {
      const workflow = await (
        await dependencies.translationWorkflow()
      ).find(
        parseIdentifier(context.req.param('programId')),
        context.get('user').id,
      );
      if (!workflow) throw notFound();
      return context.json({ workflow });
    },
  );

  app.post(
    '/api/admin/programs/:programId/translation-workflow',
    async (context) => {
      assertCapability(context.get('user').role, 'program.admin.edit');
      const programId = parseIdentifier(context.req.param('programId'));
      const input = await parseBody(
        translationWorkflowTransitionSchema,
        context.req.raw,
      );
      const result = await (
        await dependencies.translationWorkflow()
      ).transition(context.get('user').id, programId, input);
      if (result.kind === 'NOT_FOUND') throw notFound();
      if (result.kind !== 'APPLIED') {
        throw translationError(result.kind);
      }
      return context.json({ workflow: result.workflow });
    },
  );
}
