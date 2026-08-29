import { expect, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from './accessibility';
import {
  credentials,
  expectNoHorizontalOverflow,
  installJourneyApi,
  lessonSummary,
  moduleSummary,
  openCriticalLesson,
  program,
  stageSummary,
} from './journey-api';

test('garde Mes parcours et Découvrir utilisables sur tous les viewports', async ({
  page,
}) => {
  await installJourneyApi(page);
  await page.goto('/login');
  await page.evaluate(async (input) => {
    await fetch('/api/auth/register', {
      body: JSON.stringify(input),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
  }, credentials);

  for (const viewport of [
    { height: 700, width: 320 },
    { height: 844, width: 390 },
    { height: 900, width: 720 },
    { height: 1000, width: 1440 },
    { height: 1080, width: 1920 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/program');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Mes parcours' }),
    ).toBeVisible();
    const exploreLink = page.getByRole('link', {
      name: 'Explorer les programmes',
    });
    await expect(exploreLink).toHaveAttribute('href', '/discover');
    await expect(
      page.getByRole('heading', { name: program.title }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await exploreLink.click();
    await expect(page).toHaveURL('/discover');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Trouver un parcours' }),
    ).toBeVisible();
    await expect(page.getByRole('searchbox')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: program.title }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  await expectNoSeriousA11yViolations(page);
});

test('oriente la première arrivée sans afficher d’outils vides', async ({
  page,
}) => {
  await installJourneyApi(page);
  await page.goto('/login');
  await page.evaluate(async (input) => {
    await fetch('/api/auth/register', {
      body: JSON.stringify(input),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
  }, credentials);

  for (const viewport of [
    { height: 700, width: 320 },
    { height: 844, width: 390 },
    { height: 900, width: 720 },
    { height: 1000, width: 1440 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/today');
    await expect(page.locator('[data-visual-system="totem"]')).toBeVisible();
    const action = page.getByRole('link', {
      name: 'Choisir mon premier parcours',
    });
    await expect(action).toBeVisible();
    await expect(action).toHaveAttribute('href', '/discover');
    await expect(page.getByRole('searchbox')).toHaveCount(0);
    await expect(page.getByText('Révisions dues')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  }

  await expectNoSeriousA11yViolations(page);
});

test('applique les gabarits desktop sans étirer la lecture pédagogique', async ({
  page,
}) => {
  await installJourneyApi(page);
  await page.goto('/login');
  await page.evaluate(async (input) => {
    await fetch('/api/auth/register', {
      body: JSON.stringify(input),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
  }, credentials);

  const screens = [
    { path: '/today', template: 'work', totem: true },
    { path: `/program/${program.slug}`, template: 'work', totem: true },
    {
      path: `/program/${program.slug}/lesson/${lessonSummary.slug}`,
      template: 'reading',
      totem: true,
    },
    { path: '/notes', template: 'work', totem: true },
    { path: '/profile', template: 'work', totem: true },
  ] as const;

  for (const viewport of [
    { height: 900, width: 720 },
    { height: 1000, width: 1440 },
    { height: 1080, width: 1920 },
  ]) {
    await page.setViewportSize(viewport);
    for (const screen of screens) {
      await page.goto(screen.path);
      const layout = page.locator(`.page-layout--${screen.template}`).first();
      await expect(layout).toBeVisible();
      if (screen.totem) {
        await expect(
          page.locator('[data-visual-system="totem"]'),
        ).toBeVisible();
      } else {
        await expect(page.locator('[data-visual-system="totem"]')).toHaveCount(
          0,
        );
      }
      await expectNoHorizontalOverflow(page);
    }
  }

  await page.setViewportSize({ height: 900, width: 720 });
  await page.goto(`/program/${program.slug}/lesson/${lessonSummary.slug}`);
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
  await expectNoHorizontalOverflow(page);
  expect(
    await page
      .locator('.page-layout--reading')
      .evaluate((element) =>
        getComputedStyle(element).getPropertyValue('--app-reading-max').trim(),
      ),
  ).toBe('72ch');
  await expectNoSeriousA11yViolations(page);
});

test('rend le programme comme un accordéon plat et compact sur mobile', async ({
  page,
}) => {
  await installJourneyApi(page);
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto('/login');
  await page.evaluate(async (input) => {
    await fetch('/api/auth/register', {
      body: JSON.stringify(input),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
  }, credentials);
  await page.goto('/program/programme-e2e');

  await expect(
    page.getByRole('heading', { level: 1, name: program.title }),
  ).toBeVisible();
  await expect(
    page.getByRole('progressbar', { name: 'Progression du programme' }),
  ).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(1);

  const stageButton = page.getByRole('button', {
    name: `1. ${stageSummary.title}`,
  });
  await expect(stageButton).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText(stageSummary.description)).toHaveCount(0);
  await expect(
    page.getByRole('list', {
      name: `Leçons du module ${moduleSummary.title}`,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: moduleSummary.title }),
  ).toHaveCount(0);

  const lessonLink = page.getByRole('link', {
    name: `Ouvrir ${lessonSummary.title}, module ${moduleSummary.title}, Disponible`,
  });
  await expect(lessonLink).toHaveAttribute(
    'href',
    `/program/${program.slug}/lesson/${lessonSummary.slug}`,
  );
  const lessonTitleBox = await lessonLink
    .getByText(lessonSummary.title, { exact: true })
    .boundingBox();
  const lessonDurationBox = await lessonLink
    .getByText(`${lessonSummary.estimatedMinutes} min`, { exact: true })
    .boundingBox();
  expect(lessonTitleBox).not.toBeNull();
  expect(lessonDurationBox).not.toBeNull();
  expect(lessonDurationBox?.y).toBeGreaterThan(lessonTitleBox?.y ?? 0);
  await expect(page.locator('.ui-card .ui-card')).toHaveCount(0);
  await expect(page.getByText(/Sur iPhone, touchez Partager/)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousA11yViolations(page);

  await stageButton.focus();
  await page.keyboard.press('Enter');
  await expect(stageButton).toHaveAttribute('aria-expanded', 'false');
  await expect(
    page.getByRole('list', {
      name: `Leçons du module ${moduleSummary.title}`,
    }),
  ).toHaveCount(0);

  await page.reload();
  await expect(stageButton).toHaveAttribute('aria-expanded', 'true');

  await page.addStyleTag({ content: ':root { font-size: 200%; }' });
  await expectNoHorizontalOverflow(page);
  await expect(stageButton).toBeVisible();
  await expect(lessonLink).toBeVisible();

  await page.setViewportSize({ height: 700, width: 320 });
  await expectNoHorizontalOverflow(page);
  await expect(stageButton).toBeVisible();
  await expect(lessonLink).toBeVisible();
});

test('utilise des parents UX stables sans boucle entre programme, module et leçon', async ({
  page,
}) => {
  await installJourneyApi(page);
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto('/login');
  await page.evaluate(async (input) => {
    await fetch('/api/auth/register', {
      body: JSON.stringify(input),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
  }, credentials);

  await page.goto(`/program/${program.slug}/lesson/${lessonSummary.slug}`);
  await expect(
    page.getByRole('heading', { level: 1, name: lessonSummary.title }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retour au programme' }).click();
  await expect(page).toHaveURL(
    `/program/${program.slug}?stage=${stageSummary.slug}`,
  );
  await expect(
    page.getByRole('button', { name: `1. ${stageSummary.title}` }),
  ).toHaveAttribute('aria-expanded', 'true');

  await page
    .getByRole('link', { name: 'Options et reprise du module' })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: moduleSummary.title }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retour au programme' }).click();
  await expect(page).toHaveURL(
    `/program/${program.slug}?stage=${stageSummary.slug}`,
  );

  await page
    .getByRole('link', { name: 'Voir les prérequis de l’étape' })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: stageSummary.title }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retour au programme' }).click();
  await expect(page).toHaveURL(
    `/program/${program.slug}?stage=${stageSummary.slug}`,
  );

  await page.getByRole('button', { name: 'Retour à Mes parcours' }).click();
  await expect(page).toHaveURL('/program');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Mes parcours' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Retour|Revenir/ }),
  ).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test('garde les cinq destinations lisibles et accessibles sur mobile et desktop', async ({
  page,
}) => {
  await installJourneyApi(page);
  await page.goto('/login');
  await page.evaluate(async (input) => {
    await fetch('/api/auth/register', {
      body: JSON.stringify(input),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
  }, credentials);
  await page.goto('/today');

  const navigation = page.getByRole('navigation', {
    name: 'Navigation principale',
  });
  const expectedLabels = [
    'Aujourd’hui',
    'Parcours',
    'Réviser',
    'Notes',
    'Profil',
  ];

  for (const viewport of [
    { height: 700, width: 320 },
    { height: 844, width: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await expectNoHorizontalOverflow(page);
    await expect(navigation).toBeVisible();

    for (const label of expectedLabels) {
      const link = navigation.getByRole('link', { name: label });
      await expect(link).toBeVisible();
      await link.focus();
      await expect(link).toBeFocused();
    }

    expect(
      await navigation.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
  }

  const activeLink = navigation.getByRole('link', { name: 'Aujourd’hui' });
  await expect(activeLink).toHaveAttribute('aria-current', 'page');
  expect(
    await activeLink.evaluate(
      (element) => getComputedStyle(element).textDecorationLine,
    ),
  ).not.toContain('underline');

  await page.setViewportSize({ height: 900, width: 1280 });
  const desktopGeometry = await navigation.evaluate((element) => {
    const links = Array.from(element.querySelectorAll('a'));
    const rectangle = element.getBoundingClientRect();

    return {
      height: rectangle.height,
      linkTops: links.map((link) => link.getBoundingClientRect().top),
      width: rectangle.width,
    };
  });

  expect(desktopGeometry.height).toBeGreaterThan(850);
  expect(desktopGeometry.width).toBeGreaterThanOrEqual(208);
  expect(desktopGeometry.width).toBeLessThanOrEqual(224);
  expect(desktopGeometry.linkTops).toEqual(
    [...desktopGeometry.linkTops].sort((left, right) => left - right),
  );
});

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
  await expectNoSeriousA11yViolations(page);
  await expectNoHorizontalOverflow(page);

  await openCriticalLesson(page);
  await expectNoSeriousA11yViolations(page);
  await page.getByRole('button', { name: 'Continuer' }).click();

  await page.getByRole('button', { name: 'Marquer comme terminé' }).click();
  await expect(
    page.getByRole('button', { name: 'Marquer comme à faire' }),
  ).toBeVisible();
  await expect(
    page.getByRole('progressbar', { name: /Validation de la leçon/ }),
  ).toHaveAttribute('aria-valuenow', '50');

  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByLabel('Vrai').check();
  await page.getByRole('button', { name: 'Envoyer mes réponses' }).click();
  await expect(page.getByText('Quiz réussi')).toBeVisible();
  await expect(page.getByText('100 %').first()).toBeVisible();

  await page.getByRole('link', { name: /^Leçon :/ }).click();
  await expect(
    page.getByRole('progressbar', { name: /Validation de la leçon/ }),
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
    page.getByRole('heading', { level: 2, name: 'Contenu 1' }),
  ).toBeVisible();
  await expect(
    page.getByRole('progressbar', { name: /Validation de la leçon/ }),
  ).toHaveAttribute('aria-valuenow', '100');

  await page.setViewportSize({ height: 700, width: 320 });
  await expectNoHorizontalOverflow(page);
});

test('affiche le sommaire pédagogique en une colonne sans débordement', async ({
  page,
}) => {
  await installJourneyApi(page);
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto('/login');
  await page.evaluate(async (input) => {
    await fetch('/api/auth/register', {
      body: JSON.stringify(input),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
  }, credentials);
  await page.goto('/program/programme-e2e/lesson/lecon-critique');

  const summaryTrigger = page.getByRole('button', { name: 'Sommaire' });
  const pedagogicalNavigation = page.getByRole('navigation', {
    name: 'Navigation pédagogique',
  });
  expect(
    await pedagogicalNavigation.evaluate(
      (element) => getComputedStyle(element).position,
    ),
  ).toBe('static');
  await summaryTrigger.click();
  const dialog = page.getByRole('dialog', { name: 'Sommaire de la leçon' });
  await expect(dialog).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  await expect(
    page.getByRole('button', { name: 'Fermer le panneau' }),
  ).toBeFocused();
  await expect(dialog.getByRole('listitem')).toHaveCount(4);
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  expect(
    await dialog.getByRole('listitem').evaluateAll((items) => {
      const positions = items.map((item) => item.getBoundingClientRect());
      return positions.every(
        (position, index) =>
          index === 0 ||
          (Math.abs(position.left - positions[0].left) < 1 &&
            position.top >= positions[index - 1].bottom),
      );
    }),
  ).toBe(true);
  await expectNoHorizontalOverflow(page);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(summaryTrigger).toBeFocused();

  await page.setViewportSize({ height: 720, width: 320 });
  await summaryTrigger.click();
  await expectNoHorizontalOverflow(page);
  expect(
    await page
      .getByRole('dialog', { name: 'Sommaire de la leçon' })
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.getByRole('button', { name: 'Fermer le panneau' }).click();

  await page.setViewportSize({ height: 900, width: 1280 });
  await summaryTrigger.click();
  await expectNoHorizontalOverflow(page);
  await expect(
    page.getByRole('dialog', { name: 'Sommaire de la leçon' }),
  ).toBeVisible();
});

test('crée une note contextuelle accessible sans casser la lecture mobile', async ({
  page,
}) => {
  await installJourneyApi(page);
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto('/login');
  await page.evaluate(async (input) => {
    await fetch('/api/auth/register', {
      body: JSON.stringify(input),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
  }, credentials);
  await page.goto('/program/programme-e2e/lesson/lecon-critique');

  const noteButton = page.getByRole('button', { name: 'Prendre une note' });
  const navigation = page.getByRole('navigation', {
    name: 'Navigation pédagogique',
  });
  await expect(noteButton).toBeVisible();
  expect(
    await noteButton.evaluate(
      (button, navigationElement) =>
        Boolean(
          button.compareDocumentPosition(navigationElement as Node) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      await navigation.elementHandle(),
    ),
  ).toBe(true);

  const creationRequest = page.waitForRequest(
    (request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/notes',
  );
  await noteButton.click();
  const request = await creationRequest;
  expect(request.postDataJSON()).toMatchObject({
    lessonId: 'lesson-1',
    sequenceItemId: '00000000-0000-4000-8000-000000000001',
  });
  expect(request.postDataJSON().creationKey).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );

  const dialog = page.getByRole('dialog', { name: 'Prendre une note' });
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Fermer le panneau' }),
  ).toBeFocused();
  await expect(dialog).toContainText(
    `La note est automatiquement liée à la leçon « ${lessonSummary.title} » et à l’activité « Contenu 1 ».`,
  );
  await expectNoSeriousA11yViolations(page);

  const autosaveRequest = page.waitForRequest(
    (autosave) =>
      autosave.method() === 'PATCH' &&
      new URL(autosave.url()).pathname === '/api/notes/note-contextuelle-1',
  );
  await dialog.getByLabel('Contenu de la note').fill('Repère important.');
  await dialog.getByRole('button', { name: 'Enregistrer' }).click();
  await autosaveRequest;
  await expect(
    dialog.getByText('Note enregistrée.', { exact: true }),
  ).toBeVisible();

  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
  await expectNoHorizontalOverflow(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(noteButton).toBeFocused();
});

test('reste utilisable avec texte agrandi et réduction des animations', async ({
  page,
}) => {
  await installJourneyApi(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto('/login');
  await page.evaluate(async (input) => {
    await fetch('/api/auth/register', {
      body: JSON.stringify(input),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
  }, credentials);
  await page.goto('/today');
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });

  await expect(
    page.getByRole('heading', { level: 1, name: 'Aujourd’hui' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('navigation', { name: 'Navigation principale' })
      .getByRole('link', { name: 'Parcours' }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousA11yViolations(page);

  const animationDuration = await page
    .locator('body')
    .evaluate((element) => getComputedStyle(element).animationDuration);
  expect(Number.parseFloat(animationDuration || '0')).toBeLessThanOrEqual(0.01);
});

test('conserve la route privée et reprend après reconnexion', async ({
  context,
  page,
}) => {
  await installJourneyApi(page);
  await page.goto('/login');
  await page.evaluate(async (input) => {
    await fetch('/api/auth/register', {
      body: JSON.stringify(input),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
  }, credentials);
  await page.goto('/today');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Aujourd’hui' }),
  ).toBeVisible();

  await context.setOffline(true);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Mode hors ligne' }),
  ).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/today');

  await context.setOffline(false);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Aujourd’hui' }),
  ).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/today');
});
