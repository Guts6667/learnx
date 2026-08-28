import type { MiddlewareHandler } from 'hono';

import type { AuthEnvironment } from '../_lib/auth.js';

export interface ProgramRecord {
  id: string;
  position: number;
  progress: Array<{ lastViewedAt: Date; percent: number }>;
  slug: string;
  title: string;
}

export interface ReviewRecord {
  dueAt: Date;
  id: string;
  lesson: {
    estimatedMinutes: number | null;
    slug: string;
    title: string;
    module: { title: string; stage: { title: string } };
  };
  program: { id: string; slug: string; title: string };
  sourceId: string;
}

export interface LessonRecord {
  activityCompletionCarryovers: Array<{
    activityKey: string;
    kind: string;
    moduleRunId: string;
  }>;
  concepts: Array<{
    assessments: Array<{ id: string; questions: Array<{ id: string }> }>;
    id: string;
    progress: Array<{ status: string }>;
    title: string;
  }>;
  estimatedMinutes: number | null;
  exercises: Array<{
    id: string;
    key: string;
    submissions: Array<{ status: string }>;
    title: string;
  }>;
  id: string;
  module: {
    id: string;
    position: number;
    slug: string;
    stage: {
      id: string;
      position: number;
      program: { id: string; position: number; slug: string; title: string };
      progress: Array<{ status: string }>;
      slug: string;
      title: string;
    };
    title: string;
  };
  position: number;
  progress: Array<{ lastViewedAt: Date | null; status: string }>;
  quizzes: Array<{
    attempts: Array<{ passed: boolean }>;
    id: string;
    title: string;
  }>;
  lessonSequenceItems?: Array<{
    conceptAssessmentId: string | null;
    exerciseId: string | null;
    position: number;
    quizId: string | null;
    taskId: string | null;
  }>;
  slug: string;
  tasks: Array<{
    completions: Array<{ status: string }>;
    id: string;
    key: string;
    title: string;
  }>;
  title: string;
}

export interface FinalAssessmentRecord {
  id: string;
  stage: {
    id: string;
    modules: Array<{
      lessons: Array<{ progress: Array<{ status: string }> }>;
    }>;
    position: number;
    program: { id: string; position: number; slug: string; title: string };
    progress: Array<{ status: string }>;
    slug: string;
    title: string;
  };
  submissions: Array<{ status: string }>;
  title: string;
}

export interface TodayRepository {
  listActivePrograms(userId: string): Promise<ProgramRecord[]>;
  listFinalAssessments(userId: string): Promise<FinalAssessmentRecord[]>;
  listLessons(userId: string): Promise<LessonRecord[]>;
  listPendingReviews(userId: string): Promise<ReviewRecord[]>;
}

export interface TodayAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  now?: () => Date;
  repository?: TodayRepository;
}
