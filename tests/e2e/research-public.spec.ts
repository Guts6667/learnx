import { expect, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from './accessibility';

const viewports = [
  { height: 720, width: 320 },
  { height: 844, width: 390 },
  { height: 900, width: 720 },
  { height: 1000, width: 1440 },
  { height: 1080, width: 1920 },
] as const;

async function expectNoHorizontalOverflow(
  page: import('@playwright/test').Page,
) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test('journal de recherche chronologique et responsive', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'La matrice multi-largeurs est exécutée une seule fois.',
  );

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/research/ai-correction/index.html');
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Programme de recherche sur la correction formative assistée',
      }),
    ).toBeVisible();

    const publications = page.locator('.timeline .article-card');
    await expect(publications).toHaveCount(7);
    await expect(publications.first()).toContainText('24 août 2026');
    await expect(publications.first()).toContainText(
      'Évaluation Writing sous protocole scellé',
    );
    await expect(publications.first()).toContainText('Résultat · Décision');
    await expect(publications.first()).toContainText('v1.0');
    await expect(publications.last()).toContainText('Dossier technique continu');
    await expectNoHorizontalOverflow(page);

    await testInfo.attach(
      `research-index-${viewport.width}x${viewport.height}`,
      {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      },
    );
  }

  await page.setViewportSize({ height: 900, width: 720 });
  await page.goto('/research/ai-correction/index.html');
  await page.keyboard.press('Tab');
  await expect(page.locator('.public-skip-link')).toBeFocused();
  expect(
    await page.locator('.public-skip-link').evaluate((element) => {
      const style = getComputedStyle(element);
      return Number.parseFloat(style.outlineWidth);
    }),
  ).toBeGreaterThanOrEqual(3);
  await page.getByRole('button', { name: 'Résultat', exact: true }).click();
  await expect(page.locator('.article-card:visible')).toHaveCount(3);
  await page.getByRole('button', { name: 'Erratum', exact: true }).click();
  await expect(page.locator('.article-card:visible')).toHaveCount(0);
  await expect(page.getByText(/Aucune publication/)).toBeVisible();
  await page.getByRole('button', { name: 'Effacer le filtre' }).click();
  await expect(page.locator('.article-card:visible')).toHaveCount(7);
  await expectNoSeriousA11yViolations(page);

  await page.addStyleTag({
    content: ':root { font-size: 200% !important; }',
  });
  await expectNoHorizontalOverflow(page);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Programme de recherche sur la correction formative assistée',
    }),
  ).toBeVisible();
});

test('article de recherche garde ses métadonnées, son sommaire et son partage', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'La matrice multi-largeurs est exécutée une seule fois.',
  );

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto(
      '/research/ai-correction/articles/writing-exam-bounded-pilot.html',
    );
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: /Évaluation Writing sous protocole scellé/,
      }),
    ).toBeVisible();
    await expect(page.getByText('Writing · fr-FR')).toBeVisible();
    await expect(page.getByText('Sonnet 4.6 · Anthropic')).toBeVisible();
    await expect(page.getByText('Version 1.0')).toBeVisible();
    await expect(page.getByText('Recherche expérimentale')).toBeVisible();
    await expect(
      page.getByText('Verdict expérimental', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Arbitrage de déploiement borné' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Partager cette recherche' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Changelog et errata' }),
    ).toBeVisible();
    await expect(page.getByText('Version actuelle · v1.0')).toBeVisible();

    if (viewport.width >= 980) {
      await expect(page.locator('.article-toc--desktop')).toBeVisible();
      await expect(page.locator('.article-toc--mobile')).toBeHidden();
    } else {
      await expect(page.locator('.article-toc--desktop')).toBeHidden();
      await expect(page.locator('.article-toc--mobile')).toBeVisible();
    }
    await expectNoHorizontalOverflow(page);

    await testInfo.attach(
      `research-article-${viewport.width}x${viewport.height}`,
      {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      },
    );
  }

  await page.setViewportSize({ height: 900, width: 720 });
  await page.goto(
    '/research/ai-correction/articles/writing-exam-bounded-pilot.html',
  );
  await page.addStyleTag({
    content: ':root { font-size: 200% !important; }',
  });
  await expectNoHorizontalOverflow(page);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /Évaluation Writing sous protocole scellé/,
    }),
  ).toBeVisible();
  await expectNoSeriousA11yViolations(page);
});

test('journal et article restent lisibles sous WebKit mobile', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile-webkit',
    'Ce contrôle cible explicitement WebKit mobile.',
  );

  await page.goto('/research/ai-correction/index.html');
  await expect(page.locator('.timeline .article-card')).toHaveCount(7);
  await expectNoHorizontalOverflow(page);

  await page.goto(
    '/research/ai-correction/articles/writing-exam-bounded-pilot.html',
  );
  await expect(page.locator('.article-toc--mobile')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Partager cette recherche' }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
