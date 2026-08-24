import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { compileExecutableRubricV2 } from './executable-rubric-engine-v2.ts';
import {
  MECHANICAL_ORACLE_V21_FINGERPRINT,
  validateMechanicalOracleV21,
} from './executable-rubric-mechanical-oracle-v2-1.ts';

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
  'writing-framework-selection-fr.mechanical-oracle.v2.1.json',
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

describe('mechanical executable oracle v2.1', () => {
  it('reconstructs all cases and detects all compiler mutations offline', () => {
    const validation = validateMechanicalOracleV21({
      compiled: compiledRubric(),
      corpus: readJson(corpusPath),
    });

    expect(validation.corpus.cases).toHaveLength(33);
    expect(validation.corpus.mutationCases).toHaveLength(7);
    expect(validation.caseCertificates).toHaveLength(33);
    expect(validation.corpusFingerprint).toBe(
      MECHANICAL_ORACLE_V21_FINGERPRINT,
    );
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
      validateMechanicalOracleV21({ compiled: compiledRubric(), corpus }),
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
      validateMechanicalOracleV21({ compiled: compiledRubric(), corpus }),
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
      validateMechanicalOracleV21({ compiled: compiledRubric(), corpus }),
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
      validateMechanicalOracleV21({ compiled: compiledRubric(), corpus }),
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
      validateMechanicalOracleV21({ compiled: compiledRubric(), corpus }),
    ).toThrow(
      'MECHANICAL_ORACLE_V2_EXPECTATION_MISMATCH:decision-a-materially-ambiguous',
    );
  });

  it('keeps the same fingerprint and verdict when expected level keys are reordered', () => {
    const corpus = structuredClone(readJson(corpusPath)) as {
      cases: Array<{
        caseId: string;
        expected: { criterionLevels: Record<string, string> };
      }>;
    };
    const baseline = required(
      corpus.cases.find(
        ({ caseId }) => caseId === 'baseline-pico-spider-mastered',
      ),
    );
    baseline.expected.criterionLevels = {
      'choice-rationale': 'mastered',
      'dossier-fidelity': 'mastered',
      'framework-decision': 'mastered',
    };

    expect(
      validateMechanicalOracleV21({ compiled: compiledRubric(), corpus })
        .corpusFingerprint,
    ).toBe(MECHANICAL_ORACLE_V21_FINGERPRINT);
  });

  it('fails closed when a semantic corpus field drifts', () => {
    const corpus = structuredClone(readJson(corpusPath)) as {
      corpusId: string;
    };
    corpus.corpusId = 'writing-framework-selection-fr-mechanical-oracle-v2-1-drift';

    expect(() =>
      validateMechanicalOracleV21({ compiled: compiledRubric(), corpus }),
    ).toThrow('MECHANICAL_ORACLE_V2_1_FINGERPRINT_MISMATCH');
  });

  it('rejects a foreign finding override instead of ignoring it', () => {
    const corpus = structuredClone(readJson(corpusPath)) as {
      cases: Array<{
        caseId: string;
        findingOverrides: Record<string, unknown>;
      }>;
      baselineFindings: Record<string, unknown>;
    };
    const baseline = required(
      corpus.cases.find(
        ({ caseId }) => caseId === 'baseline-pico-spider-mastered',
      ),
    );
    baseline.findingOverrides['unknown-element'] =
      corpus.baselineFindings['project-a-framework-choice'];

    expect(() =>
      validateMechanicalOracleV21({ compiled: compiledRubric(), corpus }),
    ).toThrow(
      'ORACLE_FOREIGN_FINDING_OVERRIDE:baseline-pico-spider-mastered',
    );
  });

  it('requires every compiler mutation operator exactly once', () => {
    const corpus = structuredClone(readJson(corpusPath)) as {
      mutationCases: Array<{ expectedError: string; operator: string }>;
    };
    required(corpus.mutationCases.at(-1)).operator = 'FOREIGN_OWNER';
    required(corpus.mutationCases.at(-1)).expectedError =
      'CRITERION_CONTAINS_FOREIGN_ELEMENT';

    expect(() =>
      validateMechanicalOracleV21({ compiled: compiledRubric(), corpus }),
    ).toThrow('ORACLE_MUTATION_OPERATOR_COVERAGE_MISMATCH');
  });

  it('requires a discriminating injection case bound to injection and canary segments', () => {
    const corpus = structuredClone(readJson(corpusPath)) as {
      cases: Array<{
        caseId: string;
        expected: { criterionLevels: Record<string, string> };
        responseSegmentKeys: string[];
      }>;
    };
    const discriminating = required(
      corpus.cases.find(
        ({ caseId }) => caseId === 'injection-negative-base-remains-partial',
      ),
    );
    discriminating.expected.criterionLevels['framework-decision'] = 'mastered';

    expect(() =>
      validateMechanicalOracleV21({ compiled: compiledRubric(), corpus }),
    ).toThrow('ORACLE_INJECTION_NOT_DISCRIMINATING');

    discriminating.expected.criterionLevels['framework-decision'] = 'partial';
    discriminating.responseSegmentKeys = discriminating.responseSegmentKeys.filter(
      (key) => key !== 'canary',
    );
    expect(() =>
      validateMechanicalOracleV21({ compiled: compiledRubric(), corpus }),
    ).toThrow(
      'ORACLE_INJECTION_CASE_NOT_BOUND:injection-negative-base-remains-partial',
    );
  });

  it('requires actual pass disagreement and every audited hardening case', () => {
    const corpus = structuredClone(readJson(corpusPath)) as {
      cases: Array<{
        caseId: string;
        falsifierFindingOverrides?: Record<string, unknown>;
      }>;
    };
    const disagreement = required(
      corpus.cases.find(
        ({ caseId }) => caseId === 'independent-material-choice-disagreement',
      ),
    );
    disagreement.falsifierFindingOverrides = {};
    expect(() =>
      validateMechanicalOracleV21({ compiled: compiledRubric(), corpus }),
    ).toThrow(
      'ORACLE_PASS_DISAGREEMENT_MISMATCH:independent-material-choice-disagreement',
    );

    const missingCaseCorpus = structuredClone(readJson(corpusPath)) as {
      cases: Array<{ caseId: string }>;
    };
    missingCaseCorpus.cases = missingCaseCorpus.cases.filter(
      ({ caseId }) => caseId !== 'conditional-b-pcc-missing-context',
    );
    expect(() =>
      validateMechanicalOracleV21({
        compiled: compiledRubric(),
        corpus: missingCaseCorpus,
      }),
    ).toThrow(
      'ORACLE_HARDENING_CASE_MISSING:conditional-b-pcc-missing-context',
    );
  });
});
