import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { NavigationAction } from '@/components/ui/NavigationAction';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTodayQuery, type TodayResponse } from '@/features/today/query';
import type { MessageKey } from '@/i18n/catalogs';
import type { RecommendationKind } from '@/lib/recommendation';
import { useI18n, type UiLocale } from '@/i18n';
import { formatLocalizedDate } from '@/shared/locale';

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

function formatLastActivity(value: string, locale: UiLocale): string {
  return formatLocalizedDate(value, locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function TodayPage() {
  const query = useTodayQuery();
  const { t } = useI18n();

  return (
    <section aria-labelledby="today-title" class="page-shell">
      <PageHeader
        eyebrow={t('today.eyebrow')}
        id="today-title"
        title={t('today.title')}
      />

      {query.isPending ? (
        <Skeleton label={t('today.loading')} />
      ) : query.error ? (
        <ErrorState description={t('today.error')} />
      ) : query.data?.program ? (
        <TodayContent data={query.data} program={query.data.program} />
      ) : (
        <EmptyState
          action={
            <NavigationAction href="/program" variant="secondary">
              {t('today.viewPrograms')}
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
  program,
}: {
  data: TodayResponse;
  program: NonNullable<TodayResponse['program']>;
}) {
  const { locale, t } = useI18n();
  return (
    <div class="grid min-w-0 gap-5 lg:grid-cols-12">
      {data.action ? (
        <Card class="space-y-5 lg:col-span-7 lg:row-span-2" tone="accent">
          <Badge
            tone={data.action.kind === 'OVERDUE_REVIEW' ? 'danger' : 'info'}
          >
            {t(actionLabelKeys[data.action.kind])}
          </Badge>
          <div>
            <h2 class="text-xl font-semibold">{data.action.title}</h2>
            {data.action.stageTitle ? (
              <p class="mt-2 text-sm text-slate-300">
                {data.action.stageTitle}
                {data.action.moduleTitle ? ` · ${data.action.moduleTitle}` : ''}
                {data.action.lessonTitle ? ` · ${data.action.lessonTitle}` : ''}
              </p>
            ) : null}
            {data.action.estimatedMinutes ? (
              <p class="mt-1 text-sm text-slate-400">
                {t('today.duration', { count: data.action.estimatedMinutes })}
              </p>
            ) : null}
          </div>
          <NavigationAction class="w-full" href={data.action.href} size="lg">
            {t('common.continue')}
          </NavigationAction>
        </Card>
      ) : (
        <EmptyState
          class="lg:col-span-7 lg:row-span-2"
          description={t('today.upToDate.description')}
          title={t('today.upToDate.title')}
        />
      )}

      <Card class="space-y-4 lg:col-span-5">
        <div>
          <p class="text-sm text-slate-400">{t('today.activeProgram')}</p>
          <h2 class="mt-1 text-xl font-semibold">{program.title}</h2>
        </div>
        <ProgressBar
          label={t('today.progress', { count: Math.round(program.percent) })}
          value={program.percent}
        />
      </Card>

      <div class="grid gap-3 sm:grid-cols-2 lg:col-span-5">
        <Card>
          <p class="text-sm text-slate-400">{t('today.reviewsDue')}</p>
          <p class="mt-2 text-2xl font-bold">{data.reviewsDue}</p>
        </Card>
        <Card>
          <p class="text-sm text-slate-400">{t('today.lastActivity')}</p>
          {data.lastActivity ? (
            <NavigationAction
              class="mt-2 w-full"
              href={data.lastActivity.href}
              variant="ghost"
            >
              {data.lastActivity.title} ·{' '}
              {formatLastActivity(data.lastActivity.at, locale)}
            </NavigationAction>
          ) : (
            <p class="mt-2 text-sm text-slate-300">
              {t('today.noRecentActivity')}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
