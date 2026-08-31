import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  parseCheckerPromptVariant,
  parseFalseAgreeProbe,
  runFalseAgreeProbe,
} from './ai-correction-false-agree-probe.js';
import { DEFAULT_CHECKER_INSTRUCTIONS } from '../server/corrections/correction-checker.js';
import type { RegressionCheckerPort } from './ai-correction-regression-run.js';
import type { RegressionCheckerVerdict } from './ai-correction-regression-metrics.js';

const PROBE_PATH = path.resolve(
  'benchmarks/ai-correction/regression/false-agree-probe.v1.json',
);

async function loadProbe(): ReturnType<
  typeof parseFalseAgreeProbe
> extends never
  ? never
  : Promise<ReturnType<typeof parseFalseAgreeProbe>> {
  return parseFalseAgreeProbe(
    JSON.parse(await readFile(PROBE_PATH, 'utf8')) as unknown,
  );
}

function checkerAnswering(
  answer: (unitId: string) => RegressionCheckerVerdict,
  costUsd: number | null = 0.0011,
): RegressionCheckerPort {
  return {
    verify: async ({ criteria, unitId }) => ({
      costUsd,
      verdicts: Object.fromEntries(
        criteria.map((criterion) => [criterion.criterionKey, answer(unitId)]),
      ) as Record<string, RegressionCheckerVerdict>,
    }),
  };
}

describe('the designed false-agreement probe', () => {
  it('ships twenty cases, each with a reason a reader can check', async () => {
    const probe = await loadProbe();

    // The denominator this gate needs is built here, not harvested from the
    // corrector's failures the way `checker-false-agree-rate` was.
    expect(probe.cases).toHaveLength(20);
    expect(probe.expectedVerdict).toBe('DISAGREED');
    for (const probeCase of probe.cases) {
      expect(probeCase.falseBecause.length).toBeGreaterThan(20);
      expect(probeCase.quotes.length).toBeGreaterThan(0);
    }
  });

  it('counts every agreement as a false agreement', async () => {
    const probe = await loadProbe();
    const result = await runFalseAgreeProbe({
      checker: checkerAnswering(() => 'AGREED'),
      probe,
    });

    expect(result.checkerFalseAgreeDesigned).toEqual({
      denominator: 20,
      numerator: 20,
      rate: 1,
    });
    expect(result.falseAgreements).toHaveLength(20);
  });

  it('scores a verifier that refuses every false level at zero', async () => {
    const probe = await loadProbe();
    const result = await runFalseAgreeProbe({
      checker: checkerAnswering(() => 'DISAGREED'),
      probe,
    });

    expect(result.checkerFalseAgreeDesigned.numerator).toBe(0);
    expect(result.checkerFalseAgreeDesigned.rate).toBe(0);
  });

  it('excludes a verifier that could not answer instead of crediting it', async () => {
    // A verifier that is down must never read as a verifier that says no: that
    // would score an outage as perfect vigilance.
    const probe = await loadProbe();
    const result = await runFalseAgreeProbe({
      checker: checkerAnswering((unitId) =>
        unitId.startsWith('arith') ? 'UNAVAILABLE' : 'DISAGREED',
      ),
      probe,
    });

    expect(result.unavailable).toHaveLength(5);
    expect(result.checkerFalseAgreeDesigned.denominator).toBe(15);
    expect(result.checkerFalseAgreeDesigned.rate).toBe(0);
  });

  it('reports an unpriced call rather than failing on it', async () => {
    const probe = await loadProbe();
    const result = await runFalseAgreeProbe({
      checker: checkerAnswering(() => 'DISAGREED', null),
      probe,
    });

    expect(result.unpricedCalls).toHaveLength(20);
    expect(result.costUsd).toBe(0);
  });

  it('refuses a probe with a duplicated case identifier', () => {
    expect(() =>
      parseFalseAgreeProbe({
        cases: [
          {
            criterionKey: 'k',
            criterionLabel: 'K',
            falseBecause: 'raison',
            id: 'same',
            levelDescription: 'd',
            levelKey: 'mastered',
            levelLabel: 'M',
            quotes: ['q'],
          },
          {
            criterionKey: 'k',
            criterionLabel: 'K',
            falseBecause: 'raison',
            id: 'same',
            levelDescription: 'd',
            levelKey: 'mastered',
            levelLabel: 'M',
            quotes: ['q'],
          },
        ],
        expectedVerdict: 'DISAGREED',
        language: 'fr-FR',
        note: 'n',
        probeId: 'p',
        schemaVersion: 1,
      }),
    ).toThrow(/dupliqué/);
  });
});

describe('the checker prompt variants', () => {
  async function loadVariant(id: string) {
    return parseCheckerPromptVariant(
      JSON.parse(
        await readFile(
          path.resolve(
            `benchmarks/ai-correction/regression/checker-prompts/${id}.json`,
          ),
          'utf8',
        ),
      ) as unknown,
    );
  }

  it('keeps variant A byte-identical to the instructions production sends', async () => {
    // A is the reference the others are compared against. If it drifts from the
    // runtime prompt, every measurement attributed to "the current prompt"
    // silently describes a prompt nobody runs — the failure this test exists
    // to make impossible.
    const variantA = await loadVariant('A');
    expect(variantA.instructions).toEqual([...DEFAULT_CHECKER_INSTRUCTIONS]);
  });

  it('makes B refuse by default where A accepts by default', async () => {
    const variantB = await loadVariant('B');
    const text = variantB.instructions.join(' ');

    // The whole difference: A asks whether the quote supports the level, which
    // a lenient model answers yes to. B asks for the reason it would be false
    // and only allows yes when none holds.
    expect(text).toMatch(/raison pour laquelle le niveau retenu serait faux/);
    expect(text).toMatch(/true seulement si aucune ne tient/);
    expect(text).toMatch(/Le doute n'est pas un accord/);
    // And it still withholds the learner's production, like A.
    expect(text).toMatch(/ne suppose rien au-delà des citations fournies/);
  });
});
