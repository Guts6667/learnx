import { useMemo, useState } from 'preact/hooks';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Spinner } from '@/components/ui/Spinner';
import { Textarea } from '@/components/ui/Textarea';
import { useLessonQuery } from '@/features/curriculum/queries';
import {
  type QuizAttempt,
  type QuizAttemptResponse,
  type QuizDetail,
  type QuizQuestion,
  type SubmittedQuizAnswer,
  useQuizAttemptMutation,
  useQuizAttemptsQuery,
  useQuizQuery,
} from '@/features/quizzes/queries';

interface DraftAnswer {
  optionIds: string[];
  text: string;
}

function isAnswered(question: QuizQuestion, answer?: DraftAnswer): boolean {
  return question.type === 'SHORT_ANSWER'
    ? Boolean(answer?.text.trim())
    : Boolean(answer?.optionIds.length);
}

function toSubmittedAnswers(
  quiz: QuizDetail,
  answers: Record<string, DraftAnswer>,
): SubmittedQuizAnswer[] {
  return quiz.questions.map((question) => {
    const answer = answers[question.id] ?? { optionIds: [], text: '' };

    return {
      optionIds: answer.optionIds,
      questionId: question.id,
      ...(question.type === 'SHORT_ANSWER' ? { text: answer.text.trim() } : {}),
    };
  });
}

function formatAttemptDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function AttemptHistory({ attempts }: { attempts: QuizAttempt[] }) {
  return (
    <section aria-labelledby="quiz-history-title" class="space-y-3">
      <h2 class="text-xl font-semibold" id="quiz-history-title">
        Tentatives précédentes
      </h2>
      {attempts.length === 0 ? (
        <p class="text-sm text-slate-400">Aucune tentative enregistrée.</p>
      ) : (
        <ol class="space-y-2">
          {attempts.map((attempt) => (
            <li key={attempt.id}>
              <Card class="flex items-center justify-between gap-4">
                <div>
                  <p class="font-semibold">
                    Score : {Math.round(attempt.score)} %
                  </p>
                  <p class="mt-1 text-sm text-slate-400">
                    {formatAttemptDate(attempt.submittedAt)}
                  </p>
                </div>
                <Badge tone={attempt.passed ? 'success' : 'danger'}>
                  {attempt.passed ? 'Réussi' : 'À reprendre'}
                </Badge>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function QuestionOptions({
  answer,
  onChange,
  question,
}: {
  answer: DraftAnswer;
  onChange: (answer: DraftAnswer) => void;
  question: QuizQuestion;
}) {
  if (question.type === 'SHORT_ANSWER') {
    return (
      <Textarea
        label="Votre réponse"
        maxLength={500}
        onInput={(event) =>
          onChange({ ...answer, text: event.currentTarget.value })
        }
        value={answer.text}
      />
    );
  }

  const multiple = question.type === 'MULTIPLE_CHOICE';

  return (
    <div class="space-y-3">
      {question.options.map((option) => {
        const checked = answer.optionIds.includes(option.id);

        return (
          <label
            class="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-cyan-400"
            key={option.id}
          >
            <input
              checked={checked}
              class="mt-0.5 size-5 shrink-0 accent-cyan-400"
              name={question.id}
              onChange={() => {
                const optionIds = multiple
                  ? checked
                    ? answer.optionIds.filter((id) => id !== option.id)
                    : [...answer.optionIds, option.id]
                  : [option.id];

                onChange({ ...answer, optionIds });
              }}
              type={multiple ? 'checkbox' : 'radio'}
              value={option.id}
            />
            <span class="text-sm leading-5 text-slate-200">{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function QuizResult({
  onRestart,
  quiz,
  result,
}: {
  onRestart: () => void;
  quiz: QuizDetail;
  result: QuizAttemptResponse;
}) {
  const questionsById = useMemo(
    () => new Map(quiz.questions.map((question) => [question.id, question])),
    [quiz.questions],
  );

  return (
    <div class="space-y-5">
      <Card class="space-y-4 text-center" role="status">
        <Badge tone={result.attempt.passed ? 'success' : 'danger'}>
          {result.attempt.passed ? 'Quiz réussi' : 'Quiz à reprendre'}
        </Badge>
        <p class="text-4xl font-bold">{Math.round(result.attempt.score)} %</p>
        <p class="text-sm text-slate-300">
          Seuil de réussite : {Math.round(quiz.passingScore)} %
        </p>
        <Button class="w-full" onClick={onRestart} size="lg">
          Recommencer le quiz
        </Button>
      </Card>

      <section aria-labelledby="quiz-corrections-title" class="space-y-3">
        <h2 class="text-xl font-semibold" id="quiz-corrections-title">
          Correction
        </h2>
        {result.corrections.map((correction, index) => {
          const question = questionsById.get(correction.questionId);
          const correctLabels = question?.options
            .filter((option) => correction.correctOptionIds.includes(option.id))
            .map((option) => option.label);
          const expected =
            correctLabels && correctLabels.length > 0
              ? correctLabels.join(', ')
              : correction.acceptedAnswers.join(', ');

          return (
            <Card class="space-y-2" key={correction.questionId}>
              <div class="flex items-start justify-between gap-3">
                <h3 class="font-semibold">
                  Question {index + 1} — {question?.prompt}
                </h3>
                <Badge tone={correction.correct ? 'success' : 'danger'}>
                  {correction.correct ? 'Correct' : 'Incorrect'}
                </Badge>
              </div>
              <p class="text-sm leading-6 text-slate-300">
                {correction.explanation}
              </p>
              {!correction.correct && expected ? (
                <p class="text-sm text-slate-200">
                  Réponse attendue : {expected}
                </p>
              ) : null}
            </Card>
          );
        })}
      </section>
    </div>
  );
}

function QuizExperience({
  attempts,
  lessonHref,
  quiz,
}: {
  attempts: QuizAttempt[];
  lessonHref: string;
  quiz: QuizDetail;
}) {
  const mutation = useQuizAttemptMutation(quiz.id);
  const [answers, setAnswers] = useState<Record<string, DraftAnswer>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [message, setMessage] = useState<string>();
  const [result, setResult] = useState<QuizAttemptResponse>();
  const question = quiz.questions[currentIndex];

  if (!question) {
    return (
      <EmptyState
        action={
          <a class="text-cyan-300 underline" href={lessonHref}>
            Retour à la leçon
          </a>
        }
        description="Ce quiz ne contient aucune question."
        title="Quiz indisponible"
      />
    );
  }

  function restart() {
    setAnswers({});
    setCurrentIndex(0);
    setMessage(undefined);
    setResult(undefined);
  }

  async function continueQuiz() {
    if (!isAnswered(question, answers[question.id])) {
      setMessage('Répondez à cette question avant de continuer.');
      return;
    }

    setMessage(undefined);

    if (currentIndex < quiz.questions.length - 1) {
      setCurrentIndex((index) => index + 1);
      return;
    }

    try {
      setResult(await mutation.submit(toSubmittedAnswers(quiz, answers)));
    } catch {
      // L’erreur normalisée est affichée par le composant.
    }
  }

  if (result) {
    const historyAttempts = attempts.some(
      (attempt) => attempt.id === result.attempt.id,
    )
      ? attempts
      : [result.attempt, ...attempts];

    return (
      <div class="space-y-6">
        <QuizResult onRestart={restart} quiz={quiz} result={result} />
        <AttemptHistory attempts={historyAttempts} />
      </div>
    );
  }

  const answer = answers[question.id] ?? { optionIds: [], text: '' };

  return (
    <div class="space-y-6">
      <ProgressBar
        label={`Question ${currentIndex + 1} sur ${quiz.questions.length}`}
        max={quiz.questions.length}
        showValue={false}
        value={currentIndex + 1}
      />

      <form
        class="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void continueQuiz();
        }}
      >
        <Card class="space-y-5">
          <fieldset class="space-y-5">
            <legend class="text-xl font-semibold leading-7">
              {question.prompt}
            </legend>
            <QuestionOptions
              answer={answer}
              onChange={(nextAnswer) => {
                setAnswers((current) => ({
                  ...current,
                  [question.id]: nextAnswer,
                }));
                setMessage(undefined);
              }}
              question={question}
            />
          </fieldset>
          {message ? (
            <p class="text-sm text-red-300" role="alert">
              {message}
            </p>
          ) : null}
          {mutation.error ? (
            <ErrorState description="La tentative n’a pas pu être enregistrée." />
          ) : null}
          <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button
              disabled={currentIndex === 0 || mutation.isPending}
              onClick={() => {
                setCurrentIndex((index) => Math.max(0, index - 1));
                setMessage(undefined);
              }}
              variant="secondary"
            >
              Question précédente
            </Button>
            <Button isLoading={mutation.isPending} size="lg" type="submit">
              {currentIndex === quiz.questions.length - 1
                ? 'Envoyer mes réponses'
                : 'Question suivante'}
            </Button>
          </div>
        </Card>
      </form>

      <AttemptHistory attempts={attempts} />
    </div>
  );
}

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

      <QuizExperience
        attempts={attemptsQuery.data?.attempts ?? []}
        key={quiz.id}
        lessonHref={lessonHref}
        quiz={quiz}
      />
    </article>
  );
}
