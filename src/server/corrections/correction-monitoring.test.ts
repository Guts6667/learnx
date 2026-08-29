import type { PrismaClient } from '../../../generated/prisma/client.js';

import { BREAKER_THRESHOLDS } from '../../lib/ai-correction-breaker';

import type { CorrectionBreakerPort } from './correction-breaker';
import { PrismaCorrectionMonitoringService } from './correction-monitoring';

const closed = {
  evaluationError: null,
  rates: { checkerDisagreement: null, unusable: null, wrongAtHigh: null },
  reason: null,
  state: 'CLOSED' as const,
  thresholds: BREAKER_THRESHOLDS,
  trippedAt: null,
  trippedRates: {
    checkerDisagreement: null,
    unusable: null,
    wrongAtHigh: null,
  },
  window: { observed: 0, size: 50 },
};

function service(
  corrections: unknown[],
  breaker?: Partial<CorrectionBreakerPort>,
) {
  const prisma = {
    aiCorrection: { findMany: vi.fn(async () => corrections) },
  } as unknown as PrismaClient;
  return new PrismaCorrectionMonitoringService(prisma, {
    evaluate: vi.fn(async () => closed),
    events: vi.fn(async () => []),
    reopen: vi.fn(async () => undefined),
    status: vi.fn(async () => closed),
    ...breaker,
  } as CorrectionBreakerPort);
}

describe('PrismaCorrectionMonitoringService', () => {
  it('agrège coûts, confiance, vérificateur et votes sans rien inventer', async () => {
    const summary = await service([
      {
        attempts: [
          { costUsd: { toString: () => '0.02000000' }, status: 'SUCCEEDED' },
          { costUsd: null, status: 'FAILED' },
        ],
        criterionFeedback: [
          { criterionKey: 'decision-position', verdict: 'WRONG' },
          { criterionKey: 'evidence-selection', verdict: 'HELPFUL' },
        ],
        structuredResult: {
          correction: {
            criteria: [
              { confidence: 'HIGH', key: 'decision-position' },
              { confidence: 'MEDIUM', key: 'evidence-selection' },
            ],
            indicativeScore: null,
            monitoringSignals: ['CHECKER_DISAGREED'],
            overallConfidence: 'MEDIUM',
            status: 'COMPLETED_PARTIAL',
          },
        },
      },
      {
        attempts: [
          { costUsd: { toString: () => '0.01000000' }, status: 'SUCCEEDED' },
        ],
        criterionFeedback: [],
        structuredResult: {
          correction: {
            criteria: [],
            indicativeScore: 92,
            monitoringSignals: ['CHECKER_UNAVAILABLE'],
            overallConfidence: 'HIGH',
            status: 'COMPLETED',
          },
        },
      },
    ]).summary();

    expect(summary.checker).toEqual({ disagreed: 1, unavailable: 1 });
    expect(summary.confidence).toEqual({
      high: 1,
      low: 0,
      medium: 1,
      scoreWithheld: 1,
    });
    expect(summary.corrections).toEqual({
      completed: 1,
      partial: 1,
      total: 2,
      unusable: 0,
    });
    // A learner marking WRONG a MEDIUM criterion contradicts nothing we
    // asserted strongly, so it counts in `wrong` and not in `wrongAtHigh`.
    expect(summary.learner).toEqual({ helpful: 1, wrong: 1, wrongAtHigh: 1 });
    expect(summary.cost).toEqual({
      p50Usd: '0.01000000',
      p90Usd: '0.02000000',
      totalUsd: '0.03000000',
      unknownCostAttempts: 1,
    });
  });

  it('ne compte pas en confiance haute un vote sur un critère moyen', async () => {
    const summary = await service([
      {
        attempts: [],
        criterionFeedback: [
          { criterionKey: 'evidence-selection', verdict: 'WRONG' },
        ],
        structuredResult: {
          correction: {
            criteria: [{ confidence: 'MEDIUM', key: 'evidence-selection' }],
            indicativeScore: 80,
            overallConfidence: 'MEDIUM',
            status: 'COMPLETED',
          },
        },
      },
    ]).summary();
    expect(summary.learner).toEqual({ helpful: 0, wrong: 1, wrongAtHigh: 0 });
  });

  it('lit l’état du coupe-circuit sans jamais le déclencher', async () => {
    // Opening the admin page must not be an action. The breaker is evaluated
    // on the path it protects, at quote time.
    const evaluate = vi.fn(async () => closed);
    const summary = await service([], { evaluate }).summary();
    expect(evaluate).not.toHaveBeenCalled();
    expect(summary.breaker.state).toBe('CLOSED');
  });

  it('reporte les taux mesurés du coupe-circuit verrouillé', async () => {
    const open = {
      ...closed,
      rates: { checkerDisagreement: 0.6, unusable: null, wrongAtHigh: null },
      reason: 'CHECKER_DISAGREEMENT' as const,
      state: 'OPEN' as const,
      trippedAt: '2026-08-29T12:00:00.000Z',
      trippedRates: {
        checkerDisagreement: 0.6,
        unusable: null,
        wrongAtHigh: null,
      },
    };
    const summary = await service([], {
      status: vi.fn(async () => open),
    }).summary();
    expect(summary.breaker).toMatchObject({
      rates: { checkerDisagreement: 0.6 },
      reason: 'CHECKER_DISAGREEMENT',
      state: 'OPEN',
      trippedAt: '2026-08-29T12:00:00.000Z',
    });
  });
});
