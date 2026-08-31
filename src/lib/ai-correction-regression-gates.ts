/**
 * Gate policy v3 for the regression suite (V4.5-120).
 *
 * Implements §6 of `docs/V4_5_REGRESSION_SUITE.md` against the thresholds of
 * `docs/V4_5_AI_QUALITY_CONTRACT.md` §5.
 *
 * The point of v3 is that a threshold is only meaningful next to the number of
 * observations it was applied to. A "≤ 2 %" gate over 30 mutants cannot fail on
 * anything but zero violations, so stating it as a percentage hides that it is
 * really a zero-tolerance gate. Every rate threshold is therefore resolved into
 * an **integer budget** from the run's real denominator, and a blocking rate
 * finer than one observation (`p < 1/n`) is rejected outright rather than
 * silently rounded — the policy must say what it means.
 *
 * A gate whose metric was never measured (empty denominator) does not pass. It
 * reports `NOT_MEASURED`, which blocks promotion for a blocking gate: a suite
 * that measured nothing has proven nothing.
 */

import { z } from 'zod';

import type {
  RegressionMetrics,
  RegressionRate,
} from './ai-correction-regression-metrics.js';

export const REGRESSION_GATE_POLICY_VERSION = '6.0.0';

/**
 * `BLOCKING` forbids promotion when red. `WATCHED` is reported and reviewed but
 * does not block. `REPORTED` carries no threshold at all.
 */
const regressionGateKindSchema = z.enum(['BLOCKING', 'WATCHED', 'REPORTED']);

/**
 * `MAX_RATE` caps a rate, `MIN_RATE` floors one, `MAX_COUNT` caps a raw count
 * (used where the contract says "0" and means zero events, not zero percent).
 */
const regressionGateComparisonSchema = z.enum([
  'MAX_RATE',
  'MIN_RATE',
  'MAX_COUNT',
]);

const regressionGateSchema = z
  .object({
    comparison: regressionGateComparisonSchema,
    /** Why this gate exists, in the reviewer's language. */
    intent: z.string().trim().min(1),
    key: z.string().trim().min(1),
    kind: regressionGateKindSchema,
    /** The metric this gate reads. */
    metric: z.string().trim().min(1),
    /**
     * Smallest denominator at which this gate's threshold means anything.
     *
     * A rate threshold below 1/n resolves to a whole budget of zero, so the
     * gate silently becomes "no event at all" on a small sample — which is how
     * `mutation-direction-violations` came to fail on 1/10 under a 2 % rule,
     * and `checker-false-agree-rate` on 1/1. Declaring the minimum makes the
     * sample size a stated requirement rather than something a reader has to
     * derive from the threshold.
     */
    minimumDenominator: z.number().int().positive().optional(),
    threshold: z.number().nonnegative(),
  })
  .strict();

const regressionGatePolicySchema = z
  .object({
    gates: z.array(regressionGateSchema).min(1),
    policyVersion: z.literal(REGRESSION_GATE_POLICY_VERSION),
    schemaVersion: z.literal(1),
    sourceOfAuthority: z.string().trim().min(1),
  })
  .strict();

export type RegressionGatePolicy = z.infer<typeof regressionGatePolicySchema>;
type RegressionGate = z.infer<typeof regressionGateSchema>;

export function parseRegressionGatePolicy(
  source: unknown,
): RegressionGatePolicy {
  return regressionGatePolicySchema.parse(source);
}

type RegressionGateStatus = 'PASS' | 'FAIL' | 'NOT_MEASURED' | 'REPORTED';

export type RegressionGateResult = {
  /** The integer budget the rate threshold resolved to, when it has one. */
  budget: number | null;
  denominator: number;
  key: string;
  kind: RegressionGate['kind'];
  metric: string;
  numerator: number;
  observedRate: number | null;
  status: RegressionGateStatus;
  threshold: number;
};

export type RegressionGateEvaluation = {
  gateFailures: string[];
  gates: RegressionGateResult[];
  /** False when any blocking gate is red or unmeasured. */
  promotionEligible: boolean;
  /** Blocking gates whose threshold is finer than one observation. */
  policyErrors: string[];
};

/** The subset of metrics a gate can read, as rates. */
export type RegressionGateInputs = Pick<
  RegressionMetrics,
  | 'checkerAgreementAtHigh'
  | 'checkerFalseAgreeRate'
  | 'lowShare'
  | 'modelAuthoredAgreement'
  | 'mutationDirectionViolations'
  | 'repetitionTwoStepFlips'
  | 'repetitionTwoStepFlipsAtHigh'
  | 'unrelatedCriterionDrift'
> &
  Record<string, RegressionRate | unknown>;

/**
 * Resolves the policy against one run's measured metrics.
 *
 * Nothing here mutates a threshold to fit the result. A red gate stays red; the
 * only judgement the function makes is arithmetic.
 */
export function evaluateRegressionGates(input: {
  metrics: RegressionGateInputs;
  policy: RegressionGatePolicy;
}): RegressionGateEvaluation {
  const gates: RegressionGateResult[] = [];
  const gateFailures: string[] = [];
  const policyErrors: string[] = [];

  for (const gate of input.policy.gates) {
    const measured = input.metrics[gate.metric];
    if (!isRate(measured)) {
      policyErrors.push(
        `${gate.key} : la métrique ${gate.metric} est absente du résumé.`,
      );
      continue;
    }

    const result = evaluateGate({ gate, measured });
    gates.push(result);

    if (
      gate.kind === 'BLOCKING' &&
      gate.comparison === 'MAX_RATE' &&
      measured.denominator > 0 &&
      gate.threshold > 0 &&
      gate.threshold < 1 / measured.denominator
    ) {
      // Below the resolution of the sample: the gate cannot tolerate a single
      // event, so it must be declared MAX_COUNT 0 and reviewed as such.
      policyErrors.push(
        `${gate.key} : seuil ${gate.threshold} inférieur à 1/${measured.denominator} ; déclarer un budget entier explicite.`,
      );
    }

    if (
      gate.minimumDenominator !== undefined &&
      measured.denominator < gate.minimumDenominator
    ) {
      // Stated by the policy rather than inferred: the gate declares the
      // coverage its threshold needs, and a run below it says so instead of
      // reporting a verdict the sample cannot support.
      policyErrors.push(
        `${gate.key} : ${measured.denominator} observations pour un minimum déclaré de ${gate.minimumDenominator} ; le seuil ${gate.threshold} n'est pas énonçable sur cet échantillon.`,
      );
    }

    if (gate.kind === 'BLOCKING' && result.status !== 'PASS') {
      gateFailures.push(
        result.status === 'NOT_MEASURED'
          ? `${gate.key} : non mesuré (dénominateur nul).`
          : `${gate.key} : ${result.numerator}/${result.denominator} hors budget (${describeThreshold(gate, result)}).`,
      );
    }
  }

  return {
    gateFailures,
    gates,
    policyErrors,
    promotionEligible: gateFailures.length === 0 && policyErrors.length === 0,
  };
}

function evaluateGate(input: {
  gate: RegressionGate;
  measured: RegressionRate;
}): RegressionGateResult {
  const { gate, measured } = input;
  const base = {
    denominator: measured.denominator,
    key: gate.key,
    kind: gate.kind,
    metric: gate.metric,
    numerator: measured.numerator,
    observedRate: measured.rate,
    threshold: gate.threshold,
  };

  if (gate.kind === 'REPORTED') {
    return { ...base, budget: null, status: 'REPORTED' };
  }
  if (measured.denominator === 0) {
    return { ...base, budget: null, status: 'NOT_MEASURED' };
  }

  if (gate.comparison === 'MAX_COUNT') {
    return {
      ...base,
      budget: gate.threshold,
      status: measured.numerator <= gate.threshold ? 'PASS' : 'FAIL',
    };
  }

  if (gate.comparison === 'MIN_RATE') {
    return {
      ...base,
      // The floor expressed as the smallest acceptable count, so the report can
      // say "84 of 90 needed" rather than "0.9333 versus 0.9".
      budget: Math.ceil(gate.threshold * measured.denominator),
      status:
        measured.numerator >= Math.ceil(gate.threshold * measured.denominator)
          ? 'PASS'
          : 'FAIL',
    };
  }

  const budget = Math.floor(gate.threshold * measured.denominator);
  return {
    ...base,
    budget,
    status: measured.numerator <= budget ? 'PASS' : 'FAIL',
  };
}

function describeThreshold(
  gate: RegressionGate,
  result: RegressionGateResult,
): string {
  if (gate.comparison === 'MAX_COUNT') return `budget ${gate.threshold}`;
  if (gate.comparison === 'MIN_RATE') {
    return `minimum ${result.budget ?? 0} (${formatPercent(gate.threshold)})`;
  }
  return `budget ${result.budget ?? 0} (${formatPercent(gate.threshold)})`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1).replace(/\.0$/, '')} %`;
}

function isRate(value: unknown): value is RegressionRate {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as RegressionRate).denominator === 'number' &&
    typeof (value as RegressionRate).numerator === 'number'
  );
}
