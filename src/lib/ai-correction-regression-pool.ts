/**
 * The V4.5-120 regression pool: schema, parser and offline validator.
 *
 * Implements §2 of `docs/V4_5_REGRESSION_SUITE.md`. The pool is a *reference*
 * to the historical corpora, never a copy of them: sources are pinned by path
 * and SHA-256, and the validator refuses a pool whose sources have moved under
 * it. That is what makes the corpora reusable instead of consumed — nothing
 * here rewrites an oracle, and `oracleKind: MODEL_AUTHORED` says out loud that
 * the historical gold is a drift signal rather than a truth.
 *
 * Validation is offline and total: it never calls a model, and it reports every
 * issue it finds rather than throwing on the first, so authoring 120 cases is
 * one pass instead of 120.
 */

import { createHash } from 'node:crypto';
import { z } from 'zod';

import {
  correctionBenchmarkCorpusSchema,
  stableKeySchema,
  languageTagSchema,
  benchmarkResponseCategorySchema,
  type CorrectionBenchmarkCorpus,
} from './ai-correction-benchmark-corpus.js';
import { countOccurrences, segmentSentences } from './ai-correction-regression-text.js';

/** Version of the pool contract; bumped when the shape below changes. */
export const REGRESSION_POOL_SCHEMA_VERSION = 1;

/**
 * Where a case's gold standard comes from, and therefore how much it may be
 * trusted. `MODEL_AUTHORED` is the honest label for every historical corpus.
 */
export const regressionOracleKindSchema = z.enum([
  'MODEL_AUTHORED',
  'LIVE_DERIVED',
  'MECHANICAL',
]);

/** The role a source corpus played when it was authored. */
export const regressionSourceRoleSchema = z.enum([
  'DEVELOPMENT_HISTORICAL',
  'HOLDOUT_HISTORICAL',
  'WRITING_HOLDOUT_HISTORICAL',
  'LIVE_DERIVED',
]);

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

const regressionSourceSchema = z
  .object({
    corpusId: stableKeySchema,
    path: z.string().trim().min(1),
    role: regressionSourceRoleSchema,
    sha256: sha256Schema,
  })
  .strict();

/**
 * A corpus deliberately left out, with the reason. Recorded so the exclusion is
 * an auditable decision rather than an omission somebody re-litigates later.
 */
const regressionExclusionSchema = z
  .object({
    path: z.string().trim().min(1),
    reason: z.string().trim().min(1),
  })
  .strict();

/**
 * Authored instructions telling the mutant generator how to damage a response
 * in a way whose *direction* is known in advance. A hint is the only part of
 * the pool a human wrote about the content itself, and the validator checks
 * each one is still applicable to the source text.
 */
export const regressionMutationHintSchema = z.discriminatedUnion('kind', [
  z
    .object({
      criterionKey: stableKeySchema,
      kind: z.literal('SENTENCE_DELETION'),
      /** Index into `segmentSentences` of the source response. */
      sentenceIndex: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      criterionKey: stableKeySchema,
      kind: z.literal('FACT_INVERSION'),
      replace: z
        .object({
          from: z.string().min(1),
          to: z.string().min(1),
        })
        .strict(),
    })
    .strict(),
]);

const expectedCriterionSchema = z
  .object({
    criterionKey: stableKeySchema,
    levelKey: stableKeySchema,
  })
  .strict();

const regressionCaseSchema = z
  .object({
    /** Segment of a `PROMPT_INJECTION` response carrying the attack. */
    attackSegment: z.string().trim().min(1).optional(),
    caseId: z.string().trim().min(1),
    contractRef: z
      .object({
        contractKey: stableKeySchema,
        contractVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
        path: z.string().trim().min(1),
      })
      .strict(),
    expectedCriteria: z.array(expectedCriterionSchema).min(1),
    /**
     * The contract's activity type. Covers both correction targets: the four
     * exercise activities and the stage-assessment ones V4.5-130 introduces,
     * so a stage case can enter the pool without a schema change. The
     * validator checks the value against the referenced contract.
     */
    family: z.enum([
      'writing',
      'reflection',
      'practice',
      'project',
      'case_study',
      'written_assignment',
      'practical_exercise',
      'oral',
      'simulation',
      'cumulative_exam',
    ]),
    mutationHints: z.array(regressionMutationHintSchema).default([]),
    oracleKind: regressionOracleKindSchema,
    profile: benchmarkResponseCategorySchema,
    sourceCaseId: stableKeySchema,
    sourcePath: z.string().trim().min(1),
  })
  .strict();

export const regressionPoolSchema = z
  .object({
    /**
     * The attack `INJECTION_APPEND` appends to a clean response. One canonical
     * text for the whole pool, so a leak is attributable to the model rather
     * than to which case happened to carry which wording. It asks for the
     * run's confidential canary, which the existing injection-safety check
     * already knows how to detect in an output.
     */
    canonicalAttackSegment: z.string().trim().min(1),
    cases: z.array(regressionCaseSchema).min(1),
    excluded: z.array(regressionExclusionSchema).default([]),
    generatedAt: z.iso.datetime({ offset: true }),
    language: languageTagSchema,
    poolId: stableKeySchema,
    schemaVersion: z.literal(REGRESSION_POOL_SCHEMA_VERSION),
    sources: z.array(regressionSourceSchema).min(1),
  })
  .strict();

export type RegressionPool = z.infer<typeof regressionPoolSchema>;
export type RegressionPoolCase = z.infer<typeof regressionCaseSchema>;
export type RegressionMutationHint = z.infer<
  typeof regressionMutationHintSchema
>;

export function parseRegressionPool(source: unknown): RegressionPool {
  return regressionPoolSchema.parse(source);
}

/** SHA-256 of a source file, as recorded in the pool. */
export function sha256Hex(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * One thing wrong with the pool, addressed to whoever is authoring it.
 * `path` is a JSON pointer-ish trail into the pool document.
 */
export type RegressionPoolIssue = {
  code: string;
  message: string;
  path: string;
};

/**
 * A source corpus as the validator needs it: the parsed corpus plus the exact
 * bytes it was parsed from, so the digest check compares files rather than
 * re-serialisations.
 */
export type LoadedRegressionSource = {
  corpus: CorrectionBenchmarkCorpus;
  raw: Buffer | string;
};

/**
 * Checks everything about a pool that can be decided without a model call:
 * source digests, case identity, oracle fidelity to the source corpus, and
 * applicability of every authored mutation hint.
 *
 * Returns the full list of issues; an empty list means `ai:benchmark:validate`
 * is green.
 */
export function validateRegressionPool(input: {
  pool: RegressionPool;
  /** Sources keyed by their `path` as written in the pool. */
  sources: Map<string, LoadedRegressionSource>;
}): RegressionPoolIssue[] {
  const issues: RegressionPoolIssue[] = [];
  const sourcesByPath = new Map<
    string,
    { corpus: CorrectionBenchmarkCorpus; role: string }
  >();

  input.pool.sources.forEach((source, index) => {
    const loaded = input.sources.get(source.path);
    if (!loaded) {
      issues.push({
        code: 'SOURCE_UNREADABLE',
        message: `Source corpus is not readable at ${source.path}.`,
        path: `sources[${index}].path`,
      });
      return;
    }
    const actual = sha256Hex(loaded.raw);
    if (actual !== source.sha256) {
      issues.push({
        code: 'SOURCE_DIGEST_MISMATCH',
        message: `Source corpus changed since the pool was built: expected ${source.sha256}, found ${actual}.`,
        path: `sources[${index}].sha256`,
      });
    }
    if (loaded.corpus.corpusId !== source.corpusId) {
      issues.push({
        code: 'SOURCE_CORPUS_ID_MISMATCH',
        message: `Source corpus identifier is ${loaded.corpus.corpusId}, not ${source.corpusId}.`,
        path: `sources[${index}].corpusId`,
      });
    }
    if (loaded.corpus.language !== input.pool.language) {
      issues.push({
        code: 'SOURCE_LANGUAGE_MISMATCH',
        message: `Source corpus language ${loaded.corpus.language} does not match the pool language ${input.pool.language}.`,
        path: `sources[${index}].path`,
      });
    }
    sourcesByPath.set(source.path, {
      corpus: loaded.corpus,
      role: source.role,
    });
  });

  const seenCaseIds = new Set<string>();
  input.pool.cases.forEach((poolCase, index) => {
    validatePoolCase({
      index,
      issues,
      language: input.pool.language,
      poolCase,
      seenCaseIds,
      sourcesByPath,
    });
  });

  return issues;
}

function validatePoolCase(input: {
  index: number;
  issues: RegressionPoolIssue[];
  language: string;
  poolCase: RegressionPoolCase;
  seenCaseIds: Set<string>;
  sourcesByPath: Map<string, { corpus: CorrectionBenchmarkCorpus; role: string }>;
}): void {
  const { index, issues, poolCase } = input;
  const at = (field: string): string => `cases[${index}].${field}`;

  if (input.seenCaseIds.has(poolCase.caseId)) {
    issues.push({
      code: 'CASE_ID_DUPLICATE',
      message: `Pool case identifier ${poolCase.caseId} is used more than once.`,
      path: at('caseId'),
    });
  }
  input.seenCaseIds.add(poolCase.caseId);

  const source = input.sourcesByPath.get(poolCase.sourcePath);
  if (!source) {
    issues.push({
      code: 'CASE_SOURCE_UNDECLARED',
      message: `Case references ${poolCase.sourcePath}, which is not a declared source.`,
      path: at('sourcePath'),
    });
    return;
  }

  const sourceCase = source.corpus.cases.find(
    (candidate) => candidate.caseId === poolCase.sourceCaseId,
  );
  if (!sourceCase) {
    issues.push({
      code: 'CASE_SOURCE_CASE_UNKNOWN',
      message: `Source corpus has no case ${poolCase.sourceCaseId}.`,
      path: at('sourceCaseId'),
    });
    return;
  }

  const contract = source.corpus.contracts.find(
    (candidate) =>
      candidate.contractKey === sourceCase.contractKey &&
      candidate.version === sourceCase.contractVersion,
  );
  if (!contract) {
    issues.push({
      code: 'CASE_CONTRACT_UNKNOWN',
      message: `Source corpus has no contract ${sourceCase.contractKey}@${sourceCase.contractVersion}.`,
      path: at('contractRef'),
    });
    return;
  }

  if (
    poolCase.contractRef.contractKey !== sourceCase.contractKey ||
    poolCase.contractRef.contractVersion !== sourceCase.contractVersion ||
    poolCase.contractRef.path !== poolCase.sourcePath
  ) {
    issues.push({
      code: 'CASE_CONTRACT_REF_MISMATCH',
      message: `Contract reference does not match the source case's contract ${sourceCase.contractKey}@${sourceCase.contractVersion}.`,
      path: at('contractRef'),
    });
  }

  if (poolCase.profile !== sourceCase.category) {
    issues.push({
      code: 'CASE_PROFILE_MISMATCH',
      message: `Profile ${poolCase.profile} does not match the source category ${sourceCase.category}.`,
      path: at('profile'),
    });
  }

  if (poolCase.family !== contract.target.activityType) {
    issues.push({
      code: 'CASE_FAMILY_MISMATCH',
      message: `Family ${poolCase.family} does not match the contract activity type ${contract.target.activityType}.`,
      path: at('family'),
    });
  }

  validateExpectedCriteria({ at, issues, poolCase, sourceCase });
  validateAttackSegment({ at, issues, poolCase, sourceCase });

  const sentences = segmentSentences({
    locale: input.language,
    text: sourceCase.responseText,
  });
  const criterionKeys = new Set(
    contract.criteria.map((criterion) => criterion.key),
  );
  poolCase.mutationHints.forEach((hint, hintIndex) => {
    validateMutationHint({
      criterionKeys,
      hint,
      hintIndex,
      issues,
      poolCaseIndex: index,
      responseText: sourceCase.responseText,
      sentenceCount: sentences.length,
    });
  });
}

function validateExpectedCriteria(input: {
  at: (field: string) => string;
  issues: RegressionPoolIssue[];
  poolCase: RegressionPoolCase;
  sourceCase: CorrectionBenchmarkCorpus['cases'][number];
}): void {
  const sourceExpected = new Map(
    input.sourceCase.expectedCriteria.map((criterion) => [
      criterion.criterionKey,
      criterion.levelKey,
    ]),
  );
  if (input.poolCase.expectedCriteria.length !== sourceExpected.size) {
    input.issues.push({
      code: 'CASE_EXPECTED_CRITERIA_MISMATCH',
      message: `Expected criteria must restate the source oracle exactly (${sourceExpected.size} criteria).`,
      path: input.at('expectedCriteria'),
    });
    return;
  }
  for (const criterion of input.poolCase.expectedCriteria) {
    const sourceLevel = sourceExpected.get(criterion.criterionKey);
    if (sourceLevel !== criterion.levelKey) {
      input.issues.push({
        code: 'CASE_EXPECTED_CRITERIA_MISMATCH',
        message: `Expected level for ${criterion.criterionKey} is ${String(sourceLevel)} in the source corpus, not ${criterion.levelKey}. The pool never rewrites an oracle.`,
        path: input.at('expectedCriteria'),
      });
    }
  }
}

function validateAttackSegment(input: {
  at: (field: string) => string;
  issues: RegressionPoolIssue[];
  poolCase: RegressionPoolCase;
  sourceCase: CorrectionBenchmarkCorpus['cases'][number];
}): void {
  const isInjection = input.poolCase.profile === 'PROMPT_INJECTION';
  if (!isInjection) {
    if (input.poolCase.attackSegment !== undefined) {
      input.issues.push({
        code: 'CASE_ATTACK_SEGMENT_FORBIDDEN',
        message:
          'Only prompt injection cases carry an attack segment.',
        path: input.at('attackSegment'),
      });
    }
    return;
  }
  if (input.poolCase.attackSegment === undefined) {
    input.issues.push({
      code: 'CASE_ATTACK_SEGMENT_MISSING',
      message:
        'Prompt injection cases must carry their attack segment for the security oracle.',
      path: input.at('attackSegment'),
    });
    return;
  }
  if (
    input.poolCase.attackSegment !== input.sourceCase.injectionSecurity?.attackText
  ) {
    input.issues.push({
      code: 'CASE_ATTACK_SEGMENT_MISMATCH',
      message:
        'Attack segment must be the source case injection attack text, verbatim.',
      path: input.at('attackSegment'),
    });
  }
}

function validateMutationHint(input: {
  criterionKeys: Set<string>;
  hint: RegressionMutationHint;
  hintIndex: number;
  issues: RegressionPoolIssue[];
  poolCaseIndex: number;
  responseText: string;
  sentenceCount: number;
}): void {
  const path = `cases[${input.poolCaseIndex}].mutationHints[${input.hintIndex}]`;
  if (!input.criterionKeys.has(input.hint.criterionKey)) {
    input.issues.push({
      code: 'HINT_CRITERION_UNKNOWN',
      message: `Hint targets ${input.hint.criterionKey}, which the contract does not define.`,
      path: `${path}.criterionKey`,
    });
  }

  if (input.hint.kind === 'SENTENCE_DELETION') {
    if (input.hint.sentenceIndex >= input.sentenceCount) {
      input.issues.push({
        code: 'HINT_SENTENCE_INDEX_OUT_OF_RANGE',
        message: `Response has ${input.sentenceCount} sentences, so index ${input.hint.sentenceIndex} cannot be deleted.`,
        path: `${path}.sentenceIndex`,
      });
    }
    if (input.sentenceCount < 2) {
      input.issues.push({
        code: 'HINT_SENTENCE_DELETION_EMPTIES_RESPONSE',
        message:
          'Deleting the only sentence would leave an empty response, which grades nothing.',
        path: `${path}.sentenceIndex`,
      });
    }
    return;
  }

  const occurrences = countOccurrences({
    haystack: input.responseText,
    needle: input.hint.replace.from,
  });
  if (occurrences !== 1) {
    input.issues.push({
      code: 'HINT_FACT_INVERSION_NOT_UNIQUE',
      message: `Fact inversion requires exactly one occurrence of "${input.hint.replace.from}"; found ${occurrences}.`,
      path: `${path}.replace.from`,
    });
  }
  if (input.hint.replace.from === input.hint.replace.to) {
    input.issues.push({
      code: 'HINT_FACT_INVERSION_NOT_A_CHANGE',
      message: 'Fact inversion must change the text it replaces.',
      path: `${path}.replace.to`,
    });
  }
}

/** Parses a corpus for use as a pool source, keeping its exact bytes. */
export function loadRegressionSource(
  raw: Buffer | string,
): LoadedRegressionSource {
  return {
    corpus: correctionBenchmarkCorpusSchema.parse(
      JSON.parse(raw.toString()) as unknown,
    ),
    raw,
  };
}
