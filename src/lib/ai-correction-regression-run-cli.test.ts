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
  runRegressionAnalysis,
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
    path.join(REGRESSION_SOURCE, 'gate-policy.v5.json'),
    path.join(directory, 'gate-policy.v5.json'),
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
    // One line per primary attempt, plus the verifier's own priced calls: the
    // ledger is the run's bill, and the run pays two models. It used to hold
    // only the primary, which is how the envelope came to undercount.
    const ledgerLines = ledger
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { role: string });
    expect(ledgerLines.filter((line) => line.role === 'PRIMARY')).toHaveLength(
      outcome.attempts.length,
    );
    expect(
      ledgerLines.filter((line) => line.role === 'CHECKER').length,
    ).toBeGreaterThan(0);
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
    // mutation gate is red and the run cannot be eligible. The report says so
    // rather than implying success by omission.
    expect(outcome.evaluation?.promotionEligible).toBe(false);
    // Every declared gate reaches the table. Both evidence metrics are wired
    // (V4.5-127), so both are measured here rather than dropped as policy
    // errors; a gate missing from the table is a gate nobody can see was
    // skipped, which is how this one survived a whole paid run.
    const metrics = outcome.evaluation?.gates.map((gate) => gate.metric) ?? [];
    expect(metrics).toContain('evidenceHallucinationDelivered');
    expect(metrics).toContain('evidenceHallucinationAnyAttempt');
    expect(outcome.evaluation?.policyErrors.join(' ')).not.toContain(
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

describe('one convention, one verdict', () => {
  async function measuredDirectory(): Promise<string> {
    const directory = await scratchRegressionDirectory();
    await copyFile(
      path.join(REGRESSION_SOURCE, 'measured-costs.v1.json'),
      path.join(directory, 'measured-costs.v1.json'),
    );
    await copyFile(
      path.join(REGRESSION_SOURCE, 'checker-pricing.v1.json'),
      path.join(directory, 'checker-pricing.v1.json'),
    );
    return directory;
  }

  it('reaches the first dispatch when the authorised bound fits', async () => {
    const directory = await measuredDirectory();
    let dispatched = 0;
    const counting = () => {
      const inner = fakeExecutor();
      return async (call: Parameters<ReturnType<typeof fakeExecutor>>[0]) => {
        dispatched += 1;
        return inner(call);
      };
    };

    // Before this fix the runner derived a second bound under the conservative
    // convention and refused a plan the preflight had just authorised under the
    // measured one: two preflights, two verdicts, and a run that could not
    // start. Rayan hit it twice on 30 August, at 02:35 and 02:38.
    await runRegressionPool({
      arguments: [
        `--run-pool=${POOL_PATH}`,
        '--profile=smoke',
        '--supplier-cost-cap-usd=0.20',
      ],
      checker: CHECKER,
      configuration: configuration(),
      executeCandidate: counting(),
      identities: IDENTITIES,
      now: () => new Date('2026-08-30T05:00:00.000Z'),
      providerApiKey: 'offline-test-key',
      regressionDirectory: directory,
    });

    expect(dispatched).toBeGreaterThan(0);
  });

  it('refuses before any dispatch when the authorised bound does not fit', async () => {
    const directory = await measuredDirectory();
    let dispatched = 0;
    const counting = () => {
      const inner = fakeExecutor();
      return async (call: Parameters<ReturnType<typeof fakeExecutor>>[0]) => {
        dispatched += 1;
        return inner(call);
      };
    };

    await expect(
      runRegressionPool({
        arguments: [
          `--run-pool=${POOL_PATH}`,
          '--profile=reduced',
          '--supplier-cost-cap-usd=1',
        ],
        checker: CHECKER,
        configuration: configuration(),
        executeCandidate: counting(),
        identities: IDENTITIES,
        now: () => new Date('2026-08-30T05:30:00.000Z'),
        providerApiKey: 'offline-test-key',
        regressionDirectory: directory,
      }),
    ).rejects.toThrow(/EXCEEDS_CAP/);

    // A refusal must cost nothing: the point of refusing before the first call
    // is that a half-executed run spends real money and measures nothing.
    expect(dispatched).toBe(0);
  });
});

describe('the repetition pass dispatches at its offset', () => {
  it('buys observation 2 on a resume, not observation 1 again', async () => {
    // The 30 August top-up, third attempt. `repetitionOffset` reached
    // `pendingCellsFor`, which correctly reported 24 cells owing at repetition
    // 2, and never reached `runBenchmark`, which starts at 1. It dispatched 51
    // attempts on cells already bought, added no new cell, and cost 1.1307 USD.
    //
    // Both halves of V4.5-127 were tested and both were right. Nothing tested
    // the wire between them, so this test drives the whole CLI and looks at the
    // repetitions actually dispatched.
    const directory = await scratchRegressionDirectory();
    const dispatchedRepetitions: number[] = [];
    const recording = () => {
      const inner = fakeExecutor();
      return async (call: Parameters<ReturnType<typeof fakeExecutor>>[0]) => {
        dispatchedRepetitions.push(
          (call as unknown as { repetition: number }).repetition,
        );
        return inner(call);
      };
    };

    const first = await runRegressionPool({
      arguments: [
        `--run-pool=${POOL_PATH}`,
        '--profile=reduced',
        '--supplier-cost-cap-usd=100',
      ],
      checker: CHECKER,
      configuration: configuration(),
      executeCandidate: recording(),
      identities: IDENTITIES,
      now: () => new Date('2026-08-29T07:00:00.000Z'),
      providerApiKey: 'offline-test-key',
      regressionDirectory: directory,
    });

    // Production's starting state, reproduced: a directory holding repetition 1
    // and nothing else. Resuming a run that already bought every repetition
    // leaves nothing to dispatch, and an assertion over an empty list passes
    // whether the offset is wired or not — that is exactly the vacuous test
    // that let this defect reach a paid run.
    const firstAttempts = JSON.parse(
      await readFile(
        path.join(first.resultsDirectory, 'attempts.json'),
        'utf8',
      ),
    ) as { repetition: number }[];
    await writeFile(
      path.join(first.resultsDirectory, 'attempts.json'),
      `${JSON.stringify(
        firstAttempts.filter((attempt) => attempt.repetition === 1),
        null,
        2,
      )}\n`,
    );

    dispatchedRepetitions.length = 0;
    const resumed = await runRegressionPool({
      arguments: [
        `--run-pool=${POOL_PATH}`,
        '--profile=reduced',
        '--supplier-cost-cap-usd=100',
        `--resume=${first.resultsDirectory}`,
      ],
      checker: CHECKER,
      configuration: configuration(),
      executeCandidate: recording(),
      identities: IDENTITIES,
      now: () => new Date('2026-08-29T07:30:00.000Z'),
      providerApiKey: 'offline-test-key',
      regressionDirectory: directory,
    });

    // It must buy something, or the assertion below is vacuous.
    expect(dispatchedRepetitions.length).toBeGreaterThan(0);
    // None of it may be repetition 1: the pool pass bought that.
    expect(dispatchedRepetitions).not.toContain(1);
    // And it must buy everything the preflight said it owed. Without the offset
    // reaching the runner, the runner iterates from 1 and the pending cells at
    // the offset are simply never reached — the pass dispatches short, or in
    // production, where the budget had reduced it to a single repetition, not
    // at all. Counting what was bought against what was owed is what catches
    // that; asserting only "never repetition 1" passes on a pass that buys
    // nothing.
    expect(dispatchedRepetitions.length).toBe(resumed.pendingCells);
    // Drives the whole CLI twice over the 380-unit pool, like the heavier tests
    // above it. The default 5 s is a limit on this file's fast unit tests, not
    // a budget this one was ever inside.
  }, 60_000);
});

describe('the ledger carries both models (V4.5-127)', () => {
  it('writes the verifier\u2019s priced calls beside the primary\u2019s', async () => {
    // The verifier reconciled into the cap and reached no artefact the envelope
    // reads. `cost-reconciliation.json` said 5.4986 USD where `ledger.jsonl`
    // summed 5.3080: the 0.1906 difference was the verifier, tracked nowhere
    // the 14 USD envelope could see it.
    const directory = await scratchRegressionDirectory();
    const outcome = await runRegressionPool({
      arguments: EXECUTING_ARGUMENTS,
      checker: CHECKER,
      configuration: configuration(),
      executeCandidate: fakeExecutor(),
      identities: IDENTITIES,
      now: () => new Date('2026-08-29T09:00:00.000Z'),
      providerApiKey: 'offline-test-key',
      regressionDirectory: directory,
    });

    const lines = (
      await readFile(
        path.join(outcome.resultsDirectory, 'ledger.jsonl'),
        'utf8',
      )
    )
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as { costUsd: number; role: string });

    const checker = lines.filter((line) => line.role === 'CHECKER');
    expect(checker.length).toBeGreaterThan(0);
    expect(lines.filter((line) => line.role === 'PRIMARY').length).toBe(
      outcome.attempts.length,
    );
    // And the file now sums to what the run actually paid.
    const ledgerTotal = lines.reduce((total, line) => total + line.costUsd, 0);
    const primaryTotal = outcome.attempts.reduce(
      (total, attempt) => total + (attempt.usage?.actualCostUsd ?? 0),
      0,
    );
    expect(ledgerTotal).toBeGreaterThan(primaryTotal);
  });
});

describe('overlapping passes carry a resumed attempt once', () => {
  it('carries a resumed attempt forward once, not once per overlapping pass', async () => {
    // The repetition pass draws its cases from the pool pass, so both carried
    // the same resumed attempts forward and both pushed them. On 30 August that
    // wrote the 24 subset cases twice into attempts.json and the ledger, and
    // the ledger read 5.8161 USD where 4.6854 had been charged — money the
    // envelope would then have refused a later run over.
    const directory = await scratchRegressionDirectory();
    const first = await runRegressionPool({
      arguments: [
        `--run-pool=${POOL_PATH}`,
        '--profile=reduced',
        '--supplier-cost-cap-usd=100',
      ],
      checker: CHECKER,
      configuration: configuration(),
      executeCandidate: fakeExecutor(),
      identities: IDENTITIES,
      now: () => new Date('2026-08-29T08:00:00.000Z'),
      providerApiKey: 'offline-test-key',
      regressionDirectory: directory,
    });

    const resumed = await runRegressionPool({
      arguments: [
        `--run-pool=${POOL_PATH}`,
        '--profile=reduced',
        '--supplier-cost-cap-usd=100',
        `--resume=${first.resultsDirectory}`,
      ],
      checker: CHECKER,
      configuration: configuration(),
      executeCandidate: fakeExecutor(),
      identities: IDENTITIES,
      now: () => new Date('2026-08-29T08:30:00.000Z'),
      providerApiKey: 'offline-test-key',
      regressionDirectory: directory,
    });

    const persisted = JSON.parse(
      await readFile(
        path.join(resumed.resultsDirectory, 'attempts.json'),
        'utf8',
      ),
    ) as unknown[];
    const distinct = new Set(persisted.map((item) => JSON.stringify(item)));

    expect(persisted.length).toBe(distinct.size);
    expect(persisted.length).toBe(first.attempts.length);
  }, 60_000);
});

describe('a resume is priced against what the cap has left', () => {
  async function measuredDirectoryWithPriorSpend(
    priorSpendUsd: number,
  ): Promise<{
    directory: string;
    resumeDirectory: string;
  }> {
    const directory = await scratchRegressionDirectory();
    await copyFile(
      path.join(REGRESSION_SOURCE, 'measured-costs.v1.json'),
      path.join(directory, 'measured-costs.v1.json'),
    );
    await copyFile(
      path.join(REGRESSION_SOURCE, 'checker-pricing.v1.json'),
      path.join(directory, 'checker-pricing.v1.json'),
    );
    const first = await runRegressionPool({
      arguments: [
        `--run-pool=${POOL_PATH}`,
        '--profile=smoke',
        '--supplier-cost-cap-usd=100',
      ],
      checker: CHECKER,
      configuration: configuration(),
      executeCandidate: fakeExecutor(),
      identities: IDENTITIES,
      now: () => new Date('2026-08-29T06:00:00.000Z'),
      providerApiKey: 'offline-test-key',
      regressionDirectory: directory,
    });
    // The spend is real but the cells are not the ones the resumed profile
    // owes: this fixture is about inherited money, not inherited coverage.
    const attempts = JSON.parse(
      await readFile(
        path.join(first.resultsDirectory, 'attempts.json'),
        'utf8',
      ),
    ) as { caseId: string; usage: { actualCostUsd: number } }[];
    for (const [index, attempt] of attempts.entries()) {
      attempt.caseId = `spent-elsewhere-${index}`;
      attempt.usage.actualCostUsd = priorSpendUsd / attempts.length;
    }
    await writeFile(
      path.join(first.resultsDirectory, 'attempts.json'),
      `${JSON.stringify(attempts, null, 2)}\n`,
    );
    return { directory, resumeDirectory: first.resultsDirectory };
  }

  it('refuses before dispatch when the plan fits the cap but not the remainder', async () => {
    // The 30 August top-up: bound 3.3555 USD, cap 7 USD, and the plan declared
    // itself affordable — because the drop order weighed it against the whole
    // cap while the dispatch guard had already absorbed 4.6854 USD of resumed
    // spend. The run then died inside `runBenchmark` on
    // BENCHMARK_SUPPLIER_BUDGET_CONTINGENCY_REQUIRED, after the preflight had
    // said it fits. Two numbers, one cap, and the refusal arrived at the wrong
    // layer.
    const { directory, resumeDirectory } =
      await measuredDirectoryWithPriorSpend(0.05);
    let dispatched = 0;
    const counting = () => {
      const inner = fakeExecutor();
      return async (call: Parameters<ReturnType<typeof fakeExecutor>>[0]) => {
        dispatched += 1;
        return inner(call);
      };
    };

    // Smoke's bound is 0.0699 USD: under the cap of 0.10, over the 0.05 left.
    await expect(
      runRegressionPool({
        arguments: [
          `--run-pool=${POOL_PATH}`,
          '--profile=smoke',
          '--supplier-cost-cap-usd=0.10',
          `--resume=${resumeDirectory}`,
        ],
        checker: CHECKER,
        configuration: configuration(),
        executeCandidate: counting(),
        identities: IDENTITIES,
        now: () => new Date('2026-08-29T06:10:00.000Z'),
        providerApiKey: 'offline-test-key',
        regressionDirectory: directory,
      }),
    ).rejects.toThrow(/EXCEEDS_CAP/);

    expect(dispatched).toBe(0);
  });

  it('states the inherited spend and the remaining cap in the preflight', async () => {
    const { directory, resumeDirectory } =
      await measuredDirectoryWithPriorSpend(0.05);

    const outcome = await runRegressionPool({
      arguments: [
        `--run-pool=${POOL_PATH}`,
        '--profile=smoke',
        '--supplier-cost-cap-usd=100',
        `--resume=${resumeDirectory}`,
      ],
      checker: CHECKER,
      configuration: configuration(),
      executeCandidate: fakeExecutor(),
      identities: IDENTITIES,
      now: () => new Date('2026-08-29T06:20:00.000Z'),
      providerApiKey: 'offline-test-key',
      regressionDirectory: directory,
    });

    expect(outcome.priorActualSpendUsd).toBeCloseTo(0.05, 6);
    expect(outcome.remainingCapUsd).toBeCloseTo(99.95, 6);

    const preflight = JSON.parse(
      await readFile(
        path.join(outcome.resultsDirectory, 'budget-preflight.json'),
        'utf8',
      ),
    ) as { priorActualSpendUsd: number; remainingCapUsd: number };
    expect(preflight.priorActualSpendUsd).toBeCloseTo(0.05, 6);
    expect(preflight.remainingCapUsd).toBeCloseTo(99.95, 6);
  });

  it('leaves a fresh run judged against the whole cap', async () => {
    const directory = await scratchRegressionDirectory();
    const outcome = await runRegressionPool({
      arguments: [
        `--run-pool=${POOL_PATH}`,
        '--profile=smoke',
        '--supplier-cost-cap-usd=100',
      ],
      checker: CHECKER,
      configuration: configuration(),
      executeCandidate: fakeExecutor(),
      identities: IDENTITIES,
      now: () => new Date('2026-08-29T06:30:00.000Z'),
      providerApiKey: 'offline-test-key',
      regressionDirectory: directory,
    });

    expect(outcome.priorActualSpendUsd).toBe(0);
    expect(outcome.remainingCapUsd).toBe(100);
  });
});

describe('repetition offset (V4.5-127)', () => {
  it('produces observation 2 rather than re-running observation 1', () => {
    // The defect this fixes: repetitions are numbered from 1, so a pass given a
    // count where an offset was meant re-buys the cells an earlier pass already
    // covered. On 30 August that cost 24 duplicate cells (~0.50 USD) and left
    // the stability oracle with no second observation of anything.
    const pending = pendingCellsFor({
      candidateId: 'cand',
      cases: [{ caseId: 'a' }, { caseId: 'b' }],
      completed: new Set(),
      repetitionOffset: 2,
      repetitions: 1,
    });

    expect(pending.map((cell) => cell.repetition)).toEqual([2, 2]);
    expect(pending.some((cell) => cell.repetition === 1)).toBe(false);
  });

  it('covers 2..n when a pass asks for several further observations', () => {
    const pending = pendingCellsFor({
      candidateId: 'cand',
      cases: [{ caseId: 'a' }],
      completed: new Set(),
      repetitionOffset: 2,
      repetitions: 2,
    });

    expect(pending.map((cell) => cell.repetition)).toEqual([2, 3]);
  });

  it('still starts at 1 when no offset is given', () => {
    const pending = pendingCellsFor({
      candidateId: 'cand',
      cases: [{ caseId: 'a' }],
      completed: new Set(),
      repetitions: 2,
    });

    expect(pending.map((cell) => cell.repetition)).toEqual([1, 2]);
  });

  it('dispatches the subset at repetition 2 and never at 1', async () => {
    const directory = await scratchRegressionDirectory();
    const seen: number[] = [];

    await runRegressionPool({
      arguments: [
        `--run-pool=${POOL_PATH}`,
        '--profile=reduced',
        '--supplier-cost-cap-usd=100',
      ],
      checker: CHECKER,
      configuration: configuration(),
      executeCandidate: (() => {
        const inner = fakeExecutor();
        return async (call: Parameters<ReturnType<typeof fakeExecutor>>[0]) =>
          inner(call);
      })(),
      identities: IDENTITIES,
      now: () => new Date('2026-08-30T06:00:00.000Z'),
      onPassStart: (pass) => {
        if (pass.label === 'répétitions du sous-ensemble') {
          seen.push(pass.repetitionOffset ?? 1);
        }
      },
      providerApiKey: 'offline-test-key',
      regressionDirectory: directory,
    });

    expect(seen).toEqual([2]);
  }, 60_000);
});

describe('--analyse (V4.5-127)', () => {
  /**
   * The recovery path has to be a flag, not a script someone wrote once.
   *
   * On 30 August a run bought all 200 cells and died before writing a summary.
   * The analysis existed as a module, so recovering the measurement meant an
   * ad-hoc script in a scratch directory — fine that night, useless the next
   * time. These tests hold the flag to the two properties that matter: it
   * measures without dispatching, and it refuses a pool that is not the pool
   * the run used.
   */
  it('measures a results directory without dispatching anything', async () => {
    const directory = await scratchRegressionDirectory();
    let dispatches = 0;
    const inner = fakeExecutor();

    const run = await runRegressionPool({
      arguments: [
        `--run-pool=${POOL_PATH}`,
        '--profile=smoke',
        '--supplier-cost-cap-usd=100',
      ],
      checker: CHECKER,
      configuration: configuration(),
      executeCandidate: async (call: Parameters<typeof inner>[0]) => {
        dispatches += 1;
        return inner(call);
      },
      identities: IDENTITIES,
      now: () => new Date('2026-08-30T07:00:00.000Z'),
      providerApiKey: 'offline-test-key',
      regressionDirectory: directory,
    });

    expect(dispatches).toBeGreaterThan(0);
    const dispatchesAfterRun = dispatches;

    const { analysis } = await runRegressionAnalysis({
      arguments: [
        `--run-pool=${POOL_PATH}`,
        `--analyse=${run.resultsDirectory}`,
      ],
      regressionDirectory: directory,
    });

    // The whole point: analysing costs nothing.
    expect(dispatches).toBe(dispatchesAfterRun);
    expect(analysis.attempts.length).toBe(dispatchesAfterRun);
    expect(analysis.cellsObserved).toBeGreaterThan(0);
  }, 60_000);

  it('refuses a pool whose digest is not the one the run recorded', async () => {
    const directory = await scratchRegressionDirectory();
    const resultsDirectory = path.join(directory, 'results', 'fixture');
    await mkdir(resultsDirectory, { recursive: true });
    await writeFile(path.join(resultsDirectory, 'attempts.json'), '[]');
    await writeFile(
      path.join(resultsDirectory, 'summary.json'),
      JSON.stringify({ poolSha256Prefix: 'deadbeefdead' }),
    );

    await expect(
      runRegressionAnalysis({
        arguments: [`--run-pool=${POOL_PATH}`, '--analyse=fixture'],
        regressionDirectory: directory,
      }),
    ).rejects.toThrow('REGRESSION_ANALYSE_POOL_MISMATCH');
  });

  it('names the missing argument rather than reading an arbitrary directory', async () => {
    await expect(
      runRegressionAnalysis({ arguments: [`--run-pool=${POOL_PATH}`] }),
    ).rejects.toThrow('REGRESSION_ANALYSE_DIRECTORY_REQUIRED');
  });
});

describe('results-directory resolution (V4.5-127)', () => {
  /**
   * `--resume` resolved a bare name against the working directory while
   * `--analyse` resolved it under `results/`. The obvious spelling of the
   * top-up command — the one naming the run directory as the repository names
   * it — therefore died with ENOENT. Discovering a path convention is cheap in
   * a dry run and expensive in a command someone pastes to spend money.
   */
  it('resumes from a bare run name, as the repository spells it', async () => {
    const directory = await scratchRegressionDirectory();
    const inner = fakeExecutor();
    let dispatches = 0;

    const first = await runRegressionPool({
      arguments: [
        `--run-pool=${POOL_PATH}`,
        '--profile=smoke',
        '--supplier-cost-cap-usd=100',
      ],
      checker: CHECKER,
      configuration: configuration(),
      executeCandidate: async (call: Parameters<typeof inner>[0]) => {
        dispatches += 1;
        return inner(call);
      },
      identities: IDENTITIES,
      now: () => new Date('2026-08-30T08:00:00.000Z'),
      providerApiKey: 'offline-test-key',
      regressionDirectory: directory,
    });

    const dispatchesAfterFirst = dispatches;
    expect(dispatchesAfterFirst).toBeGreaterThan(0);

    const resumed = await runRegressionPool({
      arguments: [
        `--run-pool=${POOL_PATH}`,
        '--profile=smoke',
        '--supplier-cost-cap-usd=100',
        // The bare name, not a path.
        `--resume=${path.basename(first.resultsDirectory)}`,
      ],
      checker: CHECKER,
      configuration: configuration(),
      executeCandidate: async (call: Parameters<typeof inner>[0]) => {
        dispatches += 1;
        return inner(call);
      },
      identities: IDENTITIES,
      now: () => new Date('2026-08-30T08:30:00.000Z'),
      providerApiKey: 'offline-test-key',
      regressionDirectory: directory,
    });

    // It found the attempts, so it owes nothing and buys nothing. Had the bare
    // name failed to resolve, this would have thrown ENOENT; had it resolved to
    // an empty directory, it would have re-bought every cell.
    expect(resumed.pendingCells).toBe(0);
    expect(dispatches).toBe(dispatchesAfterFirst);
  }, 90_000);

  it('still honours an explicit path', async () => {
    const directory = await scratchRegressionDirectory();
    const missing = path.join(directory, 'nowhere');

    await expect(
      runRegressionPool({
        arguments: [
          `--run-pool=${POOL_PATH}`,
          '--profile=smoke',
          '--supplier-cost-cap-usd=100',
          `--resume=${missing}`,
        ],
        configuration: configuration(),
        identities: IDENTITIES,
        regressionDirectory: directory,
      }),
    ).rejects.toThrow(/ENOENT|attempts\.json/);
  });
});
