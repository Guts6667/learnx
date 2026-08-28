import { z } from 'zod';
import { benchmarkCandidateSchema } from './ai-correction-benchmark-configuration.js';
import {
  languageTagSchema,
  stableKeySchema,
} from './ai-correction-benchmark-corpus.js';
import { sha256Schema } from './ai-correction-benchmark-run-artifacts.js';

export const benchmarkHumanReviewArtifactSchema = z
  .object({
    attemptsSha256: z.string().regex(/^[a-f0-9]{64}$/),
    benchmarkId: stableKeySchema,
    candidateId: stableKeySchema,
    corpusId: stableKeySchema,
    criticalScores: z
      .object({
        diagnosis: z.number().min(0).max(100),
        evidence: z.number().min(0).max(100),
        fidelity: z.number().min(0).max(100),
      })
      .strict(),
    eliminatoryFindings: z.array(z.string().trim().min(1)),
    familyScores: z
      .object({
        practice: z.number().min(0).max(100),
        project: z.number().min(0).max(100),
        reflection: z.number().min(0).max(100),
        writing: z.number().min(0).max(100),
      })
      .strict(),
    language: languageTagSchema,
    meanScore: z.number().min(0).max(100),
    promptVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    requestProfileSnapshot: benchmarkCandidateSchema.shape.requestProfile,
    requestProtocolVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    reviewedAt: z.iso.datetime({ offset: true }),
    reviewer: z.string().trim().min(1),
    schemaVersion: z.literal(1),
    status: z.enum(['APPROVED', 'REJECTED']),
  })
  .strict()
  .superRefine((review, context) => {
    if (
      review.status === 'APPROVED' &&
      (review.meanScore < 85 ||
        Object.values(review.criticalScores).some((score) => score < 80) ||
        Object.values(review.familyScores).some((score) => score < 80) ||
        review.eliminatoryFindings.length > 0)
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'An approved human review must satisfy every preregistered pedagogical gate.',
        path: ['status'],
      });
    }
  });

const benchmarkReviewScoresSchema = z
  .object({
    criticalScores: z
      .object({
        diagnosis: z.number().min(0).max(100),
        evidence: z.number().min(0).max(100),
        fidelity: z.number().min(0).max(100),
      })
      .strict(),
    eliminatoryFindings: z.array(z.string().trim().min(1)),
    familyScores: z
      .object({
        practice: z.number().min(0).max(100),
        project: z.number().min(0).max(100),
        reflection: z.number().min(0).max(100),
        writing: z.number().min(0).max(100),
      })
      .strict(),
    meanScore: z.number().min(0).max(100),
  })
  .strict();

export const benchmarkAutonomousReviewArtifactSchema = z
  .object({
    artifactKind: z.literal('AUTONOMOUS_RESULT_REVIEW_MANIFEST'),
    attemptsSha256: sha256Schema,
    blindReviewPacketSha256: sha256Schema,
    blindedToAutomaticVerdict: z.literal(true),
    blindedToCandidateIdentity: z.literal(true),
    blindedToCandidateOutputs: z.literal(false),
    configurationSha256: sha256Schema,
    corpusSha256: sha256Schema,
    criticalScores: benchmarkReviewScoresSchema.shape.criticalScores,
    eliminatoryFindings: benchmarkReviewScoresSchema.shape.eliminatoryFindings,
    familyScores: benchmarkReviewScoresSchema.shape.familyScores,
    meanScore: benchmarkReviewScoresSchema.shape.meanScore,
    ownerAuthorizationReference: z.string().trim().min(1),
    ownerAuthorizationSha256: sha256Schema,
    reviewedAt: z.iso.datetime({ offset: true }),
    reviewerIdentity: z.string().trim().min(1),
    reviewerKind: z.literal('AUTONOMOUS_AI_NOT_HUMAN'),
    schemaVersion: z.literal(1),
    status: z.enum(['APPROVED', 'REJECTED']),
  })
  .strict()
  .superRefine((review, context) => {
    if (
      review.status === 'APPROVED' &&
      (review.meanScore < 85 ||
        Object.values(review.criticalScores).some((score) => score < 80) ||
        Object.values(review.familyScores).some((score) => score < 80) ||
        review.eliminatoryFindings.length > 0)
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'An approved autonomous review must satisfy every preregistered pedagogical gate.',
        path: ['status'],
      });
    }
  });

export const benchmarkAutonomousCorpusReviewManifestSchema = z
  .object({
    artifactKind: z.literal('AUTONOMOUS_CORPUS_REVIEW_MANIFEST'),
    authoringManifestSha256: sha256Schema,
    benchmarkId: stableKeySchema,
    blindedToCandidateOutputs: z.literal(true),
    configurationSha256: sha256Schema,
    corpusId: stableKeySchema,
    corpusSha256: sha256Schema,
    ownerAuthorizationReference: z.string().trim().min(1),
    ownerAuthorizationSha256: sha256Schema,
    reviewedAt: z.iso.datetime({ offset: true }),
    reviewerIdentity: z.string().trim().min(1),
    reviewerKind: z.literal('AUTONOMOUS_AI_NOT_HUMAN'),
    schemaVersion: z.literal(1),
    status: z.enum(['APPROVED', 'REJECTED']),
  })
  .strict();

export const benchmarkOwnerResolvedCorpusManifestSchema = z
  .object({
    artifactKind: z.literal('WRITING_CORPUS_PRESEAL_RESOLUTION'),
    authoringManifestSha256: sha256Schema,
    benchmarkId: stableKeySchema,
    configurationSha256: sha256Schema,
    corpusId: stableKeySchema,
    corpusSha256: sha256Schema,
    ownerAuthorizationReference: z.string().trim().min(1),
    ownerAuthorizationSha256: sha256Schema,
    priorRejectedDecisionPath: z.string().trim().min(1),
    priorRejectedDecisionSha256: sha256Schema,
    priorRejectedReviewPath: z.string().trim().min(1),
    priorRejectedReviewSha256: sha256Schema,
    fallbacks: z
      .array(
        z
          .object({
            cellId: stableKeySchema,
            selectedCaseId: stableKeySchema,
          })
          .strict(),
      )
      .length(3),
    individualGoldCorrections: z
      .array(
        z
          .object({
            cellId: stableKeySchema,
            criterionKey: stableKeySchema,
            from: z.literal('limited'),
            to: z.literal('partial'),
          })
          .strict(),
      )
      .length(2),
    resolutionScope: z
      .object({
        activityType: z.literal('writing'),
        fallbackCount: z.literal(3),
        individualGoldCorrectionCount: z.literal(2),
        additionalEditorialReviewPerformed: z.literal(false),
        thresholdsChanged: z.literal(false),
      })
      .strict(),
    resolvedAt: z.iso.datetime({ offset: true }),
    schemaVersion: z.literal(1),
    status: z.literal('AUTHORIZED_MECHANICAL_CLOSURE'),
  })
  .strict();

export type BenchmarkHumanReviewArtifact = z.infer<
  typeof benchmarkHumanReviewArtifactSchema
>;
export type BenchmarkAutonomousReviewArtifact = z.infer<
  typeof benchmarkAutonomousReviewArtifactSchema
>;
export type BenchmarkAutonomousCorpusReviewManifest = z.infer<
  typeof benchmarkAutonomousCorpusReviewManifestSchema
>;
