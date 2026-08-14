import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { compileExecutableRubric } from './executable-rubric-engine.ts';
import { validateExecutableRubricSemanticAmbiguityCorpus } from './executable-rubric-semantic-ambiguity-corpus.ts';

const rubricPath = resolve(
  process.cwd(),
  'benchmarks/ai-correction/executable-rubric/writing-recommendation-fr.v1.json',
);
const corpusPath = resolve(
  process.cwd(),
  'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-ambiguity-development.v1.json',
);

function loadInputs() {
  return {
    compiled: compileExecutableRubric(
      JSON.parse(readFileSync(rubricPath, 'utf8')) as unknown,
    ),
    corpus: JSON.parse(readFileSync(corpusPath, 'utf8')) as unknown,
  };
}

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('TEST_FIXTURE_MISSING');
  return value;
}

describe('executable rubric semantic ambiguity development corpus', () => {
  it('reconstructs material and non-material ambiguity from independent resolved passes', () => {
    const corpus = validateExecutableRubricSemanticAmbiguityCorpus(loadInputs());

    expect(corpus.humanValidationClaimed).toBe(false);
    expect(corpus.review.status).toBe('PENDING_INDEPENDENT_HUMAN_REVIEW');
    expect(corpus.cases.map(({ transformation }) => transformation)).toEqual([
      'MATERIAL_AMBIGUITY',
      'NON_MATERIAL_AMBIGUITY',
    ]);
  });

  it('rejects a pseudo-ambiguity when both independent passes agree', () => {
    const input = loadInputs();
    const corpus = structuredClone(input.corpus) as {
      cases: Array<{
        falsifierElements: Array<{
          elementKey: string;
          evidenceQuotes: string[];
          status: string;
        }>;
        researcherElements: Array<{
          elementKey: string;
          evidenceQuotes: string[];
          status: string;
        }>;
      }>;
    };
    const caseItem = required(corpus.cases.at(0));
    caseItem.falsifierElements = structuredClone(caseItem.researcherElements);

    expect(() =>
      validateExecutableRubricSemanticAmbiguityCorpus({
        compiled: input.compiled,
        corpus,
      }),
    ).toThrow('SEMANTIC_AMBIGUITY_NO_INDEPENDENT_PASS_DISAGREEMENT');
  });

  it('rejects a materiality label inconsistent with the compiled certificate', () => {
    const input = loadInputs();
    const corpus = structuredClone(input.corpus) as {
      cases: Array<{ transformation: string }>;
    };
    required(corpus.cases.at(0)).transformation = 'NON_MATERIAL_AMBIGUITY';
    required(corpus.cases.at(1)).transformation = 'MATERIAL_AMBIGUITY';

    expect(() =>
      validateExecutableRubricSemanticAmbiguityCorpus({
        compiled: input.compiled,
        corpus,
      }),
    ).toThrow('SEMANTIC_AMBIGUITY_MATERIALITY_MISMATCH');
  });
});
