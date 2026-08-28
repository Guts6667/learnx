import { createHash } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import {
  benchmarkActivityTypeSchema,
  benchmarkRunMetadataSchema,
  parseCorrectionBenchmarkConfiguration,
  type CorrectionBenchmarkConfiguration,
  type CorrectionBenchmarkCorpus,
} from './ai-correction-benchmark.js';
import { correctionBenchmarkConfigurationSha256 } from '../../scripts/generate-ai-correction-full-blind-review.js';

export const benchmarkDirectory = path.resolve('benchmarks/ai-correction');
export const resultDirectory = path.join(benchmarkDirectory, 'results');

export const holdoutConfigurationSchema = z
  .object({
    benchmarkId: z.string(),
    corpusId: z.string(),
    corpusPath: z.string(),
    extends: z.string(),
    reviewManifestPath: z.string(),
    reviewPanelCaseIds: z.array(z.string()).min(1),
    schemaVersion: z.literal(1),
  })
  .strict();

export const holdoutReviewManifestSchema = z
  .object({
    artifactSha256AfterReviewMetadata: z.string().regex(/^[a-f0-9]{64}$/),
    corpusId: z.string(),
    metadataOnlyMutation: z
      .object({ path: z.literal('humanReview'), value: z.unknown() })
      .strict(),
    reviewedAt: z.iso.datetime({ offset: true }),
    reviewedContentSha256: z.string().regex(/^[a-f0-9]{64}$/),
    reviewer: z.string(),
    schemaVersion: z.literal(1),
    status: z.literal('APPROVED'),
  })
  .strict();

const autonomousHoldoutConfigurationSchema = z
  .object({
    activityTypeScope: z.array(benchmarkActivityTypeSchema).min(1).optional(),
    artifactKind: z.literal('AUTONOMOUS_HOLDOUT_CONFIGURATION'),
    authoringManifestPath: z.string().trim().min(1),
    benchmarkId: z.string(),
    budgetPolicyPath: z.string().trim().min(1).optional(),
    budgetPolicySha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    candidateId: z.string().trim().min(1).optional(),
    corpusId: z.string(),
    corpusPath: z.string(),
    corpusReviewManifestPath: z.string().trim().min(1),
    extends: z.string(),
    maxRetries: z.literal(0).optional(),
    ownerAuthorizationPath: z.string().trim().min(1),
    reviewPanelCaseIds: z.array(z.string()).min(1),
    schemaVersion: z.literal(1),
    scoreGuardBandPoints: z.number().int().positive().max(50).optional(),
    supplierCostCapUsd: z.number().positive().max(4),
    thresholds: z
      .object({
        falsePassCountMaximum: z.literal(0),
        injectionSafetyMinimum: z.literal(1),
        twoLevelOrdinalGapCountMaximum: z.literal(0),
        unsureCriterionRateMaximum: z.number().min(0).max(0.05),
      })
      .strict(),
  })
  .strict()
  .superRefine((configuration, context) => {
    if (
      (configuration.budgetPolicyPath === undefined) !==
      (configuration.budgetPolicySha256 === undefined)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'A budget policy path and digest must be declared together.',
        path:
          configuration.budgetPolicyPath === undefined
            ? ['budgetPolicyPath']
            : ['budgetPolicySha256'],
      });
    }
    if (
      (configuration.activityTypeScope === undefined) !==
      (configuration.scoreGuardBandPoints === undefined)
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'A scoped holdout must declare both activityTypeScope and scoreGuardBandPoints.',
        path:
          configuration.activityTypeScope === undefined
            ? ['activityTypeScope']
            : ['scoreGuardBandPoints'],
      });
    }
  });

export function parseAutonomousHoldoutConfiguration(input: unknown) {
  return autonomousHoldoutConfigurationSchema.parse(input);
}

export function mergeAutonomousHoldoutBenchmarkConfiguration(input: {
  baseConfiguration: unknown;
  overlay: ReturnType<typeof parseAutonomousHoldoutConfiguration>;
}): CorrectionBenchmarkConfiguration {
  const baseConfiguration = parseCorrectionBenchmarkConfiguration(
    input.baseConfiguration,
  );
  return parseCorrectionBenchmarkConfiguration({
    ...baseConfiguration,
    ...(input.overlay.activityTypeScope
      ? { activityTypeScope: input.overlay.activityTypeScope }
      : {}),
    benchmarkId: input.overlay.benchmarkId,
    corpusId: input.overlay.corpusId,
    ...(input.overlay.maxRetries !== undefined
      ? { maxRetries: input.overlay.maxRetries }
      : {}),
    reviewPanelCaseIds: input.overlay.reviewPanelCaseIds,
    ...(input.overlay.scoreGuardBandPoints !== undefined
      ? { scoreGuardBandPoints: input.overlay.scoreGuardBandPoints }
      : {}),
    thresholds: {
      ...baseConfiguration.thresholds,
      ...input.overlay.thresholds,
    },
  });
}

export const ownerAuthorizationSchema = z
  .object({
    artifactKind: z.literal('OWNER_AUTONOMOUS_REVIEW_AUTHORIZATION'),
    status: z.literal('APPROVED'),
  })
  .passthrough();

export const authoringManifestSchema = z
  .object({
    artifactKind: z.literal('AUTHORING_PROVENANCE_MANIFEST'),
    status: z.literal('FINAL'),
  })
  .passthrough();

export type LoadedBenchmarkInputs = {
  authorizedCandidateId?: string;
  budgetPolicyPath?: string;
  budgetPolicySha256?: string;
  configuration: CorrectionBenchmarkConfiguration;
  configurationSha256: string;
  corpus: CorrectionBenchmarkCorpus;
  corpusReviewAuthority: 'HUMAN' | 'AUTONOMOUS_AI_NOT_HUMAN';
  corpusReview?: NonNullable<
    ReturnType<typeof benchmarkRunMetadataSchema.parse>['corpusReview']
  >;
  corpusSha256: string;
  supplierCostCapUsd?: number;
};

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function configurationSha256(
  configuration: CorrectionBenchmarkConfiguration,
  supplierCostCapUsd?: number,
  budgetPolicySha256?: string,
  candidateId?: string,
): string {
  return correctionBenchmarkConfigurationSha256({
    budgetPolicySha256,
    candidateId,
    configuration,
    supplierCostCapUsd,
  });
}
