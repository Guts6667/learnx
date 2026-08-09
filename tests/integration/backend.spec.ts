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
import { prisma } from '../../src/server/prisma.js';

const password = 'Integration-Only-Password-2026!';

function uniqueEmail(label: string, retry: number): string {
  const runId = process.env.LEARNX_INTEGRATION_RUN_ID ?? 'missing-run';
  const safeRunId = runId.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return `${label}-${safeRunId}-retry-${retry}@example.test`;
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
  test.setTimeout(480_000);
  expect(baseURL).toBeTruthy();

  const ownerEmail = uniqueEmail('owner', testInfo.retry);
  const outsiderEmail = uniqueEmail('outsider', testInfo.retry);
  const secondLearnerEmail = uniqueEmail('second-learner', testInfo.retry);
  const accessRequestEmail = uniqueEmail('access-request', testInfo.retry);
  const owner = await playwrightRequest.newContext({
    baseURL,
    timeout: 30_000,
  });
  const outsider = await playwrightRequest.newContext({
    baseURL,
    timeout: 30_000,
  });
  const secondLearner = await playwrightRequest.newContext({
    baseURL,
    timeout: 30_000,
  });

  try {
    const accessRequestResponses = await Promise.all(
      Array.from({ length: 4 }, () =>
        owner.post('/api/access-requests', {
          data: { email: ` ${accessRequestEmail.toUpperCase()} ` },
          headers: { 'x-forwarded-for': '2001:db8::10' },
        }),
      ),
    );
    for (const response of accessRequestResponses) {
      await expectStatus(response, 202);
    }
    expect(
      await prisma.accessRequest.count({
        where: { emailNormalized: accessRequestEmail },
      }),
    ).toBe(1);

    await register(owner, ownerEmail);
    await register(outsider, outsiderEmail);
    await register(secondLearner, secondLearnerEmail);

    await expectStatus(
      await owner.post('/api/access-requests', {
        data: { email: ownerEmail },
        headers: { 'x-forwarded-for': '2001:db8::11' },
      }),
      202,
    );
    expect(
      await prisma.accessRequest.count({
        where: { emailNormalized: ownerEmail },
      }),
    ).toBe(0);

    await expectStatus(await owner.post('/api/auth/logout'), 204);
    await expectStatus(
      await owner.post('/api/auth/login', {
        data: { email: ownerEmail, password },
      }),
      200,
    );

    const fixture = await createIntegrationFixture(
      ownerEmail,
      `${process.env.LEARNX_INTEGRATION_RUN_ID}-backend-retry-${testInfo.retry}`,
    );

    await prisma.user.update({
      where: { email: outsiderEmail },
      data: { role: 'CREATOR' },
    });

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
    expect(
      await prisma.auditEvent.count({
        where: {
          action: 'PROGRAM_PUBLICATION_APPLY',
          actor: { email: ownerEmail },
          idempotencyKey: unpublishRequest.planId,
        },
      }),
    ).toBe(1);
    await expectStatus(
      await owner.patch(`/api/admin/modules/${fixture.moduleId}`, {
        data: { description: 'Module audité par le test réel.' },
      }),
      200,
    );
    await expectStatus(
      await owner.patch(`/api/admin/lessons/${fixture.lessonId}`, {
        data: { summary: 'Leçon auditée par le test réel.' },
      }),
      200,
    );
    expect(
      await prisma.auditEvent.count({
        where: {
          actor: { email: ownerEmail },
          action: { in: ['MODULE_UPDATE', 'LESSON_UPDATE'] },
        },
      }),
    ).toBe(2);
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

    const privateProgram = await prisma.program.findUniqueOrThrow({
      where: { id: fixture.programId },
      select: { publishedVersionId: true, updatedAt: true },
    });
    expect(privateProgram.publishedVersionId).not.toBeNull();
    await expectStatus(
      await owner.patch(`/api/admin/programs/${fixture.programId}/visibility`, {
        data: {
          expectedUpdatedAt: privateProgram.updatedAt.toISOString(),
          visibility: 'PUBLIC',
        },
      }),
      200,
    );

    const catalogResponse = await expectStatus(
      await outsider.get('/api/catalog/programs?pageSize=50'),
      200,
    );
    const catalog = (await catalogResponse.json()) as {
      items: Array<{ id: string; isEnrolled: boolean }>;
      nextCursor: string | null;
    };
    expect(catalog.items).toContainEqual(
      expect.objectContaining({ id: fixture.programId, isEnrolled: false }),
    );
    expect(catalog.nextCursor).toBeNull();
    const emptyEnrollments = await expectStatus(
      await outsider.get('/api/me/programs'),
      200,
    );
    expect(await emptyEnrollments.json()).toEqual({
      items: [],
      nextCursor: null,
    });
    await expectStatus(
      await outsider.post(`/api/programs/${fixture.programId}/enrollment`),
      200,
    );
    await expectStatus(
      await secondLearner.post(`/api/programs/${fixture.programId}/enrollment`),
      200,
    );
    const activeEnrollments = await expectStatus(
      await outsider.get('/api/me/programs'),
      200,
    );
    expect(await activeEnrollments.json()).toMatchObject({
      items: [
        {
          enrollment: { status: 'ACTIVE' },
          program: { id: fixture.programId },
        },
      ],
    });
    await expectStatus(
      await outsider.get(`/api/programs/${fixture.programSlug}`),
      200,
    );
    await expectStatus(
      await outsider.get(`/api/lessons/${fixture.lessonSlug}`),
      200,
    );
    await expectStatus(await outsider.get(`/api/notes/${note.note.id}`), 404);
    const outsiderAttempts = await expectStatus(
      await outsider.get(`/api/quizzes/${fixture.quizId}/attempts`),
      200,
    );
    expect(await outsiderAttempts.json()).toEqual({
      attempts: [],
      nextCursor: null,
    });
    await expectStatus(
      await outsider.post(`/api/quizzes/${fixture.quizId}/attempts`, {
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
    const secondLearnerAttempts = await expectStatus(
      await secondLearner.get(`/api/quizzes/${fixture.quizId}/attempts`),
      200,
    );
    expect(await secondLearnerAttempts.json()).toEqual({
      attempts: [],
      nextCursor: null,
    });
    const outsiderNoteResponse = await expectStatus(
      await outsider.post('/api/notes', {
        data: {
          lessonId: fixture.lessonId,
          markdown: 'Note privée du premier apprenant.',
          title: 'Note apprenant un',
        },
      }),
      201,
    );
    const outsiderNote = (await outsiderNoteResponse.json()) as {
      note: { id: string };
    };
    await expectStatus(
      await secondLearner.get(`/api/notes/${outsiderNote.note.id}`),
      404,
    );
    await expectStatus(
      await outsider.patch(`/api/tasks/${fixture.taskId}`, {
        data: { status: 'DONE' },
      }),
      200,
    );
    await expectStatus(
      await secondLearner.get(`/api/lessons/${fixture.lessonSlug}`),
      200,
    );

    const secondLearnerAccount = await prisma.user.findUniqueOrThrow({
      where: { email: secondLearnerEmail },
      select: { id: true, updatedAt: true },
    });
    await expectStatus(
      await owner.post(
        `/api/admin/accounts/${secondLearnerAccount.id}/suspend`,
        {
          data: {
            expectedStatus: 'ACTIVE',
            expectedUpdatedAt: secondLearnerAccount.updatedAt.toISOString(),
          },
        },
      ),
      200,
    );
    const suspendedSession = await expectStatus(
      await secondLearner.get('/api/auth/session'),
      200,
    );
    expect(await suspendedSession.json()).toEqual({ user: null });
    await expectStatus(await secondLearner.get('/api/me/programs'), 401);
    await expectStatus(
      await secondLearner.post('/api/auth/login', {
        data: { email: secondLearnerEmail, password },
      }),
      401,
    );

    const suspendedAccount = await prisma.user.findUniqueOrThrow({
      where: { id: secondLearnerAccount.id },
      select: { accountStatus: true, updatedAt: true },
    });
    expect(suspendedAccount.accountStatus).toBe('SUSPENDED');
    await expectStatus(
      await owner.post(
        `/api/admin/accounts/${secondLearnerAccount.id}/reactivate`,
        {
          data: {
            expectedStatus: 'SUSPENDED',
            expectedUpdatedAt: suspendedAccount.updatedAt.toISOString(),
          },
        },
      ),
      200,
    );
    await expectStatus(
      await secondLearner.post('/api/auth/login', {
        data: { email: secondLearnerEmail, password },
      }),
      200,
    );
    const preservedEnrollment = await expectStatus(
      await secondLearner.get('/api/me/programs'),
      200,
    );
    expect(await preservedEnrollment.json()).toMatchObject({
      items: [
        {
          enrollment: { status: 'ACTIVE' },
          program: { id: fixture.programId },
        },
      ],
    });
    await expectStatus(
      await outsider.delete(`/api/programs/${fixture.programId}/enrollment`),
      200,
    );
    const withdrawnEnrollments = await expectStatus(
      await outsider.get('/api/me/programs?status=WITHDRAWN'),
      200,
    );
    expect(await withdrawnEnrollments.json()).toMatchObject({
      items: [
        {
          enrollment: { status: 'WITHDRAWN' },
          program: { id: fixture.programId },
        },
      ],
    });
    await expectStatus(
      await outsider.get(`/api/lessons/${fixture.lessonSlug}`),
      404,
    );
    await expectStatus(
      await outsider.patch(`/api/tasks/${fixture.taskId}`, {
        data: { status: 'DONE' },
      }),
      404,
    );

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
    await expectStatus(
      await owner.patch(
        `/api/stage-assessment-submissions/${finalDraft.submission.id}`,
        { data: { action: 'validate', score: 90 } },
      ),
      200,
    );
    const auditEvents = await prisma.auditEvent.findMany({
      where: { actor: { email: ownerEmail } },
      select: { action: true, metadata: true },
    });
    expect(auditEvents.map(({ action }) => action)).toContain(
      'STAGE_ASSESSMENT_REVIEW',
    );
    expect(JSON.stringify(auditEvents)).not.toMatch(
      /password|token|@example\.test/i,
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
    await prisma.accessRequest.deleteMany({
      where: { emailNormalized: accessRequestEmail },
    });
    await cleanupIntegrationUsers([
      ownerEmail,
      outsiderEmail,
      secondLearnerEmail,
    ]);
    await owner.dispose();
    await outsider.dispose();
    await secondLearner.dispose();
  }
});
