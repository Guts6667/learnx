import { ProgramVisibility } from '../../../../generated/prisma/client.js';
import { z, type ZodType } from 'zod';

import { bilingualQaChecksSchema } from '../../../shared/bilingual-editorial.js';
import { ApiError } from '../_lib/errors.js';
import {
  administrableAccountStatuses,
  type AccountTransitionResult,
} from './account-administration-service.js';
import type { AccountErasureResult } from './account-erasure-service.js';
import { reviewableAccessRequestStatuses } from './access-request-review-types.js';
import { translationWorkflowActions } from './translation-workflow-service.js';

const identifierSchema = z.uuid();
const positionSchema = z.number().int().min(0).max(10_000);

export const moduleUpdateSchema = z
  .object({
    description: z.string().trim().min(1).max(5_000).optional(),
    position: positionSchema.optional(),
    title: z.string().trim().min(1).max(200).optional(),
  })
  .refine((input) => Object.keys(input).length > 0);

export const lessonUpdateSchema = z
  .object({
    isPublished: z.boolean().optional(),
    position: positionSchema.optional(),
    summary: z.string().trim().min(1).max(5_000).optional(),
    title: z.string().trim().min(1).max(200).optional(),
  })
  .refine((input) => Object.keys(input).length > 0);

export const publicationRequestSchema = z
  .object({
    action: z.enum(['PUBLISH', 'UNPUBLISH']),
    mode: z.enum(['FULL', 'PARENT_ONLY']),
    targetId: identifierSchema,
    targetType: z.enum(['PROGRAM', 'STAGE', 'MODULE']),
  })
  .strict();

export const applyPublicationSchema = publicationRequestSchema.extend({
  planId: z.string().regex(/^[a-f0-9]{64}$/),
});

export const accessRequestListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(320).optional(),
  status: z.enum(reviewableAccessRequestStatuses).optional(),
});

export const approveAccessRequestSchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    role: z.enum(['USER', 'CREATOR', 'ADMIN']),
  })
  .strict();

export const rejectAccessRequestSchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    reason: z.string().trim().min(1).max(2_000),
  })
  .strict();

export const resendAccessInvitationSchema = z
  .object({ expectedVersion: z.number().int().min(1) })
  .strict();

export const accountListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(320).optional(),
  status: z.enum(administrableAccountStatuses).optional(),
});

export const accountTransitionSchema = z
  .object({
    expectedStatus: z.enum(administrableAccountStatuses),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

/**
 * No `expectedStatus`: erasure is terminal from any state, and requiring the
 * caller to name the current one would only make an irreversible action fail
 * for a reason that does not matter. The `updatedAt` check stays, so the
 * account cannot have changed under the administrator between reading and
 * acting.
 */
export const accountErasureSchema = z
  .object({
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const accountRoleTransitionSchema = z
  .object({
    expectedRole: z.enum(['USER', 'CREATOR']),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
    role: z.enum(['USER', 'CREATOR']),
  })
  .strict();

export const programVisibilityUpdateSchema = z
  .object({
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
    visibility: z.enum([ProgramVisibility.PRIVATE, ProgramVisibility.PUBLIC]),
  })
  .strict();

export const translationWorkflowTransitionSchema = z
  .object({
    action: z.enum(translationWorkflowActions),
    expectedVersion: z.number().int().min(0),
    glossaryVersion: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/)
      .optional(),
    qaChecks: bilingualQaChecksSchema.optional(),
    sourceProgramVersionId: identifierSchema.optional(),
  })
  .strict();

function invalidRequest() {
  return new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
}

export function notFound() {
  return new ApiError('RESOURCE_NOT_FOUND', 'Resource not found.', 404);
}

export function lessonNotReady() {
  return new ApiError(
    'LESSON_NOT_READY',
    'Every required concept must have a required assessment before publication.',
    409,
  );
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw invalidRequest();
  }
}

export async function parseBody<T>(schema: ZodType<T>, request: Request) {
  const result = schema.safeParse(await readJson(request));
  if (!result.success) throw invalidRequest();
  return result.data;
}

export function parseQuery<T>(schema: ZodType<T>, query: unknown) {
  const result = schema.safeParse(query);
  if (!result.success) throw invalidRequest();
  return result.data;
}

export function parseIdentifier(value: string) {
  return parseQuery(identifierSchema, value);
}

export function handleAccountErasure(result: AccountErasureResult) {
  if (result.kind === 'NOT_FOUND') throw notFound();
  if (result.kind === 'CONFLICT') {
    throw new ApiError(
      'ACCOUNT_STATE_CONFLICT',
      'The account has changed. Refresh before retrying.',
      409,
    );
  }
  // Repeating an erasure is not an error: the account is already erased and
  // the caller's intent is satisfied. Saying so lets a retried request settle
  // instead of looking like a failure to an operator acting on a request they
  // cannot see the result of.
  return { alreadyErased: result.kind === 'ALREADY_ERASED', erased: true };
}

export function handleAccountTransition(result: AccountTransitionResult) {
  if (result.kind === 'NOT_FOUND') throw notFound();
  if (result.kind === 'CONFLICT') {
    throw new ApiError(
      'ACCOUNT_STATE_CONFLICT',
      'The account status has changed. Refresh before retrying.',
      409,
    );
  }
  if (result.kind === 'SELF_SUSPENSION') {
    throw new ApiError(
      'SELF_SUSPENSION_NOT_ALLOWED',
      'The current administrator cannot suspend their own account.',
      409,
    );
  }
  if (result.kind === 'ROLE_NOT_ASSIGNABLE') {
    throw new ApiError(
      'ACCOUNT_STATE_CONFLICT',
      'Only learner and creator roles can be changed from this endpoint.',
      409,
    );
  }
  return result.account;
}
