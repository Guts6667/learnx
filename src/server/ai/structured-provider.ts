import type { z } from 'zod';

export const AI_MODEL_ROLES = [
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

export interface StructuredGenerationRequest<Output> {
  idempotencyKey: string;
  maxOutputTokens: number;
  messages: AiPromptMessage[];
  outputSchema: z.ZodType<Output>;
  outputSchemaName: string;
  role: AiModelRole;
  signal?: AbortSignal;
}

export interface AiGenerationUsage {
  completionTokens: number;
  costUsd: number;
  promptTokens: number;
  totalTokens: number;
}

export interface AiGenerationMetadata {
  attemptCount: number;
  generationId: string;
  latencyMs: number;
  modelId: string;
  provider: string;
  role: AiModelRole;
  usage: AiGenerationUsage;
}

export interface AiProviderLogEvent {
  attempt: number;
  code?: AiProviderErrorCode;
  durationMs: number;
  event: 'ai_provider_request';
  modelId: string;
  operationHash: string;
  provider: string;
  role: string;
  status: 'failure' | 'success';
}

export interface StructuredGenerationResult<Output> {
  metadata: AiGenerationMetadata;
  output: Output;
}

export interface StructuredAiProvider {
  readonly name: string;
  generate<Output>(
    request: StructuredGenerationRequest<Output>,
  ): Promise<StructuredGenerationResult<Output>>;
}
