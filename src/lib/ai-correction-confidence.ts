/**
 * Confidence label per delivered criterion, V4.5-110.
 *
 * Lives in src/lib because the V4.5-120 regression runner needs it and src/lib
 * may never import src/server. It depends on nothing: every input is a plain
 * value the caller has already established, which is what makes it safe to
 * share between the runtime and the benchmark harness without either of them
 * reaching into the other.
 *
 * Implements §2 of `docs/V4_5_AI_QUALITY_CONTRACT.md`. Every input is a fact
 * the server can decide on its own: whether the quoted evidence survived the
 * deterministic checker, whether the selected level sits at an extreme of the
 * rubric, whether an independent verifier agreed. **The model's own declared
 * confidence is never an input** — that was the flaw in the V4 score guard,
 * which asked the model how sure it was and believed the answer.
 *
 * Changing the table here is a new version of the quality contract, not a
 * refactor.
 */

export type CriterionConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

/** Whether the deterministic checker could tie the quote to the production. */
type CitationVerdict = 'VERIFIED' | 'ABSENT' | 'AMBIGUOUS' | 'REJECTED';

/** The independent verifier of V4.5-111, which may not have run. */
type VerifierVerdict = 'AGREED' | 'DISAGREED' | 'UNAVAILABLE';

export interface CriterionConfidenceInput {
  citation: CitationVerdict;
  /** The model reported finding no relevant evidence for this criterion. */
  evidenceStatus: 'FOUND' | 'NO_RELEVANT_EVIDENCE';
  /** The selected level is the lowest the rubric offers for this criterion. */
  isFloorLevel: boolean;
  /** The selected level is the highest the rubric offers for this criterion. */
  isMasteredLevel: boolean;
  /** Feedback names a hard-constraint violation while the level sits above the floor. */
  hardConstraintMismatch: boolean;
  verifier: VerifierVerdict;
}

export interface CorrectionConfidenceInput {
  criteria: CriterionConfidenceInput[];
  /**
   * The activity family is inside
   * `PROMOTED_CORRECTION_IDENTITY.scientificallyValidatedActivityTypeScope`.
   * Outside it, nothing may be labelled HIGH however clean the signals look.
   */
  familyScientificallyValidated: boolean;
}

const ORDER: Record<CriterionConfidence, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

function lower(
  a: CriterionConfidence,
  b: CriterionConfidence,
): CriterionConfidence {
  return ORDER[a] <= ORDER[b] ? a : b;
}

/**
 * The table, in the contract's order. The LOW rules come first because they are
 * disqualifying: no combination of good signals can lift a criterion whose
 * evidence did not survive checking.
 */
export function deriveCriterionConfidence(
  input: CriterionConfidenceInput,
): CriterionConfidence {
  if (input.citation !== 'VERIFIED' && input.evidenceStatus === 'FOUND') {
    return 'LOW';
  }
  if (input.hardConstraintMismatch) return 'LOW';
  if (input.verifier === 'DISAGREED') return 'LOW';

  // The model claims it found nothing and graded at the floor, which is the
  // behaviour the prompt asks for. Coherent, but nothing was verified either.
  if (input.evidenceStatus === 'NO_RELEVANT_EVIDENCE') {
    return input.isFloorLevel ? 'MEDIUM' : 'LOW';
  }

  if (input.verifier === 'UNAVAILABLE') return 'MEDIUM';

  const extreme = input.isFloorLevel || input.isMasteredLevel;
  return extreme ? 'HIGH' : 'MEDIUM';
}

/**
 * Confidence for the whole correction: the weakest criterion, capped when a
 * correction-wide signal forbids the top label.
 */
export function deriveCorrectionConfidence(
  input: CorrectionConfidenceInput,
): CriterionConfidence {
  const ceiling: CriterionConfidence =
    input.familyScientificallyValidated &&
    !input.criteria.some((criterion) => criterion.verifier === 'UNAVAILABLE')
      ? 'HIGH'
      : 'MEDIUM';

  if (input.criteria.length === 0) return 'LOW';

  return input.criteria.reduce<CriterionConfidence>(
    (weakest, criterion) =>
      lower(weakest, lower(deriveCriterionConfidence(criterion), ceiling)),
    ceiling,
  );
}

/**
 * An indicative score is published only when every delivered criterion is HIGH
 * or MEDIUM. One LOW criterion makes the total unsafe to show, so the contract
 * withholds the number rather than qualifying it.
 */
export function allowsIndicativeScore(
  input: CorrectionConfidenceInput,
): boolean {
  return (
    input.criteria.length > 0 &&
    input.criteria.every(
      (criterion) => deriveCriterionConfidence(criterion) !== 'LOW',
    )
  );
}
