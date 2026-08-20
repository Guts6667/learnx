import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { compileExecutableRubric } from '@/lib/executable-rubric-engine.js';
import { DeterministicV4010FakeProvider } from '@/server/ai/v4-010-fake-provider.js';
import {
  createFormativeCorrectionFakeFlow,
  FormativeCorrectionFlowError,
  InMemoryFormativeCorrectionRepository,
  type FormativeCorrectionTarget,
} from './fake-flow.js';

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
const userId = '11111111-1111-4111-8111-111111111111';
const submissionId = '22222222-2222-4222-8222-222222222222';
const response = [
  'Je recommande un go conditionnel limité à un pilote de six semaines.',
  'Parce que le coût du scénario défavorable dépasse le budget, le déploiement reste hors périmètre.',
  'Le taux de reprise humaine reste inconnu.',
  "Le pilote s'arrête si ce taux dépasse le seuil convenu après deux cycles.",
  'Le sponsor réexamine la décision le 15 octobre.',
].join(' ');
const target: FormativeCorrectionTarget = {
  activityKey: 'activity-rediger-recommandation-go-no-go',
  contentMarkdown: response,
  exerciseId: '33333333-3333-4333-8333-333333333333',
  lessonSlug: 'arbitrer-options-couts-go-no-go',
  moduleSlug: 'business-case-ia',
  programSlug: 'pilotage-projets-ia-iso-42001',
  stageSlug: 'cadrer-valeur-faisabilite',
  submissionId,
  taskContext: 'Dossier de décision fiable.',
  taskPrompt: 'Rédigez une recommandation go/no-go argumentée.',
  userId,
};
const bindingTarget = {
  activityKey: target.activityKey,
  lessonSlug: target.lessonSlug,
  moduleSlug: target.moduleSlug,
  programSlug: target.programSlug,
  stageSlug: target.stageSlug,
};

function fixture(input: { failFirstAttempts?: number } = {}) {
  const provider = new DeterministicV4010FakeProvider(input);
  const repository = new InMemoryFormativeCorrectionRepository([target]);
  const service = createFormativeCorrectionFakeFlow({
    bindingTarget,
    compiled,
    provider,
    repository,
  });
  return { provider, repository, service };
}

describe('V4-010 deterministic fake formative correction flow', () => {
  it('returns server-validated template feedback without score, level, billing or progression effects', async () => {
    const { provider, service } = fixture();
    const correction = await service.request({
      idempotencyKey: 'v4-010:request:1',
      responseText: response,
      submissionId,
      userId,
    });

    expect(correction.state).toBe('FEEDBACK_READY');
    expect(correction.certificate).toMatchObject({
      authority: 'LEARNX_SERVER_VALIDATED_CANDIDATES',
      billingEffect: 'NONE',
      indicativeScore: null,
      level: null,
      masteryEffect: 'NONE',
      progressionEffect: 'NONE',
    });
    expect(correction.certificate?.feedback.length).toBeGreaterThan(0);
    expect(correction.certificate?.feedback[0]?.evidenceSpans[0]?.text).toBeTruthy();
    expect(correction.simulation).toEqual({
      acceptedCeilingCredits: null,
      billingEffect: 'NONE',
      mode: 'OFFLINE_SIMULATION',
      reservationStatus: 'SIMULATED',
      settledCredits: null,
    });
    expect(provider.requests).toHaveLength(1);
  });

  it('collapses double clicks and returns an identical response without another execution', async () => {
    const { provider, service } = fixture();
    const request = {
      idempotencyKey: 'v4-010:double-click',
      responseText: response,
      submissionId,
      userId,
    };
    const [first, second] = await Promise.all([
      service.request(request),
      service.request(request),
    ]);
    const replay = await service.request({
      ...request,
      idempotencyKey: 'v4-010:same-response-new-action',
    });

    expect(second.id).toBe(first.id);
    expect(replay.id).toBe(first.id);
    expect(provider.requests).toHaveLength(1);
  });

  it('preserves immutable versions when the full response changes', async () => {
    const { service } = fixture();
    const first = await service.request({
      idempotencyKey: 'v4-010:version:1',
      responseText: response,
      submissionId,
      userId,
    });
    const revisedText = `${response} La responsable des données fournit l'autorisation avant le lancement.`;
    const second = await service.request({
      idempotencyKey: 'v4-010:version:2',
      responseText: revisedText,
      submissionId,
      userId,
    });
    const history = await service.history(submissionId, userId);

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect(history.corrections.map(({ responseText }) => responseText)).toEqual([
      response,
      revisedText,
    ]);
  });

  it('simulates a technical failure, keeps the response, then retries without billing', async () => {
    const { provider, service } = fixture({ failFirstAttempts: 1 });
    const unavailable = await service.request({
      idempotencyKey: 'v4-010:retry:1',
      responseText: response,
      submissionId,
      userId,
    });
    expect(unavailable).toMatchObject({
      attemptCount: 1,
      certificate: null,
      responseText: response,
      state: 'TEMPORARILY_UNAVAILABLE',
    });

    const retried = await service.retry(unavailable.id, userId);
    expect(retried.state).toBe('FEEDBACK_READY');
    expect(retried.attemptCount).toBe(2);
    expect(retried.simulation.billingEffect).toBe('NONE');
    expect(provider.requests).toHaveLength(2);
  });

  it('uses REVISION_REQUIRED only for an independently mechanical contradiction', async () => {
    const contradictory =
      'Je recommande un go. Les conditions sont stables. Je recommande un no-go.';
    const contradictionTarget = { ...target, contentMarkdown: contradictory };
    const provider = new DeterministicV4010FakeProvider();
    const service = createFormativeCorrectionFakeFlow({
      bindingTarget,
      compiled,
      provider,
      repository: new InMemoryFormativeCorrectionRepository([
        contradictionTarget,
      ]),
    });
    const correction = await service.request({
      idempotencyKey: 'v4-010:mechanical:1',
      responseText: contradictory,
      submissionId,
      userId,
    });

    expect(correction.state).toBe('REVISION_REQUIRED');
    expect(
      correction.certificate?.feedback.find(
        ({ kind }) => kind === 'MECHANICAL_REVISION',
      ),
    ).toMatchObject({
      elementKey: 'unresolved-decision-contradiction',
      relation: null,
    });
  });

  it('rejects unauthorized users, altered initial submissions and conflicting idempotency', async () => {
    const { service } = fixture();
    await expect(
      service.history(submissionId, '99999999-9999-4999-8999-999999999999'),
    ).rejects.toMatchObject({ code: 'SUBMISSION_NOT_FOUND' });
    await expect(
      service.request({
        idempotencyKey: 'v4-010:altered:1',
        responseText: `${response} Altération.`,
        submissionId,
        userId,
      }),
    ).rejects.toMatchObject({
      code: 'INITIAL_RESPONSE_MUST_MATCH_SUBMISSION',
    } satisfies Partial<FormativeCorrectionFlowError>);
    await service.request({
      idempotencyKey: 'v4-010:conflict:1',
      responseText: response,
      submissionId,
      userId,
    });
    await expect(
      service.request({
        idempotencyKey: 'v4-010:conflict:1',
        responseText: `${response} Nouvelle version.`,
        submissionId,
        userId,
      }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });
});
