import type { MiddlewareHandler } from 'hono';

import { BREAKER_THRESHOLDS } from '@/lib/ai-correction-breaker';
import { describe, expect, it, vi } from 'vitest';

import type { AuthEnvironment } from '../_lib/auth';
import { createCorrectionsApp, isPromotedCorrectionConfiguration } from './app';
import {
  PROMOTED_CHECKER_IDENTITY,
  PROMOTED_CORRECTION_IDENTITY,
} from '../../corrections/promoted-identity';
import { CorrectionOrchestrationError } from '../../corrections/correction-orchestration';

const userId = '11111111-1111-4111-8111-111111111111';
const quoteId = '22222222-2222-4222-8222-222222222222';

function authentication(
  role: 'ADMIN' | 'USER' = 'USER',
): MiddlewareHandler<AuthEnvironment> {
  return async (context, next) => {
    context.set('user', {
      displayName: 'Rayan',
      email: 'rayan@example.com',
      id: userId,
      locale: 'fr',
      role,
    });
    await next();
  };
}

const authorization: MiddlewareHandler<AuthEnvironment> = async (
  _context,
  next,
) => next();

describe('corrections API', () => {
  it('requires the same promoted model and provider for primary and score-guard passes', () => {
    const base = {
      apiKey: 'test-key',
      appUrl: 'https://learnx.test',
      assignments: {
        CORRECTION_PRIMARY: {
          modelId: PROMOTED_CORRECTION_IDENTITY.modelId,
          provider: PROMOTED_CORRECTION_IDENTITY.provider,
        },
        CORRECTION_SECOND_PASS: {
          modelId: PROMOTED_CORRECTION_IDENTITY.modelId,
          provider: PROMOTED_CORRECTION_IDENTITY.provider,
        },
      },
      deploymentEnvironment: 'development' as const,
      enabled: true,
      killSwitch: false,
      maxContextCharacters: 120_000,
      maxOutputTokens: 1_500,
      maxRetryDelayMs: 0,
      requestTimeoutMs: 60_000,
    };

    expect(isPromotedCorrectionConfiguration(base)).toBe(true);
    expect(
      isPromotedCorrectionConfiguration({
        ...base,
        assignments: {
          ...base.assignments,
          CORRECTION_SECOND_PASS: {
            ...base.assignments.CORRECTION_SECOND_PASS,
            modelId: 'anthropic/another-model',
          },
        },
      }),
    ).toBe(false);
  });

  it('resolves and caches the deployment orchestration instead of returning 503', async () => {
    const runAcceptedQuote = vi.fn().mockResolvedValue({
      correction: {
        criteria: [],
        id: 'correction-1',
        indicativeScore: 100,
        modelUsageCostUsd: 0.01,
        monitoringSignals: [],
        overallFeedback: 'Retour formatif.',
        status: 'COMPLETED',
        unsureCriteria: [],
      },
      replay: false,
      settlement: {
        releasedCredits: '4',
        reservedCredits: '16',
        settledCredits: '12',
      },
    });
    const resolveDefaultOrchestration = vi
      .fn()
      .mockResolvedValue({ runAcceptedQuote });
    const app = createCorrectionsApp({
      authentication: authentication(),
      authorization,
      resolveDefaultOrchestration,
    });

    for (const id of [quoteId, '33333333-3333-4333-8333-333333333333']) {
      const response = await app.request('/api/ai-corrections', {
        body: JSON.stringify({ quoteId: id }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      expect(response.status).toBe(201);
    }

    expect(resolveDefaultOrchestration).toHaveBeenCalledTimes(1);
    expect(runAcceptedQuote).toHaveBeenNthCalledWith(1, { quoteId, userId });
  });

  it('fails closed when the kill switch or configuration leaves no orchestration', async () => {
    const app = createCorrectionsApp({
      authentication: authentication(),
      authorization,
      resolveDefaultOrchestration: async () => null,
    });

    const response = await app.request('/api/ai-corrections', {
      body: JSON.stringify({ quoteId }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'AI_CORRECTION_UNAVAILABLE' },
    });
  });

  it('fails closed without a provider replay when finance requires reconciliation', async () => {
    const app = createCorrectionsApp({
      authentication: authentication(),
      authorization,
      orchestration: {
        runAcceptedQuote: vi.fn(async () => {
          throw new CorrectionOrchestrationError(
            'FINANCIAL_RECONCILIATION_REQUIRED',
          );
        }),
      },
    });

    const response = await app.request('/api/ai-corrections', {
      body: JSON.stringify({ quoteId }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'AI_CORRECTION_UNAVAILABLE' },
    });
  });

  it('expose le suivi minimal aux administrateurs uniquement', async () => {
    const monitoring = {
      summary: vi.fn().mockResolvedValue({
        completed: 2,
        hardConstraintLevelMismatchSuspected: 1,
        partial: 1,
        scoreGuardTriggered: 1,
        totalCorrections: 3,
        totalProviderCostUsd: '0.05200000',
        unavailable: 0,
        unknownCostAttempts: 0,
      }),
    };
    const app = createCorrectionsApp({
      authentication: authentication('ADMIN'),
      authorization,
      monitoring,
    });

    const response = await app.request('/api/admin/ai-corrections/monitoring');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      monitoring: { totalCorrections: 3 },
    });
  });

  it('expose un préflight de release sans secret ni appel fournisseur', async () => {
    const app = createCorrectionsApp({
      authentication: authentication('ADMIN'),
      authorization,
      preflight: {
        apiKeyPresent: true,
        checker: 'PROMOTED',
        checkerPromotedModelId: PROMOTED_CHECKER_IDENTITY.modelId,
        checkerScientificallyMeasured: false,
        deploymentEnvironment: 'preview',
        identityMatches: true,
        killSwitch: true,
        promotedBenchmarkId: 'learnx-french-text-correction-v3-1',
        state: 'CONFIGURED_CLOSED',
        transport: 'REAL',
      },
    });

    const response = await app.request('/api/admin/ai-corrections/preflight');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      preflight: {
        apiKeyPresent: true,
        checker: 'PROMOTED',
        checkerPromotedModelId: PROMOTED_CHECKER_IDENTITY.modelId,
        checkerScientificallyMeasured: false,
        deploymentEnvironment: 'preview',
        identityMatches: true,
        killSwitch: true,
        promotedBenchmarkId: 'learnx-french-text-correction-v3-1',
        state: 'CONFIGURED_CLOSED',
        transport: 'REAL',
      },
    });
  });
});

describe('transport factice câblé (V4.5-116)', () => {
  const identity = {
    LEARNX_AI_ALLOWED_MODELS: `${PROMOTED_CORRECTION_IDENTITY.modelId},${PROMOTED_CHECKER_IDENTITY.modelId}`,
    LEARNX_AI_ALLOWED_PROVIDERS: `${PROMOTED_CORRECTION_IDENTITY.provider},${PROMOTED_CHECKER_IDENTITY.provider}`,
    LEARNX_AI_CONFIG_ENVIRONMENT: 'development',
    LEARNX_AI_CORRECTION_CHECKER_MODEL: PROMOTED_CHECKER_IDENTITY.modelId,
    LEARNX_AI_CORRECTION_CHECKER_PROVIDER: PROMOTED_CHECKER_IDENTITY.provider,
    LEARNX_AI_CORRECTION_PRIMARY_MODEL: PROMOTED_CORRECTION_IDENTITY.modelId,
    LEARNX_AI_CORRECTION_PRIMARY_PROVIDER:
      PROMOTED_CORRECTION_IDENTITY.provider,
    LEARNX_AI_CORRECTION_SECOND_PASS_MODEL:
      PROMOTED_CORRECTION_IDENTITY.modelId,
    LEARNX_AI_CORRECTION_SECOND_PASS_PROVIDER:
      PROMOTED_CORRECTION_IDENTITY.provider,
    LEARNX_AI_ENABLED: 'true',
    LEARNX_AI_KILL_SWITCH: 'false',
    OPENROUTER_API_KEY: 'server-secret',
    APP_URL: 'https://preview.learn-x.app',
  };

  function stub(values: Record<string, string>) {
    for (const [key, value] of Object.entries({ ...identity, ...values })) {
      vi.stubEnv(key, value);
    }
  }

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ['fake', 'FAKE'],
    ['', 'REAL'],
  ])(
    'annonce le transport réellement construit (%s)',
    async (flag, expected) => {
      // The V4.5-111 defect: the preflight resolved the mode on its own while
      // the composition root always built the real transport, so it could
      // announce FAKE while spending real money. Both now read one selection.
      stub({ LEARNX_AI_TRANSPORT: flag });
      const app = createCorrectionsApp({
        authentication: authentication('ADMIN'),
        authorization,
      });

      const response = await app.request('/api/admin/ai-corrections/preflight');
      const body = (await response.json()) as {
        preflight: { state: string; transport: string };
      };

      expect(body.preflight.transport).toBe(expected);
      expect(body.preflight.state).toBe('READY');
    },
  );

  it('bloque la configuration quand le faux transport est demandé en production', async () => {
    stub({
      LEARNX_AI_CONFIG_ENVIRONMENT: 'production',
      LEARNX_AI_TRANSPORT: 'fake',
    });
    const app = createCorrectionsApp({
      authentication: authentication('ADMIN'),
      authorization,
    });

    const response = await app.request('/api/admin/ai-corrections/preflight');
    const body = (await response.json()) as {
      preflight: { state: string };
    };

    expect(body.preflight.state).toBe('CONFIGURATION_BLOCKED');
  });
});

const closedStatus = {
  evaluationError: null,
  rates: { checkerDisagreement: null, unusable: null, wrongAtHigh: null },
  reason: null,
  state: 'CLOSED' as const,
  thresholds: BREAKER_THRESHOLDS,
  trippedAt: null,
  trippedRates: {
    checkerDisagreement: null,
    unusable: null,
    wrongAtHigh: null,
  },
  window: { observed: 0, size: 50 },
};

describe('coupe-circuit de correction (V4.5-140)', () => {
  const closed = closedStatus;

  function build(overrides: Record<string, unknown> = {}) {
    const reopen = vi.fn(async () => undefined);
    const app = createCorrectionsApp({
      authentication: authentication('ADMIN'),
      authorization,
      breaker: {
        evaluate: vi.fn(async () => closed),
        events: vi.fn(async () => []),
        reopen,
        status: vi.fn(async () => closed),
        ...overrides,
      },
    });
    return { app, reopen };
  }

  it('enregistre qui rouvre et pourquoi', async () => {
    const { app, reopen } = build();
    const response = await app.request(
      '/api/admin/ai-corrections/breaker/reopen',
      {
        body: JSON.stringify({ note: 'fournisseur rétabli' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      },
    );

    expect(response.status).toBe(200);
    expect(reopen).toHaveBeenCalledWith({
      actorId: userId,
      note: 'fournisseur rétabli',
    });
  });

  it('accepte une réouverture sans note', async () => {
    const { app, reopen } = build();
    const response = await app.request(
      '/api/admin/ai-corrections/breaker/reopen',
      { method: 'POST' },
    );
    expect(response.status).toBe(200);
    expect(reopen).toHaveBeenCalledWith({ actorId: userId });
  });

  it('refuse une note hors format sans rien écrire', async () => {
    const { app, reopen } = build();
    const response = await app.request(
      '/api/admin/ai-corrections/breaker/reopen',
      {
        body: JSON.stringify({ note: 'x'.repeat(501) }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      },
    );
    expect(response.status).toBe(400);
    expect(reopen).not.toHaveBeenCalled();
  });
});

describe('journal du coupe-circuit (V4.5-143)', () => {
  const event = {
    actorId: null,
    actorName: null,
    alertError: 'resend refused',
    alertedAt: null,
    at: '2026-08-29T12:00:00.000Z',
    id: 'event-1',
    kind: 'TRIPPED' as const,
    note: null,
    rate: 0.6,
    reason: 'CHECKER_DISAGREEMENT' as const,
    threshold: 0.4,
    windowSize: 50,
  };

  it('rend le journal, du plus récent au plus ancien', async () => {
    const app = createCorrectionsApp({
      authentication: authentication('ADMIN'),
      authorization,
      breaker: {
        evaluate: vi.fn(async () => closedStatus),
        events: vi.fn(async () => [event]),
        reopen: vi.fn(async () => undefined),
        status: vi.fn(async () => closedStatus),
      },
    });

    const response = await app.request(
      '/api/admin/ai-corrections/breaker/events',
    );

    expect(response.status).toBe(200);
    // The undelivered alert is part of the record: a journal that showed only
    // the trip would hide that nobody was told about it.
    await expect(response.json()).resolves.toEqual({
      resource: { events: [event] },
    });
  });
});
