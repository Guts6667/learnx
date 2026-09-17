import { createAiPricingApp } from './app';

const fixtures = vi.hoisted(() => ({
  send: vi.fn(async () => undefined),
  prisma: {
    aiCorrection: {
      findMany: vi.fn(async () =>
        Array.from({ length: 50 }, () => ({
          criterionFeedback: [],
          structuredResult: { correction: { status: 'FAILED' } },
        })),
      ),
    },
    aiCorrectionBreakerEvent: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({
        id: 'trip-1',
        createdAt: new Date('2026-09-17T00:00:00Z'),
      })),
      update: vi.fn(async () => ({})),
    },
  },
}));
vi.mock('../../prisma.js', () => ({ prisma: fixtures.prisma }));
vi.mock('../../corrections/owner-alert.js', () => ({
  ownerAlert: () => ({ send: fixtures.send }),
}));

it('notifies the configured owner when the real quote composition trips', async () => {
  const app = createAiPricingApp({
    authentication: async (context, next) => {
      context.set('user', {
        id: 'user-1',
        displayName: 'Test',
        email: 'test@example.test',
        locale: 'fr',
        role: 'USER',
      });
      await next();
    },
    authorization: async (_context, next) => next(),
  });
  const response = await app.request('/api/ai-correction/quotes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'STANDARD',
      idempotencyKey: 'recovery-test',
      target: {
        id: '11111111-1111-4111-8111-111111111111',
        kind: 'EXERCISE_SUBMISSION',
      },
    }),
  });
  expect(response.status).toBe(503);
  expect(fixtures.send).toHaveBeenCalledOnce();
  expect(fixtures.prisma.aiCorrectionBreakerEvent.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: { alertedAt: expect.any(Date) },
    }),
  );
});
