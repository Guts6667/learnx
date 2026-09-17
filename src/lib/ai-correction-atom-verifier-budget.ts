import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export function sharedResearchStateDirectory(): string {
  const common = execFileSync('git', ['rev-parse', '--git-common-dir'], {
    encoding: 'utf8',
  }).trim();
  return path.resolve(common, 'learnx-paid-research');
}

const money = z.number().finite().nonnegative();
const envelopeSchema = z
  .object({
    capUsd: money.positive(),
    decisionId: z.string().min(1),
    keyHash: z.string().min(1),
    openingProviderUsageUsd: money,
  })
  .strict();
const eventSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('CALL_INTENT'),
      callId: z.string(),
      reservedUsd: money,
      runId: z.string(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('SETTLED'),
      callId: z.string(),
      costUsd: money.nullable(),
    })
    .strict(),
]);

/** Atomic and shared across worktrees. A crashed lock requires explicit review. */
export function acquireAtomRunLock(directory: string): () => void {
  mkdirSync(directory, { recursive: true });
  const lock = path.join(directory, 'active-run');
  const token = randomUUID();
  try {
    mkdirSync(lock);
  } catch {
    throw new Error(
      'ATOM_RUN_LOCKED: inspect the existing run; never steal a stale lock',
    );
  }
  writeFileSync(
    path.join(lock, 'owner.json'),
    JSON.stringify({
      token,
      pid: process.pid,
      startedAt: new Date().toISOString(),
    }),
    { flag: 'wx' },
  );
  return () => {
    const owner = JSON.parse(
      readFileSync(path.join(lock, 'owner.json'), 'utf8'),
    ) as { token?: unknown };
    if (owner.token !== token) throw new Error('ATOM_RUN_LOCK_OWNER_CHANGED');
    rmSync(lock, { recursive: true });
  };
}

type Charge = {
  reservedUsd: number;
  runId: string;
  costUsd: number | null | undefined;
};

/**
 * One durable envelope per owner decision. Caller holds acquireAtomRunLock.
 * Intents precede dispatch, settlements append; pending/unknown calls forbid a
 * new run. Provider lifetime usage and local charges are floors, never zero
 * substitutes. There is deliberately no automatic reconciliation or reset.
 */
export function openAtomBudget(input: {
  directory: string;
  decisionId: string;
  envelopeUsd: number;
  keyHash: string;
  providerUsageUsd: number;
  runCapUsd: number;
  runId: string;
}) {
  money.parse(input.providerUsageUsd);
  money.positive().parse(input.runCapUsd);
  const envelopeFile = path.join(input.directory, 'envelope.json');
  const journalFile = path.join(input.directory, 'calls.jsonl');
  const proposed = envelopeSchema.parse({
    capUsd: input.envelopeUsd,
    decisionId: input.decisionId,
    keyHash: input.keyHash,
    openingProviderUsageUsd: input.providerUsageUsd,
  });
  let envelope = proposed;
  try {
    envelope = envelopeSchema.parse(
      JSON.parse(readFileSync(envelopeFile, 'utf8')),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    writeFileSync(envelopeFile, JSON.stringify(proposed) + '\n', {
      flag: 'wx',
    });
  }
  if (
    envelope.decisionId !== input.decisionId ||
    envelope.capUsd !== input.envelopeUsd ||
    envelope.keyHash !== input.keyHash
  ) {
    throw new Error(
      'ATOM_ENVELOPE_CONFLICT: existing decision, cap and key must match',
    );
  }
  const charges = new Map<string, Charge>();
  let journal = '';
  try {
    journal = readFileSync(journalFile, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  for (const line of journal.split('\n').filter(Boolean)) {
    const event = eventSchema.parse(JSON.parse(line));
    if (event.kind === 'CALL_INTENT') {
      if (charges.has(event.callId)) throw new Error('ATOM_DUPLICATE_INTENT');
      charges.set(event.callId, {
        reservedUsd: event.reservedUsd,
        runId: event.runId,
        costUsd: undefined,
      });
    } else {
      const charge = charges.get(event.callId);
      if (!charge || charge.costUsd !== undefined)
        throw new Error('ATOM_INVALID_SETTLEMENT');
      charge.costUsd = event.costUsd;
    }
  }
  if ([...charges.values()].some((c) => c.costUsd == null)) {
    throw new Error('ATOM_RECONCILIATION_REQUIRED');
  }
  if (
    [...charges.values()].some(
      (c) => typeof c.costUsd === 'number' && c.costUsd > c.reservedUsd,
    )
  )
    throw new Error('ATOM_RESERVATION_EXCEEDED');
  let blocked = false;
  const totals = () => {
    let knownUsd = 0;
    let reservedUsd = 0;
    let runUsd = 0;
    let runKnownUsd = 0;
    let runUnknownCalls = 0;
    let unknownCalls = 0;
    for (const c of charges.values()) {
      if (typeof c.costUsd === 'number') knownUsd += c.costUsd;
      else {
        reservedUsd += c.reservedUsd;
        unknownCalls += 1;
      }
      if (c.runId === input.runId) {
        runUsd += c.costUsd ?? c.reservedUsd;
        if (typeof c.costUsd === 'number') runKnownUsd += c.costUsd;
        else runUnknownCalls += 1;
      }
    }
    return {
      knownUsd,
      reservedUsd,
      runUsd,
      unknownCalls,
      runKnownUsd,
      runUnknownCalls,
    };
  };
  return {
    reserve(reservedUsd: number, providerUsageUsd: number | null): string {
      money.positive().parse(reservedUsd);
      if (blocked) throw new Error('ATOM_RECONCILIATION_REQUIRED');
      if (
        providerUsageUsd === null ||
        !Number.isFinite(providerUsageUsd) ||
        providerUsageUsd < envelope.openingProviderUsageUsd
      ) {
        throw new Error('ATOM_PROVIDER_USAGE_UNMEASURABLE');
      }
      const t = totals();
      const charged = Math.max(
        t.knownUsd,
        providerUsageUsd - envelope.openingProviderUsageUsd,
      );
      if (
        charged + t.reservedUsd + reservedUsd > envelope.capUsd ||
        t.runUsd + reservedUsd > input.runCapUsd
      ) {
        throw new Error('ATOM_BUDGET_CAP');
      }
      const callId = randomUUID();
      appendFileSync(
        journalFile,
        JSON.stringify({
          kind: 'CALL_INTENT',
          callId,
          reservedUsd,
          runId: input.runId,
        }) + '\n',
        { flush: true },
      );
      charges.set(callId, {
        reservedUsd,
        runId: input.runId,
        costUsd: undefined,
      });
      return callId;
    },
    settle(callId: string, costUsd: number | null): void {
      const charge = charges.get(callId);
      if (!charge || charge.costUsd !== undefined)
        throw new Error('ATOM_INVALID_SETTLEMENT');
      money.nullable().parse(costUsd);
      appendFileSync(
        journalFile,
        JSON.stringify({ kind: 'SETTLED', callId, costUsd }) + '\n',
        { flush: true },
      );
      charge.costUsd = costUsd;
      if (costUsd === null || costUsd > charge.reservedUsd) blocked = true;
    },
    totals,
  };
}

/** Conservative UTF-8 input bound plus schema/envelope allowance, not prose /3.2. */
export function atomCallReservationUsd(input: {
  prompt: string;
  promptUsdPerToken: number;
  completionUsdPerToken: number;
  maxOutputTokens: number;
}): number {
  return (
    (Buffer.byteLength(input.prompt, 'utf8') + 2_048) *
      input.promptUsdPerToken +
    input.maxOutputTokens * input.completionUsdPerToken
  );
}
