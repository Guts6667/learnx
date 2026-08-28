import { Hono, type MiddlewareHandler } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import type { AuthEnvironment } from '../_lib/auth.js';
import { createAiPricingApp } from './app.js';

function passThrough(spy: () => void): MiddlewareHandler<AuthEnvironment> {
  return async (_context, next) => {
    spy();
    await next();
  };
}

describe('AI pricing API middleware scope', () => {
  it('does not intercept protected routes owned by another API module', async () => {
    const authentication = vi.fn();
    const authorization = vi.fn();
    const root = new Hono();

    root.route(
      '/',
      createAiPricingApp({
        authentication: passThrough(authentication),
        authorization: passThrough(authorization),
      }),
    );
    root.get('/api/programs', (context) => context.json({ programs: [] }));

    const response = await root.request('/api/programs');

    expect(response.status).toBe(200);
    expect(authentication).not.toHaveBeenCalled();
    expect(authorization).not.toHaveBeenCalled();
  });

  it('keeps authentication and authorization on the pricing quote endpoint', async () => {
    const authentication = vi.fn();
    const authorization = vi.fn();
    const app = createAiPricingApp({
      authentication: passThrough(authentication),
      authorization: passThrough(authorization),
    });

    const response = await app.request('/api/ai-correction/quotes', {
      body: '{}',
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    expect(response.status).toBe(400);
    expect(authentication).toHaveBeenCalledOnce();
    expect(authorization).toHaveBeenCalledOnce();
  });

  it('returns the quote in the resource envelope consumed by the learner client', async () => {
    const app = createAiPricingApp({
      authentication: async (context, next) => {
        context.set('user', {
          displayName: 'Rayan',
          email: 'rayan@example.com',
          id: '22222222-2222-4222-8222-222222222222',
          locale: 'fr',
          role: 'USER',
        });
        await next();
      },
      authorization: passThrough(() => undefined),
      service: {
        quote: vi.fn().mockResolvedValue({
          action: 'STANDARD',
          ceilingCredits: 18n,
          estimatedCredits: 12n,
          expiresAt: new Date('2026-08-24T19:00:00.000Z'),
          id: '89c42047-5133-4ef0-b2df-a6a39092f02f',
          includesAutomaticSecondPass: true,
          includesTargetedVerification: false,
        }),
      },
    });

    const response = await app.request('/api/ai-correction/quotes', {
      body: JSON.stringify({
        action: 'STANDARD',
        idempotencyKey: 'quote:request:api',
        target: {
          id: '11111111-1111-4111-8111-111111111111',
          kind: 'EXERCISE_SUBMISSION',
        },
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      resource: {
        quote: {
          estimatedCredits: '12',
          maximumReservedCredits: '18',
          releasePolicy: 'ACCEPTED_QUOTE_PRICE',
        },
      },
    });
  });

  it('accepts one bounded argued reconsideration linked to its source correction', async () => {
    const quote = vi.fn().mockResolvedValue({
      action: 'RECONSIDERATION',
      ceilingCredits: 6n,
      estimatedCredits: 3n,
      expiresAt: new Date('2026-08-26T19:00:00.000Z'),
      id: '89c42047-5133-4ef0-b2df-a6a39092f02f',
      includesAutomaticSecondPass: true,
      includesTargetedVerification: false,
    });
    const app = createAiPricingApp({
      authentication: async (context, next) => {
        context.set('user', {
          displayName: 'Rayan',
          email: 'rayan@example.com',
          id: '22222222-2222-4222-8222-222222222222',
          locale: 'fr',
          role: 'USER',
        });
        await next();
      },
      authorization: passThrough(() => undefined),
      service: { quote },
    });

    const response = await app.request('/api/ai-correction/quotes', {
      body: JSON.stringify({
        action: 'RECONSIDERATION',
        idempotencyKey: 'quote:reconsideration:api',
        target: {
          id: '11111111-1111-4111-8111-111111111111',
          kind: 'EXERCISE_SUBMISSION',
          reconsideration: {
            argument:
              'La preuve citée soutient le niveau supérieur de ce critère.',
            sourceCorrectionId: '33333333-3333-4333-8333-333333333333',
          },
        },
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    expect(response.status).toBe(201);
    expect(quote).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RECONSIDERATION',
        target: expect.objectContaining({
          reconsideration: expect.objectContaining({
            sourceCorrectionId: '33333333-3333-4333-8333-333333333333',
          }),
        }),
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      resource: { quote: { scope: 'RECONSIDERATION' } },
    });
  });

  it.each([
    { argumentLength: 19, expectedStatus: 400 },
    { argumentLength: 20, expectedStatus: 201 },
    { argumentLength: 500, expectedStatus: 201 },
    { argumentLength: 501, expectedStatus: 400 },
  ])(
    'enforces the trimmed reconsideration boundary at $argumentLength characters',
    async ({ argumentLength, expectedStatus }) => {
      const quote = vi.fn().mockResolvedValue({
        action: 'RECONSIDERATION',
        ceilingCredits: 6n,
        estimatedCredits: 3n,
        expiresAt: new Date('2026-08-26T19:00:00.000Z'),
        id: '89c42047-5133-4ef0-b2df-a6a39092f02f',
        includesAutomaticSecondPass: true,
        includesTargetedVerification: false,
      });
      const app = createAiPricingApp({
        authentication: async (context, next) => {
          context.set('user', {
            displayName: 'Rayan',
            email: 'rayan@example.com',
            id: '22222222-2222-4222-8222-222222222222',
            locale: 'fr',
            role: 'USER',
          });
          await next();
        },
        authorization: passThrough(() => undefined),
        service: { quote },
      });
      const trimmedArgument = 'a'.repeat(argumentLength);

      const response = await app.request('/api/ai-correction/quotes', {
        body: JSON.stringify({
          action: 'RECONSIDERATION',
          idempotencyKey: `quote:reconsideration:boundary:${argumentLength}`,
          target: {
            id: '11111111-1111-4111-8111-111111111111',
            kind: 'EXERCISE_SUBMISSION',
            reconsideration: {
              argument: `  ${trimmedArgument}  `,
              sourceCorrectionId: '33333333-3333-4333-8333-333333333333',
            },
          },
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });

      expect(response.status).toBe(expectedStatus);
      if (expectedStatus === 201) {
        expect(quote).toHaveBeenCalledOnce();
        expect(quote).toHaveBeenCalledWith(
          expect.objectContaining({
            target: expect.objectContaining({
              reconsideration: expect.objectContaining({
                argument: trimmedArgument,
              }),
            }),
          }),
        );
      } else {
        expect(quote).not.toHaveBeenCalled();
      }
    },
  );

  it.each([
    {
      action: 'RECONSIDERATION',
      reconsideration: undefined,
      title: 'missing reconsideration context',
    },
    {
      action: 'STANDARD',
      reconsideration: {
        argument: 'Cet argument contient largement plus de vingt caractères.',
        sourceCorrectionId: '33333333-3333-4333-8333-333333333333',
      },
      title: 'reconsideration context on a standard quote',
    },
    {
      action: 'RECONSIDERATION',
      reconsideration: {
        argument: 'Trop court',
        sourceCorrectionId: '33333333-3333-4333-8333-333333333333',
      },
      title: 'an argument shorter than twenty characters',
    },
  ])('rejects $title', async ({ action, reconsideration }) => {
    const quote = vi.fn();
    const app = createAiPricingApp({
      authentication: async (context, next) => {
        context.set('user', {
          displayName: 'Rayan',
          email: 'rayan@example.com',
          id: '22222222-2222-4222-8222-222222222222',
          locale: 'fr',
          role: 'USER',
        });
        await next();
      },
      authorization: passThrough(() => undefined),
      service: { quote },
    });

    const response = await app.request('/api/ai-correction/quotes', {
      body: JSON.stringify({
        action,
        idempotencyKey: 'quote:reconsideration:invalid',
        target: {
          id: '11111111-1111-4111-8111-111111111111',
          kind: 'EXERCISE_SUBMISSION',
          ...(reconsideration ? { reconsideration } : {}),
        },
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    expect(response.status).toBe(400);
    expect(quote).not.toHaveBeenCalled();
  });
});
