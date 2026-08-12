import {
  AiPricingError,
  type AiPricingQuoteRepository,
  type StoredPricingQuote,
} from '../pricing/ai-pricing.js';
import type {
  CompositeOrchestrationGuards,
} from './composite-correction-orchestrator.js';

export interface CompositeProviderRuntimeGuard {
  assertAllowed(input: {
    correctionId: string;
    role: 'PRIMARY' | 'TARGETED_VERIFIER';
    userId: string;
  }): Promise<void>;
}

export class DefaultCompositeOrchestrationGuards
  implements CompositeOrchestrationGuards
{
  public constructor(
    private readonly quotes: AiPricingQuoteRepository,
    private readonly runtime: CompositeProviderRuntimeGuard,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  public async validateQuote(input: {
    quoteId: string;
    userId: string;
  }): Promise<StoredPricingQuote> {
    const quote = await this.quotes.findQuoteById(input.userId, input.quoteId);
    if (!quote) throw new AiPricingError('TARGET_NOT_FOUND');
    const now = this.clock();
    if (quote.expiresAt.getTime() <= now.getTime()) {
      throw new AiPricingError('QUOTE_EXPIRED');
    }
    if (!(await this.quotes.isQuoteCurrentlyCompatible(quote, now))) {
      throw new AiPricingError('QUOTE_INCOMPATIBLE');
    }
    return quote;
  }

  public async assertProviderCallAllowed(input: {
    correctionId: string;
    role: 'PRIMARY' | 'TARGETED_VERIFIER';
    userId: string;
  }): Promise<void> {
    await this.runtime.assertAllowed(input);
  }
}
