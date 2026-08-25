import { z } from 'zod';

import { FakeStructuredAiProvider } from './fake-structured-provider.js';
import {
  readOpenRouterConfiguration,
  type OpenRouterConfiguration,
} from './openrouter-configuration.js';
import { OpenRouterStructuredProvider } from './openrouter-provider.js';
import {
  AiProviderError,
  type AiProviderLogEvent,
  type StructuredGenerationRequest,
} from './structured-provider.js';

const outputSchema = z.object({ answer: z.string() }).strict();

function configuration(
  overrides: Partial<OpenRouterConfiguration> = {},
): OpenRouterConfiguration {
  return {
    apiKey: 'server-secret',
    appUrl: 'https://learn-x.app',
    assignments: {
      CORRECTION_PRIMARY: {
        modelId: 'vendor/model-20260811',
        provider: 'vendor',
      },
      CORRECTION_SECOND_PASS: {
        modelId: 'vendor/reviewer-20260811',
        provider: 'vendor',
      },
    },
    deploymentEnvironment: 'development',
    enabled: true,
    killSwitch: false,
    maxContextCharacters: 1_000,
    maxOutputTokens: 1_000,
    maxRetryDelayMs: 2_000,
    requestTimeoutMs: 1_000,
    ...overrides,
  };
}

function request(
  overrides: Partial<StructuredGenerationRequest<{ answer: string }>> = {},
): StructuredGenerationRequest<{ answer: string }> {
  return {
    idempotencyKey: 'correction:operation:1234',
    maxOutputTokens: 250,
    messages: [
      { content: 'Confidential system prompt', role: 'system' },
      { content: 'Learner production', role: 'user' },
    ],
    outputSchema,
    outputSchemaName: 'correction_output',
    role: 'CORRECTION_PRIMARY',
    ...overrides,
  };
}

function successResponse(overrides: Record<string, unknown> = {}): Response {
  return Response.json(
    {
      choices: [
        {
          finish_reason: 'stop',
          message: { content: JSON.stringify({ answer: 'Validated' }) },
        },
      ],
      id: 'generation-body-id',
      model: 'vendor/model-20260811',
      usage: {
        completion_tokens: 15,
        cost: 0.0012,
        prompt_tokens: 40,
        total_tokens: 55,
      },
      ...overrides,
    },
    {
      headers: { 'x-generation-id': 'generation-header-id' },
    },
  );
}

function expectProviderError(
  error: unknown,
  code: AiProviderError['code'],
): boolean {
  expect(error).toBeInstanceOf(AiProviderError);
  expect(error).toMatchObject({ code });
  return true;
}

describe('OpenRouter configuration', () => {
  const activeValues = {
    APP_URL: 'https://preview.learn-x.app',
    LEARNX_AI_ALLOWED_MODELS: 'vendor/model-20260811,vendor/reviewer-20260811',
    LEARNX_AI_ALLOWED_PROVIDERS: 'vendor',
    LEARNX_AI_CONFIG_ENVIRONMENT: 'preview',
    LEARNX_AI_CORRECTION_PRIMARY_MODEL: 'vendor/model-20260811',
    LEARNX_AI_CORRECTION_PRIMARY_PROVIDER: 'vendor',
    LEARNX_AI_CORRECTION_SECOND_PASS_MODEL: 'vendor/reviewer-20260811',
    LEARNX_AI_CORRECTION_SECOND_PASS_PROVIDER: 'vendor',
    LEARNX_AI_ENABLED: 'true',
    LEARNX_AI_KILL_SWITCH: 'false',
    OPENROUTER_API_KEY: 'secret',
  };

  it('stays disabled and closed by default without requiring a secret', () => {
    expect(
      readOpenRouterConfiguration({
        deploymentEnvironment: 'development',
        values: {},
      }),
    ).toMatchObject({
      apiKey: null,
      assignments: {},
      enabled: false,
      killSwitch: true,
    });
  });

  it('loads exact allowlisted assignments for one explicit environment', () => {
    expect(
      readOpenRouterConfiguration({
        deploymentEnvironment: 'preview',
        values: activeValues,
      }),
    ).toMatchObject({
      assignments: {
        CORRECTION_PRIMARY: {
          modelId: 'vendor/model-20260811',
          provider: 'vendor',
        },
      },
      deploymentEnvironment: 'preview',
      enabled: true,
      killSwitch: false,
    });
  });

  it('validates pinned assignments while the kill switch remains closed', () => {
    expect(
      readOpenRouterConfiguration({
        deploymentEnvironment: 'preview',
        values: { ...activeValues, LEARNX_AI_KILL_SWITCH: 'true' },
      }),
    ).toMatchObject({
      assignments: {
        CORRECTION_PRIMARY: {
          modelId: 'vendor/model-20260811',
          provider: 'vendor',
        },
        CORRECTION_SECOND_PASS: {
          modelId: 'vendor/reviewer-20260811',
          provider: 'vendor',
        },
      },
      enabled: true,
      killSwitch: true,
    });
  });

  it('rejects environment reuse, dynamic aliases and missing allowlists', () => {
    expect(() =>
      readOpenRouterConfiguration({
        deploymentEnvironment: 'production',
        values: activeValues,
      }),
    ).toThrowError('CONFIGURATION_INVALID');

    expect(() =>
      readOpenRouterConfiguration({
        deploymentEnvironment: 'preview',
        values: {
          ...activeValues,
          LEARNX_AI_ALLOWED_MODELS: 'vendor/model-latest',
          LEARNX_AI_CORRECTION_PRIMARY_MODEL: 'vendor/model-latest',
        },
      }),
    ).toThrowError('CONFIGURATION_INVALID');

    expect(() =>
      readOpenRouterConfiguration({
        deploymentEnvironment: 'preview',
        values: { ...activeValues, LEARNX_AI_ALLOWED_PROVIDERS: '' },
      }),
    ).toThrowError('CONFIGURATION_INVALID');
  });
});

describe('OpenRouter structured provider', () => {
  it('sends a pinned structured request and returns internal accounting metadata', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(successResponse());
    const events: AiProviderLogEvent[] = [];
    const provider = new OpenRouterStructuredProvider({
      configuration: configuration(),
      fetch: fetchMock,
      now: () => 100,
      write: (event) => events.push(event),
    });

    await expect(provider.generate(request())).resolves.toEqual({
      metadata: {
        attemptCount: 1,
        generationId: 'generation-header-id',
        latencyMs: 0,
        modelId: 'vendor/model-20260811',
        provider: 'vendor',
        role: 'CORRECTION_PRIMARY',
        usage: {
          completionTokens: 15,
          costUsd: 0.0012,
          promptTokens: 40,
          totalTokens: 55,
        },
      },
      output: { answer: 'Validated' },
    });

    const init = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(init?.body)) as {
      model: string;
      provider: Record<string, unknown>;
      response_format: { json_schema: { strict: boolean } };
    };
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer server-secret',
      'X-OpenRouter-Metadata': 'enabled',
    });
    expect(body).toMatchObject({
      model: 'vendor/model-20260811',
      provider: {
        allow_fallbacks: false,
        data_collection: 'deny',
        only: ['vendor'],
        order: ['vendor'],
        require_parameters: true,
      },
      response_format: { json_schema: { strict: true } },
    });
    expect(JSON.stringify(events)).not.toContain('server-secret');
    expect(JSON.stringify(events)).not.toContain('Confidential system prompt');
    expect(events).toEqual([
      expect.objectContaining({
        event: 'ai_provider_request',
        status: 'success',
      }),
    ]);
  });

  it('rejects invalid JSON, invalid structured output and truncation', async () => {
    const invalidResponses = [
      successResponse({
        choices: [{ finish_reason: 'stop', message: { content: '{' } }],
      }),
      successResponse({
        choices: [
          { finish_reason: 'stop', message: { content: '{"wrong":true}' } },
        ],
      }),
      successResponse({
        choices: [
          {
            finish_reason: 'length',
            message: { content: '{"answer":"partial"}' },
          },
        ],
      }),
    ];

    for (const [index, response] of invalidResponses.entries()) {
      const provider = new OpenRouterStructuredProvider({
        configuration: configuration(),
        fetch: vi.fn<typeof fetch>().mockResolvedValue(response),
        write: () => undefined,
      });
      const expected =
        index === 2
          ? 'PROVIDER_RESPONSE_TRUNCATED'
          : 'PROVIDER_RESPONSE_INVALID';
      await expect(
        provider.generate(
          request({ idempotencyKey: `correction:invalid:${index}` }),
        ),
      ).rejects.toSatisfy((error: unknown) =>
        expectProviderError(error, expected),
      );
    }
  });

  it('rejects a non-JSON wire response and an embedded provider error', async () => {
    const responses = [
      new Response('<html>gateway error</html>', {
        headers: { 'content-type': 'text/html' },
        status: 200,
      }),
      successResponse({
        choices: [
          {
            error: { code: 502 },
            finish_reason: 'error',
            message: { content: '{"answer":"partial"}' },
          },
        ],
      }),
    ];

    for (const [index, response] of responses.entries()) {
      const provider = new OpenRouterStructuredProvider({
        configuration: configuration(),
        fetch: vi.fn<typeof fetch>().mockResolvedValue(response),
        write: () => undefined,
      });
      await expect(
        provider.generate(
          request({ idempotencyKey: `correction:wire:${index}` }),
        ),
      ).rejects.toSatisfy((error: unknown) =>
        expectProviderError(error, 'PROVIDER_RESPONSE_INVALID'),
      );
    }
  });

  it.each([
    [402, 'PROVIDER_PAYMENT_REQUIRED'],
    [500, 'PROVIDER_UNAVAILABLE'],
  ] as const)('normalizes HTTP %s without retry', async (status, code) => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status }));
    const provider = new OpenRouterStructuredProvider({
      configuration: configuration(),
      fetch: fetchMock,
      write: () => undefined,
    });

    await expect(provider.generate(request())).rejects.toSatisfy(
      (error: unknown) => expectProviderError(error, code),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([429, 503])(
    'honors a capped Retry-After once for explicit HTTP %s',
    async (status) => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response(null, { headers: { 'retry-after': '20' }, status }),
        )
        .mockResolvedValueOnce(successResponse());
      const sleep = vi.fn().mockResolvedValue(undefined);
      const provider = new OpenRouterStructuredProvider({
        configuration: configuration({ maxRetryDelayMs: 1_500 }),
        fetch: fetchMock,
        sleep,
        write: () => undefined,
      });

      await expect(provider.generate(request())).resolves.toMatchObject({
        metadata: { attemptCount: 2 },
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenCalledWith(1_500, undefined);
    },
  );

  it('does not retry timeouts and distinguishes caller cancellation', async () => {
    const timeoutFetch = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new DOMException('timed out', 'TimeoutError'));
    const timeoutProvider = new OpenRouterStructuredProvider({
      configuration: configuration(),
      fetch: timeoutFetch,
      write: () => undefined,
    });
    await expect(timeoutProvider.generate(request())).rejects.toSatisfy(
      (error: unknown) => expectProviderError(error, 'REQUEST_TIMEOUT'),
    );
    expect(timeoutFetch).toHaveBeenCalledTimes(1);

    const controller = new AbortController();
    controller.abort();
    await expect(
      timeoutProvider.generate(
        request({
          idempotencyKey: 'correction:cancelled:1234',
          signal: controller.signal,
        }),
      ),
    ).rejects.toSatisfy((error: unknown) =>
      expectProviderError(error, 'REQUEST_ABORTED'),
    );
  });

  it('enforces kill switch, context and output limits before fetch', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const disabled = new OpenRouterStructuredProvider({
      configuration: configuration({ killSwitch: true }),
      fetch: fetchMock,
      write: () => undefined,
    });
    await expect(disabled.generate(request())).rejects.toSatisfy(
      (error: unknown) => expectProviderError(error, 'AI_DISABLED'),
    );

    const limited = new OpenRouterStructuredProvider({
      configuration: configuration({
        maxContextCharacters: 10,
        maxOutputTokens: 100,
      }),
      fetch: fetchMock,
      write: () => undefined,
    });
    await expect(limited.generate(request())).rejects.toSatisfy(
      (error: unknown) => expectProviderError(error, 'CONTEXT_LIMIT_EXCEEDED'),
    );
    await expect(
      limited.generate(
        request({
          idempotencyKey: 'correction:tokens:1234',
          maxOutputTokens: 101,
          messages: [{ content: 'short', role: 'user' }],
        }),
      ),
    ).rejects.toSatisfy((error: unknown) =>
      expectProviderError(error, 'OUTPUT_TOKEN_LIMIT_EXCEEDED'),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('coalesces matching in-flight operations and rejects key conflicts', async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const fetchMock = vi.fn<typeof fetch>().mockReturnValue(pendingResponse);
    const provider = new OpenRouterStructuredProvider({
      configuration: configuration(),
      fetch: fetchMock,
      write: () => undefined,
    });
    const first = provider.generate(request());
    const duplicate = provider.generate(request());
    const conflict = provider.generate(
      request({ messages: [{ content: 'Different payload', role: 'user' }] }),
    );

    await expect(conflict).rejects.toSatisfy((error: unknown) =>
      expectProviderError(error, 'DUPLICATE_OPERATION_CONFLICT'),
    );
    resolveResponse?.(successResponse());
    await expect(Promise.all([first, duplicate])).resolves.toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('Fake structured provider', () => {
  it('provides deterministic output without a network call', async () => {
    const provider = new FakeStructuredAiProvider(() => ({
      metadata: {
        attemptCount: 1,
        generationId: 'fake-generation',
        latencyMs: 0,
        modelId: 'fake/model-v1',
        provider: 'fake',
        role: 'CORRECTION_PRIMARY',
        usage: {
          completionTokens: 0,
          costUsd: 0,
          promptTokens: 0,
          totalTokens: 0,
        },
      },
      output: { answer: 'Fixture' },
    }));

    await expect(provider.generate(request())).resolves.toMatchObject({
      output: { answer: 'Fixture' },
    });
    expect(provider.requests).toHaveLength(1);
  });
});
