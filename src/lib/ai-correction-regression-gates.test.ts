import { describe, expect, it } from 'vitest';

import {
  evaluateRegressionGates,
  parseRegressionGatePolicy,
  REGRESSION_GATE_POLICY_VERSION,
  type RegressionGatePolicy,
} from './ai-correction-regression-gates.js';
import {
  computeRegressionMetrics,
  type RegressionCaseScale,
  type RegressionObservation,
} from './ai-correction-regression-metrics.js';

function policy(gates: RegressionGatePolicy['gates']): RegressionGatePolicy {
  return parseRegressionGatePolicy({
    gates,
    policyVersion: REGRESSION_GATE_POLICY_VERSION,
    schemaVersion: 1,
    sourceOfAuthority: 'test',
  });
}

const SCALE: RegressionCaseScale = {
  caseId: 'pool/cas',
  criteria: [
    {
      criterionKey: 'fidelite',
      orderedLevelKeys: ['insufficient', 'partial', 'mastered'],
    },
    {
      criterionKey: 'clarte',
      orderedLevelKeys: ['insufficient', 'partial', 'mastered'],
    },
  ],
  expectedCriteria: [
    { criterionKey: 'fidelite', levelKey: 'mastered' },
    { criterionKey: 'clarte', levelKey: 'mastered' },
  ],
};

function observation(
  overrides: Partial<RegressionObservation> & {
    levels: Record<string, string>;
  },
): RegressionObservation {
  const { levels, ...rest } = overrides;
  return {
    caseId: 'pool/cas',
    criteria: Object.entries(levels).map(([criterionKey, levelKey]) => ({
      checkerVerdict: 'AGREED' as const,
      confidence: 'HIGH' as const,
      criterionKey,
      levelKey,
    })),
    repetition: 1,
    ...rest,
  };
}

describe('gate budgets sized to the sample', () => {
  it('turns a rate threshold into an integer budget', () => {
    const evaluation = evaluateRegressionGates({
      metrics: {
        mutationDirectionViolations: {
          denominator: 200,
          numerator: 4,
          rate: 0.02,
        },
      } as never,
      policy: policy([
        {
          comparison: 'MAX_RATE',
          intent: 'test',
          key: 'mutation',
          kind: 'BLOCKING',
          metric: 'mutationDirectionViolations',
          threshold: 0.02,
        },
      ]),
    });

    // 2 % of 200 is a budget of 4, and 4 violations is inside it.
    expect(evaluation.gates[0]?.budget).toBe(4);
    expect(evaluation.gates[0]?.status).toBe('PASS');
    expect(evaluation.policyErrors).toEqual([]);
  });

  it('fails one violation past the budget', () => {
    const evaluation = evaluateRegressionGates({
      metrics: {
        mutationDirectionViolations: {
          denominator: 200,
          numerator: 5,
          rate: 0.025,
        },
      } as never,
      policy: policy([
        {
          comparison: 'MAX_RATE',
          intent: 'test',
          key: 'mutation',
          kind: 'BLOCKING',
          metric: 'mutationDirectionViolations',
          threshold: 0.02,
        },
      ]),
    });

    expect(evaluation.gates[0]?.status).toBe('FAIL');
    expect(evaluation.promotionEligible).toBe(false);
  });

  it('rejects a blocking rate finer than one observation', () => {
    const evaluation = evaluateRegressionGates({
      metrics: {
        mutationDirectionViolations: {
          denominator: 10,
          numerator: 0,
          rate: 0,
        },
      } as never,
      policy: policy([
        {
          comparison: 'MAX_RATE',
          intent: 'test',
          key: 'mutation',
          kind: 'BLOCKING',
          metric: 'mutationDirectionViolations',
          threshold: 0.02,
        },
      ]),
    });

    // The gate passes on the numbers but the policy is not sayable at n=10.
    expect(evaluation.gates[0]?.status).toBe('PASS');
    expect(evaluation.policyErrors).toHaveLength(1);
    expect(evaluation.promotionEligible).toBe(false);
  });

  it('accepts an explicit zero budget at any sample size', () => {
    const evaluation = evaluateRegressionGates({
      metrics: {
        repetitionTwoStepFlipsAtHigh: {
          denominator: 10,
          numerator: 0,
          rate: 0,
        },
      } as never,
      policy: policy([
        {
          comparison: 'MAX_COUNT',
          intent: 'test',
          key: 'flips',
          kind: 'BLOCKING',
          metric: 'repetitionTwoStepFlipsAtHigh',
          threshold: 0,
        },
      ]),
    });

    expect(evaluation.policyErrors).toEqual([]);
    expect(evaluation.gates[0]?.status).toBe('PASS');
    expect(evaluation.promotionEligible).toBe(true);
  });

  it('reads a minimum as the smallest acceptable count', () => {
    const evaluation = evaluateRegressionGates({
      metrics: {
        checkerAgreementAtHigh: {
          denominator: 90,
          numerator: 80,
          rate: 80 / 90,
        },
      } as never,
      policy: policy([
        {
          comparison: 'MIN_RATE',
          intent: 'test',
          key: 'accord',
          kind: 'BLOCKING',
          metric: 'checkerAgreementAtHigh',
          threshold: 0.9,
        },
      ]),
    });

    expect(evaluation.gates[0]?.budget).toBe(81);
    expect(evaluation.gates[0]?.status).toBe('FAIL');
  });

  it('blocks promotion on an unmeasured blocking gate rather than passing it', () => {
    const evaluation = evaluateRegressionGates({
      metrics: {
        mutationDirectionViolations: {
          denominator: 0,
          numerator: 0,
          rate: null,
        },
      } as never,
      policy: policy([
        {
          comparison: 'MAX_RATE',
          intent: 'test',
          key: 'mutation',
          kind: 'BLOCKING',
          metric: 'mutationDirectionViolations',
          threshold: 0.02,
        },
      ]),
    });

    expect(evaluation.gates[0]?.status).toBe('NOT_MEASURED');
    expect(evaluation.promotionEligible).toBe(false);
    expect(evaluation.gateFailures[0]).toContain('non mesuré');
  });

  it('never blocks on a watched or reported gate', () => {
    const evaluation = evaluateRegressionGates({
      metrics: {
        lowShare: { denominator: 100, numerator: 90, rate: 0.9 },
        modelAuthoredAgreement: { denominator: 100, numerator: 3, rate: 0.03 },
      } as never,
      policy: policy([
        {
          comparison: 'MAX_RATE',
          intent: 'test',
          key: 'low',
          kind: 'WATCHED',
          metric: 'lowShare',
          threshold: 0.3,
        },
        {
          comparison: 'MIN_RATE',
          intent: 'test',
          key: 'etalon',
          kind: 'REPORTED',
          metric: 'modelAuthoredAgreement',
          threshold: 0,
        },
      ]),
    });

    expect(evaluation.gates[0]?.status).toBe('FAIL');
    expect(evaluation.gates[1]?.status).toBe('REPORTED');
    expect(evaluation.gateFailures).toEqual([]);
    expect(evaluation.promotionEligible).toBe(true);
  });
});

describe('metric denominators', () => {
  it('reports null rather than zero when nothing was measured', () => {
    const metrics = computeRegressionMetrics({
      baselines: [],
      mutants: [],
      scales: [SCALE],
    });

    expect(metrics.mutationDirectionViolations.rate).toBeNull();
    expect(metrics.checkerAgreementAtHigh.rate).toBeNull();
    expect(metrics.lowShare.rate).toBeNull();
  });

  it('counts a deletion that left the criterion mastered as a violation', () => {
    const metrics = computeRegressionMetrics({
      baselines: [
        observation({ levels: { clarte: 'mastered', fidelite: 'mastered' } }),
      ],
      mutants: [
        observation({
          expectation: {
            othersExpectation: 'UNCONSTRAINED',
            targetCriterionKey: 'fidelite',
            targetDirection: 'NOT_MASTERED',
          },
          kind: 'SENTENCE_DELETION',
          levels: { clarte: 'mastered', fidelite: 'mastered' },
          mutantId: 'm1',
        }),
      ],
      scales: [SCALE],
    });

    expect(metrics.mutationDirectionViolations.numerator).toBe(1);
    expect(metrics.mutationDirectionViolations.denominator).toBe(1);
    expect(metrics.mutationDirectionViolationDetails[0]?.mutantId).toBe('m1');
  });

  it('accepts a deletion that moved the criterion off the top level', () => {
    const metrics = computeRegressionMetrics({
      baselines: [
        observation({ levels: { clarte: 'mastered', fidelite: 'mastered' } }),
      ],
      mutants: [
        observation({
          expectation: {
            othersExpectation: 'UNCONSTRAINED',
            targetCriterionKey: 'fidelite',
            targetDirection: 'NOT_MASTERED',
          },
          kind: 'SENTENCE_DELETION',
          levels: { clarte: 'mastered', fidelite: 'partial' },
          mutantId: 'm1',
        }),
      ],
      scales: [SCALE],
    });

    expect(metrics.mutationDirectionViolations.numerator).toBe(0);
  });

  it('requires a fact inversion to move the criterion down, not merely off the top', () => {
    const metrics = computeRegressionMetrics({
      baselines: [
        observation({ levels: { clarte: 'partial', fidelite: 'partial' } }),
      ],
      mutants: [
        observation({
          expectation: {
            othersExpectation: 'STABLE',
            targetCriterionKey: 'fidelite',
            targetDirection: 'DOWN',
          },
          kind: 'FACT_INVERSION',
          levels: { clarte: 'partial', fidelite: 'mastered' },
          mutantId: 'm1',
        }),
      ],
      scales: [SCALE],
    });

    // The criterion went up after its supporting fact was falsified.
    expect(metrics.mutationDirectionViolations.numerator).toBe(1);
  });

  it('counts drift only past one step, and only on untargeted criteria', () => {
    const metrics = computeRegressionMetrics({
      baselines: [
        observation({ levels: { clarte: 'mastered', fidelite: 'mastered' } }),
      ],
      mutants: [
        observation({
          expectation: {
            othersExpectation: 'STABLE',
            targetCriterionKey: 'fidelite',
            targetDirection: 'DOWN',
          },
          kind: 'FACT_INVERSION',
          levels: { clarte: 'insufficient', fidelite: 'partial' },
          mutantId: 'm1',
        }),
      ],
      scales: [SCALE],
    });

    // `clarte` fell two steps under a mutation that touched one fact.
    expect(metrics.unrelatedCriterionDrift.numerator).toBe(1);
    expect(metrics.unrelatedCriterionDrift.denominator).toBe(1);
  });

  it('separates two-step flips at HIGH from the overall flip rate', () => {
    const metrics = computeRegressionMetrics({
      baselines: [
        {
          caseId: 'pool/cas',
          criteria: [
            {
              checkerVerdict: 'AGREED',
              confidence: 'HIGH',
              criterionKey: 'fidelite',
              levelKey: 'mastered',
            },
            {
              checkerVerdict: 'AGREED',
              confidence: 'MEDIUM',
              criterionKey: 'clarte',
              levelKey: 'mastered',
            },
          ],
          repetition: 1,
        },
        {
          caseId: 'pool/cas',
          criteria: [
            {
              checkerVerdict: 'AGREED',
              confidence: 'HIGH',
              criterionKey: 'fidelite',
              levelKey: 'insufficient',
            },
            {
              checkerVerdict: 'AGREED',
              confidence: 'MEDIUM',
              criterionKey: 'clarte',
              levelKey: 'insufficient',
            },
          ],
          repetition: 2,
        },
      ],
      mutants: [],
      scales: [SCALE],
    });

    expect(metrics.repetitionTwoStepFlips.numerator).toBe(2);
    expect(metrics.repetitionTwoStepFlipsAtHigh.numerator).toBe(1);
    expect(metrics.repetitionTwoStepFlipsAtHigh.denominator).toBe(1);
    expect(metrics.leastStableCases[0]?.maximumStepSpread).toBe(2);
  });

  it('reports agreement with the model-authored gold without gating it', () => {
    const metrics = computeRegressionMetrics({
      baselines: [
        observation({ levels: { clarte: 'mastered', fidelite: 'partial' } }),
      ],
      mutants: [],
      scales: [SCALE],
    });

    expect(metrics.modelAuthoredAgreement.numerator).toBe(1);
    expect(metrics.modelAuthoredAgreement.denominator).toBe(2);
  });
});
