import { createCorrectionsApp } from './app';
import {
  buildHarness,
  strictOutput,
  type Harness,
} from '../../corrections/correction-orchestration.test-support';
import {
  PROMOTED_CHECKER_IDENTITY,
  PROMOTED_CORRECTION_IDENTITY,
} from '../../corrections/promoted-identity';
import type { OrchestratedCorrectionResult } from '../../corrections/correction-orchestration-contracts';

const state = vi.hoisted(() => ({
  harness: null as Harness | null,
  open: false,
}));
function currentHarness(): Harness {
  if (!state.harness) throw new Error('Test harness not initialized');
  return state.harness;
}

vi.mock('../../prisma.js', () => ({ prisma: {} }));
vi.mock('../../corrections/prisma-correction-orchestration-store.js', () => ({
  PrismaCorrectionOrchestrationPorts: class {
    get quotes() {
      return currentHarness().quotes;
    }
    get corrections() {
      return currentHarness().corrections;
    }
  },
}));
vi.mock('../../credits/prisma-credit-ledger.js', () => ({
  PrismaCreditLedger: class {
    async offeredLotIds() {
      return [];
    }
    async reserve(input: unknown) {
      const result = await currentHarness().credits.reserve(input);
      return { reservation: { id: result.reservationId } };
    }
    async settle(input: unknown) {
      await currentHarness().credits.settle(input);
    }
    async release(input: unknown) {
      await currentHarness().credits.release(input);
    }
  },
}));
vi.mock('../../corrections/correction-breaker.js', () => ({
  PrismaCorrectionBreaker: class {
    async evaluate() {
      return { state: state.open ? 'OPEN' : 'CLOSED' };
    }
  },
}));
vi.mock('../../corrections/owner-alert.js', () => ({
  ownerAlert: () => undefined,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  state.open = false;
});
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('Provider network forbidden');
    }),
  );
});

function application() {
  const identity = PROMOTED_CORRECTION_IDENTITY;
  const checker = PROMOTED_CHECKER_IDENTITY;
  for (const [key, value] of Object.entries({
    LEARNX_AI_ALLOWED_MODELS: `${identity.modelId},${checker.modelId}`,
    LEARNX_AI_ALLOWED_PROVIDERS: `${identity.provider},${checker.provider}`,
    LEARNX_AI_CONFIG_ENVIRONMENT: 'development',
    LEARNX_AI_ENABLED: 'true',
    LEARNX_AI_KILL_SWITCH: 'false',
    LEARNX_AI_CORRECTION_PRIMARY_MODEL: identity.modelId,
    LEARNX_AI_CORRECTION_PRIMARY_PROVIDER: identity.provider,
    LEARNX_AI_CORRECTION_SECOND_PASS_MODEL: identity.modelId,
    LEARNX_AI_CORRECTION_SECOND_PASS_PROVIDER: identity.provider,
    LEARNX_AI_CORRECTION_CHECKER_MODEL: checker.modelId,
    LEARNX_AI_CORRECTION_CHECKER_PROVIDER: checker.provider,
    LEARNX_AI_TRANSPORT: 'fake',
    OPENROUTER_API_KEY: 'must-never-leave-this-test',
    APP_URL: 'https://example.test',
    VERCEL_ENV: '',
  }))
    vi.stubEnv(key, value);
  return createCorrectionsApp({
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
}

async function request(app: ReturnType<typeof application>) {
  return app.request('/api/ai-corrections', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ quoteId: '11111111-1111-4111-8111-111111111111' }),
  });
}

it('keeps the real API composition entirely offline in FAKE mode, checker included', async () => {
  state.harness = buildHarness({ transport: strictOutput });
  state.harness.quotes.loadAcceptedQuote = vi.fn(async () => ({
    ...(
      await import('../../corrections/correction-orchestration.test-support')
    ).buildQuote(),
    expiresAt: new Date('2099-01-01T00:00:00Z'),
  }));
  const network = vi.fn(() => {
    throw new Error('Unexpected provider call');
  });
  vi.stubGlobal('fetch', network);
  const response = await request(application());
  expect(response.status).toBe(201);
  expect(network).not.toHaveBeenCalled();
  expect(state.harness.corrections.attemptOutcomes).toHaveLength(2);
});

it.each(['breaker', 'killSwitch'])(
  'checks %s before an accepted unstarted quote even in a warm process',
  async (stop) => {
    state.harness = buildHarness({ transport: strictOutput });
    state.harness.quotes.loadAcceptedQuote = vi.fn(async () => ({
      ...(
        await import('../../corrections/correction-orchestration.test-support')
      ).buildQuote(),
      expiresAt: new Date('2099-01-01T00:00:00Z'),
    }));
    const app = application();
    expect((await request(app)).status).toBe(201);
    state.harness.credits.calls.length = 0;
    if (stop === 'breaker') state.open = true;
    else vi.stubEnv('LEARNX_AI_KILL_SWITCH', 'true');
    const response = await request(app);
    expect(response.status).toBe(503);
    expect(state.harness.credits.calls).toEqual([]);
  },
);

it('can settle a previously produced result in a cold process with AI disabled', async () => {
  const correction: OrchestratedCorrectionResult['correction'] = {
    id: 'correction-1',
    status: 'COMPLETED',
    criteria: [],
    unsureCriteria: [],
    unsureCriterionDetails: [],
    overallConfidence: 'LOW',
    indicativeScore: null,
    overallFeedback: null,
    modelUsageCostUsd: 0.01,
    monitoringSignals: [],
  };
  state.harness = buildHarness({
    transport: strictOutput,
    replayLookup: {
      state: 'READY_TO_SETTLE',
      reservationId: 'reservation-1',
      result: {
        correction,
        replay: true,
        settlement: {
          reservedCredits: '18',
          settledCredits: '12',
          releasedCredits: '6',
        },
      },
    },
  });
  state.harness.quotes.loadAcceptedQuote = vi.fn(async () => ({
    ...(
      await import('../../corrections/correction-orchestration.test-support')
    ).buildQuote(),
    expiresAt: new Date('2099-01-01T00:00:00Z'),
  }));
  const app = application();
  vi.stubEnv('LEARNX_AI_ENABLED', 'false');
  vi.stubEnv('OPENROUTER_API_KEY', '');
  state.open = true;
  expect((await request(app)).status).toBe(201);
  expect(state.harness.credits.calls).toEqual(['settle']);
  expect(fetch).not.toHaveBeenCalled();
});
