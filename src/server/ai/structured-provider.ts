export const AI_MODEL_ROLES = [
  'CORRECTION_PRIMARY',
  'CORRECTION_SECOND_PASS',
  'CORRECTION_CHECKER',
] as const;

/**
 * Roles every enabled environment must assign. A missing assignment for one of
 * these is a broken configuration and refuses to boot.
 *
 * `CORRECTION_CHECKER` is deliberately absent: an environment that has not been
 * given the checker yet must degrade to UNAVAILABLE verdicts, not crash. That
 * is the same fail-closed rule the checker itself follows, applied to its own
 * configuration, and it lets the code deploy before the environment variables
 * without taking AI correction down in between.
 */
export const REQUIRED_AI_MODEL_ROLES = [
  'CORRECTION_PRIMARY',
  'CORRECTION_SECOND_PASS',
] as const;

export type AiModelRole = (typeof AI_MODEL_ROLES)[number];

export type AiProviderErrorCode =
  | 'AI_DISABLED'
  | 'CONFIGURATION_INVALID'
  | 'CONTEXT_LIMIT_EXCEEDED'
  | 'DUPLICATE_OPERATION_CONFLICT'
  | 'OUTPUT_TOKEN_LIMIT_EXCEEDED'
  | 'PROVIDER_AUTHENTICATION_FAILED'
  | 'PROVIDER_FORBIDDEN'
  | 'PROVIDER_PAYMENT_REQUIRED'
  | 'PROVIDER_RATE_LIMITED'
  | 'PROVIDER_REQUEST_INVALID'
  | 'PROVIDER_RESPONSE_INVALID'
  | 'PROVIDER_RESPONSE_TRUNCATED'
  | 'PROVIDER_UNAVAILABLE'
  | 'REQUEST_ABORTED'
  | 'REQUEST_TIMEOUT';

export class AiProviderError extends Error {
  public constructor(
    public readonly code: AiProviderErrorCode,
    public readonly retryable: boolean,
  ) {
    super(code);
    this.name = 'AiProviderError';
  }
}

export interface AiPromptMessage {
  content: string;
  role: 'system' | 'user';
}
