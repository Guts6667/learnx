import { useState } from 'preact/hooks';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { SafeMarkdown } from '@/components/ui/SafeMarkdown';
import { Spinner } from '@/components/ui/Spinner';
import { Textarea } from '@/components/ui/Textarea';
import type { LessonExerciseSummary } from '@/features/curriculum/queries';
import {
  type ExerciseDetail,
  useExerciseMutation,
  useExerciseQuery,
} from '@/features/exercises/queries';
import { useI18n, type UiLocale } from '@/i18n';
import { formatLocalizedDate } from '@/shared/locale';

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
      <div class="space-y-3">
        <Badge tone="success">{t('exercise.submitted')}</Badge>
        <p class="text-sm text-slate-300">
          {t('exercise.submittedAt', {
            date: submission.submittedAt
              ? formatSubmissionDate(submission.submittedAt, locale)
              : t('exercise.unknownDate'),
          })}
        </p>
        <pre class="whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950 p-3 font-sans text-sm leading-6 text-slate-300">
          {submission.contentMarkdown}
        </pre>
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
    <div class="space-y-4">
      <Badge tone="neutral">{t('common.draft')}</Badge>
      <Textarea
        description={t('exercise.markdownHelp')}
        label={t('exercise.answerMarkdown')}
        maxLength={100_000}
        onInput={(event) => setContentMarkdown(event.currentTarget.value)}
        value={contentMarkdown}
      />
      <div class="flex flex-wrap gap-3">
        <Button
          isLoading={mutation.isPending}
          onClick={() => void saveDraft()}
          variant="secondary"
        >
          {t('exercise.saveDraft')}
        </Button>
        <Button
          disabled={!contentMarkdown.trim()}
          isLoading={mutation.isPending}
          onClick={() => void submitExercise()}
        >
          {t('exercise.submit')}
        </Button>
      </div>
      {mutation.error ? (
        <p class="text-sm text-red-300" role="alert">
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
    <Card class="space-y-4">
      <div class="flex items-start justify-between gap-3">
        <h3 class="font-semibold">{exercise.title}</h3>
        <Badge tone={exercise.isRequired ? 'warning' : 'neutral'}>
          {exercise.isRequired ? t('common.required') : t('exercise.optional')}
        </Badge>
      </div>
      <SafeMarkdown content={exercise.instructions} />
      {isLessonPublished ? (
        <PublishedExerciseCard exerciseId={exercise.id} />
      ) : (
        <div class="space-y-2">
          <Badge tone="warning">{t('common.draft')}</Badge>
          <p class="text-sm text-amber-200">
            {t('exercise.preview')}
          </p>
        </div>
      )}
    </Card>
  );
}
