import { z } from 'zod';

import { ApiError } from '../_lib/errors.js';
import {
  learningProgramWhere,
  previewProgramWhere,
} from '../_lib/program-access-policy.js';

const previewQuerySchema = z.object({
  preview: z.enum(['true']).optional(),
});
export const programViewPreferenceSchema = z.object({
  expandedStageId: z.string().uuid(),
});

export function curriculumNotFound(): ApiError {
  return new ApiError('RESOURCE_NOT_FOUND', 'Resource not found.', 404);
}

function ambiguousResource(): ApiError {
  return new ApiError(
    'AMBIGUOUS_RESOURCE',
    'This slug is not unique. Use the parent resource route instead.',
    409,
  );
}

export function invalidCurriculumRequest(): ApiError {
  return new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
}

export function isPreviewRequest(url: string): boolean {
  const query = previewQuerySchema.safeParse(
    Object.fromEntries(new URL(url).searchParams),
  );
  if (!query.success) throw invalidCurriculumRequest();
  return query.data.preview === 'true';
}

export function getProgramAccessFilter(userId: string, preview: boolean) {
  return preview ? previewProgramWhere(userId) : learningProgramWhere(userId);
}

export function getPublicationFilter(preview: boolean) {
  return preview ? {} : { isPublished: true };
}

export function selectAccessibleCandidate<T>(
  candidates: T[],
  userId: string,
  getOwnerId: (candidate: T) => string,
): T {
  const owned = candidates.find(
    (candidate) => getOwnerId(candidate) === userId,
  );
  if (owned) return owned;
  if (candidates.length === 0) throw curriculumNotFound();
  if (candidates.length > 1) throw ambiguousResource();
  return candidates[0];
}
