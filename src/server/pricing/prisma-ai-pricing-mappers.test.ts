import {
  type AiPricingQuote,
  Prisma,
} from '../../../generated/prisma/client.js';
import { describe, expect, it } from 'vitest';

import { AiPricingError } from './ai-pricing.js';
import {
  asPricingJson,
  catalogSnapshot,
  entrySnapshot,
  storedQuote,
} from './prisma-ai-pricing-mappers.js';

function quote(overrides: Partial<AiPricingQuote> = {}): AiPricingQuote {
  return {
    action: 'STANDARD',
    catalogVersionId: 'catalog-1',
    ceilingCredits: 20n,
    contractKey: 'contract',
    contractVersion: '1.0.0',
    costDimensionsSnapshot: { calls: 1 },
    createdAt: new Date('2026-08-28T00:00:00.000Z'),
    estimatedCredits: 10n,
    expiresAt: new Date('2026-08-28T00:15:00.000Z'),
    feeCreditsSnapshot: 1n,
    floorCredits: 2n,
    id: 'quote-1',
    idempotencyKey: 'idem-1',
    includesAutomaticSecondPass: true,
    includesTargetedVerification: false,
    inputSizeClass: 'SHORT',
    language: 'fr-FR',
    modelId: 'model-1',
    pipelineIdentitySnapshot: null,
    pipelineVersionId: null,
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
  } as AiPricingQuote;
}

describe('Prisma AI pricing mappers', () => {
  it('normalizes entry decimals and preserves catalog/json values', () => {
    const catalog = { id: 'catalog-1' } as never;
    expect(catalogSnapshot(catalog)).toBe(catalog);
    expect(asPricingJson({ calls: 2 })).toEqual({ calls: 2 });

    expect(
      entrySnapshot({
        action: 'STANDARD',
        catalogVersionId: 'catalog-1',
        feeCredits: 1n,
        floorCredits: 2n,
        id: 'entry-1',
        includesAutomaticSecondPass: true,
        includesTargetedVerification: false,
        inputSizeClass: 'SHORT',
        providerMedianCostCredits: 3n,
        providerMedianCostUsd: new Prisma.Decimal('0.123456789'),
        providerP90CostCredits: 4n,
        providerP90CostUsd: new Prisma.Decimal('0.987654321'),
        safetyCoefficient: new Prisma.Decimal('1.25'),
        targetMarginCredits: 5n,
      }),
    ).toMatchObject({
      action: 'STANDARD',
      providerMedianCostUsd: '0.12345679',
      providerP90CostUsd: '0.98765432',
      safetyCoefficientBasisPoints: 12_500n,
    });
  });

  it('rejects unknown actions and fractional basis points', () => {
    const base = {
      action: 'UNKNOWN',
      catalogVersionId: 'catalog-1',
      feeCredits: 1n,
      floorCredits: 2n,
      id: 'entry-1',
      includesAutomaticSecondPass: false,
      includesTargetedVerification: false,
      inputSizeClass: 'SHORT' as const,
      providerMedianCostCredits: 3n,
      providerMedianCostUsd: new Prisma.Decimal('0.1'),
      providerP90CostCredits: 4n,
      providerP90CostUsd: new Prisma.Decimal('0.2'),
      safetyCoefficient: new Prisma.Decimal('1.25'),
      targetMarginCredits: 5n,
    };
    expect(() => entrySnapshot(base)).toThrow(
      new AiPricingError('ACTION_UNAVAILABLE'),
    );
    expect(() =>
      entrySnapshot({
        ...base,
        action: 'STANDARD',
        safetyCoefficient: new Prisma.Decimal('1.00001'),
      }),
    ).toThrow(new AiPricingError('INVALID_CATALOG_METRICS'));
  });

  it('maps stored quotes with and without reconsideration', () => {
    expect(storedQuote(quote())).not.toHaveProperty('reconsideration');
    expect(
      storedQuote(
        quote({
          reconsiderationArgument: 'Le critère a été mal interprété.',
          reconsiderationOfCorrectionId: 'correction-1',
        }),
      ),
    ).toMatchObject({
      reconsideration: {
        argument: 'Le critère a été mal interprété.',
        sourceCorrectionId: 'correction-1',
      },
      target: { id: 'submission-1', kind: 'EXERCISE_SUBMISSION' },
    });
  });
});
