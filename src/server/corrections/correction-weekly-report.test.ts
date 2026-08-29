import { BREAKER_THRESHOLDS } from '../../lib/ai-correction-breaker';
import type { CorrectionMonitoringSummary } from './correction-monitoring';
import { formatWeeklyCorrectionReport } from './correction-weekly-report';

function summary(
  overrides: Partial<CorrectionMonitoringSummary> = {},
): CorrectionMonitoringSummary {
  return {
    breaker: {
      evaluationError: null,
      rates: { checkerDisagreement: 0.1, unusable: 0.02, wrongAtHigh: null },
      reason: null,
      state: 'CLOSED',
      thresholds: BREAKER_THRESHOLDS,
      trippedAt: null,
      trippedRates: {
        checkerDisagreement: null,
        unusable: null,
        wrongAtHigh: null,
      },
      window: { observed: 50, size: 50 },
    },
    checker: { disagreed: 5, unavailable: 1 },
    confidence: { high: 10, low: 2, medium: 8, scoreWithheld: 3 },
    corrections: { completed: 15, partial: 4, total: 20, unusable: 1 },
    cost: {
      p50Usd: '0.01000000',
      p90Usd: '0.02000000',
      totalUsd: '0.30000000',
      unknownCostAttempts: 0,
    },
    learner: { helpful: 6, wrong: 2, wrongAtHigh: 1 },
    ...overrides,
  };
}

const week = {
  since: new Date('2026-08-22T00:00:00.000Z'),
  until: new Date('2026-08-29T00:00:00.000Z'),
};

describe('formatWeeklyCorrectionReport', () => {
  it('n’affiche jamais un taux sous quorum comme zéro pour cent', () => {
    // Zero reads as health. "sous quorum" reads as what it is.
    const report = formatWeeklyCorrectionReport({
      journal: [],
      summary: summary(),
      week,
    });
    expect(report).toContain('contradiction apprenant sous quorum');
    expect(report).not.toContain('contradiction apprenant 0.0 %');
  });

  it('signale un garde-fou aveugle', () => {
    const report = formatWeeklyCorrectionReport({
      journal: [],
      summary: summary({
        breaker: {
          ...summary().breaker,
          evaluationError: 'connection terminated',
        },
      }),
      week,
    });
    expect(report).toContain('AVEUGLE : connection terminated');
  });

  it('dit si l’alerte d’un déclenchement n’a pas été remise', () => {
    // The record, not an assumption. An alert lost in silence is the failure
    // this reporting exists to catch.
    const report = formatWeeklyCorrectionReport({
      journal: [
        {
          action: 'TRIPPED',
          actorEmail: null,
          alertError: 'resend refused',
          alertedAt: null,
          createdAt: new Date('2026-08-27T09:00:00.000Z'),
          rate: 0.6,
          reason: 'CHECKER_DISAGREEMENT',
        },
      ],
      summary: summary(),
      week,
    });
    expect(report).toContain('ALERTE NON REMISE (resend refused)');
  });

  it('nomme qui a rouvert', () => {
    const report = formatWeeklyCorrectionReport({
      journal: [
        {
          action: 'REOPENED',
          actorEmail: 'owner@example.com',
          alertError: null,
          alertedAt: null,
          createdAt: new Date('2026-08-27T10:00:00.000Z'),
          rate: null,
          reason: null,
        },
      ],
      summary: summary(),
      week,
    });
    expect(report).toContain('rouvert par owner@example.com');
  });

  it('mentionne les coûts manquants seulement quand il y en a', () => {
    expect(
      formatWeeklyCorrectionReport({ journal: [], summary: summary(), week }),
    ).not.toContain('sans coût fournisseur');
    expect(
      formatWeeklyCorrectionReport({
        journal: [],
        summary: summary({
          cost: { ...summary().cost, unknownCostAttempts: 3 },
        }),
        week,
      }),
    ).toContain('3 tentative(s) sans coût fournisseur');
  });

  it('garde la contradiction apprenant à côté de la confiance affichée', () => {
    const report = formatWeeklyCorrectionReport({
      journal: [],
      summary: summary(),
      week,
    });
    expect(report).toContain('dont « faux » sur un critère HIGH 1');
  });
});

describe('entonnoir d’essai dans le rapport', () => {
  it('compte sans jamais afficher de taux', () => {
    // With a handful of learners a percentage moves twenty points on one
    // purchase and would read as a trend.
    const report = formatWeeklyCorrectionReport({
      funnel: {
        grantedThisWeek: 4,
        purchasedAfterTrial: 1,
        suspendedByBreaker: 0,
        trialAccounts: 12,
      },
      journal: [],
      summary: summary(),
      week,
    });
    expect(report).toContain('12 compte(s) en cohorte essai');
    expect(report).toContain('1 achat(s) après essai');
    expect(report).not.toMatch(/essai[^\n]*%/);
  });

  it('distingue une allocation refusée par le coupe-circuit d’une perte', () => {
    const report = formatWeeklyCorrectionReport({
      funnel: {
        grantedThisWeek: 0,
        purchasedAfterTrial: 0,
        suspendedByBreaker: 3,
        trialAccounts: 12,
      },
      journal: [],
      summary: summary(),
      week,
    });
    expect(report).toContain('3 allocation(s) non versée(s) — coupe-circuit');
  });

  it('omet la section quand aucune donnée d’essai n’est fournie', () => {
    expect(
      formatWeeklyCorrectionReport({ journal: [], summary: summary(), week }),
    ).not.toContain('cohorte essai');
  });
});
