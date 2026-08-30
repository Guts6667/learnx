/**
 * Offline analysis of a results directory (V4.5-125).
 *
 * A run that has bought its cells must never need to buy them again to be
 * understood. On 30 August a run dispatched all 200 cells, wrote 216 attempts
 * and 438 verifier verdicts, then died before writing a summary — because a
 * single verifier call reported no cost and the budget guard refused it. The
 * money was spent; the measurement was not produced.
 *
 * This module turns a results directory into the measurement, with no dispatch
 * and no provider call except the optional usage read for reconciliation.
 * Verdicts already persisted are reused, never re-bought.
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import type { BenchmarkAttempt } from './ai-correction-benchmark-artifacts.js';
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
  computeRunSecurityRates,
  countMutantsByKind,
  deriveRegressionObservations,
  partitionObservations,
  verdictKey,
  type RegressionRunPlan,
  type RegressionVerdictRecord,
} from './ai-correction-regression-run.js';

export type OfflineAnalysis = {
  attempts: BenchmarkAttempt[];
  /** Cells whose final attempt never produced a usable correction. */
  cellsUnusable: number;
  cellsObserved: number;
  /** Distinct repetitions seen, which the stability oracle depends on. */
  distinctRepetitions: number[];
  evaluation: RegressionGateEvaluation;
  ledgerSpentUsd: number;
  metrics: RegressionMetrics;
  mutantCounts: Record<string, number>;
  /** Attempts carrying no reconciled provider cost. */
  unreconciledAttempts: string[];
  verdictCount: number;
};

/** Reads every artefact an offline analysis needs from a results directory. */
export async function readRunArtifacts(resultsDirectory: string): Promise<{
  attempts: BenchmarkAttempt[];
  verdicts: Map<string, RegressionCheckerVerdict>;
}> {
  const attempts = JSON.parse(
    await readFile(path.join(resultsDirectory, 'attempts.json'), 'utf8'),
  ) as BenchmarkAttempt[];

  const verdicts = new Map<string, RegressionCheckerVerdict>();
  const files = await readdir(resultsDirectory);
  if (files.includes('checker-verdicts.json')) {
    const records = JSON.parse(
      await readFile(
        path.join(resultsDirectory, 'checker-verdicts.json'),
        'utf8',
      ),
    ) as RegressionVerdictRecord[];
    for (const record of records) {
      verdicts.set(
        verdictKey({
          criterionKey: record.criterionKey,
          unitId: record.unitId,
        }),
        record.verdict,
      );
    }
  }
  return { attempts, verdicts };
}

/**
 * Final attempt per cell.
 *
 * A cell is one `(candidate, case, repetition)`. With a retry policy in force
 * the same cell has several attempts, and only the last one decides whether the
 * learner would have received a correction — which is what the unusable gate is
 * about. Counting attempts instead of cells would report a retried-and-
 * recovered cell as a failure.
 */
export function finalAttemptPerCell(
  attempts: BenchmarkAttempt[],
): BenchmarkAttempt[] {
  const byCell = new Map<string, BenchmarkAttempt>();
  for (const attempt of attempts) {
    const key = `${attempt.candidateId}|${attempt.caseId}|${attempt.repetition}`;
    const current = byCell.get(key);
    if (!current || attempt.attempt >= current.attempt)
      byCell.set(key, attempt);
  }
  return [...byCell.values()];
}

/** Percentile of a sorted-on-the-fly numeric sample. */
export function percentileOf(
  values: number[],
  fraction: number,
): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.floor(fraction * sorted.length),
  );
  return sorted[index] ?? null;
}

/**
 * Produces the measurement from a results directory.
 *
 * Nothing here dispatches. `deriveRegressionObservations` is given the
 * persisted verdicts and **no checker**, so a verdict that was never bought
 * stays unbought and its oracle stays unmeasured, rather than being quietly
 * purchased during analysis.
 */
export async function analyseRunOffline(input: {
  gatePolicyPath: string;
  plan: RegressionRunPlan;
  resultsDirectory: string;
}): Promise<OfflineAnalysis> {
  const { attempts, verdicts } = await readRunArtifacts(input.resultsDirectory);
  const policy = parseRegressionGatePolicy(
    JSON.parse(await readFile(input.gatePolicyPath, 'utf8')) as unknown,
  );

  const observations = await deriveRegressionObservations({
    attempts,
    familyScientificallyValidated: true,
    persistedVerdicts: verdicts,
    plan: input.plan,
  });
  const { baselines, mutants } = partitionObservations(observations);
  const metrics = computeRegressionMetrics({
    baselines,
    mutants,
    scales: input.plan.scales,
  });

  const cells = finalAttemptPerCell(attempts);
  const unusable = cells.filter((attempt) => attempt.status !== 'VALID');
  const executedCaseIds = new Set(attempts.map((attempt) => attempt.caseId));

  // Computed from the attempts, never stubbed. A stubbed zero denominator
  // reports an oracle as unmeasured when it in fact ran — this run executed 15
  // appended-injection mutants, and a placeholder would have thrown their
  // result away and understated what was bought.
  const security = {
    ...computeRunSecurityRates({ attempts, observations, plan: input.plan }),
    eventualUnusableRuns: {
      denominator: cells.length,
      numerator: unusable.length,
      rate: cells.length === 0 ? null : unusable.length / cells.length,
    },
  };

  return {
    attempts,
    cellsObserved: cells.length,
    cellsUnusable: unusable.length,
    distinctRepetitions: [
      ...new Set(attempts.map((attempt) => attempt.repetition)),
    ].sort((left, right) => left - right),
    evaluation: evaluateRegressionGates({
      metrics: { ...metrics, ...security },
      policy,
    }),
    ledgerSpentUsd: attempts.reduce(
      (total, attempt) => total + (attempt.usage?.actualCostUsd ?? 0),
      0,
    ),
    metrics,
    mutantCounts: countMutantsByKind(input.plan, executedCaseIds),
    unreconciledAttempts: attempts
      .filter((attempt) => attempt.usage?.costSource !== 'ACTUAL')
      .map((attempt) => attempt.caseId),
    verdictCount: verdicts.size,
  };
}
