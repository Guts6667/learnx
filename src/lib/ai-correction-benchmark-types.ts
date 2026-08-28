import type {
  BenchmarkReviewAuthority,
  BenchmarkRunMetadata,
} from './ai-correction-benchmark-artifacts.js';

export type ModelBenchmarkMetrics = {
  actualCostUsd: number | null;
  automaticGateFailures: string[];
  byFamily: Record<
    string,
    {
      criterionAgreement: number;
      decisionAgreement: number;
      falseFailCount: number;
      falseFailRate: number;
      falsePassCount: number;
      falsePassRate: number;
      logicalRuns: number;
      meanOrdinalDistance: number;
    }
  >;
  candidateId: string;
  criterionAgreement: number;
  decisionAgreement: number;
  evidenceHallucinationRate: number;
  eliminatoryHumanReviewFindings: Array<{
    actualLevelKey?: string;
    caseId: string;
    criterionKey?: string;
    expectedLevelKey?: string;
    kind: 'FALSE_PASS' | 'TWO_LEVEL_ORDINAL_GAP';
    repetition: number;
  }>;
  estimatedCostUsd: number;
  eventualUnusableRunRate: number;
  firstAttemptInvalidRate: number;
  falseFailCount: number;
  falseFailRate: number;
  falsePassCount: number;
  falsePassRate: number;
  injectionSafetyRate: number;
  meanCalibrationError: number;
  meanOrdinalDistance: number;
  medianLatencyMs: number;
  modelId: string;
  p75LatencyMs: number;
  p90LatencyMs: number;
  datasetComplete: boolean;
  autonomousReviewApproved: boolean;
  humanReviewApproved: boolean;
  operationallyDeployable: boolean;
  ordinalConfusionMatrix: Record<string, Record<string, number>>;
  pedagogicallyEligible: boolean;
  promotionEligible: boolean;
  promotionIdentity: string;
  reviewAuthority: BenchmarkReviewAuthority;
  retryRate: number;
  secondPassRate: number;
  supplierCostReconciled: boolean;
  transportErrorRate: number;
  twoLevelOrdinalGapCount: number;
  decisionAgreementExcludingSecondPass: number;
  unsureCriterionRate: number;
  variabilityRate: number;
  watchSignals: string[];
};

export type BenchmarkSummary = {
  benchmarkId: string;
  corpusId: string;
  interModelDisagreementRate: number;
  language: string;
  models: ModelBenchmarkMetrics[];
  promptVersion: string;
  requestProtocolVersion: string;
  runMetadata: BenchmarkRunMetadata;
};
