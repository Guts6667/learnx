import { expect, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from './accessibility';

const viewports = [
  { height: 720, width: 320 },
  { height: 844, width: 390 },
  { height: 900, width: 720 },
  { height: 1000, width: 1440 },
] as const;

test('la landing ouvre le journal statique sans passer par la 404 applicative', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'La navigation document est vérifiée une fois.',
  );

  await page.goto('/');
  await page
    .getByRole('link', { name: 'Explorer le journal de recherche' })
    .click();
  await expect(page).toHaveURL(/\/research\/ai-correction\/index\.html$/);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Programme de recherche sur la correction formative assistée',
    }),
  ).toBeVisible();

  await page.goto('/');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page
    .getByRole('link', { name: 'Explore the research journal' })
    .click();
  await expect(page).toHaveURL(/\/research\/ai-correction\/en\.html$/);
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Research programme on AI-assisted formative feedback',
    }),
  ).toBeVisible();
});

test('journal de recherche chronologique, bilingue et responsive', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'La matrice déterministe est exécutée une fois.',
  );

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/research/index.html');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Recherche' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Lire le dernier article' }),
    ).toHaveAttribute(
      'href',
      '/research/ai-correction/evidence-assist-gate-4/',
    );
    await expect(page.locator('article.publication')).toHaveCount(7);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }

  await page.getByRole('button', { name: 'Protocoles' }).click();
  await expect(page.locator('article.publication:visible')).toHaveCount(2);

  await page.getByRole('button', { name: 'Errata' }).click();
  await expect(page.locator('article.publication:visible')).toHaveCount(0);
  await expect(page.getByText(/Aucune publication/)).toBeVisible();
  await page.getByRole('button', { name: 'Effacer le filtre' }).click();
  await expect(page.locator('article.publication:visible')).toHaveCount(7);
  await expectNoSeriousA11yViolations(page);
});

test('article autonome partageable avec navigation de série', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'La matrice déterministe est exécutée une fois.',
  );

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto(
      '/research/ai-correction/evidence-assist-gate-4/index.html',
    );

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Gate 4 : quand un échec révèle une limite de l’oracle.',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Partager l’article' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Article précédent/ }),
    ).toHaveAttribute('href', '/research/ai-correction/chercheur-de-preuves/');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }

  await expectNoSeriousA11yViolations(page);

  await page.goto('/research/ai-correction/evidence-assist-gate-4/en.html');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Gate 4: when a failure reveals an oracle limitation.',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Share article' }),
  ).toBeVisible();
});
