import type { CorrectionContract } from '../../lib/ai-correction-contracts.js';

export const AI_PRICING_ACTIONS = [
  'STANDARD',
  'DETAILED',
  'REINFORCED',
  'RECONSIDERATION',
] as const;
export type AiPricingActionValue = (typeof AI_PRICING_ACTIONS)[number];
export type AiPricingInputSizeClassValue = 'SHORT' | 'MEDIUM' | 'LONG';
export type AiPricingTarget =
  | {
      id: string;
      kind: 'EXERCISE_SUBMISSION';
      reconsideration?: { argument: string; sourceCorrectionId: string };
    }
  | { id: string; kind: 'STAGE_ASSESSMENT_SUBMISSION' };

export interface PricingCatalogSnapshot {
  benchmarkId: string;
  corpusId: string;
  costDimensions: unknown | null;
  currency: 'LEARNX_CREDIT';
  id: string;
  language: string;
  modelId: string;
  pipelineVersionId: string | null;
  pipelineIdentitySnapshot: unknown | null;
  promptVersion: string;
  provider: string;
  providerRateCardEffectiveAt: Date | null;
  providerRateCardVersion: string | null;
  quoteTtlSeconds: number;
  usesPromotionalProviderRates: boolean;
  version: string;
  workflowKind: 'COMPOSITE' | 'SINGLE_MODEL';
}

export interface PricingEntrySnapshot {
  action: AiPricingActionValue;
  catalogVersionId: string;
  feeCredits: bigint;
  floorCredits: bigint;
  id: string;
  includesAutomaticSecondPass: boolean;
  includesTargetedVerification: boolean;
  inputSizeClass: AiPricingInputSizeClassValue;
  providerMedianCostCredits: bigint;
  providerMedianCostUsd: string;
  providerP90CostCredits: bigint;
  providerP90CostUsd: string;
  safetyCoefficientBasisPoints: bigint;
  targetMarginCredits: bigint;
}

export interface PricingTargetSnapshot {
  contract: CorrectionContract;
  inputChars: number;
  language: string;
  reconsideration?: { argument: string; sourceCorrectionId: string };
  target: AiPricingTarget;
}

export interface StoredPricingQuote {
  action: AiPricingActionValue;
  catalogVersionId: string;
  ceilingCredits: bigint;
  costDimensionsSnapshot: unknown | null;
  contractKey: string;
  contractVersion: string;
  createdAt: Date;
  estimatedCredits: bigint;
  expiresAt: Date;
  feeCredits: bigint;
  floorCredits: bigint;
  id: string;
  includesAutomaticSecondPass: boolean;
  includesTargetedVerification: boolean;
  inputSizeClass: AiPricingInputSizeClassValue;
  language: string;
  modelId: string;
  pipelineVersionId: string | null;
  pipelineIdentitySnapshot: unknown | null;
  promptVersion: string;
  provider?: string;
  requestFingerprint: string;
  reconsideration?: { argument: string; sourceCorrectionId: string };
  targetMarginCredits: bigint;
  target: AiPricingTarget;
  userId: string;
  workflowKind: 'COMPOSITE' | 'SINGLE_MODEL';
}

export interface CalculatedQuotePrice {
  ceilingCredits: bigint;
  estimatedCredits: bigint;
  floorCredits: bigint;
}

export interface CreatePricingQuoteRecordInput {
  catalog: PricingCatalogSnapshot;
  entry: PricingEntrySnapshot;
  expiresAt: Date;
  idempotencyKey: string;
  inputChars: number;
  price: CalculatedQuotePrice;
  requestFingerprint: string;
  target: PricingTargetSnapshot;
  userId: string;
}

export interface AiPricingQuoteRepository {
  createQuote(
    input: CreatePricingQuoteRecordInput,
  ): Promise<StoredPricingQuote>;
  findActiveEntry(input: {
    action: AiPricingActionValue;
    contract: CorrectionContract;
    inputChars: number;
    language: string;
    now: Date;
  }): Promise<{
    catalog: PricingCatalogSnapshot;
    entry: PricingEntrySnapshot;
  } | null>;
  findQuoteByIdempotency(
    userId: string,
    idempotencyKey: string,
  ): Promise<StoredPricingQuote | null>;
  findQuoteById(
    userId: string,
    quoteId: string,
  ): Promise<StoredPricingQuote | null>;
  isQuoteCurrentlyCompatible(
    quote: StoredPricingQuote,
    now: Date,
  ): Promise<boolean>;
  resolveTarget(
    userId: string,
    target: AiPricingTarget,
  ): Promise<PricingTargetSnapshot | null>;
}

export class AiPricingError extends Error {
  public constructor(
    public readonly code:
      | 'ACTION_UNAVAILABLE'
      | 'CATALOG_UNAVAILABLE'
      | 'DUPLICATE_OPERATION_CONFLICT'
      | 'FINAL_PRICE_EXCEEDS_CEILING'
      | 'INVALID_AMOUNT'
      | 'INVALID_CATALOG_METRICS'
      | 'INVALID_IDEMPOTENCY_KEY'
      | 'NEGATIVE_MARGIN'
      | 'QUOTE_EXPIRED'
      | 'QUOTE_INCOMPATIBLE'
      | 'TARGET_NOT_ELIGIBLE'
      | 'TARGET_NOT_FOUND',
  ) {
    super(code);
    this.name = 'AiPricingError';
  }
}

export interface CompositeProviderCallCost {
  costCredits: bigint;
  role: 'PRIMARY' | 'TARGETED_VERIFIER';
  terminalValidated: boolean;
  usefulToPublishedResult: boolean;
  wasRetry: boolean;
}
export interface CompositeSettlementPreview {
  absorbedCeilingOverrunCredits: bigint;
  absorbedProviderCostCredits: bigint;
  billableProviderCostCredits: bigint;
  providerCostCredits: bigint;
  releasedCredits: bigint;
  settledCredits: bigint;
}
