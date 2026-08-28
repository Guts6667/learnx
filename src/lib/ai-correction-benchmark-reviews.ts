import { z } from 'zod';
import {
  benchmarkAutonomousCorpusReviewManifestSchema,
  benchmarkAutonomousReviewArtifactSchema,
  benchmarkHumanReviewArtifactSchema,
  benchmarkOwnerResolvedCorpusManifestSchema,
  benchmarkRunMetadataSchema,
  sha256Schema,
  type BenchmarkAutonomousCorpusReviewManifest,
  type BenchmarkRunMetadata,
} from './ai-correction-benchmark-artifacts.js';
import {
  parseCorrectionBenchmarkConfiguration,
  parseCorrectionBenchmarkCorpus,
} from './ai-correction-benchmark-compatibility.js';
import { stableSerialize } from './ai-correction-benchmark-serialization.js';
import { summarizeCorrectionBenchmark } from './ai-correction-benchmark-summary.js';

export function applyBenchmarkHumanReview(input: {
  configuration: unknown;
  corpus: unknown;
  review: unknown;
  runMetadata: unknown;
}): BenchmarkRunMetadata {
  const configuration = parseCorrectionBenchmarkConfiguration(
    input.configuration,
  );
  const corpus = parseCorrectionBenchmarkCorpus(input.corpus);
  const review = benchmarkHumanReviewArtifactSchema.parse(input.review);
  const runMetadata = benchmarkRunMetadataSchema.parse(input.runMetadata);
  if (
    runMetadata.humanReview.status !== 'PENDING' ||
    runMetadata.autonomousReview
  ) {
    throw new Error('BENCHMARK_HUMAN_REVIEW_REQUIRES_EXCLUSIVE_PENDING_STATE');
  }
  const candidate = configuration.candidates.find(
    (item) => item.candidateId === review.candidateId,
  );
  if (
    !candidate ||
    runMetadata.mode !== 'FULL' ||
    runMetadata.candidateIds.length !== 1 ||
    runMetadata.candidateIds[0] !== review.candidateId ||
    review.benchmarkId !== configuration.benchmarkId ||
    review.corpusId !== corpus.corpusId ||
    review.language !== configuration.language ||
    review.promptVersion !== configuration.promptVersion ||
    review.requestProtocolVersion !== configuration.requestProtocolVersion ||
    stableSerialize(review.requestProfileSnapshot) !==
      stableSerialize(candidate.requestProfile)
  ) {
    throw new Error('BENCHMARK_HUMAN_REVIEW_IDENTITY_MISMATCH');
  }
  const reviewedMetadata: BenchmarkRunMetadata = {
    ...runMetadata,
    humanReview:
      review.status === 'APPROVED'
        ? {
            reviewedAt: review.reviewedAt,
            reviewer: review.reviewer,
            status: 'APPROVED',
          }
        : {
            reviewedAt: review.reviewedAt,
            reviewer: review.reviewer,
            status: 'REJECTED',
          },
    reviewAuthority: review.status === 'APPROVED' ? 'HUMAN' : 'NONE',
  };
  return benchmarkRunMetadataSchema.parse(reviewedMetadata);
}

export function assertBenchmarkHumanReviewDigest(input: {
  actualSha256: string;
  expectedSha256: string;
}): void {
  if (
    !/^[a-f0-9]{64}$/.test(input.actualSha256) ||
    input.actualSha256 !== input.expectedSha256
  ) {
    throw new Error('BENCHMARK_HUMAN_REVIEW_DIGEST_MISMATCH');
  }
}

export function assertBenchmarkAutonomousCorpusReview(input: {
  actualAuthoringManifestSha256: string;
  actualConfigurationSha256: string;
  actualCorpusReviewManifestSha256: string;
  actualCorpusSha256: string;
  actualOwnerAuthorizationReference: string;
  actualOwnerAuthorizationSha256: string;
  benchmarkId: string;
  corpusHumanReviewStatus: 'PENDING' | 'APPROVED';
  corpusId: string;
  manifest: unknown;
}):
  | BenchmarkAutonomousCorpusReviewManifest
  | z.infer<typeof benchmarkOwnerResolvedCorpusManifestSchema> {
  const manifest = z
    .union([
      benchmarkAutonomousCorpusReviewManifestSchema,
      benchmarkOwnerResolvedCorpusManifestSchema,
    ])
    .parse(input.manifest);
  if (
    manifest.benchmarkId !== input.benchmarkId ||
    manifest.corpusId !== input.corpusId
  ) {
    throw new Error('BENCHMARK_AUTONOMOUS_CORPUS_REVIEW_IDENTITY_MISMATCH');
  }
  if (
    manifest.authoringManifestSha256 !== input.actualAuthoringManifestSha256 ||
    manifest.configurationSha256 !== input.actualConfigurationSha256 ||
    manifest.corpusSha256 !== input.actualCorpusSha256 ||
    manifest.ownerAuthorizationReference !==
      input.actualOwnerAuthorizationReference ||
    manifest.ownerAuthorizationSha256 !== input.actualOwnerAuthorizationSha256
  ) {
    throw new Error('BENCHMARK_AUTONOMOUS_CORPUS_REVIEW_DIGEST_MISMATCH');
  }
  if (input.corpusHumanReviewStatus !== 'PENDING') {
    throw new Error(
      'BENCHMARK_AUTONOMOUS_CORPUS_REVIEW_REQUIRES_HUMAN_PENDING',
    );
  }
  if (
    manifest.artifactKind === 'AUTONOMOUS_CORPUS_REVIEW_MANIFEST' &&
    manifest.status !== 'APPROVED'
  ) {
    throw new Error('BENCHMARK_AUTONOMOUS_CORPUS_REVIEW_NOT_APPROVED');
  }
  if (!sha256Schema.safeParse(input.actualCorpusReviewManifestSha256).success) {
    throw new Error('BENCHMARK_AUTONOMOUS_CORPUS_REVIEW_DIGEST_MISMATCH');
  }
  return manifest;
}

export function applyBenchmarkAutonomousReview(input: {
  actualAttemptsSha256: string;
  actualBlindReviewPacketSha256: string;
  actualConfigurationSha256: string;
  actualCorpusSha256: string;
  actualOwnerAuthorizationReference: string;
  actualOwnerAuthorizationSha256: string;
  actualReviewManifestSha256: string;
  attempts?: unknown[];
  configuration: unknown;
  corpus: unknown;
  review: unknown;
  runMetadata: unknown;
}): BenchmarkRunMetadata {
  const configuration = parseCorrectionBenchmarkConfiguration(
    input.configuration,
  );
  const corpus = parseCorrectionBenchmarkCorpus(input.corpus);
  const review = benchmarkAutonomousReviewArtifactSchema.parse(input.review);
  const runMetadata = benchmarkRunMetadataSchema.parse(input.runMetadata);
  const candidateId = runMetadata.candidateIds[0];
  const candidate = configuration.candidates.find(
    (item) => item.candidateId === candidateId,
  );
  if (
    !candidate ||
    runMetadata.mode !== 'FULL' ||
    runMetadata.candidateIds.length !== 1 ||
    runMetadata.humanReview.status !== 'PENDING' ||
    runMetadata.autonomousReview !== undefined ||
    runMetadata.corpusReviewAuthority !== 'AUTONOMOUS_AI_NOT_HUMAN' ||
    !runMetadata.corpusReview ||
    runMetadata.configurationSha256 !== input.actualConfigurationSha256 ||
    runMetadata.corpusSha256 !== input.actualCorpusSha256 ||
    corpus.corpusId !== configuration.corpusId
  ) {
    throw new Error('BENCHMARK_AUTONOMOUS_REVIEW_IDENTITY_MISMATCH');
  }
  if (
    review.attemptsSha256 !== input.actualAttemptsSha256 ||
    review.blindReviewPacketSha256 !== input.actualBlindReviewPacketSha256 ||
    review.configurationSha256 !== input.actualConfigurationSha256 ||
    review.corpusSha256 !== input.actualCorpusSha256 ||
    review.ownerAuthorizationReference !==
      input.actualOwnerAuthorizationReference ||
    review.ownerAuthorizationSha256 !== input.actualOwnerAuthorizationSha256 ||
    runMetadata.corpusReview.ownerAuthorizationReference !==
      input.actualOwnerAuthorizationReference ||
    runMetadata.corpusReview.ownerAuthorizationSha256 !==
      input.actualOwnerAuthorizationSha256 ||
    !sha256Schema.safeParse(input.actualReviewManifestSha256).success
  ) {
    throw new Error('BENCHMARK_AUTONOMOUS_REVIEW_DIGEST_MISMATCH');
  }
  const candidateMetrics = summarizeCorrectionBenchmark({
    attempts: input.attempts ?? [],
    configuration,
    corpus,
    runMetadata,
  }).models.find((metrics) => metrics.candidateId === candidate.candidateId);
  if (!candidateMetrics?.datasetComplete) {
    throw new Error('BENCHMARK_AUTONOMOUS_REVIEW_REQUIRES_COMPLETE_DATASET');
  }
  const reviewedMetadata: BenchmarkRunMetadata = {
    ...runMetadata,
    autonomousReview: {
      artifactKind: review.artifactKind,
      attemptsSha256: review.attemptsSha256,
      blindReviewPacketSha256: review.blindReviewPacketSha256,
      blindedToAutomaticVerdict: true,
      blindedToCandidateIdentity: true,
      blindedToCandidateOutputs: false,
      configurationSha256: review.configurationSha256,
      corpusSha256: review.corpusSha256,
      ownerAuthorizationReference: review.ownerAuthorizationReference,
      ownerAuthorizationSha256: review.ownerAuthorizationSha256,
      resultReviewManifestSha256: input.actualReviewManifestSha256,
      reviewedAt: review.reviewedAt,
      reviewerIdentity: review.reviewerIdentity,
      reviewerKind: 'AUTONOMOUS_AI_NOT_HUMAN',
      status: review.status,
    },
    reviewAuthority:
      review.status === 'APPROVED' ? 'AUTONOMOUS_AI_NOT_HUMAN' : 'NONE',
  };
  return benchmarkRunMetadataSchema.parse(reviewedMetadata);
}
