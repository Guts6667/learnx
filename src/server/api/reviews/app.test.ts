import type { MiddlewareHandler } from 'hono';

import {
  ProgramStatus,
  ReviewSourceType,
  ReviewStatus,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import type { AuthEnvironment } from '../_lib/auth.js';
import { ApiError } from '../_lib/errors.js';
import {
  encodeCursor,
  InvalidCursorError,
} from '../_lib/cursor-pagination.js';
import {
  createPrismaReviewsRepository,
  createReviewsApp,
  type ReviewsRepository,
} from './app.js';

const userId = '11111111-1111-4111-8111-111111111111';
const reviewId = '22222222-2222-4222-8222-222222222222';
const dueAt = new Date('2026-08-28T09:00:00.000Z');

function authentication(
  role: 'ADMIN' | 'USER' = 'USER',
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

function reviewRecord(overrides: Record<string, unknown> = {}) {
  return {
    dueAt,
    id: reviewId,
    intervalDays: 7,
    lesson: {
      id: 'lesson-id',
      isPublished: true,
      module: {
        isPublished: true,
        stage: { isPublished: true },
      },
      slug: 'lesson',
      title: 'Leçon',
    },
    program: {
      id: 'program-id',
      slug: 'program',
      status: ProgramStatus.ACTIVE,
      title: 'Programme',
    },
    sourceId: 'assessment-id',
    sourceType: ReviewSourceType.CONCEPT_ASSESSMENT,
    status: ReviewStatus.PENDING,
    ...overrides,
  };
}

function appRepository(
  overrides: Partial<ReviewsRepository> = {},
): ReviewsRepository {
  return {
    complete: vi.fn(async () => ({
      completedAt: dueAt,
      id: reviewId,
      status: ReviewStatus.COMPLETED,
    })),
    listPending: vi.fn(async () => ({ items: [], nextCursor: null })),
    ...overrides,
  };
}

describe('reviews Prisma repository', () => {
  it('returns null when a completion does not belong to the learner', async () => {
    const update = vi.fn();
    const transaction = {
      reviewItem: { findFirst: vi.fn(async () => null), update },
    };
    const client = {
      $transaction: vi.fn(async (operation: (value: typeof transaction) => unknown) =>
        operation(transaction),
      ),
    } as unknown as PrismaClient;
    const repository = createPrismaReviewsRepository(client);

    await expect(
      repository.complete(reviewId, userId, dueAt, false),
    ).resolves.toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    { persistedCompletedAt: null, expected: dueAt },
    {
      persistedCompletedAt: new Date('2026-08-28T10:00:00.000Z'),
      expected: new Date('2026-08-28T10:00:00.000Z'),
    },
  ])('completes owned reviews with persisted date $persistedCompletedAt', async ({
    expected,
    persistedCompletedAt,
  }) => {
    const transaction = {
      reviewItem: {
        findFirst: vi.fn(async () => ({ id: reviewId })),
        update: vi.fn(async () => ({
          completedAt: persistedCompletedAt,
          id: reviewId,
          status: ReviewStatus.COMPLETED,
        })),
      },
    };
    const client = {
      $transaction: vi.fn(async (operation: (value: typeof transaction) => unknown) =>
        operation(transaction),
      ),
    } as unknown as PrismaClient;
    const repository = createPrismaReviewsRepository(client);

    await expect(
      repository.complete(reviewId, userId, dueAt, true),
    ).resolves.toMatchObject({ completedAt: expected });
  });

  it('hydrates review metadata and computes every draft boundary', async () => {
    const reviews = [
      reviewRecord({
        id: '10000000-0000-4000-8000-000000000001',
        program: {
          id: 'program-draft',
          slug: 'draft',
          status: ProgramStatus.DRAFT,
          title: 'Draft',
        },
        sourceId: 'assessment-known',
      }),
      reviewRecord({
        id: '10000000-0000-4000-8000-000000000002',
        lesson: {
          ...reviewRecord().lesson,
          isPublished: false,
        },
        sourceId: 'assessment-missing',
      }),
      reviewRecord({
        id: '10000000-0000-4000-8000-000000000003',
        lesson: {
          ...reviewRecord().lesson,
          module: {
            ...reviewRecord().lesson.module,
            isPublished: false,
          },
        },
      }),
      reviewRecord({
        id: '10000000-0000-4000-8000-000000000004',
        lesson: {
          ...reviewRecord().lesson,
          module: {
            ...reviewRecord().lesson.module,
            stage: { isPublished: false },
          },
        },
      }),
      reviewRecord({ id: '10000000-0000-4000-8000-000000000005' }),
    ];
    const findMany = vi.fn(async () => reviews);
    const assessmentFindMany = vi.fn(async () => [
      {
        concept: {
          resources: [
            {
              resource: {
                id: 'resource-id',
                title: 'Ressource',
                url: 'https://example.com',
              },
            },
          ],
          title: 'Concept',
        },
        id: 'assessment-known',
        title: 'Évaluation',
      },
    ]);
    const repository = createPrismaReviewsRepository({
      conceptAssessment: { findMany: assessmentFindMany },
      reviewItem: { findMany },
    } as unknown as PrismaClient);

    const page = await repository.listPending({
      canPreview: true,
      pageSize: 10,
      userId,
    });

    expect(page.items.map((review) => review.isDraft)).toEqual([
      true,
      true,
      true,
      true,
      false,
    ]);
    expect(page.items[0]).toMatchObject({
      assessmentTitle: 'Évaluation',
      conceptTitle: 'Concept',
      resources: [{ id: 'resource-id' }],
    });
    expect(page.items[1]).toMatchObject({
      assessmentTitle: null,
      conceptTitle: null,
      resources: [],
    });
    expect(assessmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: {
            in: [
              'assessment-known',
              'assessment-missing',
              'assessment-id',
              'assessment-id',
              'assessment-id',
            ],
          },
          concept: expect.any(Object),
        },
      }),
    );
  });

  it('applies a valid cursor and rejects a cursor with an invalid date', async () => {
    const findMany = vi.fn(async () => []);
    const repository = createPrismaReviewsRepository({
      conceptAssessment: { findMany: vi.fn(async () => []) },
      reviewItem: { findMany },
    } as unknown as PrismaClient);
    const context = `${userId}:false`;
    const cursor = encodeCursor('reviews', context, {
      id: reviewId,
      value: dueAt.toISOString(),
    });

    await repository.listPending({
      canPreview: false,
      cursor,
      pageSize: 5,
      userId,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      }),
    );

    const invalidDateCursor = encodeCursor('reviews', context, {
      id: reviewId,
      value: 'not-a-date',
    });
    await expect(
      repository.listPending({
        canPreview: false,
        cursor: invalidDateCursor,
        pageSize: 5,
        userId,
      }),
    ).rejects.toBeInstanceOf(InvalidCursorError);
  });
});

describe('reviews API contracts', () => {
  it('serializes pages and completed reviews', async () => {
    const repository = appRepository({
      listPending: vi.fn(async () => ({
        items: [
          {
            assessmentTitle: null,
            conceptTitle: null,
            dueAt,
            id: reviewId,
            intervalDays: 7,
            isDraft: false,
            lesson: { id: 'lesson-id', slug: 'lesson', title: 'Leçon' },
            program: { id: 'program-id', slug: 'program', title: 'Programme' },
            resources: [],
            sourceId: 'assessment-id',
            sourceType: ReviewSourceType.CONCEPT_ASSESSMENT,
            status: ReviewStatus.PENDING,
          },
        ],
        nextCursor: 'next',
      })),
    });
    const app = createReviewsApp({
      authentication: authentication(),
      now: () => dueAt,
      repository,
    });

    const listResponse = await app.request('/api/reviews?pageSize=5');
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      nextCursor: 'next',
      reviews: [{ dueAt: dueAt.toISOString() }],
    });

    const completeResponse = await app.request(`/api/reviews/${reviewId}`, {
      body: JSON.stringify({ status: 'completed' }),
      headers: { 'content-type': 'application/json' },
      method: 'PATCH',
    });
    expect(completeResponse.status).toBe(200);
    await expect(completeResponse.json()).resolves.toMatchObject({
      review: { completedAt: dueAt.toISOString() },
    });
  });

  it.each([
    {
      expectedStatus: 400,
      repositoryError: new InvalidCursorError(),
    },
    {
      expectedStatus: 409,
      repositoryError: new ApiError(
        'ACCOUNT_STATE_CONFLICT',
        'Conflict.',
        409,
      ),
    },
    {
      expectedStatus: 500,
      repositoryError: new Error('database unavailable'),
    },
  ])('normalizes repository errors as $expectedStatus', async ({
    expectedStatus,
    repositoryError,
  }) => {
    const app = createReviewsApp({
      authentication: authentication(),
      repository: appRepository({
        listPending: vi.fn().mockRejectedValue(repositoryError),
      }),
    });

    const response = await app.request('/api/reviews');

    expect(response.status).toBe(expectedStatus);
  });

  it.each([
    {
      body: '{',
      path: `/api/reviews/${reviewId}`,
    },
    {
      body: JSON.stringify({ status: 'pending' }),
      path: `/api/reviews/${reviewId}`,
    },
    {
      body: JSON.stringify({ status: 'completed' }),
      path: '/api/reviews/not-a-uuid',
    },
  ])('rejects malformed completion requests %#', async ({ body, path }) => {
    const repository = appRepository();
    const app = createReviewsApp({
      authentication: authentication(),
      repository,
    });

    const response = await app.request(path, {
      body,
      headers: { 'content-type': 'application/json' },
      method: 'PATCH',
    });

    expect(response.status).toBe(400);
    expect(repository.complete).not.toHaveBeenCalled();
  });

  it('returns not found when the atomic completion matches no review', async () => {
    const app = createReviewsApp({
      authentication: authentication(),
      repository: appRepository({ complete: vi.fn(async () => null) }),
    });

    const response = await app.request(`/api/reviews/${reviewId}`, {
      body: JSON.stringify({ status: 'completed' }),
      headers: { 'content-type': 'application/json' },
      method: 'PATCH',
    });

    expect(response.status).toBe(404);
  });

  it('rejects invalid pagination before repository access', async () => {
    const repository = appRepository();
    const app = createReviewsApp({
      authentication: authentication(),
      repository,
    });

    const response = await app.request('/api/reviews?pageSize=0');

    expect(response.status).toBe(400);
    expect(repository.listPending).not.toHaveBeenCalled();
  });
});
