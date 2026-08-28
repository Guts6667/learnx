import type { MiddlewareHandler } from 'hono';

import type { StageAssessmentSubmissionStatus } from '../../../../generated/prisma/client.js';
import type { AuthEnvironment } from '../_lib/auth.js';

export type SubmissionStatus = keyof typeof StageAssessmentSubmissionStatus;

export interface SubmissionRecord {
  attachmentUrl: string | null;
  contentMarkdown: string | null;
  createdAt: Date;
  id: string;
  reviewFeedback: string | null;
  reviewedAt: Date | null;
  score: number | null;
  stageAssessmentId: string;
  status: SubmissionStatus;
  submittedAt: Date | null;
  updatedAt: Date;
  userId: string;
}

export interface AssessmentRecord {
  description: string | null;
  id: string;
  instructions: string | null;
  isRequired: boolean;
  passingScore: number | null;
  position: number;
  rubric: unknown;
  stageId: string;
  submission: SubmissionRecord | null;
  title: string;
  type: string;
}

export interface ReviewRecord {
  passingScore: number | null;
  stageId: string;
  submission: SubmissionRecord;
}

export interface StageAssessmentRepository {
  createOrGetSubmission(
    assessmentId: string,
    userId: string,
  ): Promise<SubmissionRecord>;
  findAssessmentForUser(
    stageId: string,
    userId: string,
    preview: boolean,
  ): Promise<AssessmentRecord | null>;
  findOwnedSubmission(
    submissionId: string,
    userId: string,
  ): Promise<SubmissionRecord | null>;
  findPublishedAssessmentForUser(
    assessmentId: string,
    userId: string,
  ): Promise<{ id: string } | null>;
  findSubmissionForReview(
    submissionId: string,
    ownerId: string,
  ): Promise<ReviewRecord | null>;
  reviewSubmission(
    input: ReviewSubmissionInput,
  ): Promise<SubmissionRecord | null>;
  saveSubmission(input: SaveSubmissionInput): Promise<SubmissionRecord>;
  submitSubmission(
    id: string,
    submittedAt: Date,
    userId: string,
  ): Promise<SubmissionRecord>;
}

export interface ReviewSubmissionInput {
  auditIdempotencyKey: string;
  id: string;
  ownerId: string;
  reviewFeedback: string | null;
  reviewedAt: Date;
  score: number | null;
  status: 'NEEDS_REVISION' | 'VALIDATED';
}

export interface SaveSubmissionInput {
  attachmentUrl?: string | null;
  contentMarkdown?: string | null;
  id: string;
  userId: string;
}

export interface StageAssessmentAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  now?: () => Date;
  repository?: StageAssessmentRepository;
  refreshValidation?: (
    stageId: string,
    userId: string,
    now: Date,
  ) => Promise<void>;
}
