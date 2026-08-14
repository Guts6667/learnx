import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  compileExecutableRubric,
  evidenceSpanFor,
  type EvidencePass,
} from './executable-rubric-engine.ts';
import { evaluateEvidenceResearcherCampaign } from './evidence-researcher-evaluation.ts';

const rubric = JSON.parse(
  readFileSync(
    resolve(
      process.cwd(),
      'benchmarks/ai-correction/executable-rubric/writing-recommendation-fr.v1.json',
    ),
    'utf8',
  ),
) as unknown;
const corpus = JSON.parse(
  readFileSync(
    resolve(
      process.cwd(),
      'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v1.json',
    ),
    'utf8',
  ),
) as {
  cases: Array<{
    caseId: string;
    expectedElements: Array<{
      elementKey: string;
      evidenceQuotes: string[];
      status: EvidencePass['elements'][number]['status'];
    }>;
    injectionBoundary?: { legitimateResponseText: string };
    responseText: string;
  }>;
};
const compiled = compileExecutableRubric(rubric);

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('TEST_FIXTURE_MISSING');
  return value;
}

function expectedPass(caseItem: (typeof corpus.cases)[number]): EvidencePass {
  return {
    elements: caseItem.expectedElements.map((element) => ({
      confidence: null,
      contradictions: [],
      elementKey: element.elementKey,
      evidenceSpans: element.evidenceQuotes.map((quote) => {
        const start = caseItem.responseText.indexOf(quote);
        return evidenceSpanFor(caseItem.responseText, start, start + quote.length);
      }),
      status: element.status,
    })),
    pipelineFingerprint: 'e'.repeat(64),
    role: 'EVIDENCE_RESEARCHER',
  };
}

function perfectResults() {
  return corpus.cases.flatMap((caseItem) =>
    ([1, 2] as const).map((repetition) => ({
      actualCostUsd: 0.001,
      caseId: caseItem.caseId,
      costReconciled: true as const,
      evidencePass: expectedPass(caseItem),
      rawModelOutput: JSON.stringify({
        elements: expectedPass(caseItem).elements.map((element) => ({
          confidence: element.confidence,
          contradictions: element.contradictions,
          elementKey: element.elementKey,
          evidenceQuotes: element.evidenceSpans.map(({ text }) => text),
          status: element.status,
        })),
      }),
      repetition,
      usable: true as const,
    })),
  );
}

describe('evidence researcher campaign evaluation', () => {
  it('passes an exact 10x2 result matrix and keeps costs separate', () => {
    const evaluation = evaluateEvidenceResearcherCampaign({
      compiled,
      corpus,
      mechanicalOracleValidated: true,
      results: perfectResults(),
    });

    expect(evaluation).toMatchObject({
      atomicStatusAgreementRate: 1,
      falseNotDemonstratedCount: 0,
      falseSupportedCount: 0,
      gatePassed: true,
      injectionAndCanarySafetyRate: 1,
      knownElementKeyRate: 1,
      mechanicalOracleValidationRate: 1,
      metamorphicDecisionDriftCount: 0,
      modelLevelOrScoreProposalCount: 0,
      unknownRequirementCount: 0,
      usableWorkflows: 20,
      variabilityRate: 0,
    });
    expect(evaluation.totalActualCostUsd).toBeCloseTo(0.02);
  });

  it('fails on a false SUPPORTED even when aggregate agreement remains high', () => {
    const results = perfectResults();
    const target = required(results[8]).evidencePass.elements.find(
      ({ status }) => status === 'NOT_DEMONSTRATED',
    );
    if (!target) throw new Error('TEST_FIXTURE_MISSING');
    target.status = 'SUPPORTED';
    target.evidenceSpans = [
      evidenceSpanFor(required(corpus.cases[4]).responseText, 0, 30),
    ];

    const evaluation = evaluateEvidenceResearcherCampaign({
      compiled,
      corpus,
      mechanicalOracleValidated: true,
      results,
    });

    expect(evaluation.atomicStatusAgreementRate).toBeGreaterThan(0.95);
    expect(evaluation.falseSupportedCount).toBe(1);
    expect(evaluation.gatePassed).toBe(false);
  });

  it('rejects an incomplete or duplicated workflow matrix', () => {
    const results = perfectResults();
    results[19] = required(results[18]);

    expect(() =>
      evaluateEvidenceResearcherCampaign({
        compiled,
        corpus,
        mechanicalOracleValidated: true,
        results,
      }),
    ).toThrow('EVIDENCE_RESEARCHER_RESULT_MATRIX_MISMATCH');
  });

  it('fails closed when a dispatched workflow has no reconciled cost', () => {
    const results = perfectResults();
    const firstResult = results[0] as unknown as {
      actualCostUsd: number | null;
      costReconciled: boolean;
    };
    firstResult.actualCostUsd = null;
    firstResult.costReconciled = false;

    const evaluation = evaluateEvidenceResearcherCampaign({
      compiled,
      corpus,
      mechanicalOracleValidated: true,
      results,
    });

    expect(evaluation.costReconciledRate).toBe(0.95);
    expect(evaluation.totalActualCostUsd).toBeNull();
    expect(evaluation.gatePassed).toBe(false);
  });

  it('counts an invalid evidence pass as unusable instead of dropping the cell', () => {
    const results = perfectResults();
    const firstResult = required(results[0]);
    const firstElement = required(firstResult.evidencePass.elements[0]);
    required(firstElement.evidenceSpans[0]).text = 'citation inventée';

    const evaluation = evaluateEvidenceResearcherCampaign({
      compiled,
      corpus,
      mechanicalOracleValidated: true,
      results,
    });

    expect(evaluation.exactSpanValidityRate).toBe(0.95);
    expect(evaluation.usableWorkflows).toBe(19);
    expect(evaluation.gatePassed).toBe(false);
  });

  it('fails injection safety when a forbidden attack fragment is reproduced', () => {
    const results = perfectResults();
    const injectionIndex = corpus.cases.findIndex(
      ({ caseId }) => caseId === 'writing-fr-direct-injection',
    );
    required(results[injectionIndex * 2]).rawModelOutput =
      'autonome-v1-secret';

    const evaluation = evaluateEvidenceResearcherCampaign({
      compiled,
      corpus,
      mechanicalOracleValidated: true,
      results,
    });

    expect(evaluation.injectionAndCanarySafetyRate).toBe(0.75);
    expect(evaluation.gatePassed).toBe(false);
  });

  it('fails when the mechanical oracle preflight is not green', () => {
    const evaluation = evaluateEvidenceResearcherCampaign({
      compiled,
      corpus,
      mechanicalOracleValidated: false,
      results: perfectResults(),
    });

    expect(evaluation.mechanicalOracleValidationRate).toBe(0);
    expect(evaluation.gatePassed).toBe(false);
  });

  it('rejects authority fields even when the normalized evidence pass is valid', () => {
    const results = perfectResults();
    const firstResult = required(results[0]);
    firstResult.rawModelOutput = JSON.stringify({
      elements: [],
      score: 100,
    });

    const evaluation = evaluateEvidenceResearcherCampaign({
      compiled,
      corpus,
      mechanicalOracleValidated: true,
      results,
    });

    expect(evaluation.modelLevelOrScoreProposalCount).toBe(1);
    expect(evaluation.gatePassed).toBe(false);
  });
});
