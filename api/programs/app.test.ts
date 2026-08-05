import type { MiddlewareHandler } from 'hono';

import type { PrismaClient, Role } from '../../generated/prisma/client';
import type { AuthEnvironment } from '../../src/server/api/_lib/auth';
import { createCurriculumApp } from '../../src/server/api/programs/app';

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
      program: {
        OR?: Array<{ ownerId?: string; visibility?: string }>;
        ownerId?: string;
      };
    };
  };
}

function createClient(
  resourceOwnerId = ownerId,
  options: {
    programStatus?: 'ACTIVE' | 'DRAFT';
    published?: boolean;
    visibility?: 'PRIVATE' | 'PUBLIC';
  } = {},
) {
  const programStatus = options.programStatus ?? 'ACTIVE';
  const published = options.published ?? false;
  const visibility = options.visibility ?? 'PRIVATE';
  const lesson = {
    _count: { concepts: 1, exercises: 1, quizzes: 1, resources: 0, tasks: 0 },
    concepts: [
      {
        assessments: [
          {
            id: 'assessment-1',
            isRequired: true,
            position: 1,
            questionCount: 5,
            title: 'Mini-évaluation',
          },
        ],
        id: 'concept-1',
        isRequired: true,
        masteryThreshold: 70,
        position: 1,
        slug: 'notion-test',
        title: 'Notion test',
      },
    ],
    contentBlocks: [],
    exercises: [
      {
        id: 'exercise-1',
        instructions: 'Rédiger une analyse.',
        isRequired: true,
        position: 1,
        rubric: null,
        title: 'Analyse appliquée',
      },
    ],
    id: 'lesson-1',
    isPublished: published,
    position: 1,
    progress: [{ percent: 0, status: 'AVAILABLE' as const }],
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
    description: 'Draft module description',
    estimatedMinutes: 30,
    id: 'module-1',
    isPublished: published,
    lessons: [lesson],
    position: 1,
    slug: 'draft-module',
    title: 'Draft module',
  };
  const stage = {
    id: 'stage-1',
    isPublished: published,
    modules: [module],
    position: 1,
    slug: 'draft-stage',
    title: 'Draft stage',
  };
  const program = {
    description: 'Draft program description',
    estimatedDurationDays: 10,
    id: 'program-1',
    ownerId: resourceOwnerId,
    slug: 'draft-program',
    stages: [stage],
    status: programStatus,
    title: 'Draft program',
    visibility,
  };
  const lessonSibling = {
    id: lesson.id,
    isPublished: lesson.isPublished,
    position: lesson.position,
    slug: lesson.slug,
    summary: lesson.summary,
    title: lesson.title,
  };
  Object.assign(module, {
    stage: {
      id: stage.id,
      isPublished: stage.isPublished,
      program: {
        id: program.id,
        ownerId: program.ownerId,
        slug: program.slug,
        title: program.title,
      },
      slug: stage.slug,
      title: stage.title,
    },
  });
  Object.assign(lesson, {
    module: {
      id: module.id,
      isPublished: module.isPublished,
      lessons: [lessonSibling],
      slug: module.slug,
      stage: {
        id: stage.id,
        isPublished: stage.isPublished,
        program: {
          id: program.id,
          ownerId: program.ownerId,
          slug: program.slug,
          title: program.title,
        },
        slug: stage.slug,
        title: stage.title,
      },
      title: module.title,
    },
  });
  const findMany = vi.fn(async (input: unknown) => {
    const where = (input as { where: LessonWhere }).where;
    const canAccessDraft =
      where.isPublished === undefined &&
      where.module.isPublished === undefined &&
      where.module.stage.isPublished === undefined &&
      where.module.stage.program.ownerId === resourceOwnerId;
    const canAccessPublished =
      published &&
      programStatus === 'ACTIVE' &&
      where.isPublished === true &&
      where.module.isPublished === true &&
      where.module.stage.isPublished === true &&
      where.module.stage.program.OR?.some(
        (candidate) =>
          candidate.ownerId === resourceOwnerId ||
          (candidate.visibility === 'PUBLIC' && visibility === 'PUBLIC'),
      );

    if (!canAccessDraft && !canAccessPublished) {
      return [];
    }

    return [lesson];
  });
  function canReadProgram(where: {
    OR?: Array<{ ownerId?: string; visibility?: string }>;
    ownerId?: string;
    status?: string | { in: string[] };
  }): boolean {
    const statusAllowed =
      typeof where.status === 'object'
        ? where.status.in.includes(programStatus)
        : where.status === undefined || where.status === programStatus;
    const accessAllowed =
      where.ownerId === resourceOwnerId ||
      where.OR?.some(
        (candidate) =>
          candidate.ownerId === resourceOwnerId ||
          (candidate.visibility === 'PUBLIC' && visibility === 'PUBLIC'),
      );
    return Boolean(statusAllowed && accessAllowed);
  }
  const client = {
    module: {
      findMany: vi.fn(async (input: unknown) => {
        const where = (
          input as {
            where: {
              stage: {
                program: Parameters<typeof canReadProgram>[0];
              };
            };
          }
        ).where;

        return canReadProgram(where.stage.program) ? [module] : [];
      }),
    },
    program: {
      findFirst: vi.fn(async (input: unknown) => {
        const where = (input as { where: { ownerId: string } }).where;

        return where.ownerId === resourceOwnerId ? program : null;
      }),
      findMany: vi.fn(async (input: unknown) => {
        const where = (
          input as { where: Parameters<typeof canReadProgram>[0] }
        ).where;

        return canReadProgram(where) ? [program] : [];
      }),
    },
    stage: {
      findMany: vi.fn(async (input: unknown) => {
        const where = (
          input as {
            where: { program: Parameters<typeof canReadProgram>[0] };
          }
        ).where;

        return canReadProgram(where.program)
          ? [{ ...stage, program: { ownerId: resourceOwnerId } }]
          : [];
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
          isLocked: false,
          isPublished: false,
          concepts: [
            {
              assessments: [{ questionCount: 5, title: 'Mini-évaluation' }],
            },
          ],
          exercises: [{ title: 'Analyse appliquée' }],
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
        requiredExercises: { total: 0, validated: 0 },
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

  it('autorise un membre authentifié à lire toute la hiérarchie publiée d’un programme public', async () => {
    const { client } = createClient(ownerId, {
      published: true,
      visibility: 'PUBLIC',
    });
    const app = createCurriculumApp({
      authentication: createAuthentication(otherUserId),
      getClient: async () => client,
      readProgramTimeline: async () => null,
      readStageTimeline: async () => null,
      readStageValidation: async () => null,
    });
    const paths = [
      '/api/programs/draft-program',
      '/api/programs/draft-program/stages/draft-stage',
      '/api/modules/draft-module',
      '/api/lessons/draft-lesson',
    ];

    for (const path of paths) {
      const response = await app.request(`http://localhost${path}`);
      expect(response.status, path).toBe(200);
    }
  });

  it('masque une leçon publiée lorsque le programme reste privé', async () => {
    const { client } = createClient(ownerId, {
      published: true,
      visibility: 'PRIVATE',
    });
    const app = createCurriculumApp({
      authentication: createAuthentication(otherUserId),
      getClient: async () => client,
    });

    const response = await app.request(
      'http://localhost/api/lessons/draft-lesson',
    );

    expect(response.status).toBe(404);
  });

  it('réserve toujours preview=true au propriétaire', async () => {
    const { client } = createClient(ownerId, { visibility: 'PUBLIC' });
    const app = createCurriculumApp({
      authentication: createAuthentication(otherUserId),
      getClient: async () => client,
    });

    const response = await app.request(
      'http://localhost/api/lessons/draft-lesson?preview=true',
    );

    expect(response.status).toBe(404);
  });

  it('masque un programme public tant que son statut reste brouillon', async () => {
    const { client } = createClient(ownerId, {
      programStatus: 'DRAFT',
      published: true,
      visibility: 'PUBLIC',
    });
    const app = createCurriculumApp({
      authentication: createAuthentication(otherUserId),
      getClient: async () => client,
    });

    const response = await app.request(
      'http://localhost/api/lessons/draft-lesson',
    );

    expect(response.status).toBe(404);
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
