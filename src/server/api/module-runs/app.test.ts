import type { MiddlewareHandler } from 'hono';

import type { PrismaClient } from '../../../../generated/prisma/client';
import type { AuthEnvironment } from '../_lib/auth';
import { learningProgramWhere } from '../_lib/program-access-policy';
import {
  createModuleRunsApp,
  createPrismaModuleRestartRepository,
  type ModuleRestartRepository,
} from './app';

const userId = '11111111-1111-4111-8111-111111111111';
const moduleId = '22222222-2222-4222-8222-222222222222';
const restartKey = '33333333-3333-4333-8333-333333333333';
const preview = {
  currentRunSequence: 1,
  firstLesson: { slug: 'premiere-lecon', title: 'Première leçon' },
  moduleId,
  moduleTitle: 'Module test',
  preserved: {
    conceptAttempts: 4,
    exerciseSubmissions: 2,
    notes: 3,
    quizAttempts: 5,
  },
  reset: {
    concepts: 3,
    exercises: 2,
    lessons: 2,
    quizzes: 1,
    resources: 4,
    tasks: 3,
  },
};

function authentication(): MiddlewareHandler<AuthEnvironment> {
  return async (context, next) => {
    context.set('user', {
      displayName: 'Propriétaire',
      email: 'owner@example.com',
      id: userId,
      role: 'USER',
    });
    await next();
  };
}

describe('module restart API', () => {
  it('retourne un aperçu détaillé au propriétaire', async () => {
    const repository: ModuleRestartRepository = {
      preview: vi.fn().mockResolvedValue(preview),
      restart: vi.fn(),
    };
    const app = createModuleRunsApp({
      authentication: authentication(),
      repository,
    });
    const response = await app.request(
      `/api/modules/${moduleId}/restart-preview`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ preview });
    expect(repository.preview).toHaveBeenCalledWith(moduleId, userId);
  });

  it('borne la lecture au propriétaire et à une hiérarchie publiée', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = createPrismaModuleRestartRepository({
      module: { findFirst },
    } as unknown as PrismaClient);

    await expect(repository.preview(moduleId, userId)).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: moduleId,
          isPublished: true,
          stage: expect.objectContaining({
            program: learningProgramWhere(userId),
          }),
        }),
      }),
    );
  });

  it('retourne la reprise existante lorsque la même clé est rejouée', async () => {
    const existingRun = {
      id: '44444444-4444-4444-8444-444444444444',
      moduleId,
      restartKey,
      sequence: 2,
      startedAt: new Date('2026-08-04T08:00:00.000Z'),
      userId,
    };
    const transaction = {
      conceptAssessmentAttempt: { count: vi.fn().mockResolvedValue(4) },
      conceptProgress: { count: vi.fn().mockResolvedValue(3) },
      exerciseSubmission: { count: vi.fn().mockResolvedValue(2) },
      lessonProgress: { count: vi.fn().mockResolvedValue(2) },
      module: {
        findFirst: vi.fn().mockResolvedValue({
          id: moduleId,
          lessons: [
            { id: 'lesson-1', slug: 'premiere-lecon', title: 'Première leçon' },
          ],
          stage: { id: 'stage-1', programId: 'program-1' },
          title: 'Module test',
        }),
      },
      moduleRun: {
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(existingRun),
      },
      note: { count: vi.fn().mockResolvedValue(3) },
      quizAttempt: {
        count: vi.fn().mockResolvedValue(5),
        findMany: vi.fn().mockResolvedValue([{ quizId: 'quiz-1' }]),
      },
      resourceProgress: { count: vi.fn().mockResolvedValue(4) },
      taskCompletion: { count: vi.fn().mockResolvedValue(3) },
    };
    const client = {
      $transaction: vi.fn(
        async (callback: (value: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    } as unknown as PrismaClient;

    const result = await createPrismaModuleRestartRepository(client).restart(
      moduleId,
      restartKey,
      userId,
    );

    expect(result).toMatchObject({ idempotent: true, runId: existingRun.id });
    expect(transaction.moduleRun.create).not.toHaveBeenCalled();
  });

  it('transmet une clé idempotente pour créer la nouvelle reprise', async () => {
    const result = {
      ...preview,
      currentRunSequence: 2,
      idempotent: false,
      runId: restartKey,
    };
    const repository: ModuleRestartRepository = {
      preview: vi.fn(),
      restart: vi.fn().mockResolvedValue(result),
    };
    const app = createModuleRunsApp({
      authentication: authentication(),
      repository,
    });
    const response = await app.request(`/api/modules/${moduleId}/restart`, {
      body: JSON.stringify({ restartKey }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ result });
    expect(repository.restart).toHaveBeenCalledWith(
      moduleId,
      restartKey,
      userId,
    );
  });

  it('normalise les identifiants invalides et les modules hors périmètre', async () => {
    const repository: ModuleRestartRepository = {
      preview: vi.fn().mockResolvedValue(null),
      restart: vi.fn(),
    };
    const app = createModuleRunsApp({
      authentication: authentication(),
      repository,
    });

    expect(
      (await app.request('/api/modules/invalide/restart-preview')).status,
    ).toBe(400);
    expect(
      (await app.request(`/api/modules/${moduleId}/restart-preview`)).status,
    ).toBe(404);
  });
});
