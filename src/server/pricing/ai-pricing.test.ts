import type { CorrectionContract } from '@/lib/ai-correction-contracts';
import { PROMOTED_CORRECTION_IDENTITY } from '@/server/corrections/promoted-identity';

import {
  AiPricingError,
  AiPricingQuoteService,
  calculateCompositeSettlement,
  calculateFinalPrice,
  calculateQuotePrice,
  estimatePackCapacity,
  type AiPricingQuoteRepository,
  type CreatePricingQuoteRecordInput,
  type PricingEntrySnapshot,
  type StoredPricingQuote,
} from './ai-pricing';

const contract: CorrectionContract = {
  authorizedReferences: [],
  contractKey: 'writing-contract',
  criteria: [
    {
      acceptableVariants: [],
      calibratedExamples: [],
      commonErrors: [],
      expectedElements: ['A clear answer'],
      key: 'clarity',
      label: 'Clarity',
      objective: 'Explain the answer clearly.',
      performanceLevels: [
        { description: 'Missing', key: 'missing', label: 'Missing', score: 0 },
        {
          description: 'Mastered',
          key: 'mastered',
          label: 'Mastered',
          score: 100,
        },
      ],
      weight: 100,
    },
  ],
  evidence: { acceptedKinds: ['TEXT'], primaryKind: 'TEXT' },
  lifecycle: { publishedAt: '2026-08-12T12:00:00.000Z', status: 'PUBLISHED' },
  objectives: ['Provide a clear answer.'],
  passingScore: 70,
  schemaVersion: 1,
  secondPass: {
    confidenceThreshold: 0.75,
    enabled: true,
    maxPasses: 2,
    triggers: ['LOW_CONFIDENCE'],
  },
  target: {
    activityKey: 'write-answer',
    activityType: 'writing',
    kind: 'EXERCISE',
  },
  version: '1.0.0',
};

describe('composite settlement preview', () => {
  it('bills only terminal useful role calls and absorbs retries', () => {
    expect(
      calculateCompositeSettlement({
        calls: [
          {
            costCredits: 3n,
            role: 'PRIMARY',
            terminalValidated: false,
            usefulToPublishedResult: false,
            wasRetry: true,
          },
          {
            costCredits: 5n,
            role: 'PRIMARY',
            terminalValidated: true,
            usefulToPublishedResult: true,
            wasRetry: false,
          },
          {
            costCredits: 4n,
            role: 'TARGETED_VERIFIER',
            terminalValidated: true,
            usefulToPublishedResult: true,
            wasRetry: false,
          },
        ],
        ceilingCredits: 20n,
        feeCredits: 1n,
        floorCredits: 1n,
        targetMarginCredits: 1n,
        usableResult: true,
      }),
    ).toEqual({
      absorbedCeilingOverrunCredits: 0n,
      absorbedProviderCostCredits: 3n,
      billableProviderCostCredits: 9n,
      providerCostCredits: 12n,
      releasedCredits: 9n,
      settledCredits: 11n,
    });
  });

  it('releases the full ceiling and absorbs every call without a usable result', () => {
    expect(
      calculateCompositeSettlement({
        calls: [
          {
            costCredits: 7n,
            role: 'PRIMARY',
            terminalValidated: false,
            usefulToPublishedResult: false,
            wasRetry: false,
          },
        ],
        ceilingCredits: 20n,
        feeCredits: 1n,
        floorCredits: 1n,
        targetMarginCredits: 1n,
        usableResult: false,
      }),
    ).toMatchObject({
      absorbedCeilingOverrunCredits: 0n,
      absorbedProviderCostCredits: 7n,
      releasedCredits: 20n,
      settledCredits: 0n,
    });
  });

  it('caps settlement and exposes provider overrun for audit', () => {
    expect(
      calculateCompositeSettlement({
        calls: [
          {
            costCredits: 12n,
            role: 'PRIMARY',
            terminalValidated: true,
            usefulToPublishedResult: true,
            wasRetry: false,
          },
        ],
        ceilingCredits: 10n,
        feeCredits: 1n,
        floorCredits: 1n,
        targetMarginCredits: 1n,
        usableResult: true,
      }),
    ).toMatchObject({
      absorbedCeilingOverrunCredits: 4n,
      absorbedProviderCostCredits: 0n,
      releasedCredits: 0n,
      settledCredits: 10n,
    });
  });
});

const entry: PricingEntrySnapshot = {
  action: 'STANDARD',
  catalogVersionId: 'catalog-id',
  feeCredits: 2n,
  floorCredits: 8n,
  id: 'entry-id',
  includesAutomaticSecondPass: true,
  includesTargetedVerification: false,
  inputSizeClass: 'SHORT',
  providerMedianCostCredits: 4n,
  providerMedianCostUsd: '0.04000000',
  providerP90CostCredits: 10n,
  providerP90CostUsd: '0.10000000',
  safetyCoefficientBasisPoints: 12_500n,
  targetMarginCredits: 3n,
};

function makeRepository(): AiPricingQuoteRepository & {
  created: CreatePricingQuoteRecordInput[];
  quotes: StoredPricingQuote[];
} {
  const quotes: StoredPricingQuote[] = [];
  const created: CreatePricingQuoteRecordInput[] = [];
  return {
    created,
    quotes,
    async createQuote(input) {
      created.push(input);
      const quote: StoredPricingQuote = {
        action: input.entry.action,
        catalogVersionId: input.catalog.id,
        ceilingCredits: input.price.ceilingCredits,
        contractKey: input.target.contract.contractKey,
        contractVersion: input.target.contract.version,
        costDimensionsSnapshot: input.catalog.costDimensions,
        createdAt: new Date('2026-08-12T13:00:00.000Z'),
        estimatedCredits: input.price.estimatedCredits,
        expiresAt: input.expiresAt,
        feeCredits: input.entry.feeCredits,
        floorCredits: input.price.floorCredits,
        id: `quote-${created.length}`,
        includesAutomaticSecondPass: input.entry.includesAutomaticSecondPass,
        includesTargetedVerification: input.entry.includesTargetedVerification,
        inputSizeClass: input.entry.inputSizeClass,
        language: input.catalog.language,
        modelId: input.catalog.modelId,
        pipelineIdentitySnapshot: input.catalog.pipelineIdentitySnapshot,
        pipelineVersionId: input.catalog.pipelineVersionId,
        promptVersion: input.catalog.promptVersion,
        provider: input.catalog.provider,
        requestFingerprint: input.requestFingerprint,
        targetMarginCredits: input.entry.targetMarginCredits,
        target: input.target.target,
        userId: input.userId,
        workflowKind: input.catalog.workflowKind,
      };
      quotes.push(quote);
      return quote;
    },
    async findActiveEntry() {
      return {
        catalog: {
          benchmarkId: PROMOTED_CORRECTION_IDENTITY.benchmarkId,
          corpusId: 'corpus-fr-v1',
          costDimensions: null,
          currency: 'LEARNX_CREDIT',
          id: 'catalog-id',
          language: 'fr-FR',
          modelId: PROMOTED_CORRECTION_IDENTITY.modelId,
          pipelineIdentitySnapshot: null,
          pipelineVersionId: null,
          promptVersion: PROMOTED_CORRECTION_IDENTITY.promptVersion,
          provider: PROMOTED_CORRECTION_IDENTITY.provider,
          providerRateCardEffectiveAt: new Date('2026-08-12T00:00:00.000Z'),
          providerRateCardVersion: 'openrouter-2026-08-12',
          quoteTtlSeconds: 900,
          usesPromotionalProviderRates: false,
          version: '1.0.0',
          workflowKind: 'SINGLE_MODEL',
        },
        entry,
      };
    },
    async findQuoteByIdempotency(userId, idempotencyKey) {
      return (
        quotes.find(
          (quote) =>
            quote.userId === userId &&
            created.find(
              (candidate) =>
                candidate.idempotencyKey === idempotencyKey &&
                candidate.requestFingerprint === quote.requestFingerprint,
            ),
        ) ?? null
      );
    },
    async findQuoteById(userId, quoteId) {
      return (
        quotes.find((quote) => quote.userId === userId && quote.id === quoteId) ??
        null
      );
    },
    async isQuoteCurrentlyCompatible() {
      return true;
    },
    async resolveTarget(userId, target) {
      if (userId !== 'user-id') return null;
      return { contract, inputChars: 640, language: 'fr-FR', target };
    },
  };
}

describe('AI pricing calculations', () => {
  it('rounds estimates upward and uses the size-segmented P90 ceiling', () => {
    expect(calculateQuotePrice(entry)).toEqual({
      ceilingCredits: 18n,
      estimatedCredits: 10n,
      floorCredits: 8n,
    });
  });

  it('aggregates every provider call instead of charging only the last one', () => {
    expect(
      calculateFinalPrice({
        ceilingCredits: 18n,
        feeCredits: 2n,
        floorCredits: 8n,
        providerCallCostsCredits: [3n, 4n, 2n],
        targetMarginCredits: 3n,
      }),
    ).toEqual({
      marginCredits: 3n,
      priceCredits: 14n,
      providerCostCredits: 9n,
    });
  });

  it('fails closed when actual provider costs would create a negative margin', () => {
    expect(() =>
      calculateFinalPrice({
        ceilingCredits: 10n,
        feeCredits: 2n,
        floorCredits: 5n,
        providerCallCostsCredits: [9n],
        targetMarginCredits: 1n,
      }),
    ).toThrowError(new AiPricingError('NEGATIVE_MARGIN'));
  });

  it('reports pack capacity as a floored estimate only', () => {
    expect(estimatePackCapacity(100n, 18n)).toBe(5n);
  });
});

describe('AI pricing quote service', () => {
  it('creates an immutable server-calculated quote and replays it idempotently', async () => {
    const repository = makeRepository();
    const service = new AiPricingQuoteService(
      repository,
      () => new Date('2026-08-12T13:00:00.000Z'),
    );
    const request = {
      action: 'STANDARD' as const,
      idempotencyKey: 'quote:request:123',
      target: {
        id: '11111111-1111-4111-8111-111111111111',
        kind: 'EXERCISE_SUBMISSION' as const,
      },
      userId: 'user-id',
    };

    const first = await service.quote(request);
    const replay = await service.quote(request);

    expect(replay.id).toBe(first.id);
    expect(first).toMatchObject({
      ceilingCredits: 18n,
      estimatedCredits: 10n,
      includesAutomaticSecondPass: true,
    });
    expect(repository.created).toHaveLength(1);
  });

  it('does not produce a zero or stale quote without an active measured catalog', async () => {
    const repository = makeRepository();
    repository.findActiveEntry = async () => null;
    const service = new AiPricingQuoteService(repository);

    await expect(
      service.quote({
        action: 'STANDARD',
        idempotencyKey: 'quote:request:missing',
        target: {
          id: '11111111-1111-4111-8111-111111111111',
          kind: 'EXERCISE_SUBMISSION',
        },
        userId: 'user-id',
      }),
    ).rejects.toMatchObject({ code: 'CATALOG_UNAVAILABLE' });
  });

  it('refuses a published contract outside the promoted French locale', async () => {
    const repository = makeRepository();
    repository.resolveTarget = async (_userId, target) => ({
      contract,
      inputChars: 640,
      language: 'en-GB',
      target,
    });
    const service = new AiPricingQuoteService(repository);

    await expect(
      service.quote({
        action: 'STANDARD',
        idempotencyKey: 'quote:request:english',
        target: {
          id: '11111111-1111-4111-8111-111111111111',
          kind: 'EXERCISE_SUBMISSION',
        },
        userId: 'user-id',
      }),
    ).rejects.toMatchObject({ code: 'TARGET_NOT_ELIGIBLE' });
  });

  it('rejects a composite catalog whose immutable pipeline snapshot is absent', async () => {
    const repository = makeRepository();
    const baseFindActiveEntry = repository.findActiveEntry.bind(repository);
    repository.findActiveEntry = async (input) => {
      const selected = await baseFindActiveEntry(input);
      if (!selected) return null;
      return {
        catalog: {
          ...selected.catalog,
          pipelineIdentitySnapshot: null,
          workflowKind: 'COMPOSITE',
        },
        entry: {
          ...selected.entry,
          includesTargetedVerification: true,
        },
      };
    };
    const service = new AiPricingQuoteService(repository);

    await expect(
      service.quote({
        action: 'STANDARD',
        idempotencyKey: 'quote:request:composite',
        target: {
          id: '11111111-1111-4111-8111-111111111111',
          kind: 'EXERCISE_SUBMISSION',
        },
        userId: 'user-id',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CATALOG_METRICS' });
  });

  it('rejects an expired idempotent quote instead of silently reusing it', async () => {
    const repository = makeRepository();
    const now = new Date('2026-08-12T13:00:00.000Z');
    const service = new AiPricingQuoteService(repository, () => now);
    const request = {
      action: 'STANDARD' as const,
      idempotencyKey: 'quote:request:expired',
      target: {
        id: '11111111-1111-4111-8111-111111111111',
        kind: 'EXERCISE_SUBMISSION' as const,
      },
      userId: 'user-id',
    };
    await service.quote(request);
    const [stored] = repository.quotes;
    if (!stored) throw new Error('Expected the quote to be stored.');
    repository.quotes[0] = {
      ...stored,
      expiresAt: new Date(now.getTime() - 1),
    };

    await expect(service.quote(request)).rejects.toMatchObject({
      code: 'QUOTE_EXPIRED',
    });
  });

  it('rejects idempotency-key reuse with a modified action', async () => {
    const repository = makeRepository();
    const service = new AiPricingQuoteService(repository);
    const request = {
      action: 'STANDARD' as const,
      idempotencyKey: 'quote:request:conflict',
      target: {
        id: '11111111-1111-4111-8111-111111111111',
        kind: 'EXERCISE_SUBMISSION' as const,
      },
      userId: 'user-id',
    };
    await service.quote(request);

    await expect(
      service.quote({ ...request, action: 'DETAILED' }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_OPERATION_CONFLICT' });
  });

  it('rejects a quote whose catalog was retired or invalidated', async () => {
    const repository = makeRepository();
    const service = new AiPricingQuoteService(repository);
    const request = {
      action: 'STANDARD' as const,
      idempotencyKey: 'quote:request:invalidated',
      target: {
        id: '11111111-1111-4111-8111-111111111111',
        kind: 'EXERCISE_SUBMISSION' as const,
      },
      userId: 'user-id',
    };
    await service.quote(request);
    repository.isQuoteCurrentlyCompatible = async () => false;

    await expect(service.quote(request)).rejects.toMatchObject({
      code: 'QUOTE_INCOMPATIBLE',
    });
  });
});
