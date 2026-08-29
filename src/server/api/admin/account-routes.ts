import type { Hono } from 'hono';

import type { AuthEnvironment } from '../_lib/auth.js';
import { assertCapability } from '../_lib/authorization.js';
import type { AdminDependencies } from './app-contracts.js';
import {
  accountListSchema,
  accountRoleTransitionSchema,
  accountTransitionSchema,
  handleAccountTransition,
  parseBody,
  parseIdentifier,
  parseQuery,
} from './validation.js';

export function registerAccountRoutes(
  app: Hono<AuthEnvironment>,
  dependencies: AdminDependencies,
) {
  app.get('/api/admin/accounts', async (context) => {
    assertCapability(context.get('user').role, 'account.suspend');
    const filters = parseQuery(accountListSchema, context.req.query());
    const page = await (
      await dependencies.accountAdministration()
    ).list(filters);
    return context.json({ page });
  });

  app.post('/api/admin/accounts/:userId/suspend', async (context) => {
    assertCapability(context.get('user').role, 'account.suspend');
    const userId = parseIdentifier(context.req.param('userId'));
    const input = await parseBody(accountTransitionSchema, context.req.raw);
    const result = await (
      await dependencies.accountAdministration()
    ).suspend(context.get('user').id, userId, {
      expectedStatus: input.expectedStatus,
      expectedUpdatedAt: new Date(input.expectedUpdatedAt),
    });
    return context.json({ account: handleAccountTransition(result) });
  });

  app.post('/api/admin/accounts/:userId/reactivate', async (context) => {
    assertCapability(context.get('user').role, 'account.suspend');
    const userId = parseIdentifier(context.req.param('userId'));
    const input = await parseBody(accountTransitionSchema, context.req.raw);
    const result = await (
      await dependencies.accountAdministration()
    ).reactivate(context.get('user').id, userId, {
      expectedStatus: input.expectedStatus,
      expectedUpdatedAt: new Date(input.expectedUpdatedAt),
    });
    return context.json({ account: handleAccountTransition(result) });
  });

  app.post('/api/admin/accounts/:userId/role', async (context) => {
    assertCapability(context.get('user').role, 'account.role.assign');
    const userId = parseIdentifier(context.req.param('userId'));
    const input = await parseBody(accountRoleTransitionSchema, context.req.raw);
    const result = await (
      await dependencies.accountAdministration()
    ).assignRole(context.get('user').id, userId, {
      expectedRole: input.expectedRole,
      expectedUpdatedAt: new Date(input.expectedUpdatedAt),
      role: input.role,
    });
    return context.json({ account: handleAccountTransition(result) });
  });
}
