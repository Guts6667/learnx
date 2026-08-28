import { createMiddleware } from 'hono/factory';

import type { AuthEnvironment } from './auth.js';
import { hasCapability, type Capability } from './capabilities.js';
import { ApiError } from './errors.js';

function forbiddenCapability(): ApiError {
  return new ApiError('FORBIDDEN', 'Access is not permitted.', 403);
}

export function assertCapability(
  role: AuthEnvironment['Variables']['user']['role'],
  capability: Capability,
): void {
  if (!hasCapability(role, capability)) throw forbiddenCapability();
}

export function requireCapability(capability: Capability) {
  return createMiddleware<AuthEnvironment>(async (context, next) => {
    assertCapability(context.get('user').role, capability);
    await next();
  });
}
