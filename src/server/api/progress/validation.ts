import { z } from 'zod';

import { ApiError } from '../_lib/errors.js';

const identifierSchema = z.string().uuid();
export const taskStatusSchema = z.object({
  status: z.enum(['TODO', 'DONE', 'SKIPPED']),
});
export const resourceStatusSchema = z.object({
  status: z.enum(['NOT_STARTED', 'STARTED', 'COMPLETED']),
});
export const scheduleSchema = z.object({
  targetEndAt: z.iso.datetime({ offset: true }),
});
export const lessonLocationSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum([
    'CONTENT',
    'RESOURCE',
    'TASK',
    'CONCEPT_ASSESSMENT',
    'EXERCISE',
    'QUIZ',
  ]),
});

export function progressNotFound(): ApiError {
  return new ApiError('RESOURCE_NOT_FOUND', 'Resource not found.', 404);
}

export function invalidProgressRequest(): ApiError {
  return new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
}

export function assertProgressIdentifier(value: string): string {
  const parsedIdentifier = identifierSchema.safeParse(value);
  if (!parsedIdentifier.success) throw invalidProgressRequest();
  return parsedIdentifier.data;
}

export async function parseProgressBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw invalidProgressRequest();
  }
}

export function assertTargetAfterStart(
  startedAt: Date,
  targetEndAt: Date,
): void {
  if (targetEndAt.getTime() <= startedAt.getTime()) {
    throw invalidProgressRequest();
  }
}
