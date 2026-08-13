import { z } from 'zod';

import {
  atomicEvidenceStatusSchema,
  buildEvidenceCertificate,
  type CompiledExecutableRubric,
  type ConsolidatedElementEvidence,
} from './executable-rubric-engine.ts';

const stableKeySchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

const mechanicalCaseSchema = z
  .object({
    caseId: stableKeySchema,
    expected: z
      .object({
        correctionState: z.enum([
          'FEEDBACK_READY',
          'REVISION_REQUIRED',
          'CLARIFICATION_REQUIRED',
        ]),
        criterionLevels: z.record(
          stableKeySchema,
          z.enum(['insufficient', 'partial', 'mastered']).nullable(),
        ),
        exactIndicativeScore: z.number().min(-200).max(100).nullable(),
      })
      .strict(),
    statusVector: z.record(stableKeySchema, atomicEvidenceStatusSchema),
    transformation: z.enum([
      'BASELINE',
      'LOCALITY',
      'MONOTONICITY',
      'MINIMAL_PAIR',
      'CONTRADICTION',
      'MATERIAL_AMBIGUITY',
      'NON_MATERIAL_AMBIGUITY',
    ]),
  })
  .strict();

export const mechanicalOracleSchema = z
  .object({
    cases: z.array(mechanicalCaseSchema).min(8),
    corpusId: stableKeySchema,
    corpusKind: z.literal('MECHANICAL_EXECUTABLE_ORACLE'),
    corpusVersion: z.string().trim().min(1),
    language: z.literal('fr-FR'),
    modality: z.literal('WRITING'),
    oracleAuthority: z.literal('CONSTRUCTION_VECTORS'),
    rubric: z
      .object({
        fingerprint: sha256Schema,
        key: stableKeySchema,
        version: z.string().trim().min(1),
      })
      .strict(),
    schemaVersion: z.literal(1),
  })
  .strict();

export type MechanicalOracle = z.infer<typeof mechanicalOracleSchema>;

function requiredStatus(
  statuses: Record<string, z.infer<typeof atomicEvidenceStatusSchema>>,
  elementKey: string,
): z.infer<typeof atomicEvidenceStatusSchema> {
  const status = statuses[elementKey];
  if (!status) {
    throw new Error('MECHANICAL_ORACLE_ELEMENT_COVERAGE_MISMATCH');
  }
  return status;
}

export function validateMechanicalOracle(input: {
  compiled: CompiledExecutableRubric;
  corpus: unknown;
}): MechanicalOracle {
  const corpus = mechanicalOracleSchema.parse(input.corpus);
  const { rubric } = input.compiled;
  if (
    corpus.rubric.key !== rubric.rubricKey ||
    corpus.rubric.version !== rubric.rubricVersion ||
    corpus.rubric.fingerprint !== input.compiled.rubricFingerprint
  ) {
    throw new Error('MECHANICAL_ORACLE_RUBRIC_IDENTITY_MISMATCH');
  }

  const elementKeys = rubric.elements.map(({ key }) => key).sort();
  const criterionKeys = rubric.criteria.map(({ key }) => key).sort();
  const caseIds = new Set<string>();
  corpus.cases.forEach((oracleCase) => {
    if (caseIds.has(oracleCase.caseId)) {
      throw new Error('MECHANICAL_ORACLE_DUPLICATE_CASE');
    }
    caseIds.add(oracleCase.caseId);
    if (Object.keys(oracleCase.statusVector).sort().join('|') !== elementKeys.join('|')) {
      throw new Error('MECHANICAL_ORACLE_ELEMENT_COVERAGE_MISMATCH');
    }
    if (
      Object.keys(oracleCase.expected.criterionLevels).sort().join('|') !==
      criterionKeys.join('|')
    ) {
      throw new Error('MECHANICAL_ORACLE_CRITERION_COVERAGE_MISMATCH');
    }

    const elements: ConsolidatedElementEvidence[] = rubric.elements.map((element) => ({
      contradictions: [],
      elementKey: element.key,
      evidenceSpans: [],
      researcherConfidence: null,
      status: requiredStatus(oracleCase.statusVector, element.key),
      verifierConfidence: null,
    }));
    const certificate = buildEvidenceCertificate({
      compiled: input.compiled,
      consolidatedEvidence: {
        elements,
        pipelineFingerprint: '0'.repeat(64),
      },
    });
    const actualLevels = Object.fromEntries(
      certificate.criteria.map(({ criterionKey, levelKey }) => [criterionKey, levelKey]),
    );
    if (
      JSON.stringify(actualLevels) !==
        JSON.stringify(oracleCase.expected.criterionLevels) ||
      certificate.correctionState !== oracleCase.expected.correctionState ||
      certificate.indicativeScore !== oracleCase.expected.exactIndicativeScore
    ) {
      throw new Error(`MECHANICAL_ORACLE_EXPECTATION_MISMATCH:${oracleCase.caseId}`);
    }
  });

  return corpus;
}
