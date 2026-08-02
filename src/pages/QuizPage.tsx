import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Spinner } from '@/components/ui/Spinner';
import { QuestionAssessmentExperience } from '@/features/assessments/QuestionAssessmentExperience';
import { useLessonQuery } from '@/features/curriculum/queries';
import {
  useQuizAttemptMutation,
  useQuizAttemptsQuery,
  useQuizQuery,
} from '@/features/quizzes/queries';

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
  const lessonHref = `/program/${encodeURIComponent(programSlug)}/lesson/${encodeURIComponent(lessonSlug)}`;

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
          <a class="text-cyan-300 underline" href={lessonHref}>
            Retour à la leçon
          </a>
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
          <a class="text-cyan-300 underline" href={lessonHref}>
            Retour à la leçon
          </a>
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

  return (
    <article aria-labelledby="quiz-title" class="space-y-6">
      <header class="space-y-3">
        <a
          class="inline-flex min-h-11 items-center text-cyan-300 underline"
          href={lessonHref}
        >
          Retour à la leçon
        </a>
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="text-3xl font-bold tracking-tight" id="quiz-title">
            {quiz.title}
          </h1>
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
      </header>

      <QuestionAssessmentExperience
        assessment={quiz}
        attempts={attemptsQuery.data?.attempts ?? []}
        backHref={lessonHref}
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
    </article>
  );
}
