import { expect, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from './accessibility';

const viewports = [
  { height: 720, width: 320 },
  { height: 844, width: 390 },
  { height: 900, width: 720 },
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

test('le catalogue Totem couvre états, reflow, focus et reduced motion', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'La matrice Totem déterministe est exécutée une fois.',
  );

  const totemViewports = [
    { height: 720, width: 320 },
    { height: 844, width: 390 },
    { height: 900, width: 720 },
    { height: 1000, width: 1440 },
    { height: 1080, width: 1920 },
  ] as const;

  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const viewport of totemViewports) {
    await page.setViewportSize(viewport);
    await page.goto('/design/totem-primitives');
    await expect(
      page.getByRole('heading', { name: 'Primitives et états Totem' }),
    ).toBeVisible();
    await expect(page.locator('[data-visual-system="totem"]')).toBeVisible();
    await expect(
      page.getByRole('status', { name: 'Action enregistrée' }),
    ).toBeVisible();
    await expect(
      page.getByRole('alert', { name: 'Échec de l’action' }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await testInfo.attach(
      `totem-primitives-${viewport.width}x${viewport.height}`,
      {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      },
    );
  }

  await page.setViewportSize({ height: 900, width: 720 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.keyboard.press('Tab');
  await expect(page.locator(':focus-visible')).toBeVisible();
  await expectNoSeriousA11yViolations(page, '[data-visual-system="totem"]');
});

test('le shell admin Totem reste lisible aux largeurs de référence', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'La matrice admin Totem déterministe est exécutée une fois.',
  );

  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const viewport of [
    { height: 720, width: 320 },
    { height: 844, width: 390 },
    { height: 900, width: 720 },
    { height: 1000, width: 1440 },
    { height: 1080, width: 1920 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/design/totem-admin');
    await expect(
      page.getByRole('heading', { name: 'Comptes utilisateurs' }),
    ).toBeVisible();
    await expect(page.locator('[data-visual-system="totem"]')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }

  await page.setViewportSize({ height: 900, width: 720 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus-visible')).toBeVisible();
  await expectNoSeriousA11yViolations(page, '[data-visual-system="totem"]');
});

test('la surface produit Totem reste lisible aux largeurs de référence', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'La matrice produit Totem déterministe est exécutée une fois.',
  );

  for (const viewport of [
    { height: 720, width: 320 },
    { height: 844, width: 390 },
    { height: 900, width: 720 },
    { height: 1000, width: 1440 },
    { height: 1080, width: 1920 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/design/totem-product');
    await expect(
      page.getByRole('heading', { name: 'Une prochaine action claire' }),
    ).toBeVisible();
    await expect(page.locator('[data-visual-system="totem"]')).toBeVisible();
    const resumeCard = page.locator(
      '[data-totem-component="primary-resume"]',
    );
    await expect(resumeCard).toHaveClass(/ui-card--signature/);
    await expect(resumeCard).not.toHaveClass(/ui-card--accent/);

    const resumeBox = await resumeCard.boundingBox();
    const railBox = await page.locator('.totem-product-rail').boundingBox();
    if (!resumeBox || !railBox) {
      throw new Error('La composition produit Totem est incomplète.');
    }
    if (viewport.width >= 1024) {
      expect(railBox.x).toBeGreaterThan(resumeBox.x + resumeBox.width);
      expect(railBox.width).toBeLessThanOrEqual(360);
    } else {
      expect(railBox.y).toBeGreaterThan(resumeBox.y + resumeBox.height);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }

  await page.setViewportSize({ height: 900, width: 720 });
  await page.goto('/design/totem-product');
  const visualContract = await page
    .locator('[data-totem-component="primary-resume"]')
    .evaluate((element) => {
      const card = getComputedStyle(element);
      const signature = getComputedStyle(element, '::after');
      const actionElement = element.querySelector(
        '.totem-resume-card__action',
      );
      if (!(actionElement instanceof HTMLElement)) {
        throw new Error('Totem primary resume action is missing.');
      }
      const action = getComputedStyle(actionElement);

      return {
        actionBackground: action.backgroundColor,
        background: card.backgroundColor,
        border: card.borderColor,
        signatureBackground: signature.backgroundColor,
      };
    });
  expect(visualContract).toEqual({
    actionBackground: 'rgb(59, 91, 214)',
    background: 'rgb(255, 255, 255)',
    border: 'rgb(214, 222, 235)',
    signatureBackground: 'rgb(204, 107, 87)',
  });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expectNoSeriousA11yViolations(page, '[data-visual-system="totem"]');
});
