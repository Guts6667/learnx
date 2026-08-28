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
});
