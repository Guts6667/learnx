import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { mkdir } from 'node:fs/promises';

import {
  acquireRunLock,
  appendSpendEnvelope,
  ledgerSpendSince,
  capForRun,
  envelopeState,
  nextSpendEnvelopeFile,
  processIsAlive,
  readSpendEnvelope,
  readSpendEnvelopeChain,
  reconcileEnvelopeDeclaration,
  RegressionEnvelopeError,
  releaseRunLock,
  resolveEnvelopeHead,
  RUN_LOCK_FILE,
  writeSpendEnvelope,
  type SpendEnvelope,
} from './ai-correction-regression-envelope.js';

async function scratch(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'regression-envelope-'));
}

const ENVELOPE: SpendEnvelope = {
  decisionId: 'owner-121-budget-2026-08-29',
  envelopeUsd: 13,
  openedAt: '2026-08-29T20:00:00.000Z',
  openingProviderUsageUsd: 28.45,
  schemaVersion: 1,
};

describe('run lock', () => {
  it('refuses a second run while the first is alive', async () => {
    const directory = await scratch();
    const first = await acquireRunLock({
      directory,
      pid: 4242,
      processIsAlive: () => true,
      resultsDirectory: '/results/first',
    });
    const second = await acquireRunLock({
      directory,
      pid: 4343,
      processIsAlive: () => true,
      resultsDirectory: '/results/second',
    });

    // The incident this exists for: a command pasted twice, two runs, two caps.
    expect(first.acquired).toBe(true);
    expect(second.acquired).toBe(false);
    expect(second.acquired === false && second.heldBy.pid).toBe(4242);
    expect(second.acquired === false && second.heldBy.resultsDirectory).toBe(
      '/results/first',
    );
  });

  // Note for anyone extending these: a lock test that supplies an invented pid
  // exercises the stale-takeover path, never the refusal, because an invented
  // pid is not alive. Refusal tests must use a pid that genuinely exists.
  it('takes over a lock whose process is gone, and says it did', async () => {
    const directory = await scratch();
    await acquireRunLock({
      directory,
      pid: 4242,
      processIsAlive: () => true,
      resultsDirectory: '/results/dead',
    });

    const next = await acquireRunLock({
      directory,
      pid: 5555,
      processIsAlive: () => false,
      resultsDirectory: '/results/next',
    });

    // A killed run must not block the next one for ever; the takeover is
    // reported so the caller can record that a run died without releasing.
    expect(next.acquired).toBe(true);
    expect(next.acquired === true && next.tookOverStaleLock?.pid).toBe(4242);
  });

  it('releases the lock and tolerates releasing twice', async () => {
    const directory = await scratch();
    await acquireRunLock({
      directory,
      pid: 1,
      processIsAlive: () => true,
      resultsDirectory: '/results/x',
    });

    await releaseRunLock(directory);
    await expect(releaseRunLock(directory)).resolves.toBeUndefined();
    await expect(
      readFile(path.join(directory, RUN_LOCK_FILE), 'utf8'),
    ).rejects.toThrow();
  });

  it('reports this process as alive and a plainly dead pid as not', () => {
    expect(processIsAlive(process.pid)).toBe(true);
    // Signalling a process that cannot exist yields ESRCH, not EPERM.
    expect(
      processIsAlive(1, () => {
        const error = new Error('no such process') as Error & { code: string };
        error.code = 'ESRCH';
        throw error;
      }),
    ).toBe(false);
  });
});

describe('spend envelope', () => {
  it('measures spend as the provider delta since the envelope opened', () => {
    const state = envelopeState({
      envelope: ENVELOPE,
      providerUsageUsd: 31.06,
    });

    // A local counter cannot see another process; the provider's total can.
    expect(state.spentUsd).toBeCloseTo(2.61, 2);
    expect(state.remainingUsd).toBeCloseTo(10.39, 2);
    expect(state.spentSource).toBe('PROVIDER_DELTA');
  });

  it('falls back to the local ledger when the provider figure has not moved', () => {
    // Observed on 30 August 2026: OpenRouter's total_usage did not move at all
    // in the minutes after fifteen paid calls. A provider delta alone would
    // have reported zero spend however much a run bought — an envelope that
    // always looks empty is worse than none, because it reassures.
    const state = envelopeState({
      envelope: ENVELOPE,
      ledgerSpentUsd: 0.9375,
      providerUsageUsd: ENVELOPE.openingProviderUsageUsd,
    });

    expect(state.spentUsd).toBeCloseTo(0.9375, 4);
    expect(state.spentSource).toBe('LEDGER');
  });

  it('prefers the provider figure when it exceeds the local ledger', () => {
    // The provider sees other machines; the ledger sees only this one.
    const state = envelopeState({
      envelope: ENVELOPE,
      ledgerSpentUsd: 0.5,
      providerUsageUsd: 31.06,
    });

    expect(state.spentUsd).toBeCloseTo(2.61, 2);
    expect(state.spentSource).toBe('PROVIDER_DELTA');
  });

  it('reports nothing measurable when the provider cannot be read', () => {
    const state = envelopeState({ envelope: ENVELOPE, providerUsageUsd: null });

    expect(state.spentUsd).toBeNull();
    expect(state.remainingUsd).toBeNull();
  });

  it('refuses to authorise anything against an unmeasurable envelope', () => {
    // An envelope that cannot be measured is not an envelope with room — and
    // the local ledger does not rescue it, because a ledger cannot see another
    // machine. A floor is not a measurement.
    expect(() =>
      capForRun({
        requestedCapUsd: 5,
        state: envelopeState({
          envelope: ENVELOPE,
          ledgerSpentUsd: 0.5,
          providerUsageUsd: null,
        }),
      }),
    ).toThrow(RegressionEnvelopeError);
  });

  it('refuses when the envelope is exhausted', () => {
    expect(() =>
      capForRun({
        requestedCapUsd: 5,
        state: envelopeState({ envelope: ENVELOPE, providerUsageUsd: 41.45 }),
      }),
    ).toThrow(/EXHAUSTED/);
  });

  it('keeps a cap that fits, and reduces one that does not', () => {
    const roomy = capForRun({
      requestedCapUsd: 5,
      state: envelopeState({ envelope: ENVELOPE, providerUsageUsd: 30 }),
    });
    const tight = capForRun({
      requestedCapUsd: 12,
      state: envelopeState({ envelope: ENVELOPE, providerUsageUsd: 38 }),
    });

    expect(roomy.capUsd).toBe(5);
    // 13 − (38 − 28.45) = 3.45 left: the last run of an envelope still happens,
    // at whatever room remains, rather than being refused outright.
    expect(tight.capUsd).toBeCloseTo(3.45, 2);
    expect(tight.reason).toContain('reste de');
  });

  it('never reports negative spend when usage appears to go backwards', () => {
    const state = envelopeState({
      envelope: ENVELOPE,
      providerUsageUsd: 28.0,
    });

    expect(state.spentUsd).toBe(0);
  });

  it('round-trips an opened envelope', async () => {
    const directory = await scratch();
    await writeSpendEnvelope({ directory, envelope: ENVELOPE });

    expect(await readSpendEnvelope(directory)).toEqual(ENVELOPE);
  });

  it('reports no envelope when none has been opened', async () => {
    expect(await readSpendEnvelope(await scratch())).toBeUndefined();
  });

  it('refuses a malformed envelope rather than guessing', async () => {
    const directory = await scratch();
    await writeFile(
      path.join(directory, 'spend-envelope.v1.json'),
      JSON.stringify({ envelopeUsd: 'beaucoup', schemaVersion: 1 }),
      'utf8',
    );

    await expect(readSpendEnvelope(directory)).rejects.toThrow();
  });
});

describe('ledger spend since the envelope opened', () => {
  async function withLedgers(
    entries: { costs: number[]; name: string }[],
  ): Promise<string> {
    const directory = await scratch();
    for (const entry of entries) {
      const target = path.join(directory, 'results', entry.name);
      await mkdir(target, { recursive: true });
      await writeFile(
        path.join(target, 'ledger.jsonl'),
        entry.costs
          .map((costUsd) => JSON.stringify({ costUsd, status: 'VALID' }))
          .join('\n'),
        'utf8',
      );
    }
    return directory;
  }

  it('sums only the runs at or after the opening instant', async () => {
    const directory = await withLedgers([
      { costs: [1.5], name: '2026-08-29T10-00-00-000Z' },
      { costs: [0.25, 0.25], name: '2026-08-30T10-00-00-000Z' },
    ]);

    // Directory names are sortable ISO stamps, so the comparison is a string
    // comparison rather than a parse.
    const total = await ledgerSpendSince({
      directory,
      openedAt: '2026-08-30T00:00:00.000Z',
    });

    expect(total).toBeCloseTo(0.5, 6);
  });

  it('reports nothing when no run has happened yet', async () => {
    expect(
      await ledgerSpendSince({
        directory: await scratch(),
        openedAt: '2026-08-30T00:00:00.000Z',
      }),
    ).toBe(0);
  });

  it('keeps the sum when an interrupted run left a truncated final line', async () => {
    const directory = await scratch();
    const target = path.join(directory, 'results', '2026-08-30T10-00-00-000Z');
    await mkdir(target, { recursive: true });
    await writeFile(
      path.join(target, 'ledger.jsonl'),
      `${JSON.stringify({ costUsd: 0.4 })}\n{"costUsd":0.3`,
      'utf8',
    );

    // A run killed mid-write must not cost the accounting every line before it.
    expect(
      await ledgerSpendSince({
        directory,
        openedAt: '2026-08-30T00:00:00.000Z',
      }),
    ).toBeCloseTo(0.4, 6);
  });

  it('charges a call once when a resumed run copies it into its own ledger', async () => {
    // The 30 August top-up. A resumed run writes the attempts it inherited into
    // its own ledger, so summing files charged the same provider calls twice:
    // the envelope read 8.4777 USD spent when 4.6854 had been, cut the cap from
    // 7 to 5.5223, and refused a 1.6778 USD top-up it could in fact afford.
    const directory = await scratch();
    const call = {
      attempt: 1,
      candidateId: 'primary',
      caseId: 'case-a',
      costSource: 'ACTUAL',
      costUsd: 2,
      latencyMs: 1200,
      repetition: 1,
    };
    for (const name of [
      '2026-08-30T00-00-00-000Z',
      '2026-08-30T14-00-00-000Z',
    ]) {
      const target = path.join(directory, 'results', name);
      await mkdir(target, { recursive: true });
      await writeFile(
        path.join(target, 'ledger.jsonl'),
        `${JSON.stringify(call)}\n`,
        'utf8',
      );
    }

    expect(
      await ledgerSpendSince({
        directory,
        openedAt: '2026-08-29T00:00:00.000Z',
      }),
    ).toBeCloseTo(2, 6);
  });

  it('keeps two real calls that share a cell but differ in what they cost', async () => {
    // The repetition-offset defect left 24 cells carrying two attempts both
    // numbered 1. They are two provider calls and two charges; merging them
    // would understate the spend, which is the dangerous direction for a cap.
    const directory = await scratch();
    const target = path.join(directory, 'results', '2026-08-30T10-00-00-000Z');
    await mkdir(target, { recursive: true });
    const base = {
      attempt: 1,
      candidateId: 'primary',
      caseId: 'case-a',
      costSource: 'ACTUAL',
      repetition: 1,
    };
    await writeFile(
      path.join(target, 'ledger.jsonl'),
      `${JSON.stringify({ ...base, costUsd: 0.02, latencyMs: 900 })}\n${JSON.stringify({ ...base, costUsd: 0.03, latencyMs: 1500 })}\n`,
      'utf8',
    );

    expect(
      await ledgerSpendSince({
        directory,
        openedAt: '2026-08-30T00:00:00.000Z',
      }),
    ).toBeCloseTo(0.05, 6);
  });

  it('still matches a carried-over call after the ledger gains a field', async () => {
    // Writing the verifier's calls into the ledger added `role` to every line.
    // A whole-record key would have stopped matching the entries a resumed run
    // inherits from a directory written before the change, and the envelope
    // would have charged them a second time — the exact defect the dedupe was
    // written to stop, reintroduced by a field.
    const directory = await scratch();
    const before = {
      attempt: 1,
      candidateId: 'primary',
      caseId: 'case-a',
      costSource: 'ACTUAL',
      costUsd: 2,
      latencyMs: 1200,
      repetition: 1,
    };
    const after = { ...before, role: 'PRIMARY', status: 'VALID' };
    for (const [name, entry] of [
      ['2026-08-30T00-00-00-000Z', before],
      ['2026-08-30T14-00-00-000Z', after],
    ] as const) {
      const target = path.join(directory, 'results', name);
      await mkdir(target, { recursive: true });
      await writeFile(
        path.join(target, 'ledger.jsonl'),
        `${JSON.stringify(entry)}\n`,
        'utf8',
      );
    }

    expect(
      await ledgerSpendSince({
        directory,
        openedAt: '2026-08-29T00:00:00.000Z',
      }),
    ).toBeCloseTo(2, 6);
  });

  it('counts a verifier call, and counts it once', async () => {
    // The verifier's spend reconciled into the cap and reached no artefact the
    // envelope reads, so the envelope tracked the primary's bill while the run
    // paid both. 0.1906 USD unrecorded on the 30 August top-up.
    const directory = await scratch();
    const target = path.join(directory, 'results', '2026-08-30T10-00-00-000Z');
    await mkdir(target, { recursive: true });
    const call = {
      call: 1,
      costSource: 'ACTUAL',
      costUsd: 0.0012,
      modelId: 'mistralai/mistral-medium-3-5',
      role: 'CHECKER',
      unitId: 'unit-a',
    };
    await writeFile(
      path.join(target, 'ledger.jsonl'),
      `${JSON.stringify(call)}\n${JSON.stringify(call)}\n${JSON.stringify({ ...call, unitId: 'unit-b' })}\n`,
      'utf8',
    );

    expect(
      await ledgerSpendSince({
        directory,
        openedAt: '2026-08-30T00:00:00.000Z',
      }),
    ).toBeCloseTo(0.0024, 6);
  });

  it('ignores a results directory that never wrote a ledger', async () => {
    const directory = await scratch();
    await mkdir(path.join(directory, 'results', '2026-08-30T11-00-00-000Z'), {
      recursive: true,
    });

    expect(
      await ledgerSpendSince({
        directory,
        openedAt: '2026-08-30T00:00:00.000Z',
      }),
    ).toBe(0);
  });
});

/**
 * Replacing an envelope (V4.5-210).
 *
 * The bug these cover: `spend-envelope.v1.json` from a 30 August decision
 * pre-empted whatever the command line declared, so `--envelope-usd` and
 * `--envelope-decision` were parsed and discarded and a fresh owner decision
 * governed nothing. A control that quietly loses its input is not a control —
 * it is the 29 August failure again, wearing the shape of a safeguard.
 */
describe('envelope supersession', () => {
  const FIRST: SpendEnvelope = {
    decisionId: 'owner-125-budget-2026-08-30',
    envelopeUsd: 14,
    openedAt: '2026-08-30T00:33:25.311Z',
    openingProviderUsageUsd: 30.129581797,
    schemaVersion: 1,
  };
  const SECOND: SpendEnvelope = {
    decisionId: 'owner-210-budget-2026-08-31',
    envelopeUsd: 25,
    openedAt: '2026-08-31T12:00:00.000Z',
    openingProviderUsageUsd: 36.5,
    schemaVersion: 1,
    supersedes: 'owner-125-budget-2026-08-30',
  };

  async function directoryWith(envelopes: SpendEnvelope[]): Promise<string> {
    const directory = await scratch();
    for (const envelope of envelopes) {
      await appendSpendEnvelope({ directory, envelope });
    }
    return directory;
  }

  it('takes the head of the chain, not the first file on disk', async () => {
    const directory = await directoryWith([FIRST, SECOND]);
    const chain = await readSpendEnvelopeChain(directory);

    expect(chain).toHaveLength(2);
    // The one nobody supersedes, whatever order the files were written in.
    expect(resolveEnvelopeHead(chain)?.decisionId).toBe(SECOND.decisionId);
    expect(resolveEnvelopeHead(chain)?.envelopeUsd).toBe(25);
  });

  it('keeps the superseded envelope readable as the record of what was authorised', async () => {
    const directory = await directoryWith([FIRST, SECOND]);

    // Append-only: replacing an authorisation must not erase it. The old file
    // is still there and still parses; it is simply never applied again.
    expect(await readSpendEnvelope(directory)).toEqual(FIRST);
    expect(
      (await readSpendEnvelopeChain(directory)).map(
        (envelope) => envelope.decisionId,
      ),
    ).toEqual([FIRST.decisionId, SECOND.decisionId]);
  });

  it('writes a new file rather than over the old one', async () => {
    expect(nextSpendEnvelopeFile([])).toBe('spend-envelope.v1.json');
    expect(nextSpendEnvelopeFile(['spend-envelope.v1.json'])).toBe(
      'spend-envelope.v2.json',
    );
    // Gaps and unrelated names do not confuse it: the next version is one past
    // the highest, so nothing already written can be landed on.
    expect(
      nextSpendEnvelopeFile([
        'spend-envelope.v1.json',
        'spend-envelope.v7.json',
        'ledger.jsonl',
      ]),
    ).toBe('spend-envelope.v8.json');
  });

  it('reuses the envelope in force when the command line agrees with it', () => {
    expect(
      reconcileEnvelopeDeclaration({
        declared: {
          decisionId: SECOND.decisionId,
          envelopeUsd: 25,
          supersedes: undefined,
        },
        head: SECOND,
      }),
    ).toEqual({ action: 'REUSE', envelope: SECOND });
  });

  it('opens one when nothing is on disk', () => {
    expect(
      reconcileEnvelopeDeclaration({
        declared: {
          decisionId: FIRST.decisionId,
          envelopeUsd: 14,
          supersedes: undefined,
        },
        head: undefined,
      }).action,
    ).toBe('OPEN');
  });

  it('supersedes only on a new decision that names the one it replaces', () => {
    expect(
      reconcileEnvelopeDeclaration({
        declared: {
          decisionId: SECOND.decisionId,
          envelopeUsd: 25,
          supersedes: FIRST.decisionId,
        },
        head: FIRST,
      }).action,
    ).toBe('SUPERSEDE');
  });

  it('refuses a disagreement instead of preferring either side', () => {
    // The heart of it. Silently keeping the stored envelope is the bug being
    // fixed; silently taking the flags would be worse, since a typo would then
    // raise the ceiling. The refusal names both so the reader can see what it
    // is choosing between.
    let thrown: unknown;
    try {
      reconcileEnvelopeDeclaration({
        declared: {
          decisionId: 'owner-210-budget-2026-08-31',
          envelopeUsd: 25,
          supersedes: undefined,
        },
        head: FIRST,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(RegressionEnvelopeError);
    const message = (thrown as Error).message;
    expect(message).toContain('owner-125-budget-2026-08-30');
    expect(message).toContain('owner-210-budget-2026-08-31');
    expect(message).toContain('14');
    expect(message).toContain('25');
    expect(message).toContain('--envelope-supersedes');
  });

  it('refuses one decision carrying two amounts', () => {
    // Same identifier, different ceiling: one of the two is not the owner's
    // decision, and there is no way to tell which from here.
    expect(() =>
      reconcileEnvelopeDeclaration({
        declared: {
          decisionId: FIRST.decisionId,
          envelopeUsd: 40,
          supersedes: undefined,
        },
        head: FIRST,
      }),
    ).toThrow(/AMOUNT_CONFLICT/);
  });

  it('refuses a chain that does not resolve to one head', async () => {
    // Two envelopes replacing the same one, or a reference to something absent:
    // both are an authorisation history nobody can read, so neither is applied.
    const forked: SpendEnvelope = {
      ...SECOND,
      decisionId: 'owner-210-bis',
      openedAt: '2026-08-31T13:00:00.000Z',
    };
    const directory = await directoryWith([FIRST, SECOND, forked]);
    await expect(
      readSpendEnvelopeChain(directory).then(resolveEnvelopeHead),
    ).rejects.toThrow(/SUPERSEDES_FORKED/);

    const dangling = await directoryWith([
      { ...SECOND, supersedes: 'owner-nobody-ever-decided' },
    ]);
    await expect(
      readSpendEnvelopeChain(dangling).then(resolveEnvelopeHead),
    ).rejects.toThrow(/SUPERSEDES_UNKNOWN/);
  });

  it('reports no envelope at all when the directory holds none', async () => {
    expect(
      resolveEnvelopeHead(await readSpendEnvelopeChain(await scratch())),
    ).toBeUndefined();
  });
});
