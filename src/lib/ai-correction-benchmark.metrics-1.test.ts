/// <reference types="node" />

import type { BenchmarkAttempt } from '@/lib/ai-correction-benchmark';

import { describe, expect, it } from 'vitest';
import {
  modelMeetsPromotionThresholds,
  summarizeCorrectionBenchmark,
} from '@/lib/ai-correction-benchmark';
import {
  loadCorpus,
  loadConfiguration,
  buildPassingMetrics,
  buildOutput,
  attemptIdentity,
  pendingRunMetadata,
  autonomousDigests,
} from './ai-correction-benchmark.test-support.js';

describe('correction benchmark metrics — part 1', () => {
  it('derives weighted pass decisions, ordinal confusion and eliminatory findings', () => {
    const corpus = loadCorpus();
    const configuration = loadConfiguration();
    const benchmarkCase = corpus.cases.find(
      (item) => item.category === 'OFF_TOPIC',
    );
    const candidate = configuration.candidates[0];
    if (!benchmarkCase || !candidate) {
      throw new Error('Expected benchmark fixtures.');
    }
    const output = buildOutput({
      benchmarkCase,
      quote: benchmarkCase.responseText.slice(0, 20),
    });
    output.criteria = output.criteria.map((criterion) => ({
      ...criterion,
      levelKey: 'mastered',
    }));
    const summary = summarizeCorrectionBenchmark({
      attempts: [
        {
          ...attemptIdentity(configuration),
          attempt: 1,
          candidateId: candidate.candidateId,
          caseId: benchmarkCase.caseId,
          latencyMs: 10,
          modelId: candidate.modelId,
          output,
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
    const metrics = summary.models[0];
    expect(metrics).toMatchObject({
      decisionAgreement: 0,
      falseFailCount: 0,
      falseFailRate: 0,
      falsePassCount: 1,
      falsePassRate: 1,
      meanOrdinalDistance: 2,
    });
    expect(metrics?.ordinalConfusionMatrix.insufficient?.mastered).toBe(3);
    expect(metrics?.eliminatoryHumanReviewFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'FALSE_PASS' }),
        expect.objectContaining({ kind: 'TWO_LEVEL_ORDINAL_GAP' }),
      ]),
    );
    expect(Object.values(metrics?.byFamily ?? {})[0]).toMatchObject({
      decisionAgreement: 0,
      falsePassCount: 1,
      falsePassRate: 1,
      logicalRuns: 1,
      meanOrdinalDistance: 2,
    });
  });

  it('exposes variability as a failed quantitative gate without relabeling transport fitness', () => {
    const corpus = loadCorpus();
    const configuration = loadConfiguration();
    const candidate = configuration.candidates[0];
    if (!candidate) {
      throw new Error('Expected benchmark candidate.');
    }
    const attempts: BenchmarkAttempt[] = corpus.cases.flatMap(
      (benchmarkCase, caseIndex) =>
        [1, 2, 3].map((repetition) => {
          const output = buildOutput({
            benchmarkCase,
            quote: benchmarkCase.responseText.slice(0, 20),
          });
          if (caseIndex < 3 && repetition === 3) {
            output.criteria[0] = {
              ...output.criteria[0],
              levelKey:
                output.criteria[0]?.levelKey === 'mastered'
                  ? 'partial'
                  : 'mastered',
            };
          }
          return {
            ...attemptIdentity(configuration),
            attempt: 1,
            candidateId: candidate.candidateId,
            caseId: benchmarkCase.caseId,
            latencyMs: 10,
            modelId: candidate.modelId,
            output,
            repetition,
            status: 'VALID' as const,
          };
        }),
    );
    const metrics = summarizeCorrectionBenchmark({
      attempts,
      configuration,
      corpus,
      runMetadata: pendingRunMetadata({
        candidateIds: [candidate.candidateId],
        caseIds: corpus.cases.map((item) => item.caseId),
        mode: 'FULL',
        repetitions: 3,
      }),
    }).models[0];
    expect(metrics?.variabilityRate).toBe(0.125);
    expect(metrics?.operationallyDeployable).toBe(true);
    expect(metrics?.automaticGateFailures).toContain(
      'VARIABILITY_EXCEEDS_MAXIMUM',
    );
  });

  it('calculates agreement, latency, cost, retries and disagreement', () => {
    const corpus = loadCorpus();
    const configuration = loadConfiguration();
    const benchmarkCase = corpus.cases[0];
    expect(benchmarkCase).toBeDefined();
    if (!benchmarkCase) {
      return;
    }
    const quote = benchmarkCase.responseText.slice(0, 30);
    const attempts: BenchmarkAttempt[] = configuration.candidates.map(
      (candidate, index) => ({
        ...attemptIdentity(configuration, index),
        attempt: 1,
        candidateId: candidate.candidateId,
        caseId: benchmarkCase.caseId,
        latencyMs: 1000 + index * 100,
        modelId: candidate.modelId,
        output: buildOutput({ benchmarkCase, quote }),
        repetition: 1,
        status: 'VALID',
        usage: {
          costSource: 'ESTIMATED' as const,
          inputTokens: 200,
          reasoningTokens: 0,
          visibleOutputTokens: 100,
        },
      }),
    );
    const secondModelAttempt = attempts[1];
    expect(secondModelAttempt?.output).toBeDefined();
    if (!secondModelAttempt?.output) {
      return;
    }
    secondModelAttempt.output.criteria[0] = {
      ...secondModelAttempt.output.criteria[0],
      levelKey: 'partial',
    };

    const summary = summarizeCorrectionBenchmark({
      attempts,
      configuration,
      corpus,
      runMetadata: {
        ...pendingRunMetadata({
          candidateIds: configuration.candidates.map(
            (candidate) => candidate.candidateId,
          ),
          caseIds: [benchmarkCase.caseId],
        }),
        configurationSha256: autonomousDigests.configuration,
        corpusSha256: autonomousDigests.corpus,
      },
    });

    expect(summary.models).toHaveLength(configuration.candidates.length);
    expect(summary.models[0]?.criterionAgreement).toBe(1);
    expect(summary.models[0]?.medianLatencyMs).toBe(1000);
    expect(summary.models[0]?.estimatedCostUsd).toBeGreaterThan(0);
    expect(summary.models[1]?.criterionAgreement).toBeCloseTo(2 / 3);
    expect(summary.interModelDisagreementRate).toBe(1);
    expect(summary).toMatchObject({
      benchmarkId: configuration.benchmarkId,
      corpusId: corpus.corpusId,
      language: 'fr-FR',
      promptVersion: configuration.promptVersion,
    });
    expect(summary.models[0]?.promotionIdentity).toContain(
      `${configuration.candidates[0]?.candidateId}|${configuration.candidates[0]?.modelId}|fr-FR|${corpus.corpusId}|${configuration.promptVersion}|${configuration.requestProtocolVersion}|`,
    );
    expect(summary.models[0]?.promotionIdentity).toContain(
      '"visibleOutputTokenTarget":1500',
    );
    expect(summary.models[0]?.promotionIdentity).toContain(
      autonomousDigests.configuration,
    );
    expect(summary.models[0]?.promotionIdentity).toContain(
      autonomousDigests.corpus,
    );
  });

  it('counts leaked injection output as unsafe even when gold levels match', () => {
    const corpus = loadCorpus();
    const configuration = loadConfiguration();
    const benchmarkCase = corpus.cases.find(
      (candidate) => candidate.category === 'PROMPT_INJECTION',
    );
    const candidate = configuration.candidates[0];
    expect(benchmarkCase?.injectionSecurity).toBeDefined();
    expect(candidate).toBeDefined();
    if (!benchmarkCase?.injectionSecurity || !candidate) {
      return;
    }
    const output = buildOutput({
      benchmarkCase,
      quote: benchmarkCase.injectionSecurity.allowedEvidenceQuotes[0] ?? '',
    });
    output.criteria[0] = {
      ...output.criteria[0],
      feedback: `Fuite : ${configuration.controlPrompt.canary}`,
    };

    const summary = summarizeCorrectionBenchmark({
      attempts: [
        {
          ...attemptIdentity(configuration),
          attempt: 1,
          candidateId: candidate.candidateId,
          caseId: benchmarkCase.caseId,
          latencyMs: 100,
          modelId: candidate.modelId,
          output,
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

    expect(summary.models[0]?.criterionAgreement).toBe(1);
    expect(summary.models[0]?.injectionSafetyRate).toBe(0);
  });

  it('does not let a safe retry hide an unsafe injection attempt', () => {
    const corpus = loadCorpus();
    const configuration = loadConfiguration();
    const benchmarkCase = corpus.cases.find(
      (candidate) => candidate.category === 'PROMPT_INJECTION',
    );
    const candidate = configuration.candidates[0];
    expect(benchmarkCase?.injectionSecurity).toBeDefined();
    expect(candidate).toBeDefined();
    if (!benchmarkCase?.injectionSecurity || !candidate) {
      return;
    }
    const safeOutput = buildOutput({
      benchmarkCase,
      quote: benchmarkCase.injectionSecurity.allowedEvidenceQuotes[0] ?? '',
    });

    const summary = summarizeCorrectionBenchmark({
      attempts: [
        {
          ...attemptIdentity(configuration),
          attempt: 1,
          candidateId: candidate.candidateId,
          caseId: benchmarkCase.caseId,
          errorCode: 'MODEL_PROMPT_INJECTION_SAFETY_FAILURE',
          latencyMs: 100,
          modelId: candidate.modelId,
          repetition: 1,
          status: 'INVALID',
        },
        {
          ...attemptIdentity(configuration),
          attempt: 2,
          candidateId: candidate.candidateId,
          caseId: benchmarkCase.caseId,
          latencyMs: 110,
          modelId: candidate.modelId,
          output: safeOutput,
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

    expect(summary.models[0]?.criterionAgreement).toBe(1);
    expect(summary.models[0]?.injectionSafetyRate).toBe(0);
    expect(summary.models[0]?.retryRate).toBe(1);
    expect(summary.models[0]?.firstAttemptInvalidRate).toBe(1);
    expect(summary.models[0]?.eventualUnusableRunRate).toBe(0);
  });

  it('separates first-attempt invalidity from an eventually unusable run', () => {
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
          errorCode: 'MODEL_OUTPUT_CONTRACT_INVALID',
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
          errorCode: 'MODEL_OUTPUT_CONTRACT_INVALID',
          latencyMs: 120,
          modelId: candidate.modelId,
          repetition: 1,
          status: 'INVALID',
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
      eventualUnusableRunRate: 1,
      firstAttemptInvalidRate: 1,
    });
  });

  it('requires every declared promotion threshold', () => {
    const configuration = loadConfiguration();
    const passing = buildPassingMetrics(configuration);

    expect(
      modelMeetsPromotionThresholds(passing, configuration.thresholds),
    ).toBe(true);
    expect(
      modelMeetsPromotionThresholds(
        { ...passing, criterionAgreement: 0.84 },
        configuration.thresholds,
      ),
    ).toBe(false);
  });

  it('keeps v1 gate semantics strict on first-attempt invalidity and raw variability', () => {
    const configuration = loadConfiguration();
    const passing = buildPassingMetrics(configuration);

    expect(
      modelMeetsPromotionThresholds(
        { ...passing, firstAttemptInvalidRate: 0.0139 },
        configuration.thresholds,
      ),
    ).toBe(false);
    expect(
      modelMeetsPromotionThresholds(
        { ...passing, variabilityRate: 0.125 },
        configuration.thresholds,
      ),
    ).toBe(false);
  });
});
