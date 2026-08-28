import { createStageAssessmentService } from './service.js';
import type { StageAssessmentRepository, SubmissionRecord } from './types.js';

const now = new Date('2026-08-02T23:30:00.000Z');
const submissionId = '5cb04580-f91c-46e8-a5d3-d70be5043c1b';
const userId = '7c777cf7-8f6b-421c-88f4-d17c8d530e93';

function record(status: SubmissionRecord['status']): SubmissionRecord {
  return {
    attachmentUrl: null,
    contentMarkdown: 'Réponse',
    createdAt: now,
    id: submissionId,
    reviewFeedback: null,
    reviewedAt: null,
    score: null,
    stageAssessmentId: '87b72c3a-0b2f-4dda-b82c-5874c91df9c8',
    status,
    submittedAt: status === 'SUBMITTED' ? now : null,
    updatedAt: now,
    userId,
  };
}

function repository(submission: SubmissionRecord): StageAssessmentRepository {
  return {
    createOrGetSubmission: vi.fn(async () => submission),
    findAssessmentForUser: vi.fn(async () => null),
    findOwnedSubmission: vi.fn(async () => submission),
    findPublishedAssessmentForUser: vi.fn(async () => ({
      id: submission.stageAssessmentId,
    })),
    findSubmissionForReview: vi.fn(async () => ({
      passingScore: 70,
      stageId: 'stage-id',
      submission,
    })),
    reviewSubmission: vi.fn(async (input) => ({
      ...submission,
      reviewedAt: input.reviewedAt,
      score: input.score,
      status: input.status,
    })),
    saveSubmission: vi.fn(async () => submission),
    submitSubmission: vi.fn(async () => ({
      ...submission,
      status: 'SUBMITTED' as const,
    })),
  };
}

describe('stage assessment service transitions', () => {
  it('rejects validation below the authored passing score before persistence', async () => {
    const persistence = repository(record('SUBMITTED'));
    const service = createStageAssessmentService({
      now: () => now,
      refreshValidation: vi.fn(),
      repository: persistence,
    });
    await expect(
      service.reviewSubmission(submissionId, userId, {
        action: 'validate',
        score: 69,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(persistence.reviewSubmission).not.toHaveBeenCalled();
  });

  it('maps a revision request and refreshes stage validation after persistence', async () => {
    const persistence = repository(record('SUBMITTED'));
    const refreshValidation = vi.fn(async () => undefined);
    const service = createStageAssessmentService({
      now: () => now,
      refreshValidation,
      repository: persistence,
    });
    await service.reviewSubmission(submissionId, userId, {
      action: 'request_revision',
      reviewFeedback: 'À préciser.',
      score: 50,
    });
    expect(persistence.reviewSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'NEEDS_REVISION' }),
    );
    expect(refreshValidation).toHaveBeenCalledWith('stage-id', userId, now);
  });

  it('does not publish a review from an invalid source state', async () => {
    const persistence = repository(record('DRAFT'));
    const service = createStageAssessmentService({
      now: () => now,
      refreshValidation: vi.fn(),
      repository: persistence,
    });
    await expect(
      service.reviewSubmission(submissionId, userId, {
        action: 'validate',
        score: 90,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_SUBMISSION_STATE' });
    expect(persistence.reviewSubmission).not.toHaveBeenCalled();
  });
});
