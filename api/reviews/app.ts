import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import {
  ProgramStatus,
  ReviewSourceType,
  ReviewStatus,
  type PrismaClient,
} from '../../generated/prisma/client.js';
import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';

interface ReviewResource {
  id: string;
  title: string;
  url: string | null;
}

interface ReviewRecord {
  assessmentTitle: string | null;
  conceptTitle: string | null;
  dueAt: Date;
  id: string;
  intervalDays: number;
  isDraft: boolean;
  lesson: { id: string; slug: string; title: string };
  program: { id: string; slug: string; title: string };
  resources: ReviewResource[];
  sourceId: string;
  sourceType: ReviewSourceType;
  status: ReviewStatus;
}

interface CompletedReview {
  completedAt: Date;
  id: string;
  status: ReviewStatus;
}

export interface ReviewsRepository {
  complete(
    reviewId: string,
    userId: string,
    completedAt: Date,
  ): Promise<CompletedReview | null>;
  listPending(userId: string): Promise<ReviewRecord[]>;
}

interface ReviewsAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  now?: () => Date;
  repository?: ReviewsRepository;
}

const identifierSchema = z.uuid();
const updateSchema = z.object({ status: z.literal('completed') });

function invalidRequest(): ApiError {
  return new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
}

function notFound(): ApiError {
  return new ApiError('RESOURCE_NOT_FOUND', 'Resource not found.', 404);
}

async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw invalidRequest();
  }
}

function serializeReview(review: ReviewRecord) {
  return { ...review, dueAt: review.dueAt.toISOString() };
}

export function createPrismaReviewsRepository(
  client: PrismaClient,
): ReviewsRepository {
  return {
    async complete(reviewId, userId, completedAt) {
      const ownedReview = await client.reviewItem.findFirst({
        where: { id: reviewId, userId, program: { ownerId: userId } },
        select: { id: true },
      });

      if (!ownedReview) return null;

      const updatedReview = await client.reviewItem.update({
        where: { id: ownedReview.id },
        data: { completedAt, status: ReviewStatus.COMPLETED },
        select: { completedAt: true, id: true, status: true },
      });

      return {
        completedAt: updatedReview.completedAt ?? completedAt,
        id: updatedReview.id,
        status: updatedReview.status,
      };
    },
    async listPending(userId) {
      const reviews = await client.reviewItem.findMany({
        where: {
          status: ReviewStatus.PENDING,
          userId,
          program: {
            ownerId: userId,
            status: { in: [ProgramStatus.ACTIVE, ProgramStatus.DRAFT] },
          },
        },
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
        select: {
          dueAt: true,
          id: true,
          intervalDays: true,
          lesson: {
            select: {
              id: true,
              isPublished: true,
              module: {
                select: {
                  isPublished: true,
                  stage: { select: { isPublished: true } },
                },
              },
              slug: true,
              title: true,
            },
          },
          program: {
            select: { id: true, slug: true, status: true, title: true },
          },
          sourceId: true,
          sourceType: true,
          status: true,
        },
      });
      const assessmentIds = reviews
        .filter(
          (review) =>
            review.sourceType === ReviewSourceType.CONCEPT_ASSESSMENT,
        )
        .map((review) => review.sourceId);
      const assessments = await client.conceptAssessment.findMany({
        where: {
          id: { in: assessmentIds },
          concept: {
            lesson: {
              module: { stage: { program: { ownerId: userId } } },
            },
          },
        },
        select: {
          concept: {
            select: {
              resources: {
                orderBy: { resource: { position: 'asc' } },
                select: {
                  resource: { select: { id: true, title: true, url: true } },
                },
              },
              title: true,
            },
          },
          id: true,
          title: true,
        },
      });
      const assessmentById = new Map(
        assessments.map((assessment) => [assessment.id, assessment]),
      );

      return reviews.map((review) => {
        const assessment = assessmentById.get(review.sourceId);

        return {
          assessmentTitle: assessment?.title ?? null,
          conceptTitle: assessment?.concept.title ?? null,
          dueAt: review.dueAt,
          id: review.id,
          intervalDays: review.intervalDays,
          isDraft:
            review.program.status === ProgramStatus.DRAFT ||
            !review.lesson.isPublished ||
            !review.lesson.module.isPublished ||
            !review.lesson.module.stage.isPublished,
          lesson: {
            id: review.lesson.id,
            slug: review.lesson.slug,
            title: review.lesson.title,
          },
          program: {
            id: review.program.id,
            slug: review.program.slug,
            title: review.program.title,
          },
          resources:
            assessment?.concept.resources.map(({ resource }) => resource) ??
            [],
          sourceId: review.sourceId,
          sourceType: review.sourceType,
          status: review.status,
        };
      });
    },
  };
}

async function getPrismaRepository(): Promise<ReviewsRepository> {
  const { prisma } = await import('../../src/server/prisma.js');

  return createPrismaReviewsRepository(prisma);
}

export function createReviewsApp(options: ReviewsAppOptions = {}) {
  const app = new Hono<AuthEnvironment>();
  const now = options.now ?? (() => new Date());
  let defaultRepository: ReviewsRepository | undefined;
  const getRepository = async () => {
    if (options.repository) return options.repository;
    defaultRepository ??= await getPrismaRepository();
    return defaultRepository;
  };

  app.use('*', options.authentication ?? requireUser);
  app.onError((error, context) => {
    if (error instanceof ApiError) {
      return context.json(toApiErrorBody(error), error.status);
    }

    console.error(error);
    return context.json(
      toApiErrorBody(
        new ApiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500),
      ),
      500,
    );
  });

  app.get('/api/reviews', async (context) => {
    const reviews = await (
      await getRepository()
    ).listPending(context.get('user').id);

    return context.json({ reviews: reviews.map(serializeReview) });
  });

  app.patch('/api/reviews/:reviewId', async (context) => {
    const reviewId = identifierSchema.safeParse(context.req.param('reviewId'));
    const input = updateSchema.safeParse(await parseJson(context.req.raw));

    if (!reviewId.success || !input.success) throw invalidRequest();

    const review = await (
      await getRepository()
    ).complete(reviewId.data, context.get('user').id, now());

    if (!review) throw notFound();

    return context.json({
      review: {
        ...review,
        completedAt: review.completedAt.toISOString(),
      },
    });
  });

  return app;
}

export const reviewsApp = createReviewsApp();
