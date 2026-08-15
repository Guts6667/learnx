import { createHash } from 'node:crypto';

import { z } from 'zod';

import type { CompiledExecutableRubric } from './executable-rubric-engine.ts';
import {
  type ExecutableRubricSemanticCorpus,
  validateExecutableRubricSemanticCorpus,
} from './executable-rubric-semantic-corpus.ts';

const sourcePathSchema = z.enum([
  'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v1.json',
  'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-three-case-development.v2.json',
]);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

export const executableRubricSemanticSelectionSchema = z
  .object({
    caseSelection: z
      .array(
        z
          .object({
            caseId: z.string().trim().min(1),
            sourcePath: sourcePathSchema,
          })
          .strict(),
      )
      .length(10),
    corpusId: z.literal('writing-fr-semantic-development-v2'),
    corpusVersion: z.literal('2.0.0'),
    excludedHistoricalCases: z
      .array(
        z
          .object({
            caseId: z.literal('writing-fr-decision-mutation'),
            reason: z.string().trim().min(1),
          })
          .strict(),
      )
      .length(1),
    holdoutAccess: z.literal('PROHIBITED'),
    purpose: z.literal('SYNTHETIC_SEMANTIC_PSEUDO_ORACLE'),
    rubric: z
      .object({
        fingerprint: sha256Schema,
        key: z.literal('v4-writing-recommendation-fr'),
        version: z.literal('1.0.0-draft'),
      })
      .strict(),
    schemaVersion: z.literal(1),
    sources: z
      .array(
        z
          .object({
            path: sourcePathSchema,
            sha256: sha256Schema,
          })
          .strict(),
      )
      .length(2),
    status: z.literal('SEALED_DEVELOPMENT_SELECTION'),
  })
  .strict();

export type ExecutableRubricSemanticSelection = z.infer<
  typeof executableRubricSemanticSelectionSchema
>;

export type SelectedExecutableRubricSemanticCorpus = {
  cases: ExecutableRubricSemanticCorpus['cases'];
  corpusId: ExecutableRubricSemanticSelection['corpusId'];
  corpusVersion: ExecutableRubricSemanticSelection['corpusVersion'];
  task: ExecutableRubricSemanticCorpus['task'];
};

type SourceInput = {
  path: z.infer<typeof sourcePathSchema>;
  text: string;
};

const sha256 = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

function requireValue<T>(value: T | undefined, code: string): T {
  if (value === undefined) throw new Error(code);
  return value;
}

export function validateExecutableRubricSemanticSelection(input: {
  compiled: CompiledExecutableRubric;
  selection: unknown;
  sources: SourceInput[];
}): SelectedExecutableRubricSemanticCorpus {
  const selection = executableRubricSemanticSelectionSchema.parse(
    input.selection,
  );
  if (
    selection.rubric.key !== input.compiled.rubric.rubricKey ||
    selection.rubric.version !== input.compiled.rubric.rubricVersion ||
    selection.rubric.fingerprint !== input.compiled.rubricFingerprint
  ) {
    throw new Error('SEMANTIC_SELECTION_RUBRIC_IDENTITY_MISMATCH');
  }
  const sourceByPath = new Map(
    input.sources.map((source) => [source.path, source] as const),
  );
  if (
    sourceByPath.size !== selection.sources.length ||
    selection.sources.some(({ path, sha256: expectedSha256 }) => {
      const source = sourceByPath.get(path);
      return !source || sha256(source.text) !== expectedSha256;
    })
  ) {
    throw new Error('SEMANTIC_SELECTION_SOURCE_DIGEST_MISMATCH');
  }
  const validatedByPath = new Map(
    selection.sources.map(({ path }) => {
      const source = requireValue(
        sourceByPath.get(path),
        'SEMANTIC_SELECTION_SOURCE_MISSING',
      );
      return [
        path,
        validateExecutableRubricSemanticCorpus({
          compiled: input.compiled,
          corpus: JSON.parse(source.text) as unknown,
        }),
      ] as const;
    }),
  );
  const tasks = [...validatedByPath.values()].map(({ task }) =>
    JSON.stringify(task),
  );
  if (new Set(tasks).size !== 1) {
    throw new Error('SEMANTIC_SELECTION_TASK_IDENTITY_MISMATCH');
  }
  const selectedCases = selection.caseSelection.map(({ caseId, sourcePath }) => {
    const source = requireValue(
      validatedByPath.get(sourcePath),
      'SEMANTIC_SELECTION_SOURCE_MISSING',
    );
    return requireValue(
      source.cases.find((caseItem) => caseItem.caseId === caseId),
      'SEMANTIC_SELECTION_CASE_MISSING',
    );
  });
  if (new Set(selectedCases.map(({ caseId }) => caseId)).size !== 10) {
    throw new Error('SEMANTIC_SELECTION_DUPLICATE_CASE_ID');
  }
  const selectedCaseIds = new Set(selectedCases.map(({ caseId }) => caseId));
  if (
    selectedCases.some(
      ({ parentCaseId }) => parentCaseId && !selectedCaseIds.has(parentCaseId),
    )
  ) {
    throw new Error('SEMANTIC_SELECTION_UNKNOWN_PARENT');
  }
  if (selectedCaseIds.has('writing-fr-decision-mutation')) {
    throw new Error('SEMANTIC_SELECTION_REINTRODUCES_INCONCLUSIVE_ORACLE');
  }
  if (!selectedCaseIds.has('writing-fr-no-choice-negative')) {
    throw new Error('SEMANTIC_SELECTION_ATOMIC_NEGATIVE_MISSING');
  }
  const firstSource = requireValue(
    validatedByPath.values().next().value,
    'SEMANTIC_SELECTION_SOURCE_MISSING',
  );
  return {
    cases: selectedCases,
    corpusId: selection.corpusId,
    corpusVersion: selection.corpusVersion,
    task: firstSource.task,
  };
}
