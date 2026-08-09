export type ApiErrorCode =
  | 'ACCESS_REQUESTS_DISABLED'
  | 'ACCESS_REQUEST_CONFLICT'
  | 'ACCOUNT_STATE_CONFLICT'
  | 'ASSESSMENT_NOT_READY'
  | 'AUTHENTICATION_REQUIRED'
  | 'AMBIGUOUS_RESOURCE'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'FORBIDDEN'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_ACCESS_INVITATION'
  | 'INVALID_REQUEST'
  | 'INVALID_SUBMISSION_STATE'
  | 'INVALID_TRANSLATION_SOURCE'
  | 'INVALID_TRANSLATION_TRANSITION'
  | 'INTERNAL_ERROR'
  | 'INVALID_EMAIL_VERIFICATION'
  | 'LESSON_NOT_READY'
  | 'PUBLICATION_BLOCKED'
  | 'PUBLICATION_PLAN_STALE'
  | 'PROGRAM_VISIBILITY_CONFLICT'
  | 'REGISTRATION_DISABLED'
  | 'RESOURCE_NOT_FOUND'
  | 'SELF_SUSPENSION_NOT_ALLOWED'
  | 'TIMELINE_NOT_STARTED'
  | 'TOO_MANY_ACCESS_REQUESTS'
  | 'TOO_MANY_LOGIN_ATTEMPTS'
  | 'TRANSLATION_WORKFLOW_CONFLICT';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

export class ApiError extends Error {
  public constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: ContentfulStatusCode,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function toApiErrorBody(error: ApiError): ApiErrorBody {
  return {
    error: {
      code: error.code,
      message: error.message,
    },
  };
}
import type { ContentfulStatusCode } from 'hono/utils/http-status';
