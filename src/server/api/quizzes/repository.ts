import type {
  Prisma,
  PrismaClient,
} from '../../../../generated/prisma/client.js';
import {
  encodeCursor,
  InvalidCursorError,
  parseCursor,
  toCursorPage,
} from '../_lib/cursor-pagination.js';
import { ensureCurrentModuleRunForLesson } from '../_lib/module-runs.js';
import { learningProgramWhere } from '../_lib/program-access-policy.js';
import {
  recalculateLessonProgress,
  runSerializableProgressTransaction,
} from '../_lib/progress-recalculation.js';
import type {
  QuizRepository,
  RecordQuizAttemptInput,
} from './types.js';
import { quizNotFound } from './validation.js';

type RecalculateProgress = typeof recalculateLessonProgress;

async function findPublishedQuiz(
  client: PrismaClient,
  quizId: string,
  userId: string,
) {
  const quiz = await client.quiz.findFirst({
    where: {
      id: quizId,
      lesson: {
        isPublished: true,
        module: {
          isPublished: true,
          stage: {
            isPublished: true,
            program: learningProgramWhere(userId),
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
  if (!quiz) return null;
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
}

async function listQuizAttempts(
  client: PrismaClient,
  input: Parameters<QuizRepository['listAttempts']>[0],
) {
  const context = `${input.userId}:${input.quizId}`;
  const cursor = parseCursor(input.cursor, 'quiz-attempts', context);
  const cursorDate = cursor ? new Date(cursor.value) : undefined;
  if (cursorDate && Number.isNaN(cursorDate.getTime())) {
    throw new InvalidCursorError();
  }
  const attempts = await client.quizAttempt.findMany({
    where: {
      quizId: input.quizId,
      userId: input.userId,
      quiz: {
        lesson: {
          isPublished: true,
          module: {
            isPublished: true,
            stage: {
              isPublished: true,
              program: learningProgramWhere(input.userId),
            },
          },
        },
      },
      ...(cursor && cursorDate
        ? {
            OR: [
              { submittedAt: { lt: cursorDate } },
              { id: { lt: cursor.id }, submittedAt: cursorDate },
            ],
          }
        : {}),
    },
    orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
    include: { moduleRun: { select: { sequence: true } } },
    take: input.pageSize + 1,
  });
  const page = toCursorPage(attempts, input.pageSize, (attempt) =>
    encodeCursor('quiz-attempts', context, {
      id: attempt.id,
      value: attempt.submittedAt.toISOString(),
    }),
  );
  return {
    items: page.items.map(({ moduleRun, ...attempt }) => ({
      ...attempt,
      runSequence: moduleRun.sequence,
    })),
    nextCursor: page.nextCursor,
  };
}

async function recordQuizAttempt(
  transaction: Prisma.TransactionClient,
  input: RecordQuizAttemptInput,
  recalculateProgress: RecalculateProgress,
) {
  const accessibleQuiz = await transaction.quiz.findFirst({
    where: {
      id: input.quizId,
      lessonId: input.lessonId,
      lesson: {
        isPublished: true,
        module: {
          isPublished: true,
          stage: {
            isPublished: true,
            program: learningProgramWhere(input.userId),
          },
        },
      },
    },
    select: { id: true },
  });
  if (!accessibleQuiz) throw quizNotFound();
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
  if (!progress) throw quizNotFound();
  return { ...attempt, runSequence: moduleRun.sequence };
}

class PrismaQuizRepository implements QuizRepository {
  constructor(
    private readonly client: PrismaClient,
    private readonly recalculateProgress: RecalculateProgress,
  ) {}

  findPublishedQuizForUser(quizId: string, userId: string) {
    return findPublishedQuiz(this.client, quizId, userId);
  }

  listAttempts(input: Parameters<QuizRepository['listAttempts']>[0]) {
    return listQuizAttempts(this.client, input);
  }

  recordAttempt(input: RecordQuizAttemptInput) {
    return runSerializableProgressTransaction(this.client, (transaction) =>
      recordQuizAttempt(transaction, input, this.recalculateProgress),
    );
  }
}

export function createPrismaRepository(
  client: PrismaClient,
  recalculateProgress = recalculateLessonProgress,
): QuizRepository {
  return new PrismaQuizRepository(client, recalculateProgress);
}
