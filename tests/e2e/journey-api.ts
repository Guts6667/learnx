import { expect, type Page } from '@playwright/test';

/** Deterministic journey fixtures and API mock shared by e2e and visual suites. */
export const credentials = {
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

export const lessonSummary = {
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
  title: 'Comprendre les responsabilités d’une plateforme produit',
};

export const moduleSummary = {
  id: 'module-1',
  isPublished: true,
  lessons: [lessonSummary],
  position: 1,
  progress: { percent: 0, status: 'AVAILABLE' },
  slug: 'module-e2e',
  title: 'Module E2E',
};

export const stageSummary = {
  description: 'Une étape compacte pour le parcours critique.',
  estimatedDurationDays: 1,
  estimatedMinutes: null,
  id: 'stage-1',
  isPublished: true,
  modules: [moduleSummary],
  position: 1,
  progress: { percent: 0, status: 'AVAILABLE' },
  slug: 'stage-e2e',
  timeline,
  title: 'Étape E2E',
};

export const program = {
  description: 'Programme utilisé par le scénario E2E critique.',
  estimatedDurationDays: 1,
  id: 'program-1',
  slug: 'programme-e2e',
  stages: [stageSummary],
  status: 'ACTIVE',
  timeline,
  title: 'Programme E2E',
  viewPreference: { expandedStageId: 'stage-1' },
};

interface JourneyState {
  authenticated: boolean;
  /** Aucune commande tant que l'apprenant n'a pas lancé un achat. */
  order: 'FULFILLED' | 'NONE' | 'PENDING';
  quizPassed: boolean;
  registered: boolean;
  started: boolean;
  taskDone: boolean;
}

/**
 * L'achat de crédits (V4.5-204). Le catalogue et la commande sont figés ici
 * pour que le parcours soit reproductible ; le faux prestataire de paiement,
 * lui, vit dans le test qui s'en sert.
 */
const creditPacks = [
  {
    credits: '100',
    currency: 'EUR',
    key: 'starter',
    label: 'Découverte',
    labelEn: 'Starter',
    // Le moins cher des deux porte la limite, comme le palier d'entrée de la
    // vraie grille : c'est ce qui fait passer la condition d'achat sous les
    // yeux du parcours et de la capture (V4.5-213).
    oncePerAccount: true,
    recommended: false,
    priceMinor: '1500',
    approximateCorrections: '3',
    bonusCredits: '-1400',
    creditsPerEuro: '6',
  },
  {
    credits: '500',
    currency: 'EUR',
    key: 'regular',
    label: 'Régulier',
    labelEn: 'Regular',
    oncePerAccount: false,
    recommended: false,
    priceMinor: '5900',
    approximateCorrections: '16',
    bonusCredits: '-5400',
    creditsPerEuro: '8',
  },
];

export const creditOrderId = 'b4b0f4d2-0000-4000-8000-000000000001';

export const fakeProviderOrigin = 'https://paiement.exemple.test';

function creditOrder(status: 'FULFILLED' | 'PENDING') {
  return {
    amountMinor: '1500',
    createdAt: '2026-08-30T09:00:00.000Z',
    currency: 'EUR',
    fulfilledAt: status === 'FULFILLED' ? '2026-08-30T09:00:12.000Z' : null,
    id: creditOrderId,
    packKey: 'starter',
    status,
  };
}

function ownCredits() {
  return {
    accountStatus: 'ACTIVE',
    displayName: credentials.displayName,
    email: credentials.email,
    history: [],
    pendingIncreaseRequest: null,
    projection: {
      free: { available: '20', consumed: '0', expired: '0', reserved: '0' },
      purchased: { available: '0', consumed: '0', expired: '0', reserved: '0' },
      totalAvailable: '20',
      totalReserved: '0',
    },
    userId: user.id,
  };
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

export async function installJourneyApi(page: Page) {
  const state: JourneyState = {
    authenticated: false,
    order: 'NONE',
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
        hasMorePrograms: false,
        lastActivity: null,
        program: null,
        programCount: 0,
        programs: [],
        reviewsDue: 0,
      });
      return;
    }

    if (method === 'GET' && path === '/api/programs') {
      await respond({ programs: [program] });
      return;
    }

    if (method === 'GET' && path === '/api/catalog/programs') {
      await respond({
        items: [
          {
            description: program.description,
            estimatedDurationDays: program.estimatedDurationDays,
            icon: null,
            id: program.id,
            isEnrolled: true,
            publishedVersion: {
              checksum: 'e2e-checksum',
              id: 'version-1',
              number: 1,
              publishedAt: '2026-08-03T08:00:00.000Z',
            },
            slug: program.slug,
            stageCount: 1,
            title: program.title,
          },
        ],
        nextCursor: null,
      });
      return;
    }

    if (method === 'GET' && path === '/api/me/programs') {
      await respond({
        items: [
          {
            enrollment: {
              enrolledAt: '2026-08-03T08:00:00.000Z',
              id: 'enrollment-1',
              status: 'ACTIVE',
              updatedAt: '2026-08-03T08:00:00.000Z',
              withdrawnAt: null,
            },
            program: {
              description: program.description,
              estimatedDurationDays: program.estimatedDurationDays,
              icon: null,
              id: program.id,
              publishedVersion: {
                checksum: 'e2e-checksum',
                id: 'version-1',
                number: 1,
                publishedAt: '2026-08-03T08:00:00.000Z',
              },
              slug: program.slug,
              title: program.title,
            },
            progress: {
              completedAt: null,
              lastViewedAt: '2026-08-03T08:00:00.000Z',
              percent: 0,
              startedAt: null,
              targetEndAt: null,
            },
          },
        ],
        nextCursor: null,
      });
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
              key: 'content-1',
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
              key: 'quiz-1',
              passingScore: 80,
              position: 1,
              questionCount: 1,
              title: 'Quiz critique',
            },
          ],
          resources: [],
          sequence: [
            {
              id: '00000000-0000-4000-8000-000000000001',
              key: 'content-1',
              kind: 'CONTENT',
            },
            {
              id: '00000000-0000-4000-8000-000000000002',
              key: 'task-1',
              kind: 'TASK',
            },
            {
              id: '00000000-0000-4000-8000-000000000003',
              key: 'quiz-1',
              kind: 'QUIZ',
            },
          ],
          tasks: [
            {
              description: 'Cochez cette tâche avant de passer le quiz.',
              id: 'task-1',
              isRequired: true,
              key: 'task-1',
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

    if (method === 'PATCH' && path === '/api/lessons/lesson-1/location') {
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

    if (method === 'POST' && path === '/api/notes') {
      const input = request.postDataJSON() as Record<string, unknown>;
      await respond(
        {
          note: {
            createdAt: '2026-08-03T08:00:00.000Z',
            id: 'note-contextuelle-1',
            lesson: { id: 'lesson-1', title: lessonSummary.title },
            markdown: '',
            program: { id: 'program-1', title: program.title },
            sequenceItem: {
              id: input.sequenceItemId,
              key: 'content-1',
              kind: 'CONTENT',
            },
            title: input.title,
            updatedAt: '2026-08-03T08:00:00.000Z',
          },
        },
        201,
      );
      return;
    }

    if (method === 'PATCH' && path === '/api/notes/note-contextuelle-1') {
      const input = request.postDataJSON() as Record<string, unknown>;
      await respond({
        note: {
          createdAt: '2026-08-03T08:00:00.000Z',
          id: 'note-contextuelle-1',
          lesson: { id: 'lesson-1', title: lessonSummary.title },
          markdown: input.markdown,
          program: { id: 'program-1', title: program.title },
          sequenceItem: {
            id: '00000000-0000-4000-8000-000000000001',
            key: 'content-1',
            kind: 'CONTENT',
          },
          title: input.title,
          updatedAt: '2026-08-03T08:01:00.000Z',
        },
      });
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

    if (method === 'GET' && path === '/api/credits') {
      await respond({ credits: ownCredits() });
      return;
    }

    if (method === 'GET' && path === '/api/credits/packs') {
      // `paymentsEnabled` is not optional (V4.5-205): the screen would have to
      // guess when it is absent, and guessing "open" offers a purchase that
      // fails. A stub without it is not a response the server can produce.
      await respond({
        correctionQuoteCredits: '30',
        correctionReservationCredits: '41',
        packs: creditPacks,
        paymentsEnabled: true,
      });
      return;
    }

    if (method === 'GET' && path === '/api/credits/orders') {
      await respond({
        orders: state.order === 'NONE' ? [] : [creditOrder(state.order)],
      });
      return;
    }

    if (method === 'POST' && path === '/api/credits/checkout') {
      const input = request.postDataJSON() as { packKey?: string };
      expect(creditPacks.map((pack) => pack.key)).toContain(input.packKey);
      // La commande existe dès que la session de paiement est créée, et elle
      // reste en attente : c'est le webhook qui l'honore, jamais le retour du
      // navigateur.
      state.order = 'PENDING';
      await respond({
        resource: {
          checkout: {
            correctionSuspended: false,
            orderId: creditOrderId,
            url: `${fakeProviderOrigin}/pay/${creditOrderId}`,
          },
        },
      });
      return;
    }

    throw new Error(`Requête API E2E non simulée : ${method} ${path}`);
  });
}

/**
 * Ce que le webhook a fait, vu depuis l'écran : la commande est honorée.
 * Enregistrée APRÈS `installJourneyApi` — Playwright fait gagner la dernière
 * route — parce que rien, côté navigateur, ne peut honorer une commande.
 */
export async function installFulfilledCreditsOrder(page: Page) {
  await page.route('**/api/credits/orders', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: { orders: [creditOrder('FULFILLED')] },
    });
  });
}

/**
 * Le catalogue public (V4.5-206), la seule route que la page publique lit.
 *
 * Par défaut vide : c'est l'état réel du produit tant qu'aucun palier n'est
 * activé, et l'état que la landing doit rendre — « bientôt », jamais un prix
 * d'attente.
 */
export async function installPublicCatalogue(
  page: Page,
  packs: readonly {
    approximateCorrections: string;
    bonusCredits: string;
    credits: string;
    creditsPerEuro: string;
    currency: string;
    key: string;
    label: string;
    labelEn: string;
    oncePerAccount: boolean;
    priceMinor: string;
  }[] = [],
) {
  await page.route('**/api/public/credit-packs', async (route) => {
    // Le devis et la réserve accompagnent toujours la liste, même vide : ils
    // ne dépendent d'aucun palier, et le contrat public les exige (V4.5-213).
    // Une réponse privée de ces deux champs est illisible, pas « bientôt ».
    await route.fulfill({
      contentType: 'application/json',
      json: {
        correctionQuoteCredits: '30',
        correctionReservationCredits: '41',
        packs,
      },
    });
  });
}

export async function openCriticalLesson(page: Page) {
  await page.goto('/program');
  await expect(page.locator('[data-visual-system="totem"]')).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Mes parcours' }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: /Commencer|Ouvrir le programme/ })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: program.title }),
  ).toBeVisible();
  await page
    .getByRole('link', {
      name: `Ouvrir ${lessonSummary.title}, module ${moduleSummary.title}, Disponible`,
    })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: lessonSummary.title }),
  ).toBeVisible();
}

export async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        if (document.documentElement.scrollWidth <= window.innerWidth)
          return [];

        return Array.from(document.querySelectorAll<HTMLElement>('body *'))
          .map((element) => ({
            element,
            rect: element.getBoundingClientRect(),
          }))
          .filter(
            ({ rect }) =>
              rect.width > 0 &&
              (rect.right > window.innerWidth + 0.5 || rect.left < -0.5),
          )
          .slice(0, 8)
          .map(({ element, rect }) =>
            [
              element.tagName.toLowerCase(),
              element.className,
              element.textContent?.trim().slice(0, 60),
              `${Math.round(rect.left)}..${Math.round(rect.right)}`,
            ].join(' | '),
          );
      }),
    )
    .toEqual([]);
}
