import { z } from 'zod';

import {
  assertExerciseSubmissionCanBeEdited,
  assertExerciseSubmissionCanBeSubmitted,
  MAX_EXERCISE_SUBMISSION_CHARACTERS,
  type ExerciseSubmissionState,
} from '../../../lib/exercises.js';
import { ApiError } from '../_lib/errors.js';
import type { ExerciseSubmissionRecord } from './types.js';

const identifierSchema = z.uuid();
const saveSchema = z.object({
  contentMarkdown: z.string().max(MAX_EXERCISE_SUBMISSION_CHARACTERS),
});

function exerciseInvalidRequest(): ApiError {
  return new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
}

export function exerciseNotFound(): ApiError {
  return new ApiError('RESOURCE_NOT_FOUND', 'Resource not found.', 404);
}

function exerciseConflict(message: string): ApiError {
  return new ApiError('INVALID_SUBMISSION_STATE', message, 409);
}

export function parseExerciseIdentifier(value: string): string {
  const result = identifierSchema.safeParse(value);
  if (!result.success) throw exerciseInvalidRequest();
  return result.data;
}

export async function parseExerciseSubmissionBody(
  request: Request,
): Promise<{ contentMarkdown: string }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw exerciseInvalidRequest();
  }
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) throw exerciseInvalidRequest();
  return parsed.data;
}

export function assertSubmissionEditable(
  submission: ExerciseSubmissionRecord,
): void {
  try {
    assertExerciseSubmissionCanBeEdited(
      submission.status as ExerciseSubmissionState,
    );
  } catch (error) {
    throw exerciseConflict(
      error instanceof Error ? error.message : 'Conflict.',
    );
  }
}

export function assertSubmissionSubmittable(
  submission: ExerciseSubmissionRecord,
): void {
  try {
    assertExerciseSubmissionCanBeSubmitted({
      contentMarkdown: submission.contentMarkdown,
      status: submission.status as ExerciseSubmissionState,
    });
  } catch (error) {
    throw exerciseConflict(
      error instanceof Error ? error.message : 'Conflict.',
    );
  }
}
