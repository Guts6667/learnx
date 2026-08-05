import { Hono, type MiddlewareHandler } from 'hono';

import type { AuthEnvironment } from '../../src/server/api/_lib/auth';
import {
  createAdminApp,
  type AdminRepository,
} from '../../src/server/api/admin/app';
import type { AdminNavigationService } from '../../src/server/api/admin/navigation-service';
import type {
  AccessRequestReviewItem,
  AccessRequestReviewService,
} from '../../src/server/api/admin/access-request-review-service';
import {
  PublicationPlanBlockedError,
  PublicationPlanStaleError,
  type PublicationService,
} from '../../src/server/api/admin/publication-service';

const ownerId = '7c777cf7-8f6b-421c-88f4-d17c8d530e93';
const otherUserId = 'f3c7c0f0-7cc6-49ec-b841-095696d75416';
const programId = 'a83f9385-aecd-41a8-ae33-c62d02fbb23f';
const moduleId = 'd53ae785-0d74-4a13-9e0c-f90675f9dd29';
const lessonId = '87b72c3a-0b2f-4dda-b82c-5874c91df9c8';
const stageId = '5cb04580-f91c-46e8-a5d3-d70be5043c1b';
const accessRequestId = '1d8cf94c-d690-430e-a3c0-c3ef68ca857a';

const pendingAccessRequest: AccessRequestReviewItem = {
  assignedRole: null,
  createdAt: new Date('2026-08-05T08:00:00.000Z'),
  emailNormalized: 'candidate@example.com',
  emailVerifiedAt: new Date('2026-08-05T08:05:00.000Z'),
  id: accessRequestId,
  invitationExpiresAt: null,
  rejectionReason: null,
  reviewedAt: null,
  status: 'PENDING_APPROVAL',
  version: 2,
};

function createAccessRequestReviewService(): AccessRequestReviewService {
  return {
    approve: vi.fn(async (_actorUserId, _requestId, input) => ({
      kind: 'APPLIED' as const,
      request: {
        ...pendingAccessRequest,
        assignedRole: input.role,
        invitationExpiresAt: new Date('2026-08-12T08:05:00.000Z'),
        reviewedAt: new Date('2026-08-05T08:10:00.000Z'),
        status: 'APPROVED' as const,
        version: 3,
      },
    })),
    list: vi.fn(async (filters) => ({
      items: [pendingAccessRequest],
      page: filters.page,
      pageSize: filters.pageSize,
      total: 1,
      totalPages: 1,
    })),
    reject: vi.fn(async (_actorUserId, _requestId, input) => ({
      kind: 'APPLIED' as const,
      request: {
        ...pendingAccessRequest,
        rejectionReason: input.reason,
        reviewedAt: new Date('2026-08-05T08:10:00.000Z'),
        status: 'REJECTED' as const,
        version: 3,
      },
    })),
  };
}

function authentication(
  id = ownerId,
  role: 'ADMIN' | 'CREATOR' | 'USER' = 'ADMIN',
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

function createNavigationService(): AdminNavigationService {
  const program = {
    id: programId,
    position: 0,
    slug: 'programme-test',
    status: 'DRAFT' as const,
    title: 'Programme test',
  };
  const stage = {
    id: stageId,
    isPublished: false,
    position: 0,
    slug: 'etape-test',
    title: 'Étape test',
  };
  const module = {
    description: 'Description initiale',
    id: moduleId,
    isPublished: false,
    position: 0,
    slug: 'module-test',
    title: 'Module test',
  };
  const lesson = {
    id: lessonId,
    isPublished: false,
    position: 0,
    slug: 'lecon-test',
    summary: 'Résumé initial',
    title: 'Leçon test',
  };

  return {
    async findLesson(id, requestedOwnerId) {
      if (id !== lessonId || requestedOwnerId !== ownerId) return null;
      return { ...lesson, module: { ...module, stage: { ...stage, program } } };
    },
    async findModule(id, requestedOwnerId) {
      if (id !== moduleId || requestedOwnerId !== ownerId) return null;
      return { ...module, lessons: [lesson], stage: { ...stage, program } };
    },
    async findProgram(id, requestedOwnerId) {
      if (id !== programId || requestedOwnerId !== ownerId) return null;
      return { ...program, stages: [stage] };
    },
    async findStage(id, requestedOwnerId) {
      if (id !== stageId || requestedOwnerId !== ownerId) return null;
      return { ...stage, modules: [module], program };
    },
    async listPrograms(requestedOwnerId) {
      return requestedOwnerId === ownerId ? [program] : [];
    },
  };
}

describe('administration minimale', () => {
  it('refuse une requête anonyme avant de consulter les données', async () => {
    const repository = createRepository().repository;
    const navigationService = createNavigationService();
    const listPrograms = vi.spyOn(navigationService, 'listPrograms');
    const app = createAdminApp({ navigationService, repository });

    const response = await app.request('http://localhost/api/admin/programs');

    expect(response.status).toBe(401);
    expect(listPrograms).not.toHaveBeenCalled();
  });

  it('refuse un utilisateur authentifié sans rôle admin', async () => {
    const repository = createRepository().repository;
    const app = createAdminApp({
      authentication: authentication(ownerId, 'USER'),
      navigationService: createNavigationService(),
      repository,
    });

    const response = await app.request('http://localhost/api/admin/programs');

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: 'FORBIDDEN' },
    });
  });

  it('refuse toute la zone admin au rôle créateur', async () => {
    const navigationService = createNavigationService();
    const listPrograms = vi.spyOn(navigationService, 'listPrograms');
    const app = createAdminApp({
      authentication: authentication(ownerId, 'CREATOR'),
      navigationService,
      repository: createRepository().repository,
    });

    const response = await app.request('/api/admin/programs');

    expect(response.status).toBe(403);
    expect(listPrograms).not.toHaveBeenCalled();
  });

  it('ne protège pas les routes privées qui ne font pas partie de l’administration', async () => {
    const app = new Hono();
    app.route(
      '/',
      createAdminApp({
        authentication: authentication(ownerId, 'USER'),
        navigationService: createNavigationService(),
        repository: createRepository().repository,
      }),
    );
    app.get('/api/programs', (context) =>
      context.json({ programs: [{ title: 'Programme privé' }] }),
    );

    const response = await app.request('http://localhost/api/programs');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      programs: [{ title: 'Programme privé' }],
    });
  });

  it('liste uniquement le parcours appartenant à l’admin', async () => {
    const repository = createRepository().repository;
    const navigationService = createNavigationService();
    const listPrograms = vi.spyOn(navigationService, 'listPrograms');
    const app = createAdminApp({
      authentication: authentication(),
      navigationService,
      repository,
    });

    const response = await app.request('http://localhost/api/admin/programs');

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      kind: 'PROGRAMS',
      programs: [{ position: 0, title: 'Programme test' }],
    });
    expect(listPrograms).toHaveBeenCalledWith(ownerId);
  });

  it.each([
    ['programs', programId, 'PROGRAM', 'program', 'Étape test'],
    ['stages', stageId, 'STAGE', 'stage', 'Module test'],
    ['modules', moduleId, 'MODULE', 'module', 'Leçon test'],
    ['lessons', lessonId, 'LESSON', 'lesson', 'Leçon test'],
  ])(
    'charge à la demande le niveau %s et son contexte immédiat',
    async (segment, id, kind, key, expectedTitle) => {
      const app = createAdminApp({
        authentication: authentication(),
        navigationService: createNavigationService(),
        repository: createRepository().repository,
      });

      const response = await app.request(`/api/admin/${segment}/${id}`);
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(body.kind).toBe(kind);
      expect(JSON.stringify(body[key])).toContain(expectedTitle);
    },
  );

  it('ne révèle pas un niveau appartenant à un autre propriétaire', async () => {
    const app = createAdminApp({
      authentication: authentication(otherUserId),
      navigationService: createNavigationService(),
      repository: createRepository().repository,
    });

    const response = await app.request(`/api/admin/lessons/${lessonId}`);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: { code: 'RESOURCE_NOT_FOUND' },
    });
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
          position: 0,
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
        position: 0,
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

  it('liste les demandes vérifiées avec pagination, filtre et recherche', async () => {
    const accessRequestReviewService = createAccessRequestReviewService();
    const app = createAdminApp({
      accessRequestReviewService,
      authentication: authentication(),
      repository: createRepository().repository,
    });
    const response = await app.request(
      '/api/admin/access-requests?page=2&pageSize=10&status=PENDING_APPROVAL&search=candidate',
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      page: {
        items: [{ emailNormalized: 'candidate@example.com' }],
        page: 2,
        pageSize: 10,
      },
    });
    expect(accessRequestReviewService.list).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      search: 'candidate',
      status: 'PENDING_APPROVAL',
    });
  });

  it.each(['USER', 'CREATOR'] as const)(
    'interdit la revue des demandes au rôle %s',
    async (role) => {
      const accessRequestReviewService = createAccessRequestReviewService();
      const app = createAdminApp({
        accessRequestReviewService,
        authentication: authentication(ownerId, role),
        repository: createRepository().repository,
      });

      const response = await app.request('/api/admin/access-requests');

      expect(response.status).toBe(403);
      expect(accessRequestReviewService.list).not.toHaveBeenCalled();
    },
  );

  it('accepte une demande avec rôle et version explicites', async () => {
    const accessRequestReviewService = createAccessRequestReviewService();
    const app = createAdminApp({
      accessRequestReviewService,
      authentication: authentication(),
      repository: createRepository().repository,
    });
    const response = await app.request(
      `/api/admin/access-requests/${accessRequestId}/approve`,
      {
        body: JSON.stringify({ expectedVersion: 2, role: 'CREATOR' }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      request: { assignedRole: 'CREATOR', status: 'APPROVED', version: 3 },
    });
    expect(accessRequestReviewService.approve).toHaveBeenCalledWith(
      ownerId,
      accessRequestId,
      { expectedVersion: 2, role: 'CREATOR' },
    );
  });

  it('refuse une demande avec un motif interne explicite', async () => {
    const accessRequestReviewService = createAccessRequestReviewService();
    const app = createAdminApp({
      accessRequestReviewService,
      authentication: authentication(),
      repository: createRepository().repository,
    });
    const response = await app.request(
      `/api/admin/access-requests/${accessRequestId}/reject`,
      {
        body: JSON.stringify({
          expectedVersion: 2,
          reason: 'Demande hors périmètre.',
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      request: {
        rejectionReason: 'Demande hors périmètre.',
        status: 'REJECTED',
      },
    });
    expect(accessRequestReviewService.reject).toHaveBeenCalledWith(
      ownerId,
      accessRequestId,
      { expectedVersion: 2, reason: 'Demande hors périmètre.' },
    );
  });

  it('normalise un conflit de décision concurrente', async () => {
    const accessRequestReviewService = createAccessRequestReviewService();
    accessRequestReviewService.approve = vi.fn(async () => ({
      kind: 'CONFLICT' as const,
    }));
    const app = createAdminApp({
      accessRequestReviewService,
      authentication: authentication(),
      repository: createRepository().repository,
    });
    const response = await app.request(
      `/api/admin/access-requests/${accessRequestId}/approve`,
      {
        body: JSON.stringify({ expectedVersion: 2, role: 'USER' }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: 'ACCESS_REQUEST_CONFLICT' },
    });
  });
});
