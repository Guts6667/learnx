import {
  type AiPricingQuote,
  Prisma,
} from '../../../generated/prisma/client.js';
import {
  AI_PRICING_ACTIONS,
  AiPricingError,
  type PricingCatalogSnapshot,
  type PricingEntrySnapshot,
  type StoredPricingQuote,
} from './ai-pricing.js';

function pricingAction(value: string): PricingEntrySnapshot['action'] {
  const action = AI_PRICING_ACTIONS.find((candidate) => candidate === value);
  if (!action) throw new AiPricingError('ACTION_UNAVAILABLE');
  return action;
}

function coefficientBasisPoints(value: Prisma.Decimal): bigint {
  const scaled = value.mul(10_000);
  if (!scaled.isInteger()) throw new AiPricingError('INVALID_CATALOG_METRICS');
  return BigInt(scaled.toFixed(0));
}

export function asPricingJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function catalogSnapshot(
  input: PricingCatalogSnapshot,
): PricingCatalogSnapshot {
  return input;
}

export function entrySnapshot(input: {
  action: string;
  catalogVersionId: string;
  feeCredits: bigint;
  floorCredits: bigint;
  id: string;
  includesAutomaticSecondPass: boolean;
  includesTargetedVerification: boolean;
  inputSizeClass: PricingEntrySnapshot['inputSizeClass'];
  providerMedianCostCredits: bigint;
  providerMedianCostUsd: Prisma.Decimal;
  providerP90CostCredits: bigint;
  providerP90CostUsd: Prisma.Decimal;
  safetyCoefficient: Prisma.Decimal;
  targetMarginCredits: bigint;
}): PricingEntrySnapshot {
  return {
    ...input,
    action: pricingAction(input.action),
    providerMedianCostUsd: input.providerMedianCostUsd.toFixed(8),
    providerP90CostUsd: input.providerP90CostUsd.toFixed(8),
    safetyCoefficientBasisPoints: coefficientBasisPoints(
      input.safetyCoefficient,
    ),
  };
}

export function storedQuote(quote: AiPricingQuote): StoredPricingQuote {
  return {
    action: pricingAction(quote.action),
    catalogVersionId: quote.catalogVersionId,
    ceilingCredits: quote.ceilingCredits,
    costDimensionsSnapshot: quote.costDimensionsSnapshot,
    contractKey: quote.contractKey,
    contractVersion: quote.contractVersion,
    createdAt: quote.createdAt,
    estimatedCredits: quote.estimatedCredits,
    expiresAt: quote.expiresAt,
    feeCredits: quote.feeCreditsSnapshot,
    floorCredits: quote.floorCredits,
    id: quote.id,
    includesAutomaticSecondPass: quote.includesAutomaticSecondPass,
    includesTargetedVerification: quote.includesTargetedVerification,
    inputSizeClass: quote.inputSizeClass,
    language: quote.language,
    modelId: quote.modelId,
    pipelineVersionId: quote.pipelineVersionId,
    pipelineIdentitySnapshot: quote.pipelineIdentitySnapshot,
    promptVersion: quote.promptVersion,
    provider: quote.provider,
    requestFingerprint: quote.requestFingerprint,
    ...(quote.reconsiderationOfCorrectionId && quote.reconsiderationArgument
      ? {
          reconsideration: {
            argument: quote.reconsiderationArgument,
            sourceCorrectionId: quote.reconsiderationOfCorrectionId,
          },
        }
      : {}),
    targetMarginCredits: quote.targetMarginCreditsSnapshot,
    target: { id: quote.targetId, kind: quote.targetKind },
    userId: quote.userId,
    workflowKind: quote.workflowKind,
  };
}
