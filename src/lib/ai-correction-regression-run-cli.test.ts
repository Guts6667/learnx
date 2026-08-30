import { readFileSync } from 'node:fs';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  parseCorrectionBenchmarkConfiguration,
  type CorrectionBenchmarkConfiguration,
  type CorrectionBenchmarkCorpus,
} from './ai-correction-benchmark.js';
import {
  acquireRunLock,
  releaseRunLock,
} from './ai-correction-regression-envelope.js';
import {
  pendingCellsFor,
  runCheckerMeasurement,
  runRegressionPool,
} from './ai-correction-regression-run-cli.js';
import type { RegressionCheckerPort } from './ai-correction-regression-run.js';

const REGRESSION_SOURCE = path.resolve('benchmarks/ai-correction/regression');
const POOL_PATH = path.join(REGRESSION_SOURCE, 'regression-pool.v1.json');

const IDENTITIES = {
  checkerModelId: 'mistralai/mistral-medium-3-5',
  // The promoted identity's own policy: no retry.
  maxRetries: 0,
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
  verify: async ({ criteria }) => ({
    // A priced call: offline tests still reconcile a cost so the guard path is
    // exercised rather than skipped.
    costUsd: 0.00002,
    verdicts: Object.fromEntries(
      criteria.map((criterion) => [criterion.criterionKey, 'AGREED' as const]),
    ),
  }),
};

const SAMPLE_ARGUMENTS = [
  `--run-pool=${POOL_PATH}`,
  '--supplier-cost-cap-usd=100',
];

/**
 * The smoke profile for tests that execute rather than plan.
 *
 * Running the whole pool through a fake executor is ~380 units of real
 * filesystem and schema work, which under parallel load has exceeded the
 * default per-test timeout. These tests assert that artefacts are written and
 * gates evaluated, not how many cells ran, so the smallest executing profile
 * asserts the same thing without the flake.
 */
const EXECUTING_ARGUMENTS = [...SAMPLE_ARGUMENTS, '--profile=smoke'];

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
      passes: { cells: number; label: string; repetitions: number }[];
      profile: string;
    };
    const pool = preflight.passes.find((pass) => pass.label === 'pool complet');
    const mutants = preflight.passes.find((pass) => pass.label === 'mutants');

    expect(preflight.profile).toBe('full');
    // 144 pooled cases at 2 repetitions; 236 mutants once, because a mutant's
    // oracle is a direction rather than a distribution.
    expect(pool?.repetitions).toBe(2);
    expect(pool?.cells).toBe(288);
    expect(mutants?.repetitions).toBe(1);
    expect(mutants?.cells).toBe(236);
  });

  it('prices the checker inside the same bound as the primary model', async () => {
    const directory = await scratchRegressionDirectory();
    await copyFile(
      path.join(REGRESSION_SOURCE, 'checker-pricing.v1.json'),
      path.join(directory, 'checker-pricing.v1.json'),
    );

    const outcome = await runRegressionPool({
      arguments: [...SAMPLE_ARGUMENTS, '--dry-run'],
      configuration: configuration(),
      identities: IDENTITIES,
      now: () => new Date('2026-08-29T00:00:02.000Z'),
      regressionDirectory: directory,
    });
    const preflight = JSON.parse(
      await readFile(
        path.join(outcome.resultsDirectory, 'budget-preflight.json'),
        'utf8',
      ),
    ) as {
      checkerCost: { pricedInThisPreflight: boolean; worstCaseUsd: number };
      combinedWorstCaseUsd: number;
      primaryWorstCaseUsd: number;
    };

    // The cap governs the run, so the checker's share sits inside the bound
    // rather than beside it. Without the price file it would read as unpriced.
    expect(preflight.checkerCost.pricedInThisPreflight).toBe(true);
    expect(preflight.checkerCost.worstCaseUsd).toBeGreaterThan(0);
    expect(preflight.combinedWorstCaseUsd).toBeCloseTo(
      preflight.primaryWorstCaseUsd + preflight.checkerCost.worstCaseUsd,
      6,
    );
  });

  it('reports the checker as unpriced when no rate is recorded', async () => {
    const directory = await scratchRegressionDirectory();

    const outcome = await runRegressionPool({
      arguments: [...SAMPLE_ARGUMENTS, '--dry-run'],
      configuration: configuration(),
      identities: IDENTITIES,
      now: () => new Date('2026-08-29T00:00:03.000Z'),
      regressionDirectory: directory,
    });
    const preflight = JSON.parse(
      await readFile(
        path.join(outcome.resultsDirectory, 'budget-preflight.json'),
        'utf8',
      ),
    ) as { checkerCost: { pricedInThisPreflight: boolean } };

    // Saying "unpriced" is the honest state; reporting zero would read as free.
    expect(preflight.checkerCost.pricedInThisPreflight).toBe(false);
  });

  it('reports only the mutants a subset profile actually dispatched', async () => {
    const directory = await scratchRegressionDirectory();

    const outcome = await runRegressionPool({
      arguments: EXECUTING_ARGUMENTS,
      checker: CHECKER,
      configuration: configuration(),
      executeCandidate: fakeExecutor(),
      identities: IDENTITIES,
      now: () => new Date('2026-08-29T04:00:00.000Z'),
      providerApiKey: 'offline-test-key',
      regressionDirectory: directory,
    });
    const summary = JSON.parse(
      await readFile(
        path.join(outcome.resultsDirectory, 'summary.json'),
        'utf8',
      ),
    ) as { mutantCounts: Record<string, number> };

    // The smoke profile dispatches one baseline case and no mutants. Counting
    // the whole plan here printed 236 mutants under a heading reading
    // "exécutés", which told a reader the mutation and injection oracles had
    // run when nothing of the sort had happened.
    expect(
      Object.values(summary.mutantCounts).reduce(
        (total, count) => total + count,
        0,
      ),
    ).toBe(0);
    expect(outcome.report).toContain('Aucun mutant produit pour');
  });

  it('resumes an interrupted run at the next cell and never repays for a bought one', async () => {
    const directory = await scratchRegressionDirectory();
    let dispatches = 0;
    const counting = () => {
      const inner = fakeExecutor();
      return async (call: Parameters<ReturnType<typeof fakeExecutor>>[0]) => {
        dispatches += 1;
        return inner(call);
      };
    };

    // First run: reduced profile, interrupted by a cap that stops it partway.
    // Whatever it bought is on disk, because attempts persist as they arrive.
    const first = await runRegressionPool({
      arguments: [
        `--run-pool=${POOL_PATH}`,
        '--profile=smoke',
        '--supplier-cost-cap-usd=100',
      ],
      checker: CHECKER,
      configuration: configuration(),
      executeCandidate: counting(),
      identities: IDENTITIES,
      now: () => new Date('2026-08-29T05:00:00.000Z'),
      providerApiKey: 'offline-test-key',
      regressionDirectory: directory,
    });
    const firstDispatches = dispatches;
    const firstAttempts = JSON.parse(
      await readFile(
        path.join(first.resultsDirectory, 'attempts.json'),
        'utf8',
      ),
    ) as unknown[];

    expect(firstDispatches).toBeGreaterThan(0);
    expect(firstAttempts.length).toBe(firstDispatches);

    // Second run, resuming that directory: every cell is already bought, so it
    // must dispatch nothing and still carry the earlier attempts forward.
    dispatches = 0;
    const second = await runRegressionPool({
      arguments: [
        `--run-pool=${POOL_PATH}`,
        '--profile=smoke',
        '--supplier-cost-cap-usd=100',
        `--resume=${first.resultsDirectory}`,
      ],
      checker: CHECKER,
      configuration: configuration(),
      executeCandidate: counting(),
      identities: IDENTITIES,
      now: () => new Date('2026-08-29T05:10:00.000Z'),
      providerApiKey: 'offline-test-key',
      regressionDirectory: directory,
    });

    expect(dispatches).toBe(0);
    expect(second.attempts.length).toBe(firstAttempts.length);
  });

  it('computes the pending cells an interrupted run still owes', () => {
    const completed = new Set(['cand|cas-a|1', 'cand|cas-b|1']);
    const pending = pendingCellsFor({
      candidateId: 'cand',
      cases: [{ caseId: 'cas-a' }, { caseId: 'cas-b' }],
      completed,
      repetitions: 2,
    });

    // Repetition 1 of both cases is bought; only repetition 2 remains.
    expect(pending).toEqual([
      { attemptStart: 1, candidateId: 'cand', caseId: 'cas-a', repetition: 2 },
      { attemptStart: 1, candidateId: 'cand', caseId: 'cas-b', repetition: 2 },
    ]);
  });

  it('refuses to start while another run holds the lock', async () => {
    const directory = await scratchRegressionDirectory();
    // The pid must be a process that is genuinely alive, and this test's own
    // is the only one it can be sure of. An invented pid — 999999, say — is not
    // alive, so the run takes its lock over as stale and starts perfectly
    // happily: the test then passes while asserting nothing. That is how the
    // first version of this test was written, and it was green.
    await acquireRunLock({
      directory,
      pid: process.pid,
      resultsDirectory: '/results/other',
    });

    // Two concurrent runs each honour their own cap, so a pair is authorised
    // to spend twice the envelope. The lock is what stops a pasted command.
    await expect(
      runRegressionPool({
        arguments: EXECUTING_ARGUMENTS,
        checker: CHECKER,
        configuration: configuration(),
        executeCandidate: fakeExecutor(),
        identities: IDENTITIES,
        now: () => new Date('2026-08-30T00:00:00.000Z'),
        providerApiKey: 'offline-test-key',
        regressionDirectory: directory,
      }),
    ).rejects.toThrow(/ALREADY_ACTIVE/);

    await releaseRunLock(directory);
  });

  it('persists checker verdicts and reuses them instead of buying twice', async () => {
    const directory = await scratchRegressionDirectory();
    let verifyCalls = 0;
    const countingChecker = {
      verify: async ({ criteria }: Parameters<typeof CHECKER.verify>[0]) => {
        verifyCalls += 1;
        return {
          costUsd: 0.00002,
          verdicts: Object.fromEntries(
            criteria.map((criterion) => [
              criterion.criterionKey,
              'AGREED' as const,
            ]),
          ),
        };
      },
    };

    const first = await runRegressionPool({
      arguments: EXECUTING_ARGUMENTS,
      checker: countingChecker,
      configuration: configuration(),
      executeCandidate: fakeExecutor(),
      identities: IDENTITIES,
      now: () => new Date('2026-08-30T01:00:00.000Z'),
      providerApiKey: 'offline-test-key',
      regressionDirectory: directory,
    });
    const firstCalls = verifyCalls;
    const persisted = JSON.parse(
      await readFile(
        path.join(first.resultsDirectory, 'checker-verdicts.json'),
        'utf8',
      ),
    ) as { criterionKey: string; unitId: string; verdict: string }[];

    expect(firstCalls).toBeGreaterThan(0);
    expect(persisted.length).toBeGreaterThan(0);

    // Resuming reuses the recorded verdicts. Before V4.5-123 they lived only in
    // memory, so an interrupted run lost every checker oracle and recomputing
    // meant paying the verifier a second time.
    await runRegressionPool({
      arguments: [...EXECUTING_ARGUMENTS, `--resume=${first.resultsDirectory}`],
      checker: countingChecker,
      configuration: configuration(),
      executeCandidate: fakeExecutor(),
      identities: IDENTITIES,
      now: () => new Date('2026-08-30T01:10:00.000Z'),
      providerApiKey: 'offline-test-key',
      regressionDirectory: directory,
    });

    expect(verifyCalls).toBe(firstCalls);
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

  it('writes the §7 artefacts plus a provider reconciliation when it runs', async () => {
    const directory = await scratchRegressionDirectory();

    const outcome = await runRegressionPool({
      arguments: EXECUTING_ARGUMENTS,
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
      // Verdicts are written as they are bought, so an interrupted run keeps
      // its checker oracles instead of losing them to the analysis phase.
      'checker-verdicts.json',
      // Both sides of the bill: our ledger and the provider's own usage delta.
      'cost-reconciliation.json',
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
      arguments: EXECUTING_ARGUMENTS,
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

describe('--measure-checker', () => {
  it('buys only the verifier, replaying corrections already paid for', async () => {
    const directory = await scratchRegressionDirectory();

    // A completed run supplies the corrections; measuring the verifier must not
    // dispatch a single new primary call.
    const source = await runRegressionPool({
      arguments: EXECUTING_ARGUMENTS,
      checker: CHECKER,
      configuration: configuration(),
      executeCandidate: fakeExecutor(),
      identities: IDENTITIES,
      now: () => new Date('2026-08-30T02:00:00.000Z'),
      providerApiKey: 'offline-test-key',
      regressionDirectory: directory,
    });

    let checkerCalls = 0;
    const measurement = await runCheckerMeasurement({
      arguments: [
        `--run-pool=${POOL_PATH}`,
        `--measure-checker=${source.resultsDirectory}`,
        '--limit=5',
        '--supplier-cost-cap-usd=1',
      ],
      checker: {
        verify: async ({ criteria }) => {
          checkerCalls += 1;
          return {
            costUsd: 0.001,
            verdicts: Object.fromEntries(
              criteria.map((criterion) => [
                criterion.criterionKey,
                'AGREED' as const,
              ]),
            ),
          };
        },
      },
      identities: IDENTITIES,
      now: () => new Date('2026-08-30T02:30:00.000Z'),
      regressionDirectory: directory,
    });

    expect(checkerCalls).toBeGreaterThan(0);
    expect(measurement.callsMade).toBe(checkerCalls);
    expect(measurement.spentUsd).toBeCloseTo(checkerCalls * 0.001, 6);

    // The real property: no primary call was bought. A counter would have been
    // vacuous — nothing in this path can increment one — so the evidence is
    // that the measurement wrote no attempts of its own, and the corrections it
    // replayed are still exactly the ones the source run paid for.
    const produced = await readdir(measurement.resultsDirectory);
    expect(produced).not.toContain('attempts.json');
    expect(produced.sort()).toEqual([
      'checker-cost-measurement.json',
      'checker-verdicts.json',
      'ledger.jsonl',
    ]);
  });

  it('writes a ledger so envelope accounting can see what it spent', async () => {
    const directory = await scratchRegressionDirectory();
    const source = await runRegressionPool({
      arguments: EXECUTING_ARGUMENTS,
      checker: CHECKER,
      configuration: configuration(),
      executeCandidate: fakeExecutor(),
      identities: IDENTITIES,
      now: () => new Date('2026-08-30T03:00:00.000Z'),
      providerApiKey: 'offline-test-key',
      regressionDirectory: directory,
    });

    const measurement = await runCheckerMeasurement({
      arguments: [
        `--run-pool=${POOL_PATH}`,
        `--measure-checker=${source.resultsDirectory}`,
        '--limit=3',
        '--supplier-cost-cap-usd=1',
      ],
      checker: CHECKER,
      identities: IDENTITIES,
      now: () => new Date('2026-08-30T03:30:00.000Z'),
      regressionDirectory: directory,
    });

    // Without a ledger the spend lives only in a bespoke artefact nothing else
    // reads, and the envelope guard cannot see money it actually spent.
    const ledger = await readFile(
      path.join(measurement.resultsDirectory, 'ledger.jsonl'),
      'utf8',
    );
    const line = JSON.parse(ledger.trim()) as {
      costSource: string;
      costUsd: number;
    };
    expect(line.costSource).toBe('ACTUAL');
    expect(line.costUsd).toBeCloseTo(measurement.spentUsd, 6);
  });

  it('refuses a source directory with no usable correction', async () => {
    const directory = await scratchRegressionDirectory();
    const empty = path.join(directory, 'results', '2026-08-30T04-00-00-000Z');
    await mkdir(empty, { recursive: true });
    await writeFile(path.join(empty, 'attempts.json'), '[]', 'utf8');

    await expect(
      runCheckerMeasurement({
        arguments: [
          `--run-pool=${POOL_PATH}`,
          `--measure-checker=${empty}`,
          '--supplier-cost-cap-usd=1',
        ],
        checker: CHECKER,
        identities: IDENTITIES,
        regressionDirectory: directory,
      }),
    ).rejects.toThrow(/NO_ATTEMPTS/);
  });
});
