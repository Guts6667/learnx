export interface SupplierBudgetUsage {
  actualCostUsd?: number;
  costSource: 'ACTUAL' | 'ESTIMATED';
}

export class SupplierBudgetError extends Error {
  public constructor(
    public readonly code:
      | 'SUPPLIER_BUDGET_CAP_WOULD_BE_EXCEEDED'
      | 'SUPPLIER_COST_RECONCILIATION_REQUIRED',
  ) {
    super(code);
    this.name = 'SupplierBudgetError';
  }
}

export class SupplierBudgetGuard {
  private spentUsd = 0;

  public constructor(public readonly hardCapUsd: number) {
    if (!Number.isFinite(hardCapUsd) || hardCapUsd <= 0) {
      throw new Error('SUPPLIER_BUDGET_CAP_INVALID');
    }
  }

  public get actualSpentUsd(): number {
    return this.spentUsd;
  }

  public assertCanDispatch(worstCaseNextUsd: number): void {
    if (!Number.isFinite(worstCaseNextUsd) || worstCaseNextUsd < 0) {
      throw new Error('SUPPLIER_BUDGET_NEXT_CALL_BOUND_INVALID');
    }
    if (this.spentUsd + worstCaseNextUsd > this.hardCapUsd) {
      throw new SupplierBudgetError('SUPPLIER_BUDGET_CAP_WOULD_BE_EXCEEDED');
    }
  }

  public reconcile(usage: SupplierBudgetUsage | undefined): void {
    if (
      usage?.costSource !== 'ACTUAL' ||
      usage.actualCostUsd === undefined ||
      !Number.isFinite(usage.actualCostUsd) ||
      usage.actualCostUsd < 0
    ) {
      throw new SupplierBudgetError('SUPPLIER_COST_RECONCILIATION_REQUIRED');
    }
    this.spentUsd += usage.actualCostUsd;
    if (this.spentUsd > this.hardCapUsd) {
      throw new SupplierBudgetError('SUPPLIER_BUDGET_CAP_WOULD_BE_EXCEEDED');
    }
  }
}

export function conservativeSupplierCallCostUsd(input: {
  completionUsdPerToken: number;
  promptCharacters: number;
  promptUsdPerToken: number;
  schemaCharacters: number;
  totalOutputTokenLimit: number;
}): number {
  const values = Object.values(input);
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error('SUPPLIER_BUDGET_COST_INPUT_INVALID');
  }

  // One UTF-16 code unit per token plus a fixed envelope is deliberately more
  // conservative than normal tokenisation. The bound includes the structured
  // output schema, which is also billed as prompt context by providers.
  const promptTokenUpperBound =
    input.promptCharacters + input.schemaCharacters + 2_048;
  return (
    promptTokenUpperBound * input.promptUsdPerToken +
    input.totalOutputTokenLimit * input.completionUsdPerToken
  );
}
