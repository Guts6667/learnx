import type { MiddlewareHandler } from 'hono';

import { ExerciseSubmissionStatus } from '../../../../generated/prisma/client.js';
import type { AuthEnvironment } from '../_lib/auth.js';

export type SubmissionStatus = keyof typeof ExerciseSubmissionStatus;

export interface ExerciseSubmissionRecord {
  contentMarkdown: string;
  createdAt: Date;
  exerciseId: string;
  id: string;
  moduleRunId: string;
  status: SubmissionStatus;
  submittedAt: Date | null;
  updatedAt: Date;
  userId: string;
}

export interface ExerciseRecord {
  activityType: string;
  id: string;
  instructions: string;
  isRequired: boolean;
  key: string;
  language?: string;
  lessonId: string;
  lessonObjectives: string[];
  lessonSlug: string;
  lessonSummary: string;
  position: number;
  programSlug: string;
  rubric: unknown;
  submission: ExerciseSubmissionRecord | null;
  title: string;
}

export interface ExerciseRepository {
  createOrGetSubmission(
    exerciseId: string,
    userId: string,
  ): Promise<ExerciseSubmissionRecord>;
  findExerciseForUser(
    exerciseId: string,
    userId: string,
  ): Promise<ExerciseRecord | null>;
  findOwnedSubmission(
    submissionId: string,
    userId: string,
  ): Promise<ExerciseSubmissionRecord | null>;
  saveSubmission(
    submissionId: string,
    contentMarkdown: string,
    userId: string,
  ): Promise<ExerciseSubmissionRecord>;
  submitSubmission(
    submissionId: string,
    submittedAt: Date,
    userId: string,
  ): Promise<ExerciseSubmissionRecord>;
}

export interface ExercisesAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  now?: () => Date;
  repository?: ExerciseRepository;
}

export interface ExerciseService {
  createSubmission(
    exerciseId: string,
    userId: string,
  ): Promise<ExerciseSubmissionRecord>;
  getExercise(
    exerciseId: string,
    userId: string,
  ): Promise<
    ExerciseRecord & {
      aiCorrectionEligible: boolean;
    }
  >;
  saveSubmission(
    submissionId: string,
    contentMarkdown: string,
    userId: string,
  ): Promise<ExerciseSubmissionRecord>;
  submitSubmission(
    submissionId: string,
    userId: string,
  ): Promise<ExerciseSubmissionRecord>;
}
