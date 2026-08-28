/// <reference types="node" />

import { describe, expect, it, afterEach, vi } from 'vitest';
import {
  CorrectionModelOutputError,
  CorrectionProviderError,
  getCorrectionProviderAdapter,
} from '@/lib/ai-correction-provider-adapters';
import { loadConfiguration } from './ai-correction-benchmark.test-support.js';

describe('correction provider adapters — part 1', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function providerRequest(
    adapter: 'ANTHROPIC_MESSAGES' | 'OPENAI_RESPONSES' | 'OPENROUTER_CHAT',
  ) {
    const configuration = loadConfiguration();
    const candidate = configuration.candidates[7];
    if (!candidate) {
      throw new Error('Expected Opus candidate.');
    }
    return {
      apiKey: 'test-key',
      jsonSchema: {
        additionalProperties: false,
        properties: {},
        type: 'object',
      },
      messages: [
        { content: 'Système', role: 'system' as const },
        { content: 'Production', role: 'user' as const },
      ],
      modelId:
        adapter === 'OPENAI_RESPONSES'
          ? 'openai/gpt-5.6-sol'
          : candidate.modelId,
      profile: {
        ...candidate.requestProfile,
        adapter,
        ...(adapter === 'OPENROUTER_CHAT'
          ? { routeProviders: ['Anthropic'] }
          : { routeProviders: undefined }),
      },
    };
  }

  it('returns OpenRouter identity, actual cost and separated reasoning usage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: 'stop',
                message: { content: '{"answer":"ok"}' },
              },
            ],
            id: 'or-request',
            model: 'anthropic/claude-opus-4.8-20260801',
            provider: 'Anthropic',
            usage: {
              completion_tokens: 15,
              completion_tokens_details: { reasoning_tokens: 5 },
              cost: 0.012,
              prompt_tokens: 20,
            },
          }),
          { headers: { 'content-type': 'application/json' }, status: 200 },
        ),
      ),
    );
    await expect(
      getCorrectionProviderAdapter('OPENROUTER_CHAT').execute(
        providerRequest('OPENROUTER_CHAT'),
      ),
    ).resolves.toMatchObject({
      modelSnapshot: 'anthropic/claude-opus-4.8-20260801',
      output: { answer: 'ok' },
      providerRequestId: 'or-request',
      providerRoute: 'Anthropic',
      usage: {
        actualCostUsd: 0.012,
        costSource: 'ACTUAL',
        inputTokens: 20,
        reasoningTokens: 5,
        visibleOutputTokens: 10,
      },
    });
  });

  it('classifies malformed structured JSON as INVALID-capable model output with usage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              { finish_reason: 'stop', message: { content: '{broken' } },
            ],
            id: 'or-request',
            model: 'anthropic/claude-opus-4.8',
            provider: 'Anthropic',
            usage: {
              completion_tokens: 10,
              prompt_tokens: 20,
            },
          }),
          { status: 200 },
        ),
      ),
    );
    const promise = getCorrectionProviderAdapter('OPENROUTER_CHAT').execute(
      providerRequest('OPENROUTER_CHAT'),
    );
    await expect(promise).rejects.toBeInstanceOf(CorrectionModelOutputError);
    await expect(promise).rejects.toMatchObject({
      message: 'MODEL_OUTPUT_JSON_INVALID',
      rawModelOutput: '{broken',
      usage: {
        costSource: 'ESTIMATED',
        inputTokens: 20,
        visibleOutputTokens: 10,
      },
    });
  });

  it('keeps provider messages out of stable HTTP transport error codes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { message: 'secret upstream diagnostic' },
          }),
          { headers: { 'x-request-id': 'http-request' }, status: 429 },
        ),
      ),
    );
    const promise = getCorrectionProviderAdapter('OPENROUTER_CHAT').execute(
      providerRequest('OPENROUTER_CHAT'),
    );
    await expect(promise).rejects.toBeInstanceOf(CorrectionProviderError);
    await expect(promise).rejects.toMatchObject({
      message: 'PROVIDER_HTTP_ERROR',
      providerRequestId: 'http-request',
      status: 429,
    });
  });

  it('classifies network timeouts as transport errors only', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValue(
          new DOMException('supplier details must not leak', 'TimeoutError'),
        ),
    );
    await expect(
      getCorrectionProviderAdapter('OPENROUTER_CHAT').execute(
        providerRequest('OPENROUTER_CHAT'),
      ),
    ).rejects.toMatchObject({ message: 'PROVIDER_TIMEOUT' });
  });

  it('preserves usage and identity on post-response truncation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ finish_reason: 'length', message: { content: '{}' } }],
            id: 'truncated-request',
            model: 'anthropic/claude-opus-4.8',
            provider: 'Anthropic',
            usage: { completion_tokens: 1500, prompt_tokens: 200 },
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(
      getCorrectionProviderAdapter('OPENROUTER_CHAT').execute(
        providerRequest('OPENROUTER_CHAT'),
      ),
    ).rejects.toMatchObject({
      message: 'MODEL_OUTPUT_TRUNCATED',
      modelSnapshot: 'anthropic/claude-opus-4.8',
      providerRequestId: 'truncated-request',
      providerRoute: 'Anthropic',
      usage: { visibleOutputTokens: 1500 },
    });
  });

  it('parses OpenAI Responses and Anthropic Messages without route fallback', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'openai-request',
            model: 'gpt-5.6-sol-20260709',
            output: [
              {
                content: [{ text: '{"answer":"openai"}', type: 'output_text' }],
              },
            ],
            status: 'completed',
            usage: {
              input_tokens: 30,
              output_tokens: 12,
              output_tokens_details: { reasoning_tokens: 2 },
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content: [{ text: '{"answer":"anthropic"}', type: 'text' }],
            id: 'anthropic-request',
            model: 'claude-opus-4-8-20260801',
            stop_reason: 'end_turn',
            usage: { input_tokens: 40, output_tokens: 14 },
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      getCorrectionProviderAdapter('OPENAI_RESPONSES').execute(
        providerRequest('OPENAI_RESPONSES'),
      ),
    ).resolves.toMatchObject({
      output: { answer: 'openai' },
      providerRequestId: 'openai-request',
      providerRoute: 'OpenAI',
      usage: {
        costSource: 'ESTIMATED',
        reasoningTokens: 2,
        visibleOutputTokens: 10,
      },
    });
    await expect(
      getCorrectionProviderAdapter('ANTHROPIC_MESSAGES').execute(
        providerRequest('ANTHROPIC_MESSAGES'),
      ),
    ).resolves.toMatchObject({
      output: { answer: 'anthropic' },
      providerRequestId: 'anthropic-request',
      providerRoute: 'Anthropic',
      usage: {
        costSource: 'ESTIMATED',
        reasoningTokens: 0,
        visibleOutputTokens: 14,
      },
    });
    const firstBody = JSON.parse(
      String((fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.body),
    ) as Record<string, unknown>;
    expect(firstBody).not.toHaveProperty('provider');
    const secondHeaders = (
      fetchMock.mock.calls[1]?.[1] as RequestInit | undefined
    )?.headers as Record<string, string>;
    expect(secondHeaders.Authorization).toBeUndefined();
  });

  it('classifies an OpenAI refusal as invalid model output and preserves usage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'refusal-request',
            model: 'gpt-5.6-sol-20260709',
            output: [
              {
                content: [{ refusal: 'Cannot comply', type: 'refusal' }],
              },
            ],
            status: 'completed',
            usage: { input_tokens: 30, output_tokens: 4 },
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(
      getCorrectionProviderAdapter('OPENAI_RESPONSES').execute(
        providerRequest('OPENAI_RESPONSES'),
      ),
    ).rejects.toMatchObject({
      message: 'MODEL_OUTPUT_REFUSAL',
      modelSnapshot: 'gpt-5.6-sol-20260709',
      providerRequestId: 'refusal-request',
      usage: {
        costSource: 'ESTIMATED',
        inputTokens: 30,
        visibleOutputTokens: 4,
      },
    });
  });
});
