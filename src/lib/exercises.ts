export type ExerciseSubmissionState = 'DRAFT' | 'SUBMITTED';

export const MAX_EXERCISE_SUBMISSION_CHARACTERS = 1_500;

function assertExerciseSubmissionContentWithinLimit(
  contentMarkdown: string,
): void {
  if (contentMarkdown.length > MAX_EXERCISE_SUBMISSION_CHARACTERS) {
    throw new Error(
      `Exercise content must not exceed ${MAX_EXERCISE_SUBMISSION_CHARACTERS} characters.`,
    );
  }
}

export function assertExerciseSubmissionCanBeEdited(
  status: ExerciseSubmissionState,
): void {
  if (status !== 'DRAFT') {
    throw new Error('A submitted exercise can no longer be edited.');
  }
}

export function assertExerciseSubmissionCanBeSubmitted(submission: {
  contentMarkdown: string;
  status: ExerciseSubmissionState;
}): void {
  assertExerciseSubmissionCanBeEdited(submission.status);
  assertExerciseSubmissionContentWithinLimit(submission.contentMarkdown);

  if (!submission.contentMarkdown.trim()) {
    throw new Error('Exercise content is required before submission.');
  }
}
