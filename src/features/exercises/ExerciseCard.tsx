import { useState } from 'preact/hooks';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
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
      <div class="totem-exercise-editor">
        <Button
          isLoading={mutation.isPending}
          onClick={() => void mutation.createDraft()}
        >
          {t('exercise.start')}
        </Button>
        <p class="totem-exercise-disclosure">
          {t('aiCorrection.doctrineNotice')}
        </p>
      </div>
    );
  }

  if (submission.status === 'SUBMITTED') {
    return (
      <div class="totem-exercise-submission space-y-3">
        <Badge tone="success">{t('exercise.submitted')}</Badge>
        <p class="ui-text-muted text-sm">
          {t('exercise.submittedAt', {
            date: submission.submittedAt
              ? formatSubmissionDate(submission.submittedAt, locale)
              : t('exercise.unknownDate'),
          })}
        </p>
        <pre class="totem-exercise-answer whitespace-pre-wrap text-sm leading-6">
          {submission.contentMarkdown}
        </pre>
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
    <div class="totem-exercise-editor space-y-4">
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
      <p class="totem-exercise-disclosure">
        {t('aiCorrection.doctrineNotice')}
      </p>
      {mutation.error ? (
        <p class="ui-text-danger text-sm" role="alert">
          {t('exercise.saveError')}
        </p>
      ) : null}
    </div>
  );
}

function rubricLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (typeof item === 'string' && item.trim()) return [item.trim()];
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    for (const key of ['label', 'title', 'name', 'criterion']) {
      const label = candidate[key];
      if (typeof label === 'string' && label.trim()) return [label.trim()];
    }
    return [];
  });
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
  const criteria = rubricLabels(exercise.rubric);
  return (
    <div class="totem-exercise-layout">
      <div>
        <section class="totem-exercise-prompt">
          <div class="flex items-center justify-between gap-3">
            <p class="page-eyebrow">{t('exercise.instruction')}</p>
            <Badge tone={exercise.isRequired ? 'warning' : 'neutral'}>
              {exercise.isRequired
                ? t('common.required')
                : t('exercise.optional')}
            </Badge>
          </div>
          <SafeMarkdown content={exercise.instructions} />
        </section>
        {isLessonPublished ? (
          <PublishedExerciseCard exerciseId={exercise.id} />
        ) : (
          <div class="mt-4 space-y-2">
            <Badge tone="warning">{t('common.draft')}</Badge>
            <p class="ui-text-warning text-sm">{t('exercise.preview')}</p>
          </div>
        )}
      </div>
      <aside class="totem-exercise-criteria">
        <p class="page-eyebrow">{t('exercise.announcedCriteria')}</p>
        {criteria.length > 0 ? (
          <ul>
            {criteria.map((criterion) => (
              <li key={criterion}>{criterion}</li>
            ))}
          </ul>
        ) : (
          <p>{t('exercise.criteriaAvailableWithPrompt')}</p>
        )}
        <a class="totem-learning-secondary-action" href="#lesson-title">
          <span>{t('exercise.reviewLesson')}</span>
          <span aria-hidden="true">↗</span>
        </a>
      </aside>
    </div>
  );
}
