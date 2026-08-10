import { expect, type Page, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from './accessibility';

type ContactState = 'default' | 'empty' | 'error' | 'loading';

const contactPage = {
  earlyAdopterApplications: 7,
  items: [
    {
      createdAt: '2026-08-10T09:00:00.000Z',
      emailNormalized: 'very-long-contact-address@example-learning-domain.test',
      id: '00000000-0000-4000-8000-000000000004',
      purposes: [
        {
          confirmedAt: '2026-08-10T10:00:00.000Z',
          createdAt: '2026-08-10T09:00:00.000Z',
          locale: 'fr',
          motivation: null,
          purpose: 'LAUNCH_UPDATES',
          status: 'CONFIRMED',
        },
        {
          confirmedAt: null,
          createdAt: '2026-08-10T09:30:00.000Z',
          locale: 'fr',
          motivation:
            'Je souhaite tester le parcours avec des contenus réalistes et documenter précisément mes retours.',
          purpose: 'EARLY_ADOPTER',
          status: 'PENDING_CONFIRMATION',
        },
      ],
    },
  ],
  launchUpdatesConfirmed: 12,
  limit: 20,
  offset: 0,
  total: 1,
};

async function installContactsApi(page: Page, initialState: ContactState) {
  let state = initialState;
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
            locale: 'fr',
            role: 'ADMIN',
          },
        },
      });
      return;
    }
    if (path === '/api/admin/public-leads') {
      if (state === 'loading') return;
      if (state === 'error') {
        state = 'default';
        await route.fulfill({
          contentType: 'application/json',
          json: { error: { code: 'INTERNAL_ERROR', message: 'Failure.' } },
          status: 500,
        });
        return;
      }
      await route.fulfill({
        contentType: 'application/json',
        json: {
          page:
            state === 'empty'
              ? { ...contactPage, items: [], total: 0 }
              : contactPage,
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

test('contacts Atlas restent complets à 390 px et sur desktop', async ({
  page,
}) => {
  await installContactsApi(page, 'default');

  for (const viewport of [
    { height: 844, width: 390 },
    { height: 1000, width: 1440 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/admin/contacts');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Contacts de la landing' }),
    ).toBeVisible();
    const contacts = page.locator('.admin-collection');
    await expect(contacts.getByText('Lancement', { exact: true })).toBeVisible();
    await expect(
      contacts.getByText('Early adopter', { exact: true }),
    ).toBeVisible();
    await expect(contacts.getByText('Confirmé', { exact: true })).toBeVisible();
    await expect(
      contacts.getByText('À confirmer', { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }

  await page.setViewportSize({ height: 844, width: 390 });
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expectNoSeriousA11yViolations(page);
});

for (const [state, label] of [
  ['empty', 'Aucun contact'],
  ['loading', 'Chargement des contacts…'],
] as const) {
  test(`rend l’état ${state} sans donnée obsolète`, async ({ page }) => {
    await installContactsApi(page, state);
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/admin/contacts');
    const stateMessage =
      state === 'empty'
        ? page.getByRole('heading', { name: label })
        : page.getByText(label, { exact: true });
    await expect(stateMessage).toBeVisible();
    await expect(
      page.getByText(
        'very-long-contact-address@example-learning-domain.test',
      ),
    ).toHaveCount(0);
  });
}

test('rend une erreur explicite et permet le retry', async ({ page }) => {
  await installContactsApi(page, 'error');
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto('/admin/contacts');
  await expect(
    page.getByText(/Aucune donnée n’a été modifiée/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Réessayer' }).click();
  await expect(
    page.getByText('very-long-contact-address@example-learning-domain.test'),
  ).toBeVisible();
});
