import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type APIResponse,
} from '@playwright/test';

import {
  cleanupIntegrationUsers,
  createIntegrationFixture,
} from './fixture.js';

const password = 'Integration-Only-Password-2026!';

function uniqueEmail(label: string): string {
  const runId = process.env.LEARNX_INTEGRATION_RUN_ID ?? 'missing-run';
  const safeRunId = runId.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return `${label}-${safeRunId}@example.test`;
}

async function expectStatus(
  response: APIResponse,
  status: number,
): Promise<APIResponse> {
  if (response.status() !== status) {
    throw new Error(
      `Expected HTTP ${status}, received ${response.status()}: ${await response.text()}`,
    );
  }

  expect(response.status()).toBe(status);
  return response;
}

async function register(
  context: APIRequestContext,
  email: string,
): Promise<void> {
  await expectStatus(
    await context.post('/api/auth/register', {
      data: { displayName: 'Compte intégration', email, password },
    }),
    201,
  );
}

test('parcours backend réel et isolation multi-utilisateurs', async ({
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop');
  expect(baseURL).toBeTruthy();

  const ownerEmail = uniqueEmail('owner');
  const outsiderEmail = uniqueEmail('outsider');
  const owner = await playwrightRequest.newContext({ baseURL });
  const outsider = await playwrightRequest.newContext({ baseURL });

  try {
    await register(owner, ownerEmail);
    await register(outsider, outsiderEmail);

    await expectStatus(await owner.post('/api/auth/logout'), 204);
    await expectStatus(
      await owner.post('/api/auth/login', {
        data: { email: ownerEmail, password },
      }),
      200,
    );

    const fixture = await createIntegrationFixture(
      ownerEmail,
      `${process.env.LEARNX_INTEGRATION_RUN_ID}-backend`,
    );

    await expectStatus(
      await outsider.post('/api/admin/publication/preview', {
        data: {
          action: 'UNPUBLISH',
          mode: 'PARENT_ONLY',
          targetId: fixture.moduleId,
          targetType: 'MODULE',
        },
      }),
      403,
    );
    const unpublishPreviewResponse = await expectStatus(
      await owner.post('/api/admin/publication/preview', {
        data: {
          action: 'UNPUBLISH',
          mode: 'PARENT_ONLY',
          targetId: fixture.moduleId,
          targetType: 'MODULE',
        },
      }),
      200,
    );
    const unpublishPreview = (await unpublishPreviewResponse.json()) as {
      plan: { planId: string };
    };
    const unpublishRequest = {
      action: 'UNPUBLISH',
      mode: 'PARENT_ONLY',
      planId: unpublishPreview.plan.planId,
      targetId: fixture.moduleId,
      targetType: 'MODULE',
    };
    await expectStatus(
      await owner.post('/api/admin/publication/apply', {
        data: unpublishRequest,
      }),
      200,
    );
    await expectStatus(
      await owner.post('/api/admin/publication/apply', {
        data: unpublishRequest,
      }),
      200,
    );
    const publishPreviewResponse = await expectStatus(
      await owner.post('/api/admin/publication/preview', {
        data: {
          action: 'PUBLISH',
          mode: 'FULL',
          targetId: fixture.moduleId,
          targetType: 'MODULE',
        },
      }),
      200,
    );
    const publishPreview = (await publishPreviewResponse.json()) as {
      plan: { planId: string };
    };
    await expectStatus(
      await owner.post('/api/admin/publication/apply', {
        data: {
          action: 'PUBLISH',
          mode: 'FULL',
          planId: publishPreview.plan.planId,
          targetId: fixture.moduleId,
          targetType: 'MODULE',
        },
      }),
      200,
    );

    const programsResponse = await expectStatus(
      await owner.get('/api/programs'),
      200,
    );
    expect(await programsResponse.json()).toMatchObject({
      programs: [{ slug: fixture.programSlug }],
    });
    const outsiderPrograms = await expectStatus(
      await outsider.get('/api/programs'),
      200,
    );
    expect(await outsiderPrograms.json()).toEqual({ programs: [] });

    await expectStatus(
      await owner.get(`/api/programs/${fixture.programSlug}`),
      200,
    );
    await expectStatus(
      await owner.get(
        `/api/programs/${fixture.programSlug}/stages/${fixture.stageSlug}`,
      ),
      200,
    );
    await expectStatus(
      await owner.get(`/api/modules/${fixture.moduleSlug}`),
      200,
    );
    await expectStatus(
      await owner.get(`/api/lessons/${fixture.lessonSlug}`),
      200,
    );
    await expectStatus(
      await outsider.get(`/api/lessons/${fixture.lessonSlug}`),
      404,
    );

    await expectStatus(
      await owner.post(`/api/programs/${fixture.programId}/start`),
      200,
    );
    await expectStatus(
      await owner.post(`/api/lessons/${fixture.lessonId}/start`),
      200,
    );
    await expectStatus(
      await owner.patch(`/api/tasks/${fixture.taskId}`, {
        data: { status: 'DONE' },
      }),
      200,
    );
    await expectStatus(
      await owner.patch(`/api/resources/${fixture.resourceId}/progress`, {
        data: { status: 'COMPLETED' },
      }),
      200,
    );
    await expectStatus(
      await outsider.patch(`/api/tasks/${fixture.taskId}`, {
        data: { status: 'DONE' },
      }),
      404,
    );

    const assessmentResponse = await expectStatus(
      await owner.get(
        `/api/concept-assessments/${fixture.conceptAssessmentId}`,
      ),
      200,
    );
    const hiddenAssessment = JSON.stringify(await assessmentResponse.json());
    expect(hiddenAssessment).not.toContain('isCorrect');
    expect(hiddenAssessment).not.toContain('explanation');
    await expectStatus(
      await owner.post(
        `/api/concept-assessments/${fixture.conceptAssessmentId}/attempts`,
        {
          data: {
            answers: [
              {
                optionIds: [fixture.conceptWrongOptionId],
                questionId: fixture.conceptQuestionId,
              },
            ],
          },
        },
      ),
      201,
    );
    const reviewsResponse = await expectStatus(
      await owner.get('/api/reviews'),
      200,
    );
    expect((await reviewsResponse.json()).reviews).toHaveLength(1);
    await expectStatus(
      await owner.post(
        `/api/concept-assessments/${fixture.conceptAssessmentId}/attempts`,
        {
          data: {
            answers: [
              {
                optionIds: [fixture.conceptCorrectOptionId],
                questionId: fixture.conceptQuestionId,
              },
            ],
          },
        },
      ),
      201,
    );
    await expectStatus(
      await outsider.get(
        `/api/concept-assessments/${fixture.conceptAssessmentId}`,
      ),
      404,
    );

    const quizResponse = await expectStatus(
      await owner.get(`/api/quizzes/${fixture.quizId}`),
      200,
    );
    const hiddenQuiz = JSON.stringify(await quizResponse.json());
    expect(hiddenQuiz).not.toContain('isCorrect');
    expect(hiddenQuiz).not.toContain('explanation');
    await expectStatus(
      await owner.post(`/api/quizzes/${fixture.quizId}/attempts`, {
        data: {
          answers: [
            {
              optionIds: [fixture.quizCorrectOptionId],
              questionId: fixture.quizQuestionId,
            },
          ],
        },
      }),
      201,
    );
    await expectStatus(
      await outsider.get(`/api/quizzes/${fixture.quizId}`),
      404,
    );

    const draftResponse = await expectStatus(
      await owner.post(`/api/exercises/${fixture.exerciseId}/submissions`),
      201,
    );
    const draftBody = (await draftResponse.json()) as {
      submission: { id: string };
    };
    await expectStatus(
      await owner.patch(
        `/api/exercise-submissions/${draftBody.submission.id}`,
        { data: { contentMarkdown: 'Réponse intégrée et argumentée.' } },
      ),
      200,
    );
    await expectStatus(
      await owner.post(
        `/api/exercise-submissions/${draftBody.submission.id}/submit`,
      ),
      200,
    );
    await expectStatus(
      await outsider.get(`/api/exercises/${fixture.exerciseId}`),
      404,
    );

    const noteResponse = await expectStatus(
      await owner.post('/api/notes', {
        data: {
          lessonId: fixture.lessonId,
          markdown: 'Note issue du parcours réel.',
          title: 'Note intégration',
        },
      }),
      201,
    );
    const note = (await noteResponse.json()) as { note: { id: string } };
    await expectStatus(
      await owner.patch(`/api/notes/${note.note.id}`, {
        data: { title: 'Note intégration mise à jour' },
      }),
      200,
    );
    await expectStatus(await outsider.get(`/api/notes/${note.note.id}`), 404);

    const finalAssessment = await expectStatus(
      await owner.get(`/api/stages/${fixture.stageId}/assessment`),
      200,
    );
    expect(await finalAssessment.json()).toMatchObject({
      assessment: { id: fixture.stageAssessmentId },
    });
    const finalDraftResponse = await expectStatus(
      await owner.post(
        `/api/stage-assessments/${fixture.stageAssessmentId}/submissions`,
      ),
      201,
    );
    const finalDraft = (await finalDraftResponse.json()) as {
      submission: { id: string };
    };
    await expectStatus(
      await owner.patch(
        `/api/stage-assessment-submissions/${finalDraft.submission.id}`,
        {
          data: {
            action: 'save',
            contentMarkdown: 'Synthèse finale issue du scénario réel.',
          },
        },
      ),
      200,
    );
    await expectStatus(
      await owner.post(
        `/api/stage-assessment-submissions/${finalDraft.submission.id}/submit`,
      ),
      200,
    );

    const progressResponse = await expectStatus(
      await owner.get(`/api/lessons/${fixture.lessonId}/progress`),
      200,
    );
    expect(await progressResponse.json()).toMatchObject({ canComplete: true });
    await expectStatus(
      await owner.post(`/api/lessons/${fixture.lessonId}/complete`),
      200,
    );
  } finally {
    await cleanupIntegrationUsers([ownerEmail, outsiderEmail]);
    await owner.dispose();
    await outsider.dispose();
  }
});
