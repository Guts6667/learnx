import type { MiddlewareHandler } from 'hono';

import type { AuthEnvironment } from '../_lib/auth';
import { createTodayApp, type TodayRepository } from './app';

const userId = '7c777cf7-8f6b-421c-88f4-d17c8d530e93';
const now = new Date('2026-08-03T08:00:00.000Z');

const authentication: MiddlewareHandler<AuthEnvironment> = async (
  context,
  next,
) => {
  context.set('user', {
    displayName: 'Learner',
    email: 'learner@example.com',
    id: userId,
    role: 'USER',
  });
  await next();
};

function createRepository(input?: {
  includeReview?: boolean;
  includeTask?: boolean;
}): TodayRepository {
  const includeReview = input?.includeReview ?? true;
  const includeTask = input?.includeTask ?? true;

  return {
    async listActivePrograms(requestedUserId) {
      return requestedUserId === userId
        ? [
            {
              id: 'program-1',
              position: 1,
              progress: [{ lastViewedAt: now, percent: 42 }],
              slug: 'psychologie',
              title: 'Psychologie',
            },
          ]
        : [];
    },
    async listFinalAssessments() {
      return [];
    },
    async listLessons() {
      return [
        {
          concepts: [],
          estimatedMinutes: 20,
          id: 'lesson-1',
          module: {
            position: 1,
            slug: 'introduction',
            stage: {
              id: 'stage-1',
              position: 1,
              program: {
                id: 'program-1',
                position: 1,
                slug: 'psychologie',
                title: 'Psychologie',
              },
              progress: [{ status: 'IN_PROGRESS' }],
              slug: 'fondations',
              title: 'Fondations',
            },
            title: 'Introduction',
          },
          position: 1,
          progress: [{ lastViewedAt: now, status: 'IN_PROGRESS' }],
          slug: 'definition',
          tasks: includeTask
            ? [{ completions: [], id: 'task-1', title: 'Lire le chapitre' }]
            : [],
          title: 'Définir la psychologie',
        },
      ];
    },
    async listPendingReviews() {
      return includeReview
        ? [
            {
              dueAt: new Date('2026-08-02T08:00:00.000Z'),
              id: 'review-1',
              lesson: {
                estimatedMinutes: 10,
                module: {
                  stage: { title: 'Fondations' },
                  title: 'Introduction',
                },
                slug: 'definition',
                title: 'Définir la psychologie',
              },
              program: {
                id: 'program-1',
                slug: 'psychologie',
                title: 'Psychologie',
              },
            },
          ]
        : [];
    },
  };
}

describe('today API', () => {
  it('sélectionne une seule révision en retard avant la tâche courante', async () => {
    const app = createTodayApp({
      authentication,
      now: () => now,
      repository: createRepository(),
    });
    const response = await app.request(
      'http://localhost/api/today?timeZone=Europe%2FParis',
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      action: {
        kind: 'OVERDUE_REVIEW',
        title: 'Réviser : Définir la psychologie',
      },
      program: { percent: 42, title: 'Psychologie' },
      reviewsDue: 1,
    });
  });

  it('recommande la tâche de la leçon en cours sans révision due', async () => {
    const app = createTodayApp({
      authentication,
      now: () => now,
      repository: createRepository({ includeReview: false }),
    });
    const response = await app.request('http://localhost/api/today');

    await expect(response.json()).resolves.toMatchObject({
      action: { kind: 'INCOMPLETE_TASK', title: 'Lire le chapitre' },
      reviewsDue: 0,
    });
  });

  it('retourne la prochaine leçon puis un état sans action', async () => {
    const lessonApp = createTodayApp({
      authentication,
      repository: createRepository({
        includeReview: false,
        includeTask: false,
      }),
    });
    await expect(
      (await lessonApp.request('http://localhost/api/today')).json(),
    ).resolves.toMatchObject({ action: { kind: 'NEXT_LESSON' } });

    const emptyRepository = createRepository({
      includeReview: false,
      includeTask: false,
    });
    emptyRepository.listLessons = async () => [];
    const emptyApp = createTodayApp({
      authentication,
      repository: emptyRepository,
    });
    await expect(
      (await emptyApp.request('http://localhost/api/today')).json(),
    ).resolves.toMatchObject({ action: null });
  });

  it('refuse les requêtes anonymes et les fuseaux invalides', async () => {
    const anonymousApp = createTodayApp({ repository: createRepository() });
    expect(
      (await anonymousApp.request('http://localhost/api/today')).status,
    ).toBe(401);

    const app = createTodayApp({
      authentication,
      repository: createRepository(),
    });
    expect(
      (
        await app.request(
          'http://localhost/api/today?timeZone=Invalid%2FTimezone',
        )
      ).status,
    ).toBe(400);
  });
});
