import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import {
  CanonicalActivityKind,
  ConceptProgressStatus,
  LessonProgressStatus,
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
import { requireCapability } from '../_lib/authorization.js';
import { ApiError, toApiErrorBody } from '../_lib/errors.js';
import { learningProgramWhere } from '../_lib/program-access-policy.js';

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
  sourceId: string;
}

interface LessonRecord {
  activityCompletionCarryovers: Array<{
    activityKey: string;
    kind: string;
    moduleRunId: string;
  }>;
  concepts: Array<{
    assessments: Array<{ id: string; questions: Array<{ id: string }> }>;
    id: string;
    progress: Array<{ status: string }>;
    title: string;
  }>;
  estimatedMinutes: number | null;
  exercises: Array<{
    id: string;
    key: string;
    submissions: Array<{ status: string }>;
    title: string;
  }>;
  id: string;
  module: {
    id: string;
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
  quizzes: Array<{
    attempts: Array<{ passed: boolean }>;
    id: string;
    title: string;
  }>;
  lessonSequenceItems?: Array<{
    conceptAssessmentId: string | null;
    exerciseId: string | null;
    position: number;
    quizId: string | null;
    taskId: string | null;
  }>;
  slug: string;
  tasks: Array<{
    completions: Array<{ status: string }>;
    id: string;
    key: string;
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
        progress: Array<{ status: string }>;
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
        where: learningProgramWhere(userId),
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
            program: learningProgramWhere(userId),
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
                      progress: {
                        where: { userId },
                        take: 1,
                        select: { status: true },
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
      const lessons = await client.lesson.findMany({
        where: {
          isPublished: true,
          module: {
            isPublished: true,
            stage: {
              isPublished: true,
              program: learningProgramWhere(userId),
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
          activityCompletionCarryovers: {
            where: { userId },
            select: { activityKey: true, kind: true, moduleRunId: true },
          },
          concepts: {
            where: { isRequired: true },
            orderBy: { position: 'asc' },
            select: {
              assessments: {
                where: { isRequired: true },
                select: {
                  id: true,
                  questions: { take: 1, select: { id: true } },
                },
              },
              id: true,
              progress: {
                where: { userId },
                take: 1,
                select: { status: true },
              },
              title: true,
            },
          },
          estimatedMinutes: true,
          exercises: {
            where: { isCanonical: true, isRequired: true },
            orderBy: { position: 'asc' },
            select: {
              id: true,
              key: true,
              submissions: {
                where: { userId },
                take: 1,
                select: { status: true },
              },
              title: true,
            },
          },
          id: true,
          module: {
            select: {
              id: true,
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
          quizzes: {
            where: { isRequired: true },
            orderBy: { position: 'asc' },
            select: {
              attempts: {
                where: { userId },
                orderBy: { submittedAt: 'desc' },
                select: { passed: true },
                take: 1,
              },
              id: true,
              title: true,
            },
          },
          lessonSequenceItems: {
            orderBy: { position: 'asc' },
            select: {
              conceptAssessmentId: true,
              exerciseId: true,
              position: true,
              quizId: true,
              taskId: true,
            },
          },
          slug: true,
          tasks: {
            where: { isCanonical: true, isRequired: true },
            orderBy: { position: 'asc' },
            select: {
              completions: {
                where: { userId },
                take: 1,
                select: { status: true },
              },
              id: true,
              key: true,
              title: true,
            },
          },
          title: true,
        },
      });
      const moduleIds = [...new Set(lessons.map((lesson) => lesson.module.id))];
      const currentRuns =
        moduleIds.length === 0
          ? []
          : await client.moduleRun.findMany({
              where: { moduleId: { in: moduleIds }, userId },
              orderBy: [{ moduleId: 'asc' }, { sequence: 'desc' }],
              select: { id: true, moduleId: true },
            });
      const currentRunByModule = new Map<string, string>();
      for (const run of currentRuns) {
        if (!currentRunByModule.has(run.moduleId)) {
          currentRunByModule.set(run.moduleId, run.id);
        }
      }
      const currentRunIds = new Set(
        currentRunByModule.values(),
      );
      return lessons.map((lesson) => ({
        ...lesson,
        activityCompletionCarryovers:
          lesson.activityCompletionCarryovers.filter((carryover) =>
            currentRunIds.has(carryover.moduleRunId),
          ),
      }));
    },
    async listPendingReviews(userId) {
      return client.reviewItem.findMany({
        where: {
          status: ReviewStatus.PENDING,
          userId,
          program: learningProgramWhere(userId),
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
          sourceId: true,
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

function lessonActivityHref(
  programSlug: string,
  lessonSlug: string,
  kind: string,
  id: string,
) {
  const key = `${kind}:${id}`;
  const encodedKey = encodeURIComponent(key);
  return `${lessonHref(programSlug, lessonSlug)}?activity=${encodedKey}#activity-${encodedKey}`;
}

function lessonOrder(lesson: LessonRecord): number {
  return (
    lesson.module.stage.program.position * 1_000_000 +
    lesson.module.stage.position * 10_000 +
    lesson.module.position * 100 +
    lesson.position
  );
}

function lessonSequenceOrder(lesson: LessonRecord, targetId: string): number {
  const item = lesson.lessonSequenceItems?.find(
    (candidate) =>
      candidate.taskId === targetId ||
      candidate.conceptAssessmentId === targetId ||
      candidate.exerciseId === targetId ||
      candidate.quizId === targetId,
  );
  return lessonOrder(lesson) + (item?.position ?? 9_999) / 10_000;
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
        href: `${lessonHref(review.program.slug, review.lesson.slug)}/assessment?assessmentId=${encodeURIComponent(review.sourceId)}&activity=${encodeURIComponent(`concept_assessment:${review.sourceId}`)}`,
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
    .filter(
      (task) =>
        task.completions[0]?.status !== TaskCompletionStatus.DONE &&
        !currentLesson.activityCompletionCarryovers.some(
          (carryover) =>
            carryover.kind === CanonicalActivityKind.TASK &&
            carryover.activityKey === task.key,
        ),
    )
    .map((task) => ({
      estimatedMinutes: currentLesson.estimatedMinutes,
      href: lessonActivityHref(
        currentLesson.module.stage.program.slug,
        currentLesson.slug,
        'task',
        task.id,
      ),
      kind: 'INCOMPLETE_TASK' as const,
      lessonTitle: currentLesson.title,
      moduleTitle: currentLesson.module.title,
      order: lessonSequenceOrder(currentLesson, task.id),
      programId: currentLesson.module.stage.program.id,
      programSlug: currentLesson.module.stage.program.slug,
      programTitle: currentLesson.module.stage.program.title,
      stageTitle: currentLesson.module.stage.title,
      title: task.title,
    }));
}

function conceptAssessmentCandidates(
  lessons: LessonRecord[],
): RecommendationCandidate[] {
  return lessons.flatMap((lesson) =>
    lesson.concepts.flatMap((concept) => {
      const assessment = concept.assessments.find(
        (assessment) => assessment.questions.length > 0,
      );
      if (
        !assessment ||
        concept.progress[0]?.status === ConceptProgressStatus.VALIDATED
      ) {
        return [];
      }

      return [
        {
          estimatedMinutes: lesson.estimatedMinutes,
          href: `${lessonHref(lesson.module.stage.program.slug, lesson.slug)}/assessment?assessmentId=${encodeURIComponent(assessment.id)}&activity=${encodeURIComponent(`concept_assessment:${assessment.id}`)}`,
          kind: 'REQUIRED_QUIZ' as const,
          lessonTitle: lesson.title,
          moduleTitle: lesson.module.title,
          order: lessonSequenceOrder(lesson, assessment.id),
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

function quizCandidates(lessons: LessonRecord[]): RecommendationCandidate[] {
  return lessons.flatMap((lesson) =>
    lesson.quizzes
      .filter((quiz) => quiz.attempts[0]?.passed !== true)
      .map((quiz) => ({
        estimatedMinutes: lesson.estimatedMinutes,
        href: `${lessonHref(lesson.module.stage.program.slug, lesson.slug)}/quiz?quizId=${encodeURIComponent(quiz.id)}&activity=${encodeURIComponent(`quiz:${quiz.id}`)}`,
        kind: 'REQUIRED_QUIZ' as const,
        lessonTitle: lesson.title,
        moduleTitle: lesson.module.title,
        order: lessonSequenceOrder(lesson, quiz.id),
        programId: lesson.module.stage.program.id,
        programSlug: lesson.module.stage.program.slug,
        programTitle: lesson.module.stage.program.title,
        stageTitle: lesson.module.stage.title,
        title: quiz.title,
      })),
  );
}

function exerciseCandidates(
  lessons: LessonRecord[],
): RecommendationCandidate[] {
  return lessons.flatMap((lesson) =>
    lesson.exercises
      .filter(
        (exercise) =>
          exercise.submissions[0]?.status !== 'SUBMITTED' &&
          !lesson.activityCompletionCarryovers.some(
            (carryover) =>
              carryover.kind === CanonicalActivityKind.EXERCISE &&
              carryover.activityKey === exercise.key,
          ),
      )
      .map((exercise) => ({
        estimatedMinutes: lesson.estimatedMinutes,
        href: `${lessonHref(lesson.module.stage.program.slug, lesson.slug)}/exercise/${encodeURIComponent(exercise.id)}?activity=${encodeURIComponent(`exercise:${exercise.id}`)}`,
        kind: 'REQUIRED_EXERCISE' as const,
        lessonTitle: lesson.title,
        moduleTitle: lesson.module.title,
        order: lessonSequenceOrder(lesson, exercise.id),
        programId: lesson.module.stage.program.id,
        programSlug: lesson.module.stage.program.slug,
        programTitle: lesson.module.stage.program.title,
        stageTitle: lesson.module.stage.title,
        title: exercise.title,
      })),
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
  const href = lessonHref(
    nextLesson.module.stage.program.slug,
    nextLesson.slug,
  );
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
    ...conceptAssessmentCandidates(lessons),
    ...quizCandidates(lessons),
    ...exerciseCandidates(lessons),
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
      const lessonsAreCompleted = lessons.every(
        (lesson) =>
          lesson.progress[0]?.status === LessonProgressStatus.COMPLETED,
      );

      return (
        lessonsAreCompleted &&
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

type TodayProgramStatus = 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED';

function latestLessonForProgram(
  lessons: LessonRecord[],
  programId: string,
): LessonRecord | undefined {
  return [...lessons]
    .filter(
      (lesson) =>
        lesson.progress[0]?.lastViewedAt &&
        lesson.module.stage.program.id === programId,
    )
    .sort(
      (left, right) =>
        (right.progress[0]?.lastViewedAt?.getTime() ?? 0) -
        (left.progress[0]?.lastViewedAt?.getTime() ?? 0),
    )[0];
}

function programStatus(program: ProgramRecord): TodayProgramStatus {
  const progress = program.progress[0];
  if ((progress?.percent ?? 0) >= 100) return 'COMPLETED';
  if (progress && (progress.percent > 0 || progress.lastViewedAt)) {
    return 'IN_PROGRESS';
  }
  return 'NOT_STARTED';
}

function serializeProgramSummary(
  program: ProgramRecord,
  candidates: RecommendationCandidate[],
  lessons: LessonRecord[],
) {
  const nextAction = selectDailyRecommendation(
    candidates.filter((candidate) => candidate.programId === program.id),
  );
  const lastLesson = latestLessonForProgram(lessons, program.id);
  const status = programStatus(program);
  const lastActivity = lastLesson
    ? {
        at: lastLesson.progress[0]?.lastViewedAt,
        href: lessonHref(
          lastLesson.module.stage.program.slug,
          lastLesson.slug,
        ),
        title: lastLesson.title,
      }
    : null;

  return {
    id: program.id,
    lastActivity,
    nextAction,
    percent: program.progress[0]?.percent ?? 0,
    resumeHref:
      status === 'COMPLETED' && !nextAction
        ? null
        : (nextAction?.href ??
          lastActivity?.href ??
          `/program/${encodeURIComponent(program.slug)}`),
    slug: program.slug,
    status,
    title: program.title,
  };
}

function orderProgramSummaries(
  programs: ProgramRecord[],
  primaryProgramId: string | undefined,
) {
  return [...programs].sort((left, right) => {
    if (left.id === primaryProgramId) return -1;
    if (right.id === primaryProgramId) return 1;
    const recentDifference =
      (right.progress[0]?.lastViewedAt.getTime() ?? 0) -
      (left.progress[0]?.lastViewedAt.getTime() ?? 0);
    return recentDifference || left.position - right.position;
  });
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
  app.use('*', requireCapability('learning.read'));
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
    const dueReviews = reviews.filter(
      (review) =>
        classifyReviewDate(review.dueAt, currentTime, timeZone) !==
        'FUTURE_REVIEW',
    );
    const programSummaries = orderProgramSummaries(
      programs,
      activeProgram?.id,
    ).map((program) => serializeProgramSummary(program, candidates, lessons));
    const activeProgramSummary = programSummaries.find(
      (program) => program.id === activeProgram?.id,
    );

    return context.json({
      action: recommendation,
      hasMorePrograms: false,
      lastActivity: activeProgramSummary?.lastActivity ?? null,
      program: activeProgram
        ? {
            id: activeProgram.id,
            percent: activeProgram.progress[0]?.percent ?? 0,
            slug: activeProgram.slug,
            title: activeProgram.title,
          }
        : null,
      programCount: programSummaries.length,
      programs: programSummaries,
      reviewsDue: dueReviews.length,
    });
  });

  return app;
}

export const todayApp = createTodayApp();
