import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { compileExecutableRubric } from './executable-rubric-engine.ts';
import { validateMechanicalOracle } from './executable-rubric-mechanical-oracle.ts';

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'));
}

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('TEST_FIXTURE_MISSING');
  return value;
}

const rubricPath =
  'benchmarks/ai-correction/executable-rubric/writing-recommendation-fr.v1.json';
const corpusPath =
  'benchmarks/ai-correction/executable-rubric/writing-fr-mechanical-oracle.v1.json';

describe('mechanical executable oracle', () => {
  it('reconstructs every expected level, score and correction state', () => {
    const compiled = compileExecutableRubric(readJson(rubricPath));
    const corpus = validateMechanicalOracle({
      compiled,
      corpus: readJson(corpusPath),
    });

    expect(corpus.cases).toHaveLength(8);
    expect(new Set(corpus.cases.map(({ transformation }) => transformation))).toEqual(
      new Set([
        'BASELINE',
        'MINIMAL_PAIR',
        'LOCALITY',
        'CONTRADICTION',
        'MATERIAL_AMBIGUITY',
        'NON_MATERIAL_AMBIGUITY',
      ]),
    );
  });

  it('fails closed when a case omits an atomic element', () => {
    const compiled = compileExecutableRubric(readJson(rubricPath));
    const corpus = structuredClone(readJson(corpusPath)) as {
      cases: Array<{ statusVector: Record<string, string> }>;
    };
    delete required(corpus.cases.at(0)).statusVector['identifiable-choice'];

    expect(() => validateMechanicalOracle({ compiled, corpus })).toThrow(
      'MECHANICAL_ORACLE_ELEMENT_COVERAGE_MISMATCH',
    );
  });

  it('fails closed when the rubric fingerprint changes', () => {
    const compiled = compileExecutableRubric(readJson(rubricPath));
    const corpus = structuredClone(readJson(corpusPath)) as {
      rubric: { fingerprint: string };
    };
    corpus.rubric.fingerprint = 'f'.repeat(64);

    expect(() => validateMechanicalOracle({ compiled, corpus })).toThrow(
      'MECHANICAL_ORACLE_RUBRIC_IDENTITY_MISMATCH',
    );
  });

  it('requires both material and non-material ambiguity golds', () => {
    const compiled = compileExecutableRubric(readJson(rubricPath));
    const corpus = structuredClone(readJson(corpusPath)) as {
      cases: Array<{ transformation: string }>;
    };
    const material = required(
      corpus.cases.find(
        ({ transformation }) => transformation === 'MATERIAL_AMBIGUITY',
      ),
    );
    material.transformation = 'BASELINE';

    expect(() => validateMechanicalOracle({ compiled, corpus })).toThrow(
      'MECHANICAL_ORACLE_AMBIGUITY_COVERAGE_MISSING',
    );
  });
});
