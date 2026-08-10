import { Badge } from '@/components/ui/Badge';
import { useEffect } from 'preact/hooks';
import { useBackNavigationTarget } from '@/components/layout/BackNavigationContext';
import {
  LessonContextHeader,
  LessonActivitySummary,
  lessonHref,
} from '@/components/learning/LessonContextHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { NavigationAction } from '@/components/ui/NavigationAction';
import { Spinner } from '@/components/ui/Spinner';
import { QuestionAssessmentExperience } from '@/features/assessments/QuestionAssessmentExperience';
import { useLessonQuery } from '@/features/curriculum/queries';
import {
  useQuizAttemptMutation,
  useQuizAttemptsQuery,
  useQuizQuery,
} from '@/features/quizzes/queries';
import { activityKey, rememberActivity } from '@/lib/lesson-activity-sequence';
import { lessonHref as buildLessonHref } from '@/lib/curriculum-navigation';
import { useI18n } from '@/i18n';

export function QuizPage({
  lessonSlug,
  programSlug,
  quizId,
}: {
  lessonSlug: string;
  programSlug: string;
  quizId?: string;
}) {
  const { t } = useI18n();
  const lessonQuery = useLessonQuery(lessonSlug);
  const lesson = lessonQuery.data?.lesson;
  const selectedQuiz = quizId
    ? lesson?.quizzes.find((quiz) => quiz.id === quizId)
    : lesson?.quizzes[0];
  const selectedQuizId = lesson?.isPublished
    ? (selectedQuiz?.id ?? null)
    : null;
  const quizQuery = useQuizQuery(selectedQuizId);
  const attemptsQuery = useQuizAttemptsQuery(selectedQuizId);
  const mutation = useQuizAttemptMutation(selectedQuizId);
  const fallbackLessonHref = buildLessonHref(programSlug, lessonSlug);
  useBackNavigationTarget({
    href: fallbackLessonHref,
    labelKey: 'navigation.back.lesson',
  });

  useEffect(() => {
    if (lesson && selectedQuiz) {
      rememberActivity(lesson.id, activityKey('QUIZ', selectedQuiz.id));
    }
  }, [lesson, selectedQuiz]);

  if (lessonQuery.isPending) {
    return <Spinner label={t('quiz.loading')} />;
  }

  if (lessonQuery.error) {
    return <ErrorState description={t('quiz.loadError')} />;
  }

  if (!lesson?.isPublished) {
    return (
      <EmptyState
        action={
          <NavigationAction href={fallbackLessonHref} variant="secondary">
            {t('assessment.openLesson')}
          </NavigationAction>
        }
        description={t('quiz.unpublished.description')}
        title={t('quiz.unpublished.title')}
      />
    );
  }

  if (!selectedQuiz) {
    return (
      <EmptyState
        action={
          <NavigationAction href={fallbackLessonHref} variant="secondary">
            {t('assessment.openLesson')}
          </NavigationAction>
        }
        description={t('quiz.notFound.description')}
        title={t('quiz.notFound.title')}
      />
    );
  }

  if (quizQuery.isPending || attemptsQuery.isPending) {
    return <Spinner label={t('quiz.loading')} />;
  }

  if (quizQuery.error || attemptsQuery.error || !quizQuery.data?.quiz) {
    return <ErrorState description={t('quiz.loadError')} />;
  }

  const quiz = quizQuery.data.quiz;
  const key = activityKey('QUIZ', quiz.id);
  const backHref = `${lessonHref(lesson)}?activity=${encodeURIComponent(key)}`;

  return (
    <article class="page-layout page-layout--work space-y-6">
      <LessonContextHeader activityTitle={quiz.title} lesson={lesson} />
      <section class="space-y-3" aria-label={t('quiz.info')}>
        <div class="flex flex-wrap items-center gap-3">
          <Badge tone={quiz.isRequired ? 'warning' : 'neutral'}>
            {quiz.isRequired ? t('common.required') : t('quiz.optional')}
          </Badge>
        </div>
        {quiz.description ? (
          <p class="ui-text-muted leading-7">{quiz.description}</p>
        ) : null}
        <p class="ui-text-muted text-sm">
          {t('quiz.scoreSummary', {
            questions: t('assessment.questionCount', {
              count: quiz.questionCount,
            }),
            score: Math.round(quiz.passingScore),
          })}
        </p>
      </section>

      <QuestionAssessmentExperience
        assessment={quiz}
        attempts={attemptsQuery.data?.attempts ?? []}
        backHref={backHref}
        error={mutation.error}
        hasMoreAttempts={attemptsQuery.hasMore}
        isPending={mutation.isPending}
        isLoadingMoreAttempts={attemptsQuery.isLoadingMore}
        key={quiz.id}
        labels={{
          emptyDescription: t('quiz.empty.description'),
          emptyTitle: t('quiz.empty.title'),
          failure: t('quiz.failure'),
          restart: t('quiz.restart'),
          success: t('quiz.success'),
        }}
        onSubmit={mutation.submit}
        onLoadMoreAttempts={attemptsQuery.loadMore}
      />
      <LessonActivitySummary currentKey={key} lesson={lesson} />
    </article>
  );
}
