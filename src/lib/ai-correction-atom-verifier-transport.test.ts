import { describe, expect, it, vi } from 'vitest';
import {
  atomRequestBody,
  callAtomModel,
  readAtomProviderUsage,
  type AtomCandidate,
} from './ai-correction-atom-verifier-transport.js';

const candidate: AtomCandidate = {
  id: 'fixture',
  modelId: 'test/model',
  price: { prompt: 0.000001, completion: 0.000005 },
  priceSource: 'fixture',
  route: { slug: 'test/eu', provider: 'Test' },
};
const valid = () => ({
  id: 'gen-fixture',
  model: candidate.modelId,
  provider: 'Test',
  choices: [
    {
      finish_reason: 'stop',
      message: {
        content: JSON.stringify({
          verdict: 'direct',
          sentences: [],
          reason: 'written evidence',
        }),
      },
    },
  ],
  usage: { cost: 0.01, completion_tokens_details: { reasoning_tokens: 0 } },
});
const fetcher = (payload: unknown, status = 200) =>
  vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify(payload), { status }));

describe('atom transport qualification', () => {
  it('pins the route, schema, reasoning and full output budget with a price ceiling', async () => {
    const body = atomRequestBody(candidate, 'copy');
    expect(body).toMatchObject({
      max_tokens: 400,
      reasoning: { enabled: false },
      provider: {
        only: ['test/eu'],
        require_parameters: true,
        allow_fallbacks: false,
        max_price: { prompt: 1, completion: 5 },
      },
    });
    const fetch = fetcher(valid());
    expect(
      await callAtomModel({
        apiKey: 'dummy',
        candidate,
        userMessage: 'copy',
        fetcher: fetch,
      }),
    ).toMatchObject({
      costUsd: 0.01,
      errorCode: null,
      generationId: 'gen-fixture',
      providerRoute: 'Test',
    });
    expect(fetch).toHaveBeenCalledOnce();
    expect(() =>
      atomRequestBody({ ...candidate, route: null }, 'copy'),
    ).toThrow('PROFILE_UNVERIFIED');
  });
  it.each(['network', 'json', 'http', 'cost'])(
    'preserves unknown costs and does not retry %s failure',
    async (kind) => {
      const fetch =
        kind === 'network'
          ? vi
              .fn<typeof globalThis.fetch>()
              .mockRejectedValue(new Error('network'))
          : kind === 'json'
            ? vi
                .fn<typeof globalThis.fetch>()
                .mockResolvedValue(new Response('broken'))
            : fetcher(kind === 'cost' ? { ...valid(), usage: {} } : {}, 503);
      const result = await callAtomModel({
        apiKey: 'dummy',
        candidate,
        userMessage: 'copy',
        fetcher: fetch,
      });
      expect(result.costUsd).toBeNull();
      expect(result.errorCode).toBeTruthy();
      expect(fetch).toHaveBeenCalledOnce();
    },
  );
  it.each([
    'model',
    'provider',
    'reasoning',
    'truncated',
    'empty',
    'schema',
    'missingReasoning',
  ])('fails qualification on %s while preserving actual cost', async (kind) => {
    const data = valid();
    if (kind === 'model') data.model = 'another';
    if (kind === 'provider') data.provider = 'Another';
    if (kind === 'reasoning')
      data.usage.completion_tokens_details.reasoning_tokens = 50;
    if (kind === 'missingReasoning')
      Reflect.deleteProperty(data.usage, 'completion_tokens_details');
    if (kind === 'truncated') data.choices[0].finish_reason = 'length';
    if (kind === 'empty') data.choices[0].message.content = '';
    if (kind === 'schema')
      data.choices[0].message.content = '{"verdict":"direct"}';
    const result = await callAtomModel({
      apiKey: 'dummy',
      candidate,
      userMessage: 'copy',
      fetcher: fetcher(data),
    });
    expect(result.costUsd).toBe(0.01);
    expect(result.errorCode).toBeTruthy();
  });
  it('treats missing, negative and unavailable provider usage as unmeasurable', async () => {
    expect(
      await readAtomProviderUsage(
        'dummy',
        fetcher({ data: { total_usage: 4.5 } }),
      ),
    ).toBe(4.5);
    for (const f of [
      fetcher({}),
      fetcher({ data: { total_usage: -1 } }),
      fetcher({}, 500),
      vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')),
    ])
      expect(await readAtomProviderUsage('dummy', f)).toBeNull();
  });
});
