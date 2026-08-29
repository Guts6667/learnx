import { useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { NavigationAction } from '@/components/ui/NavigationAction';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Textarea } from '@/components/ui/Textarea';
import { useI18n, type UiLocale } from '@/i18n';
import { formatLocalizedDate, formatLocalizedNumber } from '@/shared/locale';

type AssessmentQuestionType =
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

interface AssessmentCorrection {
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

function formatAttemptDate(value: string, locale: UiLocale): string {
  return formatLocalizedDate(value, locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function AttemptHistory({
  attempts,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: {
  attempts: AssessmentAttempt[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => Promise<void>;
}) {
  const { locale, t } = useI18n();
  return (
    <section aria-labelledby="assessment-history-title" className="space-y-3">
      <h2 className="assessment-history__title" id="assessment-history-title">
        {t('assessment.previousAttempts')}
      </h2>
      {attempts.length === 0 ? (
        <p className="ui-text-muted text-sm">{t('assessment.noAttempts')}</p>
      ) : (
        <ol className="assessment-history">
          {attempts.map((attempt) => (
            <li className="assessment-history__row" key={attempt.id}>
              <div>
                <strong>
                  {t('assessment.run', {
                    date: formatAttemptDate(attempt.submittedAt, locale),
                    run: attempt.runSequence ?? 1,
                  })}
                </strong>
                <span>
                  {t('assessment.score', {
                    score: formatLocalizedNumber(
                      Math.round(attempt.score),
                      locale,
                    ),
                  })}
                </span>
              </div>
              <Badge tone={attempt.passed ? 'success' : 'warning'}>
                {t(attempt.passed ? 'assessment.passed' : 'assessment.retry')}
              </Badge>
            </li>
          ))}
        </ol>
      )}
      {hasMore && onLoadMore ? (
        <Button
          isLoading={isLoadingMore}
          onClick={() => void onLoadMore()}
          variant="secondary"
        >
          {t('common.loadMore')}
        </Button>
      ) : null}
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
  const { t } = useI18n();
  if (question.type === 'SHORT_ANSWER') {
    return (
      <Textarea
        label={t('assessment.answer')}
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
    <div className="space-y-3">
      {question.options.map((option) => {
        const checked = answer.optionIds.includes(option.id);

        return (
          <label
            className="ui-assessment-option flex min-h-12 cursor-pointer items-start gap-3 rounded-lg px-4 py-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--color-focus)]"
            key={option.id}
          >
            <input
              checked={checked}
              className="ui-checkbox mt-0.5 shrink-0"
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
            <span className="ui-text text-sm leading-5">{option.label}</span>
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
  passedHref,
  result,
}: {
  assessment: QuestionAssessment;
  labels: ExperienceLabels;
  onRestart: () => void;
  passedHref: string;
  result: AssessmentAttemptResponse;
}) {
  const { t } = useI18n();
  const questionsById = useMemo(
    () =>
      new Map(assessment.questions.map((question) => [question.id, question])),
    [assessment.questions],
  );
  const correctCount = result.corrections.filter(
    (correction) => correction.correct,
  ).length;
  const reinforceCount = result.corrections.length - correctCount;

  return (
    <div className="assessment-result">
      <section className="assessment-result__summary" role="status">
        <div className="assessment-result__heading">
          <div>
            <p className="page-eyebrow">{t('assessment.result')}</p>
            <h2>{t('assessment.resultSummaryTitle')}</h2>
          </div>
          <Badge tone={result.attempt.passed ? 'success' : 'warning'}>
            {result.attempt.passed ? labels.success : labels.failure}
          </Badge>
        </div>
        <p>
          {t(
            result.attempt.passed
              ? 'assessment.resultSuccessSummary'
              : 'assessment.resultFailureSummary',
          )}
        </p>
        <dl className="assessment-result__signals">
          <div>
            <dt>{t('assessment.acquiredCount')}</dt>
            <dd>{correctCount}</dd>
          </div>
          <div>
            <dt>{t('assessment.reinforceCount')}</dt>
            <dd>{reinforceCount}</dd>
          </div>
          <div className="assessment-result__score">
            <dt>{t('assessment.scoreLabel')}</dt>
            <dd>{Math.round(result.attempt.score)} %</dd>
          </div>
        </dl>
        <p className="assessment-result__threshold">
          {t('assessment.passingScore', {
            count: Math.round(assessment.passingScore),
          })}
        </p>
      </section>

      <section
        aria-labelledby="assessment-corrections-title"
        className="assessment-result__corrections"
      >
        <h2 id="assessment-corrections-title">{t('assessment.correction')}</h2>
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
            <article
              className="assessment-result__criterion"
              key={correction.questionId}
            >
              <div className="assessment-result__criterion-heading">
                <h3>
                  {t('assessment.question', {
                    count: index + 1,
                    prompt: question?.prompt ?? '',
                  })}
                </h3>
                <Badge tone={correction.correct ? 'success' : 'warning'}>
                  {t(
                    correction.correct
                      ? 'assessment.correct'
                      : 'assessment.incorrect',
                  )}
                </Badge>
              </div>
              <p>{correction.explanation}</p>
              {!correction.correct && expected ? (
                <p className="assessment-result__expected">
                  {t('assessment.expectedAnswer', { answer: expected })}
                </p>
              ) : null}
            </article>
          );
        })}
      </section>

      <section className="assessment-result__next">
        <p className="page-eyebrow">{t('assessment.nextAction')}</p>
        <h2>
          {t(
            result.attempt.passed
              ? 'assessment.nextActionPassed'
              : 'assessment.nextActionRetry',
          )}
        </h2>
        {result.attempt.passed ? (
          <NavigationAction href={passedHref} size="lg">
            {t('assessment.continuePath')}
          </NavigationAction>
        ) : (
          <Button onClick={onRestart} size="lg">
            {labels.restart}
          </Button>
        )}
      </section>
    </div>
  );
}

export function QuestionAssessmentExperience({
  assessment,
  attempts,
  backHref,
  error,
  hasMoreAttempts,
  isPending,
  isLoadingMoreAttempts,
  labels,
  onLoadMoreAttempts,
  onSubmit,
  passedHref,
}: {
  assessment: QuestionAssessment;
  attempts: AssessmentAttempt[];
  backHref: string;
  error: unknown;
  hasMoreAttempts?: boolean;
  isPending: boolean;
  isLoadingMoreAttempts?: boolean;
  labels: ExperienceLabels;
  passedHref: string;
  onSubmit: (
    answers: SubmittedAssessmentAnswer[],
  ) => Promise<AssessmentAttemptResponse>;
  onLoadMoreAttempts?: () => Promise<void>;
}) {
  const { t } = useI18n();
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
          <NavigationAction href={backHref} variant="secondary">
            {t('assessment.openLesson')}
          </NavigationAction>
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
      setMessage(t('assessment.answerRequired'));
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
        aria-label={t('assessment.result')}
        className="space-y-6 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
        ref={resultRef}
        tabIndex={-1}
      >
        <AssessmentResult
          assessment={assessment}
          labels={labels}
          onRestart={restart}
          passedHref={passedHref}
          result={result}
        />
        <AttemptHistory
          attempts={historyAttempts}
          hasMore={hasMoreAttempts}
          isLoadingMore={isLoadingMoreAttempts}
          onLoadMore={onLoadMoreAttempts}
        />
      </div>
    );
  }

  const answer = answers[question.id] ?? { optionIds: [], text: '' };

  return (
    <div className="assessment-experience">
      <ProgressBar
        label={t('assessment.questionPosition', {
          current: currentIndex + 1,
          total: assessment.questions.length,
        })}
        max={assessment.questions.length}
        showValue={false}
        value={currentIndex + 1}
      />

      <form
        className="assessment-experience__form"
        onSubmit={(event) => {
          event.preventDefault();
          void continueAssessment();
        }}
      >
        <Card className="assessment-question-card">
          <fieldset className="space-y-5">
            <legend
              className="rounded-lg text-xl font-semibold leading-7 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
              ref={questionTitleRef}
              tabIndex={-1}
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
            <p className="ui-text-danger text-sm" role="alert">
              {message}
            </p>
          ) : null}
          {error ? (
            <ErrorState description={t('assessment.saveError')} />
          ) : null}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button
              disabled={currentIndex === 0 || isPending}
              onClick={() => {
                setCurrentIndex((index) => Math.max(0, index - 1));
                setMessage(undefined);
              }}
              variant="secondary"
            >
              {t('assessment.previousQuestion')}
            </Button>
            <Button isLoading={isPending} size="lg" type="submit">
              {currentIndex === assessment.questions.length - 1
                ? t('assessment.submit')
                : t('assessment.nextQuestion')}
            </Button>
          </div>
        </Card>
      </form>

      <AttemptHistory
        attempts={attempts}
        hasMore={hasMoreAttempts}
        isLoadingMore={isLoadingMoreAttempts}
        onLoadMore={onLoadMoreAttempts}
      />
    </div>
  );
}
