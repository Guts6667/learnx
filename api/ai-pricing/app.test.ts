import type { MiddlewareHandler } from 'hono';

import type { Role } from '../../generated/prisma/client';
import { createAiPricingApp } from '../../src/server/api/ai-pricing/app';
import type { AuthEnvironment } from '../../src/server/api/_lib/auth';
import {
  AiPricingError,
  type StoredPricingQuote,
} from '../../src/server/pricing/ai-pricing';

const userId = '7c777cf7-8f6b-421c-88f4-d17c8d530e93';
const targetId = '11111111-1111-4111-8111-111111111111';

const allow: MiddlewareHandler<AuthEnvironment> = async (context, next) => {
  context.set('user', {
    displayName: 'Learner',
    email: 'learner@example.com',
    id: userId,
    locale: 'fr',
    role: 'USER' as Role,
  });
  await next();
};

const quote: StoredPricingQuote = {
  action: 'STANDARD',
  catalogVersionId: 'catalog-id',
  ceilingCredits: 18n,
  contractKey: 'contract-key',
  contractVersion: '1.0.0',
  createdAt: new Date('2026-08-12T13:00:00.000Z'),
  estimatedCredits: 10n,
  expiresAt: new Date('2026-08-12T13:15:00.000Z'),
  floorCredits: 8n,
  id: '22222222-2222-4222-8222-222222222222',
  includesAutomaticSecondPass: true,
  inputSizeClass: 'SHORT',
  language: 'fr-FR',
  modelId: 'internal-model',
  promptVersion: '1.0.0',
  requestFingerprint: 'a'.repeat(64),
  target: { id: targetId, kind: 'EXERCISE_SUBMISSION' },
  userId,
};

describe('AI pricing quote API', () => {
  it('returns only learner-safe quote fields calculated by the server', async () => {
    const service = { quote: vi.fn().mockResolvedValue(quote) };
    const app = createAiPricingApp({
      authentication: allow,
      authorization: allow,
      service,
    });
    const response = await app.request('/api/ai-correction/quotes', {
      body: JSON.stringify({
        action: 'STANDARD',
        idempotencyKey: 'quote:request:123',
        target: { id: targetId, kind: 'EXERCISE_SUBMISSION' },
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({
      quote: {
        action: 'STANDARD',
        currency: 'LEARNX_CREDIT',
        estimatedCredits: '10',
        expiresAt: '2026-08-12T13:15:00.000Z',
        id: quote.id,
        includesAutomaticSecondPass: true,
        maximumReservedCredits: '18',
        releasePolicy: 'ACTUAL_USAGE_ONLY',
        scope: 'PRIMARY',
      },
    });
    expect(JSON.stringify(body)).not.toMatch(
      /provider|model|prompt|margin|percentile|token/i,
    );
    expect(service.quote).toHaveBeenCalledWith({
      action: 'STANDARD',
      idempotencyKey: 'quote:request:123',
      target: { id: targetId, kind: 'EXERCISE_SUBMISSION' },
      userId,
    });
  });

  it('rejects client-supplied amounts and catalog versions', async () => {
    const service = { quote: vi.fn().mockResolvedValue(quote) };
    const app = createAiPricingApp({
      authentication: allow,
      authorization: allow,
      service,
    });
    const response = await app.request('/api/ai-correction/quotes', {
      body: JSON.stringify({
        action: 'STANDARD',
        catalogVersion: 'attacker-version',
        idempotencyKey: 'quote:request:tampered',
        maximumReservedCredits: '1',
        target: { id: targetId, kind: 'EXERCISE_SUBMISSION' },
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    expect(response.status).toBe(400);
    expect(service.quote).not.toHaveBeenCalled();
  });

  it('fails closed when no measured active catalog is available', async () => {
    const app = createAiPricingApp({
      authentication: allow,
      authorization: allow,
      service: {
        quote: vi
          .fn()
          .mockRejectedValue(new AiPricingError('CATALOG_UNAVAILABLE')),
      },
    });
    const response = await app.request('/api/ai-correction/quotes', {
      body: JSON.stringify({
        action: 'STANDARD',
        idempotencyKey: 'quote:request:inactive',
        target: { id: targetId, kind: 'EXERCISE_SUBMISSION' },
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: {
        code: 'PRICING_UNAVAILABLE',
        message: 'Estimation unavailable. No correction will be started.',
      },
    });
  });
});
