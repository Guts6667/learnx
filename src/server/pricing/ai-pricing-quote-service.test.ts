import { AiPricingQuoteService } from './ai-pricing-quote-service';
describe('coupe-circuit au moment du devis (V4.5-140)', () => {
  it('refuse un devis quand le coupe-circuit est ouvert, sans toucher la cible', async () => {
    // Refused before paying rather than refunded after: an open breaker must
    // not reserve credits it will never spend.
    const resolveTarget = vi.fn();
    const service = new AiPricingQuoteService(
      { resolveTarget } as never,
      () => new Date('2026-08-29T10:00:00Z'),
      { evaluate: vi.fn(async () => ({ state: 'OPEN' as const })) },
    );

    await expect(
      service.quote({
        action: 'STANDARD',
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
        target: {
          id: '22222222-2222-4222-8222-222222222222',
          kind: 'EXERCISE_SUBMISSION',
        },
        userId: '33333333-3333-4333-8333-333333333333',
      }),
    ).rejects.toMatchObject({ code: 'CORRECTION_SUSPENDED' });
    expect(resolveTarget).not.toHaveBeenCalled();
  });
});
