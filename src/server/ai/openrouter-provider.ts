import { createHash } from 'node:crypto';

import { z } from 'zod';

import { sanitizeStructuredOutputJsonSchema } from '../../lib/ai-json-schema.js';

import type { OpenRouterConfiguration } from './openrouter-configuration.js';
import {
  AiProviderError,
  type AiProviderLogEvent,
  type StructuredAiProvider,
  type StructuredGenerationRequest,
  type StructuredGenerationResult,
} from './structured-provider.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const responseSchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            error: z.unknown().optional(),
            finish_reason: z.string().nullable().optional(),
            message: z.object({ content: z.string() }).passthrough(),
          })
          .passthrough(),
      )
      .min(1),
    id: z.string().trim().min(1),
    model: z.string().trim().min(1),
    usage: z
      .object({
        completion_tokens: z.number().int().nonnegative(),
        cost: z.number().nonnegative(),
        prompt_tokens: z.number().int().nonnegative(),
        total_tokens: z.number().int().nonnegative(),
      })
      .passthrough(),
  })
  .passthrough();

interface OpenRouterProviderOptions {
  configuration: OpenRouterConfiguration;
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  write?: (event: AiProviderLogEvent) => void;
}

interface ActiveOperation {
  fingerprint: string;
  promise: Promise<StructuredGenerationResult<unknown>>;
}

class HttpResponseError extends Error {
  public constructor(
    public readonly response: Response,
    public readonly normalized: AiProviderError,
  ) {
    super(normalized.code);
  }
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function defaultSleep(
  milliseconds: number,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AiProviderError('REQUEST_ABORTED', false));
      return;
    }
    const timeout = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        reject(new AiProviderError('REQUEST_ABORTED', false));
      },
      { once: true },
    );
  });
}

function errorFromStatus(status: number): AiProviderError {
  if (status === 400 || status === 413 || status === 422) {
    return new AiProviderError('PROVIDER_REQUEST_INVALID', false);
  }
  if (status === 401) {
    return new AiProviderError('PROVIDER_AUTHENTICATION_FAILED', false);
  }
  if (status === 402) {
    return new AiProviderError('PROVIDER_PAYMENT_REQUIRED', false);
  }
  if (status === 403) {
    return new AiProviderError('PROVIDER_FORBIDDEN', false);
  }
  if (status === 429) {
    return new AiProviderError('PROVIDER_RATE_LIMITED', true);
  }
  if (status === 503) {
    return new AiProviderError('PROVIDER_UNAVAILABLE', true);
  }
  return new AiProviderError('PROVIDER_UNAVAILABLE', false);
}

function retryDelay(response: Response, maximum: number): number {
  const seconds = Number(response.headers.get('retry-after'));
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.min(seconds * 1_000, maximum);
}

export class OpenRouterStructuredProvider implements StructuredAiProvider {
  public readonly name = 'openrouter';

  private readonly activeOperations = new Map<string, ActiveOperation>();
  private readonly fetchImplementation: typeof fetch;
  private readonly now: () => number;
  private readonly sleep: (
    milliseconds: number,
    signal?: AbortSignal,
  ) => Promise<void>;
  private readonly write: (event: AiProviderLogEvent) => void;

  public constructor(private readonly options: OpenRouterProviderOptions) {
    this.fetchImplementation = options.fetch ?? fetch;
    this.now = options.now ?? (() => performance.now());
    this.sleep = options.sleep ?? defaultSleep;
    this.write =
      options.write ?? ((event) => console.info(JSON.stringify(event)));
  }

  public async generate<Output>(
    request: StructuredGenerationRequest<Output>,
  ): Promise<StructuredGenerationResult<Output>> {
    this.validateRequest(request);
    const fingerprint = hash(
      JSON.stringify({
        maxOutputTokens: request.maxOutputTokens,
        messages: request.messages,
        outputSchema: sanitizeStructuredOutputJsonSchema(
          z.toJSONSchema(request.outputSchema),
        ),
        outputSchemaName: request.outputSchemaName,
        role: request.role,
      }),
    );
    const existing = this.activeOperations.get(request.idempotencyKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new AiProviderError('DUPLICATE_OPERATION_CONFLICT', false);
      }
      return (await existing.promise) as StructuredGenerationResult<Output>;
    }

    const promise = this.execute(request) as Promise<
      StructuredGenerationResult<unknown>
    >;
    this.activeOperations.set(request.idempotencyKey, { fingerprint, promise });
    try {
      return (await promise) as StructuredGenerationResult<Output>;
    } finally {
      this.activeOperations.delete(request.idempotencyKey);
    }
  }

  private validateRequest<Output>(
    request: StructuredGenerationRequest<Output>,
  ): void {
    const configuration = this.options.configuration;
    if (!configuration.enabled || configuration.killSwitch) {
      throw new AiProviderError('AI_DISABLED', false);
    }
    if (!configuration.apiKey || !configuration.assignments[request.role]) {
      throw new AiProviderError('CONFIGURATION_INVALID', false);
    }
    if (
      !/^[a-z0-9]+(?:_[a-z0-9]+)*$/i.test(request.outputSchemaName) ||
      !/^[a-zA-Z0-9._:-]{8,200}$/.test(request.idempotencyKey)
    ) {
      throw new AiProviderError('PROVIDER_REQUEST_INVALID', false);
    }
    const contextCharacters = request.messages.reduce(
      (total, message) => total + message.content.length,
      0,
    );
    if (contextCharacters > configuration.maxContextCharacters) {
      throw new AiProviderError('CONTEXT_LIMIT_EXCEEDED', false);
    }
    if (
      !Number.isSafeInteger(request.maxOutputTokens) ||
      request.maxOutputTokens <= 0 ||
      request.maxOutputTokens > configuration.maxOutputTokens
    ) {
      throw new AiProviderError('OUTPUT_TOKEN_LIMIT_EXCEEDED', false);
    }
    if (request.signal?.aborted) {
      throw new AiProviderError('REQUEST_ABORTED', false);
    }
  }

  private async execute<Output>(
    request: StructuredGenerationRequest<Output>,
  ): Promise<StructuredGenerationResult<Output>> {
    const assignment = this.options.configuration.assignments[request.role];
    if (!assignment) {
      throw new AiProviderError('CONFIGURATION_INVALID', false);
    }
    let attempt = 1;
    while (attempt <= 2) {
      const startedAt = this.now();
      try {
        const result = await this.executeAttempt(request, assignment);
        this.write({
          attempt,
          durationMs: Math.max(0, this.now() - startedAt),
          event: 'ai_provider_request',
          modelId: assignment.modelId,
          operationHash: hash(request.idempotencyKey),
          provider: assignment.provider,
          role: request.role,
          status: 'success',
        });
        return {
          ...result,
          metadata: { ...result.metadata, attemptCount: attempt },
        };
      } catch (error) {
        const normalized = this.normalizeError(error, request.signal);
        this.write({
          attempt,
          code: normalized.code,
          durationMs: Math.max(0, this.now() - startedAt),
          event: 'ai_provider_request',
          modelId: assignment.modelId,
          operationHash: hash(request.idempotencyKey),
          provider: assignment.provider,
          role: request.role,
          status: 'failure',
        });
        if (!normalized.retryable || attempt === 2) throw normalized;
        const response =
          error instanceof HttpResponseError ? error.response : null;
        await this.sleep(
          response
            ? retryDelay(response, this.options.configuration.maxRetryDelayMs)
            : 0,
          request.signal,
        );
        attempt += 1;
      }
    }
    throw new AiProviderError('PROVIDER_UNAVAILABLE', false);
  }

  private async executeAttempt<Output>(
    request: StructuredGenerationRequest<Output>,
    assignment: { modelId: string; provider: string },
  ): Promise<StructuredGenerationResult<Output>> {
    const timeoutSignal = AbortSignal.timeout(
      this.options.configuration.requestTimeoutMs,
    );
    const signal = request.signal
      ? AbortSignal.any([request.signal, timeoutSignal])
      : timeoutSignal;
    const startedAt = this.now();
    const response = await this.fetchImplementation(OPENROUTER_URL, {
      body: JSON.stringify({
        max_tokens: request.maxOutputTokens,
        messages: request.messages,
        model: assignment.modelId,
        provider: {
          allow_fallbacks: false,
          data_collection: 'deny',
          only: [assignment.provider],
          order: [assignment.provider],
          require_parameters: true,
        },
        response_format: {
          json_schema: {
            name: request.outputSchemaName,
            schema: sanitizeStructuredOutputJsonSchema(
              z.toJSONSchema(request.outputSchema),
            ),
            strict: true,
          },
          type: 'json_schema',
        },
        temperature: 0,
      }),
      headers: {
        Authorization: `Bearer ${this.options.configuration.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': this.options.configuration.appUrl,
        'X-OpenRouter-Metadata': 'enabled',
        'X-Title': 'LearnX',
      },
      method: 'POST',
      signal,
    });
    if (!response.ok) {
      throw new HttpResponseError(response, errorFromStatus(response.status));
    }
    let raw: unknown;
    try {
      raw = (await response.json()) as unknown;
    } catch {
      throw new AiProviderError('PROVIDER_RESPONSE_INVALID', false);
    }
    const parsed = responseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AiProviderError('PROVIDER_RESPONSE_INVALID', false);
    }
    if (parsed.data.model !== assignment.modelId) {
      throw new AiProviderError('PROVIDER_RESPONSE_INVALID', false);
    }
    const choice = parsed.data.choices[0];
    if (!choice || choice.finish_reason === 'length') {
      throw new AiProviderError('PROVIDER_RESPONSE_TRUNCATED', false);
    }
    if (choice.error !== undefined || choice.finish_reason !== 'stop') {
      throw new AiProviderError('PROVIDER_RESPONSE_INVALID', false);
    }
    let output: unknown;
    try {
      output = JSON.parse(choice.message.content) as unknown;
    } catch {
      throw new AiProviderError('PROVIDER_RESPONSE_INVALID', false);
    }
    const validated = request.outputSchema.safeParse(output);
    if (!validated.success) {
      throw new AiProviderError('PROVIDER_RESPONSE_INVALID', false);
    }
    return {
      metadata: {
        attemptCount: 1,
        generationId: response.headers.get('x-generation-id') ?? parsed.data.id,
        latencyMs: Math.max(0, this.now() - startedAt),
        modelId: assignment.modelId,
        provider: assignment.provider,
        role: request.role,
        usage: {
          completionTokens: parsed.data.usage.completion_tokens,
          costUsd: parsed.data.usage.cost,
          promptTokens: parsed.data.usage.prompt_tokens,
          totalTokens: parsed.data.usage.total_tokens,
        },
      },
      output: validated.data,
    };
  }

  private normalizeError(
    error: unknown,
    requestSignal: AbortSignal | undefined,
  ): AiProviderError {
    if (error instanceof HttpResponseError) return error.normalized;
    if (error instanceof AiProviderError) return error;
    if (requestSignal?.aborted) {
      return new AiProviderError('REQUEST_ABORTED', false);
    }
    if (
      error instanceof DOMException &&
      (error.name === 'AbortError' || error.name === 'TimeoutError')
    ) {
      return new AiProviderError('REQUEST_TIMEOUT', false);
    }
    return new AiProviderError('PROVIDER_UNAVAILABLE', false);
  }
}
