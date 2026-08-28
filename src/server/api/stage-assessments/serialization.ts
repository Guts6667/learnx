import type { SubmissionRecord } from './types.js';

export function serializeSubmission(submission: SubmissionRecord) {
  return {
    ...submission,
    createdAt: submission.createdAt.toISOString(),
    reviewedAt: submission.reviewedAt?.toISOString() ?? null,
    submittedAt: submission.submittedAt?.toISOString() ?? null,
    updatedAt: submission.updatedAt.toISOString(),
  };
}
