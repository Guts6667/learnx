import { z } from 'zod';

import {
  buildEvidenceCertificate,
  type CompiledExecutableRubric,
  consolidateIndependentEvidence,
  evidenceSpanFor,
  type EvidencePass,
} from './executable-rubric-engine.ts';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const stableKeySchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
const resolvedStatusSchema = z.enum([
  'SUPPORTED',
  'CONTRADICTED',
  'NOT_DEMONSTRATED',
]);
const levelSchema = z.enum(['insufficient', 'partial', 'mastered']);

const expectedElementSchema = z
  .object({
    elementKey: stableKeySchema,
    evidenceQuotes: z.array(z.string().min(1)),
    status: resolvedStatusSchema,
  })
  .strict();

const injectionBoundarySchema = z
  .object({
    attackText: z.string().min(1),
    forbiddenOutputFragments: z.array(z.string().min(1)).min(1),
    legitimateResponseText: z.string().min(1),
  })
  .strict();

const semanticCaseSchema = z
  .object({
    caseId: stableKeySchema,
    expected: z
      .object({
        correctionState: z.enum([
          'FEEDBACK_READY',
          'REVISION_REQUIRED',
          'CLARIFICATION_REQUIRED',
        ]),
        criterionLevels: z.record(stableKeySchema, levelSchema),
        exactIndicativeScore: z.number().min(0).max(100).nullable(),
      })
      .strict(),
    expectedElements: z.array(expectedElementSchema).min(1),
    injectionBoundary: injectionBoundarySchema.optional(),
    parentCaseId: stableKeySchema.nullable(),
    responseText: z.string().min(1),
    transformation: z.enum([
      'BASELINE',
      'PARAPHRASE_INVARIANT',
      'CONCISION_INVARIANT',
      'TYPOGRAPHY_UNICODE_INVARIANT',
      'SINGLE_CRITERION_DECISION_MUTATION',
      'SINGLE_CRITERION_EVIDENCE_MUTATION',
      'SINGLE_CRITERION_REASONING_MUTATION',
      'CONTRADICTION_OWNER_MUTATION',
      'DIRECT_PROMPT_INJECTION',
      'UNICODE_PROMPT_INJECTION',
    ]),
  })
  .strict();

export const executableRubricSemanticCorpusSchema = z
  .object({
    cases: z.array(semanticCaseSchema).length(10),
    corpusId: z.literal('writing-fr-semantic-development-v1'),
    corpusKind: z.literal('SYNTHETIC_SEMANTIC_PSEUDO_ORACLE'),
    corpusVersion: z.literal('1.0.0'),
    language: z.literal('fr-FR'),
    lifecycle: z.literal('SEALED_DEVELOPMENT'),
    modality: z.literal('WRITING'),
    oracleAuthority: z.literal('SPEC_DERIVED_SYNTHETIC_VECTORS'),
    oracleLimit: z.string().min(1),
    rubric: z
      .object({
        fingerprint: sha256Schema,
        key: z.literal('v4-writing-recommendation-fr'),
        version: z.literal('1.0.0-draft'),
      })
      .strict(),
    schemaVersion: z.literal(1),
    sourceLineage: z.string().min(1),
    task: z
      .object({
        context: z.string().min(1),
        prompt: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export type ExecutableRubricSemanticCorpus = z.infer<
  typeof executableRubricSemanticCorpusSchema
>;

function assertUnique(values: string[], code: string): void {
  if (new Set(values).size !== values.length) throw new Error(code);
}

function requireValue<T>(value: T | undefined, code: string): T {
  if (value === undefined) throw new Error(code);
  return value;
}

function evidencePassForCase(input: {
  caseItem: ExecutableRubricSemanticCorpus['cases'][number];
  compiled: CompiledExecutableRubric;
  role: EvidencePass['role'];
}): EvidencePass {
  return {
    elements: input.caseItem.expectedElements.map((element) => ({
      confidence: null,
      contradictions: [],
      elementKey: element.elementKey,
      evidenceSpans: element.evidenceQuotes.map((quote) => {
        const start = input.caseItem.responseText.indexOf(quote);
        if (start < 0) throw new Error('SEMANTIC_CORPUS_QUOTE_NOT_IN_RESPONSE');
        return evidenceSpanFor(
          input.caseItem.responseText,
          start,
          start + quote.length,
        );
      }),
      status: element.status,
    })),
    pipelineFingerprint:
      input.role === 'EVIDENCE_RESEARCHER' ? 'c'.repeat(64) : 'd'.repeat(64),
    role: input.role,
  };
}

function validateInjectionBoundary(
  caseItem: ExecutableRubricSemanticCorpus['cases'][number],
): void {
  const boundary = caseItem.injectionBoundary;
  if (!boundary) return;
  if (
    caseItem.responseText !==
    `${boundary.legitimateResponseText} ${boundary.attackText}`
  ) {
    throw new Error('SEMANTIC_CORPUS_INJECTION_BOUNDARY_MISMATCH');
  }
  boundary.forbiddenOutputFragments.forEach((fragment) => {
    if (!boundary.attackText.includes(fragment)) {
      throw new Error('SEMANTIC_CORPUS_FORBIDDEN_FRAGMENT_NOT_IN_ATTACK');
    }
  });
  caseItem.expectedElements.flatMap(({ evidenceQuotes }) => evidenceQuotes).forEach(
    (quote) => {
      if (boundary.attackText.includes(quote)) {
        throw new Error('SEMANTIC_CORPUS_ATTACK_USED_AS_EVIDENCE');
      }
    },
  );
}

export function validateExecutableRubricSemanticCorpus(input: {
  compiled: CompiledExecutableRubric;
  corpus: unknown;
}): ExecutableRubricSemanticCorpus {
  const corpus = executableRubricSemanticCorpusSchema.parse(input.corpus);
  if (
    corpus.rubric.key !== input.compiled.rubric.rubricKey ||
    corpus.rubric.version !== input.compiled.rubric.rubricVersion ||
    corpus.rubric.fingerprint !== input.compiled.rubricFingerprint
  ) {
    throw new Error('SEMANTIC_CORPUS_RUBRIC_IDENTITY_MISMATCH');
  }
  assertUnique(
    corpus.cases.map(({ caseId }) => caseId),
    'SEMANTIC_CORPUS_DUPLICATE_CASE_ID',
  );

  const expectedElementKeys = input.compiled.rubric.elements.map(({ key }) => key);
  const expectedCriterionKeys = input.compiled.rubric.criteria.map(({ key }) => key);
  corpus.cases.forEach((caseItem) => {
    const actualElementKeys = caseItem.expectedElements.map(({ elementKey }) => elementKey);
    const actualCriterionKeys = Object.keys(caseItem.expected.criterionLevels);
    assertUnique(actualElementKeys, 'SEMANTIC_CORPUS_DUPLICATE_ELEMENT_KEY');
    if (
      actualElementKeys.length !== expectedElementKeys.length ||
      expectedElementKeys.some((key) => !actualElementKeys.includes(key))
    ) {
      throw new Error('SEMANTIC_CORPUS_ELEMENT_COVERAGE_MISMATCH');
    }
    if (
      actualCriterionKeys.length !== expectedCriterionKeys.length ||
      expectedCriterionKeys.some((key) => !actualCriterionKeys.includes(key))
    ) {
      throw new Error('SEMANTIC_CORPUS_CRITERION_COVERAGE_MISMATCH');
    }
    if (
      caseItem.parentCaseId &&
      !corpus.cases.some(({ caseId }) => caseId === caseItem.parentCaseId)
    ) {
      throw new Error('SEMANTIC_CORPUS_UNKNOWN_PARENT');
    }
    validateInjectionBoundary(caseItem);

    const researcher = evidencePassForCase({
      caseItem,
      compiled: input.compiled,
      role: 'EVIDENCE_RESEARCHER',
    });
    const falsifier = evidencePassForCase({
      caseItem,
      compiled: input.compiled,
      role: 'EVIDENCE_FALSIFIER',
    });
    const consolidatedEvidence = consolidateIndependentEvidence({
      compiled: input.compiled,
      falsifier,
      researcher,
      responseText: caseItem.responseText,
    });
    const certificate = buildEvidenceCertificate({
      compiled: input.compiled,
      consolidatedEvidence,
    });
    const actualLevels = Object.fromEntries(
      certificate.criteria.map(({ criterionKey, levelKey }) => [
        criterionKey,
        requireValue(levelKey, 'SEMANTIC_CORPUS_UNEXPECTED_AMBIGUITY'),
      ]),
    );
    if (
      JSON.stringify(actualLevels) !==
        JSON.stringify(caseItem.expected.criterionLevels) ||
      certificate.correctionState !== caseItem.expected.correctionState ||
      certificate.indicativeScore !== caseItem.expected.exactIndicativeScore
    ) {
      throw new Error('SEMANTIC_CORPUS_EXPECTED_CERTIFICATE_MISMATCH');
    }
  });

  return corpus;
}
