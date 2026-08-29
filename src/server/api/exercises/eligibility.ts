import { resolveExerciseCorrectionContract } from '../../../lib/exercise-correction-contracts.js';
import { PROMOTED_CORRECTION_IDENTITY } from '../../corrections/promoted-identity.js';
import type { AiCorrectionValidationScope, ExerciseRecord } from './types.js';

/**
 * The family this exercise would be corrected as, and whether that family has
 * actually been through a sealed scientific evaluation.
 *
 * Eligibility and validation are different questions and the product must not
 * conflate them: `writing` is the only family with a sealed exam behind it,
 * while the runtime accepts four. Returning null when the exercise is not
 * eligible keeps callers from having to guess.
 */
export function resolveAiCorrectionValidationScope(
  exercise: Omit<ExerciseRecord, 'submission'>,
): AiCorrectionValidationScope | null {
  if (!exercise.language) return null;
  const eligibility = resolveContract(exercise);
  // Narrows the union before reading `contract`, which only the eligible
  // branch carries.
  if (!eligibility.eligible) return null;
  if (!isEligible(eligibility, exercise.language)) return null;
  // The family comes from the resolved contract, not from the raw record: the
  // record stores WRITING while the correction identity scopes on writing, and
  // the contract's value is the one the correction will actually run under.
  // Matching against the scope both narrows the wider contract union and
  // proves membership, rather than asserting it with a cast.
  const family = PROMOTED_CORRECTION_IDENTITY.activityTypeScope.find(
    (candidate) => candidate === eligibility.contract.target.activityType,
  );
  if (!family) return null;
  return {
    family,
    validated:
      PROMOTED_CORRECTION_IDENTITY.scientificallyValidatedActivityTypeScope.some(
        (validatedFamily) => validatedFamily === family,
      ),
  };
}

function resolveContract(exercise: Omit<ExerciseRecord, 'submission'>) {
  return resolveExerciseCorrectionContract({
    activityKey: exercise.key,
    activityType: exercise.activityType,
    explicitContract: exercise.rubric,
    instructions: exercise.instructions,
    language: exercise.language ?? '',
    lessonObjectives: exercise.lessonObjectives,
    lessonSlug: exercise.lessonSlug,
    lessonSummary: exercise.lessonSummary,
    programSlug: exercise.programSlug,
    title: exercise.title,
  });
}

function isEligible(
  eligibility: ReturnType<typeof resolveContract>,
  language: string,
): boolean {
  return (
    eligibility.eligible &&
    PROMOTED_CORRECTION_IDENTITY.languageScope.some(
      (allowedLanguage) => allowedLanguage === language,
    ) &&
    eligibility.contract.target.kind === 'EXERCISE' &&
    PROMOTED_CORRECTION_IDENTITY.activityTypeScope.some(
      (activityType) =>
        activityType === eligibility.contract.target.activityType,
    )
  );
}

export function isExerciseAiCorrectionEligible(
  exercise: Omit<ExerciseRecord, 'submission'>,
): boolean {
  if (!exercise.language) return false;
  return isEligible(resolveContract(exercise), exercise.language);
}
