export type ExerciseSubmissionState = 'DRAFT' | 'SUBMITTED';

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

  if (!submission.contentMarkdown.trim()) {
    throw new Error('Exercise content is required before submission.');
  }
}
