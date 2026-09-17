import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openAtomBudget } from './ai-correction-atom-verifier-budget.js';
import {
  executeAtomMeasurement,
  type AtomAttempt,
} from './ai-correction-atom-verifier-execution.js';
import {
  type AtomCandidate,
  type AtomTransportResult,
} from './ai-correction-atom-verifier-transport.js';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const candidate: AtomCandidate = {
  id: 'fixture',
  modelId: 'test/model',
  price: { prompt: 0.000001, completion: 0.000005 },
  priceSource: 'fixture',
  route: { slug: 'test', provider: 'Test' },
};
const result = (): AtomTransportResult => ({
  content: '{"verdict":"direct","sentences":[],"reason":"x"}',
  costUsd: 0.001,
  errorCode: null,
  generationId: 'fixture',
  providerRoute: 'Test',
});
function setup(cap = 3) {
  const directory = mkdtempSync(path.join(tmpdir(), 'atom-execution-'));
  dirs.push(directory);
  const attempts: AtomAttempt[] = [];
  return {
    budget: openAtomBudget({
      directory,
      decisionId: 'test',
      envelopeUsd: cap,
      keyHash: 'test',
      providerUsageUsd: 0,
      runCapUsd: cap,
      runId: 'run',
    }),
    candidates: [candidate],
    cases: Array.from({ length: 8 }, (_, i) => ({
      cardId: `c${i}`,
      userMessage: 'copy',
      promptHash: 'hash',
    })),
    concurrency: 3,
    repetitions: 3,
    readUsage: async () => 0,
    persist: (attempt: AtomAttempt) => {
      attempts.push(attempt);
    },
    attempts,
  };
}

describe('qualified and bounded execution', () => {
  it('qualifies every candidate before any bulk job and keeps smoke outside observations', async () => {
    const s = setup();
    const call = vi.fn(async () => result());
    const run = await executeAtomMeasurement({
      ...s,
      candidates: [candidate, { ...candidate, id: 'second' }],
      call,
    });
    expect(s.attempts.slice(0, 2).map((a) => a.kind)).toEqual([
      'SMOKE',
      'SMOKE',
    ]);
    expect(run.observations.get(candidate.id)).toHaveLength(24);
    expect(call).toHaveBeenCalledTimes(50);
    expect(run.stopped).toBeNull();
  });
  it('does not launch a candidate queue after one failed schema smoke', async () => {
    const s = setup();
    const call = vi.fn(async () => ({
      ...result(),
      errorCode: 'MODEL_OUTPUT_SCHEMA_INVALID',
    }));
    const run = await executeAtomMeasurement({ ...s, call });
    expect(call).toHaveBeenCalledOnce();
    expect(run.observations.size).toBe(0);
    expect(run.invalidReasons.get(candidate.id)).toEqual([
      'MODEL_OUTPUT_SCHEMA_INVALID',
    ]);
  });
  it('never buys a smoke for an unverified profile', async () => {
    const s = setup();
    const call = vi.fn(async () => result());
    const run = await executeAtomMeasurement({
      ...s,
      candidates: [{ ...candidate, route: null }],
      call,
    });
    expect(call).not.toHaveBeenCalled();
    expect(run.invalidReasons.get(candidate.id)).toEqual([
      'PROFILE_UNVERIFIED',
    ]);
  });
  it('stops on missing cost without substituting zero or launching a full queue', async () => {
    const s = setup();
    const call = vi.fn(async () => ({ ...result(), costUsd: null }));
    const run = await executeAtomMeasurement({ ...s, call });
    expect(call).toHaveBeenCalledOnce();
    expect(run.stopped).toBe('ATOM_RECONCILIATION_REQUIRED');
    expect(run.totals.runUnknownCalls).toBe(1);
  });
  it('persists an unknown settlement if the injected transport throws', async () => {
    const s = setup();
    const run = await executeAtomMeasurement({
      ...s,
      call: async () => {
        throw new Error('lost');
      },
    });
    expect(run.stopped).toBe('ATOM_RECONCILIATION_REQUIRED');
    expect(s.attempts[0]?.result.costUsd).toBeNull();
  });
  it('refuses admission with a tiny cap or unmeasurable supplier usage', async () => {
    for (const s of [
      setup(0.0001),
      { ...setup(), readUsage: async () => null },
    ]) {
      const call = vi.fn(async () => result());
      const run = await executeAtomMeasurement({ ...s, call });
      expect(call).not.toHaveBeenCalled();
      expect(run.stopped).toMatch(/BUDGET_CAP|UNMEASURABLE/u);
    }
  });
  it('stops scheduling immediately on persistence failure and settles existing flights before returning', async () => {
    const s = setup();
    const call = vi.fn(async () => result());
    const run = await executeAtomMeasurement({
      ...s,
      call,
      persist: (attempt) => {
        if (attempt.kind === 'MEASUREMENT') throw new Error('disk full');
      },
    });
    expect(run.stopped).toBe('ATOM_PERSISTENCE_FAILURE');
    expect(call.mock.calls.length).toBeLessThanOrEqual(1 + s.concurrency);
    expect(run.totals.runUnknownCalls).toBe(0);
  });
  it('stops later jobs after an observed reservation overrun', async () => {
    const s = setup();
    const call = vi.fn(async () => ({ ...result(), costUsd: 1 }));
    const run = await executeAtomMeasurement({ ...s, call });
    expect(call).toHaveBeenCalledOnce();
    expect(run.stopped).toBe('ATOM_RESERVATION_EXCEEDED');
  });
});
