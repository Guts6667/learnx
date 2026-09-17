/** One shared decision envelope and lock around every provider call in a run. */
import { createHash } from 'node:crypto';
import {
  acquireAtomRunLock,
  openAtomBudget,
  sharedResearchStateDirectory,
} from './ai-correction-atom-verifier-budget.js';
import { createGuardedResearchFetch } from './ai-correction-research-guarded-fetch.js';

export async function readResearchProviderUsage(
  apiKey: string,
  fetcher: typeof fetch,
): Promise<number | null> {
  try {
    const response = await fetcher('https://openrouter.ai/api/v1/credits', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      data?: { total_usage?: unknown };
    };
    const usage = body.data?.total_usage;
    return typeof usage === 'number' && Number.isFinite(usage) && usage >= 0
      ? usage
      : null;
  } catch {
    return null;
  }
}

export async function withGuardedResearchRun<T>(input: {
  arguments: string[];
  apiKey: string;
  runId: string;
  models: Parameters<typeof createGuardedResearchFetch>[0]['models'];
  budgetDirectory?: string;
  fetchImplementation?: typeof fetch;
  execute: (guard: ReturnType<typeof createGuardedResearchFetch>) => Promise<T>;
}): Promise<T> {
  const option = (name: string) =>
    input.arguments
      .find((value) => value.startsWith(`--${name}=`))
      ?.slice(name.length + 3);
  const decisionId = option('envelope-decision') ?? option('decision-id');
  const envelopeUsd = Number(option('envelope-usd'));
  const runCapUsd = Number(option('supplier-cost-cap-usd'));
  if (
    !input.arguments.includes('--execute') ||
    input.arguments.includes('--dry-run') ||
    !decisionId ||
    !input.apiKey ||
    !Number.isFinite(envelopeUsd) ||
    envelopeUsd <= 0 ||
    !Number.isFinite(runCapUsd) ||
    runCapUsd <= 0 ||
    (option('decision-id') &&
      option('envelope-decision') &&
      option('decision-id') !== decisionId)
  ) {
    throw new Error('RESEARCH_EXPLICIT_SHARED_ENVELOPE_REQUIRED');
  }
  const directory = input.budgetDirectory ?? sharedResearchStateDirectory();
  const release = acquireAtomRunLock(directory);
  let guard: ReturnType<typeof createGuardedResearchFetch> | undefined;
  try {
    const fetcher = input.fetchImplementation ?? fetch;
    const readProviderUsage = () =>
      readResearchProviderUsage(input.apiKey, fetcher);
    const usage = await readProviderUsage();
    if (usage === null) throw new Error('RESEARCH_PROVIDER_USAGE_UNAVAILABLE');
    const budget = openAtomBudget({
      directory,
      decisionId,
      envelopeUsd,
      runCapUsd,
      runId: input.runId,
      keyHash: `sha256:${createHash('sha256').update(input.apiKey).digest('hex')}`,
      providerUsageUsd: usage,
    });
    guard = createGuardedResearchFetch({
      budget,
      fetcher,
      models: input.models,
      readProviderUsage,
    });
    return await input.execute(guard);
  } finally {
    try {
      await guard?.finish();
    } finally {
      release();
    }
  }
}
