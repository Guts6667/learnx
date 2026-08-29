/**
 * `--run-pool` — the regression suite's execution entry point (V4.5-120 step 4,
 * spec §4 and §7).
 *
 * This is the command V4.5-121 runs under its authorised budget. Everything
 * costly about it is refused unless stated explicitly:
 *
 * - the identities are **pinned**. The runner accepts only the promoted primary
 *   and checker; any other candidate is an error, not a warning, because a run
 *   that measured a different model cannot be evidence for promoting this one;
 * - `--supplier-cost-cap-usd` is **mandatory**. There is no default cap, since a
 *   default is a number nobody decided;
 * - `--dry-run` performs the whole plan, preflight and artefact layout without
 *   a single provider call, so the shape of a paid run can be inspected for
 *   free.
 *
 * The identities themselves are injected rather than imported: `src/lib` never
 * imports `src/server`, so the composition root (the runner script) supplies
 * `PROMOTED_*_IDENTITY`. Only the wiring point moves; the check is real.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { CorrectionBenchmarkConfiguration } from './ai-correction-benchmark.js';
import type { BenchmarkAttempt } from './ai-correction-benchmark-artifacts.js';
import {
  buildBenchmarkSupplierBudgetPreflight,
  runBenchmark,
  type BenchmarkSupplierBudgetPreflight,
  type CandidateExecutor,
} from './ai-correction-benchmark-runner.js';
import { SupplierBudgetGuard } from './ai-benchmark-supplier-budget.js';
import {
  evaluateRegressionGates,
  parseRegressionGatePolicy,
  type RegressionGateEvaluation,
} from './ai-correction-regression-gates.js';
import {
  computeRegressionMetrics,
  type RegressionMetrics,
} from './ai-correction-regression-metrics.js';
import {
  deriveHeldOutSeed,
  REGRESSION_MUTANT_GENERATOR_VERSION,
} from './ai-correction-regression-mutants.js';
import { renderRegressionReport } from './ai-correction-regression-report.js';
import {
  computeRunSecurityRates,
  countMutantsByKind,
  deriveRegressionObservations,
  partitionObservations,
  planRegressionRun,
  summarizeConfidence,
  type RegressionCheckerPort,
  type RegressionRunPlan,
} from './ai-correction-regression-run.js';

/** What a `--run-pool` invocation produced, paid or dry. */
export type RegressionRunOutcome = {
  attempts: BenchmarkAttempt[];
  dryRun: boolean;
  /** Worst-case primary spend across both passes, before retries. */
  estimatedPrimaryUsd: number;
  evaluation?: RegressionGateEvaluation;
  metrics?: RegressionMetrics;
  paraphraseRefusals: { caseId: string; reason: string }[];
  plan: RegressionRunPlan;
  poolSha256: string;
  preflight: BenchmarkSupplierBudgetPreflight;
  report?: string;
  resultsDirectory: string;
  runStartedAt: string;
};
import {
  checkParaphraseCacheEntry,
  parseParaphraseCacheEntry,
  paraphraseCachePath,
} from './ai-correction-regression-paraphrase.js';
import {
  loadRegressionSource,
  parseRegressionPool,
  sha256Hex,
  type LoadedRegressionSource,
  type RegressionPool,
} from './ai-correction-regression-pool.js';
import {
  readCliOption,
  regressionDirectory,
  resolvePoolPath,
  defaultPoolFileName,
} from './ai-correction-regression-cli.js';

/** The promoted identities a regression run is allowed to measure. */
export type RegressionPinnedIdentities = {
  checkerModelId: string;
  primaryCandidateId: string;
  primaryModelId: string;
};

export class RegressionRunError extends Error {}

/**
 * Rejects any candidate that is not the promoted primary.
 *
 * Spec §4: "Le runner refuse toute autre identité." A mismatch throws rather
 * than filtering the candidate list quietly — silently running a subset is how
 * a run ends up attributed to a model it never used.
 */
export function selectPinnedCandidate(input: {
  configuration: CorrectionBenchmarkConfiguration;
  identities: RegressionPinnedIdentities;
}): CorrectionBenchmarkConfiguration['candidates'][number] {
  const candidate = input.configuration.candidates.find(
    (item) => item.candidateId === input.identities.primaryCandidateId,
  );
  if (!candidate) {
    throw new RegressionRunError(
      `REGRESSION_RUN_IDENTITY_ABSENT: la configuration ne contient pas ${input.identities.primaryCandidateId}.`,
    );
  }
  if (candidate.modelId !== input.identities.primaryModelId) {
    throw new RegressionRunError(
      `REGRESSION_RUN_IDENTITY_MISMATCH: ${input.identities.primaryCandidateId} pointe sur ${candidate.modelId}, pas sur ${input.identities.primaryModelId}.`,
    );
  }
  return candidate;
}

/** Parses and validates the mandatory supplier cost cap. */
export function parseSupplierCostCap(arguments_: string[]): number {
  const raw = readCliOption(arguments_, 'supplier-cost-cap-usd');
  if (raw === undefined) {
    throw new RegressionRunError(
      'REGRESSION_RUN_COST_CAP_REQUIRED: --supplier-cost-cap-usd est obligatoire ; il n’existe aucun plafond par défaut.',
    );
  }
  const cap = Number.parseFloat(raw);
  if (!Number.isFinite(cap) || cap <= 0) {
    throw new RegressionRunError(`REGRESSION_RUN_COST_CAP_INVALID: ${raw}.`);
  }
  return cap;
}

export type ParaphraseCacheLoad = {
  /** Entries usable for this run, keyed by pool case identifier. */
  paraphrases: Map<string, string>;
  /** Cached entries refused, with the reason, for the report. */
  refusals: { caseId: string; reason: string }[];
};

/**
 * Loads the frozen paraphrase cache for a pool version.
 *
 * A missing entry is normal and silent — the cache is populated by a paid run,
 * and most pools will have none. A *present but stale* entry is loud: it means
 * a corpus or the generator moved under a cached rewrite, and using it would
 * compare the run against a paraphrase of text that no longer exists.
 */
export async function loadParaphraseCache(input: {
  caseIds: string[];
  poolId: string;
  regressionDirectory: string;
  responseTextByCaseId: Map<string, string>;
}): Promise<ParaphraseCacheLoad> {
  const paraphrases = new Map<string, string>();
  const refusals: { caseId: string; reason: string }[] = [];

  for (const caseId of input.caseIds) {
    const filePath = path.join(
      input.regressionDirectory,
      paraphraseCachePath({ caseId, poolId: input.poolId }),
    );
    let raw: string;
    try {
      raw = await readFile(filePath, 'utf8');
    } catch {
      continue;
    }
    const responseText = input.responseTextByCaseId.get(caseId);
    if (responseText === undefined) continue;

    try {
      const entry = parseParaphraseCacheEntry(JSON.parse(raw) as unknown);
      const verdict = checkParaphraseCacheEntry({
        caseId,
        entry,
        poolId: input.poolId,
        responseText,
      });
      if (verdict.usable) {
        paraphrases.set(caseId, entry.paraphraseText);
      } else {
        refusals.push({ caseId, reason: verdict.reason });
      }
    } catch (error) {
      refusals.push({
        caseId,
        reason: `Entrée de cache illisible : ${(error as Error).message}`,
      });
    }
  }

  return { paraphrases, refusals };
}

/** Loads the pool and its pinned sources for a run. */
async function loadPoolForRun(arguments_: string[]): Promise<{
  pool: RegressionPool;
  poolPath: string;
  poolSha256: string;
  sources: Map<string, LoadedRegressionSource>;
}> {
  const poolPath = resolvePoolPath(
    readCliOption(arguments_, 'run-pool') ?? defaultPoolFileName,
  );
  const raw = await readFile(poolPath);
  const pool = parseRegressionPool(JSON.parse(raw.toString('utf8')) as unknown);
  const sources = new Map<string, LoadedRegressionSource>();
  for (const source of pool.sources) {
    sources.set(
      source.path,
      loadRegressionSource(
        await readFile(path.resolve(path.dirname(poolPath), source.path)),
      ),
    );
  }
  return { pool, poolPath, poolSha256: sha256Hex(raw), sources };
}

/**
 * The append-only results directory of spec §7.
 *
 * Named by the run's ISO start instant, so a rerun never overwrites an earlier
 * one. Creating it with `recursive: false` at the leaf makes a collision an
 * error rather than a silent merge of two runs' artefacts.
 *
 * A dry run writes to `preflights/` instead: `results/` is the record of runs
 * that actually happened, and a directory there must never be a plan nobody
 * executed.
 */
async function createResultsDirectory(input: {
  /** A dry run lands in `preflights/`, never in the record of real runs. */
  dryRun?: boolean;
  regressionDirectory: string;
  runStartedAt: string;
}): Promise<string> {
  const directory = path.join(
    input.regressionDirectory,
    input.dryRun ? 'preflights' : 'results',
    input.runStartedAt.replace(/[:.]/g, '-'),
  );
  await mkdir(path.dirname(directory), { recursive: true });
  await mkdir(directory);
  return directory;
}

/** Writes one artefact of the results directory. */
async function writeRunArtifact(input: {
  content: string;
  directory: string;
  fileName: string;
}): Promise<string> {
  const filePath = path.join(input.directory, input.fileName);
  await writeFile(filePath, input.content, 'utf8');
  return filePath;
}

/** Serialises attempts as the run's append-only ledger, one JSON per line. */
export function renderLedger(attempts: BenchmarkAttempt[]): string {
  return attempts
    .map((attempt) =>
      JSON.stringify({
        attempt: attempt.attempt,
        candidateId: attempt.candidateId,
        caseId: attempt.caseId,
        costUsd: attempt.usage?.actualCostUsd ?? null,
        costSource: attempt.usage?.costSource ?? null,
        errorCode: attempt.errorCode ?? null,
        latencyMs: attempt.latencyMs,
        modelId: attempt.modelId,
        providerRoute: attempt.providerRoute ?? null,
        repetition: attempt.repetition,
        status: attempt.status,
      }),
    )
    .join('\n')
    .concat('\n');
}

/**
 * Executes the regression suite end to end and writes the §7 artefacts.
 *
 * Every costly collaborator is injected: the provider executor, the checker and
 * the pinned identities. That is what lets the whole path run offline in tests
 * and lets V4.5-121 be "swap the executor" rather than "discover the wiring
 * under a 3 USD cap".
 */
export async function runRegressionPool(input: {
  arguments: string[];
  checker?: RegressionCheckerPort;
  /** Absent means a dry run: plan and preflight, no provider call. */
  executeCandidate?: CandidateExecutor;
  configuration: CorrectionBenchmarkConfiguration;
  identities: RegressionPinnedIdentities;
  now?: () => Date;
  regressionDirectory?: string;
}): Promise<RegressionRunOutcome> {
  const dryRun = input.arguments.includes('--dry-run');
  const supplierCostCapUsd = parseSupplierCostCap(input.arguments);
  const candidate = selectPinnedCandidate({
    configuration: input.configuration,
    identities: input.identities,
  });
  const directory = input.regressionDirectory ?? regressionDirectory;
  const runStartedAt = (input.now?.() ?? new Date()).toISOString();

  const { pool, poolSha256, sources } = await loadPoolForRun(input.arguments);
  const responseTextByCaseId = new Map<string, string>();
  for (const poolCase of pool.cases) {
    const sourceCase = sources
      .get(poolCase.sourcePath)
      ?.corpus.cases.find(
        (candidateCase) => candidateCase.caseId === poolCase.sourceCaseId,
      );
    if (sourceCase) {
      responseTextByCaseId.set(poolCase.caseId, sourceCase.responseText);
    }
  }

  const cache = await loadParaphraseCache({
    caseIds: pool.cases.map((poolCase) => poolCase.caseId),
    poolId: pool.poolId,
    regressionDirectory: directory,
    responseTextByCaseId,
  });

  const plan = planRegressionRun({
    paraphrases: cache.paraphrases,
    pool,
    sources,
  });

  const policy = parseRegressionGatePolicy(
    JSON.parse(
      await readFile(path.join(directory, 'gate-policy.v3.json'), 'utf8'),
    ) as unknown,
  );

  // Spec §4 prices the two halves differently: the pool is repeated to measure
  // stability, mutants are executed once because their oracle is a direction,
  // not a distribution. Pricing and running them together would triple the
  // mutant bill for no added signal.
  const { baselineCases, mutantCases } = splitPlanCases(plan);
  const preflight = buildBenchmarkSupplierBudgetPreflight({
    actualSpentUsd: 0,
    candidates: [candidate],
    cases: baselineCases,
    configuration: input.configuration,
    corpus: plan.corpus,
    maxRetries: input.configuration.maxRetries,
    repetitions: input.configuration.repetitions,
    supplierCostCapUsd,
  });
  const mutantPreflight = buildBenchmarkSupplierBudgetPreflight({
    actualSpentUsd: 0,
    candidates: [candidate],
    cases: mutantCases,
    configuration: input.configuration,
    corpus: plan.corpus,
    maxRetries: input.configuration.maxRetries,
    repetitions: 1,
    supplierCostCapUsd,
  });

  const willExecute = !dryRun && input.executeCandidate !== undefined;
  const resultsDirectory = await createResultsDirectory({
    dryRun: !willExecute,
    regressionDirectory: directory,
    runStartedAt,
  });
  await writeRunArtifact({
    content: `${JSON.stringify(
      {
        baselinePass: preflight,
        combinedPrimaryWorstCaseUsd:
          preflight.primaryWorstCaseUsd + mutantPreflight.primaryWorstCaseUsd,
        mutantPass: mutantPreflight,
        supplierCostCapUsd,
      },
      null,
      2,
    )}\n`,
    directory: resultsDirectory,
    fileName: 'budget-preflight.json',
  });

  if (dryRun || !input.executeCandidate) {
    // The plan, its cost bound and the artefact layout, for free. Nothing here
    // has spoken to a provider.
    return {
      attempts: [],
      dryRun: true,
      estimatedPrimaryUsd:
        preflight.primaryWorstCaseUsd + mutantPreflight.primaryWorstCaseUsd,
      paraphraseRefusals: cache.refusals,
      plan,
      poolSha256,
      preflight,
      resultsDirectory,
      runStartedAt,
    };
  }

  // One guard across both passes: the cap is on the run, not on each half.
  const guard = new SupplierBudgetGuard(supplierCostCapUsd);
  const attempts = [
    ...(await runBenchmark({
      candidates: [candidate],
      cases: baselineCases,
      configuration: input.configuration,
      corpus: plan.corpus,
      executeCandidate: input.executeCandidate,
      repetitions: input.configuration.repetitions,
      supplierBudget: guard,
    })),
    ...(await runBenchmark({
      candidates: [candidate],
      cases: mutantCases,
      configuration: input.configuration,
      corpus: plan.corpus,
      executeCandidate: input.executeCandidate,
      repetitions: 1,
      supplierBudget: guard,
    })),
  ];

  const observations = await deriveRegressionObservations({
    attempts,
    ...(input.checker ? { checker: input.checker } : {}),
    familyScientificallyValidated: true,
    plan,
  });
  const { baselines, mutants } = partitionObservations(observations);
  const metrics = computeRegressionMetrics({
    baselines,
    mutants,
    scales: plan.scales,
  });
  const security = computeRunSecurityRates({ attempts, observations, plan });
  const evaluation = evaluateRegressionGates({
    metrics: { ...metrics, ...security },
    policy,
  });

  const heldOutSeed = deriveHeldOutSeed({
    gatePolicyVersion: policy.policyVersion,
    generatorVersion: REGRESSION_MUTANT_GENERATOR_VERSION,
    poolSha256,
  });

  const report = renderRegressionReport({
    confidence: summarizeConfidence(observations),
    costs: {
      actualCostUsd: guard.actualSpentUsd,
      // The preflight's own worst-case envelope: primary calls, their
      // retries and the bounded guard passes. Reported as the estimate the
      // run was authorised against, next to what it actually spent.
      estimatedCostUsd:
        preflight.primaryWorstCaseUsd + mutantPreflight.primaryWorstCaseUsd,
      p50CostUsdPerCorrection: null,
      p50LatencyMs: percentile(attempts, 0.5),
      p90CostUsdPerCorrection: null,
      p90LatencyMs: percentile(attempts, 0.9),
    },
    evaluation,
    identity: {
      checkerIdentity: input.identities.checkerModelId,
      gatePolicyVersion: policy.policyVersion,
      generatorVersion: REGRESSION_MUTANT_GENERATOR_VERSION,
      heldOutSeed,
      heldOutSeedSource: 'DERIVED',
      poolId: pool.poolId,
      poolSha256,
      primaryIdentity: input.identities.primaryCandidateId,
      profile: readCliOption(input.arguments, 'profile') ?? 'full',
      repetitions: input.configuration.repetitions,
      runStartedAt,
    },
    metrics,
    mutantCounts: countMutantsByKind(plan),
  });

  await writeRunArtifact({
    content: `${JSON.stringify(attempts, null, 2)}\n`,
    directory: resultsDirectory,
    fileName: 'attempts.json',
  });
  await writeRunArtifact({
    content: `${JSON.stringify(
      {
        evaluation,
        heldOutSeed,
        heldOutSeedSource: 'DERIVED',
        metrics,
        paraphraseRefusals: cache.refusals,
        poolId: pool.poolId,
        poolSha256,
        generatorVersion: REGRESSION_MUTANT_GENERATOR_VERSION,
        gatePolicyVersion: policy.policyVersion,
        mutantCounts: countMutantsByKind(plan),
        runStartedAt,
        security,
      },
      null,
      2,
    )}\n`,
    directory: resultsDirectory,
    fileName: 'summary.json',
  });
  await writeRunArtifact({
    content: renderLedger(attempts),
    directory: resultsDirectory,
    fileName: 'ledger.jsonl',
  });
  await writeRunArtifact({
    content: report,
    directory: resultsDirectory,
    fileName: 'REPORT.md',
  });

  return {
    attempts,
    dryRun: false,
    estimatedPrimaryUsd:
      preflight.primaryWorstCaseUsd + mutantPreflight.primaryWorstCaseUsd,
    evaluation,
    metrics,
    paraphraseRefusals: cache.refusals,
    plan,
    poolSha256,
    preflight,
    report,
    resultsDirectory,
    runStartedAt,
  };
}

/** Baseline cases (repeated) and mutant cases (executed once). */
function splitPlanCases(plan: RegressionRunPlan): {
  baselineCases: RegressionRunPlan['corpus']['cases'];
  mutantCases: RegressionRunPlan['corpus']['cases'];
} {
  const baselineCases: RegressionRunPlan['corpus']['cases'] = [];
  const mutantCases: RegressionRunPlan['corpus']['cases'] = [];
  for (const benchmarkCase of plan.corpus.cases) {
    const unit = plan.unitsByBenchmarkCaseId.get(benchmarkCase.caseId);
    (unit?.mutantId === undefined ? baselineCases : mutantCases).push(
      benchmarkCase,
    );
  }
  return { baselineCases, mutantCases };
}

function percentile(
  attempts: BenchmarkAttempt[],
  fraction: number,
): number | null {
  const latencies = attempts
    .map((attempt) => attempt.latencyMs)
    .sort((left, right) => left - right);
  if (latencies.length === 0) return null;
  const index = Math.min(
    latencies.length - 1,
    Math.floor(fraction * latencies.length),
  );
  return latencies[index] ?? null;
}
