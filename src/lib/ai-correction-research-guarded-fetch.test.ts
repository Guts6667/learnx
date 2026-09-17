import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { openAtomBudget } from './ai-correction-atom-verifier-budget.js';
import {
  applyResearchPriceCeilings,
  createGuardedResearchFetch,
} from './ai-correction-research-guarded-fetch.js';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
const model = {
  modelId: 'pinned/model',
  promptUsdPerToken: 0.00001,
  completionUsdPerToken: 0.0001,
  maxOutputTokens: 400,
};
const endpoint = 'https://openrouter.ai/api/v1/chat/completions';
const body = () => ({
  model: model.modelId,
  messages: [{ role: 'user', content: 'Verify épreuve' }],
  max_tokens: 400,
  provider: {
    only: ['pinned/route'],
    allow_fallbacks: false,
    data_collection: 'deny',
    require_parameters: true,
  },
});
const request = (value: unknown = body()): RequestInit => ({
  method: 'POST',
  headers: {
    authorization: 'Bearer test-only',
    'content-type': 'application/json',
  },
  body: JSON.stringify(value),
});
const response = (cost: number | null = 0.01, status = 200) =>
  new Response(
    JSON.stringify({
      usage: cost === null ? {} : { cost },
      choices: [
        { message: { content: 'payload is deliberately not schema-valid' } },
      ],
    }),
    { status },
  );
function fixture(fetcher: typeof fetch, cap = 1) {
  const directory = mkdtempSync(path.join(tmpdir(), 'research-fetch-'));
  directories.push(directory);
  const settings = {
    directory,
    decisionId: 'test-approved',
    envelopeUsd: cap,
    keyHash: 'sha256:test-only',
    providerUsageUsd: 10,
    runCapUsd: cap,
    runId: 'test-run',
  };
  const budget = openAtomBudget(settings);
  const readProviderUsage = vi.fn(async (): Promise<number | null> => 10);
  return {
    directory,
    settings,
    budget,
    readProviderUsage,
    guard: createGuardedResearchFetch({
      budget,
      models: [model],
      readProviderUsage,
      fetcher,
    }),
  };
}

it('writes intent before POST, pins prices without relaxing lower ceilings, and returns the same readable response', async () => {
  const raw = response();
  const sent: Request[] = [];
  const f = fixture(async (resource) => {
    expect(
      readFileSync(path.join(f.directory, 'calls.jsonl'), 'utf8'),
    ).toContain('CALL_INTENT');
    sent.push(resource as Request);
    return raw;
  });
  const input = body();
  const original = JSON.stringify(input);
  const returned = await f.guard.fetch(
    endpoint,
    request({
      ...input,
      provider: {
        ...input.provider,
        max_price: { prompt: 2, completion: 200 },
      },
    }),
  );
  expect(returned).toBe(raw);
  expect(await returned.json()).toHaveProperty('usage.cost', 0.01);
  const sentBody = await sent[0].json();
  expect(sentBody.provider).toMatchObject({
    only: ['pinned/route'],
    max_price: { prompt: 2, completion: 100 },
  });
  expect(sent[0].headers.get('authorization')).toBe('Bearer test-only');
  expect(sent[0].redirect).toBe('error');
  expect(sentBody).toEqual(
    applyResearchPriceCeilings(
      {
        ...input,
        provider: {
          ...input.provider,
          max_price: { prompt: 2, completion: 200 },
        },
      },
      model,
    ),
  );
  expect(JSON.stringify(input)).toBe(original);
  expect(f.budget.totals()).toMatchObject({
    runKnownUsd: 0.01,
    unknownCalls: 0,
  });
  const journal = readFileSync(path.join(f.directory, 'calls.jsonl'), 'utf8');
  expect(journal).not.toContain('Bearer');
  expect(journal).not.toContain('Verify');
  const intent = JSON.parse(journal.split('\n')[0]) as { reservedUsd: number };
  expect(intent.reservedUsd).toBeGreaterThan(400 * model.completionUsdPerToken);
  await f.guard.finish();
  await expect(f.guard.fetch(endpoint, request())).rejects.toThrow('CLOSED');
});

it.each([200, 429, 500])(
  'preserves real cost and the original body on status %s even if the model payload is invalid',
  async (status) => {
    const f = fixture(async () => response(0.02, status));
    expect((await f.guard.fetch(endpoint, request())).status).toBe(status);
    await f.guard.finish();
    expect(f.budget.totals().runKnownUsd).toBe(0.02);
  },
);

it('records explicit zero as known, never inferring zero from missing usage', async () => {
  const f = fixture(async () => response(0));
  await f.guard.fetch(endpoint, request());
  await f.guard.finish();
  expect(f.budget.totals()).toMatchObject({ runKnownUsd: 0, unknownCalls: 0 });
});

it.each([
  response(null),
  new Response('unreadable', { status: 502 }),
  response(-1),
])(
  'blocks restart and later calls after unknown or invalid usage, including the final response',
  async (raw) => {
    const fetcher = vi.fn(async () => raw);
    const f = fixture(fetcher);
    expect(await f.guard.fetch(endpoint, request())).toBe(raw);
    expect(f.budget.totals()).toMatchObject({
      runKnownUsd: 0,
      unknownCalls: 1,
    });
    await expect(f.guard.fetch(endpoint, request())).rejects.toThrow(
      'RECONCILIATION_REQUIRED',
    );
    await expect(f.guard.finish()).rejects.toThrow('RECONCILIATION_REQUIRED');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(() => openAtomBudget(f.settings)).toThrow('RECONCILIATION_REQUIRED');
  },
);

it('persists unknown cost on network failure and retains the original failure as cause', async () => {
  const failure = new Error('network failed');
  const f = fixture(async () => {
    throw failure;
  });
  await expect(f.guard.fetch(endpoint, request())).rejects.toMatchObject({
    message: expect.stringContaining('RECONCILIATION_REQUIRED'),
    cause: failure,
  });
  await expect(f.guard.finish()).rejects.toThrow('RECONCILIATION_REQUIRED');
  expect(readFileSync(path.join(f.directory, 'calls.jsonl'), 'utf8')).toContain(
    '"costUsd":null',
  );
});

it('refuses a final-call overrun, preserves its full real cost, and prevents another run', async () => {
  const f = fixture(async () => response(0.5));
  await f.guard.fetch(endpoint, request());
  expect(f.budget.totals().runKnownUsd).toBe(0.5);
  expect(() => f.guard.assertReconciled()).toThrow('RESERVATION_EXCEEDED');
  await expect(f.guard.finish()).rejects.toThrow('RESERVATION_EXCEEDED');
  expect(() => openAtomBudget(f.settings)).toThrow('RESERVATION_EXCEEDED');
});

it('reserves concurrent requests against the same cap and drains admitted calls before finish rejects', async () => {
  const resolvers: ((response: Response) => void)[] = [];
  const fetcher = vi.fn(
    () => new Promise<Response>((resolve) => resolvers.push(resolve)),
  );
  const f = fixture(fetcher, 0.15);
  const jobs = Array.from({ length: 3 }, () =>
    f.guard.fetch(endpoint, request()),
  );
  const outcomes = Promise.allSettled(jobs);
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(f.budget.totals().reservedUsd).toBeGreaterThan(0.1);
  let finished = false;
  const finishing = f.guard
    .finish()
    .catch((error: unknown) => error)
    .finally(() => {
      finished = true;
    });
  await Promise.resolve();
  expect(finished).toBe(false);
  for (const resolve of resolvers) resolve(response());
  expect(
    (await outcomes).filter((outcome) => outcome.status === 'fulfilled'),
  ).toHaveLength(2);
  expect(await finishing).toMatchObject({ message: 'ATOM_BUDGET_CAP' });
  expect(f.budget.totals()).toMatchObject({
    unknownCalls: 0,
    runKnownUsd: 0.02,
  });
});

it('settles already-dispatched calls after another call becomes unknown and blocks waiting admissions', async () => {
  const resolvers: ((response: Response) => void)[] = [];
  const f = fixture(
    () => new Promise<Response>((resolve) => resolvers.push(resolve)),
  );
  const jobs = [
    f.guard.fetch(endpoint, request()),
    f.guard.fetch(endpoint, request()),
  ];
  await vi.waitFor(() => expect(resolvers).toHaveLength(2));
  resolvers[0](response(null));
  await jobs[0];
  await expect(f.guard.fetch(endpoint, request())).rejects.toThrow(
    'RECONCILIATION_REQUIRED',
  );
  resolvers[1](response(0.03));
  await jobs[1];
  await expect(f.guard.finish()).rejects.toThrow('RECONCILIATION_REQUIRED');
  expect(f.budget.totals()).toMatchObject({
    unknownCalls: 1,
    runKnownUsd: 0.03,
  });
});

it.each([
  { model: 'wrong/model' },
  { max_tokens: 401 },
  { max_tokens: 0 },
  { max_tokens: undefined },
  { stream: true },
  { n: 2 },
  { tools: [] },
  { models: ['other/model'] },
  { reasoning: { max_tokens: 500 } },
  { messages: [{ role: 'user', content: [{ type: 'image_url' }] }] },
  { provider: { only: ['route'], allow_fallbacks: true } },
])(
  'refuses unreservable requests before all provider calls: %j',
  async (override) => {
    const fetcher = vi.fn(async () => response());
    const f = fixture(fetcher);
    await expect(
      f.guard.fetch(endpoint, request({ ...body(), ...override })),
    ).rejects.toThrow('RESEARCH_TRANSPORT_');
    expect(fetcher).not.toHaveBeenCalled();
    expect(f.readProviderUsage).not.toHaveBeenCalled();
    expect(f.budget.totals().unknownCalls).toBe(0);
  },
);

it('refuses malformed JSON, foreign endpoints, methods and unavailable usage before spending', async () => {
  for (const [url, init] of [
    [endpoint, { method: 'POST', body: '{bad' }],
    ['https://other.test/api/v1/chat/completions', request()],
    ['https://openrouter.ai/api/v1/other', request()],
    [endpoint, { method: 'GET' }],
  ] as const) {
    const fetcher = vi.fn(async () => response());
    const f = fixture(fetcher);
    await expect(f.guard.fetch(url, init)).rejects.toThrow(
      'RESEARCH_TRANSPORT_',
    );
    expect(fetcher).not.toHaveBeenCalled();
  }
  const fetcher = vi.fn(async () => response());
  const f = fixture(fetcher);
  f.readProviderUsage.mockResolvedValue(null);
  await expect(f.guard.fetch(endpoint, request())).rejects.toThrow(
    'UNMEASURABLE',
  );
  expect(fetcher).not.toHaveBeenCalled();
});

it('supports Request input and transparently passes explicit read-only usage GETs even after paid dispatch closes', async () => {
  const raw = response();
  const fetcher = vi.fn(async () => raw);
  const f = fixture(fetcher);
  for (const pathname of ['/api/v1/credits', '/api/v1/key']) {
    expect(await f.guard.fetch(`https://openrouter.ai${pathname}`)).toBe(raw);
  }
  expect(f.readProviderUsage).not.toHaveBeenCalled();
  await f.guard.fetch(new Request(endpoint, request()));
  await f.guard.finish();
  expect(await f.guard.fetch('https://openrouter.ai/api/v1/credits')).toBe(raw);
  expect(f.budget.totals().runKnownUsd).toBe(0.01);
});

it('does not dispatch waiting calls after an unknown result arrives during their usage read', async () => {
  let resolveUsage: (usage: number) => void = () => {
    throw new Error('Usage not started');
  };
  let resolveFirst: (response: Response) => void = () => {
    throw new Error('Call not started');
  };
  const fetcher = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        resolveFirst = resolve;
      }),
  );
  const f = fixture(fetcher);
  const first = f.guard.fetch(endpoint, request());
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  f.readProviderUsage.mockImplementationOnce(
    () =>
      new Promise<number>((resolve) => {
        resolveUsage = resolve;
      }),
  );
  const second = f.guard.fetch(endpoint, request());
  const secondSettled = Promise.allSettled([second]);
  await vi.waitFor(() => expect(f.readProviderUsage).toHaveBeenCalledTimes(2));
  resolveFirst(response(null));
  await first;
  resolveUsage(10);
  expect((await secondSettled)[0]).toMatchObject({
    status: 'rejected',
    reason: { message: expect.stringContaining('RECONCILIATION_REQUIRED') },
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(f.budget.totals().unknownCalls).toBe(1);
});

it('refuses invalid rates and duplicate model identities before composing a spend path', () => {
  const f = fixture(async () => response());
  for (const models of [
    [],
    [model, model],
    [{ ...model, promptUsdPerToken: -1 }],
  ]) {
    expect(() =>
      createGuardedResearchFetch({
        budget: f.budget,
        models,
        readProviderUsage: f.readProviderUsage,
        fetcher: async () => response(),
      }),
    ).toThrow();
  }
});

it('keeps a durable pending intent and stops when writing settlement fails', async () => {
  const f = fixture(async () => response());
  vi.spyOn(f.budget, 'settle').mockImplementation(() => {
    throw new Error('disk full');
  });
  await expect(f.guard.fetch(endpoint, request())).rejects.toThrow('disk full');
  await expect(f.guard.finish()).rejects.toThrow(
    'settlement persistence failed',
  );
  expect(f.budget.totals().unknownCalls).toBe(1);
  expect(() => openAtomBudget(f.settings)).toThrow('RECONCILIATION_REQUIRED');
});
