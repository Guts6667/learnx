import { expect, test } from '@playwright/test';

test('affiche la page Aujourd’hui et la navigation principale', async ({
  page,
}) => {
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
  await navigation.getByRole('link', { name: 'Programmes' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Programmes' }),
  ).toBeVisible();
});
