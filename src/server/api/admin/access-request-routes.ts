import type { Hono } from 'hono';

import type { AuthEnvironment } from '../_lib/auth.js';
import { assertCapability } from '../_lib/authorization.js';
import { ApiError } from '../_lib/errors.js';
import type { AdminDependencies } from './app-contracts.js';
import type { AccessRequestReviewResult } from './access-request-review-types.js';
import {
  accessRequestListSchema,
  approveAccessRequestSchema,
  notFound,
  parseBody,
  parseIdentifier,
  parseQuery,
  rejectAccessRequestSchema,
  resendAccessInvitationSchema,
} from './validation.js';

function reviewedRequest(result: AccessRequestReviewResult) {
  if (result.kind === 'NOT_FOUND') throw notFound();
  if (result.kind === 'CONFLICT') {
    throw new ApiError(
      'ACCESS_REQUEST_CONFLICT',
      'The access request has already been reviewed or changed.',
      409,
    );
  }
  return result.request;
}

export function registerAccessRequestRoutes(
  app: Hono<AuthEnvironment>,
  dependencies: AdminDependencies,
) {
  app.get('/api/admin/access-requests', async (context) => {
    assertCapability(context.get('user').role, 'account.request.review');
    const filters = parseQuery(accessRequestListSchema, context.req.query());
    const page = await (await dependencies.accessRequestReview()).list(filters);
    return context.json({ page });
  });

  app.post('/api/admin/access-requests/:requestId/approve', async (context) => {
    const role = context.get('user').role;
    assertCapability(role, 'account.request.review');
    assertCapability(role, 'account.invitation.issue');
    assertCapability(role, 'account.role.assign');
    const requestId = parseIdentifier(context.req.param('requestId'));
    const input = await parseBody(approveAccessRequestSchema, context.req.raw);
    const result = await (
      await dependencies.accessRequestReview()
    ).approve(context.get('user').id, requestId, input);
    return context.json({ request: reviewedRequest(result) });
  });

  app.post('/api/admin/access-requests/:requestId/reject', async (context) => {
    assertCapability(context.get('user').role, 'account.request.review');
    const requestId = parseIdentifier(context.req.param('requestId'));
    const input = await parseBody(rejectAccessRequestSchema, context.req.raw);
    const result = await (
      await dependencies.accessRequestReview()
    ).reject(context.get('user').id, requestId, input);
    return context.json({ request: reviewedRequest(result) });
  });

  app.post(
    '/api/admin/access-requests/:requestId/resend-invitation',
    async (context) => {
      assertCapability(context.get('user').role, 'account.invitation.issue');
      const requestId = parseIdentifier(context.req.param('requestId'));
      const input = await parseBody(
        resendAccessInvitationSchema,
        context.req.raw,
      );
      const result = await (
        await dependencies.accessRequestReview()
      ).resend(context.get('user').id, requestId, input);
      return context.json({ request: reviewedRequest(result) });
    },
  );
}
