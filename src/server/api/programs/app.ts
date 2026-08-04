import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import {
  LessonProgressStatus,
  ProgramStatus,
  StageProgressStatus,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import {
  getProgramTimeline,
  getStageTimeline,
} from '../_lib/timeline-progress.js';
import { getStageValidation } from '../_lib/stage-validation.js';

async function getPrismaClient(): Promise<PrismaClient> {
  const { prisma } = await import('../../prisma.js');

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

const lessonSummarySelect = {
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

function getLessonSummarySelect(userId: string) {
  return {
    ...lessonSummarySelect,
    _count: {
      select: {
        concepts: true,
        exercises: { where: { isCanonical: true } },
        quizzes: true,
        resources: true,
        tasks: { where: { isCanonical: true } },
      },
    },
    progress: {
      where: { userId },
      take: 1,
      select: { percent: true, status: true },
    },
  } as const;
}

function getModuleInclude(preview: boolean, userId: string) {
  return {
    lessons: {
      where: getPublicationFilter(preview),
      orderBy: { position: 'asc' as const },
      select: getLessonSummarySelect(userId),
    },
  };
}

function getStageInclude(preview: boolean, userId: string) {
  return {
    modules: {
      where: getPublicationFilter(preview),
      orderBy: { position: 'asc' as const },
      include: getModuleInclude(preview, userId),
    },
    progress: {
      where: { userId },
      take: 1,
      select: { status: true },
    },
  };
}

interface LessonSummaryRecord {
  _count: {
    concepts: number;
    exercises: number;
    quizzes: number;
    resources: number;
    tasks: number;
  };
  progress: Array<{ percent: number; status: LessonProgressStatus }>;
}

function serializeLessonSummary<T extends LessonSummaryRecord>(
  lesson: T,
  isLocked = false,
) {
  const { _count, progress, ...summary } = lesson;
  return {
    ...summary,
    activityCounts: _count,
    isLocked,
    progress: progress[0] ?? {
      percent: 0,
      status: LessonProgressStatus.AVAILABLE,
    },
  };
}

function serializeModules<
  T extends { lessons: LessonSummaryRecord[] },
>(modules: T[], isLocked = false) {
  return modules.map((module) => ({
    ...module,
    lessons: module.lessons.map((lesson) =>
      serializeLessonSummary(lesson, isLocked),
    ),
  }));
}

function isStageLocked(stage: { progress?: Array<{ status: string }> }): boolean {
  return stage.progress?.[0]?.status === StageProgressStatus.LOCKED;
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
          include: getStageInclude(preview, user.id),
        },
      },
    });

    if (!program) {
      throw notFound();
    }

    const [timeline, stages] = await Promise.all([
      readProgramTimeline(prisma, program.id, user.id),
      Promise.all(
        program.stages.map(async (stage) => {
          const { progress, ...stageSummary } = stage;
          void progress;
          return {
            ...stageSummary,
            modules: serializeModules(stage.modules, isStageLocked(stage)),
            timeline: await readStageTimeline(prisma, stage.id, user.id),
          };
        }),
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
      include: getStageInclude(preview, user.id),
    });

    if (!stage) {
      throw notFound();
    }

    const [timeline, validation] = await Promise.all([
      readStageTimeline(prisma, stage.id, user.id),
      readStageValidation(prisma, stage.id, user.id, { preview }),
    ]);

    const { progress, ...stageSummary } = stage;
    void progress;
    return context.json({
      stage: {
        ...stageSummary,
        modules: serializeModules(stage.modules, isStageLocked(stage)),
        timeline,
        validation,
      },
    });
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
      include: {
        ...getModuleInclude(preview, user.id),
        stage: {
          select: {
            id: true,
            isPublished: true,
            slug: true,
            title: true,
            program: { select: { id: true, slug: true, title: true } },
            progress: {
              where: { userId: user.id },
              take: 1,
              select: { status: true },
            },
          },
        },
      },
    });

    if (modules.length === 0) {
      throw notFound();
    }

    if (modules.length > 1) {
      throw ambiguousResource();
    }

    const moduleIsLocked = isStageLocked(modules[0].stage);
    const { progress, ...stageContext } = modules[0].stage;
    void progress;
    return context.json({
      module: {
        ...modules[0],
        lessons: modules[0].lessons.map((lesson) =>
          serializeLessonSummary(lesson, moduleIsLocked),
        ),
        stage: stageContext,
      },
    });
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
            assessments: {
              orderBy: { position: 'asc' },
              select: {
                id: true,
                isRequired: true,
                position: true,
                questionCount: true,
                title: true,
              },
            },
            id: true,
            isRequired: true,
            masteryThreshold: true,
            position: true,
            slug: true,
            title: true,
          },
        },
        contentBlocks: { orderBy: { position: 'asc' } },
        exercises: {
          where: { isCanonical: true },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            instructions: true,
            isRequired: true,
            position: true,
            rubric: true,
            title: true,
          },
        },
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
        tasks: {
          where: { isCanonical: true },
          orderBy: { position: 'asc' },
          include: {
            resources: {
              orderBy: { resource: { position: 'asc' } },
              include: { resource: true },
            },
          },
        },
        module: {
          select: {
            id: true,
            isPublished: true,
            lessons: {
              where: getPublicationFilter(preview),
              orderBy: { position: 'asc' },
              select: lessonSummarySelect,
            },
            slug: true,
            title: true,
            stage: {
              select: {
                id: true,
                isPublished: true,
                slug: true,
                title: true,
                program: { select: { id: true, slug: true, title: true } },
                progress: {
                  where: { userId: user.id },
                  take: 1,
                  select: { status: true },
                },
              },
            },
          },
        },
      },
    });

    if (lessons.length === 0) {
      throw notFound();
    }

    if (lessons.length > 1) {
      throw ambiguousResource();
    }

    const lesson = lessons[0];
    const currentLessonIndex = lesson.module.lessons.findIndex(
      (candidate) => candidate.id === lesson.id,
    );
    const previousLesson = lesson.module.lessons[currentLessonIndex - 1] ?? null;
    const nextLesson = lesson.module.lessons[currentLessonIndex + 1] ?? null;
    const lessonIsLocked = isStageLocked(lesson.module.stage);
    const { progress, ...stageContext } = lesson.module.stage;
    const { lessons: siblingLessons, ...moduleWithoutLessons } = lesson.module;
    const moduleContext = { ...moduleWithoutLessons, stage: stageContext };
    void siblingLessons;
    void progress;

    return context.json({
      lesson: {
        ...lesson,
        isLocked: lessonIsLocked,
        module: moduleContext,
        navigation: {
          nextLesson: nextLesson ? { ...nextLesson, isLocked: lessonIsLocked } : null,
          previousLesson: previousLesson
            ? { ...previousLesson, isLocked: lessonIsLocked }
            : null,
        },
        quizzes: lesson.quizzes.map(({ _count, ...quiz }) => ({
          ...quiz,
          questionCount: _count.questions,
        })),
        tasks: lesson.tasks.map(({ resources, ...task }) => ({
          ...task,
          resources: resources.map((link) => link.resource),
        })),
      },
    });
  });

  return app;
}

export const curriculumApp = createCurriculumApp();
