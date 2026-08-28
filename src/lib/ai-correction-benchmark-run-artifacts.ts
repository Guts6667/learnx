import { z } from 'zod';
import { stableKeySchema } from './ai-correction-benchmark-corpus.js';

export const benchmarkUsageSchema = z
  .object({
    actualCostUsd: z.number().nonnegative().optional(),
    costSource: z.enum(['ACTUAL', 'ESTIMATED']),
    inputTokens: z.number().int().nonnegative(),
    reasoningTokens: z.number().int().nonnegative(),
    visibleOutputTokens: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((usage, context) => {
    if (usage.costSource === 'ACTUAL' && usage.actualCostUsd === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'Actual cost usage must include the supplier-reported amount.',
        path: ['actualCostUsd'],
      });
    }
    if (usage.costSource === 'ESTIMATED' && usage.actualCostUsd !== undefined) {
      context.addIssue({
        code: 'custom',
        message:
          'Estimated cost usage cannot be labelled as supplier-reported.',
        path: ['actualCostUsd'],
      });
    }
  });

export const benchmarkRunModeSchema = z.enum(['SMOKE', 'REVIEW_PANEL', 'FULL']);

export const benchmarkResultReviewSchema = z.discriminatedUnion('status', [
  z
    .object({
      reviewedAt: z.null(),
      reviewer: z.null(),
      status: z.literal('PENDING'),
    })
    .strict(),
  z
    .object({
      reviewedAt: z.iso.datetime({ offset: true }),
      reviewer: z.string().trim().min(1),
      status: z.literal('APPROVED'),
    })
    .strict(),
  z
    .object({
      reviewedAt: z.iso.datetime({ offset: true }),
      reviewer: z.string().trim().min(1),
      status: z.literal('REJECTED'),
    })
    .strict(),
]);

export const benchmarkReviewAuthoritySchema = z.enum([
  'NONE',
  'HUMAN',
  'AUTONOMOUS_AI_NOT_HUMAN',
]);

export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

const benchmarkAutonomousCorpusReviewMetadataSchema = z
  .object({
    artifactKind: z.literal('AUTONOMOUS_CORPUS_REVIEW_MANIFEST'),
    authoringManifestSha256: sha256Schema,
    configurationSha256: sha256Schema,
    corpusReviewManifestSha256: sha256Schema,
    corpusSha256: sha256Schema,
    ownerAuthorizationReference: z.string().trim().min(1),
    ownerAuthorizationSha256: sha256Schema,
    reviewedAt: z.iso.datetime({ offset: true }),
    reviewerIdentity: z.string().trim().min(1),
    reviewerKind: z.literal('AUTONOMOUS_AI_NOT_HUMAN'),
  })
  .strict();

const benchmarkOwnerResolvedCorpusMetadataSchema = z
  .object({
    artifactKind: z.literal('WRITING_CORPUS_PRESEAL_RESOLUTION'),
    authoringManifestSha256: sha256Schema,
    configurationSha256: sha256Schema,
    corpusReviewManifestSha256: sha256Schema,
    corpusSha256: sha256Schema,
    ownerAuthorizationReference: z.string().trim().min(1),
    ownerAuthorizationSha256: sha256Schema,
    priorRejectedReviewSha256: sha256Schema,
    resolvedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

const benchmarkCorpusReadinessMetadataSchema = z.union([
  benchmarkAutonomousCorpusReviewMetadataSchema,
  benchmarkOwnerResolvedCorpusMetadataSchema,
]);

export const benchmarkAutonomousResultReviewMetadataSchema = z
  .object({
    artifactKind: z.literal('AUTONOMOUS_RESULT_REVIEW_MANIFEST'),
    attemptsSha256: sha256Schema,
    blindReviewPacketSha256: sha256Schema,
    blindedToAutomaticVerdict: z.literal(true),
    blindedToCandidateIdentity: z.literal(true),
    blindedToCandidateOutputs: z.literal(false),
    configurationSha256: sha256Schema,
    corpusSha256: sha256Schema,
    ownerAuthorizationReference: z.string().trim().min(1),
    ownerAuthorizationSha256: sha256Schema,
    resultReviewManifestSha256: sha256Schema,
    reviewedAt: z.iso.datetime({ offset: true }),
    reviewerIdentity: z.string().trim().min(1),
    reviewerKind: z.literal('AUTONOMOUS_AI_NOT_HUMAN'),
    status: z.enum(['APPROVED', 'REJECTED']),
  })
  .strict();

export const benchmarkRunMetadataSchema = z
  .object({
    caseIds: z.array(stableKeySchema).min(1),
    candidateIds: z.array(stableKeySchema).min(1),
    autonomousReview: benchmarkAutonomousResultReviewMetadataSchema.optional(),
    configurationSha256: sha256Schema.optional(),
    corpusReview: benchmarkCorpusReadinessMetadataSchema.optional(),
    corpusReviewAuthority: z
      .enum(['HUMAN', 'AUTONOMOUS_AI_NOT_HUMAN'])
      .optional(),
    corpusSha256: sha256Schema.optional(),
    humanReview: benchmarkResultReviewSchema,
    mode: benchmarkRunModeSchema,
    repetitions: z.number().int().positive(),
    reviewAuthority: benchmarkReviewAuthoritySchema.optional(),
  })
  .strict()
  .superRefine((metadata, context) => {
    if (new Set(metadata.caseIds).size !== metadata.caseIds.length) {
      context.addIssue({
        code: 'custom',
        message: 'Run case identifiers must be unique.',
        path: ['caseIds'],
      });
    }
    if (new Set(metadata.candidateIds).size !== metadata.candidateIds.length) {
      context.addIssue({
        code: 'custom',
        message: 'Run candidate identifiers must be unique.',
        path: ['candidateIds'],
      });
    }
    if (
      metadata.autonomousReview &&
      metadata.humanReview.status !== 'PENDING'
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Human and autonomous result reviews are mutually exclusive.',
        path: ['autonomousReview'],
      });
    }
    if (
      metadata.corpusReviewAuthority === 'AUTONOMOUS_AI_NOT_HUMAN' &&
      !metadata.corpusReview
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'Autonomous corpus authority requires its complete digest chain.',
        path: ['corpusReview'],
      });
    }
    if (
      metadata.corpusReview &&
      (metadata.corpusReviewAuthority !== 'AUTONOMOUS_AI_NOT_HUMAN' ||
        metadata.configurationSha256 !==
          metadata.corpusReview.configurationSha256 ||
        metadata.corpusSha256 !== metadata.corpusReview.corpusSha256)
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'Autonomous corpus evidence must match run authority and digests.',
        path: ['corpusReview'],
      });
    }
    if (
      metadata.autonomousReview &&
      (!metadata.corpusReview ||
        metadata.corpusReviewAuthority !== 'AUTONOMOUS_AI_NOT_HUMAN' ||
        metadata.configurationSha256 !==
          metadata.autonomousReview.configurationSha256 ||
        metadata.corpusSha256 !== metadata.autonomousReview.corpusSha256 ||
        metadata.corpusReview.ownerAuthorizationReference !==
          metadata.autonomousReview.ownerAuthorizationReference ||
        metadata.corpusReview.ownerAuthorizationSha256 !==
          metadata.autonomousReview.ownerAuthorizationSha256)
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'Autonomous result review must extend the authorized corpus digest chain.',
        path: ['autonomousReview'],
      });
    }
    const expectedReviewAuthority =
      metadata.humanReview.status === 'APPROVED'
        ? 'HUMAN'
        : metadata.autonomousReview?.status === 'APPROVED'
          ? 'AUTONOMOUS_AI_NOT_HUMAN'
          : 'NONE';
    if (
      metadata.reviewAuthority !== undefined &&
      metadata.reviewAuthority !== expectedReviewAuthority
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Run review authority does not match the applied review.',
        path: ['reviewAuthority'],
      });
    }
  });

export type BenchmarkRunMetadata = z.infer<typeof benchmarkRunMetadataSchema>;
export type BenchmarkReviewAuthority = z.infer<
  typeof benchmarkReviewAuthoritySchema
>;
