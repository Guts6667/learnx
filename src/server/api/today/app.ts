import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import {
  ConceptProgressStatus,
  LessonProgressStatus,
  ProgramStatus,
  ReviewStatus,
  StageAssessmentSubmissionStatus,
  StageProgressStatus,
  TaskCompletionStatus,
  type PrismaClient,
} from '../../../../generated/prisma/client.js';
import {
  classifyReviewDate,
  selectDailyRecommendation,
  type RecommendationCandidate,
} from '../../../lib/recommendation.js';
import { requireUser, type AuthEnvironment } from '../_lib/auth.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';

interface ProgramRecord {
  id: string;
  position: number;
  progress: Array<{ lastViewedAt: Date; percent: number }>;
  slug: string;
  title: string;
}

interface ReviewRecord {
  dueAt: Date;
  id: string;
  lesson: {
    estimatedMinutes: number | null;
    slug: string;
    title: string;
    module: { title: string; stage: { title: string } };
  };
  program: { id: string; slug: string; title: string };
}

interface LessonRecord {
  concepts: Array<{
    assessments: Array<{ questions: Array<{ id: string }> }>;
    progress: Array<{ status: string }>;
    title: string;
  }>;
  estimatedMinutes: number | null;
  id: string;
  module: {
    position: number;
    slug: string;
    stage: {
      id: string;
      position: number;
      program: { id: string; position: number; slug: string; title: string };
      progress: Array<{ status: string }>;
      slug: string;
      title: string;
    };
    title: string;
  };
  position: number;
  progress: Array<{
    lastViewedAt: Date | null;
    status: string;
  }>;
  slug: string;
  tasks: Array<{
    completions: Array<{ status: string }>;
    id: string;
    title: string;
  }>;
  title: string;
}

interface FinalAssessmentRecord {
  id: string;
  stage: {
    id: string;
    modules: Array<{
      lessons: Array<{
        concepts: Array<{ progress: Array<{ status: string }> }>;
        tasks: Array<{ completions: Array<{ status: string }> }>;
      }>;
    }>;
    position: number;
    program: { id: string; position: number; slug: string; title: string };
    progress: Array<{ status: string }>;
    slug: string;
    title: string;
  };
  submissions: Array<{ status: string }>;
  title: string;
}

export interface TodayRepository {
  listActivePrograms(userId: string): Promise<ProgramRecord[]>;
  listFinalAssessments(userId: string): Promise<FinalAssessmentRecord[]>;
  listLessons(userId: string): Promise<LessonRecord[]>;
  listPendingReviews(userId: string): Promise<ReviewRecord[]>;
}

interface TodayAppOptions {
  authentication?: MiddlewareHandler<AuthEnvironment>;
  now?: () => Date;
  repository?: TodayRepository;
}

const querySchema = z.object({
  timeZone: z.string().trim().min(1).max(100).default('UTC'),
});

async function getPrismaClient(): Promise<PrismaClient> {
  const { prisma } = await import('../../prisma.js');

  return prisma;
}

export function createPrismaTodayRepository(
  client: PrismaClient,
): TodayRepository {
  return {
    async listActivePrograms(userId) {
      return client.program.findMany({
        where: { ownerId: userId, status: ProgramStatus.ACTIVE },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          position: true,
          progress: {
            where: { userId },
            take: 1,
            select: { lastViewedAt: true, percent: true },
          },
          slug: true,
          title: true,
        },
      });
    },
    async listFinalAssessments(userId) {
      return client.stageAssessment.findMany({
        where: {
          isRequired: true,
          stage: {
            isPublished: true,
            program: { ownerId: userId, status: ProgramStatus.ACTIVE },
          },
        },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          stage: {
            select: {
              id: true,
              modules: {
                where: { isPublished: true },
                select: {
                  lessons: {
                    where: { isPublished: true },
                    select: {
                      concepts: {
                        where: { isRequired: true },
                        select: {
                          progress: {
                            where: { userId },
                            take: 1,
                            select: { status: true },
                          },
                        },
                      },
                      tasks: {
                        where: { isRequired: true },
                        select: {
                          completions: {
                            where: { userId },
                            take: 1,
                            select: { status: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
              position: true,
              program: {
                select: {
                  id: true,
                  position: true,
                  slug: true,
                  title: true,
                },
              },
              progress: {
                where: { userId },
                take: 1,
                select: { status: true },
              },
              slug: true,
              title: true,
            },
          },
          submissions: {
            where: { userId },
            take: 1,
            select: { status: true },
          },
          title: true,
        },
      });
    },
    async listLessons(userId) {
      return client.lesson.findMany({
        where: {
          isPublished: true,
          module: {
            isPublished: true,
            stage: {
              isPublished: true,
              program: { ownerId: userId, status: ProgramStatus.ACTIVE },
            },
          },
        },
        orderBy: [
          { module: { stage: { program: { position: 'asc' } } } },
          { module: { stage: { position: 'asc' } } },
          { module: { position: 'asc' } },
          { position: 'asc' },
        ],
        select: {
          concepts: {
            where: { isRequired: true },
            orderBy: { position: 'asc' },
            select: {
              assessments: {
                where: { isRequired: true },
                select: {
                  questions: { take: 1, select: { id: true } },
                },
              },
              progress: {
                where: { userId },
                take: 1,
                select: { status: true },
              },
              title: true,
            },
          },
          estimatedMinutes: true,
          id: true,
          module: {
            select: {
              position: true,
              slug: true,
              stage: {
                select: {
                  id: true,
                  position: true,
                  program: {
                    select: {
                      id: true,
                      position: true,
                      slug: true,
                      title: true,
                    },
                  },
                  progress: {
                    where: { userId },
                    take: 1,
                    select: { status: true },
                  },
                  slug: true,
                  title: true,
                },
              },
              title: true,
            },
          },
          position: true,
          progress: {
            where: { userId },
            take: 1,
            select: { lastViewedAt: true, status: true },
          },
          slug: true,
          tasks: {
            where: { isRequired: true },
            orderBy: { position: 'asc' },
            select: {
              completions: {
                where: { userId },
                take: 1,
                select: { status: true },
              },
              id: true,
              title: true,
            },
          },
          title: true,
        },
      });
    },
    async listPendingReviews(userId) {
      return client.reviewItem.findMany({
        where: {
          status: ReviewStatus.PENDING,
          userId,
          program: {
            ownerId: userId,
            status: ProgramStatus.ACTIVE,
          },
          lesson: {
            isPublished: true,
            module: {
              isPublished: true,
              stage: { isPublished: true },
            },
          },
        },
        orderBy: { dueAt: 'asc' },
        select: {
          dueAt: true,
          id: true,
          lesson: {
            select: {
              estimatedMinutes: true,
              module: {
                select: {
                  stage: { select: { title: true } },
                  title: true,
                },
              },
              slug: true,
              title: true,
            },
          },
          program: { select: { id: true, slug: true, title: true } },
        },
      });
    },
  };
}

function parseTimeZone(url: string): string {
  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(url).searchParams),
  );

  if (!parsed.success) {
    throw new ApiError('INVALID_REQUEST', 'Invalid request.', 400);
  }

  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: parsed.data.timeZone });
  } catch {
    throw new ApiError('INVALID_REQUEST', 'Invalid time zone.', 400);
  }

  return parsed.data.timeZone;
}

function lessonHref(programSlug: string, lessonSlug: string) {
  return `/program/${programSlug}/lesson/${lessonSlug}`;
}

function lessonOrder(lesson: LessonRecord): number {
  return (
    lesson.module.stage.program.position * 1_000_000 +
    lesson.module.stage.position * 10_000 +
    lesson.module.position * 100 +
    lesson.position
  );
}

function reviewCandidates(
  reviews: ReviewRecord[],
  now: Date,
  timeZone: string,
): RecommendationCandidate[] {
  return reviews.flatMap((review, index) => {
    const kind = classifyReviewDate(review.dueAt, now, timeZone);
    if (kind === 'FUTURE_REVIEW') return [];

    return [
      {
        estimatedMinutes: review.lesson.estimatedMinutes,
        href: lessonHref(review.program.slug, review.lesson.slug),
        kind,
        lessonTitle: review.lesson.title,
        moduleTitle: review.lesson.module.title,
        order: index,
        programId: review.program.id,
        programSlug: review.program.slug,
        programTitle: review.program.title,
        stageTitle: review.lesson.module.stage.title,
        title: `Réviser : ${review.lesson.title}`,
      },
    ];
  });
}

function taskCandidates(lessons: LessonRecord[]): RecommendationCandidate[] {
  const currentLesson = [...lessons]
    .filter(
      (lesson) =>
        lesson.progress[0]?.status === LessonProgressStatus.IN_PROGRESS,
    )
    .sort(
      (left, right) =>
        (right.progress[0]?.lastViewedAt?.getTime() ?? 0) -
        (left.progress[0]?.lastViewedAt?.getTime() ?? 0),
    )[0];
  if (!currentLesson) return [];

  return currentLesson.tasks
    .filter((task) => task.completions[0]?.status !== TaskCompletionStatus.DONE)
    .map((task) => ({
      estimatedMinutes: currentLesson.estimatedMinutes,
      href: lessonHref(
        currentLesson.module.stage.program.slug,
        currentLesson.slug,
      ),
      kind: 'INCOMPLETE_TASK' as const,
      lessonTitle: currentLesson.title,
      moduleTitle: currentLesson.module.title,
      order: lessonOrder(currentLesson),
      programId: currentLesson.module.stage.program.id,
      programSlug: currentLesson.module.stage.program.slug,
      programTitle: currentLesson.module.stage.program.title,
      stageTitle: currentLesson.module.stage.title,
      title: task.title,
    }));
}

function quizCandidates(lessons: LessonRecord[]): RecommendationCandidate[] {
  return lessons.flatMap((lesson) =>
    lesson.concepts.flatMap((concept) => {
      const ready = concept.assessments.some(
        (assessment) => assessment.questions.length > 0,
      );
      if (
        !ready ||
        concept.progress[0]?.status === ConceptProgressStatus.VALIDATED
      ) {
        return [];
      }

      return [
        {
          estimatedMinutes: lesson.estimatedMinutes,
          href: `${lessonHref(lesson.module.stage.program.slug, lesson.slug)}/quiz`,
          kind: 'REQUIRED_QUIZ' as const,
          lessonTitle: lesson.title,
          moduleTitle: lesson.module.title,
          order: lessonOrder(lesson),
          programId: lesson.module.stage.program.id,
          programSlug: lesson.module.stage.program.slug,
          programTitle: lesson.module.stage.program.title,
          stageTitle: lesson.module.stage.title,
          title: `Valider : ${concept.title}`,
        },
      ];
    }),
  );
}

function navigationCandidate(
  lessons: LessonRecord[],
): RecommendationCandidate | null {
  const nextLesson = lessons.find(
    (lesson) =>
      lesson.progress[0]?.status !== LessonProgressStatus.COMPLETED &&
      lesson.module.stage.progress?.[0]?.status !== StageProgressStatus.LOCKED,
  );
  if (!nextLesson) return null;

  const hasEarlierStage = lessons.some(
    (lesson) =>
      lesson.module.stage.program.id === nextLesson.module.stage.program.id &&
      lesson.module.stage.position < nextLesson.module.stage.position,
  );
  const hasEarlierModule = lessons.some(
    (lesson) =>
      lesson.module.stage.id === nextLesson.module.stage.id &&
      lesson.module.position < nextLesson.module.position,
  );
  const kind = hasEarlierStage
    ? 'NEXT_STAGE'
    : hasEarlierModule
      ? 'NEXT_MODULE'
      : 'NEXT_LESSON';
  const href =
    kind === 'NEXT_STAGE'
      ? `/program/${nextLesson.module.stage.program.slug}/stage/${nextLesson.module.stage.slug}`
      : kind === 'NEXT_MODULE'
        ? `/program/${nextLesson.module.stage.program.slug}/module/${nextLesson.module.slug}`
        : lessonHref(nextLesson.module.stage.program.slug, nextLesson.slug);
  const title =
    kind === 'NEXT_STAGE'
      ? `Découvrir : ${nextLesson.module.stage.title}`
      : kind === 'NEXT_MODULE'
        ? `Ouvrir : ${nextLesson.module.title}`
        : `Continuer : ${nextLesson.title}`;

  return {
    estimatedMinutes: nextLesson.estimatedMinutes,
    href,
    kind,
    lessonTitle: nextLesson.title,
    moduleTitle: nextLesson.module.title,
    order: lessonOrder(nextLesson),
    programId: nextLesson.module.stage.program.id,
    programSlug: nextLesson.module.stage.program.slug,
    programTitle: nextLesson.module.stage.program.title,
    stageTitle: nextLesson.module.stage.title,
    title,
  };
}

function lessonCandidates(lessons: LessonRecord[]): RecommendationCandidate[] {
  const navigation = navigationCandidate(lessons);

  return [
    ...taskCandidates(lessons),
    ...quizCandidates(lessons),
    ...(navigation ? [navigation] : []),
  ];
}

function finalAssessmentCandidates(
  assessments: FinalAssessmentRecord[],
): RecommendationCandidate[] {
  return assessments
    .filter((assessment) => {
      const lessons = assessment.stage.modules.flatMap(
        (module) => module.lessons,
      );
      const conceptsAreValidated = lessons
        .flatMap((lesson) => lesson.concepts)
        .every(
          (concept) =>
            concept.progress[0]?.status === ConceptProgressStatus.VALIDATED,
        );
      const tasksAreDone = lessons
        .flatMap((lesson) => lesson.tasks)
        .every(
          (task) => task.completions[0]?.status === TaskCompletionStatus.DONE,
        );

      return (
        conceptsAreValidated &&
        tasksAreDone &&
        assessment.stage.progress[0]?.status !== StageProgressStatus.LOCKED &&
        assessment.submissions[0]?.status !==
          StageAssessmentSubmissionStatus.VALIDATED &&
        assessment.submissions[0]?.status !==
          StageAssessmentSubmissionStatus.SUBMITTED
      );
    })
    .map((assessment) => ({
      estimatedMinutes: null,
      href: `/program/${assessment.stage.program.slug}/stage/${assessment.stage.slug}`,
      kind: 'REQUIRED_EXERCISE' as const,
      lessonTitle: null,
      moduleTitle: null,
      order:
        assessment.stage.program.position * 1_000_000 +
        assessment.stage.position * 10_000,
      programId: assessment.stage.program.id,
      programSlug: assessment.stage.program.slug,
      programTitle: assessment.stage.program.title,
      stageTitle: assessment.stage.title,
      title: assessment.title,
    }));
}

function selectFallbackProgram(programs: ProgramRecord[]) {
  return [...programs].sort((left, right) => {
    const lastViewedDifference =
      (right.progress[0]?.lastViewedAt.getTime() ?? 0) -
      (left.progress[0]?.lastViewedAt.getTime() ?? 0);
    return lastViewedDifference || left.position - right.position;
  })[0];
}

export function createTodayApp(options: TodayAppOptions = {}) {
  const app = new Hono<AuthEnvironment>();
  const now = options.now ?? (() => new Date());
  let defaultRepository: TodayRepository | undefined;
  const getRepository = async () => {
    if (options.repository) return options.repository;
    defaultRepository ??= createPrismaTodayRepository(await getPrismaClient());
    return defaultRepository;
  };

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

  app.get('/api/today', async (context) => {
    const timeZone = parseTimeZone(context.req.url);
    const userId = context.get('user').id;
    const repository = await getRepository();
    const [programs, reviews, lessons, assessments] = await Promise.all([
      repository.listActivePrograms(userId),
      repository.listPendingReviews(userId),
      repository.listLessons(userId),
      repository.listFinalAssessments(userId),
    ]);
    const currentTime = now();
    const candidates = [
      ...reviewCandidates(reviews, currentTime, timeZone),
      ...lessonCandidates(lessons),
      ...finalAssessmentCandidates(assessments),
    ];
    const recommendation = selectDailyRecommendation(candidates);
    const fallbackProgram = selectFallbackProgram(programs);
    const activeProgram = recommendation
      ? programs.find((program) => program.id === recommendation.programId)
      : fallbackProgram;
    const lastLesson = [...lessons]
      .filter(
        (lesson) =>
          lesson.progress[0]?.lastViewedAt &&
          lesson.module.stage.program.id === activeProgram?.id,
      )
      .sort(
        (left, right) =>
          (right.progress[0]?.lastViewedAt?.getTime() ?? 0) -
          (left.progress[0]?.lastViewedAt?.getTime() ?? 0),
      )[0];
    const dueReviews = reviews.filter(
      (review) =>
        classifyReviewDate(review.dueAt, currentTime, timeZone) !==
        'FUTURE_REVIEW',
    );

    return context.json({
      action: recommendation,
      lastActivity: lastLesson
        ? {
            at: lastLesson.progress[0]?.lastViewedAt,
            href: lessonHref(
              lastLesson.module.stage.program.slug,
              lastLesson.slug,
            ),
            title: lastLesson.title,
          }
        : null,
      program: activeProgram
        ? {
            id: activeProgram.id,
            percent: activeProgram.progress[0]?.percent ?? 0,
            slug: activeProgram.slug,
            title: activeProgram.title,
          }
        : null,
      reviewsDue: dueReviews.length,
    });
  });

  return app;
}

export const todayApp = createTodayApp();
