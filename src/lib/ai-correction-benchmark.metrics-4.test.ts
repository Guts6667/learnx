/// <reference types="node" />

import type { BenchmarkAttempt } from '@/lib/ai-correction-benchmark';

import { describe, expect, it, vi } from 'vitest';
import { SupplierBudgetGuard } from '@/lib/ai-benchmark-supplier-budget';
import {
  applyBenchmarkAutonomousReview,
  assertBenchmarkAutonomousCorpusReview,
  benchmarkAutonomousReviewArtifactSchema,
  benchmarkRunMetadataSchema,
  modelMeetsPromotionThresholds,
  parseCorrectionBenchmarkConfiguration,
  parseCorrectionBenchmarkCorpus,
  prepareBenchmarkResume,
  resolveBenchmarkEvidenceQuoteWithCaseTolerance,
} from '@/lib/ai-correction-benchmark';
import {
  buildBenchmarkSupplierBudgetPreflight,
  runBenchmark,
} from './ai-correction-benchmark-runner';
import {
  readJson,
  loadCorpus,
  loadConfiguration,
  loadV2Configuration,
  buildPassingMetrics,
  buildOutput,
  autonomousDigests,
  autonomousCorpusReviewMetadata,
  autonomousResultReviewArtifact,
  fullResumeArtifact,
  fullValidBenchmarkAttempts,
} from './ai-correction-benchmark.test-support.js';

describe('correction benchmark metrics — part 4', () => {
  it('does not interrupt the funded primary phase when one cost needs reconciliation', async () => {
    const fullCorpus = loadCorpus();
    const writingContract = fullCorpus.contracts.find(
      (contract) => contract.target.activityType === 'writing',
    );
    const benchmarkCase = fullCorpus.cases.find(
      (item) => item.caseId === 'benchmark-writing-successful',
    );
    if (!writingContract || !benchmarkCase) {
      throw new Error('Expected writing fixture.');
    }
    const corpus = parseCorrectionBenchmarkCorpus({
      ...fullCorpus,
      cases: [benchmarkCase],
      contracts: [writingContract],
      corpusId: 'writing-unreconciled-primary-test',
    });
    const configuration = parseCorrectionBenchmarkConfiguration({
      ...(readJson('benchmarks/ai-correction/benchmark.v3_1.json') as object),
      activityTypeScope: ['writing'],
      benchmarkId: 'writing-unreconciled-primary-test',
      corpusId: corpus.corpusId,
      maxRetries: 0,
      repetitions: 2,
      scoreGuardBandPoints: 5,
    });
    const candidate = configuration.candidates[0];
    if (!candidate) {
      throw new Error('Expected benchmark candidate.');
    }
    const validOutput = buildOutput({
      benchmarkCase,
      quote: benchmarkCase.responseText.slice(0, 12),
    });
    const executeCandidate = vi
      .fn()
      .mockResolvedValueOnce({
        latencyMs: 100,
        modelSnapshot: candidate.modelId,
        output: validOutput,
        providerRoute: 'OpenAI',
      })
      .mockResolvedValueOnce({
        latencyMs: 100,
        modelSnapshot: candidate.modelId,
        output: validOutput,
        providerRoute: 'OpenAI',
        usage: {
          actualCostUsd: 0.01,
          costSource: 'ACTUAL',
          inputTokens: 100,
          reasoningTokens: 0,
          visibleOutputTokens: 100,
        },
      });
    const envelope = buildBenchmarkSupplierBudgetPreflight({
      candidates: [candidate],
      cases: [benchmarkCase],
      configuration,
      corpus,
      maxRetries: 0,
      repetitions: 2,
      supplierCostCapUsd: 100,
    });
    const attempts = await runBenchmark({
      candidates: [candidate],
      cases: [benchmarkCase],
      configuration,
      corpus,
      executeCandidate,
      maxRetries: 0,
      providerApiKey: 'test-key',
      repetitions: 2,
      supplierBudget: new SupplierBudgetGuard(envelope.primaryWorstCaseUsd),
    });

    expect(executeCandidate).toHaveBeenCalledTimes(2);
    expect(attempts).toHaveLength(2);
    expect(attempts.map((attempt) => attempt.repetition)).toEqual([1, 2]);
  });

  it('keeps the case tolerance bounded to a unique first-letter variant', () => {
    const corpus = loadCorpus();
    const benchmarkCase = corpus.cases[0];
    if (!benchmarkCase) {
      throw new Error('Expected benchmark fixtures.');
    }
    const text = benchmarkCase.responseText;
    const slipped = text.charAt(0).toLowerCase() + text.slice(1, 20);
    const resolved = resolveBenchmarkEvidenceQuoteWithCaseTolerance({
      quote: slipped,
      responseText: text,
    });
    expect(resolved.matchType).toBe('TYPOGRAPHIC_EQUIVALENT');
    expect(() =>
      resolveBenchmarkEvidenceQuoteWithCaseTolerance({
        quote: 'absente de la production du modele',
        responseText: text,
      }),
    ).toThrowError('MODEL_EVIDENCE_NOT_IN_RESPONSE');
  });

  it('applies gate policy v2: safety blocks, recoverable incidents are watched', () => {
    const configuration = loadV2Configuration();
    // Sonnet 4.6 protocol 3.0.1 observed profile: recoverable first-attempt
    // invalidity (4/72), one eventually unusable run (1/72), adjacent-level
    // variability on 3/24 ambiguous cases, zero false pass, zero two-level gap.
    const sonnetLike = {
      ...buildPassingMetrics(configuration),
      firstAttemptInvalidRate: 4 / 72,
      eventualUnusableRunRate: 1 / 72,
      variabilityRate: 0.125,
      decisionAgreementExcludingSecondPass: 0.9,
      criterionAgreement: 0.87793,
    };

    expect(
      modelMeetsPromotionThresholds(sonnetLike, configuration.thresholds),
    ).toBe(true);

    expect(
      modelMeetsPromotionThresholds(
        { ...sonnetLike, falsePassCount: 1 },
        configuration.thresholds,
      ),
    ).toBe(false);
    expect(
      modelMeetsPromotionThresholds(
        { ...sonnetLike, twoLevelOrdinalGapCount: 1 },
        configuration.thresholds,
      ),
    ).toBe(false);
    expect(
      modelMeetsPromotionThresholds(
        { ...sonnetLike, decisionAgreementExcludingSecondPass: 0.84 },
        configuration.thresholds,
      ),
    ).toBe(false);
    expect(
      modelMeetsPromotionThresholds(
        { ...sonnetLike, eventualUnusableRunRate: 3 / 72 },
        configuration.thresholds,
      ),
    ).toBe(false);
  });

  it('rejects partially declared gate policy v2 thresholds', () => {
    const configuration = loadConfiguration();
    const partial = {
      ...configuration,
      thresholds: {
        ...configuration.thresholds,
        falsePassCountMaximum: 0,
      },
    };
    expect(() => parseCorrectionBenchmarkConfiguration(partial)).toThrowError(
      /Gate policy v2 thresholds must be declared together/,
    );
  });

  it('binds autonomous corpus review to owner authorization and every preregistered digest', () => {
    const corpus = loadCorpus();
    const configuration = loadConfiguration();
    const { corpusReviewManifestSha256, ...metadata } =
      autonomousCorpusReviewMetadata();
    expect(corpusReviewManifestSha256).toBe(
      autonomousDigests.corpusReviewManifest,
    );
    const manifest = {
      ...metadata,
      benchmarkId: configuration.benchmarkId,
      blindedToCandidateOutputs: true,
      corpusId: corpus.corpusId,
      schemaVersion: 1,
      status: 'APPROVED',
    };
    const assertedReview = assertBenchmarkAutonomousCorpusReview({
      actualAuthoringManifestSha256: autonomousDigests.authoringManifest,
      actualConfigurationSha256: autonomousDigests.configuration,
      actualCorpusReviewManifestSha256: autonomousDigests.corpusReviewManifest,
      actualCorpusSha256: autonomousDigests.corpus,
      actualOwnerAuthorizationReference: 'owner-authorization.json',
      actualOwnerAuthorizationSha256: autonomousDigests.ownerAuthorization,
      benchmarkId: configuration.benchmarkId,
      corpusHumanReviewStatus: 'PENDING',
      corpusId: corpus.corpusId,
      manifest,
    });
    expect(assertedReview.artifactKind).toBe(
      'AUTONOMOUS_CORPUS_REVIEW_MANIFEST',
    );
    if (assertedReview.artifactKind !== 'AUTONOMOUS_CORPUS_REVIEW_MANIFEST') {
      throw new Error('Expected autonomous corpus review.');
    }
    expect(assertedReview.reviewerKind).toBe('AUTONOMOUS_AI_NOT_HUMAN');
    expect(() =>
      assertBenchmarkAutonomousCorpusReview({
        actualAuthoringManifestSha256: autonomousDigests.authoringManifest,
        actualConfigurationSha256: '9'.repeat(64),
        actualCorpusReviewManifestSha256:
          autonomousDigests.corpusReviewManifest,
        actualCorpusSha256: autonomousDigests.corpus,
        actualOwnerAuthorizationReference: 'owner-authorization.json',
        actualOwnerAuthorizationSha256: autonomousDigests.ownerAuthorization,
        benchmarkId: configuration.benchmarkId,
        corpusHumanReviewStatus: 'PENDING',
        corpusId: corpus.corpusId,
        manifest,
      }),
    ).toThrow('BENCHMARK_AUTONOMOUS_CORPUS_REVIEW_DIGEST_MISMATCH');
    expect(() =>
      assertBenchmarkAutonomousCorpusReview({
        actualAuthoringManifestSha256: autonomousDigests.authoringManifest,
        actualConfigurationSha256: autonomousDigests.configuration,
        actualCorpusReviewManifestSha256:
          autonomousDigests.corpusReviewManifest,
        actualCorpusSha256: autonomousDigests.corpus,
        actualOwnerAuthorizationReference: 'owner-authorization.json',
        actualOwnerAuthorizationSha256: autonomousDigests.ownerAuthorization,
        benchmarkId: configuration.benchmarkId,
        corpusHumanReviewStatus: 'APPROVED',
        corpusId: corpus.corpusId,
        manifest,
      }),
    ).toThrow('BENCHMARK_AUTONOMOUS_CORPUS_REVIEW_REQUIRES_HUMAN_PENDING');
  });

  it('requires a result reviewer to see outputs but not candidate identity or the automatic verdict', () => {
    const review = autonomousResultReviewArtifact();
    expect(() =>
      benchmarkAutonomousReviewArtifactSchema.parse(review),
    ).not.toThrow();
    expect(() =>
      benchmarkAutonomousReviewArtifactSchema.parse({
        ...review,
        blindedToCandidateOutputs: true,
      }),
    ).toThrow();
    expect(() =>
      benchmarkAutonomousReviewArtifactSchema.parse({
        ...review,
        candidateId: 'candidate-a',
      }),
    ).toThrow();
  });

  it('applies an autonomous result review only to an exclusive authorized full run', () => {
    const corpus = loadCorpus();
    const configuration = loadConfiguration();
    const candidate = configuration.candidates[0];
    if (!candidate) {
      throw new Error('Expected benchmark candidate.');
    }
    const attempts = fullValidBenchmarkAttempts({ configuration, corpus });
    const runMetadata = {
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
    const apply = (
      review = autonomousResultReviewArtifact(),
      reviewedAttempts: BenchmarkAttempt[] = attempts,
    ) =>
      applyBenchmarkAutonomousReview({
        actualAttemptsSha256: autonomousDigests.attempts,
        actualBlindReviewPacketSha256: autonomousDigests.blindReviewPacket,
        actualConfigurationSha256: autonomousDigests.configuration,
        actualCorpusSha256: autonomousDigests.corpus,
        actualOwnerAuthorizationReference: 'owner-authorization.json',
        actualOwnerAuthorizationSha256: autonomousDigests.ownerAuthorization,
        actualReviewManifestSha256: autonomousDigests.resultReviewManifest,
        attempts: reviewedAttempts,
        configuration,
        corpus,
        review,
        runMetadata,
      });
    const reviewed = apply();
    expect(reviewed).toMatchObject({
      humanReview: { status: 'PENDING' },
      reviewAuthority: 'AUTONOMOUS_AI_NOT_HUMAN',
      autonomousReview: {
        blindedToAutomaticVerdict: true,
        blindedToCandidateIdentity: true,
        blindedToCandidateOutputs: false,
        resultReviewManifestSha256: autonomousDigests.resultReviewManifest,
      },
    });
    expect(() =>
      apply({
        ...autonomousResultReviewArtifact(),
        attemptsSha256: '9'.repeat(64),
      }),
    ).toThrow('BENCHMARK_AUTONOMOUS_REVIEW_DIGEST_MISMATCH');
    expect(() =>
      apply(autonomousResultReviewArtifact(), attempts.slice(0, -1)),
    ).toThrow('BENCHMARK_AUTONOMOUS_REVIEW_REQUIRES_COMPLETE_DATASET');
    expect(() =>
      benchmarkRunMetadataSchema.parse({
        ...reviewed,
        humanReview: {
          reviewedAt: '2026-08-24T13:00:00Z',
          reviewer: 'human-reviewer',
          status: 'APPROVED',
        },
      }),
    ).toThrow(/mutually exclusive/);

    const firstAttempt = attempts[0];
    if (!firstAttempt) {
      throw new Error('Expected a full benchmark dataset.');
    }
    expect(() =>
      prepareBenchmarkResume({
        artifact: {
          ...fullResumeArtifact({
            attempts: [
              ...attempts,
              { ...firstAttempt, attempt: firstAttempt.attempt + 1 },
            ],
            configuration,
            corpus,
          }),
          runMetadata: reviewed,
        },
        configuration,
        corpus,
      }),
    ).toThrow('BENCHMARK_RESUME_AUTONOMOUS_REVIEW_IMMUTABLE');
  });
});
