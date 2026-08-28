import type {
  PrismaClient,
  ResourceProgressStatus,
  TaskCompletionStatus,
} from '../../../../generated/prisma/client.js';
import type { requireUser } from '../_lib/auth.js';
import type {
  getLessonProgressSnapshot,
  recalculateLessonProgress,
  runSerializableProgressTransaction,
} from '../_lib/progress-recalculation.js';
import type {
  getProgramTimeline,
  getStageTimeline,
} from '../_lib/timeline-progress.js';

export interface ProgressAppOptions {
  authentication?: typeof requireUser;
  getClient?: () => Promise<PrismaClient>;
}

export interface ProgressServiceOptions {
  client: PrismaClient;
  readLessonSnapshot: typeof getLessonProgressSnapshot;
  readProgramTimeline: typeof getProgramTimeline;
  readStageTimeline: typeof getStageTimeline;
  recalculateLesson: typeof recalculateLessonProgress;
  runTransaction: typeof runSerializableProgressTransaction;
}

export interface LessonLocationInput {
  id: string;
  kind:
    | 'CONCEPT_ASSESSMENT'
    | 'CONTENT'
    | 'EXERCISE'
    | 'QUIZ'
    | 'RESOURCE'
    | 'TASK';
}

export type ProgressTaskStatus = TaskCompletionStatus;
export type ProgressResourceStatus = ResourceProgressStatus;
