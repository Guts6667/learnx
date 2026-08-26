import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { SafeMarkdown } from '@/components/ui/SafeMarkdown';
import { Spinner } from '@/components/ui/Spinner';
import { Textarea } from '@/components/ui/Textarea';
import { AiCorrectionPanel } from '@/features/exercises/AiCorrectionPanel';
import type { LessonExerciseSummary } from '@/features/curriculum/queries';
import {
  type ExerciseDetail,
  useExerciseMutation,
  useExerciseQuery,
} from '@/features/exercises/queries';
import { useI18n, type UiLocale } from '@/i18n';
import { MAX_EXERCISE_SUBMISSION_CHARACTERS } from '@/lib/exercises';
import { formatLocalizedDate, formatLocalizedNumber } from '@/shared/locale';

function formatSubmissionDate(value: string, locale: UiLocale): string {
  return formatLocalizedDate(value, locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function ExerciseEditor({ exercise }: { exercise: ExerciseDetail }) {
  const { locale, t } = useI18n();
  const mutation = useExerciseMutation(exercise.id);
  const submission = exercise.submission;
  const [contentMarkdown, setContentMarkdown] = useState(
    submission?.contentMarkdown ?? '',
  );
  const characterCount = contentMarkdown.length;
  const isOverLimit = characterCount > MAX_EXERCISE_SUBMISSION_CHARACTERS;

  if (!submission) {
    return (
      <Button
        isLoading={mutation.isPending}
        onClick={() => void mutation.createDraft()}
      >
        {t('exercise.start')}
      </Button>
    );
  }

  if (submission.status === 'SUBMITTED') {
    return (
      <div className="exercise-submission space-y-4">
        <div className="exercise-submission__meta">
          <Badge tone="success">{t('exercise.submitted')}</Badge>
          <p className="ui-text-muted text-sm">
            {t('exercise.submittedAt', {
              date: submission.submittedAt
                ? formatSubmissionDate(submission.submittedAt, locale)
                : t('exercise.unknownDate'),
            })}
          </p>
        </div>
        <section className="exercise-submission__response">
          <p className="page-eyebrow">{t('exercise.answerMarkdown')}</p>
          <pre>{submission.contentMarkdown}</pre>
        </section>
        {exercise.aiCorrectionEligible ? (
          <AiCorrectionPanel submissionId={submission.id} />
        ) : null}
      </div>
    );
  }

  const submissionId = submission.id;

  async function saveDraft() {
    await mutation.save(submissionId, contentMarkdown);
  }

  async function submitExercise() {
    await mutation.save(submissionId, contentMarkdown);
    await mutation.submit(submissionId);
  }

  return (
    <div className="space-y-4">
      <Badge tone="neutral">{t('common.draft')}</Badge>
      <Textarea
        description={
          isOverLimit
            ? undefined
            : t('exercise.answerLimit', {
                current: formatLocalizedNumber(characterCount, locale),
                maximum: formatLocalizedNumber(
                  MAX_EXERCISE_SUBMISSION_CHARACTERS,
                  locale,
                ),
              })
        }
        error={
          isOverLimit
            ? t('exercise.answerTooLong', {
                current: formatLocalizedNumber(characterCount, locale),
                maximum: formatLocalizedNumber(
                  MAX_EXERCISE_SUBMISSION_CHARACTERS,
                  locale,
                ),
              })
            : undefined
        }
        label={t('exercise.answerMarkdown')}
        maxLength={MAX_EXERCISE_SUBMISSION_CHARACTERS}
        onInput={(event) => setContentMarkdown(event.currentTarget.value)}
        value={contentMarkdown}
      />
      <p className="ui-text-muted text-sm">{t('exercise.markdownHelp')}</p>
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={isOverLimit}
          isLoading={mutation.isPending}
          onClick={() => void saveDraft()}
          variant="secondary"
        >
          {t('exercise.saveDraft')}
        </Button>
        <Button
          disabled={!contentMarkdown.trim() || isOverLimit}
          isLoading={mutation.isPending}
          onClick={() => void submitExercise()}
        >
          {t('exercise.submit')}
        </Button>
      </div>
      {mutation.error ? (
        <p className="ui-text-danger text-sm" role="alert">
          {t('exercise.saveError')}
        </p>
      ) : null}
    </div>
  );
}

function PublishedExerciseCard({ exerciseId }: { exerciseId: string }) {
  const query = useExerciseQuery(exerciseId);
  const { t } = useI18n();

  if (query.isPending) {
    return <Spinner label={t('exercise.loading')} size="sm" />;
  }

  if (query.error || !query.data?.exercise) {
    return <ErrorState description={t('exercise.unavailable')} />;
  }

  return <ExerciseEditor exercise={query.data.exercise} />;
}

export function ExerciseCard({
  exercise,
  isLessonPublished,
}: {
  exercise: LessonExerciseSummary;
  isLessonPublished: boolean;
}) {
  const { t } = useI18n();
  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold">{exercise.title}</h3>
        <Badge tone={exercise.isRequired ? 'warning' : 'neutral'}>
          {exercise.isRequired ? t('common.required') : t('exercise.optional')}
        </Badge>
      </div>
      <SafeMarkdown content={exercise.instructions} />
      {isLessonPublished ? (
        <PublishedExerciseCard exerciseId={exercise.id} />
      ) : (
        <div className="space-y-2">
          <Badge tone="warning">{t('common.draft')}</Badge>
          <p className="ui-text-warning text-sm">{t('exercise.preview')}</p>
        </div>
      )}
    </Card>
  );
}
