import type { BenchmarkRunMetadata } from './ai-correction-benchmark-artifacts.js';
import {
  getBenchmarkGatePolicyV2Thresholds,
  type CorrectionBenchmarkConfiguration,
} from './ai-correction-benchmark-configuration.js';
import { calculateCost } from './ai-correction-benchmark-compatibility.js';
import { stableSerialize } from './ai-correction-benchmark-serialization.js';
import type { ModelBenchmarkMetrics } from './ai-correction-benchmark-types.js';
import type { ModelAnalysis } from './ai-correction-benchmark-summary-analysis.js';
import {
  percentile,
  type BenchmarkCandidate,
} from './ai-correction-benchmark-summary-support.js';

export function finalizeBenchmarkModel(input: {
  analysis: ModelAnalysis;
  candidate: BenchmarkCandidate;
  configuration: CorrectionBenchmarkConfiguration;
  runMetadata: BenchmarkRunMetadata;
}): ModelBenchmarkMetrics {
  const { analysis, candidate, configuration, runMetadata } = input;
  const { partialMetrics } = analysis;
  const gatePolicyV2 = getBenchmarkGatePolicyV2Thresholds(
    configuration.thresholds,
  );
  const workflowLatencies = analysis.modelRuns.map((run) =>
    run.attempts.reduce((total, attempt) => total + attempt.latencyMs, 0),
  );
  const latencyP90 = percentile(workflowLatencies, 0.9);
  const estimatedCostUsd = analysis.modelAttempts.reduce(
    (total, attempt) => total + calculateCost(attempt, candidate),
    0,
  );
  const supplierCostReconciled =
    analysis.modelAttempts.length > 0 &&
    analysis.modelAttempts.every(
      (attempt) =>
        attempt.errorCode === 'SCORE_GUARD_SECOND_PASS_SKIPPED_BUDGET' ||
        (attempt.usage?.costSource === 'ACTUAL' &&
          attempt.usage.actualCostUsd !== undefined),
    );
  const actualCostUsd = supplierCostReconciled
    ? analysis.modelAttempts.reduce(
        (total, attempt) => total + (attempt.usage?.actualCostUsd ?? 0),
        0,
      )
    : null;
  const resultReviewApproved =
    analysis.humanReviewApproved || analysis.autonomousReviewApproved;
  const pedagogicallyEligible =
    analysis.datasetComplete &&
    resultReviewApproved &&
    partialMetrics.criterionAgreement >=
      configuration.thresholds.criterionAgreementMinimum &&
    partialMetrics.evidenceHallucinationRate <=
      configuration.thresholds.evidenceHallucinationMaximum &&
    partialMetrics.injectionSafetyRate >=
      configuration.thresholds.injectionSafetyMinimum &&
    partialMetrics.meanCalibrationError <=
      configuration.thresholds.meanCalibrationErrorMaximum &&
    (gatePolicyV2
      ? partialMetrics.falsePassCount <= gatePolicyV2.falsePassCountMaximum &&
        partialMetrics.twoLevelOrdinalGapCount <=
          gatePolicyV2.twoLevelOrdinalGapCountMaximum &&
        partialMetrics.decisionAgreementExcludingSecondPass >=
          gatePolicyV2.decisionAgreementCertainMinimum
      : partialMetrics.variabilityRate <=
        configuration.thresholds.variabilityMaximum) &&
    (configuration.thresholds.unsureCriterionRateMaximum === undefined ||
      partialMetrics.unsureCriterionRate <=
        configuration.thresholds.unsureCriterionRateMaximum);
  const operationallyDeployable =
    analysis.datasetComplete &&
    (analysis.reviewAuthority !== 'AUTONOMOUS_AI_NOT_HUMAN' ||
      supplierCostReconciled) &&
    (gatePolicyV2
      ? partialMetrics.eventualUnusableRunRate <=
        gatePolicyV2.eventualUnusableRunRateMaximum
      : partialMetrics.firstAttemptInvalidRate <=
          configuration.thresholds.invalidOutputMaximum &&
        partialMetrics.eventualUnusableRunRate <=
          configuration.thresholds.invalidOutputMaximum) &&
    partialMetrics.transportErrorRate <=
      configuration.thresholds.transportErrorMaximum &&
    latencyP90 <= configuration.thresholds.p90LatencyMsMaximum &&
    estimatedCostUsd <= configuration.thresholds.fullRunCostUsdMaximum;
  const automaticGateFailures = buildAutomaticGateFailures({
    analysis,
    estimatedCostUsd,
    gatePolicyV2,
    latencyP90,
    supplierCostReconciled,
    thresholds: configuration.thresholds,
  });
  const watchSignals = gatePolicyV2
    ? [
        partialMetrics.firstAttemptInvalidRate >
        gatePolicyV2.firstAttemptInvalidWatchMaximum
          ? 'FIRST_ATTEMPT_INVALID_ABOVE_WATCH_TARGET'
          : null,
        partialMetrics.variabilityRate > gatePolicyV2.variabilityWatchMaximum
          ? 'ADJACENT_VARIABILITY_ABOVE_WATCH_TARGET'
          : null,
        analysis.firstAttemptEvidenceRejectionRuns > 0
          ? 'FIRST_ATTEMPT_EVIDENCE_REJECTED'
          : null,
        analysis.recoveredTransportRuns > 0
          ? 'TRANSPORT_ERROR_RECOVERED'
          : null,
      ].filter((signal): signal is string => signal !== null)
    : [];
  return {
    actualCostUsd,
    automaticGateFailures,
    autonomousReviewApproved: analysis.autonomousReviewApproved,
    candidateId: candidate.candidateId,
    ...partialMetrics,
    datasetComplete: analysis.datasetComplete,
    estimatedCostUsd,
    humanReviewApproved: analysis.humanReviewApproved,
    medianLatencyMs: percentile(workflowLatencies, 0.5),
    modelId: candidate.modelId,
    p75LatencyMs: percentile(workflowLatencies, 0.75),
    p90LatencyMs: latencyP90,
    operationallyDeployable,
    pedagogicallyEligible,
    promotionEligible:
      resultReviewApproved && pedagogicallyEligible && operationallyDeployable,
    promotionIdentity: [
      candidate.candidateId,
      candidate.modelId,
      configuration.language,
      configuration.corpusId,
      configuration.promptVersion,
      configuration.requestProtocolVersion,
      stableSerialize(candidate.requestProfile),
      ...(runMetadata.configurationSha256
        ? [runMetadata.configurationSha256]
        : []),
      ...(runMetadata.corpusSha256 ? [runMetadata.corpusSha256] : []),
    ].join('|'),
    reviewAuthority: analysis.reviewAuthority,
    retryRate:
      analysis.modelRuns.length === 0
        ? 0
        : analysis.retriedRuns / analysis.modelRuns.length,
    secondPassRate:
      analysis.modelRuns.length === 0
        ? 0
        : analysis.guardBandSecondPassCount / analysis.modelRuns.length,
    supplierCostReconciled,
    watchSignals,
  };
}

function buildAutomaticGateFailures(input: {
  analysis: ModelAnalysis;
  estimatedCostUsd: number;
  gatePolicyV2: ReturnType<typeof getBenchmarkGatePolicyV2Thresholds>;
  latencyP90: number;
  supplierCostReconciled: boolean;
  thresholds: CorrectionBenchmarkConfiguration['thresholds'];
}): string[] {
  const metrics = input.analysis.partialMetrics;
  return [
    !input.analysis.datasetComplete ? 'DATASET_INCOMPLETE' : null,
    metrics.criterionAgreement < input.thresholds.criterionAgreementMinimum
      ? 'CRITERION_AGREEMENT_BELOW_MINIMUM'
      : null,
    metrics.evidenceHallucinationRate >
    input.thresholds.evidenceHallucinationMaximum
      ? 'EVIDENCE_HALLUCINATION_ABOVE_MAXIMUM'
      : null,
    metrics.injectionSafetyRate < input.thresholds.injectionSafetyMinimum
      ? 'INJECTION_SAFETY_BELOW_MINIMUM'
      : null,
    metrics.meanCalibrationError > input.thresholds.meanCalibrationErrorMaximum
      ? 'CALIBRATION_ERROR_ABOVE_MAXIMUM'
      : null,
    ...(input.gatePolicyV2
      ? [
          metrics.falsePassCount > input.gatePolicyV2.falsePassCountMaximum
            ? 'FALSE_PASS_FOUND'
            : null,
          metrics.twoLevelOrdinalGapCount >
          input.gatePolicyV2.twoLevelOrdinalGapCountMaximum
            ? 'TWO_LEVEL_ORDINAL_GAP_FOUND'
            : null,
          metrics.decisionAgreementExcludingSecondPass <
          input.gatePolicyV2.decisionAgreementCertainMinimum
            ? 'DECISION_AGREEMENT_CERTAIN_BELOW_MINIMUM'
            : null,
          metrics.eventualUnusableRunRate >
          input.gatePolicyV2.eventualUnusableRunRateMaximum
            ? 'EVENTUAL_UNUSABLE_ABOVE_MAXIMUM'
            : null,
        ]
      : [
          metrics.variabilityRate > input.thresholds.variabilityMaximum
            ? 'VARIABILITY_EXCEEDS_MAXIMUM'
            : null,
          metrics.firstAttemptInvalidRate >
          input.thresholds.invalidOutputMaximum
            ? 'FIRST_ATTEMPT_INVALID_ABOVE_MAXIMUM'
            : null,
          metrics.eventualUnusableRunRate >
          input.thresholds.invalidOutputMaximum
            ? 'EVENTUAL_UNUSABLE_ABOVE_MAXIMUM'
            : null,
        ]),
    metrics.transportErrorRate > input.thresholds.transportErrorMaximum
      ? 'TRANSPORT_ERROR_ABOVE_MAXIMUM'
      : null,
    input.latencyP90 > input.thresholds.p90LatencyMsMaximum
      ? 'P90_LATENCY_ABOVE_MAXIMUM'
      : null,
    input.thresholds.unsureCriterionRateMaximum !== undefined &&
    metrics.unsureCriterionRate > input.thresholds.unsureCriterionRateMaximum
      ? 'UNSURE_CRITERION_RATE_ABOVE_MAXIMUM'
      : null,
    input.estimatedCostUsd > input.thresholds.fullRunCostUsdMaximum
      ? 'FULL_RUN_COST_ABOVE_MAXIMUM'
      : null,
    input.analysis.reviewAuthority === 'AUTONOMOUS_AI_NOT_HUMAN' &&
    !input.supplierCostReconciled
      ? 'SUPPLIER_COST_RECONCILIATION_REQUIRED'
      : null,
  ].filter((failure): failure is string => failure !== null);
}
