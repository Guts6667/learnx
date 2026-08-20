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
import { createFormativeCorrectionsApp } from './app.js';

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
    repository: new InMemoryFormativeCorrectionRepository([target]),
  });
  return {
    app: createFormativeCorrectionsApp({
      authentication: authentication(id),
      enabled: true,
      service,
    }),
    provider,
    service,
  };
}

describe('V4-010 fake formative correction API', () => {
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

    expect(history.status).toBe(200);
    await expect(history.json()).resolves.toEqual({
      flow: { corrections: [], enabled: false, simulation: null },
    });
    expect(creation.status).toBe(404);
    expect(provider.requests).toHaveLength(0);
  });

  it('runs the full simulated flow, reloads persisted history and scopes it to the owner', async () => {
    const { app, provider } = fixture();
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
      correction: { id: string; state: string };
    };
    expect(correction.correction.state).toBe('FEEDBACK_READY');

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

  it('does not intercept unrelated API routes', async () => {
    const root = new Hono();
    root.route('/', fixture().app);
    root.get('/api/programs', (context) => context.json({ programs: [] }));

    expect((await root.request('/api/programs')).status).toBe(200);
  });
});
