import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  acquireAtomRunLock,
  atomCallReservationUsd,
  openAtomBudget,
} from './ai-correction-atom-verifier-budget.js';

const dirs: string[] = [];
const scratch = () => {
  const d = mkdtempSync(path.join(tmpdir(), 'atom-budget-'));
  dirs.push(d);
  return d;
};
const settings = (directory: string) => ({
  directory,
  decisionId: 'approved-test',
  envelopeUsd: 3,
  keyHash: 'hash-only',
  providerUsageUsd: 50,
  runCapUsd: 3,
  runId: 'run-a',
});
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('shared research spending', () => {
  it('grants exactly one atomic lock and releases only its owner', () => {
    const d = scratch();
    const release = acquireAtomRunLock(d);
    expect(() => acquireAtomRunLock(d)).toThrow('ATOM_RUN_LOCKED');
    release();
    const again = acquireAtomRunLock(d);
    again();
  });
  it('does not steal a crashed or unreadable lock', () => {
    const d = scratch();
    acquireAtomRunLock(d);
    writeFileSync(path.join(d, 'active-run', 'owner.json'), '{}');
    expect(() => acquireAtomRunLock(d)).toThrow('ATOM_RUN_LOCKED');
  });
  it('reserves concurrent calls against the cap before any result arrives', () => {
    const b = openAtomBudget(settings(scratch()));
    const first = b.reserve(1.5, 50);
    b.reserve(1.5, 50);
    expect(() => b.reserve(0.01, 50)).toThrow('ATOM_BUDGET_CAP');
    b.settle(first, 0.5);
    expect(b.reserve(0.9, 50)).toBeTruthy();
  });
  it('counts previous runs while provider usage lags and reports this run separately', () => {
    const d = scratch();
    const a = openAtomBudget(settings(d));
    a.settle(a.reserve(2, 50), 2);
    const b = openAtomBudget({ ...settings(d), runId: 'run-b' });
    expect(() => b.reserve(1.1, 50)).toThrow('ATOM_BUDGET_CAP');
    b.settle(b.reserve(0.5, 50), 0.5);
    expect(b.totals()).toMatchObject({ knownUsd: 2.5, runKnownUsd: 0.5 });
  });
  it('also counts spend elsewhere observed by the provider and refuses missing usage', () => {
    const b = openAtomBudget(settings(scratch()));
    expect(() => b.reserve(0.5, 52.6)).toThrow('ATOM_BUDGET_CAP');
    expect(() => b.reserve(0.5, null)).toThrow('UNMEASURABLE');
    expect(() => b.reserve(0.5, 49)).toThrow('UNMEASURABLE');
    expect(() => b.reserve(0.5, Number.NaN)).toThrow('UNMEASURABLE');
  });
  it('keeps unknown cost null, blocks all next calls and survives restart', () => {
    const d = scratch();
    const b = openAtomBudget(settings(d));
    b.settle(b.reserve(1, 50), null);
    expect(b.totals()).toMatchObject({
      knownUsd: 0,
      reservedUsd: 1,
      unknownCalls: 1,
    });
    expect(readFileSync(path.join(d, 'calls.jsonl'), 'utf8')).toContain(
      '"costUsd":null',
    );
    expect(() => b.reserve(0.01, 50)).toThrow('RECONCILIATION_REQUIRED');
    expect(() => openAtomBudget(settings(d))).toThrow(
      'RECONCILIATION_REQUIRED',
    );
  });
  it('persists intent before a crash, without authorizing a repeat after restart', () => {
    const d = scratch();
    openAtomBudget(settings(d)).reserve(1, 50);
    expect(readFileSync(path.join(d, 'calls.jsonl'), 'utf8')).toContain(
      'CALL_INTENT',
    );
    expect(() => openAtomBudget(settings(d))).toThrow(
      'RECONCILIATION_REQUIRED',
    );
  });
  it('rejects different authorizations, keys, corrupt journals and duplicate settlements', () => {
    const d = scratch();
    const b = openAtomBudget(settings(d));
    expect(() => openAtomBudget({ ...settings(d), decisionId: 'new' })).toThrow(
      'CONFLICT',
    );
    expect(() => openAtomBudget({ ...settings(d), envelopeUsd: 4 })).toThrow(
      'CONFLICT',
    );
    expect(() =>
      openAtomBudget({ ...settings(d), keyHash: 'other-key' }),
    ).toThrow('CONFLICT');
    const id = b.reserve(1, 50);
    b.settle(id, 0);
    expect(() => b.settle(id, 0)).toThrow('INVALID_SETTLEMENT');
    writeFileSync(path.join(d, 'calls.jsonl'), '{truncated');
    expect(() => openAtomBudget(settings(d))).toThrow();
  });
  it('halts when the provider exceeds the reservation and honors a smaller run cap', () => {
    const b = openAtomBudget({ ...settings(scratch()), runCapUsd: 1 });
    expect(() => b.reserve(1.1, 50)).toThrow('BUDGET_CAP');
    b.settle(b.reserve(0.5, 50), 0.6);
    expect(() => b.reserve(0.1, 50)).toThrow('RECONCILIATION_REQUIRED');
  });
  it('uses the full output ceiling and UTF-8 byte allowance, never mean output', () => {
    expect(
      atomCallReservationUsd({
        prompt: 'é',
        promptUsdPerToken: 0.001,
        completionUsdPerToken: 0.01,
        maxOutputTokens: 400,
      }),
    ).toBeCloseTo(6.05);
  });
});
