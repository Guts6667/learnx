/// <reference types="node" />

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  benchmarkRegressed,
  findBenchmarkContract,
  modelMeetsPromotionThresholds,
  parseCorrectionBenchmarkConfiguration,
  parseCorrectionBenchmarkCorpus,
  summarizeCorrectionBenchmark,
  validateBenchmarkModelOutput,
  type BenchmarkAttempt,
  type CorrectionBenchmarkConfiguration,
  type CorrectionBenchmarkCorpus,
} from '@/lib/ai-correction-benchmark';
import type { CorrectionOutput } from '@/lib/ai-correction-contracts';

function readJson(relativePath: string): unknown {
  return JSON.parse(
    readFileSync(path.resolve(relativePath), 'utf8'),
  ) as unknown;
}

function loadCorpus(): CorrectionBenchmarkCorpus {
  return parseCorrectionBenchmarkCorpus(
    readJson('benchmarks/ai-correction/corpus.v1.json'),
  );
}

function loadConfiguration(): CorrectionBenchmarkConfiguration {
  return parseCorrectionBenchmarkConfiguration(
    readJson('benchmarks/ai-correction/benchmark.v1.json'),
  );
}

function buildOutput(input: {
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
    secondPass: { reasons: [], required: false },
  };
}

describe('correction benchmark corpus', () => {
  it('covers every response profile for every pilot activity type', () => {
    const corpus = loadCorpus();
    const categories = new Set(corpus.cases.map((item) => item.category));
    const activityTypes = new Set(
      corpus.contracts.map((contract) => contract.target.activityType),
    );

    expect(corpus.syntheticOnly).toBe(true);
    expect(corpus.humanReview.status).toBe('PENDING');
    expect(corpus.cases).toHaveLength(24);
    expect(categories).toEqual(
      new Set([
        'SUCCESSFUL',
        'PARTIAL',
        'ERRONEOUS',
        'AMBIGUOUS',
        'OFF_TOPIC',
        'PROMPT_INJECTION',
      ]),
    );
    expect(activityTypes).toEqual(
      new Set(['writing', 'reflection', 'practice', 'project']),
    );

    for (const activityType of activityTypes) {
      const contractKeys = new Set(
        corpus.contracts
          .filter((contract) => contract.target.activityType === activityType)
          .map((contract) => contract.contractKey),
      );
      expect(
        new Set(
          corpus.cases
            .filter((item) => contractKeys.has(item.contractKey))
            .map((item) => item.category),
        ),
      ).toEqual(categories);
    }
  });

  it('pins at least three exact candidates without dynamic aliases', () => {
    const configuration = loadConfiguration();

    expect(configuration.candidates).toHaveLength(3);
    for (const candidate of configuration.candidates) {
      expect(candidate.modelId).toMatch(/-\d{8}$/);
      expect(candidate.modelId).not.toMatch(/latest|auto/);
    }
  });

  it('rejects dynamic model aliases', () => {
    const configuration = readJson(
      'benchmarks/ai-correction/benchmark.v1.json',
    ) as Record<string, unknown>;
    const candidates = configuration.candidates as Array<
      Record<string, unknown>
    >;
    candidates[0] = {
      ...candidates[0],
      modelId: 'openrouter/auto-latest',
    };

    expect(() =>
      parseCorrectionBenchmarkConfiguration(configuration),
    ).toThrow();
  });

  it('rejects evidence that is absent from the synthetic response', () => {
    const corpus = loadCorpus();
    const benchmarkCase = corpus.cases[0];
    expect(benchmarkCase).toBeDefined();
    if (!benchmarkCase) {
      return;
    }
    const contract = findBenchmarkContract(
      corpus,
      benchmarkCase.contractKey,
      benchmarkCase.contractVersion,
    );

    expect(() =>
      validateBenchmarkModelOutput({
        benchmarkCase,
        contract,
        output: buildOutput({
          benchmarkCase,
          quote: 'Citation entièrement inventée.',
        }),
      }),
    ).toThrow('MODEL_EVIDENCE_NOT_IN_RESPONSE');
  });
});

describe('correction benchmark metrics', () => {
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
        attempt: 1,
        caseId: benchmarkCase.caseId,
        latencyMs: 1000 + index * 100,
        modelId: candidate.modelId,
        output: buildOutput({ benchmarkCase, quote }),
        repetition: 1,
        status: 'VALID',
        usage: { completionTokens: 100, promptTokens: 200 },
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
    });

    expect(summary.models).toHaveLength(3);
    expect(summary.models[0]?.criterionAgreement).toBe(1);
    expect(summary.models[0]?.medianLatencyMs).toBe(1000);
    expect(summary.models[0]?.estimatedCostUsd).toBeGreaterThan(0);
    expect(summary.models[1]?.criterionAgreement).toBe(0.5);
    expect(summary.interModelDisagreementRate).toBe(1);
  });

  it('requires every declared promotion threshold', () => {
    const configuration = loadConfiguration();
    const passing = {
      criterionAgreement: 0.9,
      evidenceHallucinationRate: 0,
      estimatedCostUsd: 0.01,
      injectionSafetyRate: 1,
      invalidOutputRate: 0,
      meanCalibrationError: 0.1,
      medianLatencyMs: 1000,
      modelId: configuration.candidates[0]?.modelId ?? '',
      p75LatencyMs: 1500,
      p90LatencyMs: 2000,
      retryRate: 0,
      secondPassRate: 0.1,
      variabilityRate: 0,
    };

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

  it('detects a regression against the last promoted baseline', () => {
    const configuration = loadConfiguration();
    const baseline = {
      criterionAgreement: 0.9,
      evidenceHallucinationRate: 0,
      estimatedCostUsd: 1,
      injectionSafetyRate: 1,
      invalidOutputRate: 0,
      meanCalibrationError: 0.1,
      medianLatencyMs: 1000,
      modelId: configuration.candidates[0]?.modelId ?? '',
      p75LatencyMs: 1200,
      p90LatencyMs: 1500,
      retryRate: 0,
      secondPassRate: 0.1,
      variabilityRate: 0,
    };

    expect(
      benchmarkRegressed({
        baseline,
        candidate: { ...baseline, criterionAgreement: 0.86 },
        limits: configuration.regressionLimits,
      }),
    ).toBe(true);
    expect(
      benchmarkRegressed({
        baseline,
        candidate: { ...baseline, criterionAgreement: 0.88 },
        limits: configuration.regressionLimits,
      }),
    ).toBe(false);
  });
});
