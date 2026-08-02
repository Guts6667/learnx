export type StageAssessmentSubmissionStatus =
  'DRAFT' | 'NEEDS_REVISION' | 'SUBMITTED' | 'VALIDATED';

export function assertStageCanBePublished(input: {
  assessmentCount: number;
}): void {
  if (input.assessmentCount < 1) {
    throw new Error('A published stage must have a final assessment.');
  }
}

export function assertSubmissionCanBeEdited(
  status: StageAssessmentSubmissionStatus,
): void {
  if (status !== 'DRAFT' && status !== 'NEEDS_REVISION') {
    throw new Error('Only draft submissions or revisions can be edited.');
  }
}

export function assertSubmissionCanBeSubmitted(input: {
  attachmentUrl: string | null;
  contentMarkdown: string | null;
  status: StageAssessmentSubmissionStatus;
}): void {
  assertSubmissionCanBeEdited(input.status);

  if (!input.contentMarkdown?.trim() && !input.attachmentUrl?.trim()) {
    throw new Error('A submission must contain text or an attachment.');
  }
}

export function assertSubmissionCanBeReviewed(
  status: StageAssessmentSubmissionStatus,
): void {
  if (status !== 'SUBMITTED') {
    throw new Error('Only submitted work can be reviewed.');
  }
}
