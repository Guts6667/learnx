import { z } from 'zod';

import { cursorPageQuerySchema } from '../_lib/cursor-pagination.js';
import { ApiError } from '../_lib/errors.js';

const identifierSchema = z.uuid();

export const noteListSchema = cursorPageQuerySchema.extend({
  lessonId: identifierSchema.optional(),
  search: z.string().trim().max(100).optional(),
});

export const createNoteSchema = z
  .object({
    creationKey: identifierSchema.nullable().optional(),
    lessonId: identifierSchema.nullable().optional(),
    markdown: z.string().max(100_000).default(''),
    sequenceItemId: identifierSchema.nullable().optional(),
    title: z.string().trim().min(1).max(200).default('Nouvelle note'),
  })
  .refine((input) => !input.sequenceItemId || Boolean(input.lessonId));

export const updateNoteSchema = z
  .object({
    markdown: z.string().max(100_000).optional(),
    title: z.string().trim().min(1).max(200).optional(),
  })
  .refine((input) => input.markdown !== undefined || input.title !== undefined);

export function invalidNoteRequest(): ApiError {
  return new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
}

export function noteNotFound(): ApiError {
  return new ApiError('RESOURCE_NOT_FOUND', 'Resource not found.', 404);
}

export function parseNoteIdentifier(value: string): string {
  const result = identifierSchema.safeParse(value);
  if (!result.success) throw invalidNoteRequest();
  return result.data;
}

export async function parseNoteJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw invalidNoteRequest();
  }
}
