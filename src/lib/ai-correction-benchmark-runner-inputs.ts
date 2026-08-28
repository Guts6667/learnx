import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import {
  assertBenchmarkAutonomousCorpusReview,
  benchmarkActivityTypeSchema,
  benchmarkOwnerResolvedCorpusManifestSchema,
  benchmarkRunMetadataSchema,
  parseCorrectionBenchmarkConfiguration,
  parseCorrectionBenchmarkCorpus,
  type CorrectionBenchmarkConfiguration,
  type CorrectionBenchmarkCorpus,
} from './ai-correction-benchmark.ts';
import { correctionBenchmarkConfigurationSha256 } from '../../scripts/generate-ai-correction-full-blind-review.ts';

export const benchmarkDirectory = path.resolve('benchmarks/ai-correction');
export const resultDirectory = path.join(benchmarkDirectory, 'results');

const holdoutConfigurationSchema = z
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

const holdoutReviewManifestSchema = z
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

const ownerAuthorizationSchema = z
  .object({
    artifactKind: z.literal('OWNER_AUTONOMOUS_REVIEW_AUTHORIZATION'),
    status: z.literal('APPROVED'),
  })
  .passthrough();

const authoringManifestSchema = z
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

function configurationSha256(
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

export async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

export async function loadBenchmarkInputs(
  arguments_: string[] = process.argv,
): Promise<LoadedBenchmarkInputs> {
  const configurationArgument = arguments_.find((argument) =>
    argument.startsWith('--configuration='),
  );
  const standaloneConfigurationArgument = arguments_.find((argument) =>
    argument.startsWith('--benchmark-configuration='),
  );
  if (configurationArgument && standaloneConfigurationArgument) {
    throw new Error('BENCHMARK_CONFIGURATION_ARGUMENT_AMBIGUOUS');
  }
  if (standaloneConfigurationArgument) {
    const standalonePath = path.resolve(
      standaloneConfigurationArgument.slice(
        '--benchmark-configuration='.length,
      ),
    );
    const standaloneDirectory = path.dirname(standalonePath);
    const corpusPath = path.join(standaloneDirectory, 'corpus.v1.json');
    const corpusRaw = await readFile(corpusPath);
    const configuration = parseCorrectionBenchmarkConfiguration(
      await readJson(standalonePath),
    );
    return {
      configuration,
      configurationSha256: configurationSha256(configuration),
      corpus: parseCorrectionBenchmarkCorpus(
        JSON.parse(corpusRaw.toString('utf8')) as unknown,
      ),
      corpusReviewAuthority: 'HUMAN',
      corpusSha256: sha256(corpusRaw),
    };
  }
  if (!configurationArgument) {
    const corpusRaw = await readFile(
      path.join(benchmarkDirectory, 'corpus.v1.json'),
    );
    const configuration = parseCorrectionBenchmarkConfiguration(
      await readJson(path.join(benchmarkDirectory, 'benchmark.v1.json')),
    );
    return {
      configuration,
      configurationSha256: configurationSha256(configuration),
      corpus: parseCorrectionBenchmarkCorpus(
        JSON.parse(corpusRaw.toString('utf8')) as unknown,
      ),
      corpusReviewAuthority: 'HUMAN',
      corpusSha256: sha256(corpusRaw),
    };
  }

  const overlayPath = path.resolve(
    configurationArgument.slice('--configuration='.length),
  );
  const overlaySource = await readJson(overlayPath);
  const overlayDirectory = path.dirname(overlayPath);
  if (
    typeof overlaySource === 'object' &&
    overlaySource !== null &&
    'artifactKind' in overlaySource
  ) {
    const overlay = parseAutonomousHoldoutConfiguration(overlaySource);
    const configuration = mergeAutonomousHoldoutBenchmarkConfiguration({
      baseConfiguration: await readJson(
        path.resolve(overlayDirectory, overlay.extends),
      ),
      overlay,
    });
    if (overlay.budgetPolicyPath && overlay.budgetPolicySha256) {
      const budgetPolicyRaw = await readFile(
        path.resolve(overlayDirectory, overlay.budgetPolicyPath),
      );
      if (sha256(budgetPolicyRaw) !== overlay.budgetPolicySha256) {
        throw new Error('BENCHMARK_BUDGET_POLICY_DIGEST_MISMATCH');
      }
    }
    const configurationDigest = configurationSha256(
      configuration,
      overlay.supplierCostCapUsd,
      overlay.budgetPolicySha256,
      overlay.candidateId,
    );
    const corpusRaw = await readFile(
      path.resolve(overlayDirectory, overlay.corpusPath),
    );
    const corpus = parseCorrectionBenchmarkCorpus(
      JSON.parse(corpusRaw.toString('utf8')) as unknown,
    );
    const authoringManifestRaw = await readFile(
      path.resolve(overlayDirectory, overlay.authoringManifestPath),
    );
    authoringManifestSchema.parse(
      JSON.parse(authoringManifestRaw.toString('utf8')) as unknown,
    );
    const ownerAuthorizationRaw = await readFile(
      path.resolve(overlayDirectory, overlay.ownerAuthorizationPath),
    );
    ownerAuthorizationSchema.parse(
      JSON.parse(ownerAuthorizationRaw.toString('utf8')) as unknown,
    );
    const corpusReviewManifestRaw = await readFile(
      path.resolve(overlayDirectory, overlay.corpusReviewManifestPath),
    );
    const corpusReadinessSource = JSON.parse(
      corpusReviewManifestRaw.toString('utf8'),
    ) as unknown;
    if (
      typeof corpusReadinessSource === 'object' &&
      corpusReadinessSource !== null &&
      'artifactKind' in corpusReadinessSource &&
      corpusReadinessSource.artifactKind === 'WRITING_CORPUS_PRESEAL_RESOLUTION'
    ) {
      const resolution = benchmarkOwnerResolvedCorpusManifestSchema.parse(
        corpusReadinessSource,
      );
      const rejectedReviewRaw = await readFile(
        path.resolve(overlayDirectory, resolution.priorRejectedReviewPath),
      );
      const rejectedDecisionRaw = await readFile(
        path.resolve(overlayDirectory, resolution.priorRejectedDecisionPath),
      );
      const rejectedReview = JSON.parse(rejectedReviewRaw.toString('utf8')) as {
        summary?: { verdict?: unknown };
      };
      const rejectedDecision = JSON.parse(
        rejectedDecisionRaw.toString('utf8'),
      ) as { status?: unknown };
      if (
        sha256(rejectedReviewRaw) !== resolution.priorRejectedReviewSha256 ||
        rejectedReview.summary?.verdict !== 'REJECTED' ||
        sha256(rejectedDecisionRaw) !==
          resolution.priorRejectedDecisionSha256 ||
        rejectedDecision.status !== 'REJECTED'
      ) {
        throw new Error('BENCHMARK_CORPUS_RESOLUTION_REJECTED_REVIEW_MISMATCH');
      }
    }
    const review = assertBenchmarkAutonomousCorpusReview({
      actualAuthoringManifestSha256: sha256(authoringManifestRaw),
      actualConfigurationSha256: configurationDigest,
      actualCorpusReviewManifestSha256: sha256(corpusReviewManifestRaw),
      actualCorpusSha256: sha256(corpusRaw),
      actualOwnerAuthorizationReference: overlay.ownerAuthorizationPath,
      actualOwnerAuthorizationSha256: sha256(ownerAuthorizationRaw),
      benchmarkId: overlay.benchmarkId,
      corpusHumanReviewStatus: corpus.humanReview.status,
      corpusId: overlay.corpusId,
      manifest: corpusReadinessSource,
    });
    const corpusReview =
      review.artifactKind === 'AUTONOMOUS_CORPUS_REVIEW_MANIFEST'
        ? {
            artifactKind: review.artifactKind,
            authoringManifestSha256: review.authoringManifestSha256,
            configurationSha256: review.configurationSha256,
            corpusReviewManifestSha256: sha256(corpusReviewManifestRaw),
            corpusSha256: review.corpusSha256,
            ownerAuthorizationReference: review.ownerAuthorizationReference,
            ownerAuthorizationSha256: review.ownerAuthorizationSha256,
            reviewedAt: review.reviewedAt,
            reviewerIdentity: review.reviewerIdentity,
            reviewerKind: review.reviewerKind,
          }
        : {
            artifactKind: review.artifactKind,
            authoringManifestSha256: review.authoringManifestSha256,
            configurationSha256: review.configurationSha256,
            corpusReviewManifestSha256: sha256(corpusReviewManifestRaw),
            corpusSha256: review.corpusSha256,
            ownerAuthorizationReference: review.ownerAuthorizationReference,
            ownerAuthorizationSha256: review.ownerAuthorizationSha256,
            priorRejectedReviewSha256: review.priorRejectedReviewSha256,
            resolvedAt: review.resolvedAt,
          };
    return {
      authorizedCandidateId: overlay.candidateId,
      budgetPolicyPath: overlay.budgetPolicyPath,
      budgetPolicySha256: overlay.budgetPolicySha256,
      configuration,
      configurationSha256: configurationDigest,
      corpus,
      corpusReview,
      corpusReviewAuthority: 'AUTONOMOUS_AI_NOT_HUMAN',
      corpusSha256: sha256(corpusRaw),
      supplierCostCapUsd: overlay.supplierCostCapUsd,
    };
  }

  const overlay = holdoutConfigurationSchema.parse(overlaySource);
  const baseConfiguration = parseCorrectionBenchmarkConfiguration(
    await readJson(path.resolve(overlayDirectory, overlay.extends)),
  );
  const corpusPath = path.resolve(overlayDirectory, overlay.corpusPath);
  const corpusRaw = await readFile(corpusPath);
  const manifest = holdoutReviewManifestSchema.parse(
    await readJson(path.resolve(overlayDirectory, overlay.reviewManifestPath)),
  );
  const artifactSha256 = createHash('sha256').update(corpusRaw).digest('hex');
  if (
    artifactSha256 !== manifest.artifactSha256AfterReviewMetadata ||
    overlay.corpusId !== manifest.corpusId
  ) {
    throw new Error('BENCHMARK_HOLDOUT_REVIEW_IDENTITY_MISMATCH');
  }
  const corpus = parseCorrectionBenchmarkCorpus(
    JSON.parse(corpusRaw.toString('utf8')) as unknown,
  );
  const configuration = parseCorrectionBenchmarkConfiguration({
    ...baseConfiguration,
    benchmarkId: overlay.benchmarkId,
    corpusId: overlay.corpusId,
    reviewPanelCaseIds: overlay.reviewPanelCaseIds,
  });
  return {
    configuration,
    configurationSha256: configurationSha256(configuration),
    corpus,
    corpusReviewAuthority: 'HUMAN',
    corpusSha256: sha256(corpusRaw),
  };
}
