import {
  readDesignedProbeEvidence,
  type DesignedProbeBinding,
  type DesignedCheckerIdentity,
} from './ai-correction-regression-probe-evidence.js';
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
  sourceGatePolicyVersion: string | null;
  interpretation: 'VERSIONED_REANALYSIS';
  gatePolicyVersion: string;
  simulatesValidatedFamily: boolean;
  attempts: BenchmarkAttempt[];
  /** Cells whose final attempt never produced a usable correction. */
  cellsUnusable: number;
  cellsObserved: number;
  /** Distinct repetitions seen, which the stability oracle depends on. */
  distinctRepetitions: number[];
  evaluation: RegressionGateEvaluation;
  /** Gates the policy declares, against which the evaluated count is read. */
  gatesDeclared: number;
  ledgerSpentUsd: number;
  metrics: RegressionMetrics;
  mutantCounts: Record<string, number>;
  /** Cells whose attempt numbering the run never recorded coherently. */
  malformedCells: string[];
  /** Attempts carrying no reconciled provider cost. */
  unreconciledAttempts: string[];
  verdictCount: number;
  legacyUnboundVerdictCount: number;
};

/** Reads every artefact an offline analysis needs from a results directory. */
export async function readRunArtifacts(resultsDirectory: string): Promise<{
  attempts: BenchmarkAttempt[];
  verdicts: Map<string, RegressionCheckerVerdict>;
  legacyUnboundVerdictCount: number;
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
      verdicts.set(verdictKey(record), record.verdict);
    }
  }
  return {
    attempts,
    verdicts,
    legacyUnboundVerdictCount: [...verdicts.keys()].filter((key) =>
      key.startsWith('legacy::'),
    ).length,
  };
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
  designedProbePath?: string;
  plan: RegressionRunPlan;
  resultsDirectory: string;
}): Promise<OfflineAnalysis> {
  const { attempts, verdicts, legacyUnboundVerdictCount } =
    await readRunArtifacts(input.resultsDirectory);
  const files = await readdir(input.resultsDirectory);
  const summary = files.includes('summary.json')
    ? (JSON.parse(
        await readFile(
          path.join(input.resultsDirectory, 'summary.json'),
          'utf8',
        ),
      ) as {
        qualification?: DesignedProbeBinding;
        checkerIdentity?: DesignedCheckerIdentity;
        simulatesValidatedFamily?: boolean;
        gatePolicyVersion?: string;
      })
    : {};
  const simulatesValidatedFamily = summary.simulatesValidatedFamily === true;
  let designedCheckerProbe;
  if (files.includes('designed-checker-probe.json')) {
    if (
      !summary.qualification ||
      summary.qualification.simulatesValidatedFamily !==
        simulatesValidatedFamily
    )
      throw new Error('DESIGNED_PROBE_BINDING_MISSING');
    designedCheckerProbe = (
      await readDesignedProbeEvidence({
        evidencePath: path.join(
          input.resultsDirectory,
          'designed-checker-probe.json',
        ),
        probePath:
          input.designedProbePath ??
          path.resolve(
            'benchmarks/ai-correction/regression/false-agree-probe.v1.json',
          ),
        binding: summary.qualification,
      })
    ).result;
  }
  const policy = parseRegressionGatePolicy(
    JSON.parse(await readFile(input.gatePolicyPath, 'utf8')) as unknown,
  );

  const observations = await deriveRegressionObservations({
    attempts,
    checkerIdentity: summary.checkerIdentity ?? null,
    familyScientificallyValidated: simulatesValidatedFamily,
    persistedVerdicts: verdicts,
    plan: input.plan,
  });
  const { baselines, mutants } = partitionObservations(observations);
  const metrics = computeRegressionMetrics({
    attempts,
    designedCheckerProbe,
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
    sourceGatePolicyVersion: summary.gatePolicyVersion ?? null,
    interpretation: 'VERSIONED_REANALYSIS',
    gatePolicyVersion: policy.policyVersion,
    simulatesValidatedFamily,
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
    gatesDeclared: policy.gates.length,
    ledgerSpentUsd: attempts.reduce(
      (total, attempt) => total + (attempt.usage?.actualCostUsd ?? 0),
      0,
    ),
    malformedCells: security.malformedCells,
    metrics,
    mutantCounts: countMutantsByKind(input.plan, executedCaseIds),
    unreconciledAttempts: attempts
      .filter((attempt) => attempt.usage?.costSource !== 'ACTUAL')
      .map((attempt) => attempt.caseId),
    verdictCount: verdicts.size - legacyUnboundVerdictCount,
    legacyUnboundVerdictCount,
  };
}
