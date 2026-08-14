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

const passElementSchema = z
  .object({
    elementKey: stableKeySchema,
    evidenceQuotes: z.array(z.string().min(1)),
    status: resolvedStatusSchema,
  })
  .strict();

const semanticAmbiguityCaseSchema = z
  .object({
    caseId: stableKeySchema,
    expected: z
      .object({
        correctionState: z.enum([
          'REVISION_REQUIRED',
          'CLARIFICATION_REQUIRED',
        ]),
        criterionLevels: z.record(stableKeySchema, levelSchema.nullable()),
        exactIndicativeScore: z.null(),
      })
      .strict(),
    falsifierElements: z.array(passElementSchema).min(1),
    researcherElements: z.array(passElementSchema).min(1),
    responseText: z.string().min(1),
    transformation: z.enum([
      'MATERIAL_AMBIGUITY',
      'NON_MATERIAL_AMBIGUITY',
    ]),
  })
  .strict();

export const executableRubricSemanticAmbiguityCorpusSchema = z
  .object({
    cases: z.array(semanticAmbiguityCaseSchema).length(2),
    corpusId: z.literal('writing-fr-semantic-ambiguity-development-v1'),
    corpusKind: z.literal('SYNTHETIC_SEMANTIC_DUAL_PASS_PSEUDO_ORACLE'),
    corpusVersion: z.literal('0.1.0-draft'),
    humanValidationClaimed: z.literal(false),
    language: z.literal('fr-FR'),
    lifecycle: z.literal('DRAFT_PEDAGOGICAL_REVIEW_REQUIRED'),
    modality: z.literal('WRITING'),
    oracleAuthority: z.literal('SPEC_DERIVED_SYNTHETIC_DUAL_PASS_VECTORS'),
    oracleLimit: z.string().min(1),
    review: z
      .object({
        reviewedAt: z.null(),
        reviewer: z.null(),
        status: z.literal('PENDING_INDEPENDENT_HUMAN_REVIEW'),
      })
      .strict(),
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

export type ExecutableRubricSemanticAmbiguityCorpus = z.infer<
  typeof executableRubricSemanticAmbiguityCorpusSchema
>;

function assertUnique(values: string[], code: string): void {
  if (new Set(values).size !== values.length) throw new Error(code);
}

function evidencePass(input: {
  compiled: CompiledExecutableRubric;
  elements: ExecutableRubricSemanticAmbiguityCorpus['cases'][number]['researcherElements'];
  responseText: string;
  role: EvidencePass['role'];
}): EvidencePass {
  return {
    elements: input.elements.map((element) => ({
      confidence: null,
      contradictions: [],
      elementKey: element.elementKey,
      evidenceSpans: element.evidenceQuotes.map((quote) => {
        const start = input.responseText.indexOf(quote);
        if (start < 0) {
          throw new Error('SEMANTIC_AMBIGUITY_QUOTE_NOT_IN_RESPONSE');
        }
        return evidenceSpanFor(
          input.responseText,
          start,
          start + quote.length,
        );
      }),
      status: element.status,
    })),
    pipelineFingerprint:
      input.role === 'EVIDENCE_RESEARCHER' ? 'e'.repeat(64) : 'f'.repeat(64),
    role: input.role,
  };
}

function assertPassCoverage(input: {
  actualKeys: string[];
  expectedKeys: string[];
}): void {
  assertUnique(input.actualKeys, 'SEMANTIC_AMBIGUITY_DUPLICATE_ELEMENT_KEY');
  if (
    input.actualKeys.length !== input.expectedKeys.length ||
    input.expectedKeys.some((key) => !input.actualKeys.includes(key))
  ) {
    throw new Error('SEMANTIC_AMBIGUITY_ELEMENT_COVERAGE_MISMATCH');
  }
}

export function validateExecutableRubricSemanticAmbiguityCorpus(input: {
  compiled: CompiledExecutableRubric;
  corpus: unknown;
}): ExecutableRubricSemanticAmbiguityCorpus {
  const corpus = executableRubricSemanticAmbiguityCorpusSchema.parse(input.corpus);
  if (
    corpus.rubric.key !== input.compiled.rubric.rubricKey ||
    corpus.rubric.version !== input.compiled.rubric.rubricVersion ||
    corpus.rubric.fingerprint !== input.compiled.rubricFingerprint
  ) {
    throw new Error('SEMANTIC_AMBIGUITY_RUBRIC_IDENTITY_MISMATCH');
  }

  assertUnique(
    corpus.cases.map(({ caseId }) => caseId),
    'SEMANTIC_AMBIGUITY_DUPLICATE_CASE_ID',
  );
  const transformations = new Set(
    corpus.cases.map(({ transformation }) => transformation),
  );
  if (
    !transformations.has('MATERIAL_AMBIGUITY') ||
    !transformations.has('NON_MATERIAL_AMBIGUITY')
  ) {
    throw new Error('SEMANTIC_AMBIGUITY_TRANSFORMATIONS_INCOMPLETE');
  }

  const expectedElementKeys = input.compiled.rubric.elements.map(({ key }) => key);
  const expectedCriterionKeys = input.compiled.rubric.criteria.map(({ key }) => key);
  corpus.cases.forEach((caseItem) => {
    assertPassCoverage({
      actualKeys: caseItem.researcherElements.map(({ elementKey }) => elementKey),
      expectedKeys: expectedElementKeys,
    });
    assertPassCoverage({
      actualKeys: caseItem.falsifierElements.map(({ elementKey }) => elementKey),
      expectedKeys: expectedElementKeys,
    });
    const actualCriterionKeys = Object.keys(caseItem.expected.criterionLevels);
    assertUnique(
      actualCriterionKeys,
      'SEMANTIC_AMBIGUITY_DUPLICATE_CRITERION_KEY',
    );
    if (
      actualCriterionKeys.length !== expectedCriterionKeys.length ||
      expectedCriterionKeys.some((key) => !actualCriterionKeys.includes(key))
    ) {
      throw new Error('SEMANTIC_AMBIGUITY_CRITERION_COVERAGE_MISMATCH');
    }

    const researcher = evidencePass({
      compiled: input.compiled,
      elements: caseItem.researcherElements,
      responseText: caseItem.responseText,
      role: 'EVIDENCE_RESEARCHER',
    });
    const falsifier = evidencePass({
      compiled: input.compiled,
      elements: caseItem.falsifierElements,
      responseText: caseItem.responseText,
      role: 'EVIDENCE_FALSIFIER',
    });
    const consolidatedEvidence = consolidateIndependentEvidence({
      compiled: input.compiled,
      falsifier,
      researcher,
      responseText: caseItem.responseText,
    });
    if (!consolidatedEvidence.elements.some(({ status }) => status === 'AMBIGUOUS')) {
      throw new Error('SEMANTIC_AMBIGUITY_NO_INDEPENDENT_PASS_DISAGREEMENT');
    }

    const certificate = buildEvidenceCertificate({
      compiled: input.compiled,
      consolidatedEvidence,
    });
    const actualLevels = Object.fromEntries(
      certificate.criteria.map(({ criterionKey, levelKey }) => [
        criterionKey,
        levelKey,
      ]),
    );
    if (
      expectedCriterionKeys.some(
        (criterionKey) =>
          actualLevels[criterionKey] !==
          caseItem.expected.criterionLevels[criterionKey],
      ) ||
      certificate.correctionState !== caseItem.expected.correctionState ||
      certificate.indicativeScore !== null
    ) {
      throw new Error('SEMANTIC_AMBIGUITY_EXPECTED_CERTIFICATE_MISMATCH');
    }
    const hasMaterialAmbiguity = certificate.criteria.some(
      ({ possibleLevelKeys }) => possibleLevelKeys.length > 1,
    );
    if (
      (caseItem.transformation === 'MATERIAL_AMBIGUITY') !==
      hasMaterialAmbiguity
    ) {
      throw new Error('SEMANTIC_AMBIGUITY_MATERIALITY_MISMATCH');
    }
  });

  return corpus;
}
