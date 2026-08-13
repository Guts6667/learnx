import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import {
  findBenchmarkContract,
  parseCorrectionBenchmarkConfiguration,
  parseCorrectionBenchmarkCorpus,
} from '@/lib/ai-correction-benchmark';

import type { CompositePanelProviderPort } from './composite-panel-runner';
import { runGeminiPanel } from './gemini-panel-runner';
import { geminiPanelManifestSchema } from './gemini-panel-validation';

const corpus = parseCorrectionBenchmarkCorpus(
  JSON.parse(readFileSync('benchmarks/ai-correction/corpus.v1.json', 'utf8')),
);
const configuration = parseCorrectionBenchmarkConfiguration(
  JSON.parse(readFileSync('benchmarks/ai-correction/benchmark.v1.json', 'utf8')),
);
const manifest = {
  ...geminiPanelManifestSchema.parse(
    JSON.parse(
      readFileSync(
        'benchmarks/ai-correction/gemini/v4-009c-run-manifest.json',
        'utf8',
      ),
    ),
  ),
  authorization: 'GRANTED' as const,
};

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
  const evidence = benchmarkCase.injectionSecurity?.legitimateResponseText ?? benchmarkCase.responseText;
  return {
    criteria: Object.fromEntries(
      contract.criteria.map((criterion) => [
        criterion.key,
        {
          confidence: 0.9,
          evidenceQuotes: [evidence],
          evidenceStatus: 'FOUND',
          feedback: `Retour pour ${criterion.label}.`,
          levelKey: expected.get(criterion.key),
        },
      ]),
    ),
    overallFeedback: 'Retour calme et actionnable.',
  };
}

function provider(): CompositePanelProviderPort {
  return {
    execute: vi.fn(async ({ benchmarkCase, candidate, idempotencyKey }) => ({
      latencyMs: 5,
      modelSnapshot: manifest.identity.modelSnapshot,
      output: outputFor(benchmarkCase.caseId),
      providerRequestId: `request-${idempotencyKey}`,
      providerRoute: candidate.requestProfile.routeProviders[0],
      status: 'VALID' as const,
      usage: {
        actualCostUsd: 0.001,
        costSource: 'ACTUAL' as const,
        inputTokens: 100,
        reasoningTokens: 10,
        visibleOutputTokens: 100,
      },
    })),
  };
}

const common = {
  configuration,
  corpus,
  manifest,
  messagesFor: ({ safetyEnvelope }: { safetyEnvelope: { segments: { responseText: string } } }) => [
    { content: safetyEnvelope.segments.responseText },
  ],
};

describe('V4-009C Gemini panel runner', () => {
  it('runs exactly twenty workflows and creates a chained append-only ledger', async () => {
    const fake = provider();
    const result = await runGeminiPanel({ ...common, provider: fake });
    expect(result.state.cells).toHaveLength(20);
    expect(fake.execute).toHaveBeenCalledTimes(20);
    expect(result.ledger).toHaveLength(40);
    expect(result.ledger.every((event, index) =>
      event.previousHash === (index === 0 ? null : result.ledger[index - 1]?.recordHash),
    )).toBe(true);
    expect(JSON.stringify(result.blindReview)).not.toMatch(
      /caseId|category|expectedCriteria|goldRationale|modelId|provider|costUsd|riskSignals/u,
    );
    expect(JSON.stringify(result.blindReviewMapping)).toContain(
      'benchmark-writing-successful',
    );
  });

  it('resumes a complete run with zero provider calls', async () => {
    const completed = await runGeminiPanel({ ...common, provider: provider() });
    const resumeProvider = provider();
    await runGeminiPanel({
      ...common,
      provider: resumeProvider,
      resume: { ledger: completed.ledger, state: completed.state },
    });
    expect(resumeProvider.execute).not.toHaveBeenCalled();
  });

  it('rejects a tampered ledger before any provider call', async () => {
    const completed = await runGeminiPanel({ ...common, provider: provider() });
    const resumeProvider = provider();
    const tampered = structuredClone(completed.ledger);
    if (tampered[1]) tampered[1].previousHash = 'bad';
    await expect(
      runGeminiPanel({
        ...common,
        provider: resumeProvider,
        resume: { ledger: tampered, state: completed.state },
      }),
    ).rejects.toThrow('GEMINI_PANEL_RESUME_INTEGRITY_FAILURE');
    expect(resumeProvider.execute).not.toHaveBeenCalled();
  });

  it('permits at most one allowlisted retry and counts its actual cost', async () => {
    let calls = 0;
    const retryProvider: CompositePanelProviderPort = {
      execute: vi.fn(async ({ benchmarkCase, candidate }) => {
        calls += 1;
        if (calls === 1) {
          return {
            errorCode: 'PROVIDER_HTTP_503',
            latencyMs: 5,
            status: 'ERROR' as const,
            usage: {
              actualCostUsd: 0.001,
              costSource: 'ACTUAL' as const,
              inputTokens: 10,
              reasoningTokens: 0,
              visibleOutputTokens: 0,
            },
          };
        }
        return {
          latencyMs: 5,
          modelSnapshot: manifest.identity.modelSnapshot,
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
    const result = await runGeminiPanel({ ...common, provider: retryProvider });
    expect(result.state.attempts).toHaveLength(21);
    expect(result.state.attempts.slice(0, 2).map((attempt) => attempt.status)).toEqual([
      'ERROR',
      'VALID',
    ]);
  });

  it('stops without retry when a structurally valid output leaks the canary', async () => {
    const leakingProvider: CompositePanelProviderPort = {
      execute: vi.fn(async ({ benchmarkCase, candidate }) => ({
        latencyMs: 5,
        modelSnapshot: manifest.identity.modelSnapshot,
        output: {
          ...(outputFor(benchmarkCase.caseId) as Record<string, unknown>),
          overallFeedback: configuration.controlPrompt.canary,
        },
        providerRoute: candidate.requestProfile.routeProviders[0],
        status: 'VALID' as const,
        usage: {
          actualCostUsd: 0.001,
          costSource: 'ACTUAL' as const,
          inputTokens: 10,
          reasoningTokens: 0,
          visibleOutputTokens: 10,
        },
      })),
    };
    const result = await runGeminiPanel({ ...common, provider: leakingProvider });
    expect(leakingProvider.execute).toHaveBeenCalledTimes(1);
    expect(result.state.stoppedReason).toBe('WORKFLOW_UNUSABLE');
    expect(result.state.attempts[0]).toMatchObject({
      errorCode: 'MODEL_CANARY_LEAK',
      status: 'INVALID',
    });
  });
});
