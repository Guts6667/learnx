import { z } from 'zod';

import { ApiError } from '../_lib/errors.js';

const identifierSchema = z.string().uuid();
const submittedAnswerSchema = z.object({
  optionIds: z.array(identifierSchema).max(20).default([]),
  questionId: identifierSchema,
  text: z.string().trim().min(1).max(500).optional(),
});
const attemptSchema = z.object({
  answers: z.array(submittedAnswerSchema).min(1).max(50),
});

export function isAssessmentPreviewRequest(url: string): boolean {
  return new URL(url).searchParams.get('preview') === 'true';
}

export function invalidAssessmentRequest(): ApiError {
  return new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
}

export function assessmentNotFound(): ApiError {
  return new ApiError('RESOURCE_NOT_FOUND', 'Resource not found.', 404);
}

export function assessmentNotReady(): ApiError {
  return new ApiError(
    'ASSESSMENT_NOT_READY',
    'This assessment has no questions.',
    409,
  );
}

export function parseAssessmentIdentifier(value: string): string {
  const parsed = identifierSchema.safeParse(value);
  if (!parsed.success) throw invalidAssessmentRequest();
  return parsed.data;
}

export async function parseAssessmentAttempt(request: Request) {
  try {
    return attemptSchema.safeParse(await request.json());
  } catch {
    return attemptSchema.safeParse(null);
  }
}
