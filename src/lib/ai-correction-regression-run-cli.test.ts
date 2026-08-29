import { readFileSync } from 'node:fs';
import { copyFile, mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  parseCorrectionBenchmarkConfiguration,
  type CorrectionBenchmarkConfiguration,
  type CorrectionBenchmarkCorpus,
} from './ai-correction-benchmark.js';
import { runRegressionPool } from './ai-correction-regression-run-cli.js';
import type { RegressionCheckerPort } from './ai-correction-regression-run.js';

const REGRESSION_SOURCE = path.resolve('benchmarks/ai-correction/regression');
const POOL_PATH = path.join(REGRESSION_SOURCE, 'regression-pool.v1.json');

const IDENTITIES = {
  checkerModelId: 'mistralai/mistral-medium-3-5',
  primaryCandidateId: 'claude-sonnet-4-6-openrouter-anthropic',
  primaryModelId: 'anthropic/claude-sonnet-4.6',
};

/**
 * A regression directory the test owns, holding only the gate policy. The pool
 * is referenced by absolute path, so the committed artefacts are never written
 * to by a test run.
 */
async function scratchRegressionDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'regression-run-'));
  await copyFile(
    path.join(REGRESSION_SOURCE, 'gate-policy.v3.json'),
    path.join(directory, 'gate-policy.v3.json'),
  );
  return directory;
}

function configuration(): CorrectionBenchmarkConfiguration {
  const source = JSON.parse(
    readFileSync(
      path.resolve('benchmarks/ai-correction/benchmark.v1.json'),
      'utf8',
    ),
  ) as Record<string, unknown>;
  return parseCorrectionBenchmarkConfiguration({
    ...source,
    corpusId: 'learnx-regression-run',
    maxRetries: 0,
    repetitions: 2,
  });
}

/** Grades every criterion at the pool's expected level, offline. */
function fakeExecutor() {
  return async (call: {
    benchmarkCase: CorrectionBenchmarkCorpus['cases'][number];
    corpus: CorrectionBenchmarkCorpus;
  }) => {
    const contract = call.corpus.contracts.find(
      (candidate) =>
        candidate.contractKey === call.benchmarkCase.contractKey &&
        candidate.version === call.benchmarkCase.contractVersion,
    );
    if (!contract) throw new Error('fake: unknown contract');
    const quote = /^[^.!?]*[.!?]/
      .exec(call.benchmarkCase.responseText)?.[0]
      ?.trim();
    return {
      latencyMs: 11,
      modelSnapshot: 'fake-snapshot',
      output: {
        criteria: Object.fromEntries(
          contract.criteria.map((criterion) => [
            criterion.key,
            {
              confidence: 0.9,
              evidenceQuotes: [quote ?? call.benchmarkCase.responseText],
              evidenceStatus: 'FOUND' as const,
              feedback: 'Retour de test.',
              levelKey:
                call.benchmarkCase.expectedCriteria.find(
                  (expected) => expected.criterionKey === criterion.key,
                )?.levelKey ?? criterion.performanceLevels[0]?.key,
            },
          ]),
        ),
        overallFeedback: 'Retour global de test.',
      },
      providerRoute: 'fake-route',
      usage: {
        actualCostUsd: 0.0001,
        costSource: 'ACTUAL' as const,
        inputTokens: 90,
        reasoningTokens: 0,
        visibleOutputTokens: 40,
      },
    };
  };
}

const CHECKER: RegressionCheckerPort = {
  verify: async ({ criteria }) =>
    Object.fromEntries(
      criteria.map((criterion) => [criterion.criterionKey, 'AGREED' as const]),
    ),
};

const SAMPLE_ARGUMENTS = [
  `--run-pool=${POOL_PATH}`,
  '--supplier-cost-cap-usd=100',
];

describe('--run-pool', () => {
  it('plans and prices a run without contacting a provider', async () => {
    const directory = await scratchRegressionDirectory();

    const outcome = await runRegressionPool({
      arguments: [...SAMPLE_ARGUMENTS, '--dry-run'],
      configuration: configuration(),
      identities: IDENTITIES,
      now: () => new Date('2026-08-29T00:00:00.000Z'),
      regressionDirectory: directory,
    });

    expect(outcome.dryRun).toBe(true);
    expect(outcome.attempts).toEqual([]);
    expect(outcome.estimatedPrimaryUsd).toBeGreaterThan(0);
    // A dry run is not a run: it must not appear in the record of runs.
    expect(outcome.resultsDirectory).toContain('preflights');
    expect(await readdir(outcome.resultsDirectory)).toEqual([
      'budget-preflight.json',
    ]);
  });

  it('prices mutants once and the pool at its repetition count', async () => {
    const directory = await scratchRegressionDirectory();

    const outcome = await runRegressionPool({
      arguments: [...SAMPLE_ARGUMENTS, '--dry-run'],
      configuration: configuration(),
      identities: IDENTITIES,
      now: () => new Date('2026-08-29T00:00:01.000Z'),
      regressionDirectory: directory,
    });
    const preflight = JSON.parse(
      await readFile(
        path.join(outcome.resultsDirectory, 'budget-preflight.json'),
        'utf8',
      ),
    ) as {
      baselinePass: { primaryCallCount: number };
      mutantPass: { primaryCallCount: number };
    };

    // 120 pooled cases at 2 repetitions; 168 mutants once, because a mutant's
    // oracle is a direction rather than a distribution.
    expect(preflight.baselinePass.primaryCallCount).toBe(240);
    expect(preflight.mutantPass.primaryCallCount).toBe(168);
  });

  it('refuses to run without an explicit cost cap', async () => {
    const directory = await scratchRegressionDirectory();

    await expect(
      runRegressionPool({
        arguments: [`--run-pool=${POOL_PATH}`, '--dry-run'],
        configuration: configuration(),
        identities: IDENTITIES,
        regressionDirectory: directory,
      }),
    ).rejects.toThrow(/COST_CAP_REQUIRED/);
  });

  it('refuses an identity that is not the promoted one', async () => {
    const directory = await scratchRegressionDirectory();

    await expect(
      runRegressionPool({
        arguments: [...SAMPLE_ARGUMENTS, '--dry-run'],
        configuration: configuration(),
        identities: { ...IDENTITIES, primaryModelId: 'anthropic/claude-3.0' },
        regressionDirectory: directory,
      }),
    ).rejects.toThrow(/IDENTITY_MISMATCH/);
  });

  it('writes the five §7 artefacts when it actually runs', async () => {
    const directory = await scratchRegressionDirectory();

    const outcome = await runRegressionPool({
      arguments: SAMPLE_ARGUMENTS,
      checker: CHECKER,
      configuration: configuration(),
      executeCandidate: fakeExecutor(),
      identities: IDENTITIES,
      now: () => new Date('2026-08-29T01:00:00.000Z'),
      providerApiKey: 'offline-test-key',
      regressionDirectory: directory,
    });

    expect(outcome.dryRun).toBe(false);
    expect(outcome.resultsDirectory).toContain('results');
    expect((await readdir(outcome.resultsDirectory)).sort()).toEqual([
      'REPORT.md',
      'attempts.json',
      'budget-preflight.json',
      'ledger.jsonl',
      'summary.json',
    ]);

    const summary = JSON.parse(
      await readFile(
        path.join(outcome.resultsDirectory, 'summary.json'),
        'utf8',
      ),
    ) as {
      generatorVersion: string;
      heldOutSeed: string;
      heldOutSeedSource: string;
      poolSha256: string;
    };
    // The run records what a reader needs to regenerate its held-out set from
    // the results directory alone.
    expect(summary.heldOutSeed).toMatch(/^[0-9a-f]{64}$/);
    expect(summary.heldOutSeedSource).toBe('DERIVED');
    expect(summary.poolSha256).toBe(outcome.poolSha256);

    const ledger = await readFile(
      path.join(outcome.resultsDirectory, 'ledger.jsonl'),
      'utf8',
    );
    expect(ledger.trim().split('\n')).toHaveLength(outcome.attempts.length);
  });

  it('reports a green run as promotion-eligible only once every gate is wired', async () => {
    const directory = await scratchRegressionDirectory();

    const outcome = await runRegressionPool({
      arguments: SAMPLE_ARGUMENTS,
      checker: CHECKER,
      configuration: configuration(),
      executeCandidate: fakeExecutor(),
      identities: IDENTITIES,
      now: () => new Date('2026-08-29T02:00:00.000Z'),
      providerApiKey: 'offline-test-key',
      regressionDirectory: directory,
    });

    // The model graded every mutant at the unmutated expected level, so the
    // mutation gate is red — and evidenceHallucination is still unwired, which
    // on its own forbids promotion. A run today cannot be eligible, and the
    // report says so rather than implying success by omission.
    expect(outcome.evaluation?.promotionEligible).toBe(false);
    expect(outcome.evaluation?.policyErrors.join(' ')).toContain(
      'evidenceHallucination',
    );
    expect(outcome.report).toContain('**Promotion : refusée.**');
    expect(outcome.report).toContain('PARAGRAPH_SHUFFLE');
  });
});
