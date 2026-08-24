import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MiddlewareHandler } from 'hono';

import type { Role } from '../../generated/prisma/client';

import { createCorrectionsApp } from '@/server/api/corrections/app';
import {
  CorrectionOrchestrationError,
  type OrchestratedCorrectionResult,
} from '@/server/corrections/correction-orchestration';

function authenticatedMiddleware(userId: string): MiddlewareHandler {
  return async (context, next) => {
    context.set('user', {
      displayName: 'Learner',
      email: 'learner@example.com',
      id: userId,
      locale: 'fr',
      role: 'USER' as Role,
    });
    await next();
  };
}

function buildResult(): OrchestratedCorrectionResult {
  return {
    correction: {
      id: 'correction-1',
      status: 'COMPLETED',
      criteria: [
        {
          key: 'decision-position',
          label: 'Position décisionnelle',
          weight: 60,
          levelKey: 'mastered',
          levelLabel: 'Maîtrisé',
          evidenceStatus: 'FOUND',
          evidenceQuotes: ['Je retiens l’option locale.'],
          feedback: 'Décision explicite.',
        },
      ],
      unsureCriteria: [],
      unsureCriterionDetails: [],
      overallFeedback: 'Note claire.',
      indicativeScore: 100,
      secondPassRequired: false,
      modelUsageCostUsd: 0.012,
      monitoringSignals: [],
    },
    settlement: { releasedCredits: '6', reservedCredits: '18', settledCredits: '12' },
    replay: false,
  };
}

describe('corrections api (V4-009/V4-010)', () => {
  const runAcceptedQuote = vi.fn(
    async (): Promise<import('../../src/server/corrections/correction-orchestration').OrchestratedCorrectionResult> =>
      buildResult(),
  );
  const orchestration = { runAcceptedQuote };

  beforeEach(() => {
    runAcceptedQuote.mockClear();
    runAcceptedQuote.mockImplementation(async () => buildResult());
  });

  function app(userId = 'user-1') {
    return createCorrectionsApp({
      authentication: authenticatedMiddleware(userId),
      orchestration,
    });
  }

  it('runs an accepted quote and returns the correction with its settlement', async () => {
    const response = await app().request('/api/ai-corrections', {
      body: JSON.stringify({ quoteId: '5f0b1d2e-1c3d-4e5f-9a8b-7c6d5e4f3b2a' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      resource: { correction: OrchestratedCorrectionResult };
    };
    expect(body.resource.correction.correction.status).toBe('COMPLETED');
    expect(body.resource.correction.settlement).toEqual({
      releasedCredits: '6',
      reservedCredits: '18',
      settledCredits: '12',
    });
    expect(orchestration.runAcceptedQuote).toHaveBeenCalledWith({
      quoteId: '5f0b1d2e-1c3d-4e5f-9a8b-7c6d5e4f3b2a',
      userId: 'user-1',
    });
  });

  it('rejects an invalid body', async () => {
    const response = await app().request('/api/ai-corrections', {
      body: JSON.stringify({ quoteId: 'not-a-uuid' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    expect(response.status).toBe(400);
    expect(orchestration.runAcceptedQuote).not.toHaveBeenCalled();
  });

  it('maps an expired quote to PRICING_QUOTE_EXPIRED', async () => {
    orchestration.runAcceptedQuote.mockRejectedValue(
      new CorrectionOrchestrationError('QUOTE_EXPIRED'),
    );
    const response = await app().request('/api/ai-corrections', {
      body: JSON.stringify({ quoteId: '5f0b1d2e-1c3d-4e5f-9a8b-7c6d5e4f3b2a' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('PRICING_QUOTE_EXPIRED');
  });

  it('maps insufficient credits without leaking provider details', async () => {
    orchestration.runAcceptedQuote.mockRejectedValue(
      new CorrectionOrchestrationError('INSUFFICIENT_CREDITS'),
    );
    const response = await app().request('/api/ai-corrections', {
      body: JSON.stringify({ quoteId: '5f0b1d2e-1c3d-4e5f-9a8b-7c6d5e4f3b2a' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('INSUFFICIENT_CREDITS');
  });

  it('returns 503 when no orchestration is configured', async () => {
    const unconfigured = createCorrectionsApp({
      authentication: authenticatedMiddleware('user-1'),
    });
    const response = await unconfigured.request('/api/ai-corrections', {
      body: JSON.stringify({ quoteId: '5f0b1d2e-1c3d-4e5f-9a8b-7c6d5e4f3b2a' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    expect(response.status).toBe(503);
  });
});
