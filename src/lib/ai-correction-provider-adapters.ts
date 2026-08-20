import { z } from 'zod';

import type { CorrectionBenchmarkConfiguration } from './ai-correction-benchmark.js';

export type CorrectionProviderMessage = {
  content: string;
  role: 'system' | 'user';
};

export type CorrectionProviderUsage = {
  actualCostUsd?: number;
  costSource: 'ACTUAL' | 'ESTIMATED';
  inputTokens: number;
  reasoningTokens: number;
  visibleOutputTokens: number;
};

export type CorrectionProviderResult = {
  latencyMs: number;
  modelSnapshot: string;
  observedProvider: string;
  output: unknown;
  providerRequestId?: string;
  /** Exact assistant payload used to derive `output`; bounded only after hashing. */
  rawModelOutput: string;
  /** @deprecated Historical provider label. Use observedProvider instead. */
  providerRoute: string;
  requestedRoute: string;
  usage: CorrectionProviderUsage;
};

export type CorrectionReasoningMode =
  | { mode: 'DISABLED' }
  | { mode: 'PROVIDER_DEFAULT' }
  | {
      effort: 'high' | 'low' | 'max' | 'medium' | 'minimal';
      mode: 'ADAPTIVE';
    }
  | { budgetTokens: number; mode: 'LEGACY_BUDGET' };

export type CorrectionReasoningCapabilities = {
  adapter: CorrectionProviderAdapter['kind'];
  legacyBudgetMinimumTokens?: number;
  modelId: string;
  providerDefaultMode?: 'ADAPTIVE' | 'DISABLED' | 'LEGACY_BUDGET';
  reasoningMandatory?: boolean;
  requestedRoute: string;
  supportedAdaptiveEfforts?: ReadonlyArray<
    Extract<CorrectionReasoningMode, { mode: 'ADAPTIVE' }>['effort']
  >;
  supportedModes: ReadonlyArray<CorrectionReasoningMode['mode']>;
};

export type CorrectionReasoningSelection = {
  capabilities?: CorrectionReasoningCapabilities;
  mode: CorrectionReasoningMode;
};

export type CorrectionProviderRequest = {
  apiKey: string;
  idempotencyKey?: string;
  jsonSchema: Record<string, unknown>;
  messages: CorrectionProviderMessage[];
  modelId: string;
  profile: CorrectionBenchmarkConfiguration['candidates'][number]['requestProfile'];
  reasoning?: CorrectionReasoningSelection;
};

export interface CorrectionProviderAdapter {
  readonly kind: 'OPENROUTER_CHAT' | 'OPENAI_RESPONSES' | 'ANTHROPIC_MESSAGES';
  execute(
    request: CorrectionProviderRequest,
  ): Promise<CorrectionProviderResult>;
}

type ProviderTransportCode =
  'PROVIDER_HTTP_ERROR' | 'PROVIDER_NETWORK_ERROR' | 'PROVIDER_TIMEOUT';

type ModelOutputCode =
  | 'MODEL_OUTPUT_EMPTY'
  | 'MODEL_OUTPUT_ENVELOPE_INVALID'
  | 'MODEL_OUTPUT_JSON_INVALID'
  | 'MODEL_OUTPUT_REFUSAL'
  | 'MODEL_OUTPUT_TRUNCATED';

type ProviderFailureMetadata = {
  latencyMs?: number;
  modelSnapshot?: string;
  observedProvider?: string;
  providerRequestId?: string;
  providerRoute?: string;
  requestedRoute?: string;
  rawModelOutput?: string;
  status?: number;
  usage?: CorrectionProviderUsage;
};

export class CorrectionProviderError extends Error {
  readonly latencyMs?: number;
  readonly modelSnapshot?: string;
  readonly observedProvider?: string;
  readonly providerRequestId?: string;
  readonly providerRoute?: string;
  readonly rawModelOutput?: string;
  readonly requestedRoute?: string;
  readonly status?: number;

  constructor(
    code: ProviderTransportCode,
    metadata: ProviderFailureMetadata = {},
  ) {
    super(code);
    this.name = 'CorrectionProviderError';
    this.latencyMs = metadata.latencyMs;
    this.modelSnapshot = metadata.modelSnapshot;
    this.observedProvider = metadata.observedProvider;
    this.providerRequestId = metadata.providerRequestId;
    this.providerRoute = metadata.providerRoute;
    this.rawModelOutput = metadata.rawModelOutput;
    this.requestedRoute = metadata.requestedRoute;
    this.status = metadata.status;
  }
}

export class CorrectionModelOutputError extends Error {
  readonly latencyMs?: number;
  readonly modelSnapshot?: string;
  readonly observedProvider?: string;
  readonly providerRequestId?: string;
  readonly providerRoute?: string;
  readonly requestedRoute?: string;
  readonly rawModelOutput?: string;
  readonly usage?: CorrectionProviderUsage;

  constructor(code: ModelOutputCode, metadata: ProviderFailureMetadata = {}) {
    super(code);
    this.name = 'CorrectionModelOutputError';
    this.latencyMs = metadata.latencyMs;
    this.modelSnapshot = metadata.modelSnapshot;
    this.observedProvider = metadata.observedProvider;
    this.providerRequestId = metadata.providerRequestId;
    this.providerRoute = metadata.providerRoute;
    this.requestedRoute = metadata.requestedRoute;
    this.rawModelOutput = metadata.rawModelOutput;
    this.usage = metadata.usage;
  }
}

function optionalTemperature(profile: CorrectionProviderRequest['profile']): {
  temperature?: 0;
} {
  return profile.temperature === null
    ? {}
    : { temperature: profile.temperature };
}

function legacyOptionalReasoning(
  profile: CorrectionProviderRequest['profile'],
): {
  reasoning?: { effort: 'minimal' | 'low' } | { max_tokens: number };
} {
  return profile.reasoning.effort === 'OFF' ||
    profile.reasoning.effort === 'PROVIDER_DEFAULT'
    ? {}
    : {
        reasoning:
          profile.reasoning.budgetTokens === null
            ? {
                effort: profile.reasoning.effort.toLocaleLowerCase() as
                  'minimal' | 'low',
              }
            : { max_tokens: profile.reasoning.budgetTokens },
      };
}

function requestedRouteFor(
  adapter: CorrectionProviderAdapter['kind'],
  request: Omit<CorrectionProviderRequest, 'apiKey'>,
): string {
  if (adapter === 'OPENROUTER_CHAT') {
    const routeProviders = request.profile.routeProviders ?? [];
    if (routeProviders.length !== 1) {
      throw new Error('REASONING_ROUTE_NOT_EXACT');
    }
    return routeProviders[0] ?? 'OpenRouter';
  }
  return adapter === 'ANTHROPIC_MESSAGES' ? 'Anthropic' : 'OpenAI';
}

function assertReasoningCapability(input: {
  adapter: CorrectionProviderAdapter['kind'];
  request: Omit<CorrectionProviderRequest, 'apiKey'>;
}): CorrectionReasoningMode {
  const selection = input.request.reasoning;
  if (!selection) throw new Error('REASONING_SELECTION_MISSING');
  const mode = selection.mode;
  const capabilities = selection.capabilities;

  // Provider-default deliberately means omission. It is the only explicit mode
  // that remains honest when the route does not publish reasoning capabilities.
  if (!capabilities && mode.mode === 'PROVIDER_DEFAULT') return mode;
  if (!capabilities) {
    throw new Error('REASONING_CAPABILITY_ATTESTATION_REQUIRED');
  }

  if (
    capabilities.adapter !== input.adapter ||
    capabilities.modelId !== input.request.modelId ||
    capabilities.requestedRoute !==
      requestedRouteFor(input.adapter, input.request)
  ) {
    throw new Error('REASONING_CAPABILITY_IDENTITY_MISMATCH');
  }
  if (
    input.request.modelId === 'anthropic/claude-sonnet-5' &&
    mode.mode === 'LEGACY_BUDGET'
  ) {
    throw new Error('REASONING_MODE_UNSUPPORTED_FOR_MODEL');
  }
  if (!capabilities.supportedModes.includes(mode.mode)) {
    throw new Error('REASONING_MODE_NOT_ATTESTED');
  }

  if (mode.mode === 'DISABLED') {
    if (
      capabilities.reasoningMandatory !== false ||
      capabilities.providerDefaultMode === undefined
    ) {
      throw new Error('REASONING_CAPABILITY_ATTESTATION_INCOMPLETE');
    }
  }
  if (mode.mode === 'ADAPTIVE') {
    if (!capabilities.supportedAdaptiveEfforts?.includes(mode.effort)) {
      throw new Error('REASONING_ADAPTIVE_EFFORT_NOT_ATTESTED');
    }
  }
  if (mode.mode === 'LEGACY_BUDGET') {
    const minimum = capabilities.legacyBudgetMinimumTokens;
    if (minimum === undefined || mode.budgetTokens < minimum) {
      throw new Error('REASONING_LEGACY_BUDGET_NOT_ATTESTED');
    }
  }
  return mode;
}

function explicitOpenRouterReasoning(
  request: Omit<CorrectionProviderRequest, 'apiKey'>,
): {
  reasoning?:
    | { effort: 'high' | 'low' | 'max' | 'medium' | 'minimal' | 'none' }
    | { max_tokens: number };
} {
  const mode = assertReasoningCapability({
    adapter: 'OPENROUTER_CHAT',
    request,
  });
  switch (mode.mode) {
    case 'DISABLED':
      return { reasoning: { effort: 'none' } };
    case 'PROVIDER_DEFAULT':
      return {};
    case 'ADAPTIVE':
      return { reasoning: { effort: mode.effort } };
    case 'LEGACY_BUDGET':
      return { reasoning: { max_tokens: mode.budgetTokens } };
  }
}

function explicitOpenAiReasoning(
  request: Omit<CorrectionProviderRequest, 'apiKey'>,
): { reasoning?: { effort: 'high' | 'low' | 'medium' | 'minimal' } } {
  const mode = assertReasoningCapability({
    adapter: 'OPENAI_RESPONSES',
    request,
  });
  if (mode.mode === 'PROVIDER_DEFAULT') return {};
  if (mode.mode === 'ADAPTIVE' && mode.effort !== 'max') {
    return { reasoning: { effort: mode.effort } };
  }
  throw new Error('REASONING_MODE_UNSUPPORTED_BY_ADAPTER');
}

function explicitAnthropicReasoning(
  request: Omit<CorrectionProviderRequest, 'apiKey'>,
): {
  outputEffort?: 'high' | 'low' | 'max' | 'medium' | 'minimal';
  thinking?:
    | { type: 'adaptive' }
    | { type: 'disabled' }
    | { budget_tokens: number; type: 'enabled' };
} {
  const mode = assertReasoningCapability({
    adapter: 'ANTHROPIC_MESSAGES',
    request,
  });
  switch (mode.mode) {
    case 'DISABLED':
      return { thinking: { type: 'disabled' } };
    case 'PROVIDER_DEFAULT':
      return {};
    case 'ADAPTIVE':
      return {
        outputEffort: mode.effort,
        thinking: { type: 'adaptive' },
      };
    case 'LEGACY_BUDGET':
      return {
        thinking: {
          budget_tokens: mode.budgetTokens,
          type: 'enabled',
        },
      };
  }
}

export function buildOpenRouterRequestBody(
  request: Omit<CorrectionProviderRequest, 'apiKey'>,
): Record<string, unknown> {
  return {
    messages: request.messages,
    model: request.modelId,
    max_tokens: request.profile.totalOutputTokenLimit,
    ...optionalTemperature(request.profile),
    ...(request.reasoning
      ? explicitOpenRouterReasoning(request)
      : legacyOptionalReasoning(request.profile)),
    provider: {
      allow_fallbacks: false,
      order: request.profile.routeProviders,
      require_parameters: true,
    },
    response_format: {
      json_schema: {
        name: 'learnx_correction_output',
        schema: request.jsonSchema,
        strict: true,
      },
      type: 'json_schema',
    },
  };
}

export function buildOpenAiResponsesRequestBody(
  request: Omit<CorrectionProviderRequest, 'apiKey'>,
): Record<string, unknown> {
  return {
    input: request.messages,
    model: request.modelId.replace(/^openai\//, ''),
    max_output_tokens: request.profile.totalOutputTokenLimit,
    ...optionalTemperature(request.profile),
    ...(request.reasoning
      ? explicitOpenAiReasoning(request)
      : legacyOptionalReasoning(request.profile)),
    text: {
      format: {
        name: 'learnx_correction_output',
        schema: request.jsonSchema,
        strict: true,
        type: 'json_schema',
      },
    },
  };
}

export function buildAnthropicMessagesRequestBody(
  request: Omit<CorrectionProviderRequest, 'apiKey'>,
): Record<string, unknown> {
  const system = request.messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n');
  const explicitReasoning = request.reasoning
    ? explicitAnthropicReasoning(request)
    : undefined;
  return {
    max_tokens: request.profile.totalOutputTokenLimit,
    messages: request.messages.filter((message) => message.role !== 'system'),
    model: request.modelId.replace(/^anthropic\//, ''),
    output_config: {
      format: { schema: request.jsonSchema, type: 'json_schema' },
      ...(explicitReasoning?.outputEffort
        ? { effort: explicitReasoning.outputEffort }
        : {}),
    },
    system,
    ...optionalTemperature(request.profile),
    ...(explicitReasoning
      ? explicitReasoning.thinking
        ? { thinking: explicitReasoning.thinking }
        : {}
      : request.profile.reasoning.budgetTokens === null
        ? {}
        : {
            thinking: {
              budget_tokens: request.profile.reasoning.budgetTokens,
              type: 'enabled',
            },
          }),
  };
}

const openRouterResponseSchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            finish_reason: z.string().nullable(),
            message: z.object({ content: z.string().nullable() }).passthrough(),
          })
          .passthrough(),
      )
      .min(1),
    id: z.string().optional(),
    model: z.string().optional(),
    provider: z.string().optional(),
    usage: z
      .object({
        completion_tokens: z.number().int().nonnegative(),
        completion_tokens_details: z
          .object({
            reasoning_tokens: z.number().int().nonnegative().optional(),
          })
          .passthrough()
          .optional(),
        cost: z.number().nonnegative().optional(),
        prompt_tokens: z.number().int().nonnegative(),
      })
      .passthrough(),
  })
  .passthrough();

const openAiResponseSchema = z
  .object({
    id: z.string(),
    model: z.string(),
    output: z.array(
      z
        .object({
          content: z.array(
            z
              .object({
                refusal: z.string().optional(),
                text: z.string().optional(),
                type: z.string(),
              })
              .passthrough(),
          ),
        })
        .passthrough(),
    ),
    status: z.string(),
    usage: z
      .object({
        input_tokens: z.number().int().nonnegative(),
        output_tokens: z.number().int().nonnegative(),
        output_tokens_details: z
          .object({
            reasoning_tokens: z.number().int().nonnegative().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough(),
  })
  .passthrough();

const anthropicResponseSchema = z
  .object({
    content: z.array(
      z.object({ text: z.string().optional(), type: z.string() }).passthrough(),
    ),
    id: z.string(),
    model: z.string(),
    stop_reason: z.string().nullable(),
    usage: z
      .object({
        input_tokens: z.number().int().nonnegative(),
        output_tokens: z.number().int().nonnegative(),
      })
      .passthrough(),
  })
  .passthrough();

type JsonResponse = {
  latencyMs: number;
  payload: unknown;
  rawPayload: string;
  response: Response;
};

async function executeJsonRequest(input: {
  apiKey: string;
  bearerAuthorization?: boolean;
  body: Record<string, unknown>;
  failureMetadata?: Pick<
    ProviderFailureMetadata,
    'observedProvider' | 'providerRoute' | 'requestedRoute'
  >;
  headers?: Record<string, string>;
  profile: CorrectionProviderRequest['profile'];
  url: string;
}): Promise<JsonResponse> {
  const startedAt = performance.now();
  let response: Response;
  try {
    response = await fetch(input.url, {
      body: JSON.stringify(input.body),
      headers: {
        ...(input.bearerAuthorization === false
          ? {}
          : { Authorization: `Bearer ${input.apiKey}` }),
        'Content-Type': 'application/json',
        ...input.headers,
      },
      method: 'POST',
      signal: AbortSignal.timeout(input.profile.timeoutMs),
    });
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startedAt);
    const errorName =
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      typeof error.name === 'string'
        ? error.name
        : undefined;
    throw new CorrectionProviderError(
      errorName === 'TimeoutError' || errorName === 'AbortError'
        ? 'PROVIDER_TIMEOUT'
        : 'PROVIDER_NETWORK_ERROR',
      { ...input.failureMetadata, latencyMs },
    );
  }
  const latencyMs = Math.round(performance.now() - startedAt);
  const rawPayload = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(rawPayload) as unknown;
  } catch {
    if (!response.ok) {
      throw new CorrectionProviderError('PROVIDER_HTTP_ERROR', {
        ...input.failureMetadata,
        latencyMs,
        providerRequestId:
          response.headers.get('request-id') ??
          response.headers.get('x-request-id') ??
          undefined,
        rawModelOutput: rawPayload,
        status: response.status,
      });
    }
    throw new CorrectionModelOutputError('MODEL_OUTPUT_ENVELOPE_INVALID', {
      ...input.failureMetadata,
      latencyMs,
      providerRequestId:
        response.headers.get('request-id') ??
        response.headers.get('x-request-id') ??
        undefined,
      rawModelOutput: rawPayload,
    });
  }
  if (!response.ok) {
    throw new CorrectionProviderError('PROVIDER_HTTP_ERROR', {
      ...input.failureMetadata,
      latencyMs,
      providerRequestId:
        response.headers.get('request-id') ??
        response.headers.get('x-request-id') ??
        undefined,
      rawModelOutput: rawPayload,
      status: response.status,
    });
  }
  return { latencyMs, payload, rawPayload, response };
}

function parseStructuredText(input: {
  metadata: ProviderFailureMetadata;
  text: string;
}): unknown {
  try {
    return JSON.parse(input.text) as unknown;
  } catch {
    throw new CorrectionModelOutputError('MODEL_OUTPUT_JSON_INVALID', {
      ...input.metadata,
      rawModelOutput: input.text,
    });
  }
}

function openRouterUsage(
  usage: z.infer<typeof openRouterResponseSchema>['usage'],
): CorrectionProviderUsage {
  const reasoningTokens =
    usage.completion_tokens_details?.reasoning_tokens ?? 0;
  return {
    ...(usage.cost === undefined ? {} : { actualCostUsd: usage.cost }),
    costSource: usage.cost === undefined ? 'ESTIMATED' : 'ACTUAL',
    inputTokens: usage.prompt_tokens,
    reasoningTokens,
    visibleOutputTokens: Math.max(0, usage.completion_tokens - reasoningTokens),
  };
}

const openRouterAdapter: CorrectionProviderAdapter = {
  kind: 'OPENROUTER_CHAT',
  async execute(request) {
    const requestedRoute = request.profile.routeProviders?.[0] ?? 'OpenRouter';
    const result = await executeJsonRequest({
      apiKey: request.apiKey,
      body: buildOpenRouterRequestBody(request),
      failureMetadata: {
        providerRoute: 'OpenRouter',
        requestedRoute,
      },
      profile: request.profile,
      url: 'https://openrouter.ai/api/v1/chat/completions',
      headers: {
        'HTTP-Referer': 'https://learn-x.app',
        ...(request.idempotencyKey
          ? {
              'Idempotency-Key': request.idempotencyKey,
              'X-Request-ID': request.idempotencyKey,
            }
          : {}),
        'X-Title': 'LearnX correction benchmark',
      },
    });
    const envelope = openRouterResponseSchema.safeParse(result.payload);
    if (!envelope.success) {
      throw new CorrectionModelOutputError('MODEL_OUTPUT_ENVELOPE_INVALID', {
        latencyMs: result.latencyMs,
        providerRoute: 'OpenRouter',
        rawModelOutput: result.rawPayload,
        requestedRoute,
      });
    }
    const parsed = envelope.data;
    const usage = openRouterUsage(parsed.usage);
    const observedProvider = parsed.provider ?? 'OpenRouter';
    const metadata = {
      latencyMs: result.latencyMs,
      modelSnapshot: parsed.model ?? request.modelId,
      observedProvider,
      providerRequestId:
        parsed.id ?? result.response.headers.get('x-request-id') ?? undefined,
      providerRoute: observedProvider,
      requestedRoute,
      usage,
    };
    if (parsed.choices[0]?.finish_reason === 'length') {
      const truncatedContent = parsed.choices[0]?.message.content;
      throw new CorrectionModelOutputError('MODEL_OUTPUT_TRUNCATED', {
        ...metadata,
        rawModelOutput: truncatedContent ?? '',
      });
    }
    const content = parsed.choices[0]?.message.content;
    if (!content) {
      throw new CorrectionModelOutputError('MODEL_OUTPUT_EMPTY', {
        ...metadata,
        rawModelOutput: content ?? '',
      });
    }
    return {
      ...metadata,
      output: parseStructuredText({ metadata, text: content }),
      rawModelOutput: content,
    };
  },
};

const openAiAdapter: CorrectionProviderAdapter = {
  kind: 'OPENAI_RESPONSES',
  async execute(request) {
    const result = await executeJsonRequest({
      apiKey: request.apiKey,
      body: buildOpenAiResponsesRequestBody(request),
      failureMetadata: {
        observedProvider: 'OpenAI',
        providerRoute: 'OpenAI',
        requestedRoute: 'OpenAI',
      },
      profile: request.profile,
      url: 'https://api.openai.com/v1/responses',
    });
    const envelope = openAiResponseSchema.safeParse(result.payload);
    if (!envelope.success) {
      throw new CorrectionModelOutputError('MODEL_OUTPUT_ENVELOPE_INVALID', {
        latencyMs: result.latencyMs,
        observedProvider: 'OpenAI',
        providerRoute: 'OpenAI',
        rawModelOutput: result.rawPayload,
        requestedRoute: 'OpenAI',
      });
    }
    const parsed = envelope.data;
    const reasoningTokens =
      parsed.usage.output_tokens_details?.reasoning_tokens ?? 0;
    const usage: CorrectionProviderUsage = {
      costSource: 'ESTIMATED',
      inputTokens: parsed.usage.input_tokens,
      reasoningTokens,
      visibleOutputTokens: Math.max(
        0,
        parsed.usage.output_tokens - reasoningTokens,
      ),
    };
    const metadata = {
      latencyMs: result.latencyMs,
      modelSnapshot: parsed.model,
      observedProvider: 'OpenAI',
      providerRequestId: parsed.id,
      providerRoute: 'OpenAI',
      requestedRoute: 'OpenAI',
      usage,
    };
    const contentItems = parsed.output.flatMap((item) => item.content);
    const receivedContent = contentItems
      .map((item) => item.text ?? item.refusal ?? '')
      .join('');
    if (parsed.status !== 'completed') {
      throw new CorrectionModelOutputError('MODEL_OUTPUT_TRUNCATED', {
        ...metadata,
        rawModelOutput: receivedContent,
      });
    }
    if (contentItems.some((item) => item.refusal !== undefined)) {
      throw new CorrectionModelOutputError('MODEL_OUTPUT_REFUSAL', {
        ...metadata,
        rawModelOutput: receivedContent,
      });
    }
    const content = contentItems.find((item) => item.text !== undefined)?.text;
    if (!content) {
      throw new CorrectionModelOutputError('MODEL_OUTPUT_EMPTY', {
        ...metadata,
        rawModelOutput: receivedContent,
      });
    }
    return {
      ...metadata,
      output: parseStructuredText({ metadata, text: content }),
      rawModelOutput: content,
    };
  },
};

const anthropicAdapter: CorrectionProviderAdapter = {
  kind: 'ANTHROPIC_MESSAGES',
  async execute(request) {
    const result = await executeJsonRequest({
      apiKey: request.apiKey,
      bearerAuthorization: false,
      body: buildAnthropicMessagesRequestBody(request),
      failureMetadata: {
        observedProvider: 'Anthropic',
        providerRoute: 'Anthropic',
        requestedRoute: 'Anthropic',
      },
      headers: {
        'anthropic-version': '2023-06-01',
        'x-api-key': request.apiKey,
      },
      profile: request.profile,
      url: 'https://api.anthropic.com/v1/messages',
    });
    const envelope = anthropicResponseSchema.safeParse(result.payload);
    if (!envelope.success) {
      throw new CorrectionModelOutputError('MODEL_OUTPUT_ENVELOPE_INVALID', {
        latencyMs: result.latencyMs,
        observedProvider: 'Anthropic',
        providerRoute: 'Anthropic',
        rawModelOutput: result.rawPayload,
        requestedRoute: 'Anthropic',
      });
    }
    const parsed = envelope.data;
    const usage: CorrectionProviderUsage = {
      costSource: 'ESTIMATED',
      inputTokens: parsed.usage.input_tokens,
      reasoningTokens: 0,
      visibleOutputTokens: parsed.usage.output_tokens,
    };
    const metadata = {
      latencyMs: result.latencyMs,
      modelSnapshot: parsed.model,
      observedProvider: 'Anthropic',
      providerRequestId: parsed.id,
      providerRoute: 'Anthropic',
      requestedRoute: 'Anthropic',
      usage,
    };
    const content = parsed.content.find((item) => item.type === 'text')?.text;
    if (parsed.stop_reason === 'max_tokens') {
      throw new CorrectionModelOutputError('MODEL_OUTPUT_TRUNCATED', {
        ...metadata,
        rawModelOutput: content ?? '',
      });
    }
    if (!content) {
      throw new CorrectionModelOutputError('MODEL_OUTPUT_EMPTY', {
        ...metadata,
        rawModelOutput: content ?? '',
      });
    }
    return {
      ...metadata,
      output: parseStructuredText({ metadata, text: content }),
      rawModelOutput: content,
    };
  },
};

export function getCorrectionProviderAdapter(
  kind: CorrectionProviderAdapter['kind'],
): CorrectionProviderAdapter {
  switch (kind) {
    case 'OPENROUTER_CHAT':
      return openRouterAdapter;
    case 'OPENAI_RESPONSES':
      return openAiAdapter;
    case 'ANTHROPIC_MESSAGES':
      return anthropicAdapter;
  }
}
