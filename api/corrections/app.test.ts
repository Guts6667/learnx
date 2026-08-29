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
          confidence: 'MEDIUM',
        },
      ],
      unsureCriteria: [],
      unsureCriterionDetails: [],
      overallConfidence: 'MEDIUM',
      overallFeedback: 'Note claire.',
      indicativeScore: 100,
      modelUsageCostUsd: 0.012,
      monitoringSignals: [],
    },
    settlement: {
      releasedCredits: '6',
      reservedCredits: '18',
      settledCredits: '12',
    },
    replay: false,
  };
}

describe('corrections api (V4-009/V4-010)', () => {
  const runAcceptedQuote = vi.fn(
    async (): Promise<
      import('../../src/server/corrections/correction-orchestration').OrchestratedCorrectionResult
    > => buildResult(),
  );
  const orchestration = { runAcceptedQuote };

  beforeEach(() => {
    runAcceptedQuote.mockClear();
    runAcceptedQuote.mockImplementation(async () => buildResult());
  });

  const recordFeedback = vi.fn(async () => ({
    recordedAt: new Date('2026-08-29T10:00:00.000Z'),
    status: 'RECORDED' as const,
  }));

  function app(userId = 'user-1', feedbackOverrides = {}) {
    return createCorrectionsApp({
      authentication: authenticatedMiddleware(userId),
      feedback: {
        listForCorrections: vi.fn(async () => ({})),
        record: recordFeedback,
        ...feedbackOverrides,
      },
      history: {
        findLatestForSubmission: vi.fn(async () => buildResult()),
        listForSubmission: vi.fn(async () => [
          {
            createdAt: new Date('2026-08-24T19:00:00.000Z'),
            result: buildResult(),
          },
        ]),
      },
      orchestration,
    });
  }

  it('returns the latest settled correction without running the model again', async () => {
    const response = await app().request(
      '/api/exercise-submissions/0286768e-5b9c-491b-a4f4-f2e6863ef398/ai-corrections/latest',
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      resource: { correction: OrchestratedCorrectionResult };
    };
    expect(body.resource.correction.replay).toBe(false);
    expect(body.resource.correction.correction.id).toBe('correction-1');
    expect(orchestration.runAcceptedQuote).not.toHaveBeenCalled();
  });

  it('exposes the derived confidence on the correction and each criterion', async () => {
    // Lane C reads these two fields to decide what it may show. They are the
    // server's judgement, derived from checkable facts; the model's own
    // `confidence` number must never appear in a learner payload.
    const response = await app().request(
      '/api/exercise-submissions/0286768e-5b9c-491b-a4f4-f2e6863ef398/ai-corrections/latest',
    );
    const body = (await response.json()) as {
      resource: { correction: OrchestratedCorrectionResult };
    };
    const { correction } = body.resource.correction;
    expect(correction.overallConfidence).toBe('MEDIUM');
    expect(correction.criteria).toHaveLength(1);
    expect(correction.criteria[0]?.confidence).toBe('MEDIUM');
  });

  it('rejects an invalid submission id before querying history', async () => {
    const response = await app().request(
      '/api/exercise-submissions/not-a-uuid/ai-corrections/latest',
    );
    expect(response.status).toBe(400);
  });

  it('returns every settled correction chronologically without provider metrics', async () => {
    const response = await app().request(
      '/api/exercise-submissions/0286768e-5b9c-491b-a4f4-f2e6863ef398/ai-corrections',
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      resource: {
        corrections: Array<{
          correction: Record<string, unknown>;
          createdAt: string;
        }>;
      };
    };
    expect(body.resource.corrections).toHaveLength(1);
    expect(body.resource.corrections[0]).toMatchObject({
      correction: { id: 'correction-1' },
      createdAt: '2026-08-24T19:00:00.000Z',
    });
    expect(JSON.stringify(body)).not.toContain('modelUsageCostUsd');
    expect(JSON.stringify(body)).not.toContain('monitoringSignals');
  });

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
    expect(body.resource.correction.correction).not.toHaveProperty(
      'modelUsageCostUsd',
    );
    expect(body.resource.correction.correction).not.toHaveProperty(
      'monitoringSignals',
    );
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

describe('retour apprenant par critère (V4.5-112)', () => {
  const recordedAt = new Date('2026-08-29T10:00:00.000Z');

  function post(
    body: unknown,
    correctionId = 'b1a4c0d2-3f77-4c0e-9c6b-2f9a1d4e5b60',
    overrides: Record<string, unknown> = {},
  ) {
    const feedbackApp = createCorrectionsApp({
      authentication: authenticatedMiddleware('user-1'),
      feedback: {
        listForCorrections: vi.fn(async () => ({})),
        record: vi.fn(async () => ({
          recordedAt,
          status: 'RECORDED' as const,
        })),
        ...overrides,
      },
    });
    return feedbackApp.request(`/api/ai-corrections/${correctionId}/feedback`, {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
  }

  it('enregistre un verdict et renvoie ce qui a été retenu', async () => {
    const response = await post({
      criterionKey: 'decision-position',
      verdict: 'WRONG',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      resource: {
        feedback: {
          criterionKey: 'decision-position',
          recordedAt: '2026-08-29T10:00:00.000Z',
          verdict: 'WRONG',
        },
      },
    });
  });

  it.each([
    [{ criterionKey: 'decision-position', verdict: 'MAYBE' }],
    [{ criterionKey: '', verdict: 'WRONG' }],
    [{ criterionKey: 'decision-position' }],
    [{ criterionKey: 'decision-position', verdict: 'WRONG', extra: 1 }],
  ])('refuse un corps invalide (%o)', async (body) => {
    expect((await post(body)).status).toBe(400);
  });

  it('refuse un identifiant de correction qui n’est pas un UUID', async () => {
    const response = await post(
      { criterionKey: 'decision-position', verdict: 'WRONG' },
      'pas-un-uuid',
    );
    expect(response.status).toBe(400);
  });

  it('répond 422 sur un critère que la correction ne mentionne pas', async () => {
    // Reachable only by the correction's owner, so distinguishing it from 404
    // tells them what is wrong without telling a stranger anything.
    const response = await post(
      { criterionKey: 'critere-invente', verdict: 'WRONG' },
      'b1a4c0d2-3f77-4c0e-9c6b-2f9a1d4e5b60',
      { record: vi.fn(async () => ({ status: 'UNKNOWN_CRITERION' as const })) },
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'AI_CORRECTION_CRITERION_UNKNOWN' },
    });
  });

  it('répond 404 sur la correction d’un autre apprenant', async () => {
    // Not 403: a forbidden would confirm to a stranger that the correction
    // exists. The store returns null for "not yours" and for "no such
    // criterion" alike, and both surface the same way.
    const response = await post(
      { criterionKey: 'decision-position', verdict: 'WRONG' },
      'b1a4c0d2-3f77-4c0e-9c6b-2f9a1d4e5b60',
      { record: vi.fn(async () => ({ status: 'NOT_FOUND' as const })) },
    );
    expect(response.status).toBe(404);
  });
});
