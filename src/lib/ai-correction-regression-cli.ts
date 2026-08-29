/**
 * Regression-suite subcommands of the benchmark CLI (V4.5-120).
 *
 * These run entirely offline: `--build-pool` reads the historical corpora and
 * writes the pool, `--pool` validates one. Neither ever contacts a provider,
 * which is why they sit in front of `loadBenchmarkInputs` in the CLI rather
 * than behind it — validating a pool must not require a benchmark
 * configuration, still less an API key.
 */

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import {
  buildRegressionPool,
  collectAuthoredHints,
  type RegressionPoolSourceInput,
} from './ai-correction-regression-pool-build.js';
import {
  loadRegressionSource,
  parseRegressionPool,
  regressionMutationHintSchema,
  validateRegressionPool,
  type LoadedRegressionSource,
  type RegressionMutationHint,
  type RegressionPool,
} from './ai-correction-regression-pool.js';

export const benchmarkDirectory = path.resolve('benchmarks/ai-correction');
export const regressionDirectory = path.join(benchmarkDirectory, 'regression');
export const defaultPoolFileName = 'regression-pool.v1.json';
export const defaultHintsFileName = 'mutation-hints.v1.json';

/**
 * The authored hints live in their own artefact rather than only inside the
 * generated pool, so the one hand-written part of the suite reviews as its own
 * diff and a rebuild cannot quietly drop it.
 */
const mutationHintsArtefactSchema = z
  .object({
    hints: z.record(z.string(), z.array(regressionMutationHintSchema)),
    schemaVersion: z.literal(1),
  })
  .strict();

/** The pool identity and membership, per V4.5-120 and the owner's Q1 ruling. */
export const REGRESSION_POOL_ID = 'learnx-fr-regression-pool-v1';
export const REGRESSION_POOL_LANGUAGE = 'fr-FR';

/**
 * The five sealed historical corpora, and only those.
 *
 * The three `corpus.draft.json` files are excluded deliberately: a draft and
 * its sealed counterpart disagree on expected levels and even on response text,
 * so admitting both would put two contradicting `MODEL_AUTHORED` oracles on the
 * same case and make every drift measurement unreadable.
 */
export const REGRESSION_POOL_SOURCES: {
  path: string;
  role: RegressionPool['sources'][number]['role'];
}[] = [
  { path: '../corpus.v1.json', role: 'DEVELOPMENT_HISTORICAL' },
  { path: '../holdout.v1.json', role: 'HOLDOUT_HISTORICAL' },
  { path: '../holdout.v2.json', role: 'HOLDOUT_HISTORICAL' },
  { path: '../holdout.v3.json', role: 'HOLDOUT_HISTORICAL' },
  {
    path: '../hybrid/writing-only-fr-v1/corpus.sealed.json',
    role: 'WRITING_HOLDOUT_HISTORICAL',
  },
];

export const REGRESSION_POOL_EXCLUSIONS: RegressionPool['excluded'] = [
  {
    path: '../hybrid/writing-only-fr-v1/corpus.draft.json',
    reason:
      "Superseded by corpus.sealed.json, which disagrees with it on expected levels, second-pass expectations and response text. Admitting both would place two contradictory MODEL_AUTHORED oracles on one case.",
  },
  {
    path: '../hybrid/sonnet-v3-1-holdout-v3/corpus.draft.json',
    reason:
      'Unsealed draft never promoted to a run; its oracle was not reviewed and no result artefact references it.',
  },
  {
    path: '../hybrid/sonnet-v3-1-holdout-v4/corpus.draft.json',
    reason:
      'Unsealed draft never promoted to a run; its oracle was not reviewed and no result artefact references it.',
  },
];

/** Reads `--flag=value` or `--flag value`; returns undefined when absent. */
export function readCliOption(
  arguments_: string[],
  flag: string,
): string | undefined {
  const inline = arguments_.find((argument) =>
    argument.startsWith(`--${flag}=`),
  );
  if (inline) return inline.slice(`--${flag}=`.length);
  const index = arguments_.indexOf(`--${flag}`);
  if (index === -1) return undefined;
  const next = arguments_[index + 1];
  return next && !next.startsWith('--') ? next : undefined;
}

/** Resolves a pool path given as a bare file name, or a real path. */
export function resolvePoolPath(value: string): string {
  return value.includes('/') || path.isAbsolute(value)
    ? path.resolve(value)
    : path.join(regressionDirectory, value);
}

async function loadSources(
  poolPath: string,
  sources: { path: string; role: RegressionPool['sources'][number]['role'] }[],
): Promise<{
  inputs: RegressionPoolSourceInput[];
  loaded: Map<string, LoadedRegressionSource>;
}> {
  const poolDirectory = path.dirname(poolPath);
  const inputs: RegressionPoolSourceInput[] = [];
  const loaded = new Map<string, LoadedRegressionSource>();
  for (const source of sources) {
    const raw = await readFile(path.resolve(poolDirectory, source.path));
    const entry = loadRegressionSource(raw);
    loaded.set(source.path, entry);
    inputs.push({ path: source.path, role: source.role, source: entry });
  }
  return { inputs, loaded };
}

/**
 * `--build-pool` — aggregates the historical corpora into the pool file,
 * preserving any hints already authored in the existing pool.
 */
export async function runRegressionPoolBuild(
  arguments_: string[],
): Promise<void> {
  const poolPath = resolvePoolPath(
    readCliOption(arguments_, 'build-pool') ?? defaultPoolFileName,
  );
  const generatedAt =
    readCliOption(arguments_, 'generated-at') ?? new Date().toISOString();

  const authored = await readAuthoredHints(
    path.join(path.dirname(poolPath), defaultHintsFileName),
  );
  const existing = authored ? undefined : await readPoolIfPresent(poolPath);
  const hints = authored ?? (existing ? collectAuthoredHints(existing) : undefined);
  const { inputs } = await loadSources(poolPath, REGRESSION_POOL_SOURCES);
  const pool = buildRegressionPool({
    excluded: REGRESSION_POOL_EXCLUSIONS,
    generatedAt,
    ...(hints ? { hints } : {}),
    language: REGRESSION_POOL_LANGUAGE,
    poolId: REGRESSION_POOL_ID,
    sources: inputs,
  });

  await mkdir(path.dirname(poolPath), { recursive: true });
  await writeFile(poolPath, `${JSON.stringify(pool, null, 2)}\n`, 'utf8');
  const hinted = pool.cases.filter(
    (poolCase) => poolCase.mutationHints.length > 0,
  ).length;
  console.log(
    `Pool de régression écrit : ${poolPath} — ${pool.cases.length} cas issus de ${pool.sources.length} corpus, ${hinted} cas avec indices de mutation.`,
  );
}

/** Reads the authored hint artefact, if the author has written one yet. */
async function readAuthoredHints(
  hintsPath: string,
): Promise<Map<string, RegressionMutationHint[]> | undefined> {
  const raw = await readFileIfPresent(hintsPath);
  if (raw === undefined) return undefined;
  const artefact = mutationHintsArtefactSchema.parse(JSON.parse(raw) as unknown);
  return new Map(Object.entries(artefact.hints));
}

async function readFileIfPresent(
  filePath: string,
): Promise<string | undefined> {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (isMissingFile(error)) return undefined;
    throw error;
  }
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'ENOENT'
  );
}

async function readPoolIfPresent(
  poolPath: string,
): Promise<RegressionPool | undefined> {
  try {
    return parseRegressionPool(
      JSON.parse(await readFile(poolPath, 'utf8')) as unknown,
    );
  } catch (error) {
    if (isMissingFile(error)) return undefined;
    throw error;
  }
}

/**
 * `--pool=<file>` with `--validate-only` — schema, digests, oracle fidelity and
 * hint applicability. Exits non-zero by throwing when the pool is not green.
 */
export async function runRegressionPoolValidation(
  arguments_: string[],
): Promise<void> {
  const poolArgument = readCliOption(arguments_, 'pool');
  if (!poolArgument) throw new Error('REGRESSION_POOL_PATH_REQUIRED');
  const poolPath = resolvePoolPath(poolArgument);
  const pool = parseRegressionPool(
    JSON.parse(await readFile(poolPath, 'utf8')) as unknown,
  );
  const { loaded } = await loadSources(
    poolPath,
    pool.sources.map((source) => ({ path: source.path, role: source.role })),
  );
  const issues = validateRegressionPool({ pool, sources: loaded });
  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`${issue.path} — ${issue.code} : ${issue.message}`);
    }
    throw new Error('REGRESSION_POOL_INVALID');
  }
  const hinted = pool.cases.filter(
    (poolCase) => poolCase.mutationHints.length > 0,
  ).length;
  const hints = pool.cases.reduce(
    (total, poolCase) => total + poolCase.mutationHints.length,
    0,
  );
  console.log(
    `Pool validé hors ligne : ${pool.cases.length} cas, ${pool.sources.length} corpus épinglés, ${hints} indices de mutation sur ${hinted} cas.`,
  );
}
