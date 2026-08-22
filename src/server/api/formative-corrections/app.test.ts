import { createServer, type IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Hono, type MiddlewareHandler } from 'hono';
import { describe, expect, it } from 'vitest';

import { compileExecutableRubric } from '@/lib/executable-rubric-engine.js';
import { DeterministicV4010FakeProvider } from '@/server/ai/v4-010-fake-provider.js';
import {
  createFormativeCorrectionFakeFlow,
  InMemoryFormativeCorrectionRepository,
  type FormativeCorrectionTarget,
} from '@/server/formative-correction/fake-flow.js';
import type { AuthEnvironment } from '../_lib/auth.js';
import {
  createFormativeCorrectionsApp,
  isV4010FakeFlowEnabled,
} from './app.js';

const userId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '99999999-9999-4999-8999-999999999999';
const submissionId = '22222222-2222-4222-8222-222222222222';
const response =
  'Je recommande un go conditionnel limité à un pilote. Parce que le coût reste incertain, le déploiement est différé.';
const compiled = compileExecutableRubric(
  JSON.parse(
    readFileSync(
      resolve(
        process.cwd(),
        'benchmarks/ai-correction/executable-rubric/writing-go-no-go-recommendation-fr.v2.json',
      ),
      'utf8',
    ),
  ) as unknown,
);
const target: FormativeCorrectionTarget = {
  activityKey: 'activity-rediger-recommandation-go-no-go',
  contentMarkdown: response,
  exerciseId: '33333333-3333-4333-8333-333333333333',
  lessonSlug: 'arbitrer-options-couts-go-no-go',
  moduleSlug: 'business-case-ia',
  programSlug: 'pilotage-projets-ia-iso-42001',
  stageSlug: 'cadrer-valeur-faisabilite',
  submissionId,
  taskContext: 'Contexte fiable.',
  taskPrompt: 'Rédigez une recommandation.',
  userId,
};

function authentication(id = userId): MiddlewareHandler<AuthEnvironment> {
  return async (context, next) => {
    context.set('user', {
      displayName: 'Test',
      email: 'test@example.com',
      id,
      role: 'USER',
    });
    await next();
  };
}

function fixture(id = userId) {
  const provider = new DeterministicV4010FakeProvider();
  const repository = new InMemoryFormativeCorrectionRepository([target]);
  const service = createFormativeCorrectionFakeFlow({
    bindingTarget: {
      activityKey: target.activityKey,
      lessonSlug: target.lessonSlug,
      moduleSlug: target.moduleSlug,
      programSlug: target.programSlug,
      stageSlug: target.stageSlug,
    },
    compiled,
    provider,
    repository,
  });
  return {
    app: createFormativeCorrectionsApp({
      authentication: authentication(id),
      enabled: true,
      service,
    }),
    provider,
    repository,
    service,
  };
}

function toWebHeaders(input: IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => headers.append(name, entry));
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }
  return headers;
}

async function serveOverHttp(
  app: ReturnType<typeof createFormativeCorrectionsApp>,
): Promise<Readonly<{ close: () => Promise<void>; origin: string }>> {
  const server = createServer((incoming, outgoing) => {
    void (async () => {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of incoming) {
          chunks.push(
            typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk),
          );
        }
        const method = incoming.method ?? 'GET';
        const request = new Request(
          new URL(incoming.url ?? '/', `http://${incoming.headers.host}`),
          {
            ...(method === 'GET' || method === 'HEAD' || chunks.length === 0
              ? {}
              : { body: Buffer.concat(chunks).toString('utf8') }),
            headers: toWebHeaders(incoming.headers),
            method,
          },
        );
        const response = await app.fetch(request);
        outgoing.statusCode = response.status;
        response.headers.forEach((value, name) => {
          outgoing.setHeader(name, value);
        });
        outgoing.end(Buffer.from(await response.arrayBuffer()));
      } catch (error) {
        outgoing.statusCode = 500;
        outgoing.end(error instanceof Error ? error.message : 'HTTP_TEST_ERROR');
      }
    })();
  });
  await new Promise<void>((resolveListen, rejectListen) => {
    const reject = (error: Error) => rejectListen(error);
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolveListen();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('HTTP_TEST_SERVER_ADDRESS_MISSING');
  }
  return {
    close: () =>
      new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => {
          if (error) rejectClose(error);
          else resolveClose();
        });
      }),
    origin: `http://127.0.0.1:${(address as AddressInfo).port}`,
  };
}

describe('V4-010 fake formative correction API', () => {
  it('does not activate from an OpenRouter key and stays off in production', () => {
    const keyOnly = {
      NODE_ENV: 'development',
      OPENROUTER_API_KEY: 'test-key-that-must-not-enable-the-product',
    };
    const explicitOfflineFake = {
      ...keyOnly,
      LEARNX_V4_010_FAKE_FLOW: 'true',
    };

    expect(isV4010FakeFlowEnabled(keyOnly)).toBe(false);
    expect(isV4010FakeFlowEnabled(explicitOfflineFake)).toBe(true);
    expect(
      isV4010FakeFlowEnabled({
        ...explicitOfflineFake,
        NODE_ENV: 'production',
      }),
    ).toBe(false);
  });

  it('is hard-off by default and does not execute the injected provider', async () => {
    const { provider, service } = fixture();
    const disabled = createFormativeCorrectionsApp({
      authentication: authentication(),
      enabled: false,
      service,
    });
    const history = await disabled.request(
      `/api/exercise-submissions/${submissionId}/formative-corrections`,
    );
    const creation = await disabled.request(
      `/api/exercise-submissions/${submissionId}/formative-corrections`,
      {
        body: JSON.stringify({
          idempotencyKey: 'v4-010:disabled:1',
          responseText: response,
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );
    const retry = await disabled.request(
      '/api/formative-corrections/44444444-4444-4444-8444-444444444444/retry',
      { method: 'POST' },
    );

    expect(history.status).toBe(200);
    await expect(history.json()).resolves.toEqual({
      flow: { corrections: [], enabled: false, simulation: null },
    });
    expect(creation.status).toBe(404);
    expect(retry.status).toBe(404);
    expect(provider.requests).toHaveLength(0);
  });

  it('runs the full simulated flow, reloads persisted history and scopes it to the owner', async () => {
    const { app, provider, repository } = fixture();
    const created = await app.request(
      `/api/exercise-submissions/${submissionId}/formative-corrections`,
      {
        body: JSON.stringify({
          idempotencyKey: 'v4-010:api:1',
          responseText: response,
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );
    expect(created.status).toBe(201);
    const correction = (await created.json()) as {
      correction: {
        certificate: {
          indicativeScore: null;
          masteryEffect: 'NONE';
          progressionEffect: 'NONE';
        };
        id: string;
        simulation: { mode: string };
        state: string;
      };
    };
    expect(correction.correction.state).toBe('FEEDBACK_READY');
    expect(correction.correction.simulation.mode).toBe('OFFLINE_SIMULATION');
    expect(correction.correction.certificate).toMatchObject({
      indicativeScore: null,
      masteryEffect: 'NONE',
      progressionEffect: 'NONE',
    });

    const [persisted] = await repository.list(submissionId, userId);
    expect(persisted).not.toHaveProperty('score');
    expect(persisted).not.toHaveProperty('mastery');
    expect(persisted).not.toHaveProperty('progression');
    expect(persisted?.certificate).toMatchObject({
      indicativeScore: null,
      masteryEffect: 'NONE',
      progressionEffect: 'NONE',
    });
    expect(compiled.rubric.lifecycle).toBe('DRAFT');

    const reloaded = await app.request(
      `/api/exercise-submissions/${submissionId}/formative-corrections`,
    );
    await expect(reloaded.json()).resolves.toMatchObject({
      flow: {
        corrections: [{ id: correction.correction.id, version: 1 }],
        enabled: true,
        simulation: { billingEffect: 'NONE' },
      },
    });
    expect(provider.requests).toHaveLength(1);

    const outsider = fixture(otherUserId).app;
    expect(
      (
        await outsider.request(
          `/api/exercise-submissions/${submissionId}/formative-corrections`,
        )
      ).status,
    ).toBe(404);
  });

  it('serves the injected fake provider over a real HTTP socket without API interception', async () => {
    const { app, provider } = fixture();
    const server = await serveOverHttp(app);
    const endpoint = `${server.origin}/api/exercise-submissions/${submissionId}/formative-corrections`;

    try {
      const created = await fetch(endpoint, {
        body: JSON.stringify({
          idempotencyKey: 'v4-010:http-server:1',
          responseText: response,
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      expect(created.status).toBe(201);
      await expect(created.json()).resolves.toMatchObject({
        correction: {
          certificate: {
            indicativeScore: null,
            masteryEffect: 'NONE',
            progressionEffect: 'NONE',
          },
          simulation: {
            billingEffect: 'NONE',
            mode: 'OFFLINE_SIMULATION',
          },
        },
      });

      const history = await fetch(endpoint);
      expect(history.status).toBe(200);
      await expect(history.json()).resolves.toMatchObject({
        flow: {
          corrections: [{ responseText: response }],
          enabled: true,
          simulation: { billingEffect: 'NONE' },
        },
      });
      expect(provider.requests).toHaveLength(1);
    } finally {
      await server.close();
    }
  });

  it('does not intercept unrelated API routes', async () => {
    const root = new Hono();
    root.route('/', fixture().app);
    root.get('/api/programs', (context) => context.json({ programs: [] }));

    expect((await root.request('/api/programs')).status).toBe(200);
  });
});
