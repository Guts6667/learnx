import { expect, type Page, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from './accessibility';

const programId = 'a83f9385-aecd-41a8-ae33-c62d02fbb23f';
const stageId = '5cb04580-f91c-46e8-a5d3-d70be5043c1b';
const moduleId = 'd53ae785-0d74-4a13-9e0c-f90675f9dd29';

async function installAdminApi(page: Page) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/session') {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          user: {
            displayName: 'Admin E2E',
            email: 'admin@example.com',
            id: 'admin-e2e',
            role: 'ADMIN',
          },
        },
      });
      return;
    }
    if (path === `/api/admin/modules/${moduleId}`) {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          kind: 'MODULE',
          module: {
            description: 'Résumé du module administrable.',
            id: moduleId,
            isPublished: false,
            lessons: [
              {
                id: '87b72c3a-0b2f-4dda-b82c-5874c91df9c8',
                isPublished: false,
                position: 0,
                slug: 'lecon-test',
                summary: 'Résumé de la leçon.',
                title: 'Leçon administrable',
              },
            ],
            position: 0,
            slug: 'module-test',
            title: 'Module administrable',
            stage: {
              id: stageId,
              isPublished: false,
              position: 0,
              slug: 'etape-test',
              title: 'Étape administrable',
              program: {
                id: programId,
                position: 0,
                slug: 'programme-test',
                status: 'DRAFT',
                title: 'Programme administrable',
              },
            },
          },
        },
      });
      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      json: { error: { code: 'NOT_FOUND', message: 'Not found.' } },
      status: 404,
    });
  });
}

test('navigation admin profonde et tiroir accessibles sur mobile et desktop', async ({
  page,
}) => {
  await installAdminApi(page);
  const path = `/admin/program/${programId}/stage/${stageId}/module/${moduleId}`;
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto(path);

  await expect(
    page.getByRole('heading', { level: 1, name: 'Module administrable' }),
  ).toBeVisible();
  await expect(page.getByText('Leçon administrable')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  const trigger = page.getByRole('button', { name: 'Gérer ce contenu' });
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  await expect(
    page.getByRole('button', { name: 'Fermer le panneau' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(trigger).toBeFocused();

  for (const viewport of [
    { height: 900, width: 768 },
    { height: 900, width: 1024 },
    { height: 1000, width: 1440 },
    { height: 1080, width: 1920 },
  ]) {
    await page.setViewportSize(viewport);
    await page.reload();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Module administrable' }),
    ).toBeVisible();
    await expect(page.locator('.page-layout--admin')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }

  await page.setViewportSize({ height: 900, width: 1024 });
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expectNoSeriousA11yViolations(page);
});
