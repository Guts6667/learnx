import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

import { z } from 'zod';

import {
  applyBenchmarkAutonomousReview,
  applyBenchmarkHumanReview,
  assertBenchmarkHumanReviewDigest,
  benchmarkAttemptSchema,
  benchmarkAutonomousReviewArtifactSchema,
  benchmarkHumanReviewArtifactSchema,
  benchmarkResumeArtifactSchema,
  benchmarkRunMetadataSchema,
  modelMeetsPromotionThresholds,
  summarizeCorrectionBenchmark,
  type BenchmarkAttempt,
  type CorrectionBenchmarkConfiguration,
  type CorrectionBenchmarkCorpus,
} from './ai-correction-benchmark.ts';
import { assertFullBlindReviewPacketMatchesSources } from '../../scripts/generate-ai-correction-full-blind-review.ts';
import { readJson, sha256 } from './ai-correction-benchmark-runner-inputs.ts';

export const attemptsArtifactSchema = z
  .object({
    attempts: z.array(benchmarkAttemptSchema),
    benchmarkId: z.string(),
    configurationSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    corpusId: z.string(),
    corpusSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    language: z.string(),
    promptVersion: z.string(),
    requestProtocolVersion: z.string(),
    runMetadata: benchmarkRunMetadataSchema,
    supplierBudget: z
      .object({
        actualSpentUsd: z.number().nonnegative(),
        hardCapUsd: z.number().positive(),
        reconciliationRequired: z.boolean(),
      })
      .strict()
      .nullable()
      .optional(),
    supplierCostCapUsd: z.number().positive().max(4).optional(),
  })
  .passthrough();

export async function applyReviewedResult(input: {
  attemptsPath: string;
  configuration: CorrectionBenchmarkConfiguration;
  corpus: CorrectionBenchmarkCorpus;
  reviewPath: string;
}): Promise<void> {
  const attemptsRaw = await readFile(input.attemptsPath, 'utf8');
  const attemptsArtifact = attemptsArtifactSchema.parse(
    JSON.parse(attemptsRaw) as unknown,
  );
  const review = benchmarkHumanReviewArtifactSchema.parse(
    await readJson(input.reviewPath),
  );
  const attemptsSha256 = createHash('sha256').update(attemptsRaw).digest('hex');
  assertBenchmarkHumanReviewDigest({
    actualSha256: attemptsSha256,
    expectedSha256: review.attemptsSha256,
  });
  if (
    attemptsArtifact.benchmarkId !== input.configuration.benchmarkId ||
    attemptsArtifact.corpusId !== input.corpus.corpusId ||
    attemptsArtifact.language !== input.configuration.language ||
    attemptsArtifact.promptVersion !== input.configuration.promptVersion ||
    attemptsArtifact.requestProtocolVersion !==
      input.configuration.requestProtocolVersion
  ) {
    throw new Error('BENCHMARK_ATTEMPTS_ARTIFACT_IDENTITY_MISMATCH');
  }
  const reviewedRunMetadata = applyBenchmarkHumanReview({
    configuration: input.configuration,
    corpus: input.corpus,
    review,
    runMetadata: attemptsArtifact.runMetadata,
  });
  const summary = summarizeCorrectionBenchmark({
    attempts: attemptsArtifact.attempts,
    configuration: input.configuration,
    corpus: input.corpus,
    runMetadata: reviewedRunMetadata,
  });
  const candidate = summary.models.find(
    (metrics) => metrics.candidateId === review.candidateId,
  );
  if (!candidate) {
    throw new Error('BENCHMARK_HUMAN_REVIEW_CANDIDATE_MISSING');
  }
  const outputPath = `${input.attemptsPath}.reviewed-summary.json`;
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        ...summary,
        models: summary.models
          .filter((metrics) => metrics.candidateId === review.candidateId)
          .map((metrics) => ({
            ...metrics,
            promotionEligible:
              review.status === 'APPROVED' &&
              modelMeetsPromotionThresholds(
                metrics,
                input.configuration.thresholds,
              ),
          })),
        reviewArtifact: review,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  console.log(`Revue appliquée hors ligne : ${outputPath}`);
}

export function assertAutonomousSupplierCostReconciled(input: {
  attempts: BenchmarkAttempt[];
  supplierBudget:
    | {
        actualSpentUsd: number;
        hardCapUsd: number;
        reconciliationRequired: boolean;
      }
    | null
    | undefined;
  supplierCostCapUsd: number;
}): void {
  const budget = input.supplierBudget;
  const usages = input.attempts
    .filter(
      (attempt) =>
        attempt.errorCode !== 'SCORE_GUARD_SECOND_PASS_SKIPPED_BUDGET' &&
        attempt.errorCode !==
          'SCORE_GUARD_SECOND_PASS_SKIPPED_COST_RECONCILIATION',
    )
    .map((attempt) => attempt.usage);
  if (
    !budget ||
    budget.hardCapUsd > input.supplierCostCapUsd ||
    budget.hardCapUsd > 4 ||
    budget.reconciliationRequired ||
    usages.some(
      (usage) =>
        usage?.costSource !== 'ACTUAL' || usage.actualCostUsd === undefined,
    )
  ) {
    throw new Error('BENCHMARK_AUTONOMOUS_SUPPLIER_COST_NOT_RECONCILED');
  }
  const actualSpentUsd = usages.reduce(
    (total, usage) => total + (usage?.actualCostUsd ?? 0),
    0,
  );
  if (
    actualSpentUsd > budget.hardCapUsd ||
    Math.abs(actualSpentUsd - budget.actualSpentUsd) > 1e-9
  ) {
    throw new Error('BENCHMARK_AUTONOMOUS_SUPPLIER_COST_NOT_RECONCILED');
  }
}

export async function applyAutonomousReviewedResult(input: {
  attemptsPath: string;
  blindReviewPacketPath: string;
  configuration: CorrectionBenchmarkConfiguration;
  configurationSha256: string;
  corpus: CorrectionBenchmarkCorpus;
  corpusSha256: string;
  ownerAuthorizationReference: string;
  ownerAuthorizationSha256: string;
  reviewPath: string;
  supplierCostCapUsd: number;
}): Promise<void> {
  const attemptsRaw = await readFile(input.attemptsPath, 'utf8');
  const attemptsArtifact = attemptsArtifactSchema.parse(
    JSON.parse(attemptsRaw) as unknown,
  );
  const resumeArtifact = benchmarkResumeArtifactSchema.parse(
    JSON.parse(attemptsRaw) as unknown,
  );
  const blindReviewPacketRaw = await readFile(
    input.blindReviewPacketPath,
    'utf8',
  );
  const reviewRaw = await readFile(input.reviewPath, 'utf8');
  const review = benchmarkAutonomousReviewArtifactSchema.parse(
    JSON.parse(reviewRaw) as unknown,
  );
  const attemptsDigest = sha256(attemptsRaw);
  const blindReviewPacket = assertFullBlindReviewPacketMatchesSources({
    artifact: resumeArtifact,
    attemptsSha256: attemptsDigest,
    configuration: input.configuration,
    configurationSha256: input.configurationSha256,
    corpus: input.corpus,
    corpusSha256: input.corpusSha256,
    packet: JSON.parse(blindReviewPacketRaw) as unknown,
  });
  const blindReviewPacketDigest = sha256(blindReviewPacketRaw);
  if (
    attemptsArtifact.benchmarkId !== input.configuration.benchmarkId ||
    attemptsArtifact.configurationSha256 !== input.configurationSha256 ||
    attemptsArtifact.corpusId !== input.corpus.corpusId ||
    attemptsArtifact.corpusSha256 !== input.corpusSha256 ||
    attemptsArtifact.supplierCostCapUsd !== input.supplierCostCapUsd ||
    blindReviewPacket.reviewProtocol.sourceBinding.attemptsSha256 !==
      attemptsDigest ||
    blindReviewPacket.reviewProtocol.sourceBinding.configurationSha256 !==
      input.configurationSha256 ||
    blindReviewPacket.reviewProtocol.sourceBinding.corpusSha256 !==
      input.corpusSha256
  ) {
    throw new Error('BENCHMARK_AUTONOMOUS_REVIEW_SOURCE_IDENTITY_MISMATCH');
  }
  assertAutonomousSupplierCostReconciled({
    attempts: attemptsArtifact.attempts,
    supplierBudget: attemptsArtifact.supplierBudget,
    supplierCostCapUsd: input.supplierCostCapUsd,
  });
  const reviewedRunMetadata = applyBenchmarkAutonomousReview({
    actualAttemptsSha256: attemptsDigest,
    actualBlindReviewPacketSha256: blindReviewPacketDigest,
    actualConfigurationSha256: input.configurationSha256,
    actualCorpusSha256: input.corpusSha256,
    actualOwnerAuthorizationReference: input.ownerAuthorizationReference,
    actualOwnerAuthorizationSha256: input.ownerAuthorizationSha256,
    actualReviewManifestSha256: sha256(reviewRaw),
    attempts: attemptsArtifact.attempts,
    configuration: input.configuration,
    corpus: input.corpus,
    review,
    runMetadata: attemptsArtifact.runMetadata,
  });
  const summary = summarizeCorrectionBenchmark({
    attempts: attemptsArtifact.attempts,
    configuration: input.configuration,
    corpus: input.corpus,
    runMetadata: reviewedRunMetadata,
  });
  const outputPath = `${input.attemptsPath}.autonomous-reviewed-summary.json`;
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        ...summary,
        models: summary.models.map((metrics) => ({
          ...metrics,
          promotionEligible:
            review.status === 'APPROVED' &&
            metrics.promotionEligible &&
            modelMeetsPromotionThresholds(
              metrics,
              input.configuration.thresholds,
            ),
        })),
        reviewArtifact: review,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  console.log(`Revue autonome appliquée hors ligne : ${outputPath}`);
}
