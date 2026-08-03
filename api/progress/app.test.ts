import { LessonProgressStatus } from '../../generated/prisma/client';

const ids = {
  lesson: '42e12fb8-4b9d-4b7f-bf48-881539f8cdb8',
  program: '87b72c3a-0b2f-4dda-b82c-5874c91df9c8',
  resource: '97476e0e-2103-40c0-8185-f7601a8d2fd2',
  stage: '7c777cf7-8f6b-421c-88f4-d17c8d530e93',
  task: 'f3c7c0f0-7cc6-49ec-b841-095696d75416',
  user: '5db401f4-5be0-438b-bc36-59d8d50cc301',
};
const startedAt = new Date('2026-08-03T08:00:00.000Z');
const targetEndAt = new Date('2026-08-10T08:00:00.000Z');

const mocks = vi.hoisted(() => {
  const state = {
    snapshot: null as null | {
      canComplete: boolean;
      lessonProgress: {
        completedAt: Date | null;
        percent: number;
        startedAt: Date | null;
        status: 'AVAILABLE' | 'COMPLETED' | 'IN_PROGRESS' | 'LOCKED';
      } | null;
      percent: number;
      resourceStatusById: Map<string, 'COMPLETED'>;
      taskStatusById: Map<string, 'DONE'>;
    },
  };
  const prisma = {
    program: { findFirst: vi.fn() },
    programProgress: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    resource: { findFirst: vi.fn() },
    resourceProgress: { upsert: vi.fn() },
    stage: { findFirst: vi.fn() },
    stageProgress: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    task: { findFirst: vi.fn() },
    taskCompletion: { upsert: vi.fn() },
  };

  return {
    getLessonProgressSnapshot: vi.fn(async () => state.snapshot),
    getProgramTimeline: vi.fn(),
    getStageTimeline: vi.fn(),
    prisma,
    recalculateLessonProgress: vi.fn(async () => state.snapshot),
    runTransaction: vi.fn(async (_client, operation) => operation(prisma)),
    state,
  };
});

vi.mock('../../src/server/api/_lib/auth', () => ({
  requireUser: async (
    context: {
      set(key: string, value: unknown): void;
    },
    next: () => Promise<void>,
  ) => {
    context.set('user', {
      displayName: 'Learner',
      email: 'learner@example.com',
      id: ids.user,
      role: 'USER',
    });
    await next();
  },
}));

vi.mock('../../src/server/prisma', () => ({ prisma: mocks.prisma }));

vi.mock('../../src/server/api/_lib/progress-recalculation', () => ({
  getLessonProgressSnapshot: mocks.getLessonProgressSnapshot,
  recalculateLessonProgress: mocks.recalculateLessonProgress,
  runSerializableProgressTransaction: mocks.runTransaction,
}));

vi.mock('../../src/server/api/_lib/timeline-progress', () => ({
  getProgramTimeline: mocks.getProgramTimeline,
  getStageTimeline: mocks.getStageTimeline,
}));

const { progressApp } = await import('../../src/server/api/progress/app');

function snapshot(canComplete = false) {
  return {
    canComplete,
    lessonProgress: {
      completedAt: null,
      percent: canComplete ? 100 : 40,
      startedAt,
      status: LessonProgressStatus.IN_PROGRESS,
    },
    percent: canComplete ? 100 : 40,
    resourceStatusById: new Map([[ids.resource, 'COMPLETED' as const]]),
    taskStatusById: new Map([[ids.task, 'DONE' as const]]),
  };
}

function jsonRequest(method: 'PATCH' | 'POST', body: unknown) {
  return {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method,
  };
}

function timeline(actualPercent = 25) {
  return {
    actualPercent,
    completedAt: null,
    expectedPercent: 10,
    progressDelta: actualPercent - 10,
    startedAt,
    targetEndAt,
    temporalStatus: 'ahead' as const,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.snapshot = snapshot();
  mocks.prisma.program.findFirst.mockResolvedValue({
    estimatedDurationDays: 7,
    id: ids.program,
  });
  mocks.prisma.programProgress.findUnique.mockResolvedValue(null);
  mocks.prisma.programProgress.findFirst.mockResolvedValue({
    completedAt: null,
    percent: 25,
    startedAt,
    targetEndAt,
  });
  mocks.prisma.programProgress.upsert.mockImplementation(async (input) => ({
    ...input.create,
    ...input.update,
    completedAt: null,
  }));
  mocks.prisma.programProgress.update.mockImplementation(async (input) => ({
    completedAt: null,
    percent: 25,
    startedAt,
    targetEndAt: input.data.targetEndAt,
  }));
  mocks.prisma.stage.findFirst.mockResolvedValue({
    estimatedDurationDays: 7,
    id: ids.stage,
  });
  mocks.prisma.stageProgress.findUnique.mockResolvedValue(null);
  mocks.prisma.stageProgress.findFirst.mockResolvedValue({
    completedAt: null,
    percent: 25,
    startedAt,
    status: 'IN_PROGRESS',
    targetEndAt,
  });
  mocks.prisma.stageProgress.upsert.mockImplementation(async (input) => ({
    ...input.create,
    ...input.update,
    completedAt: null,
  }));
  mocks.prisma.stageProgress.update.mockImplementation(async (input) => ({
    completedAt: null,
    percent: 25,
    startedAt,
    status: 'IN_PROGRESS',
    targetEndAt: input.data.targetEndAt,
  }));
  mocks.getProgramTimeline.mockResolvedValue(timeline());
  mocks.getStageTimeline.mockResolvedValue(timeline());
  mocks.prisma.task.findFirst.mockResolvedValue({
    id: ids.task,
    lessonId: ids.lesson,
  });
  mocks.prisma.resource.findFirst.mockResolvedValue({
    id: ids.resource,
    lessonId: ids.lesson,
  });
  mocks.prisma.taskCompletion.upsert.mockResolvedValue({});
  mocks.prisma.resourceProgress.upsert.mockResolvedValue({});
});

describe('progress API', () => {
  it('lit, démarre et complète une leçon seulement lorsque les gates passent', async () => {
    const url = `http://localhost/api/lessons/${ids.lesson}`;

    expect((await progressApp.request(`${url}/progress`)).status).toBe(200);
    expect(
      (await progressApp.request(`${url}/start`, { method: 'POST' })).status,
    ).toBe(200);
    expect(
      (await progressApp.request(`${url}/complete`, { method: 'POST' })).status,
    ).toBe(409);

    mocks.state.snapshot = snapshot(true);
    const response = await progressApp.request(`${url}/complete`, {
      method: 'POST',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      canComplete: true,
      lessonProgress: { percent: 100 },
    });
  });

  it('retourne 404 pour une leçon absente et 400 pour un identifiant invalide', async () => {
    mocks.state.snapshot = null;

    expect(
      (
        await progressApp.request(
          `http://localhost/api/lessons/${ids.lesson}/progress`,
        )
      ).status,
    ).toBe(404);
    expect(
      (await progressApp.request('http://localhost/api/lessons/no/progress'))
        .status,
    ).toBe(400);
  });

  it('sérialise un suivi encore absent et normalise les erreurs inattendues', async () => {
    mocks.state.snapshot = {
      ...snapshot(),
      lessonProgress: null,
    };
    const response = await progressApp.request(
      `http://localhost/api/lessons/${ids.lesson}/progress`,
    );

    expect(await response.json()).toMatchObject({
      lessonProgress: {
        completedAt: null,
        startedAt: null,
        status: LessonProgressStatus.AVAILABLE,
      },
    });

    mocks.getLessonProgressSnapshot.mockRejectedValueOnce(new Error('boom'));
    expect(
      (
        await progressApp.request(
          `http://localhost/api/lessons/${ids.lesson}/progress`,
        )
      ).status,
    ).toBe(500);
  });

  it('met à jour tâches et ressources puis recalcule atomiquement', async () => {
    const taskResponse = await progressApp.request(
      `http://localhost/api/tasks/${ids.task}`,
      jsonRequest('PATCH', { status: 'DONE' }),
    );
    const resourceResponse = await progressApp.request(
      `http://localhost/api/resources/${ids.resource}/progress`,
      jsonRequest('PATCH', { status: 'COMPLETED' }),
    );

    expect(taskResponse.status).toBe(200);
    expect(resourceResponse.status).toBe(200);
    expect(mocks.prisma.taskCompletion.upsert).toHaveBeenCalledOnce();
    expect(mocks.prisma.resourceProgress.upsert).toHaveBeenCalledOnce();
    expect(mocks.recalculateLessonProgress).toHaveBeenCalledTimes(2);

    await progressApp.request(
      `http://localhost/api/tasks/${ids.task}`,
      jsonRequest('PATCH', { status: 'TODO' }),
    );
    await progressApp.request(
      `http://localhost/api/resources/${ids.resource}/progress`,
      jsonRequest('PATCH', { status: 'STARTED' }),
    );
    expect(mocks.prisma.taskCompletion.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ completedAt: null }),
        update: expect.objectContaining({ completedAt: null }),
      }),
    );
    expect(mocks.prisma.resourceProgress.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ completedAt: null }),
        update: expect.objectContaining({ completedAt: null }),
      }),
    );
  });

  it('refuse les mutations de progression invalides ou hors propriété', async () => {
    const invalidTask = await progressApp.request(
      `http://localhost/api/tasks/${ids.task}`,
      jsonRequest('PATCH', { status: 'UNKNOWN' }),
    );
    const invalidResource = await progressApp.request(
      `http://localhost/api/resources/${ids.resource}/progress`,
      { body: '{', method: 'PATCH' },
    );
    mocks.prisma.task.findFirst.mockResolvedValueOnce(null);
    const missingTask = await progressApp.request(
      `http://localhost/api/tasks/${ids.task}`,
      jsonRequest('PATCH', { status: 'DONE' }),
    );
    mocks.prisma.resource.findFirst.mockResolvedValueOnce(null);
    const missingResource = await progressApp.request(
      `http://localhost/api/resources/${ids.resource}/progress`,
      jsonRequest('PATCH', { status: 'COMPLETED' }),
    );

    expect(invalidTask.status).toBe(400);
    expect(invalidResource.status).toBe(400);
    expect(missingTask.status).toBe(404);
    expect(missingResource.status).toBe(404);
  });

  it('démarre programme et étape de façon idempotente', async () => {
    const programUrl = `http://localhost/api/programs/${ids.program}/start`;
    const stageUrl = `http://localhost/api/stages/${ids.stage}/start`;

    expect(
      (await progressApp.request(programUrl, { method: 'POST' })).status,
    ).toBe(200);
    expect(
      (await progressApp.request(stageUrl, { method: 'POST' })).status,
    ).toBe(200);

    mocks.prisma.programProgress.findUnique.mockResolvedValueOnce({
      completedAt: null,
      startedAt,
      targetEndAt,
    });
    mocks.prisma.stageProgress.findUnique.mockResolvedValueOnce({
      completedAt: null,
      startedAt,
      status: 'COMPLETED',
      targetEndAt,
    });
    mocks.getProgramTimeline.mockResolvedValueOnce(null);
    mocks.getStageTimeline.mockResolvedValueOnce(null);

    expect(
      (await progressApp.request(programUrl, { method: 'POST' })).status,
    ).toBe(200);
    expect(
      (await progressApp.request(stageUrl, { method: 'POST' })).status,
    ).toBe(200);
  });

  it('retourne 404 si le recalcul de démarrage ou complétion perd la leçon', async () => {
    mocks.state.snapshot = null;
    const url = `http://localhost/api/lessons/${ids.lesson}`;

    expect(
      (await progressApp.request(`${url}/start`, { method: 'POST' })).status,
    ).toBe(404);
    expect(
      (await progressApp.request(`${url}/complete`, { method: 'POST' })).status,
    ).toBe(404);
  });

  it('refuse le démarrage d’une hiérarchie inaccessible', async () => {
    mocks.prisma.program.findFirst.mockResolvedValueOnce(null);
    mocks.prisma.stage.findFirst.mockResolvedValueOnce(null);

    expect(
      (
        await progressApp.request(
          `http://localhost/api/programs/${ids.program}/start`,
          { method: 'POST' },
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await progressApp.request(
          `http://localhost/api/stages/${ids.stage}/start`,
          { method: 'POST' },
        )
      ).status,
    ).toBe(404);
  });

  it('replanifie programme et étape avec une cible valide', async () => {
    const body = { targetEndAt: '2026-08-12T08:00:00.000+00:00' };
    const programResponse = await progressApp.request(
      `http://localhost/api/programs/${ids.program}/schedule`,
      jsonRequest('PATCH', body),
    );
    const stageResponse = await progressApp.request(
      `http://localhost/api/stages/${ids.stage}/schedule`,
      jsonRequest('PATCH', body),
    );

    expect(programResponse.status).toBe(200);
    expect(stageResponse.status).toBe(200);

    mocks.getProgramTimeline.mockResolvedValueOnce(null);
    mocks.getStageTimeline.mockResolvedValueOnce(null);
    expect(
      (
        await progressApp.request(
          `http://localhost/api/programs/${ids.program}/schedule`,
          jsonRequest('PATCH', body),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await progressApp.request(
          `http://localhost/api/stages/${ids.stage}/schedule`,
          jsonRequest('PATCH', body),
        )
      ).status,
    ).toBe(200);
  });

  it('refuse une replanification invalide, absente, non démarrée ou antérieure', async () => {
    const programUrl = `http://localhost/api/programs/${ids.program}/schedule`;
    const stageUrl = `http://localhost/api/stages/${ids.stage}/schedule`;

    expect(
      (await progressApp.request(programUrl, jsonRequest('PATCH', {}))).status,
    ).toBe(400);
    expect(
      (await progressApp.request(stageUrl, { body: '{', method: 'PATCH' }))
        .status,
    ).toBe(400);
    expect(
      (await progressApp.request(stageUrl, jsonRequest('PATCH', {}))).status,
    ).toBe(400);

    mocks.prisma.programProgress.findFirst.mockResolvedValueOnce(null);
    mocks.prisma.stageProgress.findFirst.mockResolvedValueOnce(null);
    expect(
      (
        await progressApp.request(
          programUrl,
          jsonRequest('PATCH', {
            targetEndAt: '2026-08-12T08:00:00.000+00:00',
          }),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await progressApp.request(
          stageUrl,
          jsonRequest('PATCH', {
            targetEndAt: '2026-08-12T08:00:00.000+00:00',
          }),
        )
      ).status,
    ).toBe(404);

    mocks.prisma.programProgress.findFirst.mockResolvedValueOnce({
      startedAt: null,
    });
    mocks.prisma.stageProgress.findFirst.mockResolvedValueOnce({
      startedAt: null,
    });
    expect(
      (
        await progressApp.request(
          programUrl,
          jsonRequest('PATCH', {
            targetEndAt: '2026-08-12T08:00:00.000+00:00',
          }),
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await progressApp.request(
          stageUrl,
          jsonRequest('PATCH', {
            targetEndAt: '2026-08-12T08:00:00.000+00:00',
          }),
        )
      ).status,
    ).toBe(409);

    expect(
      (
        await progressApp.request(
          programUrl,
          jsonRequest('PATCH', {
            targetEndAt: '2026-08-02T08:00:00.000+00:00',
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await progressApp.request(
          stageUrl,
          jsonRequest('PATCH', {
            targetEndAt: '2026-08-02T08:00:00.000+00:00',
          }),
        )
      ).status,
    ).toBe(400);
  });
});
