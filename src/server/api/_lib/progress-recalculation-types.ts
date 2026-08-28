import type {
  ConceptProgressStatus,
  ExerciseSubmissionStatus,
  LessonProgressStatus,
  Prisma,
  PrismaClient,
  ResourceProgressStatus,
  TaskCompletionStatus,
} from '../../../../generated/prisma/client.js';

export type ProgressReadClient = PrismaClient | Prisma.TransactionClient;

export interface LessonProgressSnapshot {
  canComplete: boolean;
  conceptStatusById: Map<string, ConceptProgressStatus>;
  exerciseStatusById: Map<string, ExerciseSubmissionStatus>;
  lessonProgress: {
    completedAt: Date | null;
    percent: number;
    startedAt: Date | null;
    status: LessonProgressStatus;
    currentSequenceItem?: {
      conceptAssessmentId: string | null;
      contentBlockId: string | null;
      exerciseId: string | null;
      kind: string;
      quizId: string | null;
      resourceId: string | null;
      taskId: string | null;
    } | null;
  } | null;
  percent: number;
  quizPassedById: Map<string, boolean>;
  resourceStatusById: Map<string, ResourceProgressStatus>;
  taskStatusById: Map<string, TaskCompletionStatus>;
}

export interface RecalculationOptions {
  completeRequested?: boolean;
  preserveTimestamps?: boolean;
  requirePublished?: boolean;
  startIfMissing?: boolean;
}
