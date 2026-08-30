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
import { computeRunSecurityRates } from './ai-correction-regression-run.js';

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

describe('evidence hallucination wiring (V4.5-127)', () => {
  /**
   * The gate was declared BLOCKING and never reached the table: its metric was
   * absent, so the evaluator filed a policy error and skipped it. Promotion was
   * correctly refused, but the printed table showed eleven gates against a
   * twelve-gate policy and said nothing about the twelfth. A blocking gate that
   * vanishes is worse than one that reads red.
   *
   * These tests hold the two properties the wiring has to keep: an omitted
   * convention leaves the gate unmeasured rather than passing it on a
   * fabricated zero, and the two conventions are genuinely different questions.
   */
  const CASE_TEXT = 'Le rapport mesure la durée réelle des trajets.';

  function cell(input: {
    attemptNumber: number;
    caseId: string;
    errorCode?: string;
    status: 'VALID' | 'INVALID';
  }): BenchmarkAttempt {
    return {
      attempt: input.attemptNumber,
      candidateId: 'cand',
      caseId: input.caseId,
      repetition: 1,
      status: input.status,
      ...(input.errorCode === undefined ? {} : { errorCode: input.errorCode }),
    } as BenchmarkAttempt;
  }

  const plan = {
    corpus: { cases: [{ caseId: 'a', responseText: CASE_TEXT }] },
    unitsByBenchmarkCaseId: new Map(),
  } as unknown as Parameters<typeof computeRunSecurityRates>[0]['plan'];

  const rejectedThenRecovered = [
    cell({
      attemptNumber: 1,
      caseId: 'a',
      errorCode: 'MODEL_EVIDENCE_NOT_FOUND',
      status: 'INVALID',
    }),
    cell({ attemptNumber: 2, caseId: 'a', status: 'VALID' }),
  ];

  it('leaves the gate unmeasured when no convention is chosen', () => {
    const rates = computeRunSecurityRates({
      attempts: rejectedThenRecovered,
      observations: [],
      plan,
    });

    // Not a zero. A fabricated zero would read as a pass on a blocking gate.
    expect(rates.evidenceHallucination.denominator).toBe(0);
    expect(rates.evidenceHallucination.rate).toBeNull();
  });

  it('counts a rejected first attempt under the any-attempt convention', () => {
    const rates = computeRunSecurityRates({
      attempts: rejectedThenRecovered,
      gatePolicyV2: false,
      observations: [],
      plan,
    });

    expect(rates.evidenceHallucination.numerator).toBe(1);
    expect(rates.evidenceHallucination.denominator).toBe(1);
  });

  it('does not count it under the delivered convention, because nobody received it', () => {
    const rates = computeRunSecurityRates({
      attempts: rejectedThenRecovered,
      gatePolicyV2: true,
      observations: [],
      plan,
    });

    expect(rates.evidenceHallucination.numerator).toBe(0);
    expect(rates.evidenceHallucination.denominator).toBe(1);
  });

  it('excludes incoherently numbered cells instead of renumbering them', () => {
    // Two attempts both numbered 1: the V4.5-127 defect's signature. The
    // artefact cannot say which came first, so it cannot say what was
    // delivered — and inventing an order would invent the answer.
    const rates = computeRunSecurityRates({
      attempts: [
        cell({ attemptNumber: 1, caseId: 'a', status: 'VALID' }),
        cell({ attemptNumber: 1, caseId: 'a', status: 'VALID' }),
      ],
      gatePolicyV2: true,
      observations: [],
      plan,
    });

    expect(rates.malformedCells).toHaveLength(1);
    expect(rates.evidenceHallucination.denominator).toBe(0);
  });
});
