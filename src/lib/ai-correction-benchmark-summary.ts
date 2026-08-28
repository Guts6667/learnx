import {
  benchmarkAttemptSchema,
  benchmarkRunMetadataSchema,
  type BenchmarkAttempt,
} from './ai-correction-benchmark-artifacts.js';
import {
  getBenchmarkGatePolicyV2Thresholds,
  type CorrectionBenchmarkConfiguration,
} from './ai-correction-benchmark-configuration.js';
import {
  assertBenchmarkCompatibility,
  parseCorrectionBenchmarkConfiguration,
  parseCorrectionBenchmarkCorpus,
} from './ai-correction-benchmark-compatibility.js';
import { stableSerialize } from './ai-correction-benchmark-serialization.js';
import type {
  BenchmarkSummary,
  ModelBenchmarkMetrics,
} from './ai-correction-benchmark-types.js';
import { analyzeBenchmarkModel } from './ai-correction-benchmark-summary-analysis.js';
import { finalizeBenchmarkModel } from './ai-correction-benchmark-summary-model.js';
import {
  groupLogicalRuns,
  outputSignature,
  sameStringSet,
  type BenchmarkCase,
  type BenchmarkContract,
} from './ai-correction-benchmark-summary-support.js';

function assertAttemptCompatibility(input: {
  attempts: BenchmarkAttempt[];
  casesById: Map<string, BenchmarkCase>;
  configuration: CorrectionBenchmarkConfiguration;
  contractsByKey: Map<string, BenchmarkContract>;
}): void {
  const candidatesById = new Map(
    input.configuration.candidates.map((candidate) => [
      candidate.candidateId,
      candidate,
    ]),
  );
  for (const attempt of input.attempts) {
    const candidate = candidatesById.get(attempt.candidateId);
    if (
      !candidate ||
      attempt.modelId !== candidate.modelId ||
      attempt.requestProtocolVersion !==
        input.configuration.requestProtocolVersion ||
      stableSerialize(attempt.requestProfileSnapshot) !==
        stableSerialize(candidate.requestProfile)
    ) {
      throw new Error('BENCHMARK_ATTEMPT_IDENTITY_MISMATCH');
    }
    const benchmarkCase = input.casesById.get(attempt.caseId);
    if (!benchmarkCase) throw new Error('BENCHMARK_ATTEMPT_CASE_UNKNOWN');
    if (
      attempt.output &&
      (attempt.output.contractKey !== benchmarkCase.contractKey ||
        attempt.output.contractVersion !== benchmarkCase.contractVersion)
    ) {
      throw new Error('BENCHMARK_ATTEMPT_OUTPUT_CONTRACT_IDENTITY_MISMATCH');
    }
    if (attempt.status !== 'VALID' || !attempt.output) continue;
    const contract = input.contractsByKey.get(
      `${benchmarkCase.contractKey}|${benchmarkCase.contractVersion}`,
    );
    if (!contract) throw new Error('BENCHMARK_ATTEMPT_CONTRACT_UNKNOWN');
    const expectedKeys = contract.criteria.map((criterion) => criterion.key);
    const deliveredKeys = attempt.output.criteria.map(
      (criterion) => criterion.criterionKey,
    );
    const unsureKeys = attempt.unsureCriteria ?? [];
    const exactCoverage = sameStringSet(
      [...deliveredKeys, ...unsureKeys],
      expectedKeys,
    );
    const wholeDelivery = sameStringSet(deliveredKeys, expectedKeys);
    if (
      !exactCoverage ||
      (input.configuration.correctionDeliveryPolicy !== 'PARTIAL_CRITERION' &&
        (!wholeDelivery || unsureKeys.length > 0))
    ) {
      throw new Error('BENCHMARK_PARTIAL_CRITERION_COVERAGE_INVALID');
    }
  }
}

export function summarizeCorrectionBenchmark(input: {
  attempts: unknown[];
  configuration: unknown;
  corpus: unknown;
  runMetadata: unknown;
}): BenchmarkSummary {
  const corpus = parseCorrectionBenchmarkCorpus(input.corpus);
  const configuration = parseCorrectionBenchmarkConfiguration(
    input.configuration,
  );
  assertBenchmarkCompatibility({ configuration, corpus });
  const attempts = input.attempts.map((attempt) =>
    benchmarkAttemptSchema.parse(attempt),
  );
  const runMetadata = benchmarkRunMetadataSchema.parse(input.runMetadata);
  const casesById = new Map(
    corpus.cases.map((benchmarkCase) => [benchmarkCase.caseId, benchmarkCase]),
  );
  const contractsByKey = new Map(
    corpus.contracts.map((contract) => [
      `${contract.contractKey}|${contract.version}`,
      contract,
    ]),
  );
  assertAttemptCompatibility({
    attempts,
    casesById,
    configuration,
    contractsByKey,
  });
  const logicalRuns = groupLogicalRuns(attempts);
  const models = configuration.candidates.map((candidate) =>
    finalizeBenchmarkModel({
      analysis: analyzeBenchmarkModel({
        attempts,
        candidate,
        casesById,
        configuration,
        contractsByKey,
        corpus,
        logicalRuns,
        runMetadata,
      }),
      candidate,
      configuration,
      runMetadata,
    }),
  );
  const signaturesByRun = new Map<string, Set<string>>();
  for (const run of logicalRuns.values()) {
    const attempt = run.finalAttempt;
    if (attempt.status !== 'VALID' || !attempt.output) continue;
    const key = `${attempt.caseId}@${attempt.repetition}`;
    const signatures = signaturesByRun.get(key) ?? new Set<string>();
    signatures.add(outputSignature(attempt.output));
    signaturesByRun.set(key, signatures);
  }
  const disagreements = [...signaturesByRun.values()].filter(
    (signatures) => signatures.size > 1,
  ).length;
  return {
    benchmarkId: configuration.benchmarkId,
    corpusId: configuration.corpusId,
    interModelDisagreementRate:
      signaturesByRun.size === 0 ? 0 : disagreements / signaturesByRun.size,
    language: configuration.language,
    models,
    promptVersion: configuration.promptVersion,
    requestProtocolVersion: configuration.requestProtocolVersion,
    runMetadata,
  };
}

export function modelMeetsPromotionThresholds(
  metrics: ModelBenchmarkMetrics,
  thresholds: CorrectionBenchmarkConfiguration['thresholds'],
): boolean {
  const sharedGates =
    metrics.datasetComplete &&
    (metrics.humanReviewApproved || metrics.autonomousReviewApproved) &&
    metrics.pedagogicallyEligible &&
    metrics.operationallyDeployable &&
    metrics.promotionEligible &&
    metrics.criterionAgreement >= thresholds.criterionAgreementMinimum &&
    metrics.evidenceHallucinationRate <=
      thresholds.evidenceHallucinationMaximum &&
    metrics.estimatedCostUsd <= thresholds.fullRunCostUsdMaximum &&
    metrics.injectionSafetyRate >= thresholds.injectionSafetyMinimum &&
    metrics.meanCalibrationError <= thresholds.meanCalibrationErrorMaximum &&
    metrics.p90LatencyMs <= thresholds.p90LatencyMsMaximum &&
    metrics.transportErrorRate <= thresholds.transportErrorMaximum;
  const gatePolicyV2 = getBenchmarkGatePolicyV2Thresholds(thresholds);
  if (gatePolicyV2) {
    return (
      sharedGates &&
      metrics.falsePassCount <= gatePolicyV2.falsePassCountMaximum &&
      metrics.twoLevelOrdinalGapCount <=
        gatePolicyV2.twoLevelOrdinalGapCountMaximum &&
      metrics.decisionAgreementExcludingSecondPass >=
        gatePolicyV2.decisionAgreementCertainMinimum &&
      metrics.eventualUnusableRunRate <=
        gatePolicyV2.eventualUnusableRunRateMaximum &&
      (thresholds.unsureCriterionRateMaximum === undefined ||
        metrics.unsureCriterionRate <= thresholds.unsureCriterionRateMaximum)
    );
  }
  return (
    sharedGates &&
    metrics.firstAttemptInvalidRate <= thresholds.invalidOutputMaximum &&
    metrics.eventualUnusableRunRate <= thresholds.invalidOutputMaximum &&
    metrics.variabilityRate <= thresholds.variabilityMaximum
  );
}

export function benchmarkRegressed(input: {
  baseline: ModelBenchmarkMetrics;
  candidate: ModelBenchmarkMetrics;
  limits: CorrectionBenchmarkConfiguration['regressionLimits'];
}): boolean {
  const latencyIncreaseRatio =
    input.baseline.p90LatencyMs === 0
      ? 0
      : (input.candidate.p90LatencyMs - input.baseline.p90LatencyMs) /
        input.baseline.p90LatencyMs;
  const costIncreaseRatio =
    input.baseline.estimatedCostUsd === 0
      ? 0
      : (input.candidate.estimatedCostUsd - input.baseline.estimatedCostUsd) /
        input.baseline.estimatedCostUsd;
  return (
    input.baseline.criterionAgreement - input.candidate.criterionAgreement >
      input.limits.criterionAgreementDropMaximum ||
    input.candidate.evidenceHallucinationRate -
      input.baseline.evidenceHallucinationRate >
      input.limits.evidenceHallucinationIncreaseMaximum ||
    input.baseline.injectionSafetyRate - input.candidate.injectionSafetyRate >
      input.limits.injectionSafetyDropMaximum ||
    latencyIncreaseRatio > input.limits.p90LatencyIncreaseRatioMaximum ||
    costIncreaseRatio > input.limits.estimatedCostIncreaseRatioMaximum
  );
}
