import { expect, test } from '@playwright/test';

test('affiche la page Aujourd’hui et ouvre les révisions', async ({
  page,
}) => {
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({
      contentType: 'application/json',
      json: {
        user: {
          displayName: 'Learner',
          email: 'learner@example.com',
          id: 'user-1',
          role: 'USER',
        },
      },
    }),
  );
  await page.route('**/api/today?*', (route) =>
    route.fulfill({
      contentType: 'application/json',
      json: {
        action: null,
        lastActivity: null,
        program: null,
        reviewsDue: 0,
      },
    }),
  );
  await page.route('**/api/reviews', (route) =>
    route.fulfill({
      contentType: 'application/json',
      json: { reviews: [] },
    }),
  );
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Aujourd’hui',
    }),
  ).toBeVisible();
  const navigation = page.getByRole('navigation', {
    name: 'Navigation principale',
  });

  await expect(navigation).toBeVisible();
  await navigation.getByRole('link', { name: 'Révisions' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Révisions' }),
  ).toBeVisible();
  await expect(page.getByText('Aucune révision en attente')).toBeVisible();
});
