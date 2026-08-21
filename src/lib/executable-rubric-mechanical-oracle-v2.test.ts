import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { compileExecutableRubricV2 } from './executable-rubric-engine-v2.ts';
import { validateMechanicalOracleV2 } from './executable-rubric-mechanical-oracle-v2.ts';

const root = resolve(
  process.cwd(),
  'benchmarks/ai-correction/executable-rubric',
);
const rubricPath = resolve(
  root,
  'writing-framework-selection-fr.v1.draft.json',
);
const corpusPath = resolve(
  root,
  'writing-framework-selection-fr.mechanical-oracle.v2.json',
);

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('TEST_FIXTURE_MISSING');
  return value;
}

function compiledRubric() {
  return compileExecutableRubricV2(readJson(rubricPath));
}

describe('mechanical executable oracle v2', () => {
  it('reconstructs all cases and detects all compiler mutations offline', () => {
    const validation = validateMechanicalOracleV2({
      compiled: compiledRubric(),
      corpus: readJson(corpusPath),
    });

    expect(validation.corpus.cases).toHaveLength(19);
    expect(validation.corpus.mutationCases).toHaveLength(7);
    expect(validation.caseCertificates).toHaveLength(19);
    expect(validation.corpusFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(
      new Set(validation.corpus.cases.map(({ transformation }) => transformation)),
    ).toEqual(
      new Set([
        'BASELINE',
        'MINIMAL_PAIR_LOCALITY',
        'MONOTONICITY',
        'METAMORPHIC_INVARIANCE',
        'MATERIAL_AMBIGUITY',
        'NON_MATERIAL_AMBIGUITY',
        'CONTRADICTION',
        'EXPLICIT_REFUTATION',
        'CONDITIONAL_FRAMEWORK',
        'INJECTION_INVARIANCE',
      ]),
    );
  });

  it('fails closed when the frozen rubric identity changes', () => {
    const corpus = structuredClone(readJson(corpusPath)) as {
      rubric: { fingerprint: string };
    };
    corpus.rubric.fingerprint = 'f'.repeat(64);

    expect(() =>
      validateMechanicalOracleV2({ compiled: compiledRubric(), corpus }),
    ).toThrow('MECHANICAL_ORACLE_V2_RUBRIC_IDENTITY_MISMATCH');
  });

  it('fails closed when a transformation family disappears', () => {
    const corpus = structuredClone(readJson(corpusPath)) as {
      cases: Array<{ transformation: string }>;
    };
    for (const oracleCase of corpus.cases) {
      if (oracleCase.transformation === 'INJECTION_INVARIANCE') {
        oracleCase.transformation = 'METAMORPHIC_INVARIANCE';
      }
    }

    expect(() =>
      validateMechanicalOracleV2({ compiled: compiledRubric(), corpus }),
    ).toThrow('ORACLE_TRANSFORMATION_COVERAGE_MISSING');
  });

  it('never permits an injection or canary segment to become evidence', () => {
    const corpus = structuredClone(readJson(corpusPath)) as {
      cases: Array<{
        caseId: string;
        findingOverrides: Record<
          string,
          { evidenceSegmentKeys: string[] }
        >;
      }>;
      baselineFindings: Record<string, unknown>;
    };
    const injectionCase = required(
      corpus.cases.find(({ caseId }) => caseId === 'injection-and-canary-ignored'),
    );
    injectionCase.findingOverrides['project-a-framework-choice'] = {
      ...(corpus.baselineFindings['project-a-framework-choice'] as object),
      evidenceSegmentKeys: ['injection'],
    } as { evidenceSegmentKeys: string[] };

    expect(() =>
      validateMechanicalOracleV2({ compiled: compiledRubric(), corpus }),
    ).toThrow('ORACLE_UNTRUSTED_SEGMENT_USED_AS_EVIDENCE');
  });

  it('detects a false locality declaration', () => {
    const corpus = structuredClone(readJson(corpusPath)) as {
      cases: Array<{
        caseId: string;
        invariant: { changedCriterionKeys: string[] };
      }>;
    };
    const localityCase = required(
      corpus.cases.find(
        ({ caseId }) => caseId === 'fidelity-a-first-fact-removed',
      ),
    );
    localityCase.invariant.changedCriterionKeys = ['framework-decision'];

    expect(() =>
      validateMechanicalOracleV2({ compiled: compiledRubric(), corpus }),
    ).toThrow(
      'ORACLE_CRITERION_LOCALITY_MISMATCH:fidelity-a-first-fact-removed',
    );
  });

  it('detects an expected result rewritten after corpus construction', () => {
    const corpus = structuredClone(readJson(corpusPath)) as {
      cases: Array<{
        caseId: string;
        expected: { correctionState: string };
      }>;
    };
    required(
      corpus.cases.find(
        ({ caseId }) => caseId === 'decision-a-materially-ambiguous',
      ),
    ).expected.correctionState = 'FEEDBACK_READY';

    expect(() =>
      validateMechanicalOracleV2({ compiled: compiledRubric(), corpus }),
    ).toThrow(
      'MECHANICAL_ORACLE_V2_EXPECTATION_MISMATCH:decision-a-materially-ambiguous',
    );
  });
});
