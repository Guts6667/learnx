import { isExerciseAiCorrectionEligible } from './eligibility.js';
import type { ExerciseRepository, ExerciseService } from './types.js';
import {
  assertSubmissionEditable,
  assertSubmissionSubmittable,
  exerciseNotFound,
} from './validation.js';

export function createExerciseService(
  repository: ExerciseRepository,
  now: () => Date,
): ExerciseService {
  return {
    async createSubmission(exerciseId, userId) {
      const exercise = await repository.findExerciseForUser(exerciseId, userId);
      if (!exercise) throw exerciseNotFound();
      return repository.createOrGetSubmission(exerciseId, userId);
    },

    async getExercise(exerciseId, userId) {
      const exercise = await repository.findExerciseForUser(exerciseId, userId);
      if (!exercise) throw exerciseNotFound();
      return {
        ...exercise,
        aiCorrectionEligible: isExerciseAiCorrectionEligible(exercise),
      };
    },

    async saveSubmission(submissionId, contentMarkdown, userId) {
      const submission = await repository.findOwnedSubmission(
        submissionId,
        userId,
      );
      if (!submission) throw exerciseNotFound();
      assertSubmissionEditable(submission);
      return repository.saveSubmission(submissionId, contentMarkdown, userId);
    },

    async submitSubmission(submissionId, userId) {
      const submission = await repository.findOwnedSubmission(
        submissionId,
        userId,
      );
      if (!submission) throw exerciseNotFound();
      assertSubmissionSubmittable(submission);
      return repository.submitSubmission(submissionId, now(), userId);
    },
  };
}
