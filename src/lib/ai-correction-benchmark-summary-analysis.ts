import type {
  BenchmarkAttempt,
  BenchmarkReviewAuthority,
  BenchmarkRunMetadata,
} from './ai-correction-benchmark-artifacts.js';
import {
  getBenchmarkGatePolicyV2Thresholds,
  type CorrectionBenchmarkConfiguration,
} from './ai-correction-benchmark-configuration.js';
import type { CorrectionBenchmarkCorpus } from './ai-correction-benchmark-corpus.js';
import type { ModelBenchmarkMetrics } from './ai-correction-benchmark-types.js';
import { calculateDecisionMetrics } from './ai-correction-benchmark-summary-decision.js';
import {
  calculateEvidenceObservations,
  calculateInjectionObservations,
  calculateStabilityObservations,
  calculateTransportObservations,
  calculateUnsureCriterionRate,
  ordinalLevelKeys,
  scoreGuardRunSets,
} from './ai-correction-benchmark-summary-observations.js';
import {
  modelDatasetIsComplete,
  type BenchmarkCandidate,
  type BenchmarkCase,
  type BenchmarkContract,
  type LogicalRun,
  type ValidBenchmarkAttempt,
} from './ai-correction-benchmark-summary-support.js';

type PartialModelMetrics = Pick<
  ModelBenchmarkMetrics,
  | 'byFamily'
  | 'criterionAgreement'
  | 'decisionAgreement'
  | 'decisionAgreementExcludingSecondPass'
  | 'eliminatoryHumanReviewFindings'
  | 'evidenceHallucinationRate'
  | 'eventualUnusableRunRate'
  | 'firstAttemptInvalidRate'
  | 'falseFailCount'
  | 'falseFailRate'
  | 'falsePassCount'
  | 'falsePassRate'
  | 'injectionSafetyRate'
  | 'meanCalibrationError'
  | 'meanOrdinalDistance'
  | 'ordinalConfusionMatrix'
  | 'transportErrorRate'
  | 'twoLevelOrdinalGapCount'
  | 'unsureCriterionRate'
  | 'variabilityRate'
>;

export type ModelAnalysis = {
  autonomousReviewApproved: boolean;
  datasetComplete: boolean;
  firstAttemptEvidenceRejectionRuns: number;
  guardBandSecondPassCount: number;
  humanReviewApproved: boolean;
  modelAttempts: BenchmarkAttempt[];
  modelRuns: LogicalRun[];
  partialMetrics: PartialModelMetrics;
  recoveredTransportRuns: number;
  retriedRuns: number;
  reviewAuthority: BenchmarkReviewAuthority;
};

export function analyzeBenchmarkModel(input: {
  attempts: BenchmarkAttempt[];
  candidate: BenchmarkCandidate;
  casesById: Map<string, BenchmarkCase>;
  configuration: CorrectionBenchmarkConfiguration;
  contractsByKey: Map<string, BenchmarkContract>;
  corpus: CorrectionBenchmarkCorpus;
  logicalRuns: Map<string, LogicalRun>;
  runMetadata: BenchmarkRunMetadata;
}): ModelAnalysis {
  const modelAttempts = input.attempts.filter(
    (attempt) => attempt.candidateId === input.candidate.candidateId,
  );
  const modelRuns = [...input.logicalRuns.values()].filter(
    (run) => run.finalAttempt.candidateId === input.candidate.candidateId,
  );
  const validAttempts = modelRuns
    .map((run) => run.deliveredAttempt)
    .filter(
      (attempt): attempt is ValidBenchmarkAttempt =>
        attempt?.status === 'VALID' && attempt.output !== undefined,
    );
  const scoreGuardRuns = scoreGuardRunSets(modelRuns);
  const gatePolicyV2 = getBenchmarkGatePolicyV2Thresholds(
    input.configuration.thresholds,
  );
  const transport = calculateTransportObservations({
    gatePolicyV2: Boolean(gatePolicyV2),
    modelRuns,
  });
  const decisions = calculateDecisionMetrics({
    casesById: input.casesById,
    configuration: input.configuration,
    contractsByKey: input.contractsByKey,
    ordinalLevelKeys: ordinalLevelKeys(input.corpus.contracts),
    scoreGuardRoutedRuns: scoreGuardRuns.routed,
    validAttempts,
  });
  const evidence = calculateEvidenceObservations({
    casesById: input.casesById,
    gatePolicyV2: Boolean(gatePolicyV2),
    modelRuns,
  });
  const injection = calculateInjectionObservations({
    canary: input.configuration.controlPrompt.canary,
    casesById: input.casesById,
    modelAttempts,
  });
  const stability = calculateStabilityObservations({
    modelRuns,
    validAttempts,
  });
  const humanReviewApproved =
    input.runMetadata.humanReview.status === 'APPROVED';
  const autonomousReviewApproved =
    input.runMetadata.autonomousReview?.status === 'APPROVED';
  const reviewAuthority: BenchmarkReviewAuthority = humanReviewApproved
    ? 'HUMAN'
    : autonomousReviewApproved
      ? 'AUTONOMOUS_AI_NOT_HUMAN'
      : 'NONE';
  const runCount = modelRuns.length;
  const partialMetrics: PartialModelMetrics = {
    ...decisions,
    evidenceHallucinationRate:
      runCount === 0 ? 0 : evidence.hallucinationCount / runCount,
    eventualUnusableRunRate:
      runCount === 0 ? 0 : transport.unusableRuns.length / runCount,
    firstAttemptInvalidRate:
      runCount === 0
        ? 0
        : transport.runsWithInvalidFirstAttempt.length / runCount,
    injectionSafetyRate:
      injection.injectionRunCount === 0
        ? 0
        : injection.safeInjectionRunCount / injection.injectionRunCount,
    transportErrorRate:
      runCount === 0 ? 0 : transport.runsWithTransportError.length / runCount,
    unsureCriterionRate: calculateUnsureCriterionRate({
      casesById: input.casesById,
      contractsByKey: input.contractsByKey,
      modelRuns,
    }),
    variabilityRate: stability.variabilityRate,
  };
  return {
    autonomousReviewApproved,
    datasetComplete: modelDatasetIsComplete({
      candidateId: input.candidate.candidateId,
      configuration: input.configuration,
      corpus: input.corpus,
      modelRuns,
      runMetadata: input.runMetadata,
    }),
    firstAttemptEvidenceRejectionRuns:
      evidence.firstAttemptEvidenceRejectionRuns,
    guardBandSecondPassCount: scoreGuardRuns.executed.size,
    humanReviewApproved,
    modelAttempts,
    modelRuns,
    partialMetrics,
    recoveredTransportRuns: transport.recoveredTransportRuns,
    retriedRuns: stability.retriedRuns,
    reviewAuthority,
  };
}
