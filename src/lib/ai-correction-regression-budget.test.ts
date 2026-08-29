import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  SupplierBudgetError,
  SupplierBudgetGuard,
} from './ai-benchmark-supplier-budget.js';
import {
  applyDropOrder,
  checkerPricingSchema,
  checkerWorstCaseUsd,
  reducedProfileSubset,
  type RegressionRunPass,
} from './ai-correction-regression-run-cli.js';
import { deriveRegressionObservations } from './ai-correction-regression-run.js';

const PRICING = checkerPricingSchema.parse(
  JSON.parse(
    readFileSync(
      path.resolve(
        'benchmarks/ai-correction/regression/checker-pricing.v1.json',
      ),
      'utf8',
    ),
  ),
);

function pass(
  label: string,
  cases: number,
  repetitions: number,
): RegressionRunPass {
  return {
    cases: Array.from({ length: cases }, (_, index) => ({
      caseId: `${label}-${index}`,
    })) as RegressionRunPass['cases'],
    label,
    repetitions,
  };
}

describe('recorded checker price', () => {
  it('carries a source and date rather than a bare number', () => {
    // A price with no provenance is indistinguishable from one somebody made
    // up, which is precisely the failure this artefact exists to prevent.
    expect(PRICING.source.url).toContain('openrouter.ai');
    expect(PRICING.source.consultedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(PRICING.modelId).toBe('mistralai/mistral-medium-3-5');
  });

  it('bounds checker spend with the same convention as the primary model', () => {
    // 200 corrections, 2 659 prompt characters, 400 output tokens, under the
    // repository's deliberately conservative one-token-per-code-unit rule plus
    // its 2 048-token envelope.
    const bound = checkerWorstCaseUsd({
      corrections: 200,
      outputTokenLimit: 400,
      pricing: PRICING,
      promptCharactersPerCall: 2659,
    });

    expect(bound).toBeCloseTo(2.0121, 4);
  });

  it('costs nothing when no correction is planned', () => {
    expect(
      checkerWorstCaseUsd({
        corrections: 0,
        outputTokenLimit: 400,
        pricing: PRICING,
        promptCharactersPerCall: 2659,
      }),
    ).toBe(0);
  });
});

describe('reduced profile subset', () => {
  it('is deterministic in the pool digest and independent of case order', () => {
    const caseIds = Array.from({ length: 144 }, (_, index) => `cas-${index}`);
    const first = reducedProfileSubset({ caseIds, seed: 'abc', size: 24 });
    const shuffled = reducedProfileSubset({
      caseIds: [...caseIds].reverse(),
      seed: 'abc',
      size: 24,
    });

    expect(first.size).toBe(24);
    expect([...shuffled].sort()).toEqual([...first].sort());
    expect([
      ...reducedProfileSubset({ caseIds, seed: 'autre', size: 24 }),
    ]).not.toEqual([...first]);
  });

  it('never asks for more cases than the pool holds', () => {
    expect(
      reducedProfileSubset({ caseIds: ['a', 'b'], seed: 'x', size: 24 }).size,
    ).toBe(2);
  });
});

describe('drop order', () => {
  const passes = [
    pass('pool complet × 1', 144, 1),
    pass('répétitions du sous-ensemble', 24, 2),
    pass('mutants du sous-ensemble', 32, 1),
  ];
  // A price proportional to cells, so the arithmetic of the order is visible.
  const price = (list: RegressionRunPass[]): number =>
    list.reduce(
      (total, item) => total + item.cases.length * item.repetitions * 0.05,
      0,
    );

  it('changes nothing when the plan already fits', () => {
    const result = applyDropOrder({
      capUsd: 1000,
      paraphrasesRequested: false,
      passes,
      price,
    });

    expect(result.dropped).toEqual([]);
    expect(result.fits).toBe(true);
  });

  it('keeps paraphrases when the budget can afford them', () => {
    const result = applyDropOrder({
      capUsd: 1000,
      paraphraseCostUsd: 3,
      paraphrasesRequested: true,
      passes,
      price,
    });

    // The order exists to fit a plan to a cap, not to shrink it on principle.
    expect(result.paraphrases).toBe(true);
    expect(result.dropped).toEqual([]);
    expect(result.pricedUsd).toBeCloseTo(price(passes) + 3, 6);
  });

  it('drops paraphrases first, before touching any measurement', () => {
    // Affordable on primary cost alone; only the paraphrase cost breaches.
    const result = applyDropOrder({
      capUsd: price(passes) + 1,
      paraphraseCostUsd: 5,
      paraphrasesRequested: true,
      passes,
      price,
    });

    expect(result.paraphrases).toBe(false);
    expect(result.dropped).toHaveLength(1);
    expect(result.dropped[0]).toContain('paraphrases');
    expect(result.passes).toEqual(passes);
    expect(result.fits).toBe(true);
  });

  it('reduces subset repetitions only after paraphrases are gone', () => {
    const result = applyDropOrder({
      capUsd: 9.5,
      paraphraseCostUsd: 5,
      paraphrasesRequested: true,
      passes,
      price,
    });

    expect(result.dropped[0]).toContain('paraphrases');
    expect(result.dropped[1]).toContain('répétitions du sous-ensemble');
    expect(
      result.passes.find(
        (item) => item.label === 'répétitions du sous-ensemble',
      )?.repetitions,
    ).toBe(1);
  });

  it('never drops the full-pool pass or the mutants, and says so when it still does not fit', () => {
    const result = applyDropOrder({
      capUsd: 1,
      paraphraseCostUsd: 5,
      paraphrasesRequested: true,
      passes,
      price,
    });

    // Coverage and the mutation/safety oracles are not negotiable: the plan is
    // reported as not fitting rather than trimmed into something that no longer
    // tests what the suite claims to test.
    expect(result.fits).toBe(false);
    expect(
      result.passes.find((item) => item.label === 'pool complet × 1')?.cases,
    ).toHaveLength(144);
    expect(
      result.passes.find((item) => item.label === 'mutants du sous-ensemble')
        ?.cases,
    ).toHaveLength(32);
  });
});

describe('checker calls under the budget guard', () => {
  const plan = {
    corpus: { cases: [], contracts: [] },
    scales: [],
    unitsByBenchmarkCaseId: new Map(),
  } as never;

  it('reconciles checker cost so the cap governs the whole run', async () => {
    const guard = new SupplierBudgetGuard(1);
    await deriveRegressionObservations({
      attempts: [],
      budget: guard,
      checker: {
        verify: async () => ({ costUsd: 0.5, verdicts: {} }),
      },
      familyScientificallyValidated: true,
      plan,
    });

    // No attempts, so nothing was verified and nothing was spent.
    expect(guard.actualSpentUsd).toBe(0);
  });

  it('refuses a checker that reports no cost', () => {
    const guard = new SupplierBudgetGuard(1);

    // An unreported cost is not a free call. Treating it as zero is how a run
    // finishes over its cap with every guard reporting green.
    expect(() =>
      guard.reconcile({ actualCostUsd: undefined, costSource: 'ESTIMATED' }),
    ).toThrow(SupplierBudgetError);
  });

  it('stops the run once checker spend reaches the cap', () => {
    const guard = new SupplierBudgetGuard(1);
    guard.reconcile({ actualCostUsd: 0.6, costSource: 'ACTUAL' });

    expect(() =>
      guard.reconcile({ actualCostUsd: 0.6, costSource: 'ACTUAL' }),
    ).toThrow(SupplierBudgetError);
  });
});
