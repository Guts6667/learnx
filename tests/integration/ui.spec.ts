import { expect, test } from '@playwright/test';

import {
  cleanupIntegrationUsers,
  createIntegrationFixture,
} from './fixture.js';

const password = 'Integration-Only-Password-2026!';

test('connexion et consultation d’une leçon via les vraies Functions', async ({
  page,
  request,
}, testInfo) => {
  const runId = process.env.LEARNX_INTEGRATION_RUN_ID ?? 'missing-run';
  const project = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-');
  const email = `ui-${runId}-${project}@example.test`.toLowerCase();

  try {
    const registration = await request.post('/api/auth/register', {
      data: {
        displayName: `UI ${project}`,
        email,
        password,
      },
    });
    if (registration.status() !== 201) {
      throw new Error(
        `Registration returned HTTP ${registration.status()}: ${await registration.text()}`,
      );
    }

    expect(registration.status()).toBe(201);
    await request.post('/api/auth/logout');

    const fixture = await createIntegrationFixture(
      email,
      `${runId}-${project}-ui`,
    );

    await page.goto('/login');
    await page.getByLabel('Adresse e-mail').fill(email);
    await page.getByLabel('Mot de passe').fill(password);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/today$/);

    await page.goto(`/program/${fixture.programSlug}`);
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: new RegExp(`Programme intégration`),
      }),
    ).toBeVisible();

    await page.goto(
      `/program/${fixture.programSlug}/lesson/${fixture.lessonSlug}`,
    );
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Leçon intégration réelle',
      }),
    ).toBeVisible();
    await expect(page.getByText('Contenu pédagogique réel')).toBeVisible();
    await expect(page.getByText('Mini-évaluation intégration')).toBeVisible();
    await expect(page.getByText('Exercice intégration')).toBeVisible();
  } finally {
    await cleanupIntegrationUsers([email]);
  }
});
