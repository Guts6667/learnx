import { expect, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from './accessibility';
import { installPublicCatalogue } from './journey-api';

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
  /**
   * La page publique ne doit dépendre d'aucune route qui demande une session.
   * C'est la propriété que V4.5-186 a rendue coûteuse : la landing appelait une
   * route devenue privée et répondait 401 en production sans qu'un test bronche.
   *
   * La section tarifs (V4.5-206) ajoute une lecture, et une seule : le
   * catalogue public, sans cookie, sous un préfixe qui dit qu'il est public.
   * Elle est donc exclue nommément — l'exemption est étroite et visible —
   * pendant que toute autre requête `/api/` reste interdite.
   */
  const sessionRequests: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (!url.includes('/api/')) return;
    if (url.includes('/api/public/credit-packs')) return;
    sessionRequests.push(url);
  });
  await installPublicCatalogue(page);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Votre chemin vers la connaissance.',
      }),
    ).toBeVisible();
    if (viewport.width < 768) {
      await expect(page.locator('.landing-utility')).toBeHidden();
      await expect(page.locator('.landing-mobile-navigation')).toBeVisible();
    } else {
      await expect(page.locator('.landing-utility')).toBeVisible();
      await expect(page.locator('.landing-mobile-navigation')).toBeHidden();
    }
    await expect(
      page
        .getByRole('heading', { name: 'Piloter un projet en équipe' })
        .first(),
    ).toBeVisible();
    await expect(
      page
        .getByRole('heading', { name: 'Formuler un objectif de sprint' })
        .first(),
    ).toBeVisible();
    await expect(page.getByText(/The Scrum Guide 2020/)).toBeVisible();
    if (viewport.width >= 768) {
      // A link colour rule once outranked the button primitive and rendered the
      // persistent CTA as indigo on indigo. Axe did not flag it.
      const cta = page.locator('.landing-utility a[href="#early-adopter"]');
      await expect(cta).toBeVisible();
      expect(
        await cta.evaluate((element) => {
          const style = getComputedStyle(element);
          return style.color === style.backgroundColor;
        }),
      ).toBe(false);
    }
    if (viewport.width >= 1024) {
      expect(
        await page.evaluate(() => {
          const heading = document.querySelector('.landing-hero h1');
          const preview = document.querySelector(
            '.landing-hero .landing-product-preview',
          );
          if (!heading || !preview) return false;
          const headingText = document.createRange();
          headingText.selectNodeContents(heading);
          return (
            headingText.getBoundingClientRect().right <=
            preview.getBoundingClientRect().left
          );
        }),
      ).toBe(true);
    }
    if (viewport.width === 1440) {
      const previewGeometry = await page.evaluate(() => {
        const copy = document.querySelector('.landing-hero-copy');
        const preview = document.querySelector('.landing-program-preview');
        if (!copy || !preview) return null;
        const copyBox = copy.getBoundingClientRect();
        const previewBox = preview.getBoundingClientRect();
        return {
          copyWidth: copyBox.width,
          previewWidth: previewBox.width,
        };
      });
      expect(previewGeometry).not.toBeNull();
      expect(previewGeometry?.copyWidth).toBeGreaterThan(500);
      expect(previewGeometry?.previewWidth).toBeGreaterThan(500);
    }
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
  await page.locator('.landing-mobile-navigation summary').click();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Your path to knowledge.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Leading a team project' }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Write a sprint goal' }).first(),
  ).toBeVisible();
  await expect(
    page.getByText(/A sprint goal describes the outcome/),
  ).toBeVisible();
  await expect(page.getByText(/Fondamentaux|psychologie/i)).toHaveCount(0);
  await expectNoSeriousA11yViolations(page);
  expect(sessionRequests).toEqual([]);

  const manifest = await page.request.get('/manifest-en.webmanifest');
  expect(manifest.ok()).toBe(true);
  expect((await manifest.json()).start_url).toBe('/today');
  for (const iconPath of [
    '/apple-touch-icon.png',
    '/pwa-192x192.png',
    '/pwa-512x512.png',
    '/pwa-maskable-512x512.png',
  ]) {
    const icon = await page.request.get(iconPath);
    expect(icon.ok()).toBe(true);
  }
  const html = await page.request.get('/');
  const source = await html.text();
  expect(source).toContain('/learnx-icon.svg?v=brand-1');
  expect(source).toContain('/apple-touch-icon.png?v=brand-1');
  await expect(
    page.getByRole('link', { name: 'Sign in' }).first(),
  ).toHaveAttribute('href', '/login');
});

/**
 * La section tarifs (V4.5-206), dans ses trois états.
 *
 * Un palier est inactif jusqu'à une décision du propriétaire (V4.5-161,
 * V4.5-164) : un catalogue actif vide est la façon dont le produit dit qu'il
 * n'a pas encore de prix. Ce que ce test protège est la frontière entre cela
 * et « nous n'avons pas su lire la liste » — les confondre ferait annoncer
 * « bientôt » le jour où les prix existent.
 */
test('publie les paliers du catalogue, dit « bientôt » quand il est vide et l’avoue quand il est illisible', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'La matrice déterministe est exécutée une fois.',
  );

  await installPublicCatalogue(page);
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Des crédits, à l’usage' }),
  ).toBeVisible();
  await expect(
    page.getByText(/Les paliers ne sont pas encore ouverts/u),
  ).toBeVisible();
  await expect(page.locator('.landing-pricing-tiers')).toHaveCount(0);
  await expect(
    page.locator('.landing-pricing a[href="#early-adopter"]'),
  ).toBeVisible();

  await installPublicCatalogue(page, [
    {
      credits: '100',
      currency: 'EUR',
      key: 'starter',
      label: 'Découverte',
      priceMinor: '1500',
    },
  ]);
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Découverte' })).toBeVisible();
  await expect(page.getByText('100 crédits')).toBeVisible();
  await expect(page.locator('.landing-pricing-amount')).toHaveText(/15,00/u);
  await expect(
    page.getByText(/Les paliers ne sont pas encore ouverts/u),
  ).toBeHidden();

  await page.route('**/api/public/credit-packs', (route) => route.abort());
  await page.reload();

  await expect(page.getByText(/n’ont pas pu être chargés/u)).toBeVisible();
  await expect(
    page.getByText(/Les paliers ne sont pas encore ouverts/u),
  ).toBeHidden();
});
