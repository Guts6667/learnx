import { expect, type Page, test } from '@playwright/test';

const credentials = {
  displayName: 'Apprenant E2E',
  email: 'learner@example.com',
  password: 'Mot-de-passe-E2E-2026!',
};

const user = {
  displayName: credentials.displayName,
  email: credentials.email,
  id: 'user-1',
  role: 'USER',
};

const timeline = {
  actualPercent: 0,
  completedAt: null,
  expectedPercent: 0,
  progressDelta: 0,
  startedAt: null,
  targetEndAt: null,
  temporalStatus: null,
};

const lessonSummary = {
  activityCounts: {
    concepts: 0,
    exercises: 0,
    quizzes: 1,
    resources: 0,
    tasks: 1,
  },
  estimatedMinutes: 10,
  id: 'lesson-1',
  isLocked: false,
  isPublished: true,
  position: 1,
  progress: { percent: 0, status: 'AVAILABLE' },
  slug: 'lecon-critique',
  summary: 'Une leçon publiée pour valider le parcours critique.',
  title: 'Leçon critique',
};

const moduleSummary = {
  id: 'module-1',
  isPublished: true,
  lessons: [lessonSummary],
  position: 1,
  slug: 'module-e2e',
  title: 'Module E2E',
};

const stageSummary = {
  id: 'stage-1',
  isPublished: true,
  modules: [moduleSummary],
  position: 1,
  slug: 'stage-e2e',
  timeline,
  title: 'Étape E2E',
};

const program = {
  description: 'Programme utilisé par le scénario E2E critique.',
  estimatedDurationDays: 1,
  id: 'program-1',
  slug: 'programme-e2e',
  stages: [stageSummary],
  status: 'ACTIVE',
  timeline,
  title: 'Programme E2E',
};

interface JourneyState {
  authenticated: boolean;
  quizPassed: boolean;
  registered: boolean;
  started: boolean;
  taskDone: boolean;
}

function lessonProgress(state: JourneyState) {
  const percent = (state.taskDone ? 50 : 0) + (state.quizPassed ? 50 : 0);

  return {
    canComplete: state.quizPassed && state.taskDone,
    conceptProgress: {},
    exerciseSubmissions: {},
    lessonProgress: {
      completedAt: null,
      percent,
      startedAt: state.started ? '2026-08-03T08:00:00.000Z' : null,
      status: state.started ? 'IN_PROGRESS' : 'AVAILABLE',
    },
    resourceProgress: {},
    quizPassed: { 'quiz-1': state.quizPassed },
    taskCompletions: { 'task-1': state.taskDone ? 'DONE' : 'TODO' },
  };
}

async function installJourneyApi(page: Page) {
  const state: JourneyState = {
    authenticated: false,
    quizPassed: false,
    registered: false,
    started: false,
    taskDone: false,
  };

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;
    const respond = (json: unknown, status = 200) =>
      route.fulfill({ contentType: 'application/json', json, status });

    if (method === 'GET' && path === '/api/auth/session') {
      await respond({ user: state.authenticated ? user : null });
      return;
    }

    if (method === 'POST' && path === '/api/auth/register') {
      const input = request.postDataJSON() as Record<string, unknown>;
      expect(input).toEqual(credentials);
      state.authenticated = true;
      state.registered = true;
      await respond({ user }, 201);
      return;
    }

    if (method === 'POST' && path === '/api/auth/login') {
      const input = request.postDataJSON() as Record<string, unknown>;
      if (
        !state.registered ||
        input.email !== credentials.email ||
        input.password !== credentials.password
      ) {
        await respond({ error: { message: 'Identifiants invalides.' } }, 401);
        return;
      }

      state.authenticated = true;
      await respond({ user });
      return;
    }

    if (method === 'POST' && path === '/api/auth/logout') {
      state.authenticated = false;
      await route.fulfill({ body: '', status: 204 });
      return;
    }

    if (!state.authenticated) {
      await respond({ error: { message: 'Authentification requise.' } }, 401);
      return;
    }

    if (method === 'GET' && path === '/api/today') {
      await respond({
        action: null,
        lastActivity: null,
        program: null,
        reviewsDue: 0,
      });
      return;
    }

    if (method === 'GET' && path === '/api/programs') {
      await respond({ programs: [program] });
      return;
    }

    if (method === 'GET' && path === '/api/programs/programme-e2e') {
      await respond({ program });
      return;
    }

    if (
      method === 'GET' &&
      path === '/api/programs/programme-e2e/stages/stage-e2e'
    ) {
      await respond({
        stage: {
          ...stageSummary,
          estimatedDurationDays: 1,
          validation: {
            finalAssessments: { total: 1, validated: 0 },
            isValidated: false,
            missingRequirements: [],
            requiredConcepts: { total: 0, validated: 0 },
            requiredTasks: { total: 1, validated: 0 },
            status: 'AVAILABLE',
          },
        },
      });
      return;
    }

    if (method === 'GET' && path === '/api/stages/stage-1/assessment') {
      await respond({
        assessment: {
          description: 'Évaluation finale du parcours E2E.',
          id: 'stage-assessment-1',
          instructions: 'Décrivez ce que vous avez appris.',
          isRequired: true,
          passingScore: 80,
          position: 1,
          rubric: {},
          stageId: 'stage-1',
          submission: null,
          title: 'Évaluation finale E2E',
          type: 'PROJECT',
        },
      });
      return;
    }

    if (method === 'GET' && path === '/api/modules/module-e2e') {
      await respond({
        module: {
          ...moduleSummary,
          description: 'Module du parcours critique.',
          estimatedMinutes: 10,
          stage: {
            id: 'stage-1',
            isPublished: true,
            program: {
              id: 'program-1',
              slug: 'programme-e2e',
              title: 'Programme E2E',
            },
            slug: 'stage-e2e',
            title: 'Étape E2E',
          },
        },
      });
      return;
    }

    if (method === 'GET' && path === '/api/lessons/lecon-critique') {
      await respond({
        lesson: {
          ...lessonSummary,
          concepts: [],
          contentBlocks: [
            {
              content: { text: 'Contenu pédagogique du parcours E2E.' },
              id: 'block-1',
              position: 1,
              type: 'RICH_TEXT',
            },
          ],
          exercises: [],
          module: {
            id: 'module-1',
            isPublished: true,
            slug: 'module-e2e',
            stage: {
              id: 'stage-1',
              isPublished: true,
              program: {
                id: 'program-1',
                slug: 'programme-e2e',
                title: 'Programme E2E',
              },
              slug: 'stage-e2e',
              title: 'Étape E2E',
            },
            title: 'Module E2E',
          },
          navigation: { nextLesson: null, previousLesson: null },
          objectives: ['Valider le parcours critique'],
          prerequisites: [],
          quizzes: [
            {
              description: 'Vérifie que la progression est comprise.',
              id: 'quiz-1',
              isRequired: true,
              passingScore: 80,
              position: 1,
              questionCount: 1,
              title: 'Quiz critique',
            },
          ],
          resources: [],
          tasks: [
            {
              description: 'Cochez cette tâche avant de passer le quiz.',
              id: 'task-1',
              isRequired: true,
              position: 1,
              title: 'Tâche critique',
              type: 'CHECKLIST',
              weight: 1,
            },
          ],
        },
      });
      return;
    }

    if (method === 'GET' && path === '/api/lessons/lesson-1/progress') {
      await respond(lessonProgress(state));
      return;
    }

    if (method === 'POST' && path === '/api/lessons/lesson-1/start') {
      state.started = true;
      await respond(lessonProgress(state));
      return;
    }

    if (method === 'PATCH' && path === '/api/tasks/task-1') {
      const input = request.postDataJSON() as Record<string, unknown>;
      state.taskDone = input.status === 'DONE';
      await respond(lessonProgress(state));
      return;
    }

    if (method === 'GET' && path === '/api/notes') {
      await respond({ notes: [] });
      return;
    }

    if (method === 'GET' && path === '/api/quizzes/quiz-1') {
      await respond({
        quiz: {
          description: 'Vérifie que la progression est comprise.',
          id: 'quiz-1',
          isRequired: true,
          lessonId: 'lesson-1',
          passingScore: 80,
          position: 1,
          questionCount: 1,
          questions: [
            {
              id: 'question-1',
              options: [
                { id: 'option-true', label: 'Vrai', position: 1 },
                { id: 'option-false', label: 'Faux', position: 2 },
              ],
              position: 1,
              prompt: 'LearnX conserve la progression après reconnexion.',
              type: 'TRUE_FALSE',
            },
          ],
          title: 'Quiz critique',
        },
      });
      return;
    }

    if (method === 'GET' && path === '/api/quizzes/quiz-1/attempts') {
      await respond({
        attempts: state.quizPassed
          ? [
              {
                answers: [
                  {
                    optionIds: ['option-true'],
                    questionId: 'question-1',
                  },
                ],
                id: 'attempt-1',
                passed: true,
                score: 100,
                submittedAt: '2026-08-03T08:10:00.000Z',
              },
            ]
          : [],
      });
      return;
    }

    if (method === 'POST' && path === '/api/quizzes/quiz-1/attempts') {
      const input = request.postDataJSON() as {
        answers?: Array<{ optionIds?: string[]; questionId?: string }>;
      };
      expect(input.answers).toEqual([
        { optionIds: ['option-true'], questionId: 'question-1' },
      ]);
      state.quizPassed = true;
      await respond({
        attempt: {
          answers: input.answers,
          id: 'attempt-1',
          passed: true,
          score: 100,
          submittedAt: '2026-08-03T08:10:00.000Z',
        },
        corrections: [
          {
            acceptedAnswers: [],
            correct: true,
            correctOptionIds: ['option-true'],
            explanation: 'La progression est persistée côté serveur.',
            questionId: 'question-1',
          },
        ],
      });
      return;
    }

    throw new Error(`Requête API E2E non simulée : ${method} ${path}`);
  });
}

async function openCriticalLesson(page: Page) {
  const navigation = page.getByRole('navigation', {
    name: 'Navigation principale',
  });

  await navigation.getByRole('link', { name: 'Programmes' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Mes programmes' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Ouvrir le programme' }).click();
  await page.getByRole('link', { name: /Commencer|Continuer/ }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: lessonSummary.title }),
  ).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test('préserve le parcours critique après inscription et reconnexion', async ({
  page,
}) => {
  await installJourneyApi(page);
  await page.goto('/login');

  const registrationStatus = await page.evaluate(async (input) => {
    const response = await fetch('/api/auth/register', {
      body: JSON.stringify(input),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    return response.status;
  }, credentials);
  expect(registrationStatus).toBe(201);

  await page.evaluate(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
  });
  await page.reload();
  await page.getByLabel('Adresse e-mail').fill(credentials.email);
  await page.getByLabel('Mot de passe').fill(credentials.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Aujourd’hui' }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await openCriticalLesson(page);
  await page.getByRole('button', { name: 'Continuer' }).click();

  await page.getByRole('button', { name: 'Marquer comme terminée' }).click();
  await expect(
    page.getByRole('button', { name: 'Marquer comme à faire' }),
  ).toBeVisible();
  await expect(
    page.getByRole('progressbar', { name: /Progression de la leçon/ }),
  ).toHaveAttribute('aria-valuenow', '50');

  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByLabel('Vrai').check();
  await page.getByRole('button', { name: 'Envoyer mes réponses' }).click();
  await expect(page.getByText('Quiz réussi')).toBeVisible();
  await expect(page.getByText('100 %').first()).toBeVisible();

  await page
    .getByRole('button', { name: 'Revenir à la page précédente' })
    .click();
  await expect(
    page.getByRole('progressbar', { name: /Progression de la leçon/ }),
  ).toHaveAttribute('aria-valuenow', '100');

  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: 'Profil' })
    .click();
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Connexion' }),
  ).toBeVisible();

  await page.getByLabel('Adresse e-mail').fill(credentials.email);
  await page.getByLabel('Mot de passe').fill(credentials.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await openCriticalLesson(page);

  await expect(
    page.getByRole('heading', { level: 2, name: 'Tâche critique' }),
  ).toBeVisible();
  await expect(
    page.getByRole('progressbar', { name: /Progression de la leçon/ }),
  ).toHaveAttribute('aria-valuenow', '100');

  await page.setViewportSize({ height: 700, width: 320 });
  await expectNoHorizontalOverflow(page);
});
