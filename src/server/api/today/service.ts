import {
  classifyReviewDate,
  selectDailyRecommendation,
  type RecommendationCandidate,
} from '../../../lib/recommendation.js';
import {
  buildRecommendationCandidates,
  lessonHref,
} from './recommendation-candidates.js';
import type {
  LessonRecord,
  ProgramRecord,
  TodayRepository,
} from './types.js';

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

export async function getTodayDashboard(
  repository: TodayRepository,
  userId: string,
  currentTime: Date,
  timeZone: string,
) {
  const [programs, reviews, lessons, assessments] = await Promise.all([
    repository.listActivePrograms(userId),
    repository.listPendingReviews(userId),
    repository.listLessons(userId),
    repository.listFinalAssessments(userId),
  ]);
  const candidates = buildRecommendationCandidates(
    reviews,
    lessons,
    assessments,
    currentTime,
    timeZone,
  );
  const recommendation = selectDailyRecommendation(candidates);
  const fallbackProgram = selectFallbackProgram(programs);
  const activeProgram = recommendation
    ? programs.find((program) => program.id === recommendation.programId)
    : fallbackProgram;
  const reviewsDue = reviews.filter(
    (review) =>
      classifyReviewDate(review.dueAt, currentTime, timeZone) !==
      'FUTURE_REVIEW',
  ).length;
  const programSummaries = orderProgramSummaries(
    programs,
    activeProgram?.id,
  ).map((program) => serializeProgramSummary(program, candidates, lessons));
  const activeProgramSummary = programSummaries.find(
    (program) => program.id === activeProgram?.id,
  );

  return {
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
    reviewsDue,
  };
}
