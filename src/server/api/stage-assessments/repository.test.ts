import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { createPrismaStageAssessmentRepository } from './repository.js';

const assessmentId = '87b72c3a-0b2f-4dda-b82c-5874c91df9c8';
const submissionId = '5cb04580-f91c-46e8-a5d3-d70be5043c1b';
const userId = '7c777cf7-8f6b-421c-88f4-d17c8d530e93';
const now = new Date('2026-08-02T23:30:00.000Z');

function submission(status: 'DRAFT' | 'SUBMITTED' = 'DRAFT') {
  return {
    attachmentUrl: null,
    contentMarkdown: status === 'SUBMITTED' ? 'Réponse' : null,
    createdAt: now,
    id: submissionId,
    reviewFeedback: null,
    reviewedAt: null,
    score: null,
    stageAssessmentId: assessmentId,
    status,
    submittedAt: null,
    updatedAt: now,
    userId,
  };
}

function prismaClient(transaction: object) {
  return {
    ...transaction,
    $transaction: vi.fn(
      async (operation: (client: typeof transaction) => unknown) =>
        operation(transaction),
    ),
  } as unknown as PrismaClient;
}

describe('stage assessment Prisma repository', () => {
  it('creates a submission only after resolving a published accessible assessment', async () => {
    const findFirst = vi.fn(async () => ({ id: assessmentId }));
    const upsert = vi.fn(async () => submission());
    const transaction = {
      stageAssessment: { findFirst },
      stageAssessmentSubmission: { upsert },
    };
    const client = prismaClient(transaction);
    const repository = createPrismaStageAssessmentRepository(client);

    await expect(
      repository.createOrGetSubmission(assessmentId, userId),
    ).resolves.toMatchObject({ id: submissionId });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: assessmentId }),
      }),
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_stageAssessmentId: { stageAssessmentId: assessmentId, userId },
        },
      }),
    );
  });

  it('rejects creation before upsert when the assessment is inaccessible', async () => {
    const upsert = vi.fn();
    const transaction = {
      stageAssessment: { findFirst: vi.fn(async () => null) },
      stageAssessmentSubmission: { upsert },
    };
    const repository = createPrismaStageAssessmentRepository(
      prismaClient(transaction),
    );

    await expect(
      repository.createOrGetSubmission(assessmentId, userId),
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('keeps the submitted-state and ownership predicates on atomic review writes', async () => {
    const updateManyAndReturn = vi.fn(async () => [submission('SUBMITTED')]);
    const auditUpsert = vi.fn(async () => ({}));
    const transaction = {
      auditEvent: { upsert: auditUpsert },
      stageAssessmentSubmission: { updateManyAndReturn },
    };
    const repository = createPrismaStageAssessmentRepository(
      prismaClient(transaction),
    );

    await repository.reviewSubmission({
      auditIdempotencyKey: 'audit-key',
      id: submissionId,
      ownerId: userId,
      reviewFeedback: null,
      reviewedAt: now,
      score: 90,
      status: 'VALIDATED',
    });
    expect(updateManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: submissionId,
          status: 'SUBMITTED',
        }),
      }),
    );
    expect(auditUpsert).toHaveBeenCalledOnce();
  });

  it('does not write an audit event when the atomic review predicate loses the race', async () => {
    const auditUpsert = vi.fn();
    const transaction = {
      auditEvent: { upsert: auditUpsert },
      stageAssessmentSubmission: { updateManyAndReturn: vi.fn(async () => []) },
    };
    const repository = createPrismaStageAssessmentRepository(
      prismaClient(transaction),
    );

    await expect(
      repository.reviewSubmission({
        auditIdempotencyKey: 'audit-key',
        id: submissionId,
        ownerId: userId,
        reviewFeedback: null,
        reviewedAt: now,
        score: 90,
        status: 'VALIDATED',
      }),
    ).resolves.toBeNull();
    expect(auditUpsert).not.toHaveBeenCalled();
  });

  it('returns the learner assessment shape in published and preview scopes', async () => {
    const assessment = {
      description: null,
      id: assessmentId,
      instructions: 'Produire une synthèse.',
      isRequired: true,
      passingScore: 80,
      position: 1,
      rubric: null,
      stageId: 'stage-id',
      submissions: [submission()],
      title: 'Évaluation finale',
      type: 'WRITING',
    };
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(assessment)
      .mockResolvedValueOnce({ ...assessment, submissions: [] });
    const repository = createPrismaStageAssessmentRepository({
      stageAssessment: { findFirst },
    } as unknown as PrismaClient);

    await expect(
      repository.findAssessmentForUser('stage-id', userId, false),
    ).resolves.toMatchObject({ submission: { id: submissionId } });
    await expect(
      repository.findAssessmentForUser('stage-id', userId, true),
    ).resolves.toMatchObject({ submission: null });

    expect(findFirst.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          stage: expect.objectContaining({ isPublished: true }),
        }),
      }),
    );
    expect(findFirst.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          stage: expect.not.objectContaining({ isPublished: true }),
        }),
      }),
    );
  });

  it('keeps learner and editorial ownership scopes on repository reads', async () => {
    const ownedSubmission = submission();
    const reviewRecord = {
      ...submission('SUBMITTED'),
      stageAssessment: { passingScore: 80, stageId: 'stage-id' },
    };
    const submissionFindFirst = vi
      .fn()
      .mockResolvedValueOnce(ownedSubmission)
      .mockResolvedValueOnce(reviewRecord);
    const assessmentFindFirst = vi.fn(async () => ({ id: assessmentId }));
    const repository = createPrismaStageAssessmentRepository({
      stageAssessment: { findFirst: assessmentFindFirst },
      stageAssessmentSubmission: { findFirst: submissionFindFirst },
    } as unknown as PrismaClient);

    await expect(
      repository.findOwnedSubmission(submissionId, userId),
    ).resolves.toBe(ownedSubmission);
    await expect(
      repository.findPublishedAssessmentForUser(assessmentId, userId),
    ).resolves.toEqual({ id: assessmentId });
    await expect(
      repository.findSubmissionForReview(submissionId, userId),
    ).resolves.toEqual({
      passingScore: 80,
      stageId: 'stage-id',
      submission: expect.objectContaining({ id: submissionId }),
    });
    expect(submissionFindFirst).toHaveBeenCalledTimes(2);
    expect(assessmentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: assessmentId }) }),
    );
  });

  it('saves editable content and submits evidenced drafts transactionally', async () => {
    const editable = { ...submission(), contentMarkdown: 'Réponse complète' };
    const findFirst = vi.fn(async () => editable);
    const update = vi
      .fn()
      .mockResolvedValueOnce({ ...editable, contentMarkdown: 'Réponse révisée' })
      .mockResolvedValueOnce({
        ...editable,
        status: 'SUBMITTED',
        submittedAt: now,
      });
    const transaction = {
      stageAssessmentSubmission: { findFirst, update },
    };
    const repository = createPrismaStageAssessmentRepository(
      prismaClient(transaction),
    );

    await expect(
      repository.saveSubmission({
        attachmentUrl: null,
        contentMarkdown: 'Réponse révisée',
        id: submissionId,
        userId,
      }),
    ).resolves.toMatchObject({ contentMarkdown: 'Réponse révisée' });
    await expect(
      repository.submitSubmission(submissionId, now, userId),
    ).resolves.toMatchObject({ status: 'SUBMITTED', submittedAt: now });

    expect(update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: {
          attachmentUrl: null,
          contentMarkdown: 'Réponse révisée',
        },
      }),
    );
    expect(update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: { status: 'SUBMITTED', submittedAt: now },
      }),
    );
  });

  it('normalizes invalid state transitions and missing ownership', async () => {
    const transaction = {
      stageAssessmentSubmission: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(submission('SUBMITTED'))
          .mockResolvedValueOnce(null),
        update: vi.fn(),
      },
    };
    const repository = createPrismaStageAssessmentRepository(
      prismaClient(transaction),
    );

    await expect(
      repository.saveSubmission({ id: submissionId, userId }),
    ).rejects.toMatchObject({ code: 'INVALID_SUBMISSION_STATE' });
    await expect(
      repository.submitSubmission(submissionId, now, userId),
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    expect(transaction.stageAssessmentSubmission.update).not.toHaveBeenCalled();
  });
});
