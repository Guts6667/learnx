import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  checkEvidenceGuards,
  type EvidenceGuardCriterion,
} from './ai-correction-evidence-guards.ts';
import {
  loadRegressionSource,
  parseRegressionPool,
} from './ai-correction-regression-pool.ts';
import { computeRegressionMetrics } from './ai-correction-regression-metrics.ts';
import {
  deriveRegressionObservations,
  planRegressionRun,
} from './ai-correction-regression-run.ts';

const RESPONSE =
  'Je recommande le pilote étendu. Le délai médian passe de 18 à 13 heures. ' +
  'Un incident a eu lieu faute de formation.';

const base = {
  responseText: RESPONSE,
  topLevelKeys: ['mastered'],
};

describe('checkEvidenceGuards', () => {
  it('flags a criterion the grader never returned', () => {
    expect(
      checkEvidenceGuards({
        ...base,
        expectedCriterionKeys: ['a', 'b'],
        returnedCriteria: [
          {
            criterionKey: 'a',
            evidenceQuotes: ['Je recommande le pilote étendu'],
            levelKey: 'mastered',
          },
        ],
      }),
    ).toEqual([{ code: 'CRITERION_ABSENT_FROM_OUTPUT', criterionKey: 'b' }]);
  });

  it('flags a top level asserted with no quote at all', () => {
    expect(
      checkEvidenceGuards({
        ...base,
        expectedCriterionKeys: ['a'],
        returnedCriteria: [
          { criterionKey: 'a', evidenceQuotes: [], levelKey: 'mastered' },
        ],
      }),
    ).toEqual([
      {
        code: 'TOP_LEVEL_WITHOUT_RESOLVED_EVIDENCE',
        criterionKey: 'a',
        levelKey: 'mastered',
      },
    ]);
  });

  it('flags a top level whose quotes do not occur in the response', () => {
    expect(
      checkEvidenceGuards({
        ...base,
        expectedCriterionKeys: ['a'],
        returnedCriteria: [
          {
            criterionKey: 'a',
            evidenceQuotes: ['une phrase que la copie ne contient pas'],
            levelKey: 'mastered',
          },
        ],
      }),
    ).toHaveLength(1);
  });

  it('accepts a top level whose quote resolves, whitespace aside', () => {
    expect(
      checkEvidenceGuards({
        ...base,
        expectedCriterionKeys: ['a'],
        returnedCriteria: [
          {
            criterionKey: 'a',
            evidenceQuotes: ['Le délai   médian passe\nde 18 à 13 heures'],
            levelKey: 'mastered',
          },
        ],
      }),
    ).toEqual([]);
  });

  it('says nothing about a level that is not the top', () => {
    expect(
      checkEvidenceGuards({
        ...base,
        expectedCriterionKeys: ['a'],
        returnedCriteria: [
          { criterionKey: 'a', evidenceQuotes: [], levelKey: 'developing' },
        ],
      }),
    ).toEqual([]);
  });

  it('reports every violation, not the first', () => {
    expect(
      checkEvidenceGuards({
        ...base,
        expectedCriterionKeys: ['a', 'b', 'c'],
        returnedCriteria: [
          { criterionKey: 'b', evidenceQuotes: [], levelKey: 'mastered' },
        ],
      }),
    ).toHaveLength(3);
  });
});

/**
 * The guards must catch the two real failures they were written for. Fixtures
 * can be made to pass; these are the bought artefacts, unchanged.
 *
 * The response text is rebuilt from the pool, not read from the attempt — an
 * attempt records what the grader said, never the copy it graded. Passing an
 * empty response would make every quote fail to resolve and every top level
 * look guilty, so the tests below also assert what the guards must NOT flag.
 */
describe('checkEvidenceGuards against the archived failures', () => {
  const REG = path.resolve('benchmarks/ai-correction/regression');
  const pool = parseRegressionPool(
    JSON.parse(
      readFileSync(path.join(REG, 'regression-pool.v1.json'), 'utf8'),
    ) as unknown,
  );
  const sources = new Map(
    pool.sources.map((source) => [
      source.path,
      loadRegressionSource(readFileSync(path.resolve(REG, source.path))),
    ]),
  );
  const plan = planRegressionRun({ pool, sources });
  const responseOf = (benchmarkCaseId: string): string => {
    const unit = plan.unitsByBenchmarkCaseId.get(benchmarkCaseId);
    if (!unit) throw new Error(`unité inconnue : ${benchmarkCaseId}`);
    return unit.responseText;
  };
  const load = (run: string) =>
    JSON.parse(
      readFileSync(path.join(REG, 'results', run, 'attempts.json'), 'utf8'),
    ) as {
      caseId: string;
      output?: { criteria: EvidenceGuardCriterion[] };
    }[];

  it('catches the criterion absent from the output', () => {
    // holdout-writing-scanner-repair-partial#SENTENCE_DELETION#uncertainty-bounds@2
    const caseId = 'regression-7981b5b0cc526343';
    const attempt = load('2026-08-31T16-42-09-070Z').find(
      (c) => c.caseId === caseId,
    );
    const returned = attempt?.output?.criteria ?? [];
    expect(returned.map((criterion) => criterion.criterionKey)).not.toContain(
      'uncertainty-bounds',
    );
    const violations = checkEvidenceGuards({
      expectedCriterionKeys: [
        ...returned.map((criterion) => criterion.criterionKey),
        'uncertainty-bounds',
      ],
      responseText: responseOf(caseId),
      returnedCriteria: returned,
      topLevelKeys: ['mastered'],
    });
    expect(violations).toContainEqual({
      code: 'CRITERION_ABSENT_FROM_OUTPUT',
      criterionKey: 'uncertainty-bounds',
    });
    // Exactly one failure here: the criteria that were returned must be clean.
    expect(violations).toHaveLength(1);
  });

  it('catches the top level awarded with no quote', () => {
    // writing-v1-decision-memo-ambiguous-borderline#SENTENCE_DELETION#comparative-arithmetic@0
    const caseId = 'regression-7e040d6d0fdd1715';
    const attempt = load('2026-09-01T14-13-17-639Z').find(
      (c) => c.caseId === caseId,
    );
    const returned = attempt?.output?.criteria ?? [];
    const target = returned.find(
      (c) => c.criterionKey === 'comparative-arithmetic',
    );
    expect(target?.levelKey).toBe('mastered');
    expect(target?.evidenceQuotes ?? []).toHaveLength(0);
    const violations = checkEvidenceGuards({
      expectedCriterionKeys: returned.map(
        (criterion) => criterion.criterionKey,
      ),
      responseText: responseOf(caseId),
      returnedCriteria: returned,
      topLevelKeys: ['mastered'],
    });
    expect(violations).toEqual([
      {
        code: 'TOP_LEVEL_WITHOUT_RESOLVED_EVIDENCE',
        criterionKey: 'comparative-arithmetic',
        levelKey: 'mastered',
      },
    ]);
  });

  it('stays silent on a top level whose quotes really do resolve', () => {
    // The other side of the guard: without this, an empty response would make
    // both tests above pass for the wrong reason.
    const attempts = load('2026-09-01T15-38-20-436Z');
    let checked = 0;
    for (const attempt of attempts) {
      const unit = plan.unitsByBenchmarkCaseId.get(attempt.caseId);
      if (!unit) continue;
      const returned = attempt.output?.criteria ?? [];
      const grounded = returned.filter(
        (criterion) =>
          criterion.levelKey === 'mastered' &&
          (criterion.evidenceQuotes ?? []).some((quote) =>
            unit.responseText
              .replace(/\s+/gu, ' ')
              .toLowerCase()
              .includes(quote.replace(/\s+/gu, ' ').trim().toLowerCase()),
          ),
      );
      if (grounded.length === 0) continue;
      const violations = checkEvidenceGuards({
        expectedCriterionKeys: grounded.map(
          (criterion) => criterion.criterionKey,
        ),
        responseText: unit.responseText,
        returnedCriteria: grounded,
        topLevelKeys: ['mastered'],
      });
      expect(violations).toEqual([]);
      checked += grounded.length;
    }
    expect(checked).toBeGreaterThan(20);
  });
});

/**
 * D0 must be a gate the run actually passes through, not a function that only
 * tests call. These drive the real observation path and the real metric.
 */
describe('D0 as an end-to-end gate', () => {
  const REG = path.resolve('benchmarks/ai-correction/regression');
  const pool = parseRegressionPool(
    JSON.parse(
      readFileSync(path.join(REG, 'regression-pool.v1.json'), 'utf8'),
    ) as unknown,
  );
  const sources = new Map(
    pool.sources.map((source) => [
      source.path,
      loadRegressionSource(readFileSync(path.resolve(REG, source.path))),
    ]),
  );
  const plan = planRegressionRun({ pool, sources });

  /** The archived attempt whose output omits a criterion the contract requires. */
  const caseId = 'regression-7981b5b0cc526343';
  const archived = (
    JSON.parse(
      readFileSync(
        path.join(REG, 'results/2026-08-31T16-42-09-070Z/attempts.json'),
        'utf8',
      ),
    ) as { caseId: string; output?: { criteria: unknown[] } }[]
  ).find((attempt) => attempt.caseId === caseId);

  it('carries the violations out of deriveRegressionObservations', async () => {
    const observations = await deriveRegressionObservations({
      attempts: [archived as never],
      familyScientificallyValidated: true,
      plan,
    });
    expect(observations).toHaveLength(1);
    const violations = observations[0]?.evidenceGuardViolations ?? [];
    expect(violations.map((violation) => violation.criterionKey)).toContain(
      'uncertainty-bounds',
    );
    expect(violations.map((violation) => violation.code)).toContain(
      'CRITERION_ABSENT_FROM_OUTPUT',
    );
  });

  it('surfaces them as a rate with a real denominator', async () => {
    const observations = await deriveRegressionObservations({
      attempts: [archived as never],
      familyScientificallyValidated: true,
      plan,
    });
    const metrics = computeRegressionMetrics({
      baselines: [],
      mutants: observations,
      scales: plan.scales,
    });
    expect(metrics.evidenceGuardViolations.denominator).toBe(1);
    expect(metrics.evidenceGuardViolations.numerator).toBe(1);
    expect(metrics.evidenceGuardViolationDetails.length).toBeGreaterThan(0);
  });

  it('reports NOT MEASURED rather than perfect when nothing was checked', () => {
    const metrics = computeRegressionMetrics({
      baselines: [{ caseId: 'x', criteria: [], repetition: 1 }],
      mutants: [],
      scales: plan.scales,
    });
    expect(metrics.evidenceGuardViolations.denominator).toBe(0);
    expect(metrics.evidenceGuardViolations.rate).toBeNull();
  });
});
