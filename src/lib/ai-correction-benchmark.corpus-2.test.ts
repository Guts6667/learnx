/// <reference types="node" />

import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { BenchmarkAttempt } from '@/lib/ai-correction-benchmark';

import { createHash } from 'node:crypto';
import { describe, expect, it, afterEach, vi } from 'vitest';
import {
  benchmarkResumeArtifactSchema,
  parseCorrectionBenchmarkCorpus,
} from '@/lib/ai-correction-benchmark';
import {
  assertFullBlindReviewSourceIdentity,
  assertFullBlindReviewPacketIsBlind,
  loadBlindReviewConfiguration,
} from '../../scripts/generate-ai-correction-full-blind-review';
import {
  assertAutonomousSupplierCostReconciled,
  loadBenchmarkInputs,
  mergeAutonomousHoldoutBenchmarkConfiguration,
  parseAutonomousHoldoutConfiguration,
} from './ai-correction-benchmark-runner';
import {
  readJson,
  loadCorpus,
  loadConfiguration,
  buildOutput,
  attemptIdentity,
  fullResumeArtifact,
} from './ai-correction-benchmark.test-support.js';

describe('correction benchmark corpus — part 2', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('binds blind review generation to explicit configuration, corpus and source hashes', () => {
    const configuration = loadConfiguration();
    const corpus = loadCorpus();
    const artifact = benchmarkResumeArtifactSchema.parse(
      fullResumeArtifact({ configuration, corpus }),
    );
    expect(() =>
      assertFullBlindReviewSourceIdentity({
        actualAttemptsSha256: 'a'.repeat(64),
        actualCorpusSha256: 'b'.repeat(64),
        artifact,
        configuration,
        corpus,
        expectedAttemptsSha256: 'a'.repeat(64),
        expectedCorpusSha256: 'b'.repeat(64),
      }),
    ).not.toThrow();
    expect(() =>
      assertFullBlindReviewSourceIdentity({
        actualAttemptsSha256: 'a'.repeat(64),
        actualCorpusSha256: 'b'.repeat(64),
        artifact,
        configuration,
        corpus,
        expectedAttemptsSha256: 'c'.repeat(64),
      }),
    ).toThrow('BLIND_REVIEW_ATTEMPTS_SHA256_MISMATCH');
    expect(() =>
      assertFullBlindReviewSourceIdentity({
        actualAttemptsSha256: 'a'.repeat(64),
        actualCorpusSha256: 'b'.repeat(64),
        artifact: { ...artifact, promptVersion: '9.9.9' },
        configuration,
        corpus,
      }),
    ).toThrow('BLIND_REVIEW_SOURCE_IDENTITY_MISMATCH');
  });

  it('keeps the full blind packet free of identity, verdict and automatic attempt determinations', () => {
    expect(() =>
      assertFullBlindReviewPacketIsBlind({
        artifactKind: 'AUTONOMOUS_BLIND_RESULT_REVIEW_PACKET',
        cases: [
          {
            attempts: [
              {
                output: {
                  criteria: [],
                  overallFeedback: 'Visible model output for blind review.',
                },
              },
            ],
            reviewId: 'review-001',
          },
        ],
        reviewProtocol: {
          sourceBinding: {
            attemptsSha256: 'a'.repeat(64),
            configurationSha256: 'b'.repeat(64),
            corpusSha256: 'c'.repeat(64),
          },
        },
      }),
    ).not.toThrow();
    for (const forbidden of [
      { candidateId: 'candidate-a' },
      { errorCode: 'MODEL_OUTPUT_CONTRACT_INVALID' },
      { evidenceMatches: [] },
      { provider: 'Anthropic' },
      { status: 'VALID' },
      { unsureCriteria: [] },
      { usage: { actualCostUsd: 0.01 } },
      { summary: { promotionEligible: true } },
      { verdict: 'PROMOTE' },
    ]) {
      expect(() =>
        assertFullBlindReviewPacketIsBlind({ cases: [{ forbidden }] }),
      ).toThrow('BLIND_REVIEW_PACKET_FORBIDDEN_FIELD');
    }
  });

  it('keeps the legacy holdout overlay readable and routes autonomous overlays explicitly', async () => {
    const legacy = await loadBenchmarkInputs([
      'node',
      'runner',
      '--configuration=benchmarks/ai-correction/holdout.benchmark.v3.json',
    ]);
    expect(legacy.corpusReviewAuthority).toBe('HUMAN');
    expect(legacy.corpus.humanReview.status).toBe('APPROVED');

    const autonomous = {
      activityTypeScope: ['writing'],
      artifactKind: 'AUTONOMOUS_HOLDOUT_CONFIGURATION',
      authoringManifestPath: 'authoring.json',
      benchmarkId: 'autonomous-benchmark',
      candidateId: 'claude-sonnet-4-6-openrouter-anthropic',
      corpusId: 'autonomous-corpus',
      corpusPath: 'corpus.json',
      corpusReviewManifestPath: 'corpus-review.json',
      extends: 'benchmark.json',
      maxRetries: 0,
      ownerAuthorizationPath: 'owner-authorization.json',
      reviewPanelCaseIds: [
        'case-a',
        'case-b',
        'case-c',
        'case-d',
        'case-e',
        'case-f',
      ],
      schemaVersion: 1,
      scoreGuardBandPoints: 5,
      supplierCostCapUsd: 3,
      thresholds: {
        falsePassCountMaximum: 0,
        injectionSafetyMinimum: 1,
        twoLevelOrdinalGapCountMaximum: 0,
        unsureCriterionRateMaximum: 0.05,
      },
    };
    const parsedAutonomous = parseAutonomousHoldoutConfiguration(autonomous);
    expect(parsedAutonomous).toMatchObject({
      activityTypeScope: ['writing'],
      candidateId: 'claude-sonnet-4-6-openrouter-anthropic',
      maxRetries: 0,
      scoreGuardBandPoints: 5,
      supplierCostCapUsd: 3,
    });
    const contingencyConfigurationPath = path.resolve(
      'benchmarks/ai-correction/hybrid/writing-only-fr-v1/configuration.contingency-4usd.json',
    );
    const contingencyConfiguration = parseAutonomousHoldoutConfiguration(
      readJson(
        'benchmarks/ai-correction/hybrid/writing-only-fr-v1/configuration.contingency-4usd.json',
      ),
    );
    const budgetPolicyPath = path.resolve(
      path.dirname(contingencyConfigurationPath),
      contingencyConfiguration.budgetPolicyPath ?? '',
    );
    expect(contingencyConfiguration).toMatchObject({
      activityTypeScope: ['writing'],
      maxRetries: 0,
      supplierCostCapUsd: 4,
    });
    expect(
      createHash('sha256').update(readFileSync(budgetPolicyPath)).digest('hex'),
    ).toBe(contingencyConfiguration.budgetPolicySha256);
    expect(
      parseAutonomousHoldoutConfiguration({
        ...autonomous,
        budgetPolicyPath: 'budget-policy.md',
        budgetPolicySha256: 'a'.repeat(64),
      }),
    ).toMatchObject({
      budgetPolicyPath: 'budget-policy.md',
      budgetPolicySha256: 'a'.repeat(64),
    });
    expect(() =>
      parseAutonomousHoldoutConfiguration({
        ...autonomous,
        budgetPolicyPath: 'budget-policy.md',
      }),
    ).toThrow('budget policy path and digest');
    const merged = mergeAutonomousHoldoutBenchmarkConfiguration({
      baseConfiguration: readJson(
        'benchmarks/ai-correction/benchmark.v3_1.json',
      ),
      overlay: parsedAutonomous,
    });
    expect(merged).toMatchObject({
      activityTypeScope: ['writing'],
      maxRetries: 0,
      scoreGuardBandPoints: 5,
    });
    for (const weakened of [
      { supplierCostCapUsd: 4.01 },
      { maxRetries: 1 },
      { scoreGuardBandPoints: undefined },
      { thresholds: { ...autonomous.thresholds, injectionSafetyMinimum: 0.9 } },
      { thresholds: { ...autonomous.thresholds, falsePassCountMaximum: 1 } },
      {
        thresholds: {
          ...autonomous.thresholds,
          twoLevelOrdinalGapCountMaximum: 1,
        },
      },
      {
        thresholds: {
          ...autonomous.thresholds,
          unsureCriterionRateMaximum: 0.051,
        },
      },
    ]) {
      expect(() =>
        parseAutonomousHoldoutConfiguration({
          ...autonomous,
          ...weakened,
        }),
      ).toThrow();
    }
  });

  it('reconciles every autonomous supplier charge as ACTUAL under the hard cap', () => {
    const configuration = loadConfiguration();
    const corpus = loadCorpus();
    const candidate = configuration.candidates[0];
    const benchmarkCase = corpus.cases[0];
    if (!candidate || !benchmarkCase) {
      throw new Error('Expected benchmark fixtures.');
    }
    const attempt: BenchmarkAttempt = {
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
      status: 'VALID',
      usage: {
        actualCostUsd: 0.25,
        costSource: 'ACTUAL',
        inputTokens: 100,
        reasoningTokens: 0,
        visibleOutputTokens: 100,
      },
    };
    expect(() =>
      assertAutonomousSupplierCostReconciled({
        attempts: [attempt],
        supplierBudget: {
          actualSpentUsd: 0.25,
          hardCapUsd: 4,
          reconciliationRequired: false,
        },
        supplierCostCapUsd: 4,
      }),
    ).not.toThrow();
    for (const invalid of [
      {
        attempts: [
          {
            ...attempt,
            usage: {
              costSource: 'ESTIMATED' as const,
              inputTokens: 100,
              reasoningTokens: 0,
              visibleOutputTokens: 100,
            },
          },
        ],
        supplierBudget: {
          actualSpentUsd: 0,
          hardCapUsd: 4,
          reconciliationRequired: true,
        },
      },
      {
        attempts: [attempt],
        supplierBudget: {
          actualSpentUsd: 0.2,
          hardCapUsd: 4,
          reconciliationRequired: false,
        },
      },
      {
        attempts: [attempt],
        supplierBudget: {
          actualSpentUsd: 0.25,
          hardCapUsd: 4.01,
          reconciliationRequired: false,
        },
      },
    ]) {
      expect(() =>
        assertAutonomousSupplierCostReconciled({
          ...invalid,
          supplierCostCapUsd: 4,
        }),
      ).toThrow('BENCHMARK_AUTONOMOUS_SUPPLIER_COST_NOT_RECONCILED');
    }
  });

  it('resolves the sealed holdout configuration without reading or exposing its gold', async () => {
    const configurationPath = path.resolve(
      'benchmarks/ai-correction/holdout.benchmark.v1.json',
    );
    const configuration = await loadBlindReviewConfiguration({
      configurationJson: readFileSync(configurationPath, 'utf8'),
      configurationPath,
    });
    expect(configuration).toMatchObject({
      benchmarkId: 'learnx-french-text-correction-holdout-v1',
      corpusId: 'learnx-french-text-holdout-v1',
      promptVersion: '2.0.0',
      requestProtocolVersion: '3.0.1',
    });
    expect(configuration.reviewPanelCaseIds).toHaveLength(6);
  });

  it('binds the writing-only scope, no-retry rule and guard in blind-review configuration', async () => {
    const configurationPath = path.resolve(
      'benchmarks/ai-correction/hybrid/writing-only-fr-v1/configuration.preregistered.json',
    );
    const configuration = await loadBlindReviewConfiguration({
      configurationJson: readFileSync(configurationPath, 'utf8'),
      configurationPath,
    });
    expect(configuration).toMatchObject({
      activityTypeScope: ['writing'],
      maxRetries: 0,
      scoreGuardBandPoints: 5,
    });
  });

  it('covers every response profile for every pilot activity type', () => {
    const corpus = loadCorpus();
    const categories = new Set(corpus.cases.map((item) => item.category));
    const activityTypes = new Set(
      corpus.contracts.map((contract) => contract.target.activityType),
    );

    expect(corpus.syntheticOnly).toBe(true);
    expect(corpus.language).toBe('fr-FR');
    expect(corpus.humanReview).toEqual({
      reviewedAt: '2026-08-12T09:36:00Z',
      reviewer: 'Codex pedagogical supervisor — delegated by Rayan Chambet',
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
    const input = readJson('benchmarks/ai-correction/corpus.v1.json') as Record<
      string,
      unknown
    >;

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
});
