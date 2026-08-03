import type { MiddlewareHandler } from 'hono';

import type { AuthEnvironment } from '../../src/server/api/_lib/auth';
import {
  createAdminApp,
  type AdminRepository,
} from '../../src/server/api/admin/app';

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
  let finalAssessmentReady = true;
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
    async findStageForOwner(id, requestedOwnerId) {
      if (id !== stageId || requestedOwnerId !== ownerId) return null;

      const publishedLesson = {
        concepts: [
          { assessments: lessonReady ? [{ id: 'assessment-1' }] : [] },
        ],
        id: lessonId,
      };

      return {
        assessments: finalAssessmentReady ? [{ id: 'final-1' }] : [],
        id: stageId,
        modules: module.isPublished
          ? [{ id: moduleId, lessons: [publishedLesson] }]
          : [],
      };
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
    async updateStage(id, input) {
      if (id !== stageId) throw new Error('Unexpected stage.');
      return { id: stageId, isPublished: input.isPublished };
    },
  };

  return {
    repository,
    setLessonReady(value: boolean) {
      lessonReady = value;
    },
    setFinalAssessmentReady(value: boolean) {
      finalAssessmentReady = value;
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
        body: JSON.stringify({ isPublished: true }),
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

  it('bloque la publication d’un module sans leçon publiée', async () => {
    const repository = createRepository().repository;
    const updateModule = vi.spyOn(repository, 'updateModule');
    const app = createAdminApp({
      authentication: authentication(),
      repository,
    });

    const response = await app.request(
      `http://localhost/api/admin/modules/${moduleId}`,
      {
        body: JSON.stringify({ isPublished: true }),
        headers: { 'content-type': 'application/json' },
        method: 'PATCH',
      },
    );

    expect(response.status).toBe(409);
    expect(updateModule).not.toHaveBeenCalled();
  });

  it('bloque une étape sans évaluation finale ou contenu public prêt', async () => {
    const fixture = createRepository();
    fixture.setFinalAssessmentReady(false);
    const updateStage = vi.spyOn(fixture.repository, 'updateStage');
    const app = createAdminApp({
      authentication: authentication(),
      repository: fixture.repository,
    });

    const response = await app.request(
      `http://localhost/api/admin/stages/${stageId}`,
      {
        body: JSON.stringify({ isPublished: true }),
        headers: { 'content-type': 'application/json' },
        method: 'PATCH',
      },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: 'ASSESSMENT_NOT_READY' },
    });
    expect(updateStage).not.toHaveBeenCalled();
  });

  it('publie une étape prête appartenant à l’admin', async () => {
    const fixture = createRepository();
    await fixture.repository.updateLesson(lessonId, { isPublished: true });
    await fixture.repository.updateModule(moduleId, { isPublished: true });
    const app = createAdminApp({
      authentication: authentication(),
      repository: fixture.repository,
    });

    const response = await app.request(
      `http://localhost/api/admin/stages/${stageId}`,
      {
        body: JSON.stringify({ isPublished: true }),
        headers: { 'content-type': 'application/json' },
        method: 'PATCH',
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      stage: { id: stageId, isPublished: true },
    });
  });
});
