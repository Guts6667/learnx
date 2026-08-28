import {
  AuditAction,
  StageAssessmentSubmissionStatus,
  type PrismaClient,
  type Prisma,
} from '../../../../generated/prisma/client.js';
import {
  assertSubmissionCanBeEdited,
  assertSubmissionCanBeSubmitted,
} from '../../../lib/stage-assessments.js';
import { writeAuditEvent } from '../_lib/audit.js';
import {
  editorialProgramWhere,
  learningProgramWhere,
  previewProgramWhere,
} from '../_lib/program-access-policy.js';
import { runSerializableProgressTransaction } from '../_lib/progress-recalculation.js';
import type {
  ReviewSubmissionInput,
  SaveSubmissionInput,
  StageAssessmentRepository,
  SubmissionRecord,
} from './types.js';
import { stageAssessmentNotFound, submissionConflict } from './validation.js';

const submissionSelect = {
  attachmentUrl: true,
  contentMarkdown: true,
  createdAt: true,
  id: true,
  reviewFeedback: true,
  reviewedAt: true,
  score: true,
  stageAssessmentId: true,
  status: true,
  submittedAt: true,
  updatedAt: true,
  userId: true,
} as const;

type TransactionClient = Prisma.TransactionClient;

function publishedAssessmentWhere(assessmentId: string, userId: string) {
  return {
    id: assessmentId,
    stage: { isPublished: true, program: learningProgramWhere(userId) },
  } as const;
}

async function createOrGetSubmission(
  client: PrismaClient,
  assessmentId: string,
  userId: string,
) {
  return runSerializableProgressTransaction(client, async (transaction) => {
    const assessment = await transaction.stageAssessment.findFirst({
      where: publishedAssessmentWhere(assessmentId, userId),
      select: { id: true },
    });
    if (!assessment) throw stageAssessmentNotFound();
    return transaction.stageAssessmentSubmission.upsert({
      where: {
        userId_stageAssessmentId: { stageAssessmentId: assessmentId, userId },
      },
      create: { stageAssessmentId: assessmentId, userId },
      update: {},
      select: submissionSelect,
    });
  });
}

async function findAssessmentForUser(
  client: PrismaClient,
  stageId: string,
  userId: string,
  preview: boolean,
) {
  const assessment = await client.stageAssessment.findFirst({
    where: {
      stageId,
      stage: {
        ...(preview ? {} : { isPublished: true }),
        program: preview
          ? previewProgramWhere(userId)
          : learningProgramWhere(userId),
      },
    },
    orderBy: { position: 'asc' },
    include: {
      submissions: { where: { userId }, take: 1, select: submissionSelect },
    },
  });
  if (!assessment) return null;
  const { submissions, ...assessmentData } = assessment;
  return { ...assessmentData, submission: submissions[0] ?? null };
}

async function findOwnedSubmission(
  client: PrismaClient,
  submissionId: string,
  userId: string,
) {
  return client.stageAssessmentSubmission.findFirst({
    where: {
      id: submissionId,
      stageAssessment: {
        stage: { isPublished: true, program: learningProgramWhere(userId) },
      },
      userId,
    },
    select: submissionSelect,
  });
}

async function findSubmissionForReview(
  client: PrismaClient,
  submissionId: string,
  ownerId: string,
) {
  const record = await client.stageAssessmentSubmission.findFirst({
    where: {
      id: submissionId,
      stageAssessment: { stage: { program: editorialProgramWhere(ownerId) } },
    },
    select: {
      ...submissionSelect,
      stageAssessment: { select: { passingScore: true, stageId: true } },
    },
  });
  if (!record) return null;
  const { stageAssessment, ...submission } = record;
  return {
    passingScore: stageAssessment.passingScore,
    stageId: stageAssessment.stageId,
    submission,
  };
}

async function reviewSubmission(
  client: PrismaClient,
  input: ReviewSubmissionInput,
) {
  return client.$transaction(async (transaction) => {
    const submissions =
      await transaction.stageAssessmentSubmission.updateManyAndReturn({
        where: {
          id: input.id,
          status: StageAssessmentSubmissionStatus.SUBMITTED,
          stageAssessment: {
            stage: { program: editorialProgramWhere(input.ownerId) },
          },
        },
        data: {
          reviewFeedback: input.reviewFeedback,
          reviewedAt: input.reviewedAt,
          score: input.score,
          status: input.status,
        },
        select: submissionSelect,
      });
    const submission = submissions[0] ?? null;
    if (!submission) return null;
    await writeAuditEvent(transaction, {
      action: AuditAction.STAGE_ASSESSMENT_REVIEW,
      actorUserId: input.ownerId,
      idempotencyKey: input.auditIdempotencyKey,
      metadata: { status: input.status },
      targetId: input.id,
      targetType: 'stage_assessment_submission',
    });
    return submission;
  });
}

async function loadOwnedSubmission(
  transaction: TransactionClient,
  id: string,
  userId: string,
) {
  const submission = await transaction.stageAssessmentSubmission.findFirst({
    where: {
      id,
      stageAssessment: { stage: { program: learningProgramWhere(userId) } },
      userId,
    },
    select: submissionSelect,
  });
  if (!submission) throw stageAssessmentNotFound();
  return submission;
}

function normalizeStateError(error: unknown): never {
  throw submissionConflict(
    error instanceof Error ? error.message : 'Conflict.',
  );
}

async function saveSubmission(
  client: PrismaClient,
  input: SaveSubmissionInput,
) {
  return runSerializableProgressTransaction(client, async (transaction) => {
    const submission = await loadOwnedSubmission(
      transaction,
      input.id,
      input.userId,
    );
    try {
      assertSubmissionCanBeEdited(submission.status);
    } catch (error) {
      normalizeStateError(error);
    }
    return transaction.stageAssessmentSubmission.update({
      where: { id: input.id },
      data: {
        attachmentUrl: input.attachmentUrl,
        contentMarkdown: input.contentMarkdown,
      },
      select: submissionSelect,
    });
  });
}

async function submitSubmission(
  client: PrismaClient,
  id: string,
  submittedAt: Date,
  userId: string,
) {
  return runSerializableProgressTransaction(client, async (transaction) => {
    const submission = await loadOwnedSubmission(transaction, id, userId);
    try {
      assertSubmissionCanBeSubmitted(submission);
    } catch (error) {
      normalizeStateError(error);
    }
    return transaction.stageAssessmentSubmission.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt },
      select: submissionSelect,
    });
  });
}

export function createPrismaStageAssessmentRepository(
  client: PrismaClient,
): StageAssessmentRepository {
  return {
    createOrGetSubmission: (assessmentId, userId) =>
      createOrGetSubmission(client, assessmentId, userId),
    findAssessmentForUser: (stageId, userId, preview) =>
      findAssessmentForUser(client, stageId, userId, preview),
    findOwnedSubmission: (submissionId, userId) =>
      findOwnedSubmission(client, submissionId, userId),
    findPublishedAssessmentForUser: (assessmentId, userId) =>
      client.stageAssessment.findFirst({
        where: publishedAssessmentWhere(assessmentId, userId),
        select: { id: true },
      }),
    findSubmissionForReview: (submissionId, ownerId) =>
      findSubmissionForReview(client, submissionId, ownerId),
    reviewSubmission: (input) => reviewSubmission(client, input),
    saveSubmission: (input) => saveSubmission(client, input),
    submitSubmission: (id, submittedAt, userId) =>
      submitSubmission(client, id, submittedAt, userId),
  };
}

export type { SubmissionRecord };
