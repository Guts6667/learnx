import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import {
  ConceptProgressStatus,
  ResourceProgressStatus,
} from '../../../../generated/prisma/client.js';
import {
  calculateConceptStatus,
  isConceptValidated,
} from '../../../lib/concepts.js';
import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { requireCapability } from '../_lib/authorization.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import { learningProgramWhere } from '../_lib/program-access-policy.js';

interface ConceptReadModel {
  assessments: Array<{
    assessmentType: string;
    id: string;
    isRequired: boolean;
    position: number;
    questionCount: number | null;
    title: string | null;
  }>;
  description: string | null;
  id: string;
  isRequired: boolean;
  lessonId: string;
  masteryThreshold: number;
  position: number;
  progress: {
    bestScore: number | null;
    lastAttemptAt: Date | null;
    status: ConceptProgressStatus;
    validatedAt: Date | null;
  } | null;
  resources: Array<{
    author: string | null;
    description: string | null;
    id: string;
    isRequired: boolean;
    key: string | null;
    progressStatus: ResourceProgressStatus;
    title: string;
    type: string;
    url: string | null;
  }>;
  slug: string;
  title: string;
}

export interface ConceptRepository {
  findPublishedConceptForUser(
    conceptId: string,
    userId: string,
  ): Promise<ConceptReadModel | null>;
}

interface ConceptsAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  repository?: ConceptRepository;
}

const identifierSchema = z.string().uuid();

function invalidRequest(): ApiError {
  return new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
}

function notFound(): ApiError {
  return new ApiError('RESOURCE_NOT_FOUND', 'Resource not found.', 404);
}

function assertIdentifier(value: string): string {
  const parsedIdentifier = identifierSchema.safeParse(value);

  if (!parsedIdentifier.success) {
    throw invalidRequest();
  }

  return parsedIdentifier.data;
}

function createPrismaConceptRepository(): ConceptRepository {
  return {
    async findPublishedConceptForUser(conceptId, userId) {
      const { prisma } = await import('../../prisma.js');
      const concept = await prisma.concept.findFirst({
        where: {
          id: conceptId,
          lesson: {
            isPublished: true,
            module: {
              isPublished: true,
              stage: {
                isPublished: true,
                program: learningProgramWhere(userId),
              },
            },
          },
        },
        include: {
          assessments: { orderBy: { position: 'asc' } },
          progress: { where: { userId }, take: 1 },
          resources: {
            include: {
              resource: {
                include: {
                  progress: { where: { userId }, take: 1 },
                },
              },
            },
          },
        },
      });

      if (!concept) {
        return null;
      }

      return {
        assessments: concept.assessments,
        description: concept.description,
        id: concept.id,
        isRequired: concept.isRequired,
        lessonId: concept.lessonId,
        masteryThreshold: concept.masteryThreshold,
        position: concept.position,
        progress: concept.progress[0] ?? null,
        resources: concept.resources.map(({ resource }) => ({
          author: resource.author,
          description: resource.description,
          id: resource.id,
          isRequired: resource.isRequired,
          key: resource.key,
          progressStatus:
            resource.progress[0]?.status ?? ResourceProgressStatus.NOT_STARTED,
          title: resource.title,
          type: resource.type,
          url: resource.url,
        })),
        slug: concept.slug,
        title: concept.title,
      };
    },
  };
}

function getConceptStatus(concept: ConceptReadModel): ConceptProgressStatus {
  return calculateConceptStatus({
    hasResourceActivity: concept.resources.some(
      (resource) =>
        resource.progressStatus !== ResourceProgressStatus.NOT_STARTED,
    ),
    persistedStatus:
      concept.progress?.status ?? ConceptProgressStatus.NOT_STARTED,
  }) as ConceptProgressStatus;
}

function serializeConcept(concept: ConceptReadModel) {
  return {
    assessments: concept.assessments,
    description: concept.description,
    id: concept.id,
    isRequired: concept.isRequired,
    lessonId: concept.lessonId,
    masteryThreshold: concept.masteryThreshold,
    position: concept.position,
    resources: concept.resources.map((resource) => ({
      author: resource.author,
      description: resource.description,
      id: resource.id,
      isRequired: resource.isRequired,
      key: resource.key,
      title: resource.title,
      type: resource.type,
      url: resource.url,
    })),
    slug: concept.slug,
    title: concept.title,
  };
}

export function createConceptsApp(options: ConceptsAppOptions = {}) {
  const app = new Hono<AuthEnvironment>();
  const repository = options.repository ?? createPrismaConceptRepository();

  // Scoped to the routes this app serves, never `*`: a wildcard guard runs for
  // every request reaching the app and so authenticates whatever is mounted
  // after it (V4.5-186). A route missing from this list is unguarded, and
  // `route-guards.test.ts` names it.
  const guardedPaths = [
    '/api/concepts/:conceptId',
    '/api/concepts/:conceptId/progress',
  ] as const;

  for (const path of guardedPaths) {
    app.use(path, options.authentication ?? requireUser);
    app.use(path, requireCapability('learning.read'));
  }

  app.onError((error, context) => {
    if (error instanceof ApiError) {
      return context.json(toApiErrorBody(error), error.status);
    }

    return context.json(
      toApiErrorBody(
        new ApiError('INTERNAL_ERROR', 'An unexpected error occurred.', 500),
      ),
      500,
    );
  });

  app.get('/api/concepts/:conceptId', async (context) => {
    const conceptId = assertIdentifier(context.req.param('conceptId'));
    const concept = await repository.findPublishedConceptForUser(
      conceptId,
      context.get('user').id,
    );

    if (!concept) {
      throw notFound();
    }

    return context.json({ concept: serializeConcept(concept) });
  });

  app.get('/api/concepts/:conceptId/progress', async (context) => {
    const conceptId = assertIdentifier(context.req.param('conceptId'));
    const concept = await repository.findPublishedConceptForUser(
      conceptId,
      context.get('user').id,
    );

    if (!concept) {
      throw notFound();
    }

    const status = getConceptStatus(concept);

    return context.json({
      progress: {
        bestScore: concept.progress?.bestScore ?? null,
        conceptId: concept.id,
        isValidated: isConceptValidated(status),
        lastAttemptAt: concept.progress?.lastAttemptAt ?? null,
        status,
        validatedAt: concept.progress?.validatedAt ?? null,
      },
    });
  });

  return app;
}

export const conceptsApp = createConceptsApp();
