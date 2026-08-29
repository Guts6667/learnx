import { expect, test, type Page } from '@playwright/test';

import { expectNoSeriousA11yViolations } from './accessibility';

/**
 * Parcours de correction assistée (V4.5-150).
 *
 * Ce spec installe son PROPRE mock d'API plutôt que d'étendre
 * `tests/e2e/journey-api.ts` : ce dernier est partagé avec la suite visuelle,
 * et y ajouter un exercice déplacerait la capture `lesson.png` sans rapport
 * avec la correction.
 *
 * Les assertions portent sur des rôles ARIA et sur les crochets structurels du
 * panneau (`.correction-*`), jamais sur la mise en forme. Les quelques libellés
 * indispensables sont regroupés dans `copy` ci-dessous : une reformulation de
 * copie se répare à un seul endroit.
 */

const copy = {
  acquired: 'Acquis',
  consentAction: 'Confirmer et lancer la correction',
  quoteAction: 'Corriger',
  reconsiderationAction: 'Obtenir le devis de réexamen',
  reconsiderationConsent: 'Confirmer et lancer le réexamen',
  toReinforce: 'À renforcer',
} as const;

const submissionId = '2f8a1d54-0c3b-4a1e-9d77-5b6c8e0a1f22';
const exerciseId = '7c1b9a20-3f4d-4e55-9a10-0d2c6b8e4a31';
const firstCorrectionId = 'b0d4c1e2-7a35-4f18-9c62-3e5a7d9b1c40';
const secondCorrectionId = 'c1e5d2f3-8b46-4029-ad73-4f6b8e0c2d51';

const user = {
  displayName: 'Apprenant E2E',
  email: 'learner@example.com',
  id: 'user-1',
  role: 'USER',
};

const exercise = {
  aiCorrectionEligible: true,
  id: exerciseId,
  instructions:
    'Choisissez un cadre de question pour chacun des deux projets et justifiez ce choix.',
  isRequired: true,
  key: 'activity-2',
  lessonId: 'lesson-1',
  position: 1,
  rubric: null,
  title: 'Choisir sans forcer un cadre',
  weight: 1,
};

const submission = {
  contentMarkdown:
    'Pour le projet A, je retiens le cadre PICO, parce que le dossier décrit une comparaison entre une pratique de rappel hebdomadaire et la relecture libre.',
  createdAt: '2026-08-29T09:00:00.000Z',
  exerciseId,
  id: submissionId,
  status: 'SUBMITTED',
  submittedAt: '2026-08-29T09:30:00.000Z',
  updatedAt: '2026-08-29T09:30:00.000Z',
  userId: user.id,
};

/** Un critère démontré et un critère incertain : les deux groupes du résultat. */
function correctionPayload(id: string, overallFeedback: string) {
  return {
    criteria: [
      {
        evidenceQuotes: ['une comparaison entre une pratique de rappel'],
        evidenceStatus: 'FOUND',
        feedback:
          'Deux faits distincts et fidèles sont repris pour le projet A.',
        key: 'dossier-fidelity',
        label: 'Fidélité au dossier',
        levelKey: 'mastered',
        levelLabel: 'Démontré dans la réponse',
        weight: 33,
      },
    ],
    id,
    indicativeScore: null,
    overallFeedback,
    secondPassRequired: false,
    status: 'COMPLETED_PARTIAL',
    unsureCriteria: ['choice-rationale'],
    unsureCriterionDetails: [
      { key: 'choice-rationale', label: 'Justification du lien' },
    ],
  };
}

const settlement = {
  releasedCredits: '6',
  reservedCredits: '18',
  settledCredits: '12',
};

async function installCorrectionApi(page: Page) {
  const state = { corrections: [] as unknown[], quoteCount: 0 };

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname;
    const respond = (json: unknown, status = 200) =>
      route.fulfill({ contentType: 'application/json', json, status });

    if (path === '/api/auth/session') {
      await respond({ user });
      return;
    }

    if (method === 'GET' && path === '/api/lessons/lecon-critique') {
      await respond({
        lesson: {
          concepts: [],
          contentBlocks: [],
          estimatedMinutes: 10,
          exercises: [exercise],
          id: 'lesson-1',
          isLocked: false,
          isPublished: true,
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
          objectives: [],
          position: 1,
          prerequisites: [],
          progress: { percent: 0, status: 'IN_PROGRESS' },
          quizzes: [],
          resources: [],
          sequence: [
            {
              id: '00000000-0000-4000-8000-000000000001',
              key: 'activity-2',
              kind: 'EXERCISE',
            },
          ],
          slug: 'lecon-critique',
          summary: 'Une leçon publiée pour valider la correction assistée.',
          tasks: [],
          title: 'Comprendre les responsabilités d’une plateforme produit',
        },
      });
      return;
    }

    if (method === 'GET' && path === `/api/exercises/${exerciseId}`) {
      await respond({ exercise: { ...exercise, submission } });
      return;
    }

    if (path === '/api/lessons/lesson-1/progress') {
      await respond({
        canComplete: false,
        conceptProgress: {},
        exerciseSubmissions: { [exerciseId]: submission },
        lessonProgress: {
          completedAt: null,
          percent: 0,
          startedAt: '2026-08-29T08:00:00.000Z',
          status: 'IN_PROGRESS',
        },
        quizPassed: {},
        resourceProgress: {},
        taskCompletions: {},
      });
      return;
    }

    if (
      method === 'GET' &&
      path === `/api/exercise-submissions/${submissionId}/ai-corrections`
    ) {
      await respond({ resource: { corrections: state.corrections } });
      return;
    }

    if (method === 'POST' && path === '/api/ai-correction/quotes') {
      const input = request.postDataJSON() as { action?: string };
      state.quoteCount += 1;
      await respond({
        resource: {
          quote: {
            action:
              input.action === 'RECONSIDERATION'
                ? 'RECONSIDERATION'
                : 'STANDARD',
            estimatedCredits: '12',
            expiresAt: '2026-08-29T19:00:00.000Z',
            id: `quote-${state.quoteCount}`,
            includesAutomaticSecondPass: false,
            maximumReservedCredits: '18',
          },
        },
      });
      return;
    }

    if (method === 'POST' && path === '/api/ai-corrections') {
      const isReconsideration = state.corrections.length > 0;
      const correction = isReconsideration
        ? correctionPayload(
            secondCorrectionId,
            'Le lien est maintenant explicite pour le projet B.',
          )
        : correctionPayload(
            firstCorrectionId,
            'Clarifiez maintenant la justification du cadre choisi.',
          );

      state.corrections = [
        ...state.corrections,
        {
          action: isReconsideration ? 'RECONSIDERATION' : 'STANDARD',
          correction,
          createdAt: isReconsideration
            ? '2026-08-29T11:00:00.000Z'
            : '2026-08-29T10:00:00.000Z',
          settlement,
          sourceCorrectionId: isReconsideration ? firstCorrectionId : null,
        },
      ];

      await respond({
        resource: { correction: { correction, replay: false, settlement } },
      });
      return;
    }

    await respond({}, 200);
  });
}

async function openExercise(page: Page) {
  await installCorrectionApi(page);
  await page.goto(
    `/program/programme-e2e/lesson/lecon-critique/exercise/${exerciseId}`,
  );
}

test.describe('correction assistée', () => {
  test('annonce le devis, exige un consentement, puis restitue le résultat', async ({
    page,
  }) => {
    await openExercise(page);

    // Le contrat avant engagement : aucun débit n'est possible sans consentement.
    const quoteButton = page.getByRole('button', { name: copy.quoteAction });
    await expect(quoteButton).toBeVisible();
    await expect(page.locator('.correction-state__notice')).toBeVisible();

    await quoteButton.click();

    // Le devis annonce plafond et estimation AVANT la confirmation.
    const consent = page.locator('.correction-state--consent');
    await expect(consent).toBeVisible();
    await expect(consent.locator('.correction-contract')).toContainText('18');
    await expect(consent.locator('.correction-contract')).toContainText('12');

    await page.getByRole('button', { name: copy.consentAction }).click();

    // Résultat : acquis avant à renforcer, puis le récapitulatif de règlement.
    const result = page.locator('.correction-result');
    await expect(result).toBeVisible();
    await expect(result).toContainText(copy.acquired);
    await expect(result).toContainText(copy.toReinforce);
    await expect(result.locator('.correction-criterion')).toHaveCount(2);

    // La preuve est citée verbatim depuis la réponse de l'apprenant.
    await expect(
      result.locator('.correction-criterion__evidence blockquote').first(),
    ).toContainText('une comparaison entre une pratique de rappel');

    // Aucun chiffre quand un critère reste incertain — et l'absence est
    // expliquée plutôt que laissée vide (V4.5-113).
    await expect(result.locator('.correction-result__score')).toHaveText(
      /Aucun score indicatif/,
    );
    await expect(result.locator('.correction-settlement')).toBeVisible();

    // Aucun test ne couvrait l'accessibilité des états de correction.
    await expectNoSeriousA11yViolations(page);
  });

  test('le critère incertain ne porte aucun niveau', async ({ page }) => {
    await openExercise(page);
    await page.getByRole('button', { name: copy.quoteAction }).click();
    await page.getByRole('button', { name: copy.consentAction }).click();

    const unsure = page.locator('.correction-criterion--unsure');
    await expect(unsure).toBeVisible();
    await expect(unsure).toContainText('Justification du lien');
    // Le niveau du critère démontré ne doit pas fuiter sur le critère incertain.
    await expect(unsure).not.toContainText('Démontré dans la réponse');
  });

  test('un réexamen conserve la correction précédente dans l’historique', async ({
    page,
  }) => {
    await openExercise(page);
    await page.getByRole('button', { name: copy.quoteAction }).click();
    await page.getByRole('button', { name: copy.consentAction }).click();
    await expect(page.locator('.correction-result')).toBeVisible();

    // Le réexamen exige un argument écrit d'au moins 20 caractères.
    const argument = page
      .locator('.correction-reconsideration')
      .getByRole('textbox');
    await expect(argument).toBeVisible();
    await argument.fill(
      'La justification du projet B relie bien la charge perçue au cadre retenu.',
    );

    await page
      .getByRole('button', { name: copy.reconsiderationAction })
      .click();
    await page
      .getByRole('button', { name: copy.reconsiderationConsent })
      .click();

    // Les deux corrections coexistent : l'historique n'écrase jamais.
    const history = page.locator('.correction-history');
    await expect(history).toBeVisible();
    await expect(
      history.locator('.correction-history__choices button'),
    ).toHaveCount(2);

    // Et le réexamen ne peut pas être relancé une seconde fois.
    await expect(
      page.getByRole('button', { name: copy.reconsiderationAction }),
    ).toHaveCount(0);
  });
});
