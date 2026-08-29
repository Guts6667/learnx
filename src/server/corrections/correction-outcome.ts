import type {
  CorrectionContract,
  Protocol3CorrectionArtifactOutput,
} from '../../lib/ai-correction-contracts.js';
import type { CheckerVerdict } from './correction-checker.js';
import {
  allowsIndicativeScore,
  deriveCorrectionConfidence,
  deriveCriterionConfidence,
  type CorrectionConfidenceInput,
  type CriterionConfidence,
  type CriterionConfidenceInput,
} from '../../lib/ai-correction-confidence.js';
import type { CorrectionMonitoringSignal } from './correction-monitoring.js';
import type { OrchestratedCorrectionResult } from './correction-orchestration-contracts.js';
import { PROMOTED_CORRECTION_IDENTITY } from './promoted-identity.js';

type DeliveredCriterion = Protocol3CorrectionArtifactOutput['criteria'][number];

const HARD_CONSTRAINT =
  /\b(contrainte|interdit(?:e|es|s)?|violation|constraint|forbidden)\b/i;

/** Widened from the `as const` tuple so any activity family can be tested. */
const SCIENTIFICALLY_VALIDATED_FAMILIES: readonly string[] =
  PROMOTED_CORRECTION_IDENTITY.scientificallyValidatedActivityTypeScope;

function weightedIndicativeScore(
  contract: CorrectionContract,
  output: Protocol3CorrectionArtifactOutput,
): number {
  const deliveredWeight = output.criteria.reduce(
    (total, item) =>
      total +
      (contract.criteria.find(
        (candidate) => candidate.key === item.criterionKey,
      )?.weight ?? 0),
    0,
  );
  if (deliveredWeight <= 0) return 0;
  const total = output.criteria.reduce((sum, item) => {
    const criterion = contract.criteria.find(
      (candidate) => candidate.key === item.criterionKey,
    );
    const score = criterion?.performanceLevels.find(
      (level) => level.key === item.levelKey,
    )?.score;
    return (
      sum + (criterion && score !== undefined ? criterion.weight * score : 0)
    );
  }, 0);
  return Math.round((total / deliveredWeight) * 100) / 100;
}

function criterionLevelLabel(
  contract: CorrectionContract,
  criterionKey: string,
  levelKey: string,
): string {
  return (
    contract.criteria
      .find((criterion) => criterion.key === criterionKey)
      ?.performanceLevels.find((level) => level.key === levelKey)?.label ??
    levelKey
  );
}

/**
 * Where the selected level sits in its criterion's rubric, or `null` when the
 * contract does not describe the criterion or the level. An unplaceable level
 * is neither extreme, which keeps its confidence at MEDIUM rather than
 * inventing a position.
 */
function levelPosition(
  contract: CorrectionContract,
  item: DeliveredCriterion,
): { isFloorLevel: boolean; isMasteredLevel: boolean } | null {
  const levels = contract.criteria.find(
    (candidate) => candidate.key === item.criterionKey,
  )?.performanceLevels;
  const selected = levels?.find((level) => level.key === item.levelKey);
  if (!levels || !selected) return null;
  const scores = levels.map((level) => level.score);
  return {
    isFloorLevel: selected.score === Math.min(...scores),
    isMasteredLevel: selected.score === Math.max(...scores),
  };
}

/**
 * The signals that decide one delivered criterion's confidence, every one of
 * them established by the server.
 *
 * `item.confidence` — the number the model reports about its own certainty —
 * is deliberately never read here. Trusting it was the defect in the V4 score
 * guard, and V4.5-110 exists to stop trusting it.
 */
function confidenceSignalsFor(
  contract: CorrectionContract,
  item: DeliveredCriterion,
  verdict: CheckerVerdict,
): CriterionConfidenceInput {
  const position = levelPosition(contract, item);
  return {
    // Delivered criteria are exactly those the deterministic evidence checker
    // accepted: a quote it could not tie to the production sends its criterion
    // to `unsureCriteria` instead, never to `criteria`
    // (ai-correction-benchmark-evidence-delivery.ts).
    citation: 'VERIFIED',
    evidenceStatus: item.evidenceStatus,
    // The feedback names a hard-constraint violation while the level sits above
    // the floor: the model contradicting itself inside one criterion.
    hardConstraintMismatch:
      HARD_CONSTRAINT.test(item.feedback) && position?.isFloorLevel === false,
    isFloorLevel: position?.isFloorLevel ?? false,
    isMasteredLevel: position?.isMasteredLevel ?? false,
    // The independent checker's answer for this criterion. A criterion it did
    // not reach is UNAVAILABLE, never AGREED: unchecked is not checked, and
    // claiming otherwise would repeat the V4 mistake in a new place.
    verifier: verdict,
  };
}

export function buildCorrectionOutcome(input: {
  contract: CorrectionContract;
  output: Protocol3CorrectionArtifactOutput;
  unsureCriteria: string[];
  usageCost: number | null;
  /** The checker's answer per criterion key. Absent keys are UNAVAILABLE. */
  verdicts: Record<string, CheckerVerdict>;
}): OrchestratedCorrectionResult['correction'] {
  const deliveredAll = input.unsureCriteria.length === 0;
  const score = deliveredAll
    ? weightedIndicativeScore(input.contract, input.output)
    : null;

  const delivered = input.output.criteria.map((item) => ({
    item,
    signals: confidenceSignalsFor(
      input.contract,
      item,
      input.verdicts[item.criterionKey] ?? 'UNAVAILABLE',
    ),
  }));
  const correctionSignals: CorrectionConfidenceInput = {
    criteria: delivered.map(({ signals }) => signals),
    familyScientificallyValidated: SCIENTIFICALLY_VALIDATED_FAMILIES.includes(
      input.contract.target.activityType,
    ),
  };

  const monitoringSignals: CorrectionMonitoringSignal[] = [];
  if (delivered.some(({ signals }) => signals.hardConstraintMismatch)) {
    monitoringSignals.push('HARD_CONSTRAINT_LEVEL_MISMATCH_SUSPECTED');
  }
  if (delivered.some(({ signals }) => signals.verifier === 'DISAGREED')) {
    monitoringSignals.push('CHECKER_DISAGREED');
  }
  if (delivered.some(({ signals }) => signals.verifier === 'UNAVAILABLE')) {
    monitoringSignals.push('CHECKER_UNAVAILABLE');
  }

  // A criterion returned as « à retravailler » is LOW by construction: nothing
  // about it was established. It never reaches `delivered`, so the
  // correction-wide label has to account for it here.
  const overallConfidence = deliveredAll
    ? deriveCorrectionConfidence(correctionSignals)
    : ('LOW' as const);
  const publishesScore =
    deliveredAll && allowsIndicativeScore(correctionSignals);

  return {
    id: '',
    status: deliveredAll ? 'COMPLETED' : 'COMPLETED_PARTIAL',
    criteria: delivered.map(({ item, signals }) => {
      const criterion = input.contract.criteria.find(
        (candidate) => candidate.key === item.criterionKey,
      );
      return {
        key: item.criterionKey,
        label: criterion?.label ?? item.criterionKey,
        weight: criterion?.weight ?? 0,
        levelKey: item.levelKey,
        levelLabel: criterionLevelLabel(
          input.contract,
          item.criterionKey,
          item.levelKey,
        ),
        evidenceStatus: item.evidenceStatus,
        evidenceQuotes: item.evidenceQuotes,
        feedback: item.feedback,
        confidence: deriveCriterionConfidence(signals),
      };
    }),
    unsureCriteria: input.unsureCriteria,
    unsureCriterionDetails: input.unsureCriteria.map((key) => ({
      key,
      label:
        input.contract.criteria.find((criterion) => criterion.key === key)
          ?.label ?? key,
    })),
    overallFeedback: input.output.overallFeedback,
    overallConfidence,
    indicativeScore: publishesScore ? score : null,
    modelUsageCostUsd: input.usageCost,
    monitoringSignals,
  };
}

export function failedCorrection(
  usageCost: number | null,
): OrchestratedCorrectionResult['correction'] {
  return {
    id: '',
    status: 'FAILED',
    criteria: [],
    unsureCriteria: [],
    unsureCriterionDetails: [],
    overallFeedback: null,
    overallConfidence: 'LOW',
    indicativeScore: null,
    modelUsageCostUsd: usageCost,
    monitoringSignals: [],
  };
}

/**
 * A correction as it comes back out of `structuredResult`, where rows written
 * before V4.5-110 have no confidence recorded.
 */
export type StoredCorrection = Omit<
  OrchestratedCorrectionResult['correction'],
  'criteria' | 'overallConfidence'
> & {
  criteria: Array<
    Omit<
      OrchestratedCorrectionResult['correction']['criteria'][number],
      'confidence'
    > & { confidence?: CriterionConfidence }
  >;
  overallConfidence?: CriterionConfidence;
};

/**
 * Corrections persisted before V4.5-110 carry no confidence in their stored
 * JSON, and the signals that would derive one were never stored either. The
 * read paths cast that JSON straight to the runtime type, so absence has to be
 * resolved to something rather than left as a hole the type denies.
 *
 * LOW is the conservative resolution: those corrections were produced under the
 * V4 score guard, which this ticket replaces precisely because it established
 * nothing. Its practical effect is that a pre-V4.5-110 correction shows no
 * indicative score in the UI. That is a product call as much as a technical
 * one, and it is isolated here so it can be changed in one place.
 */
export function withStoredConfidence(
  correction: StoredCorrection,
): OrchestratedCorrectionResult['correction'] {
  return {
    ...correction,
    criteria: correction.criteria.map((criterion) => ({
      ...criterion,
      confidence: criterion.confidence ?? 'LOW',
    })),
    overallConfidence: correction.overallConfidence ?? 'LOW',
  };
}
