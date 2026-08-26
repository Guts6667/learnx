import { Card } from '@/components/ui/Card';
import { QueryState } from '@/components/learnx/QueryState';
import { EmptyState } from '@/components/ui/EmptyState';
import { NavigationAction } from '@/components/ui/NavigationAction';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useTodayQuery, type TodayResponse } from '@/features/today/query';
import { useI18n } from '@/i18n';
import type { MessageKey } from '@/i18n/catalogs';
import type { RecommendationKind } from '@/lib/recommendation';

const actionLabelKeys: Record<RecommendationKind, MessageKey> = {
  DUE_TODAY_REVIEW: 'today.action.dueReview',
  INCOMPLETE_TASK: 'today.action.incompleteTask',
  NEXT_LESSON: 'today.action.nextLesson',
  NEXT_MODULE: 'today.action.nextModule',
  NEXT_STAGE: 'today.action.nextStage',
  OVERDUE_REVIEW: 'today.action.overdueReview',
  REQUIRED_EXERCISE: 'today.action.requiredExercise',
  REQUIRED_QUIZ: 'today.action.requiredQuiz',
};

export function TodayPage() {
  const query = useTodayQuery();
  const { t } = useI18n();
  const queryState = (
    <QueryState
      error={query.error}
      errorDescription={t('today.error')}
      isPending={query.isPending}
      loadingLabel={t('today.loading')}
      onRetry={query.reload}
      retryLabel={t('common.retry')}
    />
  );

  return (
    <section
      aria-labelledby="today-title"
      className="page-layout page-layout--work page-shell"
    >
      <PageHeader
        eyebrow={t('today.eyebrow')}
        id="today-title"
        title={t('today.title')}
      />

      {query.isPending || query.error ? (
        queryState
      ) : query.data?.program ? (
        <TodayContent
          data={query.data}
          otherPrograms={(query.data.programs ?? [])
            .filter((item) => item.id !== query.data?.program?.id)
            .slice(0, 3)}
        />
      ) : (
        <EmptyState
          action={
            <NavigationAction href="/discover">
              {t('today.emptyProgram.action')}
            </NavigationAction>
          }
          description={t('today.emptyProgram.description')}
          title={t('today.emptyProgram.title')}
        />
      )}
    </section>
  );
}

function TodayContent({
  data,
  otherPrograms,
}: {
  data: TodayResponse;
  otherPrograms: TodayResponse['programs'];
}) {
  const { t } = useI18n();
  const program = data.program;
  if (!program) return null;

  return (
    <div className="today-layout">
      <Card className="today-primary-card ui-signature-surface" tone="accent">
        <p className="page-eyebrow">
          {program.title} ·{' '}
          {data.action
            ? t(actionLabelKeys[data.action.kind])
            : t('today.upToDate.title')}
        </p>
        <div className="today-primary-card__copy">
          <h2 className="today-primary-card__title">
            {data.action?.title ?? t('today.upToDate.description')}
          </h2>
          <div className="today-primary-card__meta">
            {data.action?.estimatedMinutes ? (
              <span>
                {t('common.minutes', { count: data.action.estimatedMinutes })}
              </span>
            ) : null}
            {data.action?.stageTitle ? (
              <span>{data.action.stageTitle}</span>
            ) : null}
          </div>
        </div>
        <ProgressBar
          label={t('today.progress', { count: Math.round(program.percent) })}
          value={program.percent}
        />
        {data.action ? (
          <NavigationAction
            className="w-full sm:w-auto"
            href={data.action.href}
            size="lg"
          >
            {t('curriculum.lesson.resume')} <span aria-hidden="true">→</span>
          </NavigationAction>
        ) : (
          <NavigationAction
            className="w-full sm:w-auto"
            href={`/program/${encodeURIComponent(program.slug)}`}
            size="lg"
            variant="secondary"
          >
            {t('programs.open')}
          </NavigationAction>
        )}
      </Card>

      {otherPrograms.length ? (
        <section
          aria-labelledby="today-other-programs"
          className="today-secondary-programs"
        >
          <header className="today-secondary-programs__header">
            <h2 id="today-other-programs">{t('today.otherPrograms')}</h2>
            <span>
              {t('today.otherProgramsCount', { count: otherPrograms.length })}
            </span>
          </header>
          <ul className="ui-list ui-program-list">
            {otherPrograms.map((item) => (
              <li key={item.id}>
                <a
                  aria-label={`${t('common.continue')} — ${item.title}`}
                  className="ui-program-line ui-program-line--compact group"
                  href={
                    item.resumeHref ??
                    `/program/${encodeURIComponent(item.slug)}`
                  }
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold group-hover:text-[var(--color-action)]">
                      {item.title}
                    </h3>
                    <p className="ui-text-muted mt-1 text-sm">
                      {t('today.progress', {
                        count: Math.round(item.percent),
                      })}
                    </p>
                    {item.nextAction ? (
                      <p className="today-secondary-programs__next">
                        <strong>{t('today.nextAction')}</strong> ·{' '}
                        {item.nextAction.title}
                      </p>
                    ) : null}
                  </div>
                  <span
                    aria-hidden="true"
                    className="today-secondary-programs__arrow"
                  >
                    ›
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <div className="today-secondary-programs__footer">
            <NavigationAction href="/program" variant="ghost">
              {t('today.viewPrograms')}
            </NavigationAction>
          </div>
        </section>
      ) : null}
    </div>
  );
}
