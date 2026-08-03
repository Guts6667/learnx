import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import {
  ProgramStatus,
  Role,
  StageAssessmentSubmissionStatus,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import {
  assertSubmissionCanBeEdited,
  assertSubmissionCanBeReviewed,
  assertSubmissionCanBeSubmitted,
} from '../../../lib/stage-assessments.js';
import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import { refreshStageValidation } from '../_lib/stage-validation.js';

const identifierSchema = z.uuid();
const previewSchema = z.object({ preview: z.enum(['true']).optional() });
const saveSchema = z.object({
  action: z.literal('save'),
  attachmentUrl: z.url().nullable().optional(),
  contentMarkdown: z.string().max(100_000).nullable().optional(),
});
const validateSchema = z.object({
  action: z.literal('validate'),
  reviewFeedback: z.string().trim().max(10_000).nullable().optional(),
  score: z.number().min(0).max(100),
});
const revisionSchema = z.object({
  action: z.literal('request_revision'),
  reviewFeedback: z.string().trim().min(1).max(10_000),
  score: z.number().min(0).max(100).nullable().optional(),
});
const updateSchema = z.discriminatedUnion('action', [
  saveSchema,
  validateSchema,
  revisionSchema,
]);

type SubmissionStatus = keyof typeof StageAssessmentSubmissionStatus;

interface SubmissionRecord {
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

interface AssessmentRecord {
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

interface ReviewRecord {
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
  reviewSubmission(input: {
    id: string;
    ownerId: string;
    reviewFeedback: string | null;
    reviewedAt: Date;
    score: number | null;
    status: 'NEEDS_REVISION' | 'VALIDATED';
  }): Promise<SubmissionRecord | null>;
  saveSubmission(input: {
    attachmentUrl?: string | null;
    contentMarkdown?: string | null;
    id: string;
  }): Promise<SubmissionRecord>;
  submitSubmission(id: string, submittedAt: Date): Promise<SubmissionRecord>;
}

interface AppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  now?: () => Date;
  repository?: StageAssessmentRepository;
  refreshValidation?: (
    stageId: string,
    userId: string,
    now: Date,
  ) => Promise<void>;
}

async function getPrismaClient(): Promise<PrismaClient> {
  const { prisma } = await import('../../prisma.js');

  return prisma;
}

function publishedAssessmentWhere(assessmentId: string, userId: string) {
  return {
    id: assessmentId,
    stage: {
      isPublished: true,
      program: { ownerId: userId, status: ProgramStatus.ACTIVE },
    },
  } as const;
}

export function createPrismaStageAssessmentRepository(
  client: PrismaClient,
): StageAssessmentRepository {
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

  return {
    async createOrGetSubmission(assessmentId, userId) {
      return client.stageAssessmentSubmission.upsert({
        where: {
          userId_stageAssessmentId: { stageAssessmentId: assessmentId, userId },
        },
        create: { stageAssessmentId: assessmentId, userId },
        update: {},
        select: submissionSelect,
      });
    },
    async findAssessmentForUser(stageId, userId, preview) {
      const assessment = await client.stageAssessment.findFirst({
        where: {
          stageId,
          stage: {
            ...(preview ? {} : { isPublished: true }),
            program: {
              ownerId: userId,
              status: preview
                ? { in: [ProgramStatus.ACTIVE, ProgramStatus.DRAFT] }
                : ProgramStatus.ACTIVE,
            },
          },
        },
        orderBy: { position: 'asc' },
        include: {
          submissions: {
            where: { userId },
            take: 1,
            select: submissionSelect,
          },
        },
      });

      if (!assessment) return null;

      const { submissions, ...assessmentData } = assessment;
      return { ...assessmentData, submission: submissions[0] ?? null };
    },
    async findOwnedSubmission(submissionId, userId) {
      return client.stageAssessmentSubmission.findFirst({
        where: { id: submissionId, userId },
        select: submissionSelect,
      });
    },
    async findPublishedAssessmentForUser(assessmentId, userId) {
      return client.stageAssessment.findFirst({
        where: publishedAssessmentWhere(assessmentId, userId),
        select: { id: true },
      });
    },
    async findSubmissionForReview(submissionId, ownerId) {
      const record = await client.stageAssessmentSubmission.findFirst({
        where: {
          id: submissionId,
          stageAssessment: { stage: { program: { ownerId } } },
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
    },
    async reviewSubmission(input) {
      const submissions =
        await client.stageAssessmentSubmission.updateManyAndReturn({
          where: {
            id: input.id,
            stageAssessment: {
              stage: { program: { ownerId: input.ownerId } },
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

      return submissions[0] ?? null;
    },
    async saveSubmission(input) {
      return client.stageAssessmentSubmission.update({
        where: { id: input.id },
        data: {
          attachmentUrl: input.attachmentUrl,
          contentMarkdown: input.contentMarkdown,
        },
        select: submissionSelect,
      });
    },
    async submitSubmission(id, submittedAt) {
      return client.stageAssessmentSubmission.update({
        where: { id },
        data: { status: 'SUBMITTED', submittedAt },
        select: submissionSelect,
      });
    },
  };
}

function invalidRequest(message = 'Invalid request.'): ApiError {
  return new ApiError('INVALID_REQUEST', message, 400);
}

function notFound(): ApiError {
  return new ApiError('RESOURCE_NOT_FOUND', 'Resource not found.', 404);
}

function conflict(message: string): ApiError {
  return new ApiError('INVALID_SUBMISSION_STATE', message, 409);
}

function parseIdentifier(value: string): string {
  const result = identifierSchema.safeParse(value);

  if (!result.success) {
    throw invalidRequest();
  }

  return result.data;
}

function parsePreview(url: string): boolean {
  const result = previewSchema.safeParse(
    Object.fromEntries(new URL(url).searchParams),
  );

  if (!result.success) {
    throw invalidRequest();
  }

  return result.data.preview === 'true';
}

async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw invalidRequest();
  }
}

function serializeSubmission(submission: SubmissionRecord) {
  return {
    ...submission,
    createdAt: submission.createdAt.toISOString(),
    reviewedAt: submission.reviewedAt?.toISOString() ?? null,
    submittedAt: submission.submittedAt?.toISOString() ?? null,
    updatedAt: submission.updatedAt.toISOString(),
  };
}

export function createStageAssessmentsApp(options: AppOptions = {}) {
  const app = new Hono<AuthEnvironment>();
  const now = options.now ?? (() => new Date());
  const refreshValidation =
    options.refreshValidation ??
    (options.repository
      ? async () => undefined
      : async (stageId: string, userId: string, refreshedAt: Date) => {
          const prisma = await getPrismaClient();
          await refreshStageValidation(prisma, stageId, userId, refreshedAt);
        });
  let defaultRepository: StageAssessmentRepository | undefined;
  const getRepository = async () => {
    if (options.repository) return options.repository;
    defaultRepository ??= createPrismaStageAssessmentRepository(
      await getPrismaClient(),
    );
    return defaultRepository;
  };

  app.use('*', options.authentication ?? requireUser);
  app.onError((error, context) => {
    if (error instanceof ApiError) {
      return context.json(toApiErrorBody(error), error.status);
    }

    return context.json(
      toApiErrorBody(
        new ApiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500),
      ),
      500,
    );
  });

  app.get('/api/stages/:stageId/assessment', async (context) => {
    const repository = await getRepository();
    const user = context.get('user');
    const assessment = await repository.findAssessmentForUser(
      parseIdentifier(context.req.param('stageId')),
      user.id,
      parsePreview(context.req.url),
    );

    if (!assessment) throw notFound();

    return context.json({
      assessment: {
        ...assessment,
        submission: assessment.submission
          ? serializeSubmission(assessment.submission)
          : null,
      },
    });
  });

  app.post(
    '/api/stage-assessments/:assessmentId/submissions',
    async (context) => {
      const repository = await getRepository();
      const user = context.get('user');
      const assessmentId = parseIdentifier(context.req.param('assessmentId'));
      const assessment = await repository.findPublishedAssessmentForUser(
        assessmentId,
        user.id,
      );

      if (!assessment) throw notFound();

      const submission = await repository.createOrGetSubmission(
        assessmentId,
        user.id,
      );

      return context.json({ submission: serializeSubmission(submission) }, 201);
    },
  );

  app.patch(
    '/api/stage-assessment-submissions/:submissionId',
    async (context) => {
      const repository = await getRepository();
      const user = context.get('user');
      const submissionId = parseIdentifier(context.req.param('submissionId'));
      const parsed = updateSchema.safeParse(await parseJson(context.req.raw));

      if (!parsed.success) throw invalidRequest();

      if (parsed.data.action === 'save') {
        const submission = await repository.findOwnedSubmission(
          submissionId,
          user.id,
        );
        if (!submission) throw notFound();

        try {
          assertSubmissionCanBeEdited(submission.status);
        } catch (error) {
          throw conflict(error instanceof Error ? error.message : 'Conflict.');
        }

        const updated = await repository.saveSubmission({
          attachmentUrl: parsed.data.attachmentUrl,
          contentMarkdown: parsed.data.contentMarkdown,
          id: submissionId,
        });
        return context.json({ submission: serializeSubmission(updated) });
      }

      if (user.role !== Role.ADMIN) {
        throw new ApiError(
          'FORBIDDEN',
          'Administrator access is required.',
          403,
        );
      }

      const reviewRecord =
        await repository.findSubmissionForReview(submissionId, user.id);
      if (!reviewRecord) throw notFound();

      try {
        assertSubmissionCanBeReviewed(reviewRecord.submission.status);
      } catch (error) {
        throw conflict(error instanceof Error ? error.message : 'Conflict.');
      }

      if (
        parsed.data.action === 'validate' &&
        reviewRecord.passingScore !== null &&
        parsed.data.score < reviewRecord.passingScore
      ) {
        throw invalidRequest(
          'The score does not meet the assessment passing threshold.',
        );
      }

      const reviewedAt = now();
      const updated = await repository.reviewSubmission({
        id: submissionId,
        ownerId: user.id,
        reviewFeedback: parsed.data.reviewFeedback ?? null,
        reviewedAt,
        score: parsed.data.score ?? null,
        status:
          parsed.data.action === 'validate' ? 'VALIDATED' : 'NEEDS_REVISION',
      });
      if (!updated) throw notFound();
      await refreshValidation(
        reviewRecord.stageId,
        reviewRecord.submission.userId,
        reviewedAt,
      );
      return context.json({ submission: serializeSubmission(updated) });
    },
  );

  app.post(
    '/api/stage-assessment-submissions/:submissionId/submit',
    async (context) => {
      const repository = await getRepository();
      const user = context.get('user');
      const submissionId = parseIdentifier(context.req.param('submissionId'));
      const submission = await repository.findOwnedSubmission(
        submissionId,
        user.id,
      );

      if (!submission) throw notFound();

      try {
        assertSubmissionCanBeSubmitted(submission);
      } catch (error) {
        throw conflict(error instanceof Error ? error.message : 'Conflict.');
      }

      const updated = await repository.submitSubmission(submissionId, now());
      return context.json({ submission: serializeSubmission(updated) });
    },
  );

  return app;
}

export const stageAssessmentsApp = createStageAssessmentsApp();
