import { createHash } from 'node:crypto';

import {
  getCorrectionContractRuntimeEligibility,
  type CorrectionContract,
} from '../../lib/ai-correction-contracts.js';

export const AI_PRICING_ACTIONS = [
  'STANDARD',
  'DETAILED',
  'REINFORCED',
  'RECONSIDERATION',
] as const;

export type AiPricingActionValue = (typeof AI_PRICING_ACTIONS)[number];
export type AiPricingInputSizeClassValue = 'SHORT' | 'MEDIUM' | 'LONG';
export type AiPricingTarget =
  | { id: string; kind: 'EXERCISE_SUBMISSION' }
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
  targetMarginCredits: bigint;
  target: AiPricingTarget;
  userId: string;
  workflowKind: 'COMPOSITE' | 'SINGLE_MODEL';
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

export interface CalculatedQuotePrice {
  ceilingCredits: bigint;
  estimatedCredits: bigint;
  floorCredits: bigint;
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
  if (values.some((value) => value < 0n) || input.ceilingCredits === 0n) {
    throw new AiPricingError('INVALID_AMOUNT');
  }
  const providerCostCredits = input.calls.reduce(
    (total, call) => total + call.costCredits,
    0n,
  );
  if (!input.usableResult) {
    return {
      absorbedCeilingOverrunCredits: 0n,
      absorbedProviderCostCredits: providerCostCredits,
      billableProviderCostCredits: 0n,
      providerCostCredits,
      releasedCredits: input.ceilingCredits,
      settledCredits: 0n,
    };
  }
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

function maxBigInt(...values: bigint[]): bigint {
  return values.reduce((maximum, value) => (value > maximum ? value : maximum));
}

function multiplyAndCeil(value: bigint, basisPoints: bigint): bigint {
  if (value < 0n || basisPoints < 10_000n) {
    throw new AiPricingError('INVALID_CATALOG_METRICS');
  }
  return (value * basisPoints + 9_999n) / 10_000n;
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
  ) {
    throw new AiPricingError('INVALID_CATALOG_METRICS');
  }

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
}): {
  marginCredits: bigint;
  priceCredits: bigint;
  providerCostCredits: bigint;
} {
  const values = [
    input.ceilingCredits,
    input.feeCredits,
    input.floorCredits,
    input.targetMarginCredits,
    ...input.providerCallCostsCredits,
  ];
  if (values.some((value) => value < 0n) || input.ceilingCredits === 0n) {
    throw new AiPricingError('INVALID_AMOUNT');
  }
  const providerCostCredits = input.providerCallCostsCredits.reduce(
    (total, cost) => total + cost,
    0n,
  );
  if (providerCostCredits + input.feeCredits > input.ceilingCredits) {
    throw new AiPricingError('NEGATIVE_MARGIN');
  }
  const priceCredits = maxBigInt(
    input.floorCredits,
    providerCostCredits + input.feeCredits + input.targetMarginCredits,
  );
  if (priceCredits > input.ceilingCredits) {
    throw new AiPricingError('FINAL_PRICE_EXCEEDS_CEILING');
  }
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
  if (packCredits < 0n || medianActionCredits <= 0n) {
    throw new AiPricingError('INVALID_AMOUNT');
  }
  return packCredits / medianActionCredits;
}

function canonicalize(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function createPricingQuoteFingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function assertIdempotencyKey(value: string): void {
  if (!/^[a-zA-Z0-9._:-]{8,200}$/.test(value)) {
    throw new AiPricingError('INVALID_IDEMPOTENCY_KEY');
  }
}

function quoteIsCompatible(
  quote: StoredPricingQuote,
  input: {
    action: AiPricingActionValue;
    fingerprint: string;
    now: Date;
  },
): void {
  if (
    quote.requestFingerprint !== input.fingerprint ||
    quote.action !== input.action
  ) {
    throw new AiPricingError('DUPLICATE_OPERATION_CONFLICT');
  }
  if (quote.expiresAt <= input.now) throw new AiPricingError('QUOTE_EXPIRED');
}

export class AiPricingQuoteService {
  public constructor(
    private readonly repository: AiPricingQuoteRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async quote(input: {
    action: AiPricingActionValue;
    idempotencyKey: string;
    target: AiPricingTarget;
    userId: string;
  }): Promise<StoredPricingQuote> {
    assertIdempotencyKey(input.idempotencyKey);
    const target = await this.repository.resolveTarget(
      input.userId,
      input.target,
    );
    if (!target) throw new AiPricingError('TARGET_NOT_FOUND');
    const eligibility = getCorrectionContractRuntimeEligibility(
      target.contract,
    );
    if (!eligibility.eligible) throw new AiPricingError('TARGET_NOT_ELIGIBLE');
    const expectedKind =
      input.target.kind === 'EXERCISE_SUBMISSION'
        ? 'EXERCISE'
        : 'STAGE_ASSESSMENT';
    if (eligibility.contract.target.kind !== expectedKind) {
      throw new AiPricingError('TARGET_NOT_ELIGIBLE');
    }

    const requestFingerprint = createPricingQuoteFingerprint({
      action: input.action,
      contractKey: eligibility.contract.contractKey,
      contractVersion: eligibility.contract.version,
      inputChars: target.inputChars,
      language: target.language,
      target: input.target,
      userId: input.userId,
    });
    const now = this.now();
    const existing = await this.repository.findQuoteByIdempotency(
      input.userId,
      input.idempotencyKey,
    );
    if (existing) {
      quoteIsCompatible(existing, {
        action: input.action,
        fingerprint: requestFingerprint,
        now,
      });
      if (!(await this.repository.isQuoteCurrentlyCompatible(existing, now))) {
        throw new AiPricingError('QUOTE_INCOMPATIBLE');
      }
      return existing;
    }

    const selection = await this.repository.findActiveEntry({
      action: input.action,
      contract: eligibility.contract,
      inputChars: target.inputChars,
      language: target.language,
      now,
    });
    if (!selection) throw new AiPricingError('CATALOG_UNAVAILABLE');
    if (selection.entry.action !== input.action) {
      throw new AiPricingError('ACTION_UNAVAILABLE');
    }
    if (
      selection.catalog.workflowKind === 'COMPOSITE' &&
      (!selection.catalog.pipelineIdentitySnapshot ||
        !selection.catalog.pipelineVersionId ||
        !selection.catalog.costDimensions ||
        !selection.entry.includesTargetedVerification)
    ) {
      throw new AiPricingError('INVALID_CATALOG_METRICS');
    }
    const price = calculateQuotePrice(selection.entry);
    const expiresAt = new Date(
      now.getTime() + selection.catalog.quoteTtlSeconds * 1_000,
    );
    try {
      return await this.repository.createQuote({
        catalog: selection.catalog,
        entry: selection.entry,
        expiresAt,
        idempotencyKey: input.idempotencyKey,
        inputChars: target.inputChars,
        price,
        requestFingerprint,
        target,
        userId: input.userId,
      });
    } catch (error) {
      const raced = await this.repository.findQuoteByIdempotency(
        input.userId,
        input.idempotencyKey,
      );
      if (!raced) throw error;
      quoteIsCompatible(raced, {
        action: input.action,
        fingerprint: requestFingerprint,
        now,
      });
      if (!(await this.repository.isQuoteCurrentlyCompatible(raced, now))) {
        throw new AiPricingError('QUOTE_INCOMPATIBLE');
      }
      return raced;
    }
  }
}
