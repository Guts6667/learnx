import type {
  CalculatedQuotePrice,
  CompositeProviderCallCost,
  CompositeSettlementPreview,
  PricingEntrySnapshot,
} from './ai-pricing-types.js';
import { AiPricingError } from './ai-pricing-types.js';

function maxBigInt(...values: bigint[]): bigint {
  return values.reduce((maximum, value) => (value > maximum ? value : maximum));
}

function multiplyAndCeil(value: bigint, basisPoints: bigint): bigint {
  if (value < 0n || basisPoints < 10_000n)
    throw new AiPricingError('INVALID_CATALOG_METRICS');
  return (value * basisPoints + 9_999n) / 10_000n;
}

export function calculateCompositeSettlement(input: {
  calls: readonly CompositeProviderCallCost[];
  ceilingCredits: bigint;
  feeCredits: bigint;
  floorCredits: bigint;
  targetMarginCredits: bigint;
  usableResult: boolean;
}): CompositeSettlementPreview {
  const values = [
    input.ceilingCredits,
    input.feeCredits,
    input.floorCredits,
    input.targetMarginCredits,
    ...input.calls.map((call) => call.costCredits),
  ];
  if (values.some((value) => value < 0n) || input.ceilingCredits === 0n)
    throw new AiPricingError('INVALID_AMOUNT');
  const providerCostCredits = input.calls.reduce(
    (total, call) => total + call.costCredits,
    0n,
  );
  if (!input.usableResult)
    return {
      absorbedCeilingOverrunCredits: 0n,
      absorbedProviderCostCredits: providerCostCredits,
      billableProviderCostCredits: 0n,
      providerCostCredits,
      releasedCredits: input.ceilingCredits,
      settledCredits: 0n,
    };
  const billableProviderCostCredits = input.calls.reduce(
    (total, call) =>
      total +
      (call.terminalValidated && call.usefulToPublishedResult && !call.wasRetry
        ? call.costCredits
        : 0n),
    0n,
  );
  const desiredSettlement = maxBigInt(
    input.floorCredits,
    billableProviderCostCredits + input.feeCredits + input.targetMarginCredits,
  );
  const settledCredits =
    desiredSettlement > input.ceilingCredits
      ? input.ceilingCredits
      : desiredSettlement;
  return {
    absorbedCeilingOverrunCredits: desiredSettlement - settledCredits,
    absorbedProviderCostCredits:
      providerCostCredits - billableProviderCostCredits,
    billableProviderCostCredits,
    providerCostCredits,
    releasedCredits: input.ceilingCredits - settledCredits,
    settledCredits,
  };
}

export function calculateQuotePrice(
  entry: PricingEntrySnapshot,
): CalculatedQuotePrice {
  const nonNegative = [
    entry.providerMedianCostCredits,
    entry.providerP90CostCredits,
    entry.feeCredits,
    entry.targetMarginCredits,
  ].every((value) => value >= 0n);
  if (
    !nonNegative ||
    entry.floorCredits <= 0n ||
    entry.providerP90CostCredits < entry.providerMedianCostCredits
  )
    throw new AiPricingError('INVALID_CATALOG_METRICS');
  const estimatedCredits = maxBigInt(
    entry.floorCredits,
    multiplyAndCeil(
      entry.providerMedianCostCredits,
      entry.safetyCoefficientBasisPoints,
    ) +
      entry.feeCredits +
      entry.targetMarginCredits,
  );
  const ceilingCredits = maxBigInt(
    estimatedCredits,
    multiplyAndCeil(
      entry.providerP90CostCredits,
      entry.safetyCoefficientBasisPoints,
    ) +
      entry.feeCredits +
      entry.targetMarginCredits,
  );
  return { ceilingCredits, estimatedCredits, floorCredits: entry.floorCredits };
}

export function calculateFinalPrice(input: {
  ceilingCredits: bigint;
  feeCredits: bigint;
  floorCredits: bigint;
  providerCallCostsCredits: readonly bigint[];
  targetMarginCredits: bigint;
}) {
  const values = [
    input.ceilingCredits,
    input.feeCredits,
    input.floorCredits,
    input.targetMarginCredits,
    ...input.providerCallCostsCredits,
  ];
  if (values.some((value) => value < 0n) || input.ceilingCredits === 0n)
    throw new AiPricingError('INVALID_AMOUNT');
  const providerCostCredits = input.providerCallCostsCredits.reduce(
    (total, cost) => total + cost,
    0n,
  );
  if (providerCostCredits + input.feeCredits > input.ceilingCredits)
    throw new AiPricingError('NEGATIVE_MARGIN');
  const priceCredits = maxBigInt(
    input.floorCredits,
    providerCostCredits + input.feeCredits + input.targetMarginCredits,
  );
  if (priceCredits > input.ceilingCredits)
    throw new AiPricingError('FINAL_PRICE_EXCEEDS_CEILING');
  return {
    marginCredits: priceCredits - providerCostCredits - input.feeCredits,
    priceCredits,
    providerCostCredits,
  };
}

export function estimatePackCapacity(
  packCredits: bigint,
  medianActionCredits: bigint,
): bigint {
  if (packCredits < 0n || medianActionCredits <= 0n)
    throw new AiPricingError('INVALID_AMOUNT');
  return packCredits / medianActionCredits;
}
