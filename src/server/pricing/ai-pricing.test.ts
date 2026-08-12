import type { CorrectionContract } from '@/lib/ai-correction-contracts';

import {
  AiPricingError,
  AiPricingQuoteService,
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
        { description: 'Mastered', key: 'mastered', label: 'Mastered', score: 100 },
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

const entry: PricingEntrySnapshot = {
  action: 'STANDARD',
  catalogVersionId: 'catalog-id',
  feeCredits: 2n,
  floorCredits: 8n,
  id: 'entry-id',
  includesAutomaticSecondPass: true,
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
        createdAt: new Date('2026-08-12T13:00:00.000Z'),
        estimatedCredits: input.price.estimatedCredits,
        expiresAt: input.expiresAt,
        floorCredits: input.price.floorCredits,
        id: `quote-${created.length}`,
        includesAutomaticSecondPass:
          input.entry.includesAutomaticSecondPass,
        inputSizeClass: input.entry.inputSizeClass,
        language: input.catalog.language,
        modelId: input.catalog.modelId,
        promptVersion: input.catalog.promptVersion,
        requestFingerprint: input.requestFingerprint,
        target: input.target.target,
        userId: input.userId,
      };
      quotes.push(quote);
      return quote;
    },
    async findActiveEntry() {
      return {
        catalog: {
          benchmarkId: 'benchmark-approved',
          corpusId: 'corpus-fr-v1',
          currency: 'LEARNX_CREDIT',
          id: 'catalog-id',
          language: 'fr-FR',
          modelId: 'vendor/model-20260812',
          promptVersion: '1.0.0',
          provider: 'openrouter',
          quoteTtlSeconds: 900,
          version: '1.0.0',
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
    ).toEqual({ marginCredits: 3n, priceCredits: 14n, providerCostCredits: 9n });
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
      target: { id: '11111111-1111-4111-8111-111111111111', kind: 'EXERCISE_SUBMISSION' as const },
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
        target: { id: '11111111-1111-4111-8111-111111111111', kind: 'EXERCISE_SUBMISSION' },
        userId: 'user-id',
      }),
    ).rejects.toMatchObject({ code: 'CATALOG_UNAVAILABLE' });
  });

  it('rejects an expired idempotent quote instead of silently reusing it', async () => {
    const repository = makeRepository();
    const now = new Date('2026-08-12T13:00:00.000Z');
    const service = new AiPricingQuoteService(repository, () => now);
    const request = {
      action: 'STANDARD' as const,
      idempotencyKey: 'quote:request:expired',
      target: { id: '11111111-1111-4111-8111-111111111111', kind: 'EXERCISE_SUBMISSION' as const },
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
      target: { id: '11111111-1111-4111-8111-111111111111', kind: 'EXERCISE_SUBMISSION' as const },
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
