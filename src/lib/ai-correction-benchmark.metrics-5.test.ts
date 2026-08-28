/// <reference types="node" />

import type { BenchmarkAttempt } from '@/lib/ai-correction-benchmark';

import { describe, expect, it } from 'vitest';
import {
  applyBenchmarkAutonomousReview,
  applyBenchmarkHumanReview,
  assertBenchmarkHumanReviewDigest,
  modelMeetsPromotionThresholds,
  summarizeCorrectionBenchmark,
} from '@/lib/ai-correction-benchmark';
import {
  loadCorpus,
  loadConfiguration,
  buildOutput,
  attemptIdentity,
  pendingRunMetadata,
  autonomousDigests,
  autonomousCorpusReviewMetadata,
  autonomousResultReviewArtifact,
} from './ai-correction-benchmark.test-support.js';

describe('correction benchmark metrics — part 5', () => {
  it('evaluates autonomous evidence without fabricating human approval and enables authorized promotion', () => {
    const corpus = loadCorpus();
    const configuration = loadConfiguration();
    const candidate = configuration.candidates[0];
    if (!candidate) {
      throw new Error('Expected benchmark candidate.');
    }
    const attempts: BenchmarkAttempt[] = corpus.cases.flatMap((benchmarkCase) =>
      [1, 2, 3].map((repetition) => ({
        ...attemptIdentity(configuration),
        attempt: 1,
        candidateId: candidate.candidateId,
        caseId: benchmarkCase.caseId,
        latencyMs: 100,
        modelId: candidate.modelId,
        output: buildOutput({
          benchmarkCase,
          quote:
            benchmarkCase.injectionSecurity?.allowedEvidenceQuotes[0] ??
            benchmarkCase.responseText.slice(0, 20),
        }),
        repetition,
        status: 'VALID' as const,
        usage: {
          actualCostUsd: 0.001,
          costSource: 'ACTUAL' as const,
          inputTokens: 100,
          reasoningTokens: 0,
          visibleOutputTokens: 100,
        },
      })),
    );
    const pendingMetadata = {
      candidateIds: [candidate.candidateId],
      caseIds: corpus.cases.map((benchmarkCase) => benchmarkCase.caseId),
      configurationSha256: autonomousDigests.configuration,
      corpusReview: autonomousCorpusReviewMetadata(),
      corpusReviewAuthority: 'AUTONOMOUS_AI_NOT_HUMAN',
      corpusSha256: autonomousDigests.corpus,
      humanReview: { reviewedAt: null, reviewer: null, status: 'PENDING' },
      mode: 'FULL',
      repetitions: configuration.repetitions,
      reviewAuthority: 'NONE',
    };
    const reviewedMetadata = applyBenchmarkAutonomousReview({
      actualAttemptsSha256: autonomousDigests.attempts,
      actualBlindReviewPacketSha256: autonomousDigests.blindReviewPacket,
      actualConfigurationSha256: autonomousDigests.configuration,
      actualCorpusSha256: autonomousDigests.corpus,
      actualOwnerAuthorizationReference: 'owner-authorization.json',
      actualOwnerAuthorizationSha256: autonomousDigests.ownerAuthorization,
      actualReviewManifestSha256: autonomousDigests.resultReviewManifest,
      attempts,
      configuration,
      corpus,
      review: autonomousResultReviewArtifact(),
      runMetadata: pendingMetadata,
    });
    const metrics = summarizeCorrectionBenchmark({
      attempts,
      configuration,
      corpus,
      runMetadata: reviewedMetadata,
    }).models[0];
    expect(metrics).toMatchObject({
      autonomousReviewApproved: true,
      humanReviewApproved: false,
      operationallyDeployable: true,
      pedagogicallyEligible: true,
      promotionEligible: true,
      reviewAuthority: 'AUTONOMOUS_AI_NOT_HUMAN',
      supplierCostReconciled: true,
    });
    expect(metrics?.actualCostUsd).toBeCloseTo(0.072, 10);
    expect(
      metrics &&
        modelMeetsPromotionThresholds(metrics, configuration.thresholds),
    ).toBe(true);

    const unreconciled = summarizeCorrectionBenchmark({
      attempts: attempts.map((attempt) => ({
        ...attempt,
        usage: {
          costSource: 'ESTIMATED' as const,
          inputTokens: 100,
          reasoningTokens: 0,
          visibleOutputTokens: 100,
        },
      })),
      configuration,
      corpus,
      runMetadata: reviewedMetadata,
    }).models[0];
    expect(unreconciled).toMatchObject({
      actualCostUsd: null,
      operationallyDeployable: false,
      supplierCostReconciled: false,
    });
    expect(unreconciled?.automaticGateFailures).toContain(
      'SUPPLIER_COST_RECONCILIATION_REQUIRED',
    );
  });

  it('never promotes smoke, panel, incomplete or unreviewed datasets', () => {
    const corpus = loadCorpus();
    const configuration = loadConfiguration();
    const candidate = configuration.candidates[0];
    const benchmarkCase = corpus.cases[0];
    if (!candidate || !benchmarkCase) {
      throw new Error('Expected benchmark fixtures.');
    }
    const attempt = {
      ...attemptIdentity(configuration),
      attempt: 1,
      candidateId: candidate.candidateId,
      caseId: benchmarkCase.caseId,
      latencyMs: 100,
      modelId: candidate.modelId,
      output: buildOutput({
        benchmarkCase,
        quote: benchmarkCase.responseText.slice(0, 20),
      }),
      repetition: 1,
      status: 'VALID' as const,
    };
    for (const mode of ['SMOKE', 'REVIEW_PANEL', 'FULL'] as const) {
      const summary = summarizeCorrectionBenchmark({
        attempts: [attempt],
        configuration,
        corpus,
        runMetadata: pendingRunMetadata({
          candidateIds: [candidate.candidateId],
          caseIds: [benchmarkCase.caseId],
          mode,
        }),
      });
      expect(summary.models[0]).toMatchObject({
        datasetComplete: false,
        promotionEligible: false,
      });
    }
  });

  it('promotes only one complete 24x3 identity after result review approval', () => {
    const corpus = loadCorpus();
    const configuration = loadConfiguration();
    const candidate = configuration.candidates[0];
    if (!candidate) {
      throw new Error('Expected benchmark candidate.');
    }
    const attempts: BenchmarkAttempt[] = corpus.cases.flatMap((benchmarkCase) =>
      [1, 2, 3].map((repetition) => ({
        ...attemptIdentity(configuration),
        attempt: 1,
        candidateId: candidate.candidateId,
        caseId: benchmarkCase.caseId,
        latencyMs: 100,
        modelId: candidate.modelId,
        output: buildOutput({
          benchmarkCase,
          quote:
            benchmarkCase.injectionSecurity?.allowedEvidenceQuotes[0] ??
            benchmarkCase.responseText.slice(0, 20),
        }),
        repetition,
        status: 'VALID' as const,
      })),
    );
    const summary = summarizeCorrectionBenchmark({
      attempts,
      configuration,
      corpus,
      runMetadata: {
        candidateIds: [candidate.candidateId],
        caseIds: corpus.cases.map((benchmarkCase) => benchmarkCase.caseId),
        humanReview: {
          reviewedAt: '2026-08-12T10:00:00+02:00',
          reviewer: 'Produit & pédagogie LearnX',
          status: 'APPROVED',
        },
        mode: 'FULL',
        repetitions: configuration.repetitions,
      },
    });
    expect(summary.models[0]).toMatchObject({
      datasetComplete: true,
      humanReviewApproved: true,
      operationallyDeployable: true,
      pedagogicallyEligible: true,
      promotionEligible: true,
    });
  });

  it('applies a reviewed artifact only to the exact full-run identity', () => {
    const corpus = loadCorpus();
    const configuration = loadConfiguration();
    const candidate = configuration.candidates[0];
    if (!candidate) {
      throw new Error('Expected benchmark candidate.');
    }
    const runMetadata = pendingRunMetadata({
      candidateIds: [candidate.candidateId],
      caseIds: corpus.cases.map((benchmarkCase) => benchmarkCase.caseId),
      mode: 'FULL',
      repetitions: configuration.repetitions,
    });
    const review = {
      attemptsSha256: 'a'.repeat(64),
      benchmarkId: configuration.benchmarkId,
      candidateId: candidate.candidateId,
      corpusId: corpus.corpusId,
      criticalScores: { diagnosis: 90, evidence: 90, fidelity: 90 },
      eliminatoryFindings: [],
      familyScores: {
        practice: 90,
        project: 90,
        reflection: 90,
        writing: 90,
      },
      language: configuration.language,
      meanScore: 90,
      promptVersion: configuration.promptVersion,
      requestProfileSnapshot: candidate.requestProfile,
      requestProtocolVersion: configuration.requestProtocolVersion,
      reviewedAt: '2026-08-12T10:00:00+02:00',
      reviewer: 'Produit & pédagogie LearnX',
      schemaVersion: 1,
      status: 'APPROVED',
    };
    expect(
      applyBenchmarkHumanReview({
        configuration,
        corpus,
        review,
        runMetadata,
      }).humanReview,
    ).toEqual({
      reviewedAt: '2026-08-12T10:00:00+02:00',
      reviewer: 'Produit & pédagogie LearnX',
      status: 'APPROVED',
    });
    expect(() =>
      applyBenchmarkHumanReview({
        configuration,
        corpus,
        review: {
          ...review,
          requestProfileSnapshot: {
            ...review.requestProfileSnapshot,
            version: '9.9.9',
          },
        },
        runMetadata,
      }),
    ).toThrow('BENCHMARK_HUMAN_REVIEW_IDENTITY_MISMATCH');
    expect(() =>
      applyBenchmarkHumanReview({
        configuration,
        corpus,
        review: {
          ...review,
          corpusId: 'learnx-french-text-corpus-v1',
        },
        runMetadata,
      }),
    ).toThrow('BENCHMARK_HUMAN_REVIEW_IDENTITY_MISMATCH');
    expect(() =>
      applyBenchmarkHumanReview({
        configuration,
        corpus,
        review: { ...review, meanScore: 84 },
        runMetadata,
      }),
    ).toThrow();
  });

  it('binds human review to the exact attempts artifact digest', () => {
    expect(() =>
      assertBenchmarkHumanReviewDigest({
        actualSha256: 'a'.repeat(64),
        expectedSha256: 'a'.repeat(64),
      }),
    ).not.toThrow();
    expect(() =>
      assertBenchmarkHumanReviewDigest({
        actualSha256: 'a'.repeat(64),
        expectedSha256: 'b'.repeat(64),
      }),
    ).toThrow('BENCHMARK_HUMAN_REVIEW_DIGEST_MISMATCH');
  });

  it('rejects duplicated run metadata sets', () => {
    const corpus = loadCorpus();
    const configuration = loadConfiguration();
    const candidate = configuration.candidates[0];
    if (!candidate) {
      throw new Error('Expected benchmark candidate.');
    }
    expect(() =>
      summarizeCorrectionBenchmark({
        attempts: [],
        configuration,
        corpus,
        runMetadata: pendingRunMetadata({
          candidateIds: [candidate.candidateId, candidate.candidateId],
          caseIds: [
            corpus.cases[0]?.caseId ?? '',
            corpus.cases[0]?.caseId ?? '',
          ],
        }),
      }),
    ).toThrow();
  });

  it('counts every invalid, evidence rejection and transport retry at run level', () => {
    const corpus = loadCorpus();
    const configuration = loadConfiguration();
    const candidate = configuration.candidates[0];
    const benchmarkCase = corpus.cases[0];
    if (!candidate || !benchmarkCase) {
      throw new Error('Expected benchmark fixtures.');
    }
    const identity = attemptIdentity(configuration);
    const summary = summarizeCorrectionBenchmark({
      attempts: [
        {
          ...identity,
          attempt: 1,
          candidateId: candidate.candidateId,
          caseId: benchmarkCase.caseId,
          errorCode: 'MODEL_EVIDENCE_NOT_IN_RESPONSE',
          latencyMs: 100,
          modelId: candidate.modelId,
          repetition: 1,
          status: 'INVALID',
        },
        {
          ...identity,
          attempt: 2,
          candidateId: candidate.candidateId,
          caseId: benchmarkCase.caseId,
          errorCode: 'PROVIDER_TIMEOUT',
          latencyMs: 60_000,
          modelId: candidate.modelId,
          repetition: 1,
          status: 'ERROR',
        },
        {
          ...identity,
          attempt: 3,
          candidateId: candidate.candidateId,
          caseId: benchmarkCase.caseId,
          latencyMs: 100,
          modelId: candidate.modelId,
          output: buildOutput({
            benchmarkCase,
            quote: benchmarkCase.responseText.slice(0, 20),
          }),
          repetition: 1,
          status: 'VALID',
        },
      ],
      configuration,
      corpus,
      runMetadata: pendingRunMetadata({
        candidateIds: [candidate.candidateId],
        caseIds: [benchmarkCase.caseId],
      }),
    });
    expect(summary.models[0]).toMatchObject({
      evidenceHallucinationRate: 1,
      eventualUnusableRunRate: 0,
      firstAttemptInvalidRate: 1,
      retryRate: 1,
      transportErrorRate: 1,
    });
  });

  it('rejects duplicate attempts and mismatched request-profile identities', () => {
    const corpus = loadCorpus();
    const configuration = loadConfiguration();
    const candidate = configuration.candidates[0];
    const benchmarkCase = corpus.cases[0];
    if (!candidate || !benchmarkCase) {
      throw new Error('Expected benchmark fixtures.');
    }
    const base = {
      ...attemptIdentity(configuration),
      attempt: 1,
      candidateId: candidate.candidateId,
      caseId: benchmarkCase.caseId,
      latencyMs: 10,
      modelId: candidate.modelId,
      repetition: 1,
      status: 'ERROR' as const,
      errorCode: 'PROVIDER_TIMEOUT',
    };
    const runMetadata = pendingRunMetadata({
      candidateIds: [candidate.candidateId],
      caseIds: [benchmarkCase.caseId],
    });
    expect(() =>
      summarizeCorrectionBenchmark({
        attempts: [base, base],
        configuration,
        corpus,
        runMetadata,
      }),
    ).toThrow('BENCHMARK_LOGICAL_RUN_ATTEMPTS_INVALID');
    expect(() =>
      summarizeCorrectionBenchmark({
        attempts: [
          {
            ...base,
            requestProfileSnapshot: {
              ...base.requestProfileSnapshot,
              version: '9.9.9',
            },
          },
        ],
        configuration,
        corpus,
        runMetadata,
      }),
    ).toThrow('BENCHMARK_ATTEMPT_IDENTITY_MISMATCH');
  });
});
