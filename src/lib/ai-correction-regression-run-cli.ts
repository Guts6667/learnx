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
import {
  conservativeSupplierCallCostUsd,
  SupplierBudgetGuard,
} from './ai-benchmark-supplier-budget.js';
import { z } from 'zod';
import {
  evaluateRegressionGates,
  parseRegressionGatePolicy,
  type RegressionGateEvaluation,
} from './ai-correction-regression-gates.js';
import {
  computeRegressionMetrics,
  type RegressionCheckerVerdict,
  type RegressionMetrics,
} from './ai-correction-regression-metrics.js';
import {
  deriveHeldOutSeed,
  deterministicPermutation,
  REGRESSION_MUTANT_GENERATOR_VERSION,
} from './ai-correction-regression-mutants.js';
import { renderRegressionReport } from './ai-correction-regression-report.js';
import {
  acquireRunLock,
  capForRun,
  envelopeState,
  ledgerSpendSince,
  readSpendEnvelope,
  RegressionEnvelopeError,
  releaseRunLock,
  writeSpendEnvelope,
} from './ai-correction-regression-envelope.js';
import {
  computeRunSecurityRates,
  countMutantsByKind,
  deriveRegressionObservations,
  partitionObservations,
  planRegressionRun,
  summarizeConfidence,
  verdictKey,
  type RegressionCheckerPort,
  type RegressionRunPlan,
  type RegressionVerdictRecord,
} from './ai-correction-regression-run.js';

/** What a `--run-pool` invocation produced, paid or dry. */
export type RegressionRunOutcome = {
  attempts: BenchmarkAttempt[];
  dryRun: boolean;
  /** Worst-case spend for the whole plan, primary and checker together. */
  estimatedPrimaryUsd: number;
  /** Whether that bound fits the authorised cap. Authoritative. */
  fitsWithinCap: boolean;
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
  /**
   * The promoted identity's retry policy, which is part of the identity rather
   * than of the benchmark configuration. A run that retries where the promoted
   * identity does not is measuring a different system — and
   * `eventualUnusableRunRate`, a blocking gate, is precisely about what happens
   * when a call fails and is not retried.
   */
  maxRetries: number;
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

/**
 * Verdicts persisted by an earlier run, so a resume never re-buys them.
 */
async function readPersistedVerdicts(
  resultsDirectory: string,
): Promise<RegressionVerdictRecord[]> {
  try {
    const raw = await readFile(
      path.join(resultsDirectory, 'checker-verdicts.json'),
      'utf8',
    );
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as RegressionVerdictRecord[]) : [];
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return [];
    throw error;
  }
}

/**
 * The profile family a run belongs to, for matching a measured entry.
 */
function profileFamilyFor(arguments_: string[]): string {
  const requested = readCliOption(arguments_, 'profile');
  return requested === 'reduced' || requested === 'smoke' ? 'reduced' : 'full';
}

/**
 * Reads the measured cost distributions, if any have been recorded.
 */
async function readMeasuredCosts(
  directory: string,
): Promise<MeasuredCosts | undefined> {
  try {
    return measuredCostsSchema.parse(
      JSON.parse(
        await readFile(path.join(directory, 'measured-costs.v1.json'), 'utf8'),
      ) as unknown,
    );
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return undefined;
    throw error;
  }
}

/**
 * Reads the recorded checker price, if one has been recorded yet.
 *
 * Absent is a legitimate state, not an error: it means the run's bound covers
 * the primary model only, and the preflight says so rather than pretending the
 * checker is free.
 */
async function readCheckerPricing(
  directory: string,
): Promise<CheckerPricing | undefined> {
  try {
    const raw = await readFile(
      path.join(directory, 'checker-pricing.v1.json'),
      'utf8',
    );
    return checkerPricingSchema.parse(JSON.parse(raw) as unknown);
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return undefined;
    throw error;
  }
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

/**
 * Reads the attempts of an interrupted run, given its results directory.
 *
 * `--resume` points at a directory, not a file: spec §7 names the artefact
 * `attempts.json`, and the stock resume path insists on a `*.attempts.json`
 * stem it would never find there. Rather than rename the artefact to suit the
 * older convention, the regression path reads its own directory — the spec's
 * naming is the one a reader of a results directory sees.
 */
async function readResumeAttempts(
  resumeDirectory: string,
): Promise<BenchmarkAttempt[]> {
  const raw = await readFile(
    path.join(resumeDirectory, 'attempts.json'),
    'utf8',
  );
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new RegressionRunError(
      `REGRESSION_RESUME_ATTEMPTS_INVALID: ${resumeDirectory}/attempts.json n'est pas un tableau de tentatives.`,
    );
  }
  return parsed as BenchmarkAttempt[];
}

/** Cell key shared by the runner and the resume computation. */
function cellKey(input: {
  candidateId: string;
  caseId: string;
  repetition: number;
}): string {
  return `${input.candidateId}|${input.caseId}|${input.repetition}`;
}

/**
 * The cells of a pass that an interrupted run has not yet completed.
 *
 * Returned as the runner's `pendingCells` whitelist, so a resumed run dispatches
 * exactly the work that is missing and never pays twice for a cell already
 * bought.
 */
export function pendingCellsFor(input: {
  candidateId: string;
  cases: { caseId: string }[];
  completed: Set<string>;
  repetitions: number;
}): {
  attemptStart: number;
  candidateId: string;
  caseId: string;
  repetition: number;
}[] {
  const pending: {
    attemptStart: number;
    candidateId: string;
    caseId: string;
    repetition: number;
  }[] = [];
  for (const benchmarkCase of input.cases) {
    for (let repetition = 1; repetition <= input.repetitions; repetition += 1) {
      const key = cellKey({
        candidateId: input.candidateId,
        caseId: benchmarkCase.caseId,
        repetition,
      });
      if (input.completed.has(key)) continue;
      pending.push({
        attemptStart: 1,
        candidateId: input.candidateId,
        caseId: benchmarkCase.caseId,
        repetition,
      });
    }
  }
  return pending;
}

/**
 * The provider's own lifetime usage figure, read before and after a run.
 *
 * Our ledger sums what each response reported. This reads the other side of the
 * same transaction, so the run's spend can be reconciled against the provider
 * rather than only against our own arithmetic — which is what "reconciled"
 * ought to mean. A failure to read it is recorded as `null`, never as zero.
 */
async function readProviderUsageUsd(
  apiKey: string | undefined,
): Promise<number | null> {
  if (!apiKey) return null;
  try {
    const response = await fetch('https://openrouter.ai/api/v1/credits', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      data?: { total_usage?: unknown };
    };
    const usage = body.data?.total_usage;
    return typeof usage === 'number' && Number.isFinite(usage) ? usage : null;
  } catch {
    return null;
  }
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
  /** `totalOutputTokenLimit` of the promoted checker; 400 unless overridden. */
  checkerOutputTokenLimit?: number;
  identities: RegressionPinnedIdentities;
  now?: () => Date;
  /**
   * Forwarded to the runner, which demands one before dispatching even when
   * the executor is injected. Offline callers pass a placeholder; V4.5-121
   * passes the real key from the environment.
   */
  providerApiKey?: string;
  regressionDirectory?: string;
}): Promise<RegressionRunOutcome> {
  const dryRun = input.arguments.includes('--dry-run');
  const requestedCapUsd = parseSupplierCostCap(input.arguments);
  const candidate = selectPinnedCandidate({
    configuration: input.configuration,
    identities: input.identities,
  });
  const directory = input.regressionDirectory ?? regressionDirectory;
  const runStartedAt = (input.now?.() ?? new Date()).toISOString();

  // The envelope is measured against the provider, not a local counter: a
  // counter inside one process cannot see a second process, which is exactly
  // how two concurrent runs each honoured a 12.60 USD cap and were together
  // authorised to spend 25.20.
  const envelopeUsd = readCliOption(input.arguments, 'envelope-usd');
  let envelopeNote =
    "Aucune enveloppe déclarée : seul le plafond du run s'applique.";
  let supplierCostCapUsd = requestedCapUsd;
  if (envelopeUsd !== undefined) {
    const parsedEnvelope = Number.parseFloat(envelopeUsd);
    if (!Number.isFinite(parsedEnvelope) || parsedEnvelope <= 0) {
      throw new RegressionEnvelopeError(
        `REGRESSION_ENVELOPE_INVALID: ${envelopeUsd}.`,
      );
    }
    const existing = await readSpendEnvelope(directory);
    const usageNow = await readProviderUsageUsd(input.providerApiKey);
    const envelope = existing ?? {
      decisionId:
        readCliOption(input.arguments, 'envelope-decision') ?? 'undeclared',
      envelopeUsd: parsedEnvelope,
      openedAt: runStartedAt,
      openingProviderUsageUsd: usageNow ?? 0,
      schemaVersion: 1 as const,
    };
    if (!existing) {
      if (usageNow === null) {
        throw new RegressionEnvelopeError(
          "REGRESSION_ENVELOPE_UNMEASURABLE: impossible de lire l'usage fournisseur pour ouvrir l'enveloppe.",
        );
      }
      await writeSpendEnvelope({ directory, envelope });
    }
    const state = envelopeState({
      envelope,
      ledgerSpentUsd: await ledgerSpendSince({
        directory,
        openedAt: envelope.openedAt,
      }),
      providerUsageUsd: usageNow,
    });
    const resolved = capForRun({ requestedCapUsd, state });
    supplierCostCapUsd = resolved.capUsd;
    envelopeNote = resolved.reason;
  }

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

  // Spec §4 prices the halves differently: the pool is repeated to measure
  // stability, mutants run once because their oracle is a direction, not a
  // distribution. Pricing them together would multiply the mutant bill for no
  // added signal.
  const requestedProfile = readCliOption(input.arguments, 'profile');
  const profile: RegressionProfileName =
    requestedProfile === 'reduced'
      ? 'reduced'
      : requestedProfile === 'smoke'
        ? 'smoke'
        : 'full';
  const requestedPasses = buildRunPasses({
    plan,
    poolSha256,
    profile,
    repetitions: input.configuration.repetitions,
  });
  // Loaded before pricing, not after: a resumed run must be priced on the work
  // it still owes. Charging the bound for cells already bought would refuse a
  // resume that is in fact cheaper than the original run.
  const resumeDirectory = readCliOption(input.arguments, 'resume');
  const resumedAttempts = resumeDirectory
    ? await readResumeAttempts(path.resolve(resumeDirectory))
    : [];
  const completedCells = new Set(
    resumedAttempts.map((attempt) =>
      cellKey({
        candidateId: attempt.candidateId,
        caseId: attempt.caseId,
        repetition: attempt.repetition,
      }),
    ),
  );

  const measured = await readMeasuredCosts(directory);
  const conventionChoice = selectBoundingConvention({
    checkerModelId: input.identities.checkerModelId,
    measured,
    primaryModelId: input.identities.primaryModelId,
    profileFamily: profileFamilyFor(input.arguments),
  });

  const checkerPricing = await readCheckerPricing(directory);
  const checkerPromptCharacters = checkerPromptCharactersUpperBound(plan);
  const checkerCostFor = (passes: RegressionRunPass[]): number => {
    if (!checkerPricing) return 0;
    const corrections = passes.reduce(
      (total, pass) => total + outstandingCases(pass).length * pass.repetitions,
      0,
    );
    return checkerWorstCaseUsd({
      corrections,
      outputTokenLimit: input.checkerOutputTokenLimit ?? 400,
      pricing: checkerPricing,
      promptCharactersPerCall: checkerPromptCharacters,
    });
  };

  const outstandingCases = (
    pass: RegressionRunPass,
  ): RegressionRunPass['cases'] =>
    completedCells.size === 0
      ? pass.cases
      : pass.cases.filter((benchmarkCase) => {
          for (
            let repetition = 1;
            repetition <= pass.repetitions;
            repetition += 1
          ) {
            if (
              !completedCells.has(
                cellKey({
                  candidateId: candidate.candidateId,
                  caseId: benchmarkCase.caseId,
                  repetition,
                }),
              )
            ) {
              return true;
            }
          }
          return false;
        });

  const pricePass = (pass: RegressionRunPass): number => {
    const cases = outstandingCases(pass);
    if (cases.length === 0) return 0;
    const passPreflight = buildBenchmarkSupplierBudgetPreflight({
      actualSpentUsd: 0,
      candidates: [candidate],
      cases,
      configuration: input.configuration,
      corpus: plan.corpus,
      maxRetries: input.identities.maxRetries,
      repetitions: pass.repetitions,
      supplierCostCapUsd,
    });
    // Retries are part of the worst case the runner refuses to exceed, so they
    // belong in the bound too. Leaving them out made this preflight disagree
    // with the runner's own dispatch guard, which refused a plan this function
    // had just called affordable.
    return passPreflight.primaryWorstCaseUsd + passPreflight.retryWorstCaseUsd;
  };
  // One bill, not two: the cap governs the run, so the checker's share is
  // inside the number the drop order works against rather than beside it.
  const cellsIn = (passes: RegressionRunPass[]): number =>
    passes.reduce(
      (total, pass) => total + outstandingCases(pass).length * pass.repetitions,
      0,
    );

  const priceV1 = (passes: RegressionRunPass[]): number =>
    passes.reduce((total, pass) => total + pricePass(pass), 0) +
    checkerCostFor(passes);

  // v2 prices a cell from what cells actually cost, rather than from a
  // character count and a fixed envelope. It applies only where a measurement
  // exists for this model and profile family; the other half falls back.
  const priceV2 = (passes: RegressionRunPass[]): number => {
    if (!conventionChoice.primary || !measured) return priceV1(passes);
    const calls = cellsIn(passes);
    const primaryBound = measuredBoundUsd({
      calls,
      entry: conventionChoice.primary,
      safetyFactor: measured.safetyFactor,
    });
    const checkerBound = conventionChoice.checker
      ? measuredBoundUsd({
          calls,
          entry: conventionChoice.checker,
          safetyFactor: measured.safetyFactor,
        })
      : checkerCostFor(passes);
    return primaryBound + checkerBound;
  };

  const priceAll =
    conventionChoice.convention === 'measured-p90-v2' ? priceV2 : priceV1;

  // Two checker calls per case in scope: one to rewrite, one to confirm the
  // meaning survived. Priced with the checker's own recorded rate.
  const paraphraseCandidates = requestedPasses[0]?.cases.length ?? 0;
  const paraphraseCostUsd = checkerPricing
    ? checkerWorstCaseUsd({
        corrections: paraphraseCandidates * 2,
        outputTokenLimit: input.checkerOutputTokenLimit ?? 400,
        pricing: checkerPricing,
        promptCharactersPerCall: checkerPromptCharacters,
      })
    : 0;
  const budgeted = applyDropOrder({
    capUsd: supplierCostCapUsd,
    paraphraseCostUsd,
    paraphrasesRequested: input.arguments.includes('--with-paraphrases'),
    passes: requestedPasses,
    price: priceAll,
  });
  const passes = budgeted.passes.filter((pass) => pass.cases.length > 0);
  const preflight = buildBenchmarkSupplierBudgetPreflight({
    actualSpentUsd: 0,
    candidates: [candidate],
    cases: passes[0]?.cases ?? [],
    configuration: input.configuration,
    corpus: plan.corpus,
    maxRetries: input.identities.maxRetries,
    repetitions: passes[0]?.repetitions ?? 1,
    supplierCostCapUsd,
  });

  const willExecute = !dryRun && input.executeCandidate !== undefined;
  const providerUsageBeforeUsd = willExecute
    ? await readProviderUsageUsd(input.providerApiKey)
    : null;
  const resultsDirectory = await createResultsDirectory({
    dryRun: !willExecute,
    regressionDirectory: directory,
    runStartedAt,
  });
  // Only what this profile dispatches: the report's "mutants exécutés" must
  // name mutants that were actually executed.
  const executedCaseIds = new Set(
    passes.flatMap((pass) => pass.cases.map((item) => item.caseId)),
  );
  const passBreakdown = passes.map((pass) => ({
    cases: pass.cases.length,
    cells: pass.cases.length * pass.repetitions,
    label: pass.label,
    primaryWorstCaseUsd: pricePass(pass),
    repetitions: pass.repetitions,
  }));
  await writeRunArtifact({
    content: `${JSON.stringify(
      {
        checkerCost: checkerPricing
          ? {
              corrections: passes.reduce(
                (total, pass) => total + pass.cases.length * pass.repetitions,
                0,
              ),
              modelId: checkerPricing.modelId,
              outputTokenLimit: input.checkerOutputTokenLimit ?? 400,
              pricedInThisPreflight: true,
              promptCharactersPerCall: checkerPromptCharacters,
              source: checkerPricing.source,
              worstCaseUsd: checkerCostFor(passes),
            }
          : {
              note: "Aucun prix par jeton n'est enregistré pour le vérificateur promu : la borne ne couvre que le modèle primaire. Ses appels restent réconciliés contre le même plafond pendant l'exécution, ce qui arrête le run au plafond sans l'empêcher de l'atteindre.",
              pricedInThisPreflight: false,
            },
        // Both conventions are printed so a reader knows which bound authorised
        // the run, and what the other one would have said.
        boundingConvention: conventionChoice.convention,
        boundingSources: {
          checker: conventionChoice.checker
            ? {
                observations: conventionChoice.checker.observations,
                sourceDirectory: conventionChoice.checker.sourceDirectory,
                statistic: conventionChoice.checker.statistic,
                usdPerCall: conventionChoice.checker.usdPerCall,
              }
            : null,
          primary: conventionChoice.primary
            ? {
                observations: conventionChoice.primary.observations,
                sourceDirectory: conventionChoice.primary.sourceDirectory,
                statistic: conventionChoice.primary.statistic,
                usdPerCall: conventionChoice.primary.usdPerCall,
              }
            : null,
          safetyFactor: measured?.safetyFactor ?? null,
        },
        combinedWorstCaseUsd: budgeted.pricedUsd,
        comparisonConservativeV1Usd: priceV1(passes),
        primaryWorstCaseUsd: passes.reduce(
          (total, pass) => total + pricePass(pass),
          0,
        ),
        // `fitsWithinCap` is the authoritative verdict for the profile: it
        // weighs the whole plan, both models included, against the cap.
        // `singlePassLegacyDecision` is the stock runner's verdict on the first
        // pass alone and can read CONTINGENCY_REQUIRED on a plan that fits,
        // because it prices that pass's retries as if they were certain.
        // Reading it as the run's verdict would be a mistake, so it is named
        // for what it is.
        singlePassLegacyDecision: preflight.decision,
        dropped: budgeted.dropped,
        fitsWithinCap: budgeted.fits,
        paraphraseWorstCaseUsd: budgeted.paraphrases ? paraphraseCostUsd : 0,
        paraphrasesIncluded: budgeted.paraphrases,
        passes: passBreakdown,
        envelopeNote,
        profile,
        requestedCapUsd,
        supplierCostCapUsd,
      },
      null,
      2,
    )}\n`,
    directory: resultsDirectory,
    fileName: 'budget-preflight.json',
  });

  // A plan that does not fit its cap is never dispatched. The guard would stop
  // it partway, but a half-executed run spends real money and produces a
  // results directory that measures nothing: the refusal has to come before the
  // first call, not during it.
  if (!dryRun && input.executeCandidate && !budgeted.fits) {
    throw new RegressionRunError(
      `REGRESSION_RUN_EXCEEDS_CAP: borne ${budgeted.pricedUsd.toFixed(4)} USD > plafond ${supplierCostCapUsd} USD après application de l'ordre de retrait. Préflight écrit dans ${resultsDirectory}.`,
    );
  }

  if (dryRun || !input.executeCandidate) {
    // The plan, its cost bound and the artefact layout, for free. Nothing here
    // has spoken to a provider.
    return {
      attempts: [],
      dryRun: true,
      estimatedPrimaryUsd: budgeted.pricedUsd,
      fitsWithinCap: budgeted.fits,
      paraphraseRefusals: cache.refusals,
      plan,
      poolSha256,
      preflight,
      resultsDirectory,
      runStartedAt,
    };
  }

  // A second run must not start while a first is alive. Pasting a launch
  // command twice is an ordinary thing to do; the system should survive it
  // rather than depend on someone noticing two processes.
  const lock = await acquireRunLock({ directory, resultsDirectory });
  if (!lock.acquired) {
    throw new RegressionRunError(
      `REGRESSION_RUN_ALREADY_ACTIVE: un run est déjà en cours (pid ${lock.heldBy.pid}, démarré ${lock.heldBy.startedAt}, résultats ${lock.heldBy.resultsDirectory}).`,
    );
  }

  // Verdicts already bought, so a resumed analysis reuses them rather than
  // paying the checker a second time.
  const verdicts = new Map<string, RegressionCheckerVerdict>();
  if (resumeDirectory) {
    for (const record of await readPersistedVerdicts(
      path.resolve(resumeDirectory),
    )) {
      verdicts.set(
        verdictKey({
          criterionKey: record.criterionKey,
          unitId: record.unitId,
        }),
        record.verdict,
      );
    }
  }
  const persistVerdicts = async (
    records: RegressionVerdictRecord[],
  ): Promise<void> => {
    for (const record of records) {
      verdicts.set(
        verdictKey({
          criterionKey: record.criterionKey,
          unitId: record.unitId,
        }),
        record.verdict,
      );
    }
    await writeRunArtifact({
      content: `${JSON.stringify(
        [...verdicts.entries()].map(([key, verdict]) => {
          const [unitId, criterionKey] = key.split('::');
          return { criterionKey, unitId, verdict };
        }),
        null,
        2,
      )}\n`,
      directory: resultsDirectory,
      fileName: 'checker-verdicts.json',
    });
  };

  // One guard across every pass: the cap is on the run, not on each slice.
  const guard = new SupplierBudgetGuard(supplierCostCapUsd);
  const attempts: BenchmarkAttempt[] = [];

  const resumed = resumedAttempts;
  // Spend already made is spend the cap has already absorbed. Reconciling it
  // into the guard stops a resumed run from quietly spending the whole cap a
  // second time.
  for (const attempt of resumed) {
    if (attempt.usage?.costSource === 'ACTUAL') {
      guard.reconcile(attempt.usage);
    }
  }
  const completed = new Set(
    resumed.map((attempt) =>
      cellKey({
        candidateId: attempt.candidateId,
        caseId: attempt.caseId,
        repetition: attempt.repetition,
      }),
    ),
  );

  // Attempts are persisted as they arrive, not at the end. A long paid run that
  // is interrupted must leave behind what it already bought: without this, a
  // stopped run loses every recorded call, its spend becomes unreconcilable
  // from the artefacts, and `--resume` has no attempts file to resume from.
  const persistProgress = async (
    passAttempts: BenchmarkAttempt[],
  ): Promise<void> => {
    await writeRunArtifact({
      content: `${JSON.stringify([...attempts, ...passAttempts], null, 2)}\n`,
      directory: resultsDirectory,
      fileName: 'attempts.json',
    });
    await writeRunArtifact({
      content: renderLedger([...attempts, ...passAttempts]),
      directory: resultsDirectory,
      fileName: 'ledger.jsonl',
    });
  };

  for (const pass of passes) {
    const passCaseIds = new Set(
      pass.cases.map((benchmarkCase) => benchmarkCase.caseId),
    );
    const passResumed = resumed.filter((attempt) =>
      passCaseIds.has(attempt.caseId),
    );
    const pendingCells = pendingCellsFor({
      candidateId: candidate.candidateId,
      cases: pass.cases,
      completed,
      repetitions: pass.repetitions,
    });
    if (pendingCells.length === 0) {
      // Nothing left to buy in this pass; keep what the interrupted run paid
      // for and move on.
      attempts.push(...passResumed);
      await persistProgress([]);
      continue;
    }
    const passAttempts = await runBenchmark({
      candidates: [candidate],
      cases: pass.cases,
      configuration: input.configuration,
      corpus: plan.corpus,
      executeCandidate: input.executeCandidate,
      ...(passResumed.length > 0 ? { initialAttempts: passResumed } : {}),
      maxRetries: input.identities.maxRetries,
      onProgress: persistProgress,
      ...(resumed.length > 0 ? { pendingCells } : {}),
      ...(input.providerApiKey ? { providerApiKey: input.providerApiKey } : {}),
      repetitions: pass.repetitions,
      supplierBudget: guard,
    });
    attempts.push(...passAttempts);
    await persistProgress([]);
  }

  const observations = await deriveRegressionObservations({
    attempts,
    budget: guard,
    ...(input.checker ? { checker: input.checker } : {}),
    familyScientificallyValidated: true,
    onVerdicts: persistVerdicts,
    persistedVerdicts: verdicts,
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
      checkerBoundUsd: checkerPricing ? checkerCostFor(passes) : null,
      costCapUsd: supplierCostCapUsd,
      dropped: budgeted.dropped,
      primaryBoundUsd: passes.reduce(
        (total, pass) => total + pricePass(pass),
        0,
      ),
      // The preflight's own worst-case envelope: primary calls, their
      // retries and the bounded guard passes. Reported as the estimate the
      // run was authorised against, next to what it actually spent.
      estimatedCostUsd: budgeted.pricedUsd,
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
      profile,
      repetitions: input.configuration.repetitions,
      runStartedAt,
    },
    metrics,
    mutantCounts: countMutantsByKind(plan, executedCaseIds),
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
        mutantCounts: countMutantsByKind(plan, executedCaseIds),
        runStartedAt,
        security,
      },
      null,
      2,
    )}\n`,
    directory: resultsDirectory,
    fileName: 'summary.json',
  });
  const providerUsageAfterUsd = await readProviderUsageUsd(
    input.providerApiKey,
  );
  await writeRunArtifact({
    content: `${JSON.stringify(
      {
        // Both sides of the same transaction. `ledgerUsd` is what the responses
        // reported; `providerDeltaUsd` is what the provider says it charged.
        // They should agree; recording both means a disagreement is visible
        // rather than assumed away.
        ledgerUsd: guard.actualSpentUsd,
        note: 'total_usage est cumulatif sur la clé, pas propre à ce run ; seul le delta est imputable.',
        providerDeltaUsd:
          providerUsageBeforeUsd !== null && providerUsageAfterUsd !== null
            ? providerUsageAfterUsd - providerUsageBeforeUsd
            : null,
        providerUsageAfterUsd,
        providerUsageBeforeUsd,
      },
      null,
      2,
    )}\n`,
    directory: resultsDirectory,
    fileName: 'cost-reconciliation.json',
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

  await releaseRunLock(directory);

  return {
    attempts,
    dryRun: false,
    estimatedPrimaryUsd: budgeted.pricedUsd,
    fitsWithinCap: budgeted.fits,
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

/** One dispatchable slice of a run: a set of cases at a repetition count. */
export type RegressionRunPass = {
  cases: RegressionRunPlan['corpus']['cases'];
  /** Why this slice exists, for the report. */
  label: string;
  repetitions: number;
};

type RegressionProfileName = 'full' | 'reduced' | 'smoke';

/**
 * The deterministic 24-case subset the reduced profile repeats.
 *
 * Drawn by the same seeded permutation the held-out set uses, so the subset is
 * reproducible from the pool digest and cannot be chosen after seeing results.
 */
export function reducedProfileSubset(input: {
  caseIds: string[];
  seed: string;
  size: number;
}): Set<string> {
  const ordered = [...input.caseIds].sort((left, right) =>
    left.localeCompare(right),
  );
  const order = deterministicPermutation({
    length: ordered.length,
    seed: input.seed,
  });
  return new Set(
    order
      .slice(0, Math.min(input.size, ordered.length))
      .flatMap((index) => (ordered[index] ? [ordered[index]] : [])),
  );
}

/**
 * The passes a profile dispatches, before any budget-driven drop.
 *
 * `full` is spec §4's reference run: the pool at its repetition count plus every
 * mutant once. `reduced` is the budgeted variant: the whole pool once — so no
 * case goes unseen — plus repetitions and mutants on a fixed subset.
 */
function buildRunPasses(input: {
  plan: RegressionRunPlan;
  poolSha256: string;
  profile: RegressionProfileName;
  repetitions: number;
  subsetSize?: number;
}): RegressionRunPass[] {
  const { baselineCases, mutantCases } = splitPlanCases(input.plan);

  if (input.profile === 'smoke') {
    // One pooled case, once, no mutants: the smallest plan that still exercises
    // a real primary call, a real checker call, provider cost reconciliation
    // and a ledger line. It proves the wiring, and claims nothing about the
    // system under test — a smoke run is not a measurement.
    const first = [...baselineCases].sort((left, right) =>
      left.caseId.localeCompare(right.caseId),
    )[0];
    return first
      ? [{ cases: [first], label: 'fumée — un cas', repetitions: 1 }]
      : [];
  }

  if (input.profile === 'full') {
    return [
      {
        cases: baselineCases,
        label: 'pool complet',
        repetitions: input.repetitions,
      },
      { cases: mutantCases, label: 'mutants', repetitions: 1 },
    ];
  }

  const poolCaseIds = [...input.plan.unitsByBenchmarkCaseId.values()]
    .filter((unit) => unit.mutantId === undefined)
    .map((unit) => unit.poolCaseId);
  const subset = reducedProfileSubset({
    caseIds: poolCaseIds,
    seed: input.poolSha256,
    size: input.subsetSize ?? 24,
  });
  const inSubset = (caseId: string): boolean => {
    const unit = input.plan.unitsByBenchmarkCaseId.get(caseId);
    return unit ? subset.has(unit.poolCaseId) : false;
  };

  return [
    // Every pooled case is seen once: a budget may reduce repetition, never
    // coverage, or the run stops being a regression suite over the pool.
    { cases: baselineCases, label: 'pool complet × 1', repetitions: 1 },
    {
      cases: baselineCases.filter((benchmarkCase) =>
        inSubset(benchmarkCase.caseId),
      ),
      label: 'répétitions du sous-ensemble',
      repetitions: 2,
    },
    {
      cases: mutantCases.filter((benchmarkCase) =>
        inSubset(benchmarkCase.caseId),
      ),
      label: 'mutants du sous-ensemble',
      repetitions: 1,
    },
  ];
}

/**
 * Applies the agreed drop order until the priced plan fits the cap.
 *
 * Order, fixed in advance so no result can influence it: paraphrases first —
 * the weakest oracle, since its input is itself a model output — then the
 * subset's extra repetitions from two down to one. Safety and mutation cells
 * and the full-pool single pass are never dropped; if the plan still does not
 * fit after those two steps, it is reported as not fitting rather than trimmed
 * further.
 */
export function applyDropOrder(input: {
  capUsd: number;
  /** Worst-case cost of generating paraphrases, if they are included. */
  paraphraseCostUsd?: number;
  paraphrasesRequested: boolean;
  passes: RegressionRunPass[];
  price: (passes: RegressionRunPass[]) => number;
}): {
  dropped: string[];
  fits: boolean;
  paraphrases: boolean;
  passes: RegressionRunPass[];
  pricedUsd: number;
} {
  const dropped: string[] = [];
  let paraphrases = input.paraphrasesRequested;
  let passes = input.passes;
  // Paraphrase generation is a paid call like any other, so it belongs inside
  // the number the order works against. Leaving it out was how requesting
  // paraphrases could breach the cap without the preflight noticing.
  const total = (): number =>
    input.price(passes) + (paraphrases ? (input.paraphraseCostUsd ?? 0) : 0);

  // Nothing is dropped that the budget can afford: the order exists to fit a
  // plan to a cap, not to shrink it on principle.
  if (paraphrases && total() > input.capUsd) {
    paraphrases = false;
    dropped.push(
      'paraphrases : oracle le plus faible (son entrée est elle-même une sortie de modèle), retiré en premier',
    );
  }

  if (total() > input.capUsd) {
    passes = passes.map((pass) =>
      pass.label === 'répétitions du sous-ensemble'
        ? { ...pass, repetitions: 1 }
        : pass,
    );
    dropped.push(
      'répétitions du sous-ensemble ramenées de 3 à 2 : la stabilité perd un point de mesure, la couverture n’en perd aucun',
    );
  }

  const pricedUsd = total();
  return {
    dropped,
    fits: pricedUsd <= input.capUsd,
    paraphrases,
    passes,
    pricedUsd,
  };
}

export const checkerPricingSchema = z
  .object({
    completionUsdPerToken: z.number().nonnegative(),
    contextTokens: z.number().int().positive(),
    modelId: z.string().trim().min(1),
    note: z.string().trim().min(1),
    promptUsdPerToken: z.number().nonnegative(),
    provider: z.string().trim().min(1),
    schemaVersion: z.literal(1),
    source: z
      .object({
        consultedAt: z.string().trim().min(1),
        consultedBy: z.string().trim().min(1),
        publishedRates: z.string().trim().min(1),
        url: z.string().trim().min(1),
      })
      .strict(),
  })
  .strict();

export type CheckerPricing = z.infer<typeof checkerPricingSchema>;

/**
 * Worst-case checker spend for a planned run.
 *
 * Uses the same conservative bound as the primary model — one token per UTF-16
 * code unit plus a fixed envelope — so the two halves of the bill are computed
 * the same way rather than one being generous and the other optimistic. The
 * output side is not estimated at all: it is `totalOutputTokenLimit` from the
 * promoted checker identity, which the checker sends as `max_tokens`.
 */
export function checkerWorstCaseUsd(input: {
  /** Characters of rubric text and quotes sent per correction. */
  promptCharactersPerCall: number;
  corrections: number;
  outputTokenLimit: number;
  pricing: CheckerPricing;
}): number {
  if (input.corrections === 0) return 0;
  return (
    input.corrections *
    conservativeSupplierCallCostUsd({
      completionUsdPerToken: input.pricing.completionUsdPerToken,
      promptCharacters: input.promptCharactersPerCall,
      promptUsdPerToken: input.pricing.promptUsdPerToken,
      schemaCharacters: 0,
      totalOutputTokenLimit: input.outputTokenLimit,
    })
  );
}

/**
 * Upper bound on the characters one checker call carries, measured from the
 * plan rather than assumed: the criteria of the largest contract, their level
 * descriptions, and the quotes a correction may cite.
 */
function checkerPromptCharactersUpperBound(plan: RegressionRunPlan): number {
  let widest = 0;
  for (const contract of plan.corpus.contracts) {
    const rubric = contract.criteria.reduce(
      (total, criterion) =>
        total +
        criterion.label.length +
        criterion.performanceLevels.reduce(
          (levels, level) =>
            levels + level.description.length + level.label.length,
          0,
        ),
      0,
    );
    if (rubric > widest) widest = rubric;
  }
  // A correction may quote up to the whole production once per criterion; the
  // longest pooled response bounds that.
  let longestResponse = 0;
  for (const unit of plan.unitsByBenchmarkCaseId.values()) {
    if (unit.responseText.length > longestResponse) {
      longestResponse = unit.responseText.length;
    }
  }
  return widest + longestResponse;
}

/**
 * `--measure-checker` — buys a measured cost distribution for the verifier
 * without paying for a single primary call (V4.5-126).
 *
 * The bounding convention v2 may only use a measured distribution, and the
 * verifier had none: V4.5-121 never reached it, and the smoke called it once,
 * a figure obtained by subtracting the primary ledger from the reconciled
 * total. One derived observation is not a distribution.
 *
 * Rather than re-run corrections to obtain verifier costs, this replays
 * **already-recorded attempts** through the verifier. The corrections were paid
 * for once; asking the verifier about them costs only the verifier.
 */
export async function runCheckerMeasurement(input: {
  arguments: string[];
  checker: RegressionCheckerPort;
  identities: RegressionPinnedIdentities;
  now?: () => Date;
  providerApiKey?: string;
  regressionDirectory?: string;
}): Promise<{
  callsMade: number;
  observations: number;
  resultsDirectory: string;
  spentUsd: number;
}> {
  const sourceDirectory = readCliOption(input.arguments, 'measure-checker');
  if (!sourceDirectory) {
    throw new RegressionRunError(
      'REGRESSION_MEASURE_SOURCE_REQUIRED: --measure-checker=<répertoire de résultats> est obligatoire.',
    );
  }
  const limitRaw = readCliOption(input.arguments, 'limit');
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 15;
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new RegressionRunError(
      `REGRESSION_MEASURE_LIMIT_INVALID: ${limitRaw}.`,
    );
  }
  const capUsd = parseSupplierCostCap(input.arguments);
  const directory = input.regressionDirectory ?? regressionDirectory;
  const runStartedAt = (input.now?.() ?? new Date()).toISOString();

  const { pool, poolSha256, sources } = await loadPoolForRun(input.arguments);
  const plan = planRegressionRun({ pool, sources });
  const recorded = await readResumeAttempts(path.resolve(sourceDirectory));
  // Only corrections that actually produced criteria can be verified.
  const usable = recorded
    .filter((attempt) => attempt.status === 'VALID' && attempt.output)
    .slice(0, limit);
  if (usable.length === 0) {
    throw new RegressionRunError(
      `REGRESSION_MEASURE_NO_ATTEMPTS: aucune tentative valide dans ${sourceDirectory}.`,
    );
  }

  const lock = await acquireRunLock({
    directory,
    resultsDirectory: runStartedAt,
  });
  if (!lock.acquired) {
    throw new RegressionRunError(
      `REGRESSION_RUN_ALREADY_ACTIVE: pid ${lock.heldBy.pid}.`,
    );
  }

  const resultsDirectory = await createResultsDirectory({
    regressionDirectory: directory,
    runStartedAt,
  });
  const guard = new SupplierBudgetGuard(capUsd);
  const providerUsageBeforeUsd = await readProviderUsageUsd(
    input.providerApiKey,
  );

  let callsMade = 0;
  const verdicts: RegressionVerdictRecord[] = [];
  const observations = await deriveRegressionObservations({
    attempts: usable,
    budget: guard,
    checker: {
      async verify(question) {
        callsMade += 1;
        return input.checker.verify(question);
      },
    },
    familyScientificallyValidated: true,
    onVerdicts: async (records) => {
      verdicts.push(...records);
      await writeRunArtifact({
        content: `${JSON.stringify(verdicts, null, 2)}\n`,
        directory: resultsDirectory,
        fileName: 'checker-verdicts.json',
      });
    },
    plan,
  });

  const providerUsageAfterUsd = await readProviderUsageUsd(
    input.providerApiKey,
  );
  const providerDeltaUsd =
    providerUsageBeforeUsd !== null && providerUsageAfterUsd !== null
      ? providerUsageAfterUsd - providerUsageBeforeUsd
      : null;
  const perCallUsd = callsMade === 0 ? null : guard.actualSpentUsd / callsMade;

  await writeRunArtifact({
    content: `${JSON.stringify(
      {
        artifactKind: 'CHECKER_COST_MEASUREMENT',
        callsMade,
        checkerModelId: input.identities.checkerModelId,
        // The verifier reports one cost per call, so a per-call mean over a
        // small sample is what there is. It is labelled a mean, not a P90:
        // calling it a percentile would claim a distribution this sample is
        // too small to describe.
        meanCostUsdPerCall: perCallUsd,
        observations: observations.length,
        poolSha256,
        providerDeltaUsd,
        providerUsageAfterUsd,
        providerUsageBeforeUsd,
        schemaVersion: 1,
        sourceAttemptsDirectory: sourceDirectory,
        spentUsd: guard.actualSpentUsd,
        startedAt: runStartedAt,
      },
      null,
      2,
    )}\n`,
    directory: resultsDirectory,
    fileName: 'checker-cost-measurement.json',
  });

  // A measurement spends real money, so it writes a ledger like any run. Without
  // one, envelope accounting cannot see the spend at all: the cost lives only in
  // a bespoke artefact nothing else reads.
  await writeRunArtifact({
    content: `${JSON.stringify({
      attempt: 1,
      candidateId: 'checker-measurement',
      caseId: 'checker-measurement',
      costSource: 'ACTUAL',
      costUsd: guard.actualSpentUsd,
      errorCode: null,
      latencyMs: 0,
      modelId: input.identities.checkerModelId,
      providerRoute: null,
      repetition: 1,
      status: 'VALID',
    })}\n`,
    directory: resultsDirectory,
    fileName: 'ledger.jsonl',
  });

  await releaseRunLock(directory);
  return {
    callsMade,
    observations: observations.length,
    resultsDirectory,
    spentUsd: guard.actualSpentUsd,
  };
}

export const measuredCostsSchema = z
  .object({
    entries: z
      .array(
        z
          .object({
            modelId: z.string().trim().min(1),
            observations: z.number().int().positive(),
            profileFamily: z.string().trim().min(1),
            retryFactor: z.number().positive(),
            retryFactorNote: z.string().trim().min(1),
            role: z.enum(['PRIMARY', 'CHECKER']),
            sourceDirectory: z.string().trim().min(1),
            sourceNote: z.string().trim().min(1),
            statistic: z.enum(['P90', 'MEAN']),
            statisticNote: z.string().trim().min(1).optional(),
            usdPerCall: z.number().positive(),
          })
          .strict(),
      )
      .min(1),
    note: z.string().trim().min(1),
    safetyFactor: z.number().positive(),
    schemaVersion: z.literal(1),
  })
  .strict();

export type MeasuredCosts = z.infer<typeof measuredCostsSchema>;

/**
 * The bound a measured distribution supports for one half of the bill.
 *
 * `calls × usdPerCall × retryFactor × safetyFactor`. The safety factor is what
 * keeps a bound a bound: a measured P90 is a description of what happened, not
 * a promise about what will.
 */
export function measuredBoundUsd(input: {
  calls: number;
  entry: MeasuredCosts['entries'][number];
  safetyFactor: number;
}): number {
  return (
    input.calls *
    input.entry.usdPerCall *
    input.entry.retryFactor *
    input.safetyFactor
  );
}

/**
 * Chooses the convention for a run.
 *
 * v2 applies only where a measured entry exists for **this** model and profile
 * family — spec §4. A distribution measured on one model says nothing about
 * another, and a bound borrowed across models would be a guess wearing the
 * costume of a measurement. Where no entry matches, the half falls back to v1,
 * and the artefact says which half used what.
 */
export function selectBoundingConvention(input: {
  checkerModelId: string;
  measured: MeasuredCosts | undefined;
  primaryModelId: string;
  profileFamily: string;
}): {
  checker: MeasuredCosts['entries'][number] | undefined;
  convention: 'measured-p90-v2' | 'conservative-v1';
  primary: MeasuredCosts['entries'][number] | undefined;
} {
  const find = (
    role: 'PRIMARY' | 'CHECKER',
    modelId: string,
  ): MeasuredCosts['entries'][number] | undefined =>
    input.measured?.entries.find(
      (entry) =>
        entry.role === role &&
        entry.modelId === modelId &&
        entry.profileFamily === input.profileFamily,
    );

  const primary = find('PRIMARY', input.primaryModelId);
  const checker = find('CHECKER', input.checkerModelId);
  return {
    checker,
    // The primary is the bulk of the bill: without a measurement for it, the
    // run is bounded conservatively whatever the checker has.
    convention: primary ? 'measured-p90-v2' : 'conservative-v1',
    primary,
  };
}
