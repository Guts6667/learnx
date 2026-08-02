import type { MiddlewareHandler } from 'hono';

import type { PrismaClient, Role } from '../../generated/prisma/client';
import type { AuthEnvironment } from '../_lib/auth';
import { createCurriculumApp } from './app';

const ownerId = '7c777cf7-8f6b-421c-88f4-d17c8d530e93';
const otherUserId = 'f3c7c0f0-7cc6-49ec-b841-095696d75416';

function createAuthentication(
  userId: string,
  role: Role = 'USER',
): MiddlewareHandler<AuthEnvironment> {
  return async (context, next) => {
    context.set('user', {
      displayName: 'Learner',
      email: 'learner@example.com',
      id: userId,
      role,
    });
    await next();
  };
}

interface LessonWhere {
  isPublished?: boolean;
  module: {
    isPublished?: boolean;
    stage: {
      isPublished?: boolean;
      program: { ownerId: string };
    };
  };
}

function createClient(resourceOwnerId = ownerId) {
  const lesson = {
    contentBlocks: [],
    id: 'lesson-1',
    isPublished: false,
    position: 1,
    quizzes: [
      {
        _count: { questions: 4 },
        description: 'Vérifier les acquis.',
        id: 'quiz-1',
        isRequired: true,
        passingScore: 70,
        position: 1,
        title: 'Quiz de la leçon',
      },
    ],
    resources: [],
    slug: 'draft-lesson',
    summary: 'Draft summary',
    tasks: [],
    title: 'Draft lesson',
  };
  const module = {
    id: 'module-1',
    isPublished: false,
    lessons: [lesson],
    position: 1,
    slug: 'draft-module',
    title: 'Draft module',
  };
  const stage = {
    id: 'stage-1',
    isPublished: false,
    modules: [module],
    position: 1,
    slug: 'draft-stage',
    title: 'Draft stage',
  };
  const program = {
    id: 'program-1',
    ownerId: resourceOwnerId,
    slug: 'draft-program',
    stages: [stage],
    status: 'ACTIVE',
    title: 'Draft program',
  };
  const findMany = vi.fn(async (input: unknown) => {
    const where = (input as { where: LessonWhere }).where;
    const canAccessDraft =
      where.isPublished === undefined &&
      where.module.isPublished === undefined &&
      where.module.stage.isPublished === undefined &&
      where.module.stage.program.ownerId === resourceOwnerId;

    if (!canAccessDraft) {
      return [];
    }

    return [lesson];
  });
  const client = {
    module: {
      findMany: vi.fn(async (input: unknown) => {
        const where = (
          input as {
            where: { stage: { program: { ownerId: string } } };
          }
        ).where;

        return where.stage.program.ownerId === resourceOwnerId ? [module] : [];
      }),
    },
    program: {
      findFirst: vi.fn(async (input: unknown) => {
        const where = (input as { where: { ownerId: string } }).where;

        return where.ownerId === resourceOwnerId ? program : null;
      }),
      findMany: vi.fn(async (input: unknown) => {
        const where = (input as { where: { ownerId: string } }).where;

        return where.ownerId === resourceOwnerId ? [program] : [];
      }),
    },
    stage: {
      findFirst: vi.fn(async (input: unknown) => {
        const where = (input as { where: { program: { ownerId: string } } })
          .where;

        return where.program.ownerId === resourceOwnerId ? stage : null;
      }),
    },
    lesson: { findMany },
  } as unknown as PrismaClient;

  return { client, findMany };
}

describe('curriculum draft preview authorization', () => {
  it('refuse une prévisualisation sans session', async () => {
    const getClient = vi.fn(async () => createClient().client);
    const app = createCurriculumApp({ getClient });
    const response = await app.request(
      'http://localhost/api/lessons/draft-lesson?preview=true',
    );

    expect(response.status).toBe(401);
    expect(getClient).not.toHaveBeenCalled();
  });

  it.each(['USER', 'ADMIN'] as const)(
    'autorise le propriétaire authentifié avec le rôle %s',
    async (role) => {
      const { client, findMany } = createClient();
      const app = createCurriculumApp({
        authentication: createAuthentication(ownerId, role),
        getClient: async () => client,
      });
      const response = await app.request(
        'http://localhost/api/lessons/draft-lesson?preview=true',
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        lesson: {
          isPublished: false,
          quizzes: [{ questionCount: 4, title: 'Quiz de la leçon' }],
          title: 'Draft lesson',
        },
      });
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            module: expect.objectContaining({
              stage: expect.objectContaining({
                program: expect.objectContaining({ ownerId }),
              }),
            }),
          }),
        }),
      );
    },
  );

  it('rend toute la hiérarchie brouillon accessible au propriétaire', async () => {
    const { client } = createClient();
    const app = createCurriculumApp({
      authentication: createAuthentication(ownerId),
      getClient: async () => client,
      readProgramTimeline: async () => null,
      readStageTimeline: async () => null,
      readStageValidation: async () => ({
        finalAssessments: { total: 1, validated: 0 },
        isValidated: false,
        missingRequirements: [
          {
            id: 'assessment-1',
            title: 'Évaluation finale',
            type: 'FINAL_ASSESSMENT',
          },
        ],
        requiredConcepts: { total: 0, validated: 0 },
        requiredTasks: { total: 0, validated: 0 },
        status: 'AVAILABLE',
      }),
    });
    const paths = [
      '/api/programs?preview=true',
      '/api/programs/draft-program?preview=true',
      '/api/programs/draft-program/stages/draft-stage?preview=true',
      '/api/modules/draft-module?preview=true',
      '/api/lessons/draft-lesson?preview=true',
    ];

    for (const path of paths) {
      const response = await app.request(`http://localhost${path}`);

      expect(response.status, path).toBe(200);
    }
  });

  it('masque le brouillon à un utilisateur non propriétaire', async () => {
    const { client } = createClient(ownerId);
    const app = createCurriculumApp({
      authentication: createAuthentication(otherUserId),
      getClient: async () => client,
    });
    const response = await app.request(
      'http://localhost/api/lessons/draft-lesson?preview=true',
    );

    expect(response.status).toBe(404);
  });

  it('conserve les filtres de publication sans prévisualisation', async () => {
    const { client, findMany } = createClient();
    const app = createCurriculumApp({
      authentication: createAuthentication(ownerId),
      getClient: async () => client,
    });

    const response = await app.request(
      'http://localhost/api/lessons/draft-lesson',
    );

    expect(response.status).toBe(404);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isPublished: true,
          module: expect.objectContaining({
            isPublished: true,
            stage: expect.objectContaining({ isPublished: true }),
          }),
        }),
      }),
    );
  });

  it('refuse un paramètre de prévisualisation invalide', async () => {
    const getClient = vi.fn(async () => createClient().client);
    const app = createCurriculumApp({
      authentication: createAuthentication(ownerId),
      getClient,
    });
    const response = await app.request(
      'http://localhost/api/lessons/draft-lesson?preview=false',
    );

    expect(response.status).toBe(400);
    expect(getClient).not.toHaveBeenCalled();
  });
});
