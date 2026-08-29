import { z } from 'zod';

import { ApiError } from '../_lib/errors.js';

const identifierSchema = z.uuid();
const restartSchema = z.object({ restartKey: z.uuid() });

export function restartResourceNotFound() {
  return new ApiError('RESOURCE_NOT_FOUND', 'Resource not found.', 404);
}

export function invalidRestartRequest() {
  return new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
}

export function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'P2002',
  );
}

export function parseRestartIdentifier(value: string): string {
  const parsed = identifierSchema.safeParse(value);
  if (!parsed.success) throw invalidRestartRequest();
  return parsed.data;
}

export async function parseRestartBody(request: Request) {
  try {
    return restartSchema.safeParse(await request.json());
  } catch {
    return restartSchema.safeParse(null);
  }
}
