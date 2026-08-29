import {
  getCorrectionContractRuntimeEligibility,
  type CorrectionContract,
} from './ai-correction-contracts.js';

/**
 * Contract resolution for stage assessments (V4.5-130).
 *
 * Deliberately narrower than the exercise resolver, which synthesises an
 * archetype contract when a lesson carries none. A stage assessment decides
 * whether a learner advances, and a contract derived from a title and a legacy
 * rubric — with no authored performance levels and no calibrated examples — is
 * not a basis for judging that. So there is no archetype here: an assessment
 * runs on an explicit, published, bound contract or it does not run.
 *
 * That also keeps a fact visible rather than papered over. As of 29 August 2026
 * every stage assessment in the seed data carries the legacy
 * `{criterion, requirements, weight}` rubric and none carries a v3 contract, so
 * nothing is eligible today. A synthesising resolver would have hidden that
 * behind corrections nobody authored.
 */

type StageAssessmentContractRefusal =
  /** No rubric at all, or one in the legacy pre-contract format. */
  | 'NO_EXPLICIT_CONTRACT'
  /** A contract exists but is not runnable — unpublished, invalid, expired. */
  | 'CONTRACT_NOT_RUNNABLE'
  /** The contract describes an exercise, not a stage assessment. */
  | 'CONTRACT_TARGET_MISMATCH'
  /**
   * The assessment has no stable key to bind the contract to, so belonging
   * cannot be checked. Exercises carry a `key` column; stage assessments carry
   * only an id, a stage and a position. Until a key convention exists, a valid
   * contract could be attached to the wrong assessment and nothing would
   * notice — so this refuses rather than trusts.
   */
  | 'CONTRACT_BINDING_UNAVAILABLE'
  | 'LANGUAGE_NOT_SUPPORTED';

export type ResolvedStageAssessmentCorrectionContract =
  | { contract: CorrectionContract; eligible: true }
  | { eligible: false; reasons: StageAssessmentContractRefusal[] };

export interface StageAssessmentCorrectionContractContext {
  /**
   * The assessment's stable key, or null while no key convention exists. Null
   * is not "unknown, carry on" — it is a refusal, because binding is what
   * stops one assessment's contract being used on another.
   */
  activityKey: string | null;
  explicitContract: unknown;
  language: string;
}

export function resolveStageAssessmentCorrectionContract(
  input: StageAssessmentCorrectionContractContext,
): ResolvedStageAssessmentCorrectionContract {
  if (input.language !== 'fr-FR') {
    return { eligible: false, reasons: ['LANGUAGE_NOT_SUPPORTED'] };
  }
  if (input.explicitContract === null || input.explicitContract === undefined) {
    return { eligible: false, reasons: ['NO_EXPLICIT_CONTRACT'] };
  }

  const eligibility = getCorrectionContractRuntimeEligibility(
    input.explicitContract,
  );
  if (!eligibility.eligible) {
    return { eligible: false, reasons: ['CONTRACT_NOT_RUNNABLE'] };
  }
  if (eligibility.contract.target.kind !== 'STAGE_ASSESSMENT') {
    return { eligible: false, reasons: ['CONTRACT_TARGET_MISMATCH'] };
  }
  if (input.activityKey === null) {
    return { eligible: false, reasons: ['CONTRACT_BINDING_UNAVAILABLE'] };
  }
  if (eligibility.contract.target.activityKey !== input.activityKey) {
    return { eligible: false, reasons: ['CONTRACT_TARGET_MISMATCH'] };
  }

  return { contract: eligibility.contract, eligible: true };
}
