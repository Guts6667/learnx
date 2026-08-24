import { createHash } from 'node:crypto';

import { z } from 'zod';

const stableKeySchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

export const successorAtomicEvidenceStatusSchema = z.enum([
  'SUPPORTED',
  'NOT_DEMONSTRATED',
  'EXPLICITLY_REFUTED',
  'CONTRADICTED',
  'AMBIGUOUS',
]);

export const successorLevelEffectSchema = z.enum([
  'SATISFIED',
  'UNMET',
  'INDETERMINATE',
]);

const evidenceSpanSchema = z
  .object({
    end: z.number().int().positive(),
    sha256: sha256Schema,
    start: z.number().int().nonnegative(),
    text: z.string().min(1),
  })
  .strict()
  .refine(({ end, start }) => end > start, {
    message: 'Evidence span end must be greater than start.',
    path: ['end'],
  });

export const explicitRefutationMinimalPairsSchema = z
  .object({
    authorityBoundary: z
      .object({
        candidateRelationsMaySetAtomicStatus: z.literal(false),
        candidateRelationsMaySetLevel: z.literal(false),
        candidateRelationsMaySetProgression: z.literal(false),
        candidateRelationsMaySetScore: z.literal(false),
        offlineOnly: z.literal(true),
      })
      .strict(),
    cases: z
      .array(
        z
          .object({
            caseId: stableKeySchema,
            evidenceSpans: z.array(evidenceSpanSchema).max(4),
            expectedCandidateObservation: z.enum([
              'EVIDENCE_FOR_ELEMENT',
              'EVIDENCE_AGAINST_ELEMENT',
              'ABSTAIN',
              'MIXED',
            ]),
            expectedFeedbackTemplateKey: z.enum([
              'supported',
              'notDemonstrated',
              'explicitlyRefuted',
              'contradicted',
              'ambiguous',
            ]),
            expectedLevelEffect: successorLevelEffectSchema,
            expectedStatus: successorAtomicEvidenceStatusSchema,
            rationale: z.string().trim().min(1),
            responseText: z.string().min(1),
          })
          .strict(),
      )
      .min(6),
    ontologyId: stableKeySchema,
    ontologyVersion: z.literal('1.0.0'),
    schemaVersion: z.literal(1),
    statusPolicy: z
      .object({
        AMBIGUOUS: z.literal('INDETERMINATE'),
        CONTRADICTED: z.literal('UNMET'),
        EXPLICITLY_REFUTED: z.literal('UNMET'),
        NOT_DEMONSTRATED: z.literal('UNMET'),
        SUPPORTED: z.literal('SATISFIED'),
      })
      .strict(),
    target: z
      .object({
        criterionKey: stableKeySchema,
        elementKey: stableKeySchema,
        polarity: z.literal('POSITIVE'),
      })
      .strict(),
  })
  .strict();

export type ExplicitRefutationMinimalPairs = z.infer<
  typeof explicitRefutationMinimalPairsSchema
>;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function validateExplicitRefutationMinimalPairs(
  input: unknown,
): ExplicitRefutationMinimalPairs {
  const artifact = explicitRefutationMinimalPairsSchema.parse(input);
  const caseIds = artifact.cases.map(({ caseId }) => caseId);

  if (new Set(caseIds).size !== caseIds.length) {
    throw new Error('EXPLICIT_REFUTATION_DUPLICATE_CASE_ID');
  }

  for (const caseItem of artifact.cases) {
    if (
      artifact.statusPolicy[caseItem.expectedStatus] !==
      caseItem.expectedLevelEffect
    ) {
      throw new Error(
        `EXPLICIT_REFUTATION_LEVEL_EFFECT_MISMATCH_${caseItem.caseId}`,
      );
    }

    for (const span of caseItem.evidenceSpans) {
      const resolved = caseItem.responseText.slice(span.start, span.end);
      if (resolved !== span.text || sha256(resolved) !== span.sha256) {
        throw new Error(`EXPLICIT_REFUTATION_SPAN_MISMATCH_${caseItem.caseId}`);
      }
    }
  }

  const statuses = new Set(
    artifact.cases.map(({ expectedStatus }) => expectedStatus),
  );
  for (const requiredStatus of successorAtomicEvidenceStatusSchema.options) {
    if (!statuses.has(requiredStatus)) {
      throw new Error(
        `EXPLICIT_REFUTATION_STATUS_NOT_COVERED_${requiredStatus}`,
      );
    }
  }

  const notDemonstrated = artifact.cases.find(
    ({ expectedStatus }) => expectedStatus === 'NOT_DEMONSTRATED',
  );
  const explicitlyRefuted = artifact.cases.find(
    ({ expectedStatus }) => expectedStatus === 'EXPLICITLY_REFUTED',
  );

  if (!notDemonstrated || !explicitlyRefuted) {
    throw new Error('EXPLICIT_REFUTATION_MINIMAL_PAIR_MISSING');
  }
  if (
    notDemonstrated.expectedLevelEffect !==
    explicitlyRefuted.expectedLevelEffect
  ) {
    throw new Error('EXPLICIT_REFUTATION_MUST_SHARE_MVP_LEVEL_EFFECT');
  }
  if (
    notDemonstrated.expectedFeedbackTemplateKey ===
    explicitlyRefuted.expectedFeedbackTemplateKey
  ) {
    throw new Error('EXPLICIT_REFUTATION_REQUIRES_DISTINCT_FEEDBACK');
  }

  return artifact;
}
