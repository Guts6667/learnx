import { getCorrectionContractRuntimeEligibility } from '../../lib/ai-correction-contracts.js';
import { PROMOTED_CORRECTION_IDENTITY } from '../corrections/promoted-identity.js';
import { calculateQuotePrice } from './ai-pricing-calculations.js';
import { createPricingQuoteFingerprint } from './ai-pricing-fingerprint.js';
import type {
  AiPricingActionValue,
  AiPricingQuoteRepository,
  AiPricingTarget,
  PricingTargetSnapshot,
  StoredPricingQuote,
} from './ai-pricing-types.js';
import { AiPricingError } from './ai-pricing-types.js';

function assertIdempotencyKey(value: string): void {
  if (!/^[a-zA-Z0-9._:-]{8,200}$/.test(value))
    throw new AiPricingError('INVALID_IDEMPOTENCY_KEY');
}

function assertQuoteCompatible(
  quote: StoredPricingQuote,
  input: { action: AiPricingActionValue; fingerprint: string; now: Date },
): void {
  if (
    quote.requestFingerprint !== input.fingerprint ||
    quote.action !== input.action
  )
    throw new AiPricingError('DUPLICATE_OPERATION_CONFLICT');
  if (quote.expiresAt <= input.now) throw new AiPricingError('QUOTE_EXPIRED');
}

function assertTargetEligible(
  target: PricingTargetSnapshot,
  requestedTarget: AiPricingTarget,
  action: AiPricingActionValue,
) {
  const isReconsideration = action === 'RECONSIDERATION';
  if (isReconsideration !== Boolean(target.reconsideration))
    throw new AiPricingError('TARGET_NOT_ELIGIBLE');
  const eligibility = getCorrectionContractRuntimeEligibility(target.contract);
  if (!eligibility.eligible) throw new AiPricingError('TARGET_NOT_ELIGIBLE');
  const expectedKind =
    requestedTarget.kind === 'EXERCISE_SUBMISSION'
      ? 'EXERCISE'
      : 'STAGE_ASSESSMENT';
  if (eligibility.contract.target.kind !== expectedKind)
    throw new AiPricingError('TARGET_NOT_ELIGIBLE');
  const identity = PROMOTED_CORRECTION_IDENTITY;
  if (
    !identity.targetKindScope.some(
      (kind) => kind === eligibility.contract.target.kind,
    ) ||
    !identity.activityTypeScope.some(
      (activityType) =>
        activityType === eligibility.contract.target.activityType,
    ) ||
    !identity.languageScope.some((language) => language === target.language)
  )
    throw new AiPricingError('TARGET_NOT_ELIGIBLE');
  return eligibility.contract;
}

function assertCatalogEligible(
  selection: Awaited<ReturnType<AiPricingQuoteRepository['findActiveEntry']>>,
  action: AiPricingActionValue,
  language: string,
) {
  if (!selection) throw new AiPricingError('CATALOG_UNAVAILABLE');
  if (selection.entry.action !== action)
    throw new AiPricingError('ACTION_UNAVAILABLE');
  if (
    selection.catalog.workflowKind === 'COMPOSITE' &&
    (!selection.catalog.pipelineIdentitySnapshot ||
      !selection.catalog.pipelineVersionId ||
      !selection.catalog.costDimensions ||
      !selection.entry.includesTargetedVerification)
  )
    throw new AiPricingError('INVALID_CATALOG_METRICS');
  const identity = PROMOTED_CORRECTION_IDENTITY;
  if (
    selection.catalog.benchmarkId !== identity.benchmarkId ||
    selection.catalog.language !== language ||
    selection.catalog.modelId !== identity.modelId ||
    selection.catalog.provider !== identity.provider ||
    selection.catalog.promptVersion !== identity.promptVersion ||
    selection.catalog.workflowKind !== 'SINGLE_MODEL' ||
    !selection.entry.includesAutomaticSecondPass
  )
    throw new AiPricingError('CATALOG_UNAVAILABLE');
  return selection;
}

async function resolveExisting(
  repository: AiPricingQuoteRepository,
  userId: string,
  key: string,
  action: AiPricingActionValue,
  fingerprint: string,
  now: Date,
) {
  const existing = await repository.findQuoteByIdempotency(userId, key);
  if (!existing) return null;
  assertQuoteCompatible(existing, { action, fingerprint, now });
  if (!(await repository.isQuoteCurrentlyCompatible(existing, now)))
    throw new AiPricingError('QUOTE_INCOMPATIBLE');
  return existing;
}

export class AiPricingQuoteService {
  public constructor(
    private readonly repository: AiPricingQuoteRepository,
    private readonly now: () => Date = () => new Date(),
    /**
     * The circuit breaker, absent where no evaluation is possible. Consulted
     * here rather than at execution so a suspended correction never reserves
     * credits it will not spend: the learner is refused before paying, not
     * refunded after.
     */
    private readonly breaker?: {
      evaluate(): Promise<{ state: 'CLOSED' | 'OPEN' }>;
    },
  ) {}

  public async quote(input: {
    action: AiPricingActionValue;
    idempotencyKey: string;
    target: AiPricingTarget;
    userId: string;
  }): Promise<StoredPricingQuote> {
    assertIdempotencyKey(input.idempotencyKey);
    // Evaluated on the path it protects: every attempt to use the feature is
    // also the moment to check whether it should still be offered. Corrections
    // already quoted are left to run out.
    if (this.breaker && (await this.breaker.evaluate()).state === 'OPEN') {
      throw new AiPricingError('CORRECTION_SUSPENDED');
    }
    const target = await this.repository.resolveTarget(
      input.userId,
      input.target,
    );
    if (!target) throw new AiPricingError('TARGET_NOT_FOUND');
    const contract = assertTargetEligible(target, input.target, input.action);
    const requestFingerprint = createPricingQuoteFingerprint({
      action: input.action,
      contractKey: contract.contractKey,
      contractVersion: contract.version,
      inputChars: target.inputChars,
      language: target.language,
      target: input.target,
      userId: input.userId,
    });
    const now = this.now();
    const existing = await resolveExisting(
      this.repository,
      input.userId,
      input.idempotencyKey,
      input.action,
      requestFingerprint,
      now,
    );
    if (existing) return existing;
    const selection = assertCatalogEligible(
      await this.repository.findActiveEntry({
        action: input.action,
        contract,
        inputChars: target.inputChars,
        language: target.language,
        now,
      }),
      input.action,
      target.language,
    );
    const price = calculateQuotePrice(selection.entry);
    try {
      return await this.repository.createQuote({
        catalog: selection.catalog,
        entry: selection.entry,
        expiresAt: new Date(
          now.getTime() + selection.catalog.quoteTtlSeconds * 1_000,
        ),
        idempotencyKey: input.idempotencyKey,
        inputChars: target.inputChars,
        price,
        requestFingerprint,
        target,
        userId: input.userId,
      });
    } catch (error) {
      const raced = await resolveExisting(
        this.repository,
        input.userId,
        input.idempotencyKey,
        input.action,
        requestFingerprint,
        now,
      );
      if (!raced) throw error;
      return raced;
    }
  }
}
