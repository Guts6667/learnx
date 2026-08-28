import type { MiddlewareHandler } from 'hono';

import type {
  Prisma,
  QuizQuestionType,
} from '../../../../generated/prisma/client.js';
import type { CursorPage } from '../_lib/cursor-pagination.js';
import type { AuthEnvironment } from '../_lib/auth.js';

export interface QuizQuestionReadModel {
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

export interface QuizReadModel {
  description: string | null;
  id: string;
  isRequired: boolean;
  lessonId: string;
  passingScore: number;
  position: number;
  questions: QuizQuestionReadModel[];
  title: string;
}

export interface QuizAttemptReadModel {
  answers: unknown;
  id: string;
  passed: boolean;
  score: number;
  submittedAt: Date;
  runSequence?: number;
}

export interface RecordQuizAttemptInput {
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
  listAttempts(input: {
    cursor?: string;
    pageSize: number;
    quizId: string;
    userId: string;
  }): Promise<CursorPage<QuizAttemptReadModel>>;
  recordAttempt(input: RecordQuizAttemptInput): Promise<QuizAttemptReadModel>;
}

export interface QuizzesAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  now?: () => Date;
  repository?: QuizRepository;
}
