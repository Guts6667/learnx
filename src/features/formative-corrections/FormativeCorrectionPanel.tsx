import { useMemo, useState } from 'preact/hooks';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Section } from '@/components/ui/Section';
import { Textarea } from '@/components/ui/Textarea';
import type { ExerciseSubmission } from '@/features/exercises/queries';
import {
  useFormativeCorrectionHistory,
  useFormativeCorrectionMutation,
} from '@/features/formative-corrections/queries';
import { useI18n, type UiLocale } from '@/i18n';
import { formatLocalizedDate } from '@/shared/locale';

function formatDate(value: string, locale: UiLocale): string {
  return formatLocalizedDate(value, locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

const stateKeys = {
  CLARIFICATION_REQUIRED:
    'formativeCorrection.state.CLARIFICATION_REQUIRED',
  FEEDBACK_READY: 'formativeCorrection.state.FEEDBACK_READY',
  REVISION_REQUIRED: 'formativeCorrection.state.REVISION_REQUIRED',
  TEMPORARILY_UNAVAILABLE:
    'formativeCorrection.state.TEMPORARILY_UNAVAILABLE',
} as const;

function CorrectionResult({
  correction,
}: {
  correction: NonNullable<
    ReturnType<typeof useFormativeCorrectionHistory>['data']
  >['flow']['corrections'][number];
}) {
  const { locale, t } = useI18n();
  const certificate = correction.certificate;
  const isUnavailable = correction.state === 'TEMPORARILY_UNAVAILABLE';

  return (
    <div aria-live="polite" class="space-y-5">
      <div class="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border-muted)] pb-4">
        <div>
          <p class="ui-eyebrow">{t('formativeCorrection.assistedLabel')}</p>
          <h3 class="mt-1 font-serif text-xl">
            {t(stateKeys[correction.state])}
          </h3>
        </div>
        <Badge tone={isUnavailable ? 'warning' : 'neutral'}>
          {t('formativeCorrection.version', { count: correction.version })}
        </Badge>
      </div>

      {isUnavailable ? (
        <div class="ui-feedback ui-feedback--warning" role="status">
          <h4 class="ui-feedback__title">
            {t('formativeCorrection.unavailableTitle')}
          </h4>
          <p class="ui-feedback__description">
            {t('formativeCorrection.unavailableDescription')}
          </p>
        </div>
      ) : certificate ? (
        <>
          <p class="ui-text-muted text-sm leading-6">
            {t('formativeCorrection.resultScope')}
          </p>
          {certificate.feedback.length > 0 ? (
            <ol class="divide-y divide-[var(--color-border-muted)] border-y border-[var(--color-border-muted)]">
              {certificate.feedback.map((item) => (
                <li class="space-y-3 py-5" key={`${item.elementKey}-${item.kind}`}>
                  <div class="space-y-1">
                    <p class="text-sm font-medium">{item.criterionLabel}</p>
                    <p class="leading-7">{item.message}</p>
                  </div>
                  {item.evidenceSpans.map((span) => (
                    <figure class="border-l-2 border-[var(--color-accent)] pl-4" key={span.spanId}>
                      <figcaption class="ui-text-muted mb-1 text-xs font-medium uppercase tracking-[0.08em]">
                        {t('formativeCorrection.responseExcerpt')}
                      </figcaption>
                      <blockquote class="font-serif text-base leading-7">
                        {span.text}
                      </blockquote>
                    </figure>
                  ))}
                </li>
              ))}
            </ol>
          ) : (
            <p class="ui-text-muted leading-7">
              {t('formativeCorrection.clarificationDescription')}
            </p>
          )}
        </>
      ) : null}

      <dl class="grid gap-3 border-t border-[var(--color-border-muted)] pt-4 text-sm sm:grid-cols-2">
        <div>
          <dt class="ui-text-muted">{t('formativeCorrection.savedAt')}</dt>
          <dd class="mt-1">{formatDate(correction.updatedAt, locale)}</dd>
        </div>
        <div>
          <dt class="ui-text-muted">{t('formativeCorrection.billing')}</dt>
          <dd class="mt-1">{t('formativeCorrection.noDebit')}</dd>
        </div>
      </dl>
      <p class="ui-text-muted text-sm leading-6">
        {t('formativeCorrection.noProgressionEffect')}
      </p>
    </div>
  );
}

export function FormativeCorrectionPanel({
  submission,
}: {
  submission: ExerciseSubmission;
}) {
  const { t } = useI18n();
  const history = useFormativeCorrectionHistory(submission.id);
  const mutation = useFormativeCorrectionMutation(submission.id);
  const [isEditingRevision, setIsEditingRevision] = useState(false);
  const corrections = history.data?.flow.corrections ?? [];
  const latest = corrections.at(-1);
  const [revisionText, setRevisionText] = useState(submission.contentMarkdown);
  const orderedHistory = useMemo(() => [...corrections].reverse(), [corrections]);

  if (history.isPending) return null;
  if (history.error) {
    return (
      <ErrorState
        action={
          <Button onClick={() => void history.refetch()} variant="secondary">
            {t('common.retry')}
          </Button>
        }
        description={t('formativeCorrection.loadErrorDescription')}
        title={t('formativeCorrection.loadErrorTitle')}
      />
    );
  }
  if (!history.data?.flow.enabled) return null;

  async function request(responseText: string) {
    const result = await mutation.request(responseText);
    if (result) {
      setRevisionText(result.responseText);
      setIsEditingRevision(false);
    }
  }

  return (
    <Section
      class="border-t border-[var(--color-border)] pt-6"
      description={t('formativeCorrection.description')}
      id="formative-correction-panel"
      title={t('formativeCorrection.title')}
    >
      <div class="space-y-6">
        <div class="ui-feedback ui-feedback--info">
          <h3 class="ui-feedback__title">
            {t('formativeCorrection.simulationTitle')}
          </h3>
          <p class="ui-feedback__description">
            {t('formativeCorrection.simulationDescription')}
          </p>
        </div>

        {!latest ? (
          <Button
            isLoading={mutation.isPending}
            onClick={() => void request(submission.contentMarkdown)}
          >
            {t('formativeCorrection.request')}
          </Button>
        ) : (
          <>
            <CorrectionResult correction={latest} />
            {latest.state === 'TEMPORARILY_UNAVAILABLE' ? (
              <Button
                isLoading={mutation.isPending}
                onClick={() => void mutation.retry(latest.id)}
              >
                {t('formativeCorrection.retry')}
              </Button>
            ) : isEditingRevision ? (
              <div class="space-y-4 border-t border-[var(--color-border-muted)] pt-5">
                <Textarea
                  description={t('formativeCorrection.fullResponseHelp')}
                  label={t('formativeCorrection.fullResponse')}
                  maxLength={100_000}
                  onInput={(event) => setRevisionText(event.currentTarget.value)}
                  value={revisionText}
                />
                <div class="flex flex-wrap gap-3">
                  <Button
                    disabled={!revisionText.trim()}
                    isLoading={mutation.isPending}
                    onClick={() => void request(revisionText)}
                  >
                    {t('formativeCorrection.submitRevision')}
                  </Button>
                  <Button
                    onClick={() => {
                      setRevisionText(latest.responseText);
                      setIsEditingRevision(false);
                    }}
                    variant="secondary"
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => {
                  setRevisionText(latest.responseText);
                  setIsEditingRevision(true);
                }}
                variant="secondary"
              >
                {t('formativeCorrection.revise')}
              </Button>
            )}
          </>
        )}

        {mutation.error ? (
          <p class="ui-text-danger text-sm" role="alert">
            {t('formativeCorrection.requestError')}
          </p>
        ) : null}

        {corrections.length > 1 ? (
          <details class="border-t border-[var(--color-border-muted)] pt-4">
            <summary class="min-h-11 cursor-pointer py-3 font-medium">
              {t('formativeCorrection.history', { count: corrections.length })}
            </summary>
            <ol class="mt-2 divide-y divide-[var(--color-border-muted)]">
              {orderedHistory.map((correction) => (
                <li class="flex min-h-11 items-center justify-between gap-4 py-3" key={correction.id}>
                  <span>
                    {t('formativeCorrection.version', {
                      count: correction.version,
                    })}
                  </span>
                  <span class="ui-text-muted text-sm">
                    {t(stateKeys[correction.state])}
                  </span>
                </li>
              ))}
            </ol>
          </details>
        ) : null}
      </div>
    </Section>
  );
}
