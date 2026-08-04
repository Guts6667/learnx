import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Textarea } from '@/components/ui/Textarea';

export type AssessmentQuestionType =
  'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'SINGLE_CHOICE' | 'TRUE_FALSE';

export interface AssessmentQuestion {
  id: string;
  options: Array<{ id: string; label: string; position: number }>;
  position: number;
  prompt: string;
  type: AssessmentQuestionType;
}

export interface AssessmentAttempt {
  answers: unknown;
  id: string;
  passed: boolean;
  score: number;
  submittedAt: string;
  runSequence?: number;
}

export interface SubmittedAssessmentAnswer {
  optionIds: string[];
  questionId: string;
  text?: string;
}

export interface AssessmentCorrection {
  acceptedAnswers: string[];
  correct: boolean;
  correctOptionIds: string[];
  explanation: string;
  questionId: string;
}

export interface AssessmentAttemptResponse {
  attempt: AssessmentAttempt;
  corrections: AssessmentCorrection[];
}

export interface QuestionAssessment {
  id: string;
  passingScore: number;
  questions: AssessmentQuestion[];
}

interface DraftAnswer {
  optionIds: string[];
  text: string;
}

interface ExperienceLabels {
  emptyDescription: string;
  emptyTitle: string;
  failure: string;
  restart: string;
  success: string;
}

function isAnswered(
  question: AssessmentQuestion,
  answer?: DraftAnswer,
): boolean {
  return question.type === 'SHORT_ANSWER'
    ? Boolean(answer?.text.trim())
    : Boolean(answer?.optionIds.length);
}

function toSubmittedAnswers(
  assessment: QuestionAssessment,
  answers: Record<string, DraftAnswer>,
): SubmittedAssessmentAnswer[] {
  return assessment.questions.map((question) => {
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

function AttemptHistory({ attempts }: { attempts: AssessmentAttempt[] }) {
  return (
    <section aria-labelledby="assessment-history-title" class="space-y-3">
      <h2 class="text-xl font-semibold" id="assessment-history-title">
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
                    Reprise {attempt.runSequence ?? 1} ·{' '}
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
  question: AssessmentQuestion;
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

function AssessmentResult({
  assessment,
  labels,
  onRestart,
  result,
}: {
  assessment: QuestionAssessment;
  labels: ExperienceLabels;
  onRestart: () => void;
  result: AssessmentAttemptResponse;
}) {
  const questionsById = useMemo(
    () =>
      new Map(assessment.questions.map((question) => [question.id, question])),
    [assessment.questions],
  );

  return (
    <div class="space-y-5">
      <Card class="space-y-4 text-center" role="status">
        <Badge tone={result.attempt.passed ? 'success' : 'danger'}>
          {result.attempt.passed ? labels.success : labels.failure}
        </Badge>
        <p class="text-4xl font-bold">{Math.round(result.attempt.score)} %</p>
        <p class="text-sm text-slate-300">
          Seuil de réussite : {Math.round(assessment.passingScore)} %
        </p>
        <Button class="w-full" onClick={onRestart} size="lg">
          {labels.restart}
        </Button>
      </Card>

      <section aria-labelledby="assessment-corrections-title" class="space-y-3">
        <h2 class="text-xl font-semibold" id="assessment-corrections-title">
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

export function QuestionAssessmentExperience({
  assessment,
  attempts,
  backHref,
  error,
  isPending,
  labels,
  nextHref,
  onSubmit,
}: {
  assessment: QuestionAssessment;
  attempts: AssessmentAttempt[];
  backHref: string;
  error: unknown;
  isPending: boolean;
  labels: ExperienceLabels;
  nextHref?: string | null;
  onSubmit: (
    answers: SubmittedAssessmentAnswer[],
  ) => Promise<AssessmentAttemptResponse>;
}) {
  const [answers, setAnswers] = useState<Record<string, DraftAnswer>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [message, setMessage] = useState<string>();
  const [result, setResult] = useState<AssessmentAttemptResponse>();
  const questionTitleRef = useRef<HTMLLegendElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const question = assessment.questions[currentIndex];

  useEffect(() => {
    if (result) {
      resultRef.current?.focus();
      return;
    }

    if (currentIndex > 0) questionTitleRef.current?.focus();
  }, [currentIndex, result]);

  if (!question) {
    return (
      <EmptyState
        action={
          <a
            class="inline-flex min-h-11 items-center rounded-lg text-cyan-300 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
            href={backHref}
          >
            Ouvrir la leçon
          </a>
        }
        description={labels.emptyDescription}
        title={labels.emptyTitle}
      />
    );
  }

  function restart() {
    setAnswers({});
    setCurrentIndex(0);
    setMessage(undefined);
    setResult(undefined);
  }

  async function continueAssessment() {
    if (!isAnswered(question, answers[question.id])) {
      setMessage('Répondez à cette question avant de continuer.');
      return;
    }

    setMessage(undefined);

    if (currentIndex < assessment.questions.length - 1) {
      setCurrentIndex((index) => index + 1);
      return;
    }

    try {
      setResult(await onSubmit(toSubmittedAnswers(assessment, answers)));
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
      <div
        aria-label="Résultat de l’évaluation"
        class="space-y-6 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
        ref={resultRef}
        tabindex={-1}
      >
        <AssessmentResult
          assessment={assessment}
          labels={labels}
          onRestart={restart}
          result={result}
        />
        <nav
          aria-label="Suite de la leçon"
          class="flex flex-wrap gap-3 rounded-xl border border-slate-800 p-4"
        >
          {nextHref ? (
            <a
              class="inline-flex min-h-11 items-center rounded-xl bg-cyan-400 px-4 text-sm font-semibold text-slate-950"
              href={nextHref}
            >
              Activité suivante
            </a>
          ) : null}
        </nav>
        <AttemptHistory attempts={historyAttempts} />
      </div>
    );
  }

  const answer = answers[question.id] ?? { optionIds: [], text: '' };

  return (
    <div class="space-y-6">
      <ProgressBar
        label={`Question ${currentIndex + 1} sur ${assessment.questions.length}`}
        max={assessment.questions.length}
        showValue={false}
        value={currentIndex + 1}
      />

      <form
        class="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void continueAssessment();
        }}
      >
        <Card class="space-y-5">
          <fieldset class="space-y-5">
            <legend
              class="rounded-lg text-xl font-semibold leading-7 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
              ref={questionTitleRef}
              tabindex={-1}
            >
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
          {error ? (
            <ErrorState description="La tentative n’a pas pu être enregistrée." />
          ) : null}
          <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button
              disabled={currentIndex === 0 || isPending}
              onClick={() => {
                setCurrentIndex((index) => Math.max(0, index - 1));
                setMessage(undefined);
              }}
              variant="secondary"
            >
              Question précédente
            </Button>
            <Button isLoading={isPending} size="lg" type="submit">
              {currentIndex === assessment.questions.length - 1
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
