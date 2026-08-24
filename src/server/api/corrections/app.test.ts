import type { MiddlewareHandler } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import type { AuthEnvironment } from '../_lib/auth';
import { createCorrectionsApp } from './app';

const userId = '11111111-1111-4111-8111-111111111111';
const quoteId = '22222222-2222-4222-8222-222222222222';

function authentication(
  role: 'ADMIN' | 'USER' = 'USER',
): MiddlewareHandler<AuthEnvironment> {
  return async (context, next) => {
    context.set('user', {
      displayName: 'Rayan',
      email: 'rayan@example.com',
      id: userId,
      locale: 'fr',
      role,
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
      correction: {
        criteria: [],
        id: 'correction-1',
        indicativeScore: 100,
        modelUsageCostUsd: 0.01,
        monitoringSignals: [],
        overallFeedback: 'Retour formatif.',
        secondPassRequired: false,
        status: 'COMPLETED',
        unsureCriteria: [],
      },
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
      const response = await app.request('/api/ai-corrections', {
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

    const response = await app.request('/api/ai-corrections', {
      body: JSON.stringify({ quoteId }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'AI_CORRECTION_UNAVAILABLE' },
    });
  });

  it('expose le suivi minimal aux administrateurs uniquement', async () => {
    const monitoring = {
      summary: vi.fn().mockResolvedValue({
        completed: 2,
        hardConstraintLevelMismatchSuspected: 1,
        partial: 1,
        scoreGuardTriggered: 1,
        totalCorrections: 3,
        totalProviderCostUsd: '0.05200000',
        unavailable: 0,
        unknownCostAttempts: 0,
      }),
    };
    const app = createCorrectionsApp({
      authentication: authentication('ADMIN'),
      authorization,
      monitoring,
    });

    const response = await app.request(
      '/api/admin/ai-corrections/monitoring',
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      monitoring: { totalCorrections: 3 },
    });
  });
});
