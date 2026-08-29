import type { MiddlewareHandler } from 'hono';

import type { PrismaClient } from '../../../../generated/prisma/client';
import type { AuthEnvironment } from '../_lib/auth';
import { learningProgramWhere } from '../_lib/program-access-policy';
import {
  createModuleRunsApp,
  createPrismaModuleRestartRepository,
  createPrismaProgramRestartRepository,
  type ModuleRestartRepository,
  type ProgramRestartRepository,
} from './app';

const userId = '11111111-1111-4111-8111-111111111111';
const moduleId = '22222222-2222-4222-8222-222222222222';
const restartKey = '33333333-3333-4333-8333-333333333333';
const programId = '55555555-5555-4555-8555-555555555555';
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

describe('program restart API', () => {
  const programPreview = {
    firstLesson: { slug: 'premiere-lecon', title: 'Première leçon' },
    programId,
    programTitle: 'Programme test',
    preserved: {
      conceptAttempts: 4,
      exerciseSubmissions: 2,
      notes: 3,
      quizAttempts: 5,
      stageAssessmentSubmissions: 1,
    },
    reset: {
      concepts: 3,
      exercises: 2,
      lessons: 2,
      modules: 1,
      quizzes: 1,
      resources: 4,
      stages: 1,
      tasks: 3,
    },
  };

  it('retourne un aperçu puis transmet une clé idempotente', async () => {
    const result = {
      ...programPreview,
      idempotent: false,
      runIds: ['44444444-4444-4444-8444-444444444444'],
    };
    const programRepository: ProgramRestartRepository = {
      preview: vi.fn().mockResolvedValue(programPreview),
      restart: vi.fn().mockResolvedValue(result),
    };
    const app = createModuleRunsApp({
      authentication: authentication(),
      programRepository,
    });

    const previewResponse = await app.request(
      `/api/programs/${programId}/restart-preview`,
    );
    expect(previewResponse.status).toBe(200);
    await expect(previewResponse.json()).resolves.toEqual({
      preview: programPreview,
    });

    const restartResponse = await app.request(
      `/api/programs/${programId}/restart`,
      {
        body: JSON.stringify({ restartKey }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );
    expect(restartResponse.status).toBe(200);
    await expect(restartResponse.json()).resolves.toEqual({ result });
    expect(programRepository.restart).toHaveBeenCalledWith(
      programId,
      restartKey,
      userId,
    );
  });

  it('réinitialise atomiquement la progression puis rejoue la même reprise sans double mutation', async () => {
    const currentRun = {
      id: '44444444-4444-4444-8444-444444444444',
      moduleId,
      restartKey: null,
      sequence: 1,
      startedAt: new Date('2026-08-04T08:00:00.000Z'),
      userId,
    };
    const restartedRun = {
      ...currentRun,
      id: '66666666-6666-4666-8666-666666666666',
      restartKey,
      sequence: 2,
    };
    const updateLessonProgress = vi.fn().mockResolvedValue({ count: 2 });
    const updateTasks = vi.fn().mockResolvedValue({ count: 3 });
    const updateResources = vi.fn().mockResolvedValue({ count: 4 });
    const updateConcepts = vi.fn().mockResolvedValue({ count: 3 });
    const updateReviews = vi.fn().mockResolvedValue({ count: 1 });
    const stageProgressUpsert = vi.fn().mockResolvedValue({});
    const programProgressUpsert = vi.fn().mockResolvedValue({});
    const viewPreferenceUpsert = vi.fn().mockResolvedValue({});
    const transaction = {
      conceptAssessmentAttempt: { count: vi.fn().mockResolvedValue(4) },
      conceptProgress: {
        count: vi.fn().mockResolvedValue(3),
        updateMany: updateConcepts,
      },
      exerciseSubmission: {
        count: vi.fn().mockResolvedValueOnce(0).mockResolvedValue(2),
      },
      lessonProgress: {
        count: vi.fn().mockResolvedValue(2),
        updateMany: updateLessonProgress,
      },
      moduleRun: {
        create: vi.fn().mockResolvedValue(restartedRun),
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(currentRun)
          .mockResolvedValue(restartedRun),
        findMany: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValue([restartedRun]),
      },
      note: { count: vi.fn().mockResolvedValue(3) },
      program: {
        findFirst: vi.fn().mockResolvedValue({
          id: programId,
          stages: [
            {
              id: 'stage-1',
              modules: [
                {
                  id: moduleId,
                  lessons: [
                    {
                      id: 'lesson-1',
                      slug: 'premiere-lecon',
                      title: 'Première leçon',
                    },
                  ],
                },
              ],
            },
          ],
          title: 'Programme test',
        }),
      },
      programProgress: { upsert: programProgressUpsert },
      programViewPreference: { upsert: viewPreferenceUpsert },
      quizAttempt: {
        count: vi.fn().mockResolvedValue(5),
        findMany: vi.fn().mockResolvedValue([]),
      },
      resourceProgress: {
        count: vi.fn().mockResolvedValue(4),
        updateMany: updateResources,
      },
      reviewItem: { updateMany: updateReviews },
      stageAssessmentSubmission: { count: vi.fn().mockResolvedValue(1) },
      stageProgress: { upsert: stageProgressUpsert },
      taskCompletion: {
        count: vi.fn().mockResolvedValue(3),
        updateMany: updateTasks,
      },
    };
    const client = {
      $transaction: vi.fn(
        async (callback: (value: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    } as unknown as PrismaClient;
    const repository = createPrismaProgramRestartRepository(client);

    const result = await repository.restart(programId, restartKey, userId);
    const replay = await repository.restart(programId, restartKey, userId);

    expect(result).toMatchObject({
      idempotent: false,
      runIds: [restartedRun.id],
    });
    expect(replay).toMatchObject({
      idempotent: true,
      runIds: [restartedRun.id],
    });
    expect(transaction.moduleRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        moduleId,
        restartKey,
        sequence: 2,
        userId,
      }),
    });
    expect(updateLessonProgress).toHaveBeenCalledTimes(1);
    expect(updateTasks).toHaveBeenCalledTimes(1);
    expect(updateResources).toHaveBeenCalledTimes(1);
    expect(updateConcepts).toHaveBeenCalledTimes(1);
    expect(updateReviews).toHaveBeenCalledTimes(1);
    expect(stageProgressUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ percent: 0, status: 'AVAILABLE' }),
      }),
    );
    expect(programProgressUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ percent: 0 }),
      }),
    );
    expect(viewPreferenceUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { expandedStageId: 'stage-1' },
      }),
    );
  });

  it('masque les programmes hors périmètre et valide les entrées', async () => {
    const programRepository: ProgramRestartRepository = {
      preview: vi.fn().mockResolvedValue(null),
      restart: vi.fn(),
    };
    const app = createModuleRunsApp({
      authentication: authentication(),
      programRepository,
    });

    expect(
      (await app.request('/api/programs/invalide/restart-preview')).status,
    ).toBe(400);
    expect(
      (await app.request(`/api/programs/${programId}/restart-preview`)).status,
    ).toBe(404);
    expect(
      (
        await app.request(`/api/programs/${programId}/restart`, {
          body: '{}',
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        })
      ).status,
    ).toBe(400);
  });
});
