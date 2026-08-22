import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildAnthropicMessagesRequestBody,
  buildOpenRouterTransportManifest,
  buildOpenRouterRequestBody,
  CorrectionModelOutputError,
  CorrectionProviderError,
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
  it('builds a canonical OpenRouter manifest without persisting prompts or credentials', () => {
    const transportRequest = {
      ...request('OPENROUTER_CHAT'),
      idempotencyKey: 'a'.repeat(64),
      messages: [
        { content: 'SYSTEM_PROMPT_NEVER_PERSIST', role: 'system' as const },
        { content: 'USER_PROMPT_NEVER_PERSIST', role: 'user' as const },
      ],
    };
    const manifest = buildOpenRouterTransportManifest(transportRequest);
    const serialized = JSON.stringify(manifest);

    expect(manifest).toMatchObject({
      persistedSafeHeaderNames: expect.arrayContaining([
        'Content-Type',
        'X-OpenRouter-Metadata',
      ]),
      method: 'POST',
      modelId: sonnetModelId,
      requestedRoute: 'Anthropic',
      schemaVersion: 1,
      timeoutMs: 60_000,
      url: 'https://openrouter.ai/api/v1/chat/completions',
    });
    expect(manifest.manifestSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(manifest.bodySha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(manifest.messagesSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(manifest.schemaSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(manifest.profileSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(buildOpenRouterTransportManifest(transportRequest)).toEqual(
      manifest,
    );
    expect(manifest.persistedSafeHeaderNames).not.toContain('Authorization');
    expect(manifest).not.toHaveProperty('headerNames');
    expect(serialized).not.toMatch(
      /SYSTEM_PROMPT_NEVER_PERSIST|USER_PROMPT_NEVER_PERSIST|test-key/u,
    );
    expect(serialized).not.toMatch(
      /"(?:apiKey|authorization|body|headers|messages|profile|prompt)"/iu,
    );
  });

  it('enables OpenRouter metadata and exposes only its allowlisted fields', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: 'stop',
              message: { content: JSON.stringify({ findings: [] }) },
            },
          ],
          id: 'payload-generation-id',
          model: sonnetModelId,
          openrouter_metadata: {
            attempt: 1,
            attempts: [
              {
                model: sonnetModelId,
                provider: 'Anthropic',
                secret: 'DROP_ME',
                status: 200,
              },
            ],
            endpoints: [
              {
                internal: 'DROP_ME',
                model: sonnetModelId,
                provider: 'Anthropic',
                selected: true,
              },
            ],
            is_byok: false,
            pipeline: { api_key: 'DROP_ME' },
            region: 'global',
            requested: 'Anthropic',
            strategy: 'exact',
            summary: 'selected',
          },
          usage: {
            completion_tokens: 3,
            cost: 0.01,
            prompt_tokens: 2,
          },
        }),
        {
          headers: {
            'Request-Id': 'provider-request-id',
            'X-Generation-Id': 'header-generation-id',
            'X-Request-Id': 'client-request-id',
          },
          status: 200,
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const correctionRequest = {
      ...request('OPENROUTER_CHAT'),
      idempotencyKey: 'client-request-id',
    };
    const transportManifest =
      buildOpenRouterTransportManifest(correctionRequest);

    const result = await getCorrectionProviderAdapter(
      'OPENROUTER_CHAT',
    ).execute({
      ...correctionRequest,
      apiKey: 'test-key',
      expectedTransportManifestSha256: transportManifest.manifestSha256,
    });
    const [, init] = fetchMock.mock.calls[0] ?? [];

    expect(new Headers(init?.headers).get('X-OpenRouter-Metadata')).toBe(
      'enabled',
    );
    expect(result.generationId).toBe('header-generation-id');
    expect(result.clientRequestId).toBe('client-request-id');
    expect(result.providerRequestId).toBe('provider-request-id');
    expect(result.observedProvider).toBe('Anthropic');
    expect(result.openRouterMetadata).toEqual({
      attempt: 1,
      attempts: [{ model: sonnetModelId, provider: 'Anthropic', status: 200 }],
      endpoints: [
        { model: sonnetModelId, provider: 'Anthropic', selected: true },
      ],
      is_byok: false,
      region: 'global',
      requested: 'Anthropic',
      strategy: 'exact',
      summary: 'selected',
    });
    expect(JSON.stringify(result.openRouterMetadata)).not.toMatch(
      /DROP_ME|pipeline|secret|api_key/u,
    );
  });

  it('parses OpenRouter failure provenance and X-Generation-Id without leaking passthrough metadata', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              message: 'route failed',
              metadata: {
                provider_name: 'Google',
                secret: 'DROP_ME',
              },
            },
            id: 'payload-error-id',
            openrouter_metadata: {
              attempts: [
                {
                  model: 'google/gemini-3.6-flash',
                  provider: 'Google',
                  status: 429,
                },
              ],
              pipeline: { secret: 'DROP_ME' },
              requested: 'google-vertex/global',
            },
          }),
          {
            headers: {
              'X-Generation-Id': 'header-error-id',
              'X-Request-Id': 'provider-error-request-id',
            },
            status: 429,
          },
        ),
      ),
    );
    const correctionRequest = {
      ...request('OPENROUTER_CHAT'),
      idempotencyKey: 'client-error-request-id',
    };
    const transportManifest =
      buildOpenRouterTransportManifest(correctionRequest);

    try {
      await getCorrectionProviderAdapter('OPENROUTER_CHAT').execute({
        ...correctionRequest,
        apiKey: 'test-key',
        expectedTransportManifestSha256: transportManifest.manifestSha256,
      });
      throw new Error('EXPECTED_PROVIDER_HTTP_ERROR');
    } catch (error) {
      expect(error).toBeInstanceOf(CorrectionProviderError);
      const providerError = error as CorrectionProviderError;
      expect(providerError.clientRequestId).toBe('client-error-request-id');
      expect(providerError.message).toBe('PROVIDER_HTTP_ERROR');
      expect(providerError.generationId).toBe('header-error-id');
      expect(providerError.observedProvider).toBe('Google');
      expect(providerError.providerRequestId).toBe('provider-error-request-id');
      expect(providerError.openRouterMetadata).toEqual({
        attempts: [
          {
            model: 'google/gemini-3.6-flash',
            provider: 'Google',
            status: 429,
          },
        ],
        requested: 'google-vertex/global',
      });
      expect(JSON.stringify(providerError.openRouterMetadata)).not.toMatch(
        /DROP_ME|pipeline|secret/u,
      );
    }
  });

  it('classifies a reflected X-Request-ID as client-owned on the manifest-bound path', async () => {
    const clientRequestId = 'client-reflected-request-id';
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: 'stop',
                message: { content: JSON.stringify({ findings: [] }) },
              },
            ],
            id: 'generation-reflected-test',
            model: sonnetModelId,
            provider: 'Anthropic',
            usage: {
              completion_tokens: 3,
              cost: 0.01,
              prompt_tokens: 2,
            },
          }),
          { headers: { 'X-Request-ID': clientRequestId }, status: 200 },
        ),
      ),
    );
    const correctionRequest = {
      ...request('OPENROUTER_CHAT'),
      idempotencyKey: clientRequestId,
    };
    const transportManifest =
      buildOpenRouterTransportManifest(correctionRequest);

    const result = await getCorrectionProviderAdapter(
      'OPENROUTER_CHAT',
    ).execute({
      ...correctionRequest,
      apiKey: 'test-key',
      expectedTransportManifestSha256: transportManifest.manifestSha256,
    });

    expect(result).toMatchObject({
      clientRequestId,
      generationId: 'generation-reflected-test',
    });
    expect(result.providerRequestId).toBeUndefined();
  });

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
