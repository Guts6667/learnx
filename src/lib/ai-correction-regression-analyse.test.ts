import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { BenchmarkAttempt } from './ai-correction-benchmark-artifacts.js';
import {
  finalAttemptPerCell,
  percentileOf,
  readRunArtifacts,
} from './ai-correction-regression-analyse.js';

function attempt(
  overrides: Partial<BenchmarkAttempt> & {
    attempt: number;
    caseId: string;
    repetition: number;
  },
): BenchmarkAttempt {
  return {
    candidateId: 'cand',
    status: 'VALID',
    ...overrides,
  } as BenchmarkAttempt;
}

describe('finalAttemptPerCell', () => {
  /**
   * The unusable rate is about learners, not calls.
   *
   * With `maxRetries: 1` a cell that failed once and succeeded on retry has two
   * attempts, and the learner received a correction. Counting attempts would
   * have reported the promoted identity at roughly 9.7% unusable (21/216) when
   * the figure that matters is 2.27% (4/176). Both numbers are true of
   * different things; only one of them is the gate.
   */
  it('keeps the last attempt of a retried cell, not the failed first', () => {
    const cells = finalAttemptPerCell([
      attempt({ attempt: 1, caseId: 'a', repetition: 1, status: 'INVALID' }),
      attempt({ attempt: 2, caseId: 'a', repetition: 1, status: 'VALID' }),
    ]);

    expect(cells).toHaveLength(1);
    expect(cells[0]?.status).toBe('VALID');
  });

  it('reports a cell that never recovered as unusable', () => {
    const cells = finalAttemptPerCell([
      attempt({ attempt: 1, caseId: 'a', repetition: 1, status: 'INVALID' }),
      attempt({ attempt: 2, caseId: 'a', repetition: 1, status: 'INVALID' }),
    ]);

    expect(cells).toHaveLength(1);
    expect(cells[0]?.status).toBe('INVALID');
  });

  it('treats the same case at different repetitions as different cells', () => {
    // The stability oracle depends on this: repetition 2 is a second
    // observation, never an overwrite of the first.
    expect(
      finalAttemptPerCell([
        attempt({ attempt: 1, caseId: 'a', repetition: 1 }),
        attempt({ attempt: 1, caseId: 'a', repetition: 2 }),
      ]),
    ).toHaveLength(2);
  });
});

describe('percentileOf', () => {
  it('returns null on an empty sample rather than a fabricated zero', () => {
    expect(percentileOf([], 0.9)).toBeNull();
  });

  it('picks the value at the requested fraction', () => {
    const sample = [5, 1, 4, 2, 3];
    expect(percentileOf(sample, 0.5)).toBe(3);
    expect(percentileOf(sample, 0.9)).toBe(5);
  });

  it('never runs past the end of the sample', () => {
    expect(percentileOf([1, 2], 1)).toBe(2);
  });
});

describe('readRunArtifacts', () => {
  it('re-keys persisted verdicts so nothing is re-bought', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'analyse-'));
    await writeFile(path.join(directory, 'attempts.json'), '[]');
    await writeFile(
      path.join(directory, 'checker-verdicts.json'),
      JSON.stringify([
        {
          criterionKey: 'context-fidelity',
          unitId: 'unit-1',
          verdict: 'AGREED',
        },
      ]),
    );

    const { verdicts } = await readRunArtifacts(directory);
    expect(verdicts.size).toBe(1);
    expect([...verdicts.values()]).toEqual(['AGREED']);
  });

  it('reads a run that died before any verdict was written', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'analyse-'));
    await writeFile(path.join(directory, 'attempts.json'), '[]');

    const { attempts, verdicts } = await readRunArtifacts(directory);
    expect(attempts).toEqual([]);
    expect(verdicts.size).toBe(0);
  });
});
