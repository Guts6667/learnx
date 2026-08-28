import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolvePricingTarget } = vi.hoisted(() => ({
  resolvePricingTarget: vi.fn(),
}));
vi.mock('./prisma-ai-pricing-targets.js', () => ({ resolvePricingTarget }));

import { AiPricingError } from './ai-pricing.js';
import { PrismaAiPricingQuoteRepository } from './prisma-ai-pricing.js';

const now = new Date('2026-08-28T12:00:00.000Z');

function storedQuote(overrides: Record<string, unknown> = {}) {
  return {
    action: 'STANDARD',
    catalogVersionId: 'catalog-1',
    ceilingCredits: 20n,
    contractKey: 'writing-contract',
    contractVersion: '1.0.0',
    costDimensionsSnapshot: null,
    createdAt: now,
    estimatedCredits: 10n,
    expiresAt: new Date('2026-08-28T12:15:00.000Z'),
    feeCreditsSnapshot: 1n,
    floorCredits: 2n,
    id: 'quote-1',
    idempotencyKey: 'quote:idempotency:1',
    includesAutomaticSecondPass: false,
    includesTargetedVerification: true,
    inputSizeClass: 'SHORT',
    language: 'fr-FR',
    modelId: 'model-1',
    pipelineIdentitySnapshot: null,
    pipelineVersionId: 'pipeline-1',
    promptVersion: '1.0.0',
    provider: 'provider-1',
    reconsiderationArgument: null,
    reconsiderationOfCorrectionId: null,
    requestFingerprint: 'fingerprint',
    targetId: 'submission-1',
    targetKind: 'EXERCISE_SUBMISSION',
    targetMarginCreditsSnapshot: 3n,
    userId: 'user-1',
    workflowKind: 'SINGLE_MODEL',
    ...overrides,
  } as never;
}

function catalogEntry() {
  return {
    action: 'STANDARD',
    catalogVersion: {
      costDimensions: null,
      id: 'catalog-1',
      language: 'fr-FR',
      modelId: 'model-1',
      pipelineIdentitySnapshot: null,
      pipelineVersionId: 'pipeline-1',
      promptVersion: '1.0.0',
      provider: 'provider-1',
      workflowKind: 'SINGLE_MODEL',
    },
    catalogVersionId: 'catalog-1',
    feeCredits: 1n,
    floorCredits: 2n,
    id: 'entry-1',
    includesAutomaticSecondPass: false,
    includesTargetedVerification: true,
    inputSizeClass: 'SHORT',
    providerMedianCostCredits: 4n,
    providerMedianCostUsd: new Prisma.Decimal('0.01'),
    providerP90CostCredits: 8n,
    providerP90CostUsd: new Prisma.Decimal('0.02'),
    safetyCoefficient: new Prisma.Decimal('1.25'),
    targetMarginCredits: 3n,
  };
}

function harness() {
  const prisma = {
    aiPricingCatalogEntry: { count: vi.fn(), findMany: vi.fn() },
    aiPricingQuote: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  };
  return {
    prisma,
    repository: new PrismaAiPricingQuoteRepository(
      prisma as unknown as PrismaClient,
    ),
  };
}

describe('PrismaAiPricingQuoteRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delegates target resolution to the pricing boundary', async () => {
    const { prisma, repository } = harness();
    resolvePricingTarget.mockResolvedValueOnce({ eligible: true });
    await expect(
      repository.resolveTarget('user-1', { kind: 'EXERCISE_SUBMISSION' } as never),
    ).resolves.toEqual({ eligible: true });
    expect(resolvePricingTarget).toHaveBeenCalledWith(
      prisma,
      'user-1',
      expect.any(Object),
    );
  });

  it('requires exactly one active catalog entry', async () => {
    const { prisma, repository } = harness();
    prisma.aiPricingCatalogEntry.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([catalogEntry(), catalogEntry()])
      .mockResolvedValueOnce([catalogEntry()]);
    const input = {
      action: 'STANDARD' as const,
      inputChars: 1_000,
      language: 'fr-FR' as const,
      now,
    } as never;

    await expect(repository.findActiveEntry(input)).resolves.toBeNull();
    await expect(repository.findActiveEntry(input)).rejects.toEqual(
      new AiPricingError('INVALID_CATALOG_METRICS'),
    );
    await expect(repository.findActiveEntry(input)).resolves.toMatchObject({
      catalog: { id: 'catalog-1' },
      entry: {
        id: 'entry-1',
        safetyCoefficientBasisPoints: 12_500n,
      },
    });
  });

  it('persists the full immutable quote snapshot', async () => {
    const { prisma, repository } = harness();
    prisma.aiPricingQuote.create.mockResolvedValueOnce(storedQuote());

    await expect(
      repository.createQuote({
        catalog: catalogEntry().catalogVersion,
        entry: {
          ...catalogEntry(),
          providerMedianCostUsd: '0.01000000',
          providerP90CostUsd: '0.02000000',
          safetyCoefficientBasisPoints: 12_500n,
        },
        expiresAt: new Date('2026-08-28T12:15:00.000Z'),
        idempotencyKey: 'quote:idempotency:1',
        inputChars: 1_000,
        price: {
          ceilingCredits: 20n,
          estimatedCredits: 10n,
          floorCredits: 2n,
        },
        requestFingerprint: 'fingerprint',
        target: {
          contract: { contractKey: 'writing-contract', version: '1.0.0' },
          reconsideration: null,
          target: { id: 'submission-1', kind: 'EXERCISE_SUBMISSION' },
        },
        userId: 'user-1',
      } as never),
    ).resolves.toMatchObject({ id: 'quote-1' });
    expect(prisma.aiPricingQuote.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        costDimensionsSnapshot: Prisma.JsonNull,
        pipelineIdentitySnapshot: Prisma.JsonNull,
        safetyCoefficientSnapshot: 1.25,
      }),
    });
  });

  it('finds stored quotes by idempotency or id and preserves misses', async () => {
    const { prisma, repository } = harness();
    prisma.aiPricingQuote.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(storedQuote());
    prisma.aiPricingQuote.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(storedQuote());

    await expect(
      repository.findQuoteByIdempotency('user-1', 'missing'),
    ).resolves.toBeNull();
    await expect(
      repository.findQuoteByIdempotency('user-1', 'quote:idempotency:1'),
    ).resolves.toMatchObject({ id: 'quote-1' });
    await expect(repository.findQuoteById('user-1', 'missing')).resolves.toBeNull();
    await expect(repository.findQuoteById('user-1', 'quote-1')).resolves.toMatchObject({
      id: 'quote-1',
    });
  });

  it('requires a provider and one compatible promoted catalog entry', async () => {
    const { prisma, repository } = harness();
    await expect(
      repository.isQuoteCurrentlyCompatible(
        storedQuote({ provider: null }),
        now,
      ),
    ).resolves.toBe(false);

    prisma.aiPricingCatalogEntry.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    await expect(
      repository.isQuoteCurrentlyCompatible(storedQuote(), now),
    ).resolves.toBe(true);
    await expect(
      repository.isQuoteCurrentlyCompatible(storedQuote(), now),
    ).resolves.toBe(false);
  });
});
