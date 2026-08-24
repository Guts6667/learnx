import type { MiddlewareHandler } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import type { AuthEnvironment } from '../_lib/auth';
import { createCorrectionsApp } from './app';

const userId = '11111111-1111-4111-8111-111111111111';
const quoteId = '22222222-2222-4222-8222-222222222222';

function authentication(): MiddlewareHandler<AuthEnvironment> {
  return async (context, next) => {
    context.set('user', {
      displayName: 'Rayan',
      email: 'rayan@example.com',
      id: userId,
      locale: 'fr',
      role: 'USER',
    });
    await next();
  };
}

const authorization: MiddlewareHandler<AuthEnvironment> = async (
  _context,
  next,
) => next();

describe('corrections API', () => {
  it('resolves and caches the deployment orchestration instead of returning 503', async () => {
    const runAcceptedQuote = vi.fn().mockResolvedValue({
      correction: { id: 'correction-1', status: 'COMPLETED' },
      replay: false,
      settlement: {
        releasedCredits: '4',
        reservedCredits: '16',
        settledCredits: '12',
      },
    });
    const resolveDefaultOrchestration = vi
      .fn()
      .mockResolvedValue({ runAcceptedQuote });
    const app = createCorrectionsApp({
      authentication: authentication(),
      authorization,
      resolveDefaultOrchestration,
    });

    for (const id of [quoteId, '33333333-3333-4333-8333-333333333333']) {
      const response = await app.request('/ai-corrections', {
        body: JSON.stringify({ quoteId: id }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      expect(response.status).toBe(201);
    }

    expect(resolveDefaultOrchestration).toHaveBeenCalledTimes(1);
    expect(runAcceptedQuote).toHaveBeenNthCalledWith(1, { quoteId, userId });
  });

  it('fails closed when the kill switch or configuration leaves no orchestration', async () => {
    const app = createCorrectionsApp({
      authentication: authentication(),
      authorization,
      resolveDefaultOrchestration: async () => null,
    });

    const response = await app.request('/ai-corrections', {
      body: JSON.stringify({ quoteId }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'AI_CORRECTION_UNAVAILABLE' },
    });
  });
});
