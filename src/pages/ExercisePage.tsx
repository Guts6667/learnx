import {
  LessonActivitySummary,
  LessonContextHeader,
} from '@/components/learning/LessonContextHeader';
import { QueryState } from '@/components/learnx/QueryState';
import { useBackNavigationTarget } from '@/components/layout/BackNavigationContext';
import { useEffect } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ExerciseCard } from '@/features/exercises/ExerciseCard';
import { useLessonQuery } from '@/features/curriculum/queries';
import { activityKey, rememberActivity } from '@/lib/lesson-activity-sequence';
import { lessonHref } from '@/lib/curriculum-navigation';
import { useI18n } from '@/i18n';

export function ExercisePage({
  exerciseId,
  lessonSlug,
  programSlug,
}: {
  exerciseId: string;
  lessonSlug: string;
  programSlug: string;
}) {
  const { t } = useI18n();
  useBackNavigationTarget({
    href: lessonHref(programSlug, lessonSlug),
    labelKey: 'navigation.back.lesson',
  });
  const lessonQuery = useLessonQuery(lessonSlug);
  const lesson = lessonQuery.data?.lesson;
  const exercise = lesson?.exercises.find((item) => item.id === exerciseId);

  useEffect(() => {
    if (lesson && exercise) {
      rememberActivity(lesson.id, activityKey('EXERCISE', exercise.id));
    }
  }, [exercise, lesson]);

  if (lessonQuery.isPending || lessonQuery.error) {
    return (
      <QueryState
        error={lessonQuery.error}
        errorDescription={t('exercise.loadError')}
        isPending={lessonQuery.isPending}
        loadingLabel={t('exercise.loading')}
        onRetry={lessonQuery.reload}
        retryLabel={t('common.retry')}
      />
    );
  }

  if (!lesson || !exercise) {
    return (
      <EmptyState
        description={t('exercise.notFound.description')}
        title={t('exercise.notFound.title')}
      />
    );
  }

  const key = activityKey('EXERCISE', exercise.id);
  return (
    <article className="totem-learning-page page-layout page-layout--work space-y-6">
      <LessonContextHeader activityTitle={exercise.title} lesson={lesson} />
      <ExerciseCard
        exercise={exercise}
        isLessonPublished={lesson.isPublished}
      />
      <LessonActivitySummary currentKey={key} lesson={lesson} />
    </article>
  );
}
