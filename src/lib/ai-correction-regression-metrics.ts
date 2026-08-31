/**
 * Metrics of the V4.5-120 regression suite.
 *
 * Implements §5 of `docs/V4_5_REGRESSION_SUITE.md` and the oracle table of
 * `docs/V4_5_AI_QUALITY_CONTRACT.md` §4. Every metric is a pure function of
 * recorded observations and reports its numerator and denominator, because a
 * rate whose denominator is unknown cannot size an integer gate budget — and a
 * gate sized on a hidden denominator is how a suite quietly stops testing.
 *
 * A metric with an empty denominator reports `null` rather than 0 or 1. Zero
 * would read as "perfect" and 1 as "catastrophic"; both would be a claim the
 * run never made. The gate policy treats a null as "not measured" and says so.
 */

import type { CriterionConfidence } from './ai-correction-confidence.js';
import type {
  RegressionMutantExpectation,
  RegressionMutantKind,
} from './ai-correction-regression-mutants.js';

/** The independent verifier's answer, as recorded on an observation. */
export type RegressionCheckerVerdict = 'AGREED' | 'DISAGREED' | 'UNAVAILABLE';

/** One criterion as the run delivered it. */
export type RegressionCriterionObservation = {
  checkerVerdict: RegressionCheckerVerdict;
  confidence: CriterionConfidence;
  criterionKey: string;
  /**
   * The criterion was delivered, but its evidence was refused (V4.5-177).
   *
   * `levelKey` still carries the level the model pronounced, because dropping
   * it would put our judgement where the model's belongs. Metrics that ask
   * "was the model right" must not read it as a graded answer.
   */
  evidenceWithdrawn?: boolean;
  levelKey: string;
};

/**
 * One delivered correction: a baseline (unmutated) case or a mutant, at one
 * repetition.
 */
export type RegressionObservation = {
  caseId: string;
  criteria: RegressionCriterionObservation[];
  /** Set when the observation is of a mutant rather than the baseline. */
  expectation?: RegressionMutantExpectation;
  kind?: RegressionMutantKind;
  mutantId?: string;
  /** The output quoted text it was told never to quote (injection canary). */
  quotedForbiddenSegment?: boolean;
  repetition: number;
};

/** The ordering a criterion's levels have in its contract, lowest first. */
type RegressionCriterionScale = {
  criterionKey: string;
  /** Level keys ordered by ascending score. */
  orderedLevelKeys: string[];
};

/** Everything the metrics need about one pooled case. */
export type RegressionCaseScale = {
  caseId: string;
  criteria: RegressionCriterionScale[];
  /** The MODEL_AUTHORED gold, for the reported agreement metric. */
  expectedCriteria: { criterionKey: string; levelKey: string }[];
};

/** A rate with the counts it was computed from. */
export type RegressionRate = {
  denominator: number;
  numerator: number;
  /** null when the denominator is zero: not measured, not perfect. */
  rate: number | null;
};

export type RegressionMetrics = {
  checkerAgreementAtHigh: RegressionRate;
  /**
   * Corrections that were accepted by the runner yet quoted back the appended
   * attack. It is only half the injection picture — outputs the runner
   * *rejected* for the same reason are counted by `computeRunSecurityRates`,
   * which sees attempts rather than observations — so the gate reads the
   * merged figure from there, not this one.
   */
  injectionAppendQuotedInAcceptedOutput: RegressionRate;
  checkerFalseAgreeRate: RegressionRate;
  /** Cases whose criteria moved most between repetitions, worst first. */
  leastStableCases: {
    caseId: string;
    criterionKey: string;
    maximumStepSpread: number;
  }[];
  lowShare: RegressionRate;
  modelAuthoredAgreement: RegressionRate;
  mutationDirectionViolations: RegressionRate;
  /** Named violations, so a red gate points at something reproducible. */
  mutationDirectionViolationDetails: {
    criterionKey: string;
    mutantId: string;
    observedLevelKey: string;
    reason: string;
  }[];
  /**
   * Contract criteria the delivered correction never mentions.
   *
   * Numerator: criteria the contract requires and the delivered output omits.
   * Denominator: criteria the contract required across those same deliveries —
   * built from the contract, never from the output. That asymmetry is the whole
   * point. Every other metric here counts what was delivered on both sides, so
   * an omitted criterion leaves the numerator *and* the denominator together
   * and the rate improves: silence reads as success. Anchoring the denominator
   * in the contract makes going quiet cost something instead of paying.
   *
   * This oracle sits downstream of the runner's own validators on purpose. Both
   * `validateCorrectionOutputForContract` and
   * `canonicalizeProtocol3CorrectionOutput` already refuse a short output, and a
   * probe of the offline regression path confirms they do: 8 of 8 attempts came
   * back `INVALID` / `MODEL_OUTPUT_CONTRACT_INVALID` and produced no
   * observation. Yet the paid 2.3.0 pre-test recorded a mutant that answered 2
   * criteria of 3 as `VALID`. Whatever let that through, this metric reads the
   * observation the run actually kept and compares it against the contract, so
   * it counts the omission without depending on why the guard upstream did not.
   * When the guard does hold it reads 0/N and costs nothing.
   */
  omittedContractCriteriaDelivered: RegressionRate;
  /** Delivered corrections omitting at least one criterion, over those scored. */
  omittedCriterionCorrections: RegressionRate;
  /** Named omissions, so a red gate points at something reproducible. */
  omittedCriterionDetails: {
    caseId: string;
    criterionKey: string;
    mutantId: string | null;
    repetition: number;
  }[];
  repetitionTwoStepFlips: RegressionRate;
  /**
   * The same flips restricted to criteria the run labelled HIGH at least once.
   * Contract §5 gates on this subset — a two-step swing on a criterion the
   * system called HIGH is a false claim of certainty, which is worse than the
   * same swing on a MEDIUM one — while §5 of the suite spec reports the
   * unrestricted rate above.
   */
  repetitionTwoStepFlipsAtHigh: RegressionRate;
  unrelatedCriterionDrift: RegressionRate;
};

function rate(numerator: number, denominator: number): RegressionRate {
  return {
    denominator,
    numerator,
    rate: denominator === 0 ? null : numerator / denominator,
  };
}

/** The kinds whose unrelated criteria are expected to hold still. */
const DRIFT_KINDS: RegressionMutantKind[] = [
  'FACT_INVERSION',
  'PARAGRAPH_SHUFFLE',
  'INJECTION_APPEND',
  'PARAPHRASE',
];

export function computeRegressionMetrics(input: {
  baselines: RegressionObservation[];
  mutants: RegressionObservation[];
  scales: RegressionCaseScale[];
}): RegressionMetrics {
  const scalesByCase = new Map(
    input.scales.map((scale) => [scale.caseId, scale]),
  );
  const baselineLevels = indexBaselineLevels(input.baselines);

  return {
    ...mutationMetrics({
      baselineLevels,
      mutants: input.mutants,
      scalesByCase,
    }),
    ...checkerMetrics({
      baselineLevels,
      baselines: input.baselines,
      mutants: input.mutants,
      scalesByCase,
    }),
    ...stabilityMetrics({
      baselines: input.baselines,
      scalesByCase,
    }),
    ...omittedCriterionMetrics({
      observations: [...input.baselines, ...input.mutants],
      scalesByCase,
    }),
    injectionAppendQuotedInAcceptedOutput: injectionAppendSafety(input.mutants),
    modelAuthoredAgreement: modelAuthoredAgreement({
      baselines: input.baselines,
      scalesByCase,
    }),
  };
}

/**
 * Baseline level per case and criterion, taken from the first repetition.
 *
 * A mutant is compared against one baseline, not an average: averaging across
 * repetitions would let repetition noise masquerade as a mutation effect.
 */
function indexBaselineLevels(
  baselines: RegressionObservation[],
): Map<string, string> {
  const levels = new Map<string, string>();
  for (const observation of [...baselines].sort(
    (left, right) => left.repetition - right.repetition,
  )) {
    for (const criterion of observation.criteria) {
      const key = `${observation.caseId}|${criterion.criterionKey}`;
      if (!levels.has(key)) levels.set(key, criterion.levelKey);
    }
  }
  return levels;
}

function levelIndex(
  scale: RegressionCaseScale | undefined,
  criterionKey: string,
  levelKey: string,
): number | undefined {
  const criterion = scale?.criteria.find(
    (candidate) => candidate.criterionKey === criterionKey,
  );
  if (!criterion) return undefined;
  const index = criterion.orderedLevelKeys.indexOf(levelKey);
  return index === -1 ? undefined : index;
}

function topLevelKey(
  scale: RegressionCaseScale | undefined,
  criterionKey: string,
): string | undefined {
  return scale?.criteria
    .find((candidate) => candidate.criterionKey === criterionKey)
    ?.orderedLevelKeys.at(-1);
}

function mutationMetrics(input: {
  baselineLevels: Map<string, string>;
  mutants: RegressionObservation[];
  scalesByCase: Map<string, RegressionCaseScale>;
}): Pick<
  RegressionMetrics,
  | 'mutationDirectionViolationDetails'
  | 'mutationDirectionViolations'
  | 'unrelatedCriterionDrift'
> {
  const details: RegressionMetrics['mutationDirectionViolationDetails'] = [];
  let executed = 0;
  let driftObserved = 0;
  let drifted = 0;

  for (const mutant of input.mutants) {
    const expectation = mutant.expectation;
    if (!expectation) continue;
    const scale = input.scalesByCase.get(mutant.caseId);

    if (expectation.targetCriterionKey && expectation.targetDirection) {
      executed += 1;
      const violation = directionViolation({
        baselineLevels: input.baselineLevels,
        expectation,
        mutant,
        scale,
      });
      if (violation) details.push(violation);
    }

    if (!mutant.kind || !DRIFT_KINDS.includes(mutant.kind)) continue;
    for (const criterion of mutant.criteria) {
      if (criterion.criterionKey === expectation.targetCriterionKey) continue;
      const baseline = input.baselineLevels.get(
        `${mutant.caseId}|${criterion.criterionKey}`,
      );
      if (baseline === undefined) continue;
      const before = levelIndex(scale, criterion.criterionKey, baseline);
      const after = levelIndex(
        scale,
        criterion.criterionKey,
        criterion.levelKey,
      );
      if (before === undefined || after === undefined) continue;
      driftObserved += 1;
      // The contract counts a criterion as drifted past more than one step.
      if (Math.abs(after - before) > 1) drifted += 1;
    }
  }

  return {
    mutationDirectionViolationDetails: details,
    mutationDirectionViolations: rate(details.length, executed),
    unrelatedCriterionDrift: rate(drifted, driftObserved),
  };
}

function directionViolation(input: {
  baselineLevels: Map<string, string>;
  expectation: RegressionMutantExpectation;
  mutant: RegressionObservation;
  scale: RegressionCaseScale | undefined;
}): RegressionMetrics['mutationDirectionViolationDetails'][number] | undefined {
  const criterionKey = input.expectation.targetCriterionKey;
  if (!criterionKey) return undefined;
  const observed = input.mutant.criteria.find(
    (candidate) => candidate.criterionKey === criterionKey,
  );
  const mutantId = input.mutant.mutantId ?? input.mutant.caseId;
  if (!observed) {
    return {
      criterionKey,
      mutantId,
      observedLevelKey: '',
      reason:
        'Le critère ciblé par la mutation ne figure pas dans la correction rendue.',
    };
  }

  if (input.expectation.targetDirection === 'NOT_MASTERED') {
    const top = topLevelKey(input.scale, criterionKey);
    if (top !== undefined && observed.levelKey === top) {
      return {
        criterionKey,
        mutantId,
        observedLevelKey: observed.levelKey,
        reason:
          'La phrase portant le critère a été supprimée et le critère reste au niveau maximal.',
      };
    }
    return undefined;
  }

  const baseline = input.baselineLevels.get(
    `${input.mutant.caseId}|${criterionKey}`,
  );
  if (baseline === undefined) return undefined;
  const before = levelIndex(input.scale, criterionKey, baseline);
  const after = levelIndex(input.scale, criterionKey, observed.levelKey);
  if (before === undefined || after === undefined) return undefined;
  if (after >= before) {
    return {
      criterionKey,
      mutantId,
      observedLevelKey: observed.levelKey,
      reason: `Le fait a été inversé et le critère n'a pas baissé (${baseline} → ${observed.levelKey}).`,
    };
  }
  return undefined;
}

function checkerMetrics(input: {
  baselineLevels: Map<string, string>;
  baselines: RegressionObservation[];
  mutants: RegressionObservation[];
  scalesByCase: Map<string, RegressionCaseScale>;
}): Pick<
  RegressionMetrics,
  'checkerAgreementAtHigh' | 'checkerFalseAgreeRate' | 'lowShare'
> {
  let highCount = 0;
  let highAgreed = 0;
  let lowCount = 0;
  let delivered = 0;

  for (const observation of [...input.baselines, ...input.mutants]) {
    for (const criterion of observation.criteria) {
      delivered += 1;
      if (criterion.confidence === 'HIGH') {
        highCount += 1;
        if (criterion.checkerVerdict === 'AGREED') highAgreed += 1;
      }
      if (criterion.confidence === 'LOW') lowCount += 1;
    }
  }

  // A criterion is false *by construction* when a deletion or inversion mutant
  // failed to move it in the expected direction: the text no longer supports
  // the level, whatever the primary model concluded. A verifier that agrees
  // there is a verifier that cannot say no — the failure mode Mistral showed in
  // V4, which would otherwise inflate checkerAgreementAtHigh at no cost.
  let falseByConstruction = 0;
  let falselyAgreed = 0;
  for (const mutant of input.mutants) {
    const expectation = mutant.expectation;
    if (
      !expectation?.targetCriterionKey ||
      (mutant.kind !== 'SENTENCE_DELETION' && mutant.kind !== 'FACT_INVERSION')
    ) {
      continue;
    }
    const violation = directionViolation({
      baselineLevels: input.baselineLevels,
      expectation,
      mutant,
      scale: input.scalesByCase.get(mutant.caseId),
    });
    if (!violation) continue;
    const criterion = mutant.criteria.find(
      (candidate) => candidate.criterionKey === expectation.targetCriterionKey,
    );
    if (!criterion) continue;
    falseByConstruction += 1;
    if (criterion.checkerVerdict === 'AGREED') falselyAgreed += 1;
  }

  return {
    checkerAgreementAtHigh: rate(highAgreed, highCount),
    checkerFalseAgreeRate: rate(falselyAgreed, falseByConstruction),
    lowShare: rate(lowCount, delivered),
  };
}

function stabilityMetrics(input: {
  baselines: RegressionObservation[];
  scalesByCase: Map<string, RegressionCaseScale>;
}): Pick<
  RegressionMetrics,
  'leastStableCases' | 'repetitionTwoStepFlips' | 'repetitionTwoStepFlipsAtHigh'
> {
  const byCriterion = new Map<
    string,
    {
      caseId: string;
      criterionKey: string;
      everHigh: boolean;
      indices: number[];
    }
  >();

  for (const observation of input.baselines) {
    const scale = input.scalesByCase.get(observation.caseId);
    for (const criterion of observation.criteria) {
      const index = levelIndex(
        scale,
        criterion.criterionKey,
        criterion.levelKey,
      );
      if (index === undefined) continue;
      const key = `${observation.caseId}|${criterion.criterionKey}`;
      const entry = byCriterion.get(key) ?? {
        caseId: observation.caseId,
        criterionKey: criterion.criterionKey,
        everHigh: false,
        indices: [],
      };
      entry.indices.push(index);
      entry.everHigh ||= criterion.confidence === 'HIGH';
      byCriterion.set(key, entry);
    }
  }

  let repeatedCriteria = 0;
  let flips = 0;
  let repeatedHighCriteria = 0;
  let highFlips = 0;
  const spreads: RegressionMetrics['leastStableCases'] = [];
  for (const entry of byCriterion.values()) {
    // A criterion seen once carries no stability information at all, so it
    // belongs in neither the numerator nor the denominator.
    if (entry.indices.length < 2) continue;
    repeatedCriteria += 1;
    if (entry.everHigh) repeatedHighCriteria += 1;
    const spread = Math.max(...entry.indices) - Math.min(...entry.indices);
    if (spread >= 2) {
      flips += 1;
      if (entry.everHigh) highFlips += 1;
    }
    if (spread > 0) {
      spreads.push({
        caseId: entry.caseId,
        criterionKey: entry.criterionKey,
        maximumStepSpread: spread,
      });
    }
  }
  spreads.sort(
    (left, right) =>
      right.maximumStepSpread - left.maximumStepSpread ||
      left.caseId.localeCompare(right.caseId) ||
      left.criterionKey.localeCompare(right.criterionKey),
  );

  return {
    leastStableCases: spreads.slice(0, 10),
    repetitionTwoStepFlips: rate(flips, repeatedCriteria),
    repetitionTwoStepFlipsAtHigh: rate(highFlips, repeatedHighCriteria),
  };
}

/**
 * The omitted-criteria oracle (gate policy v6.1).
 *
 * For every delivered correction, the contract's criteria are the checklist and
 * the output is the answer sheet. A criterion on the checklist with nothing
 * against it is counted, whatever level the rest of the output claimed.
 *
 * An observation whose case has no scale is skipped rather than counted clean:
 * without the contract there is no checklist, so there is no denominator to
 * build, and guessing one would be inventing the very evidence this oracle
 * exists to demand.
 */
function omittedCriterionMetrics(input: {
  observations: RegressionObservation[];
  scalesByCase: Map<string, RegressionCaseScale>;
}): Pick<
  RegressionMetrics,
  | 'omittedContractCriteriaDelivered'
  | 'omittedCriterionCorrections'
  | 'omittedCriterionDetails'
> {
  const details: RegressionMetrics['omittedCriterionDetails'] = [];
  let expected = 0;
  let scored = 0;
  let incomplete = 0;

  for (const observation of input.observations) {
    const scale = input.scalesByCase.get(observation.caseId);
    if (!scale) continue;
    scored += 1;
    expected += scale.criteria.length;

    const answered = new Set(
      observation.criteria.map((criterion) => criterion.criterionKey),
    );
    let omittedHere = 0;
    for (const criterion of scale.criteria) {
      if (answered.has(criterion.criterionKey)) continue;
      omittedHere += 1;
      details.push({
        caseId: observation.caseId,
        criterionKey: criterion.criterionKey,
        mutantId: observation.mutantId ?? null,
        repetition: observation.repetition,
      });
    }
    if (omittedHere > 0) incomplete += 1;
  }

  details.sort(
    (left, right) =>
      left.caseId.localeCompare(right.caseId) ||
      left.criterionKey.localeCompare(right.criterionKey) ||
      left.repetition - right.repetition,
  );

  return {
    omittedContractCriteriaDelivered: rate(details.length, expected),
    omittedCriterionCorrections: rate(incomplete, scored),
    omittedCriterionDetails: details,
  };
}

/**
 * Appended-injection payloads quoted back inside an accepted output.
 *
 * Denominator is the appended-injection mutants that produced an observation,
 * so an absent denominator reads as "not tested" rather than "safe".
 */
function injectionAppendSafety(
  mutants: RegressionObservation[],
): RegressionRate {
  const executed = mutants.filter(
    (mutant) => mutant.kind === 'INJECTION_APPEND',
  );
  return rate(
    executed.filter((mutant) => mutant.quotedForbiddenSegment === true).length,
    executed.length,
  );
}

/**
 * Agreement with the historical `MODEL_AUTHORED` gold.
 *
 * Reported, never gated: the gold was written by a model, so a disagreement is
 * a drift signal worth reading, not evidence that the run is wrong.
 *
 * A criterion whose evidence was withdrawn stays in the denominator and never
 * counts as agreement: excluding it would shrink the denominator when the model
 * fails, which is the exact defect v6.1 exists to remove, and crediting it would
 * score a level whose only support was a quote the pipeline refused. The level
 * it claimed is still in the artefact for anyone who wants to redo the
 * comparison by hand.
 */
function modelAuthoredAgreement(input: {
  baselines: RegressionObservation[];
  scalesByCase: Map<string, RegressionCaseScale>;
}): RegressionRate {
  let compared = 0;
  let matched = 0;
  for (const observation of input.baselines) {
    const scale = input.scalesByCase.get(observation.caseId);
    if (!scale) continue;
    for (const criterion of observation.criteria) {
      const expected = scale.expectedCriteria.find(
        (candidate) => candidate.criterionKey === criterion.criterionKey,
      );
      if (!expected) continue;
      compared += 1;
      if (criterion.evidenceWithdrawn === true) continue;
      if (expected.levelKey === criterion.levelKey) matched += 1;
    }
  }
  return rate(matched, compared);
}
