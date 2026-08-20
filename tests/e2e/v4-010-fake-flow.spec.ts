import { expect, type Page, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from './accessibility';

const exerciseId = '33333333-3333-4333-8333-333333333333';
const submissionId = '22222222-2222-4222-8222-222222222222';
const responseText = 'Je recommande un go conditionnel limite a un pilote.';

const submission = {
  contentMarkdown: responseText,
  createdAt: '2026-08-20T10:00:00.000Z',
  exerciseId,
  id: submissionId,
  status: 'SUBMITTED',
  submittedAt: '2026-08-20T10:00:00.000Z',
  updatedAt: '2026-08-20T10:00:00.000Z',
  userId: '11111111-1111-4111-8111-111111111111',
};

const simulation = {
  acceptedCeilingCredits: null,
  billingEffect: 'NONE',
  mode: 'OFFLINE_SIMULATION',
  reservationStatus: 'SIMULATED',
  settledCredits: null,
};

function lessonResponse() {
  return {
    lesson: {
      concepts: [],
      contentBlocks: [],
      estimatedMinutes: 15,
      exercises: [
        {
          id: exerciseId,
          instructions: 'Formulez une recommandation et son mode de decision.',
          isRequired: true,
          position: 1,
          rubric: null,
          title: 'Arbitrer une option',
        },
      ],
      id: 'lesson-1',
      isPublished: true,
      module: {
        id: 'module-1',
        isPublished: true,
        slug: 'arbitrage',
        stage: {
          id: 'stage-1',
          isPublished: true,
          program: {
            id: 'program-1',
            slug: 'pilotage-projets-ia-iso-42001',
            title: 'Pilotage de projets IA',
          },
          slug: 'decider',
          title: 'Decider',
        },
        title: 'Arbitrage',
      },
      navigation: { nextLesson: null, previousLesson: null },
      objectives: [],
      position: 1,
      prerequisites: [],
      quizzes: [],
      resources: [],
      slug: 'arbitrer-options-couts-go-no-go',
      summary: 'Arbitrer avec des preuves observables.',
      tasks: [],
      title: 'Arbitrer options, couts et go/no-go',
    },
  };
}

function correctionResponse() {
  return {
    correction: {
      attemptCount: 1,
      certificate: {
        authority: 'LEARNX_SERVER_VALIDATED_CANDIDATES',
        billingEffect: 'NONE',
        certificateVersion: 1,
        feedback: [
          {
            criterionKey: 'decision-position',
            criterionLabel: 'Decision proposee',
            elementKey: 'decision-mode-stated',
            evidenceSpans: [
              {
                end: responseText.length,
                sha256: 'a'.repeat(64),
                spanId: 's0001-aaaaaaaaaaaaaaaa',
                start: 0,
                text: responseText,
              },
            ],
            kind: 'OBSERVED_STRENGTH',
            message: "L'orientation de decision est identifiable.",
            relation: 'EVIDENCE_FOR_ELEMENT',
          },
        ],
        indicativeScore: null,
        level: null,
        masteryEffect: 'NONE',
        operationFingerprint: 'b'.repeat(64),
        pipelineFingerprint: 'c'.repeat(64),
        progressionEffect: 'NONE',
        protocolFingerprint: 'd'.repeat(64),
        responseSha256: 'e'.repeat(64),
        rubricFingerprint: 'f'.repeat(64),
        state: 'FEEDBACK_READY',
      },
      createdAt: '2026-08-20T10:01:00.000Z',
      id: '44444444-4444-4444-8444-444444444444',
      responseSha256: 'e'.repeat(64),
      responseText,
      simulation,
      state: 'FEEDBACK_READY',
      submissionId,
      updatedAt: '2026-08-20T10:01:00.000Z',
      version: 1,
    },
  };
}

async function installApi(page: Page) {
  let correctionRequests = 0;

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname;
    const respond = (json: unknown, status = 200) =>
      route.fulfill({ contentType: 'application/json', json, status });

    if (method === 'GET' && path === '/api/auth/session') {
      await respond({
        user: {
          displayName: 'Apprenant pilote',
          email: 'pilote@example.com',
          id: submission.userId,
          locale: 'fr',
          role: 'USER',
        },
      });
      return;
    }
    if (
      method === 'GET' &&
      path === '/api/lessons/arbitrer-options-couts-go-no-go'
    ) {
      await respond(lessonResponse());
      return;
    }
    if (method === 'GET' && path === `/api/exercises/${exerciseId}`) {
      await respond({
        exercise: {
          ...lessonResponse().lesson.exercises[0],
          lessonId: 'lesson-1',
          submission,
        },
      });
      return;
    }
    if (
      method === 'GET' &&
      path === `/api/exercise-submissions/${submissionId}/formative-corrections`
    ) {
      await respond({
        flow: { corrections: [], enabled: true, simulation },
      });
      return;
    }
    if (
      method === 'POST' &&
      path === `/api/exercise-submissions/${submissionId}/formative-corrections`
    ) {
      correctionRequests += 1;
      expect(request.postDataJSON()).toMatchObject({ responseText });
      await new Promise((resolve) => setTimeout(resolve, 100));
      await respond(correctionResponse());
      return;
    }

    await respond({ error: { message: `Unexpected request: ${method} ${path}` } }, 500);
  });

  return { correctionRequests: () => correctionRequests };
}

test('runs the disabled-by-default flow fixture without debit, duplicate request or responsive overflow', async ({
  page,
}) => {
  const api = await installApi(page);
  await page.goto(
    `/program/pilotage-projets-ia-iso-42001/lesson/arbitrer-options-couts-go-no-go/exercise/${exerciseId}`,
  );

  await expect(
    page.getByRole('heading', { level: 1, name: 'Arbitrer une option' }),
  ).toBeVisible();
  await expect(page.getByText('Simulation hors ligne')).toBeVisible();
  await expect(page.getByText(/Aucun crédit ne sera réservé ni débité/i)).toBeVisible();

  const requestButton = page.getByRole('button', {
    name: 'Demander la correction simulée',
  });
  await requestButton.evaluate((button) => {
    button.click();
    button.click();
  });

  await expect(page.getByText('Retour prêt')).toBeVisible();
  await expect(page.getByText('Extrait de votre réponse')).toBeVisible();
  await expect(page.getByText(responseText).last()).toBeVisible();
  await expect(page.getByText('Aucun crédit débité')).toBeVisible();
  expect(api.correctionRequests()).toBe(1);

  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ height: width < 600 ? 844 : 1000, width });
    await expect(page.getByText('Retour prêt')).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  }

  await expectNoSeriousA11yViolations(page, '#formative-correction-panel');
  await expect(page.getByText(/token/i)).toHaveCount(0);
  await expect(page.getByText(/Score\s*:/i)).toHaveCount(0);
});
