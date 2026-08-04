import {
  LessonActivitySummary,
  LessonContextHeader,
  lessonHref,
} from '@/components/learning/LessonContextHeader';
import { useEffect } from 'preact/hooks';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Spinner } from '@/components/ui/Spinner';
import { ExerciseCard } from '@/features/exercises/ExerciseCard';
import { useLessonQuery } from '@/features/curriculum/queries';
import { activityKey, rememberActivity } from '@/lib/lesson-activity-sequence';

export function ExercisePage({
  exerciseId,
  lessonSlug,
}: {
  exerciseId: string;
  lessonSlug: string;
}) {
  const lessonQuery = useLessonQuery(lessonSlug);
  const lesson = lessonQuery.data?.lesson;
  const exercise = lesson?.exercises.find((item) => item.id === exerciseId);

  useEffect(() => {
    if (lesson && exercise) {
      rememberActivity(lesson.id, activityKey('EXERCISE', exercise.id));
    }
  }, [exercise, lesson]);

  if (lessonQuery.isPending) return <Spinner label="Chargement de l’exercice" />;
  if (lessonQuery.error) {
    return <ErrorState description="L’exercice n’a pas pu être chargé." />;
  }

  if (!lesson || !exercise) {
    return (
      <EmptyState
        description="Cet exercice n’appartient pas à la leçon accessible."
        title="Exercice introuvable"
      />
    );
  }

  const key = activityKey('EXERCISE', exercise.id);
  const backHref = `${lessonHref(lesson)}?activity=${encodeURIComponent(key)}`;

  return (
    <article class="space-y-6">
      <LessonContextHeader activityTitle={exercise.title} lesson={lesson} />
      <LessonActivitySummary currentKey={key} lesson={lesson} />
      <ExerciseCard exercise={exercise} isLessonPublished={lesson.isPublished} />
      <a
        class="inline-flex min-h-11 items-center text-cyan-300 underline"
        href={backHref}
      >
        Retour à la leçon
      </a>
    </article>
  );
}
