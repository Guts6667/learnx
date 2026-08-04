import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import {
  ProgramStatus,
  type Prisma,
  type PrismaClient,
  type QuizQuestionType,
} from '../../../../generated/prisma/client.js';
import {
  gradeConceptAssessment,
  type AssessmentQuestionKey,
  type SubmittedAssessmentAnswer,
} from '../../../lib/concept-assessments.js';
import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import {
  recalculateLessonProgress,
  runSerializableProgressTransaction,
} from '../_lib/progress-recalculation.js';
import { ensureCurrentModuleRunForLesson } from '../_lib/module-runs.js';

interface QuizQuestionReadModel {
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
  type: QuizQuestionType;
}

interface QuizReadModel {
  description: string | null;
  id: string;
  isRequired: boolean;
  lessonId: string;
  passingScore: number;
  position: number;
  questions: QuizQuestionReadModel[];
  title: string;
}

interface QuizAttemptReadModel {
  answers: unknown;
  id: string;
  passed: boolean;
  score: number;
  submittedAt: Date;
  runSequence?: number;
}

interface RecordQuizAttemptInput {
  answers: Prisma.InputJsonValue;
  lessonId: string;
  passed: boolean;
  quizId: string;
  score: number;
  submittedAt: Date;
  userId: string;
}

export interface QuizRepository {
  findPublishedQuizForUser(
    quizId: string,
    userId: string,
  ): Promise<QuizReadModel | null>;
  listAttempts(quizId: string, userId: string): Promise<QuizAttemptReadModel[]>;
  recordAttempt(input: RecordQuizAttemptInput): Promise<QuizAttemptReadModel>;
}

interface QuizzesAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  now?: () => Date;
  repository?: QuizRepository;
}

const identifierSchema = z.string().uuid();
const submittedAnswerSchema = z.object({
  optionIds: z.array(identifierSchema).max(20).default([]),
  questionId: identifierSchema,
  text: z.string().trim().min(1).max(500).optional(),
});
const attemptSchema = z.object({
  answers: z.array(submittedAnswerSchema).min(1).max(100),
});

function invalidRequest(): ApiError {
  return new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
}

function notFound(): ApiError {
  return new ApiError('RESOURCE_NOT_FOUND', 'Resource not found.', 404);
}

function quizNotReady(): ApiError {
  return new ApiError(
    'ASSESSMENT_NOT_READY',
    'This quiz has no questions.',
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

function toQuestionKey(question: QuizQuestionReadModel): AssessmentQuestionKey {
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

function serializeQuiz(quiz: QuizReadModel) {
  return {
    description: quiz.description,
    id: quiz.id,
    isRequired: quiz.isRequired,
    lessonId: quiz.lessonId,
    passingScore: quiz.passingScore,
    position: quiz.position,
    questionCount: quiz.questions.length,
    questions: quiz.questions.map((question) => ({
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
    title: quiz.title,
  };
}

function serializeAttempt(attempt: QuizAttemptReadModel) {
  return {
    answers: attempt.answers,
    id: attempt.id,
    passed: attempt.passed,
    score: attempt.score,
    submittedAt: attempt.submittedAt,
    runSequence: attempt.runSequence ?? 1,
  };
}

export function createPrismaRepository(
  client: PrismaClient,
  recalculateProgress = recalculateLessonProgress,
): QuizRepository {
  return {
    async findPublishedQuizForUser(quizId, userId) {
      const quiz = await client.quiz.findFirst({
        where: {
          id: quizId,
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
        include: {
          questions: {
            orderBy: { position: 'asc' },
            include: { options: { orderBy: { position: 'asc' } } },
          },
        },
      });

      if (!quiz) {
        return null;
      }

      return {
        description: quiz.description,
        id: quiz.id,
        isRequired: quiz.isRequired,
        lessonId: quiz.lessonId,
        passingScore: quiz.passingScore,
        position: quiz.position,
        questions: quiz.questions,
        title: quiz.title,
      };
    },
    async listAttempts(quizId, userId) {
      const attempts = await client.quizAttempt.findMany({
        where: { quizId, userId },
        orderBy: { submittedAt: 'desc' },
        include: { moduleRun: { select: { sequence: true } } },
      });
      return attempts.map(({ moduleRun, ...attempt }) => ({
        ...attempt,
        runSequence: moduleRun.sequence,
      }));
    },
    async recordAttempt(input) {
      return runSerializableProgressTransaction(client, async (transaction) => {
        const moduleRun = await ensureCurrentModuleRunForLesson(
          transaction,
          input.lessonId,
          input.userId,
          input.submittedAt,
        );
        const attempt = await transaction.quizAttempt.create({
          data: {
            answers: input.answers,
            moduleRunId: moduleRun.id,
            passed: input.passed,
            quizId: input.quizId,
            score: input.score,
            submittedAt: input.submittedAt,
            userId: input.userId,
          },
        });

        const progress = await recalculateProgress(
          transaction,
          input.lessonId,
          input.userId,
          input.submittedAt,
          { requirePublished: true },
        );

        if (!progress) throw notFound();

        return { ...attempt, runSequence: moduleRun.sequence };
      });
    },
  };
}

async function getPrismaRepository(): Promise<QuizRepository> {
  const { prisma } = await import('../../prisma.js');

  return createPrismaRepository(prisma);
}

export function createQuizzesApp(options: QuizzesAppOptions = {}) {
  const app = new Hono<AuthEnvironment>();
  const now = options.now ?? (() => new Date());

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

  async function getQuiz(context: {
    get(key: 'user'): { id: string };
    req: { param(name: string): string };
  }) {
    const quizId = assertIdentifier(context.req.param('quizId'));
    const repository = options.repository ?? (await getPrismaRepository());
    const quiz = await repository.findPublishedQuizForUser(
      quizId,
      context.get('user').id,
    );

    if (!quiz) {
      throw notFound();
    }

    return { quiz, quizId, repository };
  }

  app.get('/api/quizzes/:quizId', async (context) => {
    const { quiz } = await getQuiz(context);

    return context.json({ quiz: serializeQuiz(quiz) });
  });

  app.get('/api/quizzes/:quizId/attempts', async (context) => {
    const { quizId, repository } = await getQuiz(context);
    const attempts = await repository.listAttempts(
      quizId,
      context.get('user').id,
    );

    return context.json({ attempts: attempts.map(serializeAttempt) });
  });

  app.post('/api/quizzes/:quizId/attempts', async (context) => {
    const parsedAttempt = await parseAttempt(context.req.raw);

    if (!parsedAttempt.success) {
      throw invalidRequest();
    }

    const { quiz, quizId, repository } = await getQuiz(context);

    if (quiz.questions.length === 0) {
      throw quizNotReady();
    }

    let result;

    try {
      result = gradeConceptAssessment({
        answers: parsedAttempt.data.answers as SubmittedAssessmentAnswer[],
        masteryThreshold: quiz.passingScore,
        questions: quiz.questions.map(toQuestionKey),
      });
    } catch {
      throw invalidRequest();
    }

    const attempt = await repository.recordAttempt({
      answers: toJsonValue(parsedAttempt.data.answers),
      lessonId: quiz.lessonId,
      passed: result.passed,
      quizId,
      score: result.score,
      submittedAt: now(),
      userId: context.get('user').id,
    });

    return context.json(
      {
        attempt: serializeAttempt(attempt),
        corrections: result.corrections,
      },
      201,
    );
  });

  return app;
}

export const quizzesApp = createQuizzesApp();
