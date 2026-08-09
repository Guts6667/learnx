import { expect, test } from '@playwright/test';

import {
  cleanupIntegrationUsers,
  createIntegrationFixture,
} from './fixture.js';
import { expectNoSeriousA11yViolations } from '../e2e/accessibility.js';

const password = 'Integration-Only-Password-2026!';

test('connexion et consultation d’une leçon via les vraies Functions', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(60_000);
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
    await page.getByLabel(/Adresse e-mail|Email address/).fill(email);
    await page.getByLabel(/Mot de passe|Password/).fill(password);
    await page.getByRole('button', { name: /Se connecter|Sign in/ }).click();
    await expect(page).toHaveURL(/\/today$/);

    await page.goto(`/program/${fixture.programSlug}`);
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: new RegExp(`Programme intégration`),
      }),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await page.goto(
      `/program/${fixture.programSlug}/lesson/${fixture.lessonSlug}`,
    );
    const lessonResponse = await page.request.get(
      `/api/lessons/${fixture.lessonSlug}`,
    );
    expect(lessonResponse.status()).toBe(200);
    const progressResponse = await page.request.get(
      `/api/lessons/${fixture.lessonId}/progress`,
    );
    expect(progressResponse.status()).toBe(200);
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Leçon intégration réelle',
      }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Contenu pédagogique réel')).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: 'Sommaire' }).click();
    const summary = page.getByRole('dialog', {
      name: 'Sommaire de la leçon',
    });
    await expect(summary).toBeVisible();
    await expect(
      summary.getByText('Mini-évaluation intégration'),
    ).toBeVisible();
    await expect(summary.getByText('Exercice intégration')).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    const logout = await page.request.post('/api/auth/logout');
    expect(logout.status()).toBe(204);
    await page.goto(
      `/program/${fixture.programSlug}/lesson/${fixture.lessonSlug}`,
    );
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole('heading', { level: 1, name: /Connexion|Sign in/ }),
    ).toBeVisible();
  } finally {
    await cleanupIntegrationUsers([email]);
  }
});
