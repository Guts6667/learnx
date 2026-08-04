import { Badge } from '@/components/ui/Badge';
import { useEffect } from 'preact/hooks';
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

export function QuizPage({
  lessonSlug,
  programSlug,
  quizId,
}: {
  lessonSlug: string;
  programSlug: string;
  quizId?: string;
}) {
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
  const fallbackLessonHref = `/program/${encodeURIComponent(programSlug)}/lesson/${encodeURIComponent(lessonSlug)}`;

  useEffect(() => {
    if (lesson && selectedQuiz) {
      rememberActivity(lesson.id, activityKey('QUIZ', selectedQuiz.id));
    }
  }, [lesson, selectedQuiz]);

  if (lessonQuery.isPending) {
    return <Spinner label="Chargement du quiz" />;
  }

  if (lessonQuery.error) {
    return <ErrorState description="Le quiz n’a pas pu être chargé." />;
  }

  if (!lesson?.isPublished) {
    return (
      <EmptyState
        action={
          <NavigationAction href={fallbackLessonHref} variant="secondary">
            Ouvrir la leçon
          </NavigationAction>
        }
        description="Les quiz d’une leçon brouillon sont disponibles uniquement après publication."
        title="Quiz non publié"
      />
    );
  }

  if (!selectedQuiz) {
    return (
      <EmptyState
        action={
          <NavigationAction href={fallbackLessonHref} variant="secondary">
            Ouvrir la leçon
          </NavigationAction>
        }
        description="Aucun quiz correspondant n’est disponible pour cette leçon."
        title="Quiz introuvable"
      />
    );
  }

  if (quizQuery.isPending || attemptsQuery.isPending) {
    return <Spinner label="Chargement du quiz" />;
  }

  if (quizQuery.error || attemptsQuery.error || !quizQuery.data?.quiz) {
    return <ErrorState description="Le quiz n’a pas pu être chargé." />;
  }

  const quiz = quizQuery.data.quiz;
  const key = activityKey('QUIZ', quiz.id);
  const backHref = `${lessonHref(lesson)}?activity=${encodeURIComponent(key)}`;

  return (
    <article class="mx-auto w-full max-w-5xl space-y-6">
      <LessonContextHeader activityTitle={quiz.title} lesson={lesson} />
      <section class="space-y-3" aria-label="Informations du quiz">
        <div class="flex flex-wrap items-center gap-3">
          <Badge tone={quiz.isRequired ? 'warning' : 'neutral'}>
            {quiz.isRequired ? 'Obligatoire' : 'Optionnel'}
          </Badge>
        </div>
        {quiz.description ? (
          <p class="leading-7 text-slate-300">{quiz.description}</p>
        ) : null}
        <p class="text-sm text-slate-400">
          {quiz.questionCount} questions · seuil de réussite :{' '}
          {Math.round(quiz.passingScore)} %
        </p>
      </section>

      <QuestionAssessmentExperience
        assessment={quiz}
        attempts={attemptsQuery.data?.attempts ?? []}
        backHref={backHref}
        error={mutation.error}
        isPending={mutation.isPending}
        key={quiz.id}
        labels={{
          emptyDescription: 'Ce quiz ne contient aucune question.',
          emptyTitle: 'Quiz indisponible',
          failure: 'Quiz à reprendre',
          restart: 'Recommencer le quiz',
          success: 'Quiz réussi',
        }}
        onSubmit={mutation.submit}
      />
      <LessonActivitySummary currentKey={key} lesson={lesson} />
    </article>
  );
}
