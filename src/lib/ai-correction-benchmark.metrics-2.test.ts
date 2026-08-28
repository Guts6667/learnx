/// <reference types="node" />

import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { BenchmarkAttempt } from '@/lib/ai-correction-benchmark';
import type { CorrectionOutput } from '@/lib/ai-correction-contracts';

import { describe, expect, it } from 'vitest';
import {
  assertBenchmarkCompatibility,
  findBenchmarkContract,
  parseCorrectionBenchmarkConfiguration,
  parseCorrectionBenchmarkCorpus,
  salvageProtocol3PartialCorrection,
  summarizeCorrectionBenchmark,
} from '@/lib/ai-correction-benchmark';
import { selectFullBlindReviewRuns } from '../../scripts/generate-ai-correction-full-blind-review';
import {
  readJson,
  loadCorpus,
  loadConfiguration,
  loadV2Configuration,
  buildOutput,
  attemptIdentity,
  pendingRunMetadata,
} from './ai-correction-benchmark.test-support.js';

describe('correction benchmark metrics — part 2', () => {
  it('measures presented hallucination under gate policy v2 and keeps rejected attempts as watch signals', () => {
    const corpus = loadCorpus();
    const v1Configuration = loadConfiguration();
    const v2Configuration = loadV2Configuration();
    const benchmarkCase = corpus.cases[0];
    const v2Candidate = v2Configuration.candidates.find(
      (candidate) =>
        candidate.candidateId === v1Configuration.candidates[0]?.candidateId,
    );
    if (!benchmarkCase || !v2Candidate) {
      throw new Error('Expected benchmark fixtures.');
    }
    const cleanOutput = buildOutput({
      benchmarkCase,
      quote: benchmarkCase.responseText.slice(0, 20),
    });
    const hallucinatedOutput = buildOutput({
      benchmarkCase,
      quote: 'citation absente de la production du modele',
    });
    const attempts: BenchmarkAttempt[] = [
      {
        ...attemptIdentity(v2Configuration),
        attempt: 1,
        candidateId: v2Candidate.candidateId,
        caseId: benchmarkCase.caseId,
        errorCode: 'MODEL_EVIDENCE_NOT_IN_RESPONSE',
        latencyMs: 100,
        modelId: v2Candidate.modelId,
        output: hallucinatedOutput,
        repetition: 1,
        status: 'INVALID',
      },
      {
        ...attemptIdentity(v2Configuration),
        attempt: 2,
        candidateId: v2Candidate.candidateId,
        caseId: benchmarkCase.caseId,
        latencyMs: 120,
        modelId: v2Candidate.modelId,
        output: cleanOutput,
        repetition: 1,
        status: 'VALID',
      },
    ];
    const runMetadata = pendingRunMetadata({
      candidateIds: [v2Candidate.candidateId],
      caseIds: [benchmarkCase.caseId],
    });

    const v2Summary = summarizeCorrectionBenchmark({
      attempts,
      configuration: v2Configuration,
      corpus,
      runMetadata,
    });
    expect(v2Summary.models[0]).toMatchObject({
      evidenceHallucinationRate: 0,
      firstAttemptInvalidRate: 1,
      watchSignals: [
        'FIRST_ATTEMPT_INVALID_ABOVE_WATCH_TARGET',
        'FIRST_ATTEMPT_EVIDENCE_REJECTED',
      ],
    });

    // A terminal INVALID final is an unusable run, never a presented hallucination.
    const terminalSummary = summarizeCorrectionBenchmark({
      attempts: [attempts[0] as BenchmarkAttempt],
      configuration: v2Configuration,
      corpus,
      runMetadata,
    });
    expect(terminalSummary.models[0]).toMatchObject({
      evidenceHallucinationRate: 0,
      eventualUnusableRunRate: 1,
      watchSignals: ['FIRST_ATTEMPT_INVALID_ABOVE_WATCH_TARGET'],
    });

    const v1Summary = summarizeCorrectionBenchmark({
      attempts: attempts.map((attempt) => ({
        ...attempt,
        requestProfileSnapshot:
          v1Configuration.candidates[0]?.requestProfile ??
          attempt.requestProfileSnapshot,
      })),
      configuration: v1Configuration,
      corpus,
      runMetadata,
    });
    expect(v1Summary.models[0]).toMatchObject({
      evidenceHallucinationRate: 1,
      watchSignals: [],
    });
  });

  it('still blocks presented hallucinated evidence under gate policy v2', () => {
    const corpus = loadCorpus();
    const v2Configuration = loadV2Configuration();
    const benchmarkCase = corpus.cases[0];
    const candidate = v2Configuration.candidates[0];
    if (!benchmarkCase || !candidate) {
      throw new Error('Expected benchmark fixtures.');
    }
    const summary = summarizeCorrectionBenchmark({
      attempts: [
        {
          ...attemptIdentity(v2Configuration),
          attempt: 1,
          candidateId: candidate.candidateId,
          caseId: benchmarkCase.caseId,
          latencyMs: 100,
          modelId: candidate.modelId,
          output: buildOutput({
            benchmarkCase,
            quote: 'citation absente de la production du modele',
          }),
          repetition: 1,
          status: 'VALID',
        },
      ],
      configuration: v2Configuration,
      corpus,
      runMetadata: pendingRunMetadata({
        candidateIds: [candidate.candidateId],
        caseIds: [benchmarkCase.caseId],
      }),
    });
    expect(summary.models[0]?.evidenceHallucinationRate).toBe(1);
    expect(summary.models[0]?.automaticGateFailures).toContain(
      'EVIDENCE_HALLUCINATION_ABOVE_MAXIMUM',
    );
  });

  it('salvages deliverable criteria and reports the unsure-criterion rate under PARTIAL_CRITERION', () => {
    const corpus = loadCorpus();
    const v2Configuration = loadV2Configuration();
    const partialConfiguration = parseCorrectionBenchmarkConfiguration({
      ...JSON.parse(
        readFileSync(
          path.resolve('benchmarks/ai-correction/benchmark.v2_2.json'),
          'utf8',
        ),
      ),
      benchmarkId: 'learnx-french-text-correction-v3-test',
      correctionDeliveryPolicy: 'PARTIAL_CRITERION',
      thresholds: {
        ...v2Configuration.thresholds,
        unsureCriterionRateMaximum: 0.05,
      },
    });
    const benchmarkCase = corpus.cases[0];
    const candidate = partialConfiguration.candidates.find(
      (item) => item.candidateId === v2Configuration.candidates[0]?.candidateId,
    );
    if (!benchmarkCase || !candidate) {
      throw new Error('Expected benchmark fixtures.');
    }
    const contract = findBenchmarkContract(
      corpus,
      benchmarkCase.contractKey,
      benchmarkCase.contractVersion,
    );

    // One run: one criterion with a wrong-case first quote letter (salvageable
    // via the bounded tolerance), one criterion with a fabricated quote
    // (unsure), one clean criterion — delivered criteria stay in the output.
    const cleanQuote = benchmarkCase.responseText.slice(0, 25);
    const caseSlippedQuote =
      benchmarkCase.responseText.charAt(0).toLowerCase() +
      benchmarkCase.responseText.slice(1, 25);
    const criteria = contract.criteria.map((criterion, index) => ({
      confidence: 0.9,
      evidenceQuotes:
        index === 2
          ? ['citation fabriquee pour le test']
          : index === 1
            ? [caseSlippedQuote]
            : [cleanQuote],
      evidenceStatus: 'FOUND',
      feedback: `Feedback de test pour ${criterion.key}.`,
      levelKey: criterion.performanceLevels[0]?.key ?? '',
    }));
    const rawOutput = {
      criteria: Object.fromEntries(
        contract.criteria.map((criterion, index) => [
          criterion.key,
          criteria[index],
        ]),
      ),
      overallFeedback: 'Feedback global de test.',
    };
    const salvaged = salvageProtocol3PartialCorrection({
      benchmarkCase,
      canary: partialConfiguration.controlPrompt.canary,
      contract,
      output: rawOutput,
    });
    expect(salvaged.output.criteria.map((item) => item.criterionKey)).toEqual([
      contract.criteria[0]?.key,
      contract.criteria[1]?.key,
    ]);
    expect(salvaged.unsureCriteria).toEqual([contract.criteria[2]?.key]);

    const summary = summarizeCorrectionBenchmark({
      attempts: [
        {
          ...attemptIdentity(partialConfiguration),
          attempt: 1,
          candidateId: candidate?.candidateId ?? '',
          caseId: benchmarkCase.caseId,
          latencyMs: 100,
          modelId: candidate?.modelId ?? '',
          output: salvaged.output,
          repetition: 1,
          status: 'VALID',
          unsureCriteria: salvaged.unsureCriteria,
        },
      ],
      configuration: partialConfiguration,
      corpus,
      runMetadata: pendingRunMetadata({
        candidateIds: [candidate?.candidateId ?? ''],
        caseIds: [benchmarkCase.caseId],
      }),
    });
    expect(summary.models[0]?.unsureCriterionRate).toBeCloseTo(1 / 3, 10);
    expect(
      summary.models[0]?.byFamily[contract.target.activityType]?.logicalRuns,
    ).toBe(1);
    expect(summary.models[0]?.automaticGateFailures).toContain(
      'UNSURE_CRITERION_RATE_ABOVE_MAXIMUM',
    );
    for (const unsureCriteria of [
      [],
      [
        salvaged.output.criteria[0]?.criterionKey ?? '',
        ...salvaged.unsureCriteria,
      ],
      ['unknown-criterion', ...salvaged.unsureCriteria],
    ]) {
      expect(() =>
        summarizeCorrectionBenchmark({
          attempts: [
            {
              ...attemptIdentity(partialConfiguration),
              attempt: 1,
              candidateId: candidate.candidateId,
              caseId: benchmarkCase.caseId,
              latencyMs: 100,
              modelId: candidate.modelId,
              output: salvaged.output,
              repetition: 1,
              status: 'VALID',
              unsureCriteria,
            },
          ],
          configuration: partialConfiguration,
          corpus,
          runMetadata: pendingRunMetadata({
            candidateIds: [candidate.candidateId],
            caseIds: [benchmarkCase.caseId],
          }),
        }),
      ).toThrow('BENCHMARK_PARTIAL_CRITERION_COVERAGE_INVALID');
    }
  });

  it('rejects the v3 gate without PARTIAL_CRITERION delivery policy', () => {
    const configuration = loadConfiguration();
    expect(() =>
      parseCorrectionBenchmarkConfiguration({
        ...configuration,
        thresholds: {
          ...configuration.thresholds,
          decisionAgreementCertainMinimum: 0.85,
          eventualUnusableRunRateMaximum: 0.02,
          falsePassCountMaximum: 0,
          firstAttemptInvalidWatchMaximum: 0.1,
          twoLevelOrdinalGapCountMaximum: 0,
          variabilityWatchMaximum: 0.15,
          unsureCriterionRateMaximum: 0.05,
        },
      }),
    ).toThrowError(/requires correctionDeliveryPolicy PARTIAL_CRITERION/);
  });

  it('binds a benchmark scope to its guard band and rejects out-of-scope contracts', () => {
    const corpus = loadCorpus();
    const base = readJson(
      'benchmarks/ai-correction/benchmark.v3_1.json',
    ) as Record<string, unknown>;
    expect(() =>
      parseCorrectionBenchmarkConfiguration({
        ...base,
        activityTypeScope: ['writing'],
      }),
    ).toThrowError(/declare both activityTypeScope and scoreGuardBandPoints/);
    const scoped = parseCorrectionBenchmarkConfiguration({
      ...base,
      activityTypeScope: ['writing'],
      scoreGuardBandPoints: 5,
    });
    expect(scoped).toMatchObject({
      activityTypeScope: ['writing'],
      scoreGuardBandPoints: 5,
    });
    expect(() =>
      assertBenchmarkCompatibility({ configuration: scoped, corpus }),
    ).toThrow('BENCHMARK_ACTIVITY_TYPE_OUT_OF_SCOPE');
  });

  it('routes both inclusive score-guard boundaries to second pass without false PASS/FAIL', () => {
    const fullCorpus = loadCorpus();
    const writingContract = fullCorpus.contracts.find(
      (contract) => contract.target.activityType === 'writing',
    );
    const writingCases = fullCorpus.cases.filter(
      (benchmarkCase) =>
        benchmarkCase.contractKey === writingContract?.contractKey,
    );
    const lowerCase = writingCases.find(
      (benchmarkCase) =>
        benchmarkCase.caseId === 'benchmark-writing-successful',
    );
    const upperCase = writingCases.find(
      (benchmarkCase) => benchmarkCase.caseId === 'benchmark-writing-partial',
    );
    if (!writingContract || !lowerCase || !upperCase) {
      throw new Error('Expected writing benchmark fixtures.');
    }
    const corpus = parseCorrectionBenchmarkCorpus({
      ...fullCorpus,
      cases: writingCases,
      contracts: [writingContract],
      corpusId: 'writing-score-guard-test',
    });
    const configuration = parseCorrectionBenchmarkConfiguration({
      ...(readJson('benchmarks/ai-correction/benchmark.v3_1.json') as object),
      activityTypeScope: ['writing'],
      benchmarkId: 'writing-score-guard-test',
      corpusId: corpus.corpusId,
      reviewPanelCaseIds: writingCases.map(
        (benchmarkCase) => benchmarkCase.caseId,
      ),
      scoreGuardBandPoints: 5,
    });
    assertBenchmarkCompatibility({ configuration, corpus });
    const candidate = configuration.candidates[0];
    if (!candidate) {
      throw new Error('Expected benchmark candidate.');
    }
    const guardedOutput = (input: {
      benchmarkCase: typeof lowerCase;
      levels: [
        'mastered' | 'partial',
        'partial' | 'mastered',
        'partial' | 'mastered',
      ];
    }): CorrectionOutput => {
      const output = buildOutput({
        benchmarkCase: input.benchmarkCase,
        quote: input.benchmarkCase.responseText.slice(0, 12),
      });
      return {
        ...output,
        criteria: output.criteria.map((criterion, index) => ({
          ...criterion,
          levelKey: input.levels[index] ?? criterion.levelKey,
        })),
        secondPass: { reasons: [], required: false },
      };
    };
    const attempts: BenchmarkAttempt[] = [
      {
        ...attemptIdentity(configuration),
        attempt: 1,
        candidateId: candidate.candidateId,
        caseId: lowerCase.caseId,
        latencyMs: 100,
        modelId: candidate.modelId,
        output: guardedOutput({
          benchmarkCase: lowerCase,
          levels: ['mastered', 'partial', 'partial'],
        }),
        repetition: 1,
        status: 'VALID',
      },
      {
        ...attemptIdentity(configuration),
        attempt: 1,
        candidateId: candidate.candidateId,
        caseId: upperCase.caseId,
        latencyMs: 100,
        modelId: candidate.modelId,
        output: guardedOutput({
          benchmarkCase: upperCase,
          levels: ['partial', 'mastered', 'mastered'],
        }),
        repetition: 1,
        status: 'VALID',
      },
    ];
    const summary = summarizeCorrectionBenchmark({
      attempts,
      configuration,
      corpus,
      runMetadata: pendingRunMetadata({
        candidateIds: [candidate.candidateId],
        caseIds: [lowerCase.caseId, upperCase.caseId],
      }),
    });
    expect(summary.models[0]).toMatchObject({
      decisionAgreement: 0,
      decisionAgreementExcludingSecondPass: 0,
      falseFailCount: 0,
      falsePassCount: 0,
      secondPassRate: 0,
    });

    const selected = selectFullBlindReviewRuns({
      attempts,
      corpus,
      scoreGuardBandPoints: 5,
    });
    expect(selected.get(`${lowerCase.caseId}|1`)).toContain(
      'SCORE_GUARD_BAND_SECOND_PASS',
    );
    expect(selected.get(`${upperCase.caseId}|1`)).toContain(
      'SCORE_GUARD_BAND_SECOND_PASS',
    );
    expect(selected.get(`${upperCase.caseId}|1`)).not.toContain(
      'FALSE_PASS_DECISION',
    );
  });
});
