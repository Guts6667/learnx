import {
  CorrectionModelOutputError,
  CorrectionProviderError,
  getCorrectionProviderAdapter,
  type CorrectionProviderRequest,
  type CorrectionReasoningCapabilities,
} from '../../lib/ai-correction-provider-adapters.js';
import type {
  WritingFrameworkGateLiveProvider,
  WritingFrameworkGatePackage,
  WritingFrameworkGateProviderRequest,
  WritingFrameworkGateProviderResult,
} from './writing-framework-selection-gate-runner-v2.js';

const REQUEST_PROFILE = Object.freeze({
  adapter: 'OPENROUTER_CHAT' as const,
  reasoning: {
    budgetMode: 'OFF' as const,
    budgetTokens: null,
    effort: 'OFF' as const,
  },
  routeProviders: ['Anthropic'] as [string],
  temperature: null,
  timeoutMs: 60_000,
  totalOutputTokenLimit: 4_096,
  version: '1.0.0',
  visibleOutputTokenTarget: 4_096,
}) satisfies CorrectionProviderRequest['profile'];

const REASONING_CAPABILITIES = Object.freeze({
  adapter: 'OPENROUTER_CHAT' as const,
  modelId: 'anthropic/claude-sonnet-5',
  providerDefaultMode: 'ADAPTIVE' as const,
  reasoningMandatory: false,
  requestedRoute: 'Anthropic',
  supportedModes: ['DISABLED'] as const,
}) satisfies CorrectionReasoningCapabilities;

function errorResult(
  error: CorrectionModelOutputError | CorrectionProviderError,
): WritingFrameworkGateProviderResult {
  const usage =
    error instanceof CorrectionModelOutputError ? error.usage : undefined;
  return Object.freeze({
    actualCostUsd: usage?.actualCostUsd ?? null,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costSource:
      usage?.costSource === 'ACTUAL' && usage.actualCostUsd !== undefined
        ? 'ACTUAL'
        : 'UNKNOWN',
    errorCode:
      error instanceof CorrectionProviderError &&
      error.message === 'PROVIDER_HTTP_ERROR' &&
      error.status !== undefined
        ? `PROVIDER_HTTP_${error.status}`
        : error.message,
    inputTokens: usage?.inputTokens ?? 0,
    latencyMs: error.latencyMs ?? 0,
    observedProvider:
      error.observedProvider === 'Anthropic' ? 'Anthropic' : null,
    providerRequestId: error.providerRequestId ?? null,
    rawOutput: error.rawModelOutput ?? '',
    reasoningTokens: usage?.reasoningTokens ?? 0,
    visibleOutputTokens: usage?.visibleOutputTokens ?? 0,
  });
}

export class OpenRouterWritingFrameworkGateProvider
  implements WritingFrameworkGateLiveProvider
{
  public readonly kind = 'OPENROUTER_LIVE' as const;

  public constructor(
    private readonly apiKey: string,
    private readonly packageInput: WritingFrameworkGatePackage,
  ) {
    if (!apiKey.trim()) throw new Error('OPENROUTER_API_KEY_REQUIRED');
    if (
      packageInput.wireModelId !== REASONING_CAPABILITIES.modelId ||
      packageInput.requestedRoute !== REASONING_CAPABILITIES.requestedRoute ||
      packageInput.expectedObservedProvider !== 'Anthropic'
    ) {
      throw new Error('WRITING_GATE_OPENROUTER_IDENTITY_MISMATCH');
    }
  }

  public async execute(
    request: WritingFrameworkGateProviderRequest,
  ): Promise<WritingFrameworkGateProviderResult> {
    const adapter = getCorrectionProviderAdapter('OPENROUTER_CHAT');
    try {
      const result = await adapter.execute({
        apiKey: this.apiKey,
        idempotencyKey: request.idempotencyKey,
        jsonSchema: { ...request.jsonSchema },
        messages: [...request.messages],
        modelId: this.packageInput.wireModelId,
        profile: REQUEST_PROFILE,
        reasoning: {
          capabilities: REASONING_CAPABILITIES,
          mode: { mode: 'DISABLED' },
        },
      });
      return Object.freeze({
        actualCostUsd: result.usage.actualCostUsd ?? null,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        costSource:
          result.usage.costSource === 'ACTUAL' &&
          result.usage.actualCostUsd !== undefined
            ? 'ACTUAL'
            : 'UNKNOWN',
        inputTokens: result.usage.inputTokens,
        latencyMs: result.latencyMs,
        observedProvider:
          result.observedProvider === 'Anthropic' ? 'Anthropic' : null,
        providerRequestId: result.providerRequestId ?? null,
        rawOutput: result.rawModelOutput,
        reasoningTokens: result.usage.reasoningTokens,
        visibleOutputTokens: result.usage.visibleOutputTokens,
      });
    } catch (error) {
      if (
        error instanceof CorrectionModelOutputError ||
        error instanceof CorrectionProviderError
      ) {
        return errorResult(error);
      }
      throw error;
    }
  }
}

export function writingFrameworkGateOpenRouterRequestProfile(): CorrectionProviderRequest['profile'] {
  return structuredClone(REQUEST_PROFILE);
}
