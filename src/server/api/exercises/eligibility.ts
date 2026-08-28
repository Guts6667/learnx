import { resolveExerciseCorrectionContract } from '../../../lib/exercise-correction-contracts.js';
import { PROMOTED_CORRECTION_IDENTITY } from '../../corrections/promoted-identity.js';
import type { ExerciseRecord } from './types.js';

export function isExerciseAiCorrectionEligible(
  exercise: Omit<ExerciseRecord, 'submission'>,
): boolean {
  if (!exercise.language) return false;
  const eligibility = resolveExerciseCorrectionContract({
    activityKey: exercise.key,
    activityType: exercise.activityType,
    explicitContract: exercise.rubric,
    instructions: exercise.instructions,
    language: exercise.language,
    lessonObjectives: exercise.lessonObjectives,
    lessonSlug: exercise.lessonSlug,
    lessonSummary: exercise.lessonSummary,
    programSlug: exercise.programSlug,
    title: exercise.title,
  });
  return (
    eligibility.eligible &&
    PROMOTED_CORRECTION_IDENTITY.languageScope.some(
      (allowedLanguage) => allowedLanguage === exercise.language,
    ) &&
    eligibility.contract.target.kind === 'EXERCISE' &&
    PROMOTED_CORRECTION_IDENTITY.activityTypeScope.some(
      (activityType) =>
        activityType === eligibility.contract.target.activityType,
    )
  );
}
