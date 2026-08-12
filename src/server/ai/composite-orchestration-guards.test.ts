import { describe, expect, it, vi } from 'vitest';

import type { AiPricingQuoteRepository, StoredPricingQuote } from '../pricing/ai-pricing.js';
import { DefaultCompositeOrchestrationGuards } from './composite-orchestration-guards.js';

const quote = {
  expiresAt: new Date('2026-08-13T10:00:00.000Z'),
  id: 'quote-id',
} as StoredPricingQuote;

function repository(): AiPricingQuoteRepository {
  return {
    createQuote: vi.fn(),
    findActiveEntry: vi.fn(),
    findQuoteById: vi.fn().mockResolvedValue(quote),
    findQuoteByIdempotency: vi.fn(),
    isQuoteCurrentlyCompatible: vi.fn().mockResolvedValue(true),
    resolveTarget: vi.fn(),
  };
}

describe('composite orchestration guards', () => {
  it('rejects an expired quote before runtime execution', async () => {
    const runtime = { assertAllowed: vi.fn() };
    const guards = new DefaultCompositeOrchestrationGuards(
      repository(),
      runtime,
      () => new Date('2026-08-13T10:00:00.000Z'),
    );
    await expect(
      guards.validateQuote({ quoteId: 'quote-id', userId: 'user-id' }),
    ).rejects.toMatchObject({ code: 'QUOTE_EXPIRED' });
    expect(runtime.assertAllowed).not.toHaveBeenCalled();
  });

  it('revalidates operational limits independently for every provider role', async () => {
    const runtime = { assertAllowed: vi.fn().mockResolvedValue(undefined) };
    const guards = new DefaultCompositeOrchestrationGuards(
      repository(),
      runtime,
      () => new Date('2026-08-13T09:00:00.000Z'),
    );
    await guards.assertProviderCallAllowed({
      correctionId: 'correction-id',
      role: 'PRIMARY',
      userId: 'user-id',
    });
    await guards.assertProviderCallAllowed({
      correctionId: 'correction-id',
      role: 'TARGETED_VERIFIER',
      userId: 'user-id',
    });
    expect(runtime.assertAllowed).toHaveBeenCalledTimes(2);
  });
});
