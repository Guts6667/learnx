import type { MiddlewareHandler } from 'hono';

import {
  ReviewSourceType,
  ReviewStatus,
  type PrismaClient,
} from '../../generated/prisma/client';
import type { AuthEnvironment } from '../../src/server/api/_lib/auth';
import {
  createPrismaReviewsRepository,
  createReviewsApp,
  type ReviewsRepository,
} from '../../src/server/api/reviews/app';

const userId = '7c777cf7-8f6b-421c-88f4-d17c8d530e93';
const otherUserId = 'f3c7c0f0-7cc6-49ec-b841-095696d75416';
const reviewId = '87b72c3a-0b2f-4dda-b82c-5874c91df9c8';
const assessmentId = '42e12fb8-4b9d-4b7f-bf48-881539f8cdb8';
const now = new Date('2026-08-03T10:00:00.000Z');

function authenticationFor(id: string): MiddlewareHandler<AuthEnvironment> {
  return async (context, next) => {
    context.set('user', {
      displayName: 'Learner',
      email: 'learner@example.com',
      id,
      role: 'USER',
    });
    await next();
  };
}

function createRepository(): ReviewsRepository {
  return {
    async complete(requestedReviewId, requestedUserId, completedAt) {
      return requestedReviewId === reviewId && requestedUserId === userId
        ? { completedAt, id: reviewId, status: ReviewStatus.COMPLETED }
        : null;
    },
    async listPending(input) {
      if (input.userId !== userId) return { items: [], nextCursor: null };

      return { items: [
        {
          assessmentTitle: 'Mini-évaluation — Mémoire',
          conceptTitle: 'Mémoire de travail',
          dueAt: new Date('2026-08-03T08:00:00.000Z'),
          id: reviewId,
          intervalDays: 1,
          isDraft: false,
          lesson: {
            id: 'lesson-1',
            slug: 'memoire',
            title: 'Comprendre la mémoire',
          },
          program: {
            id: 'program-1',
            slug: 'psychologie',
            title: 'Psychologie',
          },
          resources: [
            {
              id: 'resource-1',
              title: 'Chapitre sur la mémoire',
              url: 'https://example.com/memoire',
            },
          ],
          sourceId: assessmentId,
          sourceType: ReviewSourceType.CONCEPT_ASSESSMENT,
          status: ReviewStatus.PENDING,
        },
      ], nextCursor: null };
    },
  };
}

function patchRequest(body: unknown) {
  return {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'PATCH',
  };
}

describe('reviews API', () => {
  it('liste les révisions avec la notion et les ressources suggérées', async () => {
    const app = createReviewsApp({
      authentication: authenticationFor(userId),
      repository: createRepository(),
    });
    const response = await app.request('http://localhost/api/reviews');

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      reviews: [
        {
          assessmentTitle: 'Mini-évaluation — Mémoire',
          conceptTitle: 'Mémoire de travail',
          dueAt: '2026-08-03T08:00:00.000Z',
          resources: [{ title: 'Chapitre sur la mémoire' }],
          sourceId: assessmentId,
        },
      ],
    });
  });

  it('permet au propriétaire de marquer une révision comme terminée', async () => {
    const app = createReviewsApp({
      authentication: authenticationFor(userId),
      now: () => now,
      repository: createRepository(),
    });
    const response = await app.request(
      `http://localhost/api/reviews/${reviewId}`,
      patchRequest({ status: 'completed' }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      review: {
        completedAt: now.toISOString(),
        id: reviewId,
        status: 'COMPLETED',
      },
    });
  });

  it('ne révèle pas une révision à un autre utilisateur', async () => {
    const app = createReviewsApp({
      authentication: authenticationFor(otherUserId),
      repository: createRepository(),
    });
    const listed = await app.request('http://localhost/api/reviews');
    const updated = await app.request(
      `http://localhost/api/reviews/${reviewId}`,
      patchRequest({ status: 'completed' }),
    );

    expect(await listed.json()).toEqual({ nextCursor: null, reviews: [] });
    expect(updated.status).toBe(404);
  });

  it('refuse les requêtes anonymes et invalides', async () => {
    const anonymousApp = createReviewsApp({ repository: createRepository() });
    const app = createReviewsApp({
      authentication: authenticationFor(userId),
      repository: createRepository(),
    });

    expect(
      (await anonymousApp.request('http://localhost/api/reviews')).status,
    ).toBe(401);
    expect(
      (
        await app.request(
          'http://localhost/api/reviews/not-an-id',
          patchRequest({ status: 'completed' }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await app.request(
          `http://localhost/api/reviews/${reviewId}`,
          patchRequest({ status: 'pending' }),
        )
      ).status,
    ).toBe(400);
  });
});

describe('reviews persistence', () => {
  it('filtre toujours les révisions par utilisateur et propriétaire', async () => {
    const findMany = vi.fn(async () => []);
    const client = {
      conceptAssessment: { findMany: vi.fn(async () => []) },
      reviewItem: { findMany },
    } as unknown as PrismaClient;
    const repository = createPrismaReviewsRepository(client);

    await repository.listPending({
      canPreview: false,
      pageSize: 20,
      userId,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
        take: 21,
        where: expect.objectContaining({
          program: expect.objectContaining({
            OR: expect.arrayContaining([expect.objectContaining({ ownerId: userId })]),
          }),
          status: ReviewStatus.PENDING,
          userId,
        }),
      }),
    );
  });
});
