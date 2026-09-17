/** Offline by default. A paid run requires reviewed inputs, explicit caps and the shared research ledger. */
import { createHash, randomUUID } from 'node:crypto';
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {
  executeRecoveryMeasurement,
  prepareRecoveryExecution,
  type RecoveryExecutionEvent,
} from '../src/lib/ai-correction-recovery-execution';
import {
  acquireAtomRunLock,
  openAtomBudget,
  sharedResearchStateDirectory,
} from '../src/lib/ai-correction-atom-verifier-budget';
import { readAtomProviderUsage } from '../src/lib/ai-correction-atom-verifier-transport';
import {
  PROMOTED_CORRECTION_IDENTITY,
  PROMOTED_CHECKER_IDENTITY,
} from '../src/server/corrections/promoted-identity';
import { createGuardedResearchFetch } from '../src/lib/ai-correction-research-guarded-fetch';

function argumentsForRun(argv: string[]) {
  const options = new Map<string, string>();
  const allowed = new Set([
    'pack',
    'reference',
    'lock',
    'safety-report',
    'price-caps',
    'out',
    'decision-id',
    'envelope-usd',
    'run-cap-usd',
  ]);
  let execute = false;
  for (const argument of argv) {
    if (argument === '--execute' && !execute) {
      execute = true;
      continue;
    }
    const match = /^--([^=]+)=(.+)$/u.exec(argument);
    if (!match || !allowed.has(match[1]) || options.has(match[1]))
      throw new Error(`Unknown or repeated option: ${argument}`);
    options.set(match[1], match[2]);
  }
  const required = (key: string) => {
    const value = options.get(key)?.trim();
    if (!value) throw new Error(`Required --${key}=...`);
    return value;
  };
  const positive = (key: string) => {
    const value = Number(required(key));
    if (!Number.isFinite(value) || value <= 0)
      throw new Error(`Invalid --${key}`);
    return value;
  };
  const budget = execute
    ? {
        decisionId: required('decision-id'),
        envelopeUsd: positive('envelope-usd'),
        runCapUsd: positive('run-cap-usd'),
      }
    : null;
  if (budget && budget.runCapUsd > budget.envelopeUsd)
    throw new Error('Run cap exceeds the owner envelope.');
  return {
    execute,
    budget,
    pack: required('pack'),
    reference: required('reference'),
    lock: required('lock'),
    safetyReport: required('safety-report'),
    priceCaps: required('price-caps'),
    out: path.resolve(required('out')),
  };
}
const read = (file: string): unknown =>
  JSON.parse(readFileSync(path.resolve(file), 'utf8')) as unknown;
const writeNew = (file: string, data: unknown) =>
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, {
    flag: 'wx',
    flush: true,
  });

async function main() {
  const args = argumentsForRun(process.argv.slice(2));
  const safetyReport = read(args.safetyReport);
  const plan = prepareRecoveryExecution({
    pack: read(args.pack),
    reference: read(args.reference),
    lock: read(args.lock),
    safetyReport,
    priceCaps: read(args.priceCaps),
    startedAt: new Date().toISOString(),
    identities: {
      primary: PROMOTED_CORRECTION_IDENTITY,
      verifier: PROMOTED_CHECKER_IDENTITY,
    },
  });
  mkdirSync(args.out); // Exclusive: neither old observations nor stopped campaigns are overwritten.
  writeNew(path.join(args.out, 'plan.json'), {
    ...plan,
    run: { ...plan.run, observations: [] },
    paidExecutionRequested: args.execute,
    budget: args.budget,
  });
  writeNew(path.join(args.out, 'safety-report.unreviewed.json'), safetyReport);
  if (!args.execute) {
    console.log(
      `DRY RUN: 2 profile smoke calls then up to 1080 calls / 540 observations planned; zero calls made. Safety applicability UNREVIEWED. ${args.out}`,
    );
    return;
  }
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey || !args.budget)
    throw new Error(
      'Export OPENROUTER_API_KEY alone before explicit execution; never source .env.',
    );
  const runId = randomUUID();
  const directory = sharedResearchStateDirectory();
  writeNew(path.join(args.out, 'execution-request.json'), {
    runId,
    ...args.budget,
    requestedAt: new Date().toISOString(),
    lockHash: plan.run.lockHash,
    sharedLedgerDirectory: directory,
  });
  const release = acquireAtomRunLock(directory);
  const abort = new AbortController();
  const interrupt = () => abort.abort(new Error('RECOVERY_OWNER_INTERRUPTED'));
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  let guard: ReturnType<typeof createGuardedResearchFetch> | undefined;
  let budget: ReturnType<typeof openAtomBudget> | undefined;
  let stopped: string | null;
  let measurement:
    Awaited<ReturnType<typeof executeRecoveryMeasurement>> | undefined;
  const persist = (event: RecoveryExecutionEvent) => {
    appendFileSync(
      path.join(args.out, 'events.jsonl'),
      `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`,
      { flush: true },
    );
    if (event.kind === 'OBSERVATION') {
      const observations = [...plan.run.observations, event.observation];
      appendFileSync(
        path.join(args.out, 'observations.jsonl'),
        `${JSON.stringify(event.observation)}\n`,
        { flush: true },
      );
      writeNew(
        path.join(
          args.out,
          `checkpoint-${String(observations.length).padStart(4, '0')}.json`,
        ),
        { ...plan.run, observations },
      );
    }
  };
  try {
    const providerUsageUsd = await readAtomProviderUsage(apiKey);
    if (providerUsageUsd === null)
      throw new Error('RECOVERY_PROVIDER_USAGE_UNMEASURABLE');
    budget = openAtomBudget({
      directory,
      ...args.budget,
      keyHash: `sha256:${createHash('sha256').update(apiKey).digest('hex')}`,
      providerUsageUsd,
      runId,
    });
    guard = createGuardedResearchFetch({
      budget,
      models: Object.values(plan.protocol.profiles).map((profile) => ({
        modelId: profile.modelId,
        promptUsdPerToken: profile.priceCap.promptUsdPerToken,
        completionUsdPerToken: profile.priceCap.completionUsdPerToken,
        maxOutputTokens: profile.maxOutputTokens,
      })),
      readProviderUsage: () => readAtomProviderUsage(apiKey),
      fetcher: fetch,
    });
    measurement = await executeRecoveryMeasurement({
      plan,
      apiKey,
      fetcher: guard.fetch,
      assertReconciled: guard.assertReconciled,
      persist,
      signal: abort.signal,
    });
    stopped = measurement.stopped;
  } catch (error) {
    stopped =
      error instanceof Error ? error.message : 'RECOVERY_EXECUTION_FAILED';
  } finally {
    try {
      await guard?.finish();
      guard?.assertReconciled();
    } catch (error) {
      stopped =
        error instanceof Error
          ? error.message
          : 'RECOVERY_RECONCILIATION_REQUIRED';
    } finally {
      process.off('SIGINT', interrupt);
      process.off('SIGTERM', interrupt);
      // A hard crash leaves this lock; an orderly unknown-cost stop leaves the durable unresolved ledger.
      release();
    }
  }
  writeNew(path.join(args.out, 'run.json'), plan.run);
  writeNew(path.join(args.out, 'execution-summary.json'), {
    runId,
    status: stopped
      ? 'INCOMPLETE_REVIEW_REQUIRED'
      : 'MEASUREMENT_COMPLETE_REVIEW_REQUIRED',
    stopped,
    observations: plan.run.observations.length,
    expectedObservations: 540,
    attemptedCalls: measurement?.attemptedCalls ?? null,
    accounting: budget?.totals() ?? null,
    responseAccounting: measurement?.responseAccounting ?? null,
    safetyApplicability: 'UNREVIEWED_APPLICABILITY',
    releaseAuthorized: false,
  });
  console.log(
    `${stopped ? 'INCOMPLETE' : 'MEASUREMENT COMPLETE'}; ${plan.run.observations.length}/540 observations; safety/release review required. ${args.out}`,
  );
  if (stopped) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Recovery execution failed.',
  );
  process.exitCode = 1;
});
