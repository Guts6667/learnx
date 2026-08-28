import { describe, expect, it } from 'vitest';

import {
  loadConfiguration,
  loadCorpus,
  validResumeAttempt,
} from './ai-correction-benchmark.test-support.js';
import { calculateDecisionMetrics } from './ai-correction-benchmark-summary-decision.js';
import {
  calculateEvidenceObservations,
  calculateInjectionObservations,
  calculateStabilityObservations,
  calculateTransportObservations,
  calculateUnsureCriterionRate,
  ordinalLevelKeys,
} from './ai-correction-benchmark-summary-observations.js';
import { groupLogicalRuns } from './ai-correction-benchmark-summary-support.js';

describe('benchmark summary split goldens', () => {
  it('preserves decision, safety, stability and delivery sub-aggregates', () => {
    const corpus = loadCorpus();
    const configuration = loadConfiguration();
    const candidate = configuration.candidates[0];
    const benchmarkCase = corpus.cases[0];
    if (!candidate || !benchmarkCase)
      throw new Error('Expected benchmark fixtures.');
    const attempt = validResumeAttempt({
      benchmarkCase,
      candidate,
      configuration,
      repetition: 1,
    });
    if (!attempt.output) throw new Error('Expected a delivered output.');
    const casesById = new Map(corpus.cases.map((item) => [item.caseId, item]));
    const contractsByKey = new Map(
      corpus.contracts.map((contract) => [
        `${contract.contractKey}|${contract.version}`,
        contract,
      ]),
    );
    const modelRuns = [...groupLogicalRuns([attempt]).values()];

    const decisions = calculateDecisionMetrics({
      casesById,
      configuration,
      contractsByKey,
      ordinalLevelKeys: ordinalLevelKeys(corpus.contracts),
      scoreGuardRoutedRuns: new Set(),
      validAttempts: [{ ...attempt, output: attempt.output }],
    });
    expect(decisions).toMatchObject({
      criterionAgreement: 1,
      decisionAgreement: 1,
      decisionAgreementExcludingSecondPass: 1,
      falseFailCount: 0,
      falsePassCount: 0,
      meanOrdinalDistance: 0,
      twoLevelOrdinalGapCount: 0,
    });
    expect(Object.values(decisions.byFamily)).toEqual([
      expect.objectContaining({
        criterionAgreement: 1,
        decisionAgreement: 1,
        logicalRuns: 1,
        meanOrdinalDistance: 0,
      }),
    ]);

    expect(
      calculateTransportObservations({ gatePolicyV2: false, modelRuns }),
    ).toMatchObject({
      recoveredTransportRuns: 0,
      runsWithInvalidFirstAttempt: [],
      runsWithTransportError: [],
      unusableRuns: [],
    });
    expect(
      calculateEvidenceObservations({
        casesById,
        gatePolicyV2: false,
        modelRuns,
      }),
    ).toEqual({
      firstAttemptEvidenceRejectionRuns: 0,
      hallucinationCount: 0,
    });
    expect(
      calculateInjectionObservations({
        canary: configuration.controlPrompt.canary,
        casesById,
        modelAttempts: [attempt],
      }),
    ).toEqual({ injectionRunCount: 0, safeInjectionRunCount: 0 });
    expect(
      calculateStabilityObservations({
        modelRuns,
        validAttempts: [{ ...attempt, output: attempt.output }],
      }),
    ).toEqual({ retriedRuns: 0, variabilityRate: 0 });
    expect(
      calculateUnsureCriterionRate({
        casesById,
        contractsByKey,
        modelRuns,
      }),
    ).toBe(0);
  });
});
