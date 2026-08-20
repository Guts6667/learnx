import type { MiddlewareHandler } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import type { AuthEnvironment } from '../_lib/auth.js';
import { createTodayApp, type TodayRepository } from './app.js';

const userId = '11111111-1111-4111-8111-111111111111';

function authentication(): MiddlewareHandler<AuthEnvironment> {
  return async (context, next) => {
    context.set('user', {
      displayName: 'Test',
      email: 'test@example.com',
      id: userId,
      locale: 'fr',
      role: 'USER',
    });
    await next();
  };
}

function repository(
  programs: Awaited<ReturnType<TodayRepository['listActivePrograms']>> = [],
  lessons: Awaited<ReturnType<TodayRepository['listLessons']>> = [],
): TodayRepository {
  return {
    listActivePrograms: vi.fn().mockResolvedValue(programs),
    listFinalAssessments: vi.fn().mockResolvedValue([]),
    listLessons: vi.fn().mockResolvedValue(lessons),
    listPendingReviews: vi.fn().mockResolvedValue([]),
  };
}

describe('V4-016C Today API', () => {
  it('ne lit aucune progression sans session authentifiée', async () => {
    const data = repository();
    const app = createTodayApp({ repository: data });

    const response = await app.request('/api/today');

    expect(response.status).toBe(401);
    expect(data.listActivePrograms).not.toHaveBeenCalled();
  });

  it('distingue la première arrivée d’un chargement et borne le contrat vide', async () => {
    const data = repository();
    const app = createTodayApp({
      authentication: authentication(),
      repository: data,
    });

    const response = await app.request('/api/today?timeZone=Europe%2FParis');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      action: null,
      hasMorePrograms: false,
      lastActivity: null,
      program: null,
      programCount: 0,
      programs: [],
      reviewsDue: 0,
    });
    expect(data.listActivePrograms).toHaveBeenCalledWith(userId);
    expect(data.listLessons).toHaveBeenCalledWith(userId);
  });

  it('fournit la première activité canonique d’un parcours jamais commencé', async () => {
    const data = repository(
      [
        {
          id: 'program-1',
          position: 1,
          progress: [],
          slug: 'premier',
          title: 'Premier parcours',
        },
      ],
      [
        {
          activityCompletionCarryovers: [],
          concepts: [],
          estimatedMinutes: 15,
          exercises: [],
          id: 'lesson-1',
          lessonSequenceItems: [],
          module: {
            id: 'module-1',
            position: 1,
            slug: 'introduction',
            stage: {
              id: 'stage-1',
              position: 1,
              program: {
                id: 'program-1',
                position: 1,
                slug: 'premier',
                title: 'Premier parcours',
              },
              progress: [],
              slug: 'fondations',
              title: 'Fondations',
            },
            title: 'Introduction',
          },
          position: 1,
          progress: [],
          quizzes: [],
          slug: 'bienvenue',
          tasks: [],
          title: 'Bienvenue',
        },
      ],
    );
    const app = createTodayApp({
      authentication: authentication(),
      repository: data,
    });

    const response = await app.request('/api/today');
    const body = (await response.json()) as {
      action: { href: string; programId: string };
      programs: Array<{
        resumeHref: string | null;
        status: string;
      }>;
    };

    expect(response.status).toBe(200);
    expect(body.action).toMatchObject({
      href: '/program/premier/lesson/bienvenue',
      programId: 'program-1',
    });
    expect(body.programs[0]).toMatchObject({
      resumeHref: '/program/premier/lesson/bienvenue',
      status: 'NOT_STARTED',
    });
  });

  it('retourne tous les parcours accessibles avec une recommandation unique', async () => {
    const data = repository([
      {
        id: 'program-1',
        position: 1,
        progress: [
          {
            lastViewedAt: new Date('2026-08-18T10:00:00.000Z'),
            percent: 35,
          },
        ],
        slug: 'premier',
        title: 'Premier parcours',
      },
      {
        id: 'program-2',
        position: 2,
        progress: [
          {
            lastViewedAt: new Date('2026-08-20T10:00:00.000Z'),
            percent: 70,
          },
        ],
        slug: 'deuxieme',
        title: 'Deuxième parcours',
      },
      {
        id: 'program-3',
        position: 3,
        progress: [
          {
            lastViewedAt: new Date('2026-08-19T10:00:00.000Z'),
            percent: 100,
          },
        ],
        slug: 'troisieme',
        title: 'Troisième parcours',
      },
    ]);
    const app = createTodayApp({
      authentication: authentication(),
      repository: data,
    });

    const response = await app.request('/api/today');
    const body = (await response.json()) as {
      action: unknown;
      program: { id: string };
      programCount: number;
      programs: Array<{
        id: string;
        resumeHref: string | null;
        status: string;
      }>;
    };

    expect(response.status).toBe(200);
    expect(body.action).toBeNull();
    expect(body.program.id).toBe('program-2');
    expect(body.programCount).toBe(3);
    expect(body.programs.map((program) => program.id)).toEqual([
      'program-2',
      'program-3',
      'program-1',
    ]);
    expect(body.programs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'program-1',
          resumeHref: '/program/premier',
          status: 'IN_PROGRESS',
        }),
        expect.objectContaining({
          id: 'program-3',
          resumeHref: null,
          status: 'COMPLETED',
        }),
      ]),
    );
  });

  it('refuse une zone horaire invalide avant toute lecture personnelle', async () => {
    const data = repository();
    const app = createTodayApp({
      authentication: authentication(),
      repository: data,
    });

    const response = await app.request('/api/today?timeZone=Not%2FAZone');

    expect(response.status).toBe(400);
    expect(data.listActivePrograms).not.toHaveBeenCalled();
  });
});
