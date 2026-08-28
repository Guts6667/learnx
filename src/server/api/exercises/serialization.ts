import type { ExerciseSubmissionRecord } from './types.js';

export function serializeExerciseSubmission(
  submission: ExerciseSubmissionRecord,
) {
  return {
    ...submission,
    createdAt: submission.createdAt.toISOString(),
    submittedAt: submission.submittedAt?.toISOString() ?? null,
    updatedAt: submission.updatedAt.toISOString(),
  };
}
