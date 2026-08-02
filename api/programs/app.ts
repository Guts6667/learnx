import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import {
  ProgramStatus,
  type PrismaClient,
} from '../../generated/prisma/client.js';
import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import {
  getProgramTimeline,
  getStageTimeline,
} from '../_lib/timeline-progress.js';
import { getStageValidation } from '../_lib/stage-validation.js';

async function getPrismaClient(): Promise<PrismaClient> {
  const { prisma } = await import('../../src/server/prisma.js');

  return prisma;
}

interface CurriculumAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  getClient?: () => Promise<PrismaClient>;
  readProgramTimeline?: typeof getProgramTimeline;
  readStageTimeline?: typeof getStageTimeline;
  readStageValidation?: typeof getStageValidation;
}

const previewQuerySchema = z.object({
  preview: z.enum(['true']).optional(),
});

function notFound(): ApiError {
  return new ApiError('RESOURCE_NOT_FOUND', 'Resource not found.', 404);
}

function ambiguousResource(): ApiError {
  return new ApiError(
    'AMBIGUOUS_RESOURCE',
    'This slug is not unique. Use the parent resource route instead.',
    409,
  );
}

function invalidRequest(): ApiError {
  return new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
}

function isPreviewRequest(url: string): boolean {
  const query = previewQuerySchema.safeParse(
    Object.fromEntries(new URL(url).searchParams),
  );

  if (!query.success) {
    throw invalidRequest();
  }

  return query.data.preview === 'true';
}

function getProgramStatusFilter(preview: boolean) {
  return preview
    ? { in: [ProgramStatus.ACTIVE, ProgramStatus.DRAFT] }
    : ProgramStatus.ACTIVE;
}

function getPublicationFilter(preview: boolean) {
  return preview ? {} : { isPublished: true };
}

const publishedLessonSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  objectives: true,
  prerequisites: true,
  estimatedMinutes: true,
  isPublished: true,
  position: true,
} as const;

function getModuleInclude(preview: boolean) {
  return {
    lessons: {
      where: getPublicationFilter(preview),
      orderBy: { position: 'asc' as const },
      select: publishedLessonSelect,
    },
  };
}

function getStageInclude(preview: boolean) {
  return {
    modules: {
      where: getPublicationFilter(preview),
      orderBy: { position: 'asc' as const },
      include: getModuleInclude(preview),
    },
  };
}

export function createCurriculumApp(options: CurriculumAppOptions = {}) {
  const app = new Hono<AuthEnvironment>();
  const getClient = options.getClient ?? getPrismaClient;
  const readProgramTimeline = options.readProgramTimeline ?? getProgramTimeline;
  const readStageTimeline = options.readStageTimeline ?? getStageTimeline;
  const readStageValidation = options.readStageValidation ?? getStageValidation;

  app.use('*', options.authentication ?? requireUser);

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

  app.get('/api/programs', async (context) => {
    const preview = isPreviewRequest(context.req.url);
    const prisma = await getClient();
    const user = context.get('user');
    const programs = await prisma.program.findMany({
      where: {
        ownerId: user.id,
        status: getProgramStatusFilter(preview),
      },
      orderBy: { position: 'asc' },
      include: {
        stages: {
          where: getPublicationFilter(preview),
          orderBy: { position: 'asc' },
          select: {
            id: true,
            isPublished: true,
            position: true,
            slug: true,
            title: true,
          },
        },
      },
    });
    const programsWithTimeline = await Promise.all(
      programs.map(async (program) => ({
        ...program,
        timeline: await readProgramTimeline(prisma, program.id, user.id),
      })),
    );

    return context.json({ programs: programsWithTimeline });
  });

  app.get('/api/programs/:programSlug', async (context) => {
    const preview = isPreviewRequest(context.req.url);
    const prisma = await getClient();
    const user = context.get('user');
    const program = await prisma.program.findFirst({
      where: {
        ownerId: user.id,
        slug: context.req.param('programSlug'),
        status: getProgramStatusFilter(preview),
      },
      include: {
        stages: {
          where: getPublicationFilter(preview),
          orderBy: { position: 'asc' },
          include: getStageInclude(preview),
        },
      },
    });

    if (!program) {
      throw notFound();
    }

    const [timeline, stages] = await Promise.all([
      readProgramTimeline(prisma, program.id, user.id),
      Promise.all(
        program.stages.map(async (stage) => ({
          ...stage,
          timeline: await readStageTimeline(prisma, stage.id, user.id),
        })),
      ),
    ]);

    return context.json({ program: { ...program, stages, timeline } });
  });

  app.get('/api/programs/:programSlug/stages/:stageSlug', async (context) => {
    const preview = isPreviewRequest(context.req.url);
    const prisma = await getClient();
    const user = context.get('user');
    const stage = await prisma.stage.findFirst({
      where: {
        slug: context.req.param('stageSlug'),
        ...getPublicationFilter(preview),
        program: {
          ownerId: user.id,
          slug: context.req.param('programSlug'),
          status: getProgramStatusFilter(preview),
        },
      },
      include: getStageInclude(preview),
    });

    if (!stage) {
      throw notFound();
    }

    const [timeline, validation] = await Promise.all([
      readStageTimeline(prisma, stage.id, user.id),
      readStageValidation(prisma, stage.id, user.id, { preview }),
    ]);

    return context.json({ stage: { ...stage, timeline, validation } });
  });

  app.get('/api/modules/:moduleSlug', async (context) => {
    const preview = isPreviewRequest(context.req.url);
    const prisma = await getClient();
    const user = context.get('user');
    const modules = await prisma.module.findMany({
      where: {
        slug: context.req.param('moduleSlug'),
        ...getPublicationFilter(preview),
        stage: {
          ...getPublicationFilter(preview),
          program: {
            ownerId: user.id,
            status: getProgramStatusFilter(preview),
          },
        },
      },
      take: 2,
      include: getModuleInclude(preview),
    });

    if (modules.length === 0) {
      throw notFound();
    }

    if (modules.length > 1) {
      throw ambiguousResource();
    }

    return context.json({ module: modules[0] });
  });

  app.get('/api/lessons/:lessonSlug', async (context) => {
    const preview = isPreviewRequest(context.req.url);
    const prisma = await getClient();
    const user = context.get('user');
    const lessons = await prisma.lesson.findMany({
      where: {
        slug: context.req.param('lessonSlug'),
        ...getPublicationFilter(preview),
        module: {
          ...getPublicationFilter(preview),
          stage: {
            ...getPublicationFilter(preview),
            program: {
              ownerId: user.id,
              status: getProgramStatusFilter(preview),
            },
          },
        },
      },
      take: 2,
      include: {
        concepts: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            isRequired: true,
            masteryThreshold: true,
            position: true,
            slug: true,
            title: true,
          },
        },
        contentBlocks: { orderBy: { position: 'asc' } },
        quizzes: {
          orderBy: { position: 'asc' },
          select: {
            _count: { select: { questions: true } },
            description: true,
            id: true,
            isRequired: true,
            passingScore: true,
            position: true,
            title: true,
          },
        },
        resources: { orderBy: { position: 'asc' } },
        tasks: { orderBy: { position: 'asc' } },
      },
    });

    if (lessons.length === 0) {
      throw notFound();
    }

    if (lessons.length > 1) {
      throw ambiguousResource();
    }

    const lesson = lessons[0];

    return context.json({
      lesson: {
        ...lesson,
        quizzes: lesson.quizzes.map(({ _count, ...quiz }) => ({
          ...quiz,
          questionCount: _count.questions,
        })),
      },
    });
  });

  return app;
}

export const curriculumApp = createCurriculumApp();
