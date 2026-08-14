import { Hono, type MiddlewareHandler } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import type { AuthEnvironment } from '../_lib/auth.js';
import { createAiPricingApp } from './app.js';

function passThrough(spy: () => void): MiddlewareHandler<AuthEnvironment> {
  return async (_context, next) => {
    spy();
    await next();
  };
}

describe('AI pricing API middleware scope', () => {
  it('does not intercept protected routes owned by another API module', async () => {
    const authentication = vi.fn();
    const authorization = vi.fn();
    const root = new Hono();

    root.route(
      '/',
      createAiPricingApp({
        authentication: passThrough(authentication),
        authorization: passThrough(authorization),
      }),
    );
    root.get('/api/programs', (context) => context.json({ programs: [] }));

    const response = await root.request('/api/programs');

    expect(response.status).toBe(200);
    expect(authentication).not.toHaveBeenCalled();
    expect(authorization).not.toHaveBeenCalled();
  });

  it('keeps authentication and authorization on the pricing quote endpoint', async () => {
    const authentication = vi.fn();
    const authorization = vi.fn();
    const app = createAiPricingApp({
      authentication: passThrough(authentication),
      authorization: passThrough(authorization),
    });

    const response = await app.request('/api/ai-correction/quotes', {
      body: '{}',
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    expect(response.status).toBe(400);
    expect(authentication).toHaveBeenCalledOnce();
    expect(authorization).toHaveBeenCalledOnce();
  });
});
