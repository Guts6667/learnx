export type ApiErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_REQUEST'
  | 'INTERNAL_ERROR'
  | 'TOO_MANY_LOGIN_ATTEMPTS';

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
