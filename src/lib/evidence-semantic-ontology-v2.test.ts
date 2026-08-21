import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { validateExplicitRefutationMinimalPairs } from './evidence-semantic-ontology-v2.ts';

const artifactPath = resolve(
  process.cwd(),
  'benchmarks/ai-correction/executable-rubric/writing-fr-explicit-refutation-minimal-pairs.v1.json',
);

function readArtifact(): unknown {
  return JSON.parse(readFileSync(artifactPath, 'utf8')) as unknown;
}

describe('evidence semantic ontology v2', () => {
  it('validates all statuses, exact spans and authority boundaries offline', () => {
    const artifact = validateExplicitRefutationMinimalPairs(readArtifact());

    expect(artifact.authorityBoundary.offlineOnly).toBe(true);
    expect(
      artifact.authorityBoundary.candidateRelationsMaySetAtomicStatus,
    ).toBe(false);
    expect(
      new Set(artifact.cases.map(({ expectedStatus }) => expectedStatus)),
    ).toEqual(
      new Set([
        'SUPPORTED',
        'NOT_DEMONSTRATED',
        'EXPLICITLY_REFUTED',
        'CONTRADICTED',
        'AMBIGUOUS',
      ]),
    );
  });

  it('keeps absence and explicit refusal equally unmet but explains them differently', () => {
    const artifact = validateExplicitRefutationMinimalPairs(readArtifact());
    const absent = artifact.cases.find(
      ({ expectedStatus }) => expectedStatus === 'NOT_DEMONSTRATED',
    );
    const refused = artifact.cases.find(
      ({ expectedStatus }) => expectedStatus === 'EXPLICITLY_REFUTED',
    );

    expect(absent?.expectedLevelEffect).toBe('UNMET');
    expect(refused?.expectedLevelEffect).toBe('UNMET');
    expect(absent?.expectedFeedbackTemplateKey).not.toBe(
      refused?.expectedFeedbackTemplateKey,
    );
    expect(absent?.evidenceSpans).toHaveLength(0);
    expect(refused?.evidenceSpans).toHaveLength(1);
  });

  it('does not mistake rejection of one option for refusal to recommend', () => {
    const artifact = validateExplicitRefutationMinimalPairs(readArtifact());
    const scopedNegation = artifact.cases.find(
      ({ caseId }) => caseId === 'writing-fr-recommendation-scoped-negation',
    );

    expect(scopedNegation?.expectedStatus).toBe('SUPPORTED');
    expect(scopedNegation?.expectedCandidateObservation).toBe(
      'EVIDENCE_FOR_ELEMENT',
    );
  });

  it('rejects a changed response when its persisted span no longer resolves', () => {
    const input = readArtifact() as {
      cases: Array<{ responseText: string }>;
    };
    const firstCase = input.cases.at(0);
    if (!firstCase) throw new Error('TEST_CASE_MISSING');
    firstCase.responseText = "Je conseille l'option A.";

    expect(() => validateExplicitRefutationMinimalPairs(input)).toThrow(
      'EXPLICIT_REFUTATION_SPAN_MISMATCH',
    );
  });
});
