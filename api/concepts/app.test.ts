import type { MiddlewareHandler } from 'hono';

import {
  ConceptProgressStatus,
  ResourceProgressStatus,
} from '../../generated/prisma/client';
import type { AuthEnvironment } from '../../src/server/api/_lib/auth';
import {
  createConceptsApp,
  type ConceptRepository,
} from '../../src/server/api/concepts/app';

const conceptId = '87b72c3a-0b2f-4dda-b82c-5874c91df9c8';
const userId = '7c777cf7-8f6b-421c-88f4-d17c8d530e93';

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

function createConcept(overrides: Record<string, unknown> = {}) {
  return {
    assessments: [
      {
        assessmentType: 'QUIZ',
        id: 'assessment-1',
        isRequired: true,
        position: 1,
        questionCount: 5,
        title: 'Mini-évaluation',
      },
    ],
    description: 'Comprendre une notion précise.',
    id: conceptId,
    isRequired: true,
    lessonId: 'lesson-1',
    masteryThreshold: 70,
    position: 1,
    progress: null,
    resources: [
      {
        author: null,
        description: null,
        id: 'resource-1',
        isRequired: true,
        key: 'resource-1',
        progressStatus: ResourceProgressStatus.NOT_STARTED,
        title: 'Ressource liée',
        type: 'ARTICLE',
        url: 'https://example.com/resource',
      },
    ],
    slug: 'notion-test',
    title: 'Notion test',
    ...overrides,
  };
}

function createRepository(
  concept: ReturnType<typeof createConcept> | null,
): ConceptRepository {
  return {
    async findPublishedConceptForUser(requestedConceptId, requestedUserId) {
      expect(requestedConceptId).toBe(conceptId);
      expect(requestedUserId).toBe(userId);
      return concept;
    },
  };
}

describe('concept API', () => {
  it('retourne une notion publiée avec ses ressources et validations', async () => {
    const app = createConceptsApp({
      authentication,
      repository: createRepository(createConcept()),
    });
    const response = await app.request(
      `http://localhost/api/concepts/${conceptId}`,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      concept: {
        assessments: [{ assessmentType: 'QUIZ', isRequired: true }],
        id: conceptId,
        resources: [{ id: 'resource-1', title: 'Ressource liée' }],
        title: 'Notion test',
      },
    });
  });

  it('ne valide pas une notion lorsque seule sa ressource est consultée', async () => {
    const concept = createConcept({
      resources: [
        {
          ...createConcept().resources[0],
          progressStatus: ResourceProgressStatus.COMPLETED,
        },
      ],
    });
    const app = createConceptsApp({
      authentication,
      repository: createRepository(concept),
    });
    const response = await app.request(
      `http://localhost/api/concepts/${conceptId}/progress`,
    );

    expect(await response.json()).toEqual({
      progress: {
        bestScore: null,
        conceptId,
        isValidated: false,
        lastAttemptAt: null,
        status: 'LEARNING',
        validatedAt: null,
      },
    });
  });

  it('retourne la maîtrise persistée sans la recalculer depuis les ressources', async () => {
    const validatedAt = new Date('2026-08-02T12:00:00.000Z');
    const concept = createConcept({
      progress: {
        bestScore: 85,
        lastAttemptAt: validatedAt,
        status: ConceptProgressStatus.VALIDATED,
        validatedAt,
      },
    });
    const app = createConceptsApp({
      authentication,
      repository: createRepository(concept),
    });
    const response = await app.request(
      `http://localhost/api/concepts/${conceptId}/progress`,
    );

    expect(await response.json()).toMatchObject({
      progress: { isValidated: true, status: 'VALIDATED' },
    });
  });

  it('normalise les identifiants invalides et les notions absentes', async () => {
    const app = createConceptsApp({
      authentication,
      repository: createRepository(null),
    });
    const invalidResponse = await app.request(
      'http://localhost/api/concepts/not-a-uuid',
    );
    const missingResponse = await app.request(
      `http://localhost/api/concepts/${conceptId}`,
    );

    expect(invalidResponse.status).toBe(400);
    expect(missingResponse.status).toBe(404);
  });
});
