import { AuditAction } from '../../../../generated/prisma/client.js';
import {
  assertSubmissionCanBeEdited,
  assertSubmissionCanBeReviewed,
  assertSubmissionCanBeSubmitted,
} from '../../../lib/stage-assessments.js';
import { createAuditIdempotencyKey } from '../_lib/audit.js';
import type { StageAssessmentRepository } from './types.js';
import type { StageAssessmentUpdate } from './validation.js';
import {
  invalidRequest,
  stageAssessmentNotFound,
  submissionConflict,
} from './validation.js';

interface ServiceOptions {
  now: () => Date;
  refreshValidation: (
    stageId: string,
    userId: string,
    now: Date,
  ) => Promise<void>;
  repository: StageAssessmentRepository;
}

function assertState(operation: () => void) {
  try {
    operation();
  } catch (error) {
    throw submissionConflict(
      error instanceof Error ? error.message : 'Conflict.',
    );
  }
}

async function saveSubmission(
  options: ServiceOptions,
  submissionId: string,
  userId: string,
  update: Extract<StageAssessmentUpdate, { action: 'save' }>,
) {
  const submission = await options.repository.findOwnedSubmission(
    submissionId,
    userId,
  );
  if (!submission) throw stageAssessmentNotFound();
  assertState(() => assertSubmissionCanBeEdited(submission.status));
  return options.repository.saveSubmission({
    attachmentUrl: update.attachmentUrl,
    contentMarkdown: update.contentMarkdown,
    id: submissionId,
    userId,
  });
}

async function reviewSubmission(
  options: ServiceOptions,
  submissionId: string,
  ownerId: string,
  update: Exclude<StageAssessmentUpdate, { action: 'save' }>,
) {
  const record = await options.repository.findSubmissionForReview(
    submissionId,
    ownerId,
  );
  if (!record) throw stageAssessmentNotFound();
  assertState(() => assertSubmissionCanBeReviewed(record.submission.status));
  if (
    update.action === 'validate' &&
    record.passingScore !== null &&
    update.score < record.passingScore
  ) {
    throw invalidRequest(
      'The score does not meet the assessment passing threshold.',
    );
  }
  const reviewedAt = options.now();
  const updated = await options.repository.reviewSubmission({
    auditIdempotencyKey: createAuditIdempotencyKey(
      AuditAction.STAGE_ASSESSMENT_REVIEW,
      submissionId,
      { action: update.action, score: update.score },
    ),
    id: submissionId,
    ownerId,
    reviewFeedback: update.reviewFeedback ?? null,
    reviewedAt,
    score: update.score ?? null,
    status: update.action === 'validate' ? 'VALIDATED' : 'NEEDS_REVISION',
  });
  if (!updated) throw stageAssessmentNotFound();
  await options.refreshValidation(
    record.stageId,
    record.submission.userId,
    reviewedAt,
  );
  return updated;
}

export function createStageAssessmentService(options: ServiceOptions) {
  return {
    async createSubmission(assessmentId: string, userId: string) {
      const assessment =
        await options.repository.findPublishedAssessmentForUser(
          assessmentId,
          userId,
        );
      if (!assessment) throw stageAssessmentNotFound();
      return options.repository.createOrGetSubmission(assessmentId, userId);
    },
    async getAssessment(stageId: string, userId: string, preview: boolean) {
      const assessment = await options.repository.findAssessmentForUser(
        stageId,
        userId,
        preview,
      );
      if (!assessment) throw stageAssessmentNotFound();
      return assessment;
    },
    saveSubmission: (
      submissionId: string,
      userId: string,
      update: Extract<StageAssessmentUpdate, { action: 'save' }>,
    ) => saveSubmission(options, submissionId, userId, update),
    reviewSubmission: (
      submissionId: string,
      ownerId: string,
      update: Exclude<StageAssessmentUpdate, { action: 'save' }>,
    ) => reviewSubmission(options, submissionId, ownerId, update),
    async submitSubmission(submissionId: string, userId: string) {
      const submission = await options.repository.findOwnedSubmission(
        submissionId,
        userId,
      );
      if (!submission) throw stageAssessmentNotFound();
      assertState(() => assertSubmissionCanBeSubmitted(submission));
      return options.repository.submitSubmission(
        submissionId,
        options.now(),
        userId,
      );
    },
  };
}

export type StageAssessmentService = ReturnType<
  typeof createStageAssessmentService
>;
