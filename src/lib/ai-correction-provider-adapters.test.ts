import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildAnthropicMessagesRequestBody,
  buildOpenRouterRequestBody,
  CorrectionModelOutputError,
  getCorrectionProviderAdapter,
  type CorrectionProviderRequest,
  type CorrectionReasoningCapabilities,
  type CorrectionReasoningMode,
} from './ai-correction-provider-adapters.ts';

const sonnetModelId = 'anthropic/claude-sonnet-5';

afterEach(() => {
  vi.unstubAllGlobals();
});

function profile(
  adapter: CorrectionProviderRequest['profile']['adapter'],
): CorrectionProviderRequest['profile'] {
  return {
    adapter,
    reasoning: {
      budgetMode: 'OFF',
      budgetTokens: null,
      effort: 'OFF',
    },
    ...(adapter === 'OPENROUTER_CHAT' ? { routeProviders: ['Anthropic'] } : {}),
    temperature: null,
    timeoutMs: 60_000,
    totalOutputTokenLimit: 1_800,
    version: '4.0.0',
    visibleOutputTokenTarget: 1_800,
  };
}

function capabilities(
  adapter: 'ANTHROPIC_MESSAGES' | 'OPENROUTER_CHAT',
): CorrectionReasoningCapabilities {
  return {
    adapter,
    modelId: sonnetModelId,
    providerDefaultMode: 'ADAPTIVE',
    reasoningMandatory: false,
    requestedRoute: 'Anthropic',
    supportedAdaptiveEfforts: ['low', 'medium', 'high', 'max'],
    supportedModes: ['DISABLED', 'PROVIDER_DEFAULT', 'ADAPTIVE'],
  };
}

function request(
  adapter: 'ANTHROPIC_MESSAGES' | 'OPENROUTER_CHAT',
  mode?: CorrectionReasoningMode,
  attestation?: CorrectionReasoningCapabilities,
): Omit<CorrectionProviderRequest, 'apiKey'> {
  return {
    jsonSchema: { additionalProperties: false, properties: {}, type: 'object' },
    messages: [
      { content: 'Système', role: 'system' },
      { content: 'Production', role: 'user' },
    ],
    modelId: sonnetModelId,
    profile: profile(adapter),
    ...(mode
      ? {
          reasoning: {
            ...(attestation ? { capabilities: attestation } : {}),
            mode,
          },
        }
      : {}),
  };
}

describe('provider reasoning abstraction', () => {
  it('preserves historical OFF profiles as omission instead of reinterpreting them', () => {
    expect(
      buildOpenRouterRequestBody(request('OPENROUTER_CHAT')),
    ).not.toHaveProperty('reasoning');
    expect(
      buildAnthropicMessagesRequestBody(request('ANTHROPIC_MESSAGES')),
    ).not.toHaveProperty('thinking');
  });

  it('keeps PROVIDER_DEFAULT as an explicit omission without inventing capabilities', () => {
    expect(
      buildOpenRouterRequestBody(
        request('OPENROUTER_CHAT', { mode: 'PROVIDER_DEFAULT' }),
      ),
    ).not.toHaveProperty('reasoning');
    expect(
      buildAnthropicMessagesRequestBody(
        request('ANTHROPIC_MESSAGES', { mode: 'PROVIDER_DEFAULT' }),
      ),
    ).not.toHaveProperty('thinking');
  });

  it('fails closed when DISABLED lacks a route-specific capability attestation', () => {
    expect(() =>
      buildOpenRouterRequestBody(
        request('OPENROUTER_CHAT', { mode: 'DISABLED' }),
      ),
    ).toThrow('REASONING_CAPABILITY_ATTESTATION_REQUIRED');

    const incomplete = {
      ...capabilities('OPENROUTER_CHAT'),
      providerDefaultMode: undefined,
      reasoningMandatory: undefined,
    };
    expect(() =>
      buildOpenRouterRequestBody(
        request('OPENROUTER_CHAT', { mode: 'DISABLED' }, incomplete),
      ),
    ).toThrow('REASONING_CAPABILITY_ATTESTATION_INCOMPLETE');
  });

  it('serializes attested DISABLED distinctly for OpenRouter and Anthropic', () => {
    expect(
      buildOpenRouterRequestBody(
        request(
          'OPENROUTER_CHAT',
          { mode: 'DISABLED' },
          capabilities('OPENROUTER_CHAT'),
        ),
      ),
    ).toMatchObject({ reasoning: { effort: 'none' } });

    const anthropicBody = buildAnthropicMessagesRequestBody(
      request(
        'ANTHROPIC_MESSAGES',
        { mode: 'DISABLED' },
        capabilities('ANTHROPIC_MESSAGES'),
      ),
    );
    expect(anthropicBody).toMatchObject({ thinking: { type: 'disabled' } });
    expect(anthropicBody.output_config).not.toHaveProperty('effort');
  });

  it('serializes attested ADAPTIVE effort distinctly for OpenRouter and Anthropic', () => {
    expect(
      buildOpenRouterRequestBody(
        request(
          'OPENROUTER_CHAT',
          { effort: 'low', mode: 'ADAPTIVE' },
          capabilities('OPENROUTER_CHAT'),
        ),
      ),
    ).toMatchObject({ reasoning: { effort: 'low' } });

    expect(
      buildAnthropicMessagesRequestBody(
        request(
          'ANTHROPIC_MESSAGES',
          { effort: 'low', mode: 'ADAPTIVE' },
          capabilities('ANTHROPIC_MESSAGES'),
        ),
      ),
    ).toMatchObject({
      output_config: { effort: 'low' },
      thinking: { type: 'adaptive' },
    });
  });

  it('rejects LEGACY_BUDGET for Sonnet 5 even if a capability claims it', () => {
    const misleadingOpenRouterCapability = {
      ...capabilities('OPENROUTER_CHAT'),
      legacyBudgetMinimumTokens: 1_024,
      supportedModes: [
        ...capabilities('OPENROUTER_CHAT').supportedModes,
        'LEGACY_BUDGET' as const,
      ],
    };
    expect(() =>
      buildOpenRouterRequestBody(
        request(
          'OPENROUTER_CHAT',
          { budgetTokens: 1_024, mode: 'LEGACY_BUDGET' },
          misleadingOpenRouterCapability,
        ),
      ),
    ).toThrow('REASONING_MODE_UNSUPPORTED_FOR_MODEL');
    expect(() =>
      buildAnthropicMessagesRequestBody(
        request(
          'ANTHROPIC_MESSAGES',
          { budgetTokens: 1_024, mode: 'LEGACY_BUDGET' },
          capabilities('ANTHROPIC_MESSAGES'),
        ),
      ),
    ).toThrow('REASONING_MODE_UNSUPPORTED_FOR_MODEL');
  });

  it('rejects a capability attestation pinned to another route identity', () => {
    expect(() =>
      buildOpenRouterRequestBody(
        request(
          'OPENROUTER_CHAT',
          { mode: 'DISABLED' },
          {
            ...capabilities('OPENROUTER_CHAT'),
            requestedRoute: 'Auto',
          },
        ),
      ),
    ).toThrow('REASONING_CAPABILITY_IDENTITY_MISMATCH');
  });

  it('rejects reasoning attestation when an OpenRouter profile allows multiple routes', () => {
    const multiRoute = request(
      'OPENROUTER_CHAT',
      { mode: 'DISABLED' },
      capabilities('OPENROUTER_CHAT'),
    );
    multiRoute.profile = {
      ...multiRoute.profile,
      routeProviders: ['Anthropic', 'Google'],
    };

    expect(() => buildOpenRouterRequestBody(multiRoute)).toThrow(
      'REASONING_ROUTE_NOT_EXACT',
    );
  });

  it('returns the complete assistant payload so persistence can hash before bounding', async () => {
    const rawModelOutput = JSON.stringify({ value: 'x'.repeat(20_050) });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              choices: [
                { finish_reason: 'stop', message: { content: rawModelOutput } },
              ],
              id: 'request-large-raw',
              model: sonnetModelId,
              provider: 'Anthropic',
              usage: {
                completion_tokens: 10,
                cost: 0.01,
                prompt_tokens: 10,
              },
            }),
            { status: 200 },
          ),
      ),
    );

    const result = await getCorrectionProviderAdapter(
      'OPENROUTER_CHAT',
    ).execute({ ...request('OPENROUTER_CHAT'), apiKey: 'test-key' });

    expect(result.rawModelOutput).toBe(rawModelOutput);
    expect(result.rawModelOutput.length).toBeGreaterThan(20_000);
  });

  it('preserves an exact empty assistant payload on truncation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              choices: [
                { finish_reason: 'length', message: { content: null } },
              ],
              id: 'request-empty-truncated',
              model: sonnetModelId,
              provider: 'Anthropic',
              usage: {
                completion_tokens: 10,
                cost: 0.01,
                prompt_tokens: 10,
              },
            }),
            { status: 200 },
          ),
      ),
    );

    try {
      await getCorrectionProviderAdapter('OPENROUTER_CHAT').execute({
        ...request('OPENROUTER_CHAT'),
        apiKey: 'test-key',
      });
      throw new Error('EXPECTED_MODEL_OUTPUT_TRUNCATED');
    } catch (error) {
      expect(error).toBeInstanceOf(CorrectionModelOutputError);
      expect((error as CorrectionModelOutputError).message).toBe(
        'MODEL_OUTPUT_TRUNCATED',
      );
      expect((error as CorrectionModelOutputError).rawModelOutput).toBe('');
    }
  });
});
