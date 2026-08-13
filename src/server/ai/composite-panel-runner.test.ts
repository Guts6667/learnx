import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import {
  findBenchmarkContract,
  parseCorrectionBenchmarkConfiguration,
  parseCorrectionBenchmarkCorpus,
} from '@/lib/ai-correction-benchmark';

import type { CompositeRunEnvelope } from './composite-pipeline-validation.js';
import {
  assertCompositePanelSources,
  estimateCompositePanelWorstCaseUsd,
  runCompositeMiniPanel,
  type CompositePanelProviderPort,
} from './composite-panel-runner.js';

const corpusBytes = readFileSync('benchmarks/ai-correction/corpus.v1.json');
const configurationBytes = readFileSync(
  'benchmarks/ai-correction/benchmark.v1.json',
);
const corpus = parseCorrectionBenchmarkCorpus(
  JSON.parse(corpusBytes.toString('utf8')),
);
const rawCorpus = JSON.parse(corpusBytes.toString('utf8')) as {
  cases: Array<{ caseId: string }>;
};
const configuration = parseCorrectionBenchmarkConfiguration(
  JSON.parse(configurationBytes.toString('utf8')),
);
const frozenEnvelope = JSON.parse(
  readFileSync(
    'benchmarks/ai-correction/composite/v4-009b-run-envelope.json',
    'utf8',
  ),
) as CompositeRunEnvelope;
const envelope = {
  ...frozenEnvelope,
  authorization: 'GRANTED',
} satisfies CompositeRunEnvelope;

function digest(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function outputFor(caseId: string): unknown {
  const benchmarkCase = corpus.cases.find((entry) => entry.caseId === caseId);
  if (!benchmarkCase) throw new Error('TEST_CASE_NOT_FOUND');
  const contract = findBenchmarkContract(
    corpus,
    benchmarkCase.contractKey,
    benchmarkCase.contractVersion,
  );
  const expected = new Map(
    benchmarkCase.expectedCriteria.map((criterion) => [
      criterion.criterionKey,
      criterion.levelKey,
    ]),
  );
  const evidenceText =
    'injectionSecurity' in benchmarkCase && benchmarkCase.injectionSecurity
      ? benchmarkCase.injectionSecurity.legitimateResponseText
      : benchmarkCase.responseText;
  return {
    criteria: Object.fromEntries(
      contract.criteria.map((criterion) => [
        criterion.key,
        {
          confidence: 0.9,
          evidenceQuotes: [evidenceText],
          evidenceStatus: 'FOUND',
          feedback: `Retour spécifique pour ${criterion.label}.`,
          levelKey: expected.get(criterion.key),
        },
      ]),
    ),
    overallFeedback: 'Retour général calme et actionnable.',
  };
}

function validProvider(cost = 0.001): CompositePanelProviderPort {
  return {
    execute: vi.fn(async ({ benchmarkCase, candidate }) => ({
      latencyMs: 10,
      modelSnapshot: candidate.modelId,
      output: outputFor(benchmarkCase.caseId),
      providerRequestId: `request-${benchmarkCase.caseId}`,
      providerRoute: candidate.requestProfile.routeProviders[0],
      status: 'VALID' as const,
      usage: {
        actualCostUsd: cost,
        costSource: 'ACTUAL' as const,
        inputTokens: 100,
        reasoningTokens: 0,
        visibleOutputTokens: 100,
      },
    })),
  };
}

const common = {
  caseSha256ById: Object.fromEntries(
    rawCorpus.cases.map((benchmarkCase) => [
      benchmarkCase.caseId,
      createHash('sha256')
        .update(JSON.stringify(benchmarkCase))
        .digest('hex'),
    ]),
  ),
  configuration,
  configurationSha256: digest(configurationBytes),
  corpus,
  corpusSha256: digest(corpusBytes),
  envelope,
  messagesFor: () => [{ content: 'prompt borné' }],
};

describe('V4-009B composite mini-panel runner', () => {
  it('refuses a corpus, configuration or case outside the frozen identity', () => {
    expect(() =>
      assertCompositePanelSources({ ...common, corpusSha256: 'a'.repeat(64) }),
    ).toThrow('COMPOSITE_PANEL_SOURCE_IDENTITY_MISMATCH');
    expect(() =>
      assertCompositePanelSources({
        ...common,
        configurationSha256: 'b'.repeat(64),
      }),
    ).toThrow('COMPOSITE_PANEL_SOURCE_IDENTITY_MISMATCH');
  });

  it('runs the twelve frozen cells, persists actual costs and produces a blind phase one', async () => {
    const provider = validProvider();
    const result = await runCompositeMiniPanel({ ...common, provider });

    expect(result.state.cells).toHaveLength(12);
    expect(result.state.stoppedReason).toBeNull();
    expect(result.state.attempts.every((attempt) => attempt.usage?.costSource === 'ACTUAL')).toBe(true);
    expect(new Set(result.state.attempts.map((attempt) => attempt.idempotencyKey)).size).toBe(
      result.state.attempts.length,
    );
    expect(JSON.stringify(result.blindReview)).not.toMatch(
      /candidateId|providerRoute|expectedCriteria|goldRationale|usageCost|caseId/,
    );
    expect(JSON.stringify(result.blindReviewMapping)).toContain(
      'benchmark-writing-successful',
    );
  });

  it('resumes without replaying completed cells or provider attempts', async () => {
    const firstProvider = validProvider();
    const completed = await runCompositeMiniPanel({
      ...common,
      provider: firstProvider,
    });
    const resumeProvider = validProvider();
    const resumed = await runCompositeMiniPanel({
      ...common,
      provider: resumeProvider,
      resume: completed.state,
    });
    expect(resumeProvider.execute).not.toHaveBeenCalled();
    expect(resumed.state.attempts).toHaveLength(completed.state.attempts.length);
  });

  it('stops on deterministic invalid output without a semantic retry', async () => {
    const provider: CompositePanelProviderPort = {
      execute: vi.fn(async () => ({
        errorCode: 'MODEL_OUTPUT_CONTRACT_INVALID',
        latencyMs: 5,
        status: 'INVALID' as const,
        usage: {
          actualCostUsd: 0.001,
          costSource: 'ACTUAL' as const,
          inputTokens: 10,
          reasoningTokens: 0,
          visibleOutputTokens: 10,
        },
      })),
    };
    const result = await runCompositeMiniPanel({ ...common, provider });
    expect(provider.execute).toHaveBeenCalledTimes(1);
    expect(result.state.cells[0]?.consolidation.state).toBe(
      'UNUSABLE_RELEASED',
    );
    expect(result.state.stoppedReason).toBe('PRIMARY_UNUSABLE');
    expect(result.blindReview).toMatchObject({
      entries: [
        {
          rejectedOutputs: [{ status: 'REJECTED' }],
        },
      ],
    });
  });

  it('permits one allowlisted transient retry only when its actual cost is reconciled', async () => {
    let calls = 0;
    const provider: CompositePanelProviderPort = {
      execute: vi.fn(async ({ benchmarkCase, candidate }) => {
        calls += 1;
        if (calls === 1) {
          return {
            errorCode: 'PROVIDER_HTTP_503',
            latencyMs: 5,
            status: 'ERROR' as const,
            usage: {
              actualCostUsd: 0.0001,
              costSource: 'ACTUAL' as const,
              inputTokens: 0,
              reasoningTokens: 0,
              visibleOutputTokens: 0,
            },
          };
        }
        return {
          latencyMs: 10,
          modelSnapshot: candidate.modelId,
          output: outputFor(benchmarkCase.caseId),
          providerRoute: candidate.requestProfile.routeProviders[0],
          status: 'VALID' as const,
          usage: {
            actualCostUsd: 0.001,
            costSource: 'ACTUAL' as const,
            inputTokens: 10,
            reasoningTokens: 0,
            visibleOutputTokens: 10,
          },
        };
      }),
    };
    const result = await runCompositeMiniPanel({ ...common, provider });
    expect(result.state.attempts.slice(0, 2).map((attempt) => attempt.status)).toEqual([
      'ERROR',
      'VALID',
    ]);
  });

  it('fails closed when actual provider cost is unavailable', async () => {
    const provider: CompositePanelProviderPort = {
      execute: vi.fn(async ({ benchmarkCase }) => ({
        latencyMs: 5,
        output: outputFor(benchmarkCase.caseId),
        status: 'VALID' as const,
        usage: {
          costSource: 'ESTIMATED' as const,
          inputTokens: 10,
          reasoningTokens: 0,
          visibleOutputTokens: 10,
        },
      })),
    };
    const result = await runCompositeMiniPanel({ ...common, provider });
    expect(result.state.attempts[0]).toMatchObject({
      errorCode: 'COST_RECONCILIATION_REQUIRED',
      status: 'ERROR',
    });
    expect(result.state.stoppedReason).toBe('PRIMARY_UNUSABLE');
  });

  it('computes a positive role-specific conservative preflight', () => {
    const primary = configuration.candidates.find(
      (candidate) => candidate.candidateId === 'mistral-medium-3-5-openrouter',
    );
    const verifier = configuration.candidates.find(
      (candidate) =>
        candidate.candidateId === 'claude-sonnet-4-6-openrouter-anthropic',
    );
    if (!primary || !verifier) throw new Error('TEST_CANDIDATE_NOT_FOUND');
    const primaryCost = estimateCompositePanelWorstCaseUsd({
      candidate: primary,
      envelope,
      messages: [{ content: 'x'.repeat(300) }],
      role: 'PRIMARY',
    });
    const verifierCost = estimateCompositePanelWorstCaseUsd({
      candidate: verifier,
      envelope,
      messages: [{ content: 'x'.repeat(300) }],
      role: 'TARGETED_VERIFIER',
    });
    expect(primaryCost).toBeGreaterThan(0);
    expect(verifierCost).toBeGreaterThan(primaryCost);
  });
});
