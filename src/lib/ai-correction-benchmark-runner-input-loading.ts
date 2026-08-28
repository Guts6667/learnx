import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assertBenchmarkAutonomousCorpusReview,
  benchmarkOwnerResolvedCorpusManifestSchema,
  parseCorrectionBenchmarkConfiguration,
  parseCorrectionBenchmarkCorpus,
} from './ai-correction-benchmark.js';
import {
  authoringManifestSchema,
  benchmarkDirectory,
  configurationSha256,
  holdoutConfigurationSchema,
  holdoutReviewManifestSchema,
  mergeAutonomousHoldoutBenchmarkConfiguration,
  ownerAuthorizationSchema,
  parseAutonomousHoldoutConfiguration,
  sha256,
  type LoadedBenchmarkInputs,
} from './ai-correction-benchmark-runner-input-configuration.js';

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
