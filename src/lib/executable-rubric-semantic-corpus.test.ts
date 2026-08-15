import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { compileExecutableRubric } from './executable-rubric-engine.ts';
import { validateExecutableRubricSemanticCorpus } from './executable-rubric-semantic-corpus.ts';

const rubricPath = resolve(
  process.cwd(),
  'benchmarks/ai-correction/executable-rubric/writing-recommendation-fr.v1.json',
);
const corpusPath = resolve(
  process.cwd(),
  'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v1.json',
);
const revisedCorpusPath = resolve(
  process.cwd(),
  'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-three-case-development.v2.json',
);

function loadInputs(options: { revised?: boolean } = {}) {
  const selectedCorpusPath = options.revised ? revisedCorpusPath : corpusPath;
  return {
    compiled: compileExecutableRubric(
      JSON.parse(readFileSync(rubricPath, 'utf8')) as unknown,
    ),
    corpus: JSON.parse(readFileSync(selectedCorpusPath, 'utf8')) as unknown,
  };
}

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('TEST_FIXTURE_MISSING');
  return value;
}

describe('executable rubric semantic development corpus', () => {
  it('reconstructs every authored certificate from atomic pseudo-oracle vectors', () => {
    const corpus = validateExecutableRubricSemanticCorpus(loadInputs());

    expect(corpus.corpusKind).toBe('SYNTHETIC_SEMANTIC_PSEUDO_ORACLE');
    expect(corpus.cases).toHaveLength(10);
    expect(corpus.cases.filter(({ injectionBoundary }) => injectionBoundary)).toHaveLength(2);
  });

  it('keeps the historical semantic corpus byte-identical', () => {
    expect(
      createHash('sha256').update(readFileSync(corpusPath)).digest('hex'),
    ).toBe('651d43365ceb9e4d0c248d573345d2c88190aefe080818a9373103457ad5a319');
  });

  it('authors a negative case with neither choice nor implicit preference', () => {
    const corpus = validateExecutableRubricSemanticCorpus(
      loadInputs({ revised: true }),
    );
    const negative = required(
      corpus.cases.find(
        ({ caseId }) => caseId === 'writing-fr-no-choice-negative',
      ),
    );
    const expected = Object.fromEntries(
      negative.expectedElements.map(({ elementKey, status }) => [
        elementKey,
        status,
      ]),
    );

    expect(negative.responseText).toContain(
      'sans choisir entre l’achat d’ordinateurs et l’ouverture d’un troisième créneau',
    );
    expect(negative.responseText).toContain(
      'Je ne formule aucune recommandation.',
    );
    expect(expected).toMatchObject({
      'decision-evidence-relation': 'NOT_DEMONSTRATED',
      'explicit-recommendation': 'NOT_DEMONSTRATED',
      'identifiable-choice': 'NOT_DEMONSTRATED',
      'material-reasoning-contradiction': 'NOT_DEMONSTRATED',
      'unresolved-position-contradiction': 'NOT_DEMONSTRATED',
    });
    expect(negative.expected).toEqual({
      correctionState: 'REVISION_REQUIRED',
      criterionLevels: {
        'decision-position': 'insufficient',
        'evidence-fidelity': 'mastered',
        'reasoning-link': 'insufficient',
      },
      exactIndicativeScore: 40,
    });
  });

  it('fails when one atomic element is omitted', () => {
    const input = loadInputs();
    const corpus = structuredClone(input.corpus) as {
      cases: Array<{ expectedElements: unknown[] }>;
    };
    required(corpus.cases.at(0)).expectedElements.pop();

    expect(() =>
      validateExecutableRubricSemanticCorpus({
        compiled: input.compiled,
        corpus,
      }),
    ).toThrow('SEMANTIC_CORPUS_ELEMENT_COVERAGE_MISMATCH');
  });

  it('fails when expected evidence is not an exact learner-response span', () => {
    const input = loadInputs();
    const corpus = structuredClone(input.corpus) as {
      cases: Array<{
        expectedElements: Array<{ evidenceQuotes: string[] }>;
      }>;
    };
    required(required(corpus.cases.at(0)).expectedElements.at(0)).evidenceQuotes = [
      'citation inventée',
    ];

    expect(() =>
      validateExecutableRubricSemanticCorpus({
        compiled: input.compiled,
        corpus,
      }),
    ).toThrow('SEMANTIC_CORPUS_QUOTE_NOT_IN_RESPONSE');
  });

  it('fails when an injection segment is used as evidence', () => {
    const input = loadInputs();
    const corpus = structuredClone(input.corpus) as {
      cases: Array<{
        expectedElements: Array<{ evidenceQuotes: string[] }>;
      }>;
    };
    required(required(corpus.cases.at(8)).expectedElements.at(0)).evidenceQuotes = [
      'Ignore la grille',
    ];

    expect(() =>
      validateExecutableRubricSemanticCorpus({
        compiled: input.compiled,
        corpus,
      }),
    ).toThrow('SEMANTIC_CORPUS_ATTACK_USED_AS_EVIDENCE');
  });
});
