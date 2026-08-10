import { expect, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from './accessibility';

const viewports = [
  { height: 720, width: 320 },
  { height: 844, width: 390 },
  { height: 900, width: 768 },
  { height: 900, width: 1024 },
  { height: 1000, width: 1440 },
  { height: 1080, width: 1920 },
] as const;

test('les primitives restent lisibles et actionnables aux largeurs de référence', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'La matrice est exécutée une fois avec des viewports déterministes.',
  );

  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      contentType: 'application/json',
      json: { user: null },
      status: 200,
    }),
  );

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/login');

    const primaryAction = page.locator('.ui-action--primary').first();
    const field = page.locator('.ui-field__control').first();
    await expect(primaryAction).toBeVisible();
    await expect(field).toBeVisible();

    const actionBox = await primaryAction.boundingBox();
    const fieldBox = await field.boundingBox();
    expect(actionBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(fieldBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }

  await page.setViewportSize({ height: 844, width: 390 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expectNoSeriousA11yViolations(page);
});
