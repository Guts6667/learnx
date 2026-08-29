import { expect, type Page, test } from '@playwright/test';

import {
  credentials,
  installJourneyApi,
  lessonSummary,
  moduleSummary,
  program,
} from '../e2e/journey-api';

/**
 * Baselines for the surfaces a design-system change touches. Public pages need
 * no session; the rest reuse the deterministic journey mock so the pixels never
 * depend on database state.
 */

async function signIn(page: Page) {
  await installJourneyApi(page);
  await page.goto('/login');
  // The mock only authenticates after a registration, matching the e2e suite.
  await page.evaluate(async (input) => {
    await fetch('/api/auth/register', {
      body: JSON.stringify(input),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
  }, credentials);
  await page.goto('/today');
}

async function settle(page: Page) {
  // Web fonts change metrics on load, which would otherwise race the capture.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
}

const publicSurfaces = [
  { name: 'landing', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'request-access', path: '/request-access' },
  { name: 'not-found', path: '/cette-route-nexiste-pas' },
] as const;

for (const surface of publicSurfaces) {
  test(`public — ${surface.name}`, async ({ page }) => {
    await page.goto(surface.path);
    await settle(page);
    await expect(page).toHaveScreenshot(`${surface.name}.png`, {
      fullPage: true,
    });
  });
}

test('app — today', async ({ page }) => {
  await signIn(page);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Aujourd’hui' }),
  ).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot('today.png', { fullPage: true });
});

test('app — my programmes', async ({ page }) => {
  await signIn(page);
  await page.goto('/program');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Mes parcours' }),
  ).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot('programmes.png', { fullPage: true });
});

test('app — discover', async ({ page }) => {
  await signIn(page);
  await page.goto('/discover');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot('discover.png', { fullPage: true });
});

test('app — programme detail', async ({ page }) => {
  await signIn(page);
  await page.goto(`/program/${program.slug}`);
  await expect(
    page.getByRole('heading', { level: 1, name: program.title }),
  ).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot('programme-detail.png', {
    fullPage: true,
  });
});

test('app — lesson', async ({ page }) => {
  await signIn(page);
  await page.goto(`/program/${program.slug}`);
  await page
    .getByRole('link', {
      name: `Ouvrir ${lessonSummary.title}, module ${moduleSummary.title}, Disponible`,
    })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: lessonSummary.title }),
  ).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot('lesson.png', { fullPage: true });
});

test('app — notes', async ({ page }) => {
  await signIn(page);
  await page.goto('/notes');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot('notes.png', { fullPage: true });
});
