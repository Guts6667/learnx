import { z } from 'zod';

import { ApiError } from '../_lib/errors.js';

const identifierSchema = z.uuid();
const previewSchema = z.object({ preview: z.enum(['true']).optional() });
const saveSchema = z.object({
  action: z.literal('save'),
  attachmentUrl: z.url().nullable().optional(),
  contentMarkdown: z.string().max(100_000).nullable().optional(),
});
const validateSchema = z.object({
  action: z.literal('validate'),
  reviewFeedback: z.string().trim().max(10_000).nullable().optional(),
  score: z.number().min(0).max(100),
});
const revisionSchema = z.object({
  action: z.literal('request_revision'),
  reviewFeedback: z.string().trim().min(1).max(10_000),
  score: z.number().min(0).max(100).nullable().optional(),
});
const updateSchema = z.discriminatedUnion('action', [
  saveSchema,
  validateSchema,
  revisionSchema,
]);

export type StageAssessmentUpdate = z.infer<typeof updateSchema>;

export function invalidRequest(message = 'Invalid request.'): ApiError {
  return new ApiError('INVALID_REQUEST', message, 400);
}

export function stageAssessmentNotFound(): ApiError {
  return new ApiError('RESOURCE_NOT_FOUND', 'Resource not found.', 404);
}

export function submissionConflict(message: string): ApiError {
  return new ApiError('INVALID_SUBMISSION_STATE', message, 409);
}

export function parseIdentifier(value: string): string {
  const result = identifierSchema.safeParse(value);
  if (!result.success) throw invalidRequest();
  return result.data;
}

export function parsePreview(url: string): boolean {
  const result = previewSchema.safeParse(
    Object.fromEntries(new URL(url).searchParams),
  );
  if (!result.success) throw invalidRequest();
  return result.data.preview === 'true';
}

export async function parseUpdate(
  request: Request,
): Promise<StageAssessmentUpdate> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw invalidRequest();
  }
  const result = updateSchema.safeParse(body);
  if (!result.success) throw invalidRequest();
  return result.data;
}
