import {
  CanonicalActivityKind,
  ConceptProgressStatus,
  LessonProgressStatus,
  StageAssessmentSubmissionStatus,
  StageProgressStatus,
  TaskCompletionStatus,
} from '../../../../generated/prisma/client.js';
import {
  classifyReviewDate,
  type RecommendationCandidate,
} from '../../../lib/recommendation.js';
import type {
  FinalAssessmentRecord,
  LessonRecord,
  ReviewRecord,
} from './types.js';

export function lessonHref(programSlug: string, lessonSlug: string) {
  return `/program/${programSlug}/lesson/${lessonSlug}`;
}

function lessonActivityHref(
  programSlug: string,
  lessonSlug: string,
  kind: string,
  id: string,
) {
  const encodedKey = encodeURIComponent(`${kind}:${id}`);
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
    return [{
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
    }];
  });
}

function taskCandidates(lessons: LessonRecord[]): RecommendationCandidate[] {
  const currentLesson = [...lessons]
    .filter((lesson) =>
      lesson.progress[0]?.status === LessonProgressStatus.IN_PROGRESS)
    .sort((left, right) =>
      (right.progress[0]?.lastViewedAt?.getTime() ?? 0) -
      (left.progress[0]?.lastViewedAt?.getTime() ?? 0))[0];
  if (!currentLesson) return [];

  return currentLesson.tasks
    .filter((task) =>
      task.completions[0]?.status !== TaskCompletionStatus.DONE &&
      !currentLesson.activityCompletionCarryovers.some((carryover) =>
        carryover.kind === CanonicalActivityKind.TASK &&
        carryover.activityKey === task.key))
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
        (candidate) => candidate.questions.length > 0,
      );
      if (!assessment ||
        concept.progress[0]?.status === ConceptProgressStatus.VALIDATED) {
        return [];
      }
      return [{
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
      }];
    }),
  );
}

function quizCandidates(lessons: LessonRecord[]): RecommendationCandidate[] {
  return lessons.flatMap((lesson) => lesson.quizzes
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
  return lessons.flatMap((lesson) => lesson.exercises
    .filter((exercise) =>
      exercise.submissions[0]?.status !== 'SUBMITTED' &&
      !lesson.activityCompletionCarryovers.some((carryover) =>
        carryover.kind === CanonicalActivityKind.EXERCISE &&
        carryover.activityKey === exercise.key))
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
  const nextLesson = lessons.find((lesson) =>
    lesson.progress[0]?.status !== LessonProgressStatus.COMPLETED &&
    lesson.module.stage.progress?.[0]?.status !== StageProgressStatus.LOCKED);
  if (!nextLesson) return null;

  const hasEarlierStage = lessons.some((lesson) =>
    lesson.module.stage.program.id === nextLesson.module.stage.program.id &&
    lesson.module.stage.position < nextLesson.module.stage.position);
  const hasEarlierModule = lessons.some((lesson) =>
    lesson.module.stage.id === nextLesson.module.stage.id &&
    lesson.module.position < nextLesson.module.position);
  const kind = hasEarlierStage
    ? 'NEXT_STAGE'
    : hasEarlierModule ? 'NEXT_MODULE' : 'NEXT_LESSON';
  const title = kind === 'NEXT_STAGE'
    ? `Découvrir : ${nextLesson.module.stage.title}`
    : kind === 'NEXT_MODULE'
      ? `Ouvrir : ${nextLesson.module.title}`
      : `Continuer : ${nextLesson.title}`;

  return {
    estimatedMinutes: nextLesson.estimatedMinutes,
    href: lessonHref(nextLesson.module.stage.program.slug, nextLesson.slug),
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
      return lessons.every((lesson) =>
        lesson.progress[0]?.status === LessonProgressStatus.COMPLETED) &&
        assessment.stage.progress[0]?.status !== StageProgressStatus.LOCKED &&
        assessment.submissions[0]?.status !==
          StageAssessmentSubmissionStatus.VALIDATED &&
        assessment.submissions[0]?.status !==
          StageAssessmentSubmissionStatus.SUBMITTED;
    })
    .map((assessment) => ({
      estimatedMinutes: null,
      href: `/program/${assessment.stage.program.slug}/stage/${assessment.stage.slug}`,
      kind: 'REQUIRED_EXERCISE' as const,
      lessonTitle: null,
      moduleTitle: null,
      order: assessment.stage.program.position * 1_000_000 +
        assessment.stage.position * 10_000,
      programId: assessment.stage.program.id,
      programSlug: assessment.stage.program.slug,
      programTitle: assessment.stage.program.title,
      stageTitle: assessment.stage.title,
      title: assessment.title,
    }));
}

export function buildRecommendationCandidates(
  reviews: ReviewRecord[],
  lessons: LessonRecord[],
  assessments: FinalAssessmentRecord[],
  currentTime: Date,
  timeZone: string,
): RecommendationCandidate[] {
  return [
    ...reviewCandidates(reviews, currentTime, timeZone),
    ...lessonCandidates(lessons),
    ...finalAssessmentCandidates(assessments),
  ];
}
