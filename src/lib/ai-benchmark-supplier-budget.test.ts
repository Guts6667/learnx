import { describe, expect, it } from 'vitest';

import {
  conservativeSupplierCallCostUsd,
  SupplierBudgetError,
  SupplierBudgetGuard,
} from './ai-benchmark-supplier-budget.js';

describe('benchmark supplier budget guard', () => {
  it('reserves a conservative next-call envelope before dispatch', () => {
    expect(
      conservativeSupplierCallCostUsd({
        completionUsdPerToken: 0.000015,
        promptCharacters: 8_000,
        promptUsdPerToken: 0.000003,
        schemaCharacters: 4_000,
        totalOutputTokenLimit: 1_500,
      }),
    ).toBeCloseTo(0.064644, 10);
  });

  it('blocks a dispatch that could cross the hard cap', () => {
    const guard = new SupplierBudgetGuard(0.1);
    guard.reconcile({ actualCostUsd: 0.06, costSource: 'ACTUAL' });
    expect(() => guard.assertCanDispatch(0.05)).toThrow(
      new SupplierBudgetError('SUPPLIER_BUDGET_CAP_WOULD_BE_EXCEEDED'),
    );
  });

  it('blocks continuation when supplier cost is not reconciled', () => {
    const guard = new SupplierBudgetGuard(1);
    expect(() => guard.reconcile({ costSource: 'ESTIMATED' })).toThrow(
      new SupplierBudgetError('SUPPLIER_COST_RECONCILIATION_REQUIRED'),
    );
  });
});
