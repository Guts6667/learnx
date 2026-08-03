import type { MiddlewareHandler } from 'hono';

import type { AuthEnvironment } from '../../src/server/api/_lib/auth';
import {
  createAdminApp,
  type AdminRepository,
} from '../../src/server/api/admin/app';
import {
  PublicationPlanBlockedError,
  PublicationPlanStaleError,
  type PublicationService,
} from '../../src/server/api/admin/publication-service';

const ownerId = '7c777cf7-8f6b-421c-88f4-d17c8d530e93';
const otherUserId = 'f3c7c0f0-7cc6-49ec-b841-095696d75416';
const moduleId = 'd53ae785-0d74-4a13-9e0c-f90675f9dd29';
const lessonId = '87b72c3a-0b2f-4dda-b82c-5874c91df9c8';
const stageId = '5cb04580-f91c-46e8-a5d3-d70be5043c1b';

function authentication(
  id = ownerId,
  role: 'ADMIN' | 'USER' = 'ADMIN',
): MiddlewareHandler<AuthEnvironment> {
  return async (context, next) => {
    context.set('user', {
      displayName: 'Admin',
      email: 'admin@example.com',
      id,
      role,
    });
    await next();
  };
}

function createRepository() {
  let module = {
    description: 'Description initiale',
    id: moduleId,
    isPublished: false,
    lessons: [] as Array<{
      id: string;
      isPublished: boolean;
      position: number;
      slug: string;
      summary: string;
      title: string;
    }>,
    position: 1,
    slug: 'module-test',
    title: 'Module test',
  };
  let lesson = {
    id: lessonId,
    isPublished: false,
    position: 1,
    slug: 'lecon-test',
    summary: 'Résumé initial',
    title: 'Leçon test',
  };
  let lessonReady = true;
  module.lessons = [lesson];

  const repository: AdminRepository = {
    async findLessonForOwner(id, requestedOwnerId) {
      if (id !== lessonId || requestedOwnerId !== ownerId) return null;

      return {
        concepts: [
          { assessments: lessonReady ? [{ id: 'assessment-1' }] : [] },
        ],
        id: lessonId,
      };
    },
    async findModuleForOwner(id, requestedOwnerId) {
      return id === moduleId && requestedOwnerId === ownerId
        ? {
            id: moduleId,
            lessons: lesson.isPublished
              ? [
                  {
                    concepts: [
                      {
                        assessments: lessonReady
                          ? [{ id: 'assessment-1' }]
                          : [],
                      },
                    ],
                    id: lessonId,
                  },
                ]
              : [],
          }
        : null;
    },
    async listCurriculum(requestedOwnerId) {
      if (requestedOwnerId !== ownerId) return [];

      return [
        {
          id: 'program-1',
          slug: 'programme-test',
          stages: [
            {
              id: stageId,
              isPublished: false,
              modules: [module],
              position: 1,
              slug: 'etape-test',
              title: 'Étape test',
            },
          ],
          status: 'DRAFT' as const,
          title: 'Programme test',
        },
      ];
    },
    async updateLesson(id, input) {
      if (id !== lessonId) throw new Error('Unexpected lesson.');
      lesson = { ...lesson, ...input };
      module.lessons = [lesson];
      return lesson;
    },
    async updateModule(id, input) {
      if (id !== moduleId) throw new Error('Unexpected module.');
      module = { ...module, ...input };
      return module;
    },
  };

  return {
    repository,
    setLessonReady(value: boolean) {
      lessonReady = value;
    },
  };
}

describe('administration minimale', () => {
  it('refuse une requête anonyme avant de consulter les données', async () => {
    const repository = createRepository().repository;
    const listCurriculum = vi.spyOn(repository, 'listCurriculum');
    const app = createAdminApp({ repository });

    const response = await app.request('http://localhost/api/admin/curriculum');

    expect(response.status).toBe(401);
    expect(listCurriculum).not.toHaveBeenCalled();
  });

  it('refuse un utilisateur authentifié sans rôle admin', async () => {
    const repository = createRepository().repository;
    const app = createAdminApp({
      authentication: authentication(ownerId, 'USER'),
      repository,
    });

    const response = await app.request('http://localhost/api/admin/curriculum');

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: 'FORBIDDEN' },
    });
  });

  it('liste uniquement le parcours appartenant à l’admin', async () => {
    const repository = createRepository().repository;
    const listCurriculum = vi.spyOn(repository, 'listCurriculum');
    const app = createAdminApp({
      authentication: authentication(),
      repository,
    });

    const response = await app.request('http://localhost/api/admin/curriculum');

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      programs: [
        {
          stages: [{ modules: [{ lessons: [{ title: 'Leçon test' }] }] }],
          title: 'Programme test',
        },
      ],
    });
    expect(listCurriculum).toHaveBeenCalledWith(ownerId);
  });

  it('modifie les champs administrables d’un module appartenant à l’admin', async () => {
    const repository = createRepository().repository;
    const app = createAdminApp({
      authentication: authentication(),
      repository,
    });

    const response = await app.request(
      `http://localhost/api/admin/modules/${moduleId}`,
      {
        body: JSON.stringify({
          description: 'Résumé modifié',
          position: 2,
          title: 'Module modifié',
        }),
        headers: { 'content-type': 'application/json' },
        method: 'PATCH',
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      module: {
        description: 'Résumé modifié',
        position: 2,
        title: 'Module modifié',
      },
    });
  });

  it('ne permet pas à un admin de modifier le contenu d’un autre propriétaire', async () => {
    const repository = createRepository().repository;
    const updateModule = vi.spyOn(repository, 'updateModule');
    const app = createAdminApp({
      authentication: authentication(otherUserId),
      repository,
    });

    const response = await app.request(
      `http://localhost/api/admin/modules/${moduleId}`,
      {
        body: JSON.stringify({ title: 'Modification interdite' }),
        headers: { 'content-type': 'application/json' },
        method: 'PATCH',
      },
    );

    expect(response.status).toBe(404);
    expect(updateModule).not.toHaveBeenCalled();
  });

  it('bloque la publication d’une leçon pédagogiquement incomplète', async () => {
    const fixture = createRepository();
    fixture.setLessonReady(false);
    const updateLesson = vi.spyOn(fixture.repository, 'updateLesson');
    const app = createAdminApp({
      authentication: authentication(),
      repository: fixture.repository,
    });

    const response = await app.request(
      `http://localhost/api/admin/lessons/${lessonId}`,
      {
        body: JSON.stringify({ isPublished: true }),
        headers: { 'content-type': 'application/json' },
        method: 'PATCH',
      },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: 'LESSON_NOT_READY' },
    });
    expect(updateLesson).not.toHaveBeenCalled();
  });

  it('publie et dépublie une leçon prête sans modifier sa hiérarchie', async () => {
    const repository = createRepository().repository;
    const app = createAdminApp({
      authentication: authentication(),
      repository,
    });

    for (const isPublished of [true, false]) {
      const response = await app.request(
        `http://localhost/api/admin/lessons/${lessonId}`,
        {
          body: JSON.stringify({ isPublished }),
          headers: { 'content-type': 'application/json' },
          method: 'PATCH',
        },
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        lesson: { isPublished },
      });
    }
  });

  it('prévisualise puis applique exactement le même plan de publication', async () => {
    const plan = {
      action: 'PUBLISH' as const,
      blockers: [],
      changes: [
        {
          from: false,
          id: moduleId,
          title: 'Module test',
          to: true,
          type: 'MODULE' as const,
        },
      ],
      mode: 'FULL' as const,
      planId: 'a'.repeat(64),
      target: { id: moduleId, title: 'Module test', type: 'MODULE' as const },
      warnings: [],
    };
    const publicationService: PublicationService = {
      apply: vi.fn(async () => plan),
      preview: vi.fn(async () => plan),
    };
    const app = createAdminApp({
      authentication: authentication(),
      publicationService,
      repository: createRepository().repository,
    });
    const request = {
      action: 'PUBLISH',
      mode: 'FULL',
      targetId: moduleId,
      targetType: 'MODULE',
    };
    const preview = await app.request('/api/admin/publication/preview', {
      body: JSON.stringify(request),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const apply = await app.request('/api/admin/publication/apply', {
      body: JSON.stringify({ ...request, planId: plan.planId }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    expect(preview.status).toBe(200);
    expect(apply.status).toBe(200);
    expect(publicationService.preview).toHaveBeenCalledWith(ownerId, request);
    expect(publicationService.apply).toHaveBeenCalledWith(ownerId, {
      ...request,
      planId: plan.planId,
    });
  });

  it('ne révèle pas le plan d’un autre propriétaire', async () => {
    const publicationService: PublicationService = {
      apply: vi.fn(async () => null),
      preview: vi.fn(async () => null),
    };
    const app = createAdminApp({
      authentication: authentication(otherUserId),
      publicationService,
      repository: createRepository().repository,
    });
    const response = await app.request('/api/admin/publication/preview', {
      body: JSON.stringify({
        action: 'PUBLISH',
        mode: 'FULL',
        targetId: moduleId,
        targetType: 'MODULE',
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    expect(response.status).toBe(404);
    expect(publicationService.preview).toHaveBeenCalledWith(
      otherUserId,
      expect.any(Object),
    );
  });

  it.each([
    [new PublicationPlanStaleError(), 'PUBLICATION_PLAN_STALE'],
    [new PublicationPlanBlockedError(), 'PUBLICATION_BLOCKED'],
  ])('normalise les conflits de confirmation', async (error, code) => {
    const publicationService: PublicationService = {
      apply: vi.fn(async () => {
        throw error;
      }),
      preview: vi.fn(async () => null),
    };
    const app = createAdminApp({
      authentication: authentication(),
      publicationService,
      repository: createRepository().repository,
    });
    const response = await app.request('/api/admin/publication/apply', {
      body: JSON.stringify({
        action: 'PUBLISH',
        mode: 'FULL',
        planId: 'a'.repeat(64),
        targetId: moduleId,
        targetType: 'MODULE',
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code } });
  });
});
