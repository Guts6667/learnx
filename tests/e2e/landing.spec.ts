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

test('landing publique bilingue sans requête privée et PWA dédiée', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'La matrice déterministe est exécutée une fois.',
  );
  const privateRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/')) privateRequests.push(request.url());
  });

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Un parcours, pas une bibliothèque.',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Navigation principale' }),
    ).toHaveCount(0);
    await expect(
      page
        .getByRole('heading', { name: 'Fondamentaux de la psychologie' })
        .first(),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Définir la psychologie' }),
    ).toBeVisible();
    await expect(
      page.getByText(/Psychology 2e — 1\.1 What Is Psychology\?/),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await testInfo.attach(`landing-a5-${viewport.width}x${viewport.height}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  }

  await page.setViewportSize({ height: 844, width: 390 });
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'A journey, not a library.' }),
  ).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  expect(privateRequests).toEqual([]);

  const manifest = await page.request.get('/manifest-en.webmanifest');
  expect(manifest.ok()).toBe(true);
  expect((await manifest.json()).start_url).toBe('/today');
  for (const size of [1024, 512, 192, 180, 60, 40, 32, 29]) {
    const icon = await page.request.get(`/learnx-icon-${size}.png`);
    expect(icon.ok()).toBe(true);
  }
  const html = await page.request.get('/');
  const source = await html.text();
  expect(source).toContain('/learnx-icon-dark.svg?v=atlas-1');
  expect(source).toContain('/learnx-icon-180.png?v=atlas-1');
  await expect(
    page.getByRole('link', { name: 'Sign in' }).first(),
  ).toHaveAttribute('href', '/login');
});
