import { describe, expect, it } from 'vitest';

import { calculateEvidencePanelAgreementMetrics } from './evidence-researcher-panel-metrics.ts';

const requirements = {
  atomicStatusAgreementMinimum: 0.95,
  criticalCaseAtomicAgreementRate: 1,
  criticalCaseIds: ['critical'],
  falseNotDemonstratedCountMaximum: 2,
  falseSupportedCount: 0,
  variabilityRateMaximum: 0.1,
} as const;

describe('evidence researcher panel agreement metrics', () => {
  it('fails a critical polarity error even when global agreement exceeds 95%', () => {
    const comparisons = [
      ...Array.from({ length: 179 }, () => ({
        actual: 'SUPPORTED',
        caseId: 'surface',
        expected: 'SUPPORTED',
      })),
      {
        actual: 'CONTRADICTED',
        caseId: 'critical',
        expected: 'SUPPORTED',
      },
    ];

    const result = calculateEvidencePanelAgreementMetrics({
      comparisons,
      requirements,
      totalCases: 10,
      variabilityCaseCount: 0,
    });

    expect(result.atomicStatusAgreementRate).toBeGreaterThan(0.95);
    expect(result.criticalCaseAtomicAgreementRate).toBe(0);
    expect(result.requirementsPassed).toBe(false);
  });

  it('keeps the global tolerance for non-critical surface variants', () => {
    const comparisons = [
      ...Array.from({ length: 177 }, () => ({
        actual: 'SUPPORTED',
        caseId: 'surface',
        expected: 'SUPPORTED',
      })),
      {
        actual: 'NOT_DEMONSTRATED',
        caseId: 'surface',
        expected: 'SUPPORTED',
      },
      {
        actual: 'NOT_DEMONSTRATED',
        caseId: 'surface',
        expected: 'SUPPORTED',
      },
      {
        actual: 'SUPPORTED',
        caseId: 'critical',
        expected: 'SUPPORTED',
      },
    ];

    const result = calculateEvidencePanelAgreementMetrics({
      comparisons,
      requirements,
      totalCases: 10,
      variabilityCaseCount: 0,
    });

    expect(result.criticalCaseAtomicAgreementRate).toBe(1);
    expect(result.falseNotDemonstratedCount).toBe(2);
    expect(result.requirementsPassed).toBe(true);
  });
});
