import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type APIResponse,
} from '@playwright/test';

import { prisma } from '../../src/server/prisma.js';
import { createPrismaExerciseRepository } from '../../src/server/api/exercises/repository.js';
import {
  cleanupIntegrationUsers,
  createIntegrationFixture,
} from './fixture.js';

const password = 'Integration-Only-Password-2026!';

function uniqueEmail(retry: number): string {
  const runId = process.env.LEARNX_INTEGRATION_RUN_ID ?? 'missing-run';
  const safeRunId = runId.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return `exercise-repository-${safeRunId}-retry-${retry}@example.test`;
}

async function expectStatus(
  response: APIResponse,
  status: number,
): Promise<void> {
  if (response.status() !== status) {
    throw new Error(
      `Expected HTTP ${status}, received ${response.status()}: ${await response.text()}`,
    );
  }
}

async function register(
  context: APIRequestContext,
  email: string,
): Promise<void> {
  await expectStatus(
    await context.post('/api/auth/register', {
      data: { displayName: 'Compte exercices', email, password },
    }),
    201,
  );
}

test('unicité concurrente et rollback de soumission sur PostgreSQL', async ({
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop');
  test.setTimeout(240_000);
  expect(baseURL).toBeTruthy();

  const email = uniqueEmail(testInfo.retry);
  const request = await playwrightRequest.newContext({
    baseURL,
    timeout: 30_000,
  });

  try {
    await register(request, email);
    const fixture = await createIntegrationFixture(
      email,
      `${process.env.LEARNX_INTEGRATION_RUN_ID}-exercise-repository-retry-${testInfo.retry}`,
    );
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const repository = createPrismaExerciseRepository(prisma);

    const [firstSubmission, secondSubmission] = await Promise.all([
      repository.createOrGetSubmission(fixture.exerciseId, user.id),
      repository.createOrGetSubmission(fixture.exerciseId, user.id),
    ]);

    expect(secondSubmission.id).toBe(firstSubmission.id);
    const persistedSubmissions = await prisma.exerciseSubmission.findMany({
      where: {
        exerciseId: fixture.exerciseId,
        moduleRunId: firstSubmission.moduleRunId,
        userId: user.id,
      },
    });
    expect(persistedSubmissions).toHaveLength(1);

    const contentMarkdown = 'Réponse persistée avant soumission.';
    await repository.saveSubmission(
      firstSubmission.id,
      contentMarkdown,
      user.id,
    );
    const failingRepository = createPrismaExerciseRepository(
      prisma,
      async () => {
        throw new Error('FORCED_RECALCULATION_FAILURE');
      },
    );

    await expect(
      failingRepository.submitSubmission(
        firstSubmission.id,
        new Date('2026-08-28T12:00:00.000Z'),
        user.id,
      ),
    ).rejects.toThrow('FORCED_RECALCULATION_FAILURE');

    const rolledBackSubmission =
      await prisma.exerciseSubmission.findUniqueOrThrow({
        where: { id: firstSubmission.id },
      });
    expect(rolledBackSubmission).toMatchObject({
      contentMarkdown,
      status: 'DRAFT',
      submittedAt: null,
    });
  } finally {
    await cleanupIntegrationUsers([email]);
    await request.dispose();
  }
});
