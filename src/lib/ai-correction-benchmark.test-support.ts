/// <reference types="node" />

import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  parseCorrectionBenchmarkConfiguration,
  parseCorrectionBenchmarkCorpus,
  type BenchmarkAttempt,
  type CorrectionBenchmarkConfiguration,
  type CorrectionBenchmarkCorpus,
  type ModelBenchmarkMetrics,
} from './ai-correction-benchmark.js';
import type { CorrectionOutput } from './ai-correction-contracts.js';

export function readJson(relativePath: string): unknown {
  return JSON.parse(
    readFileSync(path.resolve(relativePath), 'utf8'),
  ) as unknown;
}

export function loadCorpus(): CorrectionBenchmarkCorpus {
  return parseCorrectionBenchmarkCorpus(
    readJson('benchmarks/ai-correction/corpus.v1.json'),
  );
}

export function loadConfiguration(): CorrectionBenchmarkConfiguration {
  return parseCorrectionBenchmarkConfiguration(
    readJson('benchmarks/ai-correction/benchmark.v1.json'),
  );
}

export function loadV2Configuration(): CorrectionBenchmarkConfiguration {
  return parseCorrectionBenchmarkConfiguration(
    readJson('benchmarks/ai-correction/benchmark.v2.json'),
  );
}

export function buildPassingMetrics(
  configuration: CorrectionBenchmarkConfiguration,
): ModelBenchmarkMetrics {
  return {
    actualCostUsd: 0.01,
    automaticGateFailures: [],
    autonomousReviewApproved: false,
    byFamily: {},
    candidateId: configuration.candidates[0]?.candidateId ?? '',
    criterionAgreement: 0.9,
    decisionAgreement: 1,
    evidenceHallucinationRate: 0,
    eliminatoryHumanReviewFindings: [],
    estimatedCostUsd: 0.01,
    injectionSafetyRate: 1,
    eventualUnusableRunRate: 0,
    firstAttemptInvalidRate: 0,
    falseFailCount: 0,
    falseFailRate: 0,
    falsePassCount: 0,
    falsePassRate: 0,
    meanCalibrationError: 0.1,
    meanOrdinalDistance: 0,
    medianLatencyMs: 1000,
    modelId: configuration.candidates[0]?.modelId ?? '',
    p75LatencyMs: 1500,
    p90LatencyMs: 2000,
    promotionIdentity: 'model|fr-FR|corpus|prompt',
    reviewAuthority: 'HUMAN',
    retryRate: 0,
    secondPassRate: 0.1,
    supplierCostReconciled: true,
    transportErrorRate: 0,
    twoLevelOrdinalGapCount: 0,
    decisionAgreementExcludingSecondPass: 1,
    unsureCriterionRate: 0,
    variabilityRate: 0,
    watchSignals: [],
    datasetComplete: true,
    humanReviewApproved: true,
    operationallyDeployable: true,
    ordinalConfusionMatrix: {},
    pedagogicallyEligible: true,
    promotionEligible: true,
  };
}

export function buildOutput(input: {
  benchmarkCase: CorrectionBenchmarkCorpus['cases'][number];
  quote: string;
}): CorrectionOutput {
  return {
    contractKey: input.benchmarkCase.contractKey,
    contractVersion: input.benchmarkCase.contractVersion,
    criteria: input.benchmarkCase.expectedCriteria.map((criterion) => ({
      confidence: 0.95,
      criterionKey: criterion.criterionKey,
      evidenceQuotes: [input.quote],
      feedback: 'Retour synthétique fondé sur la production.',
      levelKey: criterion.levelKey,
    })),
    overallConfidence: 0.95,
    overallFeedback: 'Évaluation synthétique.',
    secondPass: input.benchmarkCase.expectedSecondPass.required
      ? {
          reasons: [input.benchmarkCase.expectedSecondPass.rationale],
          required: true,
        }
      : { reasons: [], required: false },
  };
}

export function attemptIdentity(
  configuration: CorrectionBenchmarkConfiguration,
  candidateIndex = 0,
): Pick<BenchmarkAttempt, 'requestProfileSnapshot' | 'requestProtocolVersion'> {
  const candidate = configuration.candidates[candidateIndex];
  if (!candidate) {
    throw new Error('Expected benchmark candidate is missing.');
  }
  return {
    requestProfileSnapshot: candidate.requestProfile,
    requestProtocolVersion: configuration.requestProtocolVersion,
  };
}

export function pendingRunMetadata(input: {
  candidateIds: string[];
  caseIds: string[];
  mode?: 'FULL' | 'REVIEW_PANEL' | 'SMOKE';
  repetitions?: number;
}) {
  return {
    candidateIds: input.candidateIds,
    caseIds: input.caseIds,
    humanReview: { reviewedAt: null, reviewer: null, status: 'PENDING' },
    mode: input.mode ?? 'SMOKE',
    repetitions: input.repetitions ?? 1,
  };
}

export const autonomousDigests = {
  attempts: 'a'.repeat(64),
  authoringManifest: 'b'.repeat(64),
  blindReviewPacket: 'c'.repeat(64),
  configuration: 'd'.repeat(64),
  corpus: 'e'.repeat(64),
  corpusReviewManifest: 'f'.repeat(64),
  ownerAuthorization: '1'.repeat(64),
  resultReviewManifest: '2'.repeat(64),
};

export function autonomousCorpusReviewMetadata() {
  return {
    artifactKind: 'AUTONOMOUS_CORPUS_REVIEW_MANIFEST' as const,
    authoringManifestSha256: autonomousDigests.authoringManifest,
    configurationSha256: autonomousDigests.configuration,
    corpusReviewManifestSha256: autonomousDigests.corpusReviewManifest,
    corpusSha256: autonomousDigests.corpus,
    ownerAuthorizationReference: 'owner-authorization.json',
    ownerAuthorizationSha256: autonomousDigests.ownerAuthorization,
    reviewedAt: '2026-08-24T10:00:00Z',
    reviewerIdentity: 'independent-corpus-review-agent',
    reviewerKind: 'AUTONOMOUS_AI_NOT_HUMAN' as const,
  };
}

export function autonomousResultReviewArtifact() {
  return {
    artifactKind: 'AUTONOMOUS_RESULT_REVIEW_MANIFEST' as const,
    attemptsSha256: autonomousDigests.attempts,
    blindReviewPacketSha256: autonomousDigests.blindReviewPacket,
    blindedToAutomaticVerdict: true as const,
    blindedToCandidateIdentity: true as const,
    blindedToCandidateOutputs: false as const,
    configurationSha256: autonomousDigests.configuration,
    corpusSha256: autonomousDigests.corpus,
    criticalScores: { diagnosis: 90, evidence: 90, fidelity: 90 },
    eliminatoryFindings: [],
    familyScores: {
      practice: 90,
      project: 90,
      reflection: 90,
      writing: 90,
    },
    meanScore: 90,
    ownerAuthorizationReference: 'owner-authorization.json',
    ownerAuthorizationSha256: autonomousDigests.ownerAuthorization,
    reviewedAt: '2026-08-24T12:00:00Z',
    reviewerIdentity: 'independent-result-review-agent',
    reviewerKind: 'AUTONOMOUS_AI_NOT_HUMAN' as const,
    schemaVersion: 1 as const,
    status: 'APPROVED' as const,
  };
}

export function fullResumeArtifact(input: {
  attempts?: BenchmarkAttempt[];
  configuration: CorrectionBenchmarkConfiguration;
  corpus: CorrectionBenchmarkCorpus;
}) {
  const candidate = input.configuration.candidates[0];
  if (!candidate) {
    throw new Error('Expected benchmark candidate is missing.');
  }
  return {
    attempts: input.attempts ?? [],
    benchmarkId: input.configuration.benchmarkId,
    candidates: [
      {
        candidateId: candidate.candidateId,
        modelId: candidate.modelId,
        provider: candidate.provider,
        requestProfile: candidate.requestProfile,
      },
    ],
    corpusId: input.corpus.corpusId,
    language: input.configuration.language,
    mode: 'FULL',
    modelIds: [candidate.modelId],
    promptVersion: input.configuration.promptVersion,
    requestProtocolVersion: input.configuration.requestProtocolVersion,
    runMetadata: pendingRunMetadata({
      candidateIds: [candidate.candidateId],
      caseIds: input.corpus.cases.map((benchmarkCase) => benchmarkCase.caseId),
      mode: 'FULL',
      repetitions: input.configuration.repetitions,
    }),
  };
}

export function validResumeAttempt(input: {
  benchmarkCase: CorrectionBenchmarkCorpus['cases'][number];
  candidate: CorrectionBenchmarkConfiguration['candidates'][number];
  configuration: CorrectionBenchmarkConfiguration;
  repetition: number;
}): BenchmarkAttempt {
  const quote = input.benchmarkCase.responseText.slice(0, 12);
  return {
    attempt: 1,
    candidateId: input.candidate.candidateId,
    caseId: input.benchmarkCase.caseId,
    latencyMs: 1,
    modelId: input.candidate.modelId,
    output: buildOutput({ benchmarkCase: input.benchmarkCase, quote }),
    repetition: input.repetition,
    requestProfileSnapshot: input.candidate.requestProfile,
    requestProtocolVersion: input.configuration.requestProtocolVersion,
    status: 'VALID',
  };
}

export function fullValidBenchmarkAttempts(input: {
  configuration: CorrectionBenchmarkConfiguration;
  corpus: CorrectionBenchmarkCorpus;
}): BenchmarkAttempt[] {
  const candidate = input.configuration.candidates[0];
  if (!candidate) {
    throw new Error('Expected benchmark candidate is missing.');
  }
  return input.corpus.cases.flatMap((benchmarkCase) =>
    Array.from({ length: input.configuration.repetitions }, (_, index) =>
      validResumeAttempt({
        benchmarkCase,
        candidate,
        configuration: input.configuration,
        repetition: index + 1,
      }),
    ),
  );
}
