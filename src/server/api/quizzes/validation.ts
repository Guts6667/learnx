import { z } from 'zod';

import { ApiError } from '../_lib/errors.js';

const identifierSchema = z.string().uuid();
const submittedAnswerSchema = z.object({
  optionIds: z.array(identifierSchema).max(20).default([]),
  questionId: identifierSchema,
  text: z.string().trim().min(1).max(500).optional(),
});
const attemptSchema = z.object({
  answers: z.array(submittedAnswerSchema).min(1).max(100),
});

export function invalidQuizRequest(): ApiError {
  return new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
}

export function quizNotFound(): ApiError {
  return new ApiError('RESOURCE_NOT_FOUND', 'Resource not found.', 404);
}

export function quizNotReady(): ApiError {
  return new ApiError(
    'ASSESSMENT_NOT_READY',
    'This quiz has no questions.',
    409,
  );
}

export function parseQuizIdentifier(value: string): string {
  const parsed = identifierSchema.safeParse(value);
  if (!parsed.success) throw invalidQuizRequest();
  return parsed.data;
}

export async function parseQuizAttempt(request: Request) {
  try {
    return attemptSchema.safeParse(await request.json());
  } catch {
    return attemptSchema.safeParse(null);
  }
}
