import type { MiddlewareHandler } from 'hono';

import type {
  ConceptProgressStatus,
  ConceptQuestionType,
  Prisma,
} from '../../../../generated/prisma/client.js';
import type { AuthEnvironment } from '../_lib/auth.js';
import type { CursorPage } from '../_lib/cursor-pagination.js';

export interface AssessmentQuestionReadModel {
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

export interface AssessmentReadModel {
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

export interface AttemptReadModel {
  answers: unknown;
  id: string;
  passed: boolean;
  score: number;
  submittedAt: Date;
  runSequence?: number;
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

export interface RecordAttemptInput {
  answers: Prisma.InputJsonValue;
  assessmentId: string;
  conceptId: string;
  dueAt: Date;
  lessonId: string;
  passed: boolean;
  programId: string;
  preview: boolean;
  score: number;
  submittedAt: Date;
  userId: string;
}

export interface ConceptAssessmentRepository {
  findAssessmentForUser(
    assessmentId: string,
    userId: string,
    preview: boolean,
  ): Promise<AssessmentReadModel | null>;
  listAttempts(input: {
    assessmentId: string;
    cursor?: string;
    pageSize: number;
    preview: boolean;
    userId: string;
  }): Promise<CursorPage<AttemptReadModel>>;
  recordAttempt(input: RecordAttemptInput): Promise<RecordedAttempt>;
}

export interface ConceptAssessmentsAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  now?: () => Date;
  repository?: ConceptAssessmentRepository;
  refreshValidation?: (
    stageId: string,
    userId: string,
    now: Date,
  ) => Promise<void>;
}
