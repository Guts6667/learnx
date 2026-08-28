import { z } from 'zod';
import {
  correctionOutputSchema,
  protocol3CorrectionArtifactOutputSchema,
} from './ai-correction-contracts.js';
import {
  benchmarkCandidateSchema,
  exactModelIdSchema,
} from './ai-correction-benchmark-configuration.js';
import { stableKeySchema } from './ai-correction-benchmark-corpus.js';
import { benchmarkUsageSchema } from './ai-correction-benchmark-run-artifacts.js';

export const evidenceMatchSchema = z
  .object({
    criterionKey: stableKeySchema,
    matchType: z.enum(['EXACT', 'TYPOGRAPHIC_EQUIVALENT']),
    requestedQuote: z.string().min(1),
    resolvedQuote: z.string().min(1),
  })
  .strict();

const benchmarkAttemptOutputSchema = z.union([
  correctionOutputSchema,
  protocol3CorrectionArtifactOutputSchema,
]);

export const benchmarkAttemptSchema = z
  .object({
    attempt: z.number().int().positive(),
    candidateId: stableKeySchema,
    caseId: stableKeySchema,
    evidenceMatches: z.array(evidenceMatchSchema).optional(),
    errorCode: z.string().trim().min(1).optional(),
    latencyMs: z.number().int().nonnegative(),
    modelId: exactModelIdSchema,
    modelSnapshot: z.string().trim().min(1).optional(),
    output: benchmarkAttemptOutputSchema.optional(),
    provider: z.string().trim().min(1).optional(),
    providerRequestId: z.string().trim().min(1).optional(),
    providerRoute: z.string().trim().min(1).optional(),
    rawModelOutput: z.string().max(20_000).optional(),
    repetition: z.number().int().positive(),
    requestProfileSnapshot: benchmarkCandidateSchema.shape.requestProfile,
    requestProtocolVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    status: z.enum(['VALID', 'INVALID', 'ERROR']),
    unsureCriteria: z.array(stableKeySchema).optional(),
    usage: benchmarkUsageSchema.optional(),
    workflowPass: z
      .enum(['PRIMARY', 'RETRY', 'SCORE_GUARD_SECOND_PASS'])
      .optional(),
  })
  .strict()
  .superRefine((attempt, context) => {
    if (
      (attempt.workflowPass === 'PRIMARY' && attempt.attempt !== 1) ||
      (attempt.workflowPass !== undefined &&
        attempt.workflowPass !== 'PRIMARY' &&
        attempt.attempt === 1)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Workflow pass kind does not match its attempt position.',
        path: ['workflowPass'],
      });
    }
    if (attempt.status === 'VALID' && !attempt.output) {
      context.addIssue({
        code: 'custom',
        message: 'A valid attempt must include a structured output.',
        path: ['output'],
      });
    }
    if (attempt.status !== 'VALID' && !attempt.errorCode) {
      context.addIssue({
        code: 'custom',
        message: 'An invalid or failed attempt must include an error code.',
        path: ['errorCode'],
      });
    }
    if (
      attempt.output &&
      !attempt.requestProtocolVersion.startsWith('3.') &&
      !correctionOutputSchema.safeParse(attempt.output).success
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Attempt output does not match its request protocol.',
        path: ['output'],
      });
    }
  });
export type BenchmarkAttempt = z.infer<typeof benchmarkAttemptSchema>;
export type EvidenceMatch = z.infer<typeof evidenceMatchSchema>;
