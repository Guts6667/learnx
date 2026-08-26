import { expect, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from './accessibility';

const routes = [
  { heading: 'Connexion', path: '/login' },
  { heading: 'Demander un accès', path: '/request-access' },
  { heading: 'Vérifier mon adresse e-mail', path: '/verify-email' },
  { heading: 'Activer mon compte', path: '/activate' },
  { heading: 'Lien indisponible', path: '/interest' },
  { heading: 'Page introuvable', path: '/adresse-publique-inconnue' },
] as const;

const viewports = [
  { height: 720, width: 320 },
  { height: 844, width: 390 },
  { height: 900, width: 720 },
  { height: 1000, width: 1440 },
  { height: 1080, width: 1920 },
] as const;

test('surfaces publiques et d’authentification sans régression responsive', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'La matrice déterministe est exécutée une fois.',
  );
  const mutations: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET') mutations.push(request.url());
  });
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      body: JSON.stringify({ user: null }),
      contentType: 'application/json',
      status: 200,
    });
  });

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await page.goto(route.path);
      await expect(
        page.getByRole('heading', { level: 1, name: route.heading }),
      ).toBeVisible();
      await expect(page.locator('main#main-content')).toHaveCount(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
  }

  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto('/login');
  const main = page.locator('main#main-content');
  await main.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('link', { name: 'LearnX' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  const skipLink = page.getByRole('link', {
    name: 'Aller au contenu principal',
  });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(main).toBeFocused();
  await expectNoSeriousA11yViolations(page);
  expect(mutations).toEqual([]);
});
