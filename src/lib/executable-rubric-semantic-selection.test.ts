import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { compileExecutableRubric } from './executable-rubric-engine.ts';
import { validateExecutableRubricSemanticSelection } from './executable-rubric-semantic-selection.ts';

const root = process.cwd();
const selectionPath = resolve(
  root,
  'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v2.manifest.json',
);
const sourcePaths = [
  'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v1.json',
  'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-three-case-development.v2.json',
] as const;
const rubricPath = resolve(
  root,
  'benchmarks/ai-correction/executable-rubric/writing-recommendation-fr.v1.json',
);

function fixture() {
  return {
    compiled: compileExecutableRubric(
      JSON.parse(readFileSync(rubricPath, 'utf8')) as unknown,
    ),
    selection: JSON.parse(readFileSync(selectionPath, 'utf8')) as unknown,
    sources: sourcePaths.map((path) => ({
      path,
      text: readFileSync(resolve(root, path), 'utf8'),
    })),
  };
}

describe('executable rubric semantic corpus v2 selection', () => {
  it('selects ten sealed cases while replacing only the inconclusive negative', () => {
    const corpus = validateExecutableRubricSemanticSelection(fixture());

    expect(corpus.cases).toHaveLength(10);
    expect(corpus.cases.map(({ caseId }) => caseId)).toContain(
      'writing-fr-no-choice-negative',
    );
    expect(corpus.cases.map(({ caseId }) => caseId)).not.toContain(
      'writing-fr-decision-mutation',
    );
    expect(
      corpus.cases.filter(({ injectionBoundary }) => injectionBoundary),
    ).toHaveLength(2);
  });

  it('fails closed when a source digest changes', () => {
    const input = fixture();
    const first = input.sources[0];
    if (!first) throw new Error('TEST_SOURCE_MISSING');
    first.text = `${first.text}\n`;

    expect(() => validateExecutableRubricSemanticSelection(input)).toThrow(
      'SEMANTIC_SELECTION_SOURCE_DIGEST_MISMATCH',
    );
  });

  it('fails closed if the ambiguous historical fixture is reintroduced', () => {
    const input = fixture();
    const selection = input.selection as {
      caseSelection: Array<{ caseId: string; sourcePath: string }>;
    };
    selection.caseSelection[4] = {
      caseId: 'writing-fr-decision-mutation',
      sourcePath: sourcePaths[0],
    };

    expect(() => validateExecutableRubricSemanticSelection(input)).toThrow(
      'SEMANTIC_SELECTION_REINTRODUCES_INCONCLUSIVE_ORACLE',
    );
  });
});
