/// <reference types="node" />

import { describe, expect, it, vi } from 'vitest';
import { SupplierBudgetGuard } from '@/lib/ai-benchmark-supplier-budget';
import {
  parseCorrectionBenchmarkConfiguration,
  parseCorrectionBenchmarkCorpus,
  summarizeCorrectionBenchmark,
} from '@/lib/ai-correction-benchmark';
import {
  buildBenchmarkSupplierBudgetPreflight,
  runBenchmark,
} from './ai-correction-benchmark-runner';
import {
  readJson,
  loadCorpus,
  loadConfiguration,
  pendingRunMetadata,
} from './ai-correction-benchmark.test-support.js';

describe('correction benchmark metrics — part 3', () => {
  it('executes one real same-model score-guard pass without counting it as a retry', async () => {
    const fullCorpus = loadCorpus();
    const writingContract = fullCorpus.contracts.find(
      (contract) => contract.target.activityType === 'writing',
    );
    const writingCases = fullCorpus.cases.filter(
      (benchmarkCase) =>
        benchmarkCase.contractKey === writingContract?.contractKey,
    );
    const benchmarkCase = writingCases.find(
      (item) => item.caseId === 'benchmark-writing-partial',
    );
    if (!writingContract || !benchmarkCase) {
      throw new Error('Expected writing guard fixture.');
    }
    const corpus = parseCorrectionBenchmarkCorpus({
      ...fullCorpus,
      cases: writingCases,
      contracts: [writingContract],
      corpusId: 'writing-real-second-pass-test',
    });
    const configuration = parseCorrectionBenchmarkConfiguration({
      ...(readJson('benchmarks/ai-correction/benchmark.v3_1.json') as object),
      activityTypeScope: ['writing'],
      benchmarkId: 'writing-real-second-pass-test',
      corpusId: corpus.corpusId,
      maxRetries: 0,
      reviewPanelCaseIds: writingCases.map((item) => item.caseId),
      scoreGuardBandPoints: 5,
    });
    const candidate = configuration.candidates[0];
    if (!candidate) {
      throw new Error('Expected benchmark candidate.');
    }
    const rawOutput = (
      levels: ['mastered', 'partial' | 'mastered', 'partial' | 'mastered'],
    ) => ({
      criteria: Object.fromEntries(
        writingContract.criteria.map((criterion, index) => [
          criterion.key,
          {
            confidence: 0.95,
            evidenceQuotes: [benchmarkCase.responseText.slice(0, 12)],
            evidenceStatus: 'FOUND',
            feedback: `Retour vérifiable pour ${criterion.key}.`,
            levelKey: levels[index],
          },
        ]),
      ),
      overallFeedback: 'Retour global vérifiable.',
    });
    const executeCandidate = vi
      .fn()
      .mockResolvedValueOnce({
        latencyMs: 100,
        modelSnapshot: candidate.modelId,
        output: rawOutput(['mastered', 'partial', 'partial']),
        providerRoute: 'Anthropic',
        usage: {
          actualCostUsd: 0.01,
          costSource: 'ACTUAL',
          inputTokens: 100,
          reasoningTokens: 0,
          visibleOutputTokens: 100,
        },
      })
      .mockResolvedValueOnce({
        latencyMs: 110,
        modelSnapshot: candidate.modelId,
        output: rawOutput(['mastered', 'mastered', 'mastered']),
        providerRoute: 'Anthropic',
        usage: {
          actualCostUsd: 0.01,
          costSource: 'ACTUAL',
          inputTokens: 100,
          reasoningTokens: 0,
          visibleOutputTokens: 100,
        },
      });

    const attempts = await runBenchmark({
      candidates: [candidate],
      cases: [benchmarkCase],
      configuration,
      corpus,
      executeCandidate,
      maxRetries: 0,
      providerApiKey: 'test-key',
      repetitions: 1,
    });

    expect(executeCandidate).toHaveBeenCalledTimes(2);
    expect(attempts).toHaveLength(2);
    expect(attempts.map((attempt) => attempt.workflowPass)).toEqual([
      'PRIMARY',
      'SCORE_GUARD_SECOND_PASS',
    ]);
    expect(attempts[0]?.rawModelOutput).toContain('Retour vérifiable');
    expect(attempts[1]?.rawModelOutput).toContain('Retour vérifiable');
    expect(
      attempts[1]?.output?.criteria.map((criterion) => criterion.criterionKey),
    ).toEqual([writingContract.criteria[0]?.key]);
    expect(attempts[1]?.unsureCriteria).toEqual([
      writingContract.criteria[1]?.key,
      writingContract.criteria[2]?.key,
    ]);
    const summary = summarizeCorrectionBenchmark({
      attempts,
      configuration,
      corpus,
      runMetadata: pendingRunMetadata({
        candidateIds: [candidate.candidateId],
        caseIds: [benchmarkCase.caseId],
      }),
    });
    expect(summary.models[0]).toMatchObject({
      actualCostUsd: 0.02,
      decisionAgreement: 0,
      falsePassCount: 0,
      p90LatencyMs: 210,
      retryRate: 0,
      secondPassRate: 1,
    });
  });

  it('preflights the complete 72-primary envelope and keeps retries separate', () => {
    const corpus = loadCorpus();
    const configuration = parseCorrectionBenchmarkConfiguration(
      readJson('benchmarks/ai-correction/benchmark.v3_1.json'),
    );
    const candidate = configuration.candidates[0];
    if (!candidate) {
      throw new Error('Expected benchmark candidate.');
    }

    const preflight = buildBenchmarkSupplierBudgetPreflight({
      candidates: [candidate],
      cases: corpus.cases,
      configuration,
      corpus,
      maxRetries: 0,
      repetitions: 3,
      supplierCostCapUsd: 100,
    });

    expect(preflight).toMatchObject({
      allGuardCallCount: 72,
      boundedSecondPassCount: 72,
      primaryCallCount: 72,
      retryCallCount: 0,
      retryWorstCaseUsd: 0,
      supplierCostCapUsd: 100,
    });
    expect(preflight.primaryWorstCaseUsd).toBeGreaterThan(0);
    expect(preflight.allGuardWorstCaseUsd).toBe(preflight.primaryWorstCaseUsd);
  });

  it('refuses an underfunded mandatory envelope before the first provider call', async () => {
    const corpus = loadCorpus();
    const configuration = loadConfiguration();
    const candidate = configuration.candidates[0];
    const benchmarkCase = corpus.cases[0];
    if (!candidate || !benchmarkCase) {
      throw new Error('Expected benchmark fixtures.');
    }
    const preflight = buildBenchmarkSupplierBudgetPreflight({
      candidates: [candidate],
      cases: [benchmarkCase],
      configuration,
      corpus,
      maxRetries: 0,
      repetitions: 1,
      supplierCostCapUsd: 100,
    });
    const executeCandidate = vi.fn();
    const observedPreflights: unknown[] = [];
    const onBudgetPreflight = vi.fn(async (preflight: unknown) => {
      observedPreflights.push(preflight);
    });

    await expect(
      runBenchmark({
        candidates: [candidate],
        cases: [benchmarkCase],
        configuration,
        corpus,
        executeCandidate,
        maxRetries: 0,
        onBudgetPreflight,
        providerApiKey: 'test-key',
        repetitions: 1,
        supplierBudget: new SupplierBudgetGuard(
          preflight.primaryWorstCaseUsd / 2,
        ),
      }),
    ).rejects.toThrow('BENCHMARK_SUPPLIER_BUDGET_CONTINGENCY_REQUIRED');
    expect(onBudgetPreflight).toHaveBeenCalledTimes(1);
    expect(observedPreflights[0]).toMatchObject({
      decision: 'CONTINGENCY_REQUIRED',
    });
    expect(executeCandidate).not.toHaveBeenCalled();
  });

  it('finishes all 72 primaries before persisting budget-skipped guard passes', async () => {
    const fullCorpus = loadCorpus();
    const writingContract = fullCorpus.contracts.find(
      (contract) => contract.target.activityType === 'writing',
    );
    const benchmarkCase = fullCorpus.cases.find(
      (item) => item.caseId === 'benchmark-writing-partial',
    );
    if (!writingContract || !benchmarkCase) {
      throw new Error('Expected writing guard fixture.');
    }
    const corpus = parseCorrectionBenchmarkCorpus({
      ...fullCorpus,
      cases: [benchmarkCase],
      contracts: [writingContract],
      corpusId: 'writing-budget-skip-test',
    });
    const configuration = parseCorrectionBenchmarkConfiguration({
      ...(readJson('benchmarks/ai-correction/benchmark.v3_1.json') as object),
      activityTypeScope: ['writing'],
      benchmarkId: 'writing-budget-skip-test',
      corpusId: corpus.corpusId,
      maxRetries: 0,
      scoreGuardBandPoints: 5,
    });
    const candidate = configuration.candidates[0];
    if (!candidate) {
      throw new Error('Expected benchmark candidate.');
    }
    const rawOutput = {
      criteria: Object.fromEntries(
        writingContract.criteria.map((criterion, index) => [
          criterion.key,
          {
            confidence: 0.95,
            evidenceQuotes: [benchmarkCase.responseText.slice(0, 12)],
            evidenceStatus: 'FOUND',
            feedback: `Retour vérifiable pour ${criterion.key}.`,
            levelKey: index === 0 ? 'mastered' : 'partial',
          },
        ]),
      ),
      overallFeedback: 'Retour global vérifiable.',
    };
    const envelope = buildBenchmarkSupplierBudgetPreflight({
      candidates: [candidate],
      cases: [benchmarkCase],
      configuration,
      corpus,
      maxRetries: 0,
      repetitions: 72,
      supplierCostCapUsd: 3,
    });
    expect(envelope.decision).toBe('READY');
    const actualCostPerPrimary = (3 - 1e-9) / 72;
    const executeCandidate = vi.fn().mockResolvedValue({
      latencyMs: 100,
      modelSnapshot: candidate.modelId,
      output: rawOutput,
      providerRoute: 'OpenAI',
      usage: {
        actualCostUsd: actualCostPerPrimary,
        costSource: 'ACTUAL',
        inputTokens: 100,
        reasoningTokens: 0,
        visibleOutputTokens: 100,
      },
    });

    const attempts = await runBenchmark({
      candidates: [candidate],
      cases: [benchmarkCase],
      configuration,
      corpus,
      executeCandidate,
      maxRetries: 0,
      providerApiKey: 'test-key',
      repetitions: 72,
      supplierBudget: new SupplierBudgetGuard(3),
    });

    expect(executeCandidate).toHaveBeenCalledTimes(72);
    expect(attempts).toHaveLength(144);
    expect(
      attempts
        .slice(0, 72)
        .every(
          (attempt) =>
            attempt.status === 'VALID' && attempt.workflowPass === 'PRIMARY',
        ),
    ).toBe(true);
    expect(
      attempts
        .slice(72)
        .every(
          (attempt) =>
            attempt.errorCode === 'SCORE_GUARD_SECOND_PASS_SKIPPED_BUDGET' &&
            attempt.status === 'ERROR' &&
            attempt.workflowPass === 'SCORE_GUARD_SECOND_PASS' &&
            JSON.stringify(attempt.unsureCriteria) ===
              JSON.stringify(
                writingContract.criteria.map((criterion) => criterion.key),
              ),
        ),
    ).toBe(true);
  });

  it('keeps a budget-skipped guard as a delivered primary without an exact decision', async () => {
    const fullCorpus = loadCorpus();
    const writingContract = fullCorpus.contracts.find(
      (contract) => contract.target.activityType === 'writing',
    );
    const benchmarkCase = fullCorpus.cases.find(
      (item) => item.caseId === 'benchmark-writing-partial',
    );
    if (!writingContract || !benchmarkCase) {
      throw new Error('Expected writing guard fixture.');
    }
    const writingCases = fullCorpus.cases.filter(
      (item) => item.contractKey === writingContract.contractKey,
    );
    const corpus = parseCorrectionBenchmarkCorpus({
      ...fullCorpus,
      cases: writingCases,
      contracts: [writingContract],
      corpusId: 'writing-budget-skip-summary-test',
    });
    const configuration = parseCorrectionBenchmarkConfiguration({
      ...(readJson('benchmarks/ai-correction/benchmark.v3_1.json') as object),
      activityTypeScope: ['writing'],
      benchmarkId: 'writing-budget-skip-summary-test',
      corpusId: corpus.corpusId,
      maxRetries: 0,
      repetitions: 2,
      reviewPanelCaseIds: writingCases.map((item) => item.caseId),
      scoreGuardBandPoints: 5,
    });
    const candidate = configuration.candidates[0];
    if (!candidate) {
      throw new Error('Expected benchmark candidate.');
    }
    const rawOutput = {
      criteria: Object.fromEntries(
        writingContract.criteria.map((criterion, index) => [
          criterion.key,
          {
            confidence: 0.95,
            evidenceQuotes: [benchmarkCase.responseText.slice(0, 12)],
            evidenceStatus: 'FOUND',
            feedback: `Retour vérifiable pour ${criterion.key}.`,
            levelKey: index === 0 ? 'mastered' : 'partial',
          },
        ]),
      ),
      overallFeedback: 'Retour global vérifiable.',
    };
    const primaryEnvelope = buildBenchmarkSupplierBudgetPreflight({
      candidates: [candidate],
      cases: [benchmarkCase],
      configuration,
      corpus,
      maxRetries: 0,
      repetitions: 2,
      supplierCostCapUsd: 100,
    }).primaryWorstCaseUsd;
    const attempts = await runBenchmark({
      candidates: [candidate],
      cases: [benchmarkCase],
      configuration,
      corpus,
      executeCandidate: vi.fn().mockResolvedValue({
        latencyMs: 100,
        modelSnapshot: candidate.modelId,
        output: rawOutput,
        providerRoute: 'OpenAI',
        usage: {
          actualCostUsd: primaryEnvelope / 2,
          costSource: 'ACTUAL',
          inputTokens: 100,
          reasoningTokens: 0,
          visibleOutputTokens: 100,
        },
      }),
      maxRetries: 0,
      providerApiKey: 'test-key',
      repetitions: 2,
      supplierBudget: new SupplierBudgetGuard(primaryEnvelope),
    });
    const summary = summarizeCorrectionBenchmark({
      attempts,
      configuration,
      corpus,
      runMetadata: pendingRunMetadata({
        candidateIds: [candidate.candidateId],
        caseIds: [benchmarkCase.caseId],
        repetitions: 2,
      }),
    });

    expect(attempts.at(-1)?.errorCode).toBe(
      'SCORE_GUARD_SECOND_PASS_SKIPPED_BUDGET',
    );
    expect(summary.models[0]).toMatchObject({
      decisionAgreement: 0,
      eventualUnusableRunRate: 0,
      secondPassRate: 0,
    });
  });
});
