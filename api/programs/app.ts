import { Hono } from 'hono';

import { ProgramStatus } from '../../generated/prisma/client.js';
import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import {
  getProgramTimeline,
  getStageTimeline,
} from '../_lib/timeline-progress.js';

async function getPrismaClient() {
  const { prisma } = await import('../../src/server/prisma.js');

  return prisma;
}

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

const publishedLessonSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  objectives: true,
  prerequisites: true,
  estimatedMinutes: true,
  position: true,
} as const;

const publishedModuleInclude = {
  lessons: {
    where: { isPublished: true },
    orderBy: { position: 'asc' },
    select: publishedLessonSelect,
  },
} as const;

const publishedStageInclude = {
  modules: {
    where: { isPublished: true },
    orderBy: { position: 'asc' },
    include: publishedModuleInclude,
  },
} as const;

export const curriculumApp = new Hono<AuthEnvironment>();

curriculumApp.use('*', requireUser);

curriculumApp.onError((error, context) => {
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

curriculumApp.get('/api/programs', async (context) => {
  const prisma = await getPrismaClient();
  const user = context.get('user');
  const programs = await prisma.program.findMany({
    where: { ownerId: user.id, status: ProgramStatus.ACTIVE },
    orderBy: { position: 'asc' },
    include: {
      stages: {
        where: { isPublished: true },
        orderBy: { position: 'asc' },
        select: { id: true, title: true, slug: true, position: true },
      },
    },
  });
  const programsWithTimeline = await Promise.all(
    programs.map(async (program) => ({
      ...program,
      timeline: await getProgramTimeline(prisma, program.id, user.id),
    })),
  );

  return context.json({ programs: programsWithTimeline });
});

curriculumApp.get('/api/programs/:programSlug', async (context) => {
  const prisma = await getPrismaClient();
  const user = context.get('user');
  const program = await prisma.program.findFirst({
    where: {
      ownerId: user.id,
      slug: context.req.param('programSlug'),
      status: ProgramStatus.ACTIVE,
    },
    include: {
      stages: {
        where: { isPublished: true },
        orderBy: { position: 'asc' },
        include: publishedStageInclude,
      },
    },
  });

  if (!program) {
    throw notFound();
  }

  const [timeline, stages] = await Promise.all([
    getProgramTimeline(prisma, program.id, user.id),
    Promise.all(
      program.stages.map(async (stage) => ({
        ...stage,
        timeline: await getStageTimeline(prisma, stage.id, user.id),
      })),
    ),
  ]);

  return context.json({ program: { ...program, stages, timeline } });
});

curriculumApp.get(
  '/api/programs/:programSlug/stages/:stageSlug',
  async (context) => {
    const prisma = await getPrismaClient();
    const user = context.get('user');
    const stage = await prisma.stage.findFirst({
      where: {
        slug: context.req.param('stageSlug'),
        isPublished: true,
        program: {
          ownerId: user.id,
          slug: context.req.param('programSlug'),
          status: ProgramStatus.ACTIVE,
        },
      },
      include: publishedStageInclude,
    });

    if (!stage) {
      throw notFound();
    }

    const timeline = await getStageTimeline(prisma, stage.id, user.id);

    return context.json({ stage: { ...stage, timeline } });
  },
);

curriculumApp.get('/api/modules/:moduleSlug', async (context) => {
  const prisma = await getPrismaClient();
  const user = context.get('user');
  const modules = await prisma.module.findMany({
    where: {
      slug: context.req.param('moduleSlug'),
      isPublished: true,
      stage: {
        isPublished: true,
        program: { ownerId: user.id, status: ProgramStatus.ACTIVE },
      },
    },
    take: 2,
    include: publishedModuleInclude,
  });

  if (modules.length === 0) {
    throw notFound();
  }

  if (modules.length > 1) {
    throw ambiguousResource();
  }

  return context.json({ module: modules[0] });
});

curriculumApp.get('/api/lessons/:lessonSlug', async (context) => {
  const prisma = await getPrismaClient();
  const user = context.get('user');
  const lessons = await prisma.lesson.findMany({
    where: {
      slug: context.req.param('lessonSlug'),
      isPublished: true,
      module: {
        isPublished: true,
        stage: {
          isPublished: true,
          program: { ownerId: user.id, status: ProgramStatus.ACTIVE },
        },
      },
    },
    take: 2,
    include: {
      contentBlocks: { orderBy: { position: 'asc' } },
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

  return context.json({ lesson: lessons[0] });
});
