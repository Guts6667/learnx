import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { withGuardedResearchRun } from './ai-correction-research-run.js';
import { callCandidate } from './ai-correction-benchmark-runner-preflight.js';
import {
  parseCorrectionBenchmarkConfiguration,
  parseCorrectionBenchmarkCorpus,
} from './ai-correction-benchmark.js';
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});
const arguments_ = [
  '--execute',
  '--supplier-cost-cap-usd=1',
  '--envelope-usd=1',
  '--envelope-decision=offline-test',
];
const primary = {
  modelId: 'anthropic/claude-sonnet-4.6',
  promptUsdPerToken: 0.000003,
  completionUsdPerToken: 0.000015,
  maxOutputTokens: 20000,
};
async function directory() {
  const value = await mkdtemp(path.join(tmpdir(), 'research-run-'));
  directories.push(value);
  return value;
}
it('injects the guarded transport into real candidate dispatch and records every primary/retry before returning', async () => {
  const budgetDirectory = await directory();
  let posts = 0;
  const fetcher: typeof fetch = async (resource, init) => {
    const request = new Request(resource, init);
    if (request.method === 'GET')
      return new Response(JSON.stringify({ data: { total_usage: 0 } }));
    const body = (await request.json()) as {
      provider: { max_price?: unknown };
    };
    expect(body.provider.max_price).toEqual({ prompt: 3, completion: 15 });
    expect(request.redirect).toBe('error');
    const journal = (
      await readFile(path.join(budgetDirectory, 'calls.jsonl'), 'utf8')
    )
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { kind: string });
    expect(journal.at(-1)?.kind).toBe('CALL_INTENT');
    posts += 1;
    return new Response(
      JSON.stringify({
        model: primary.modelId,
        provider: 'Anthropic',
        choices: [{ finish_reason: 'stop', message: { content: '{}' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, cost: 0.00001 },
      }),
    );
  };
  const configuration = parseCorrectionBenchmarkConfiguration(
    JSON.parse(
      await readFile('benchmarks/ai-correction/benchmark.v1.json', 'utf8'),
    ) as unknown,
  );
  const corpus = parseCorrectionBenchmarkCorpus(
    JSON.parse(
      await readFile('benchmarks/ai-correction/corpus.v1.json', 'utf8'),
    ) as unknown,
  );
  const candidate = configuration.candidates.find(
    (entry) => entry.modelId === primary.modelId,
  );
  const benchmarkCase = corpus.cases[0];
  if (!candidate || !benchmarkCase) throw new Error('Fixture missing');
  const result = await withGuardedResearchRun({
    arguments: arguments_,
    apiKey: 'offline',
    budgetDirectory,
    runId: 'primary-and-retry',
    models: [primary],
    fetchImplementation: fetcher,
    execute: async (guard) => {
      await callCandidate({
        apiKey: 'offline',
        benchmarkCase,
        candidate,
        configuration,
        corpus,
        fetchImplementation: guard.fetch,
      });
      await callCandidate({
        apiKey: 'offline',
        benchmarkCase,
        candidate,
        configuration,
        corpus,
        fetchImplementation: guard.fetch,
      });
      guard.assertReconciled();
      return 'ready';
    },
  });
  expect(result).toBe('ready');
  expect(posts).toBe(2);
  const events = (
    await readFile(path.join(budgetDirectory, 'calls.jsonl'), 'utf8')
  )
    .trim()
    .split('\n');
  expect(events).toHaveLength(4);
  await expect(
    readFile(path.join(budgetDirectory, 'active-run/owner.json')),
  ).rejects.toMatchObject({ code: 'ENOENT' });
});
it('refuses missing execution authorization before reading usage or invoking a callback', async () => {
  const execute = vi.fn();
  const fetcher = vi.fn();
  await expect(
    withGuardedResearchRun({
      arguments: [],
      apiKey: 'offline',
      budgetDirectory: await directory(),
      runId: 'refused',
      models: [primary],
      fetchImplementation: fetcher,
      execute,
    }),
  ).rejects.toThrow('EXPLICIT_SHARED_ENVELOPE_REQUIRED');
  expect(execute).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
});
