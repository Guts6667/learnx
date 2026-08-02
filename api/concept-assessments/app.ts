import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import {
  ConceptProgressStatus,
  ProgramStatus,
  type ConceptQuestionType,
  type Prisma,
  type PrismaClient,
  ReviewSourceType,
  ReviewStatus,
} from '../../generated/prisma/client.js';
import {
  gradeConceptAssessment,
  type AssessmentQuestionKey,
  type SubmittedAssessmentAnswer,
} from '../../src/lib/concept-assessments.js';
import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import { refreshStageValidation } from '../_lib/stage-validation.js';

interface AssessmentQuestionReadModel {
  acceptedAnswers: string[];
  explanation: string;
  id: string;
  options: Array<{
    id: string;
    isCorrect: boolean;
    label: string;
    position: number;
  }>;
  position: number;
  prompt: string;
  type: ConceptQuestionType;
}

interface AssessmentReadModel {
  concept: {
    id: string;
    lessonId: string;
    masteryThreshold: number;
    programId: string;
    stageId: string;
    title: string;
  };
  id: string;
  isRequired: boolean;
  position: number;
  questions: AssessmentQuestionReadModel[];
  title: string | null;
}

interface AttemptReadModel {
  answers: unknown;
  id: string;
  passed: boolean;
  score: number;
  submittedAt: Date;
}

interface RecordedAttempt {
  attempt: AttemptReadModel;
  progress: {
    bestScore: number | null;
    lastAttemptAt: Date | null;
    status: ConceptProgressStatus;
    validatedAt: Date | null;
  };
}

interface RecordAttemptInput {
  answers: Prisma.InputJsonValue;
  assessmentId: string;
  conceptId: string;
  dueAt: Date;
  lessonId: string;
  passed: boolean;
  programId: string;
  score: number;
  submittedAt: Date;
  userId: string;
}

export interface ConceptAssessmentRepository {
  findPublishedAssessmentForUser(
    assessmentId: string,
    userId: string,
  ): Promise<AssessmentReadModel | null>;
  listAttempts(
    assessmentId: string,
    userId: string,
  ): Promise<AttemptReadModel[]>;
  recordAttempt(input: RecordAttemptInput): Promise<RecordedAttempt>;
}

interface ConceptAssessmentsAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  now?: () => Date;
  repository?: ConceptAssessmentRepository;
  refreshValidation?: (
    stageId: string,
    userId: string,
    now: Date,
  ) => Promise<void>;
}

const identifierSchema = z.string().uuid();
const submittedAnswerSchema = z.object({
  optionIds: z.array(identifierSchema).max(20).default([]),
  questionId: identifierSchema,
  text: z.string().trim().min(1).max(500).optional(),
});
const attemptSchema = z.object({
  answers: z.array(submittedAnswerSchema).min(1).max(50),
});

function invalidRequest(): ApiError {
  return new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
}

function notFound(): ApiError {
  return new ApiError('RESOURCE_NOT_FOUND', 'Resource not found.', 404);
}

function assessmentNotReady(): ApiError {
  return new ApiError(
    'ASSESSMENT_NOT_READY',
    'This assessment has no questions.',
    409,
  );
}

function assertIdentifier(value: string): string {
  const parsed = identifierSchema.safeParse(value);

  if (!parsed.success) {
    throw invalidRequest();
  }

  return parsed.data;
}

async function parseAttempt(request: Request) {
  try {
    return attemptSchema.safeParse(await request.json());
  } catch {
    return attemptSchema.safeParse(null);
  }
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function toQuestionKey(
  question: AssessmentQuestionReadModel,
): AssessmentQuestionKey {
  return {
    acceptedAnswers: question.acceptedAnswers,
    explanation: question.explanation,
    id: question.id,
    options: question.options.map((option) => ({
      id: option.id,
      isCorrect: option.isCorrect,
    })),
    type: question.type,
  };
}

function serializeAssessment(assessment: AssessmentReadModel) {
  return {
    concept: assessment.concept,
    id: assessment.id,
    isRequired: assessment.isRequired,
    position: assessment.position,
    questionCount: assessment.questions.length,
    questions: assessment.questions.map((question) => ({
      id: question.id,
      options: question.options.map((option) => ({
        id: option.id,
        label: option.label,
        position: option.position,
      })),
      position: question.position,
      prompt: question.prompt,
      type: question.type,
    })),
    title: assessment.title,
  };
}

function serializeAttempt(attempt: AttemptReadModel) {
  return {
    answers: attempt.answers,
    id: attempt.id,
    passed: attempt.passed,
    score: attempt.score,
    submittedAt: attempt.submittedAt,
  };
}

export function createPrismaRepository(
  client: PrismaClient,
): ConceptAssessmentRepository {
  return {
    async findPublishedAssessmentForUser(assessmentId, userId) {
      const assessment = await client.conceptAssessment.findFirst({
        where: {
          id: assessmentId,
          concept: {
            lesson: {
              isPublished: true,
              module: {
                isPublished: true,
                stage: {
                  isPublished: true,
                  program: {
                    ownerId: userId,
                    status: ProgramStatus.ACTIVE,
                  },
                },
              },
            },
          },
        },
        include: {
          concept: {
            include: {
              lesson: {
                select: {
                  id: true,
                  module: {
                    select: {
                      stage: { select: { id: true, programId: true } },
                    },
                  },
                },
              },
            },
          },
          questions: {
            orderBy: { position: 'asc' },
            include: { options: { orderBy: { position: 'asc' } } },
          },
        },
      });

      if (!assessment) {
        return null;
      }

      return {
        concept: {
          id: assessment.concept.id,
          lessonId: assessment.concept.lesson.id,
          masteryThreshold: assessment.concept.masteryThreshold,
          programId: assessment.concept.lesson.module.stage.programId,
          stageId: assessment.concept.lesson.module.stage.id,
          title: assessment.concept.title,
        },
        id: assessment.id,
        isRequired: assessment.isRequired,
        position: assessment.position,
        questions: assessment.questions,
        title: assessment.title,
      };
    },
    async listAttempts(assessmentId, userId) {
      return client.conceptAssessmentAttempt.findMany({
        where: { assessmentId, userId },
        orderBy: { submittedAt: 'desc' },
      });
    },
    async recordAttempt(input) {
      return client.$transaction(async (transaction) => {
        const currentProgress = await transaction.conceptProgress.findUnique({
          where: {
            userId_conceptId: {
              conceptId: input.conceptId,
              userId: input.userId,
            },
          },
        });
        const bestScore = Math.max(
          currentProgress?.bestScore ?? 0,
          input.score,
        );
        const status = input.passed
          ? ConceptProgressStatus.VALIDATED
          : ConceptProgressStatus.NEEDS_REVIEW;
        const validatedAt = input.passed
          ? input.submittedAt
          : (currentProgress?.validatedAt ?? null);
        const [attempt, progress] = await Promise.all([
          transaction.conceptAssessmentAttempt.create({
            data: {
              answers: input.answers,
              assessmentId: input.assessmentId,
              passed: input.passed,
              score: input.score,
              submittedAt: input.submittedAt,
              userId: input.userId,
            },
          }),
          transaction.conceptProgress.upsert({
            where: {
              userId_conceptId: {
                conceptId: input.conceptId,
                userId: input.userId,
              },
            },
            create: {
              bestScore,
              conceptId: input.conceptId,
              lastAttemptAt: input.submittedAt,
              status,
              userId: input.userId,
              validatedAt,
            },
            update: {
              bestScore,
              lastAttemptAt: input.submittedAt,
              status,
              validatedAt,
            },
          }),
        ]);

        if (input.passed) {
          await transaction.reviewItem.updateMany({
            where: {
              sourceId: input.assessmentId,
              sourceType: ReviewSourceType.CONCEPT_ASSESSMENT,
              userId: input.userId,
            },
            data: {
              completedAt: input.submittedAt,
              status: ReviewStatus.COMPLETED,
            },
          });
        } else {
          await transaction.reviewItem.upsert({
            where: {
              userId_sourceType_sourceId: {
                sourceId: input.assessmentId,
                sourceType: ReviewSourceType.CONCEPT_ASSESSMENT,
                userId: input.userId,
              },
            },
            create: {
              dueAt: input.dueAt,
              lessonId: input.lessonId,
              programId: input.programId,
              sourceId: input.assessmentId,
              sourceType: ReviewSourceType.CONCEPT_ASSESSMENT,
              status: ReviewStatus.PENDING,
              userId: input.userId,
            },
            update: {
              completedAt: null,
              dueAt: input.dueAt,
              status: ReviewStatus.PENDING,
            },
          });
        }

        return { attempt, progress };
      });
    },
  };
}

async function getPrismaRepository(): Promise<ConceptAssessmentRepository> {
  const { prisma } = await import('../../src/server/prisma.js');

  return createPrismaRepository(prisma);
}

export function createConceptAssessmentsApp(
  options: ConceptAssessmentsAppOptions = {},
) {
  const app = new Hono<AuthEnvironment>();
  const now = options.now ?? (() => new Date());
  const refreshValidation =
    options.refreshValidation ??
    (options.repository
      ? async () => undefined
      : async (stageId: string, userId: string, refreshedAt: Date) => {
          const { prisma } = await import('../../src/server/prisma.js');
          await refreshStageValidation(prisma, stageId, userId, refreshedAt);
        });

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

  async function getAssessment(context: {
    get(key: 'user'): { id: string };
    req: { param(name: string): string };
  }) {
    const assessmentId = assertIdentifier(context.req.param('assessmentId'));
    const repository = options.repository ?? (await getPrismaRepository());
    const assessment = await repository.findPublishedAssessmentForUser(
      assessmentId,
      context.get('user').id,
    );

    if (!assessment) {
      throw notFound();
    }

    return { assessment, assessmentId, repository };
  }

  app.get('/api/concept-assessments/:assessmentId', async (context) => {
    const { assessment } = await getAssessment(context);

    return context.json({ assessment: serializeAssessment(assessment) });
  });

  app.get(
    '/api/concept-assessments/:assessmentId/attempts',
    async (context) => {
      const { assessmentId, repository } = await getAssessment(context);
      const attempts = await repository.listAttempts(
        assessmentId,
        context.get('user').id,
      );

      return context.json({ attempts: attempts.map(serializeAttempt) });
    },
  );

  app.post(
    '/api/concept-assessments/:assessmentId/attempts',
    async (context) => {
      const parsedAttempt = await parseAttempt(context.req.raw);

      if (!parsedAttempt.success) {
        throw invalidRequest();
      }

      const { assessment, assessmentId, repository } =
        await getAssessment(context);

      if (assessment.questions.length === 0) {
        throw assessmentNotReady();
      }

      let result;

      try {
        result = gradeConceptAssessment({
          answers: parsedAttempt.data.answers as SubmittedAssessmentAnswer[],
          masteryThreshold: assessment.concept.masteryThreshold,
          questions: assessment.questions.map(toQuestionKey),
        });
      } catch {
        throw invalidRequest();
      }

      const submittedAt = now();
      const recorded = await repository.recordAttempt({
        answers: toJsonValue(parsedAttempt.data.answers),
        assessmentId,
        conceptId: assessment.concept.id,
        dueAt: addDays(submittedAt, 1),
        lessonId: assessment.concept.lessonId,
        passed: result.passed,
        programId: assessment.concept.programId,
        score: result.score,
        submittedAt,
        userId: context.get('user').id,
      });
      await refreshValidation(
        assessment.concept.stageId,
        context.get('user').id,
        submittedAt,
      );

      return context.json(
        {
          attempt: serializeAttempt(recorded.attempt),
          corrections: result.corrections,
          progress: recorded.progress,
        },
        201,
      );
    },
  );

  return app;
}

export const conceptAssessmentsApp = createConceptAssessmentsApp();
