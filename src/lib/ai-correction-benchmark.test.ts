/// <reference types="node" />

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertBenchmarkCompatibility,
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
    secondPass: input.benchmarkCase.expectedSecondPass.required
      ? {
          reasons: [input.benchmarkCase.expectedSecondPass.rationale],
          required: true,
        }
      : { reasons: [], required: false },
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
    expect(corpus.language).toBe('fr-FR');
    expect(corpus.humanReview).toEqual({
      reviewedAt: '2026-08-11T20:30:27Z',
      reviewer: 'Rayan Chambet',
      status: 'APPROVED',
    });
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

  it('accepts canonical language tags without coupling the engine to French', () => {
    const input = readJson(
      'benchmarks/ai-correction/corpus.v1.json',
    ) as Record<string, unknown>;

    expect(() =>
      parseCorrectionBenchmarkCorpus({ ...input, language: 'en-GB' }),
    ).not.toThrow();
    expect(() =>
      parseCorrectionBenchmarkCorpus({ ...input, language: 'not_a_tag' }),
    ).toThrow();
    expect(() =>
      parseCorrectionBenchmarkCorpus({ ...input, language: 'fr-fr' }),
    ).toThrow();
  });

  it('contains auditable, discriminating gold labels around the pass threshold', () => {
    const corpus = loadCorpus();
    const scores = new Set<number>();

    for (const benchmarkCase of corpus.cases) {
      const contract = findBenchmarkContract(
        corpus,
        benchmarkCase.contractKey,
        benchmarkCase.contractVersion,
      );
      const expectedLevels = new Map(
        benchmarkCase.expectedCriteria.map((criterion) => [
          criterion.criterionKey,
          criterion.levelKey,
        ]),
      );
      const score = contract.criteria.reduce((total, criterion) => {
        const expectedLevel = expectedLevels.get(criterion.key);
        const level = criterion.performanceLevels.find(
          (candidate) => candidate.key === expectedLevel,
        );
        return total + ((level?.score ?? 0) * criterion.weight) / 100;
      }, 0);

      scores.add(score);
      expect(benchmarkCase.taskContext.length).toBeGreaterThan(80);
      expect(benchmarkCase.taskPrompt.length).toBeGreaterThan(30);
      expect(benchmarkCase.goldRationale.length).toBeGreaterThanOrEqual(35);
      expect(contract.criteria).toHaveLength(3);
      expect(
        contract.criteria.every(
          (criterion) => criterion.calibratedExamples.length >= 2,
        ),
      ).toBe(true);

      if (benchmarkCase.category === 'AMBIGUOUS') {
        expect(benchmarkCase.expectedSecondPass.required).toBe(true);
      }
      if (benchmarkCase.category === 'PROMPT_INJECTION') {
        expect(
          benchmarkCase.expectedCriteria.some(
            (criterion) => criterion.levelKey !== 'insufficient',
          ),
        ).toBe(true);
      }
    }

    expect(scores.has(70)).toBe(true);
    expect(scores.has(80)).toBe(true);
    expect(scores.size).toBeGreaterThanOrEqual(7);
  });

  it('pins at least three exact candidates without dynamic aliases', () => {
    const configuration = loadConfiguration();

    expect(configuration.candidates).toHaveLength(3);
    expect(configuration.candidates.map((candidate) => candidate.modelId)).toEqual([
      'openai/gpt-5.6-terra',
      'anthropic/claude-sonnet-4.6',
      'google/gemini-3.6-flash',
    ]);
    for (const candidate of configuration.candidates) {
      expect(candidate.modelId).not.toMatch(
        /(^|[./-])(auto|latest|free|nitro|floor)([./-]|$)/,
      );
    }
  });

  it('keeps configuration, corpus and localized control prompt on one language', () => {
    const corpus = loadCorpus();
    const configuration = loadConfiguration();

    expect(configuration.language).toBe('fr-FR');
    expect(configuration.controlPrompt.language).toBe('fr-FR');
    expect(configuration.controlPrompt.version).toBe(
      configuration.promptVersion,
    );
    expect(() =>
      assertBenchmarkCompatibility({ configuration, corpus }),
    ).not.toThrow();
    expect(() =>
      assertBenchmarkCompatibility({
        configuration: { ...configuration, language: 'en-GB' },
        corpus,
      }),
    ).toThrow('BENCHMARK_LANGUAGE_MISMATCH');
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

  it('rejects a prompt injection false positive despite correct levels', () => {
    const corpus = loadCorpus();
    const configuration = loadConfiguration();
    const benchmarkCase = corpus.cases.find(
      (candidate) => candidate.category === 'PROMPT_INJECTION',
    );
    expect(benchmarkCase?.injectionSecurity).toBeDefined();
    if (!benchmarkCase?.injectionSecurity) {
      return;
    }
    const contract = findBenchmarkContract(
      corpus,
      benchmarkCase.contractKey,
      benchmarkCase.contractVersion,
    );
    const output = buildOutput({
      benchmarkCase,
      quote: benchmarkCase.injectionSecurity.allowedEvidenceQuotes[0] ?? '',
    });
    output.overallFeedback = `Instruction appliquée : ${benchmarkCase.injectionSecurity.forbiddenOutputFragments[0]}`;

    expect(() =>
      validateBenchmarkModelOutput({
        benchmarkCase,
        canary: configuration.controlPrompt.canary,
        contract,
        output,
      }),
    ).toThrow('MODEL_PROMPT_INJECTION_SAFETY_FAILURE');
  });

  it('rejects an evidence quote copied from the attack segment', () => {
    const corpus = loadCorpus();
    const configuration = loadConfiguration();
    const benchmarkCase = corpus.cases.find(
      (candidate) => candidate.category === 'PROMPT_INJECTION',
    );
    expect(benchmarkCase?.injectionSecurity).toBeDefined();
    if (!benchmarkCase?.injectionSecurity) {
      return;
    }
    const security = benchmarkCase.injectionSecurity;
    const contract = findBenchmarkContract(
      corpus,
      benchmarkCase.contractKey,
      benchmarkCase.contractVersion,
    );

    expect(() =>
      validateBenchmarkModelOutput({
        benchmarkCase,
        canary: configuration.controlPrompt.canary,
        contract,
        output: buildOutput({
          benchmarkCase,
          quote: security.attackText,
        }),
      }),
    ).toThrow('MODEL_PROMPT_INJECTION_SAFETY_FAILURE');
  });

  it('accepts an exact legitimate quote that is not a prelisted example', () => {
    const corpus = loadCorpus();
    const configuration = loadConfiguration();
    const benchmarkCase = corpus.cases.find(
      (candidate) => candidate.category === 'PROMPT_INJECTION',
    );
    expect(benchmarkCase?.injectionSecurity).toBeDefined();
    if (!benchmarkCase?.injectionSecurity) {
      return;
    }
    const contract = findBenchmarkContract(
      corpus,
      benchmarkCase.contractKey,
      benchmarkCase.contractVersion,
    );
    const quote = benchmarkCase.injectionSecurity.legitimateResponseText;
    expect(
      benchmarkCase.injectionSecurity.allowedEvidenceQuotes,
    ).not.toContain(quote);

    expect(() =>
      validateBenchmarkModelOutput({
        benchmarkCase,
        canary: configuration.controlPrompt.canary,
        contract,
        output: buildOutput({ benchmarkCase, quote }),
      }),
    ).not.toThrow();
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
    expect(summary.models[1]?.criterionAgreement).toBeCloseTo(2 / 3);
    expect(summary.interModelDisagreementRate).toBe(1);
    expect(summary).toMatchObject({
      benchmarkId: configuration.benchmarkId,
      corpusId: corpus.corpusId,
      language: 'fr-FR',
      promptVersion: configuration.promptVersion,
    });
    expect(summary.models[0]?.promotionIdentity).toBe(
      `${configuration.candidates[0]?.modelId}|fr-FR|${corpus.corpusId}|${configuration.promptVersion}`,
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
          attempt: 1,
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
          attempt: 1,
          caseId: benchmarkCase.caseId,
          errorCode: 'MODEL_PROMPT_INJECTION_SAFETY_FAILURE',
          latencyMs: 100,
          modelId: candidate.modelId,
          repetition: 1,
          status: 'INVALID',
        },
        {
          attempt: 2,
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
    });

    expect(summary.models[0]?.criterionAgreement).toBe(1);
    expect(summary.models[0]?.injectionSafetyRate).toBe(0);
    expect(summary.models[0]?.retryRate).toBe(0.5);
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
      promotionIdentity: 'model|fr-FR|corpus|prompt',
      retryRate: 0,
      secondPassAgreement: 1,
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
      promotionIdentity: 'model|fr-FR|corpus|prompt',
      retryRate: 0,
      secondPassAgreement: 1,
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
