import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { NavigationAction } from '@/components/ui/NavigationAction';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  type EnrolledProgram,
  useEnrolledProgramsQuery,
} from '@/features/programs/queries';
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
  const programs = useEnrolledProgramsQuery('', 'ACTIVE');
  const { t } = useI18n();

  return (
    <section
      aria-labelledby="today-title"
      class="page-layout page-layout--work page-shell"
    >
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
        <TodayContent
          data={query.data}
          otherPrograms={(programs.data.items ?? [])
            .filter((item) => item.program.id !== query.data?.program?.id)
            .slice(0, 3)}
          programsPending={programs.isPending}
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
  programsPending,
}: {
  data: TodayResponse;
  otherPrograms: EnrolledProgram[];
  programsPending: boolean;
}) {
  const { t } = useI18n();
  const program = data.program;
  if (!program) return null;

  return (
    <div class="grid min-w-0 gap-6">
      <Card class="ui-signature-surface space-y-5" tone="accent">
        <p class="page-eyebrow">
          {data.action
            ? t(actionLabelKeys[data.action.kind])
            : t('today.upToDate.title')}
        </p>
        <div class="max-w-3xl">
          <p class="ui-text-muted text-sm">{program.title}</p>
          <h2 class="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {data.action?.title ?? t('today.upToDate.description')}
          </h2>
          {data.action?.stageTitle ? (
            <p class="ui-text-muted mt-3 text-sm leading-6">
              {data.action.stageTitle}
              {data.action.moduleTitle ? ` · ${data.action.moduleTitle}` : ''}
              {data.action.lessonTitle ? ` · ${data.action.lessonTitle}` : ''}
            </p>
          ) : null}
        </div>
        <ProgressBar
          label={t('today.progress', { count: Math.round(program.percent) })}
          value={program.percent}
        />
        {data.action ? (
          <NavigationAction
            class="w-full sm:w-auto"
            href={data.action.href}
            size="lg"
          >
            {t('common.continue')}
          </NavigationAction>
        ) : (
          <NavigationAction
            class="w-full sm:w-auto"
            href={`/program/${encodeURIComponent(program.slug)}`}
            size="lg"
            variant="secondary"
          >
            {t('programs.open')}
          </NavigationAction>
        )}
      </Card>

      {programsPending ? (
        <Skeleton label={t('programs.loadingMine')} />
      ) : otherPrograms.length ? (
        <section aria-labelledby="today-other-programs" class="space-y-3">
          <h2 class="text-lg font-semibold" id="today-other-programs">
            {t('today.otherPrograms')}
          </h2>
          <ul class="ui-list ui-program-list">
            {otherPrograms.map(({ enrollment, program: item, progress }) => (
              <li key={enrollment.id}>
                <a
                  aria-label={`${t('common.continue')} — ${item.title}`}
                  class="ui-program-line ui-program-line--compact group"
                  href={`/program/${encodeURIComponent(item.slug)}`}
                >
                  <div class="min-w-0 flex-1">
                    <h3 class="font-semibold group-hover:text-[var(--color-action)]">
                      {item.title}
                    </h3>
                    <p class="ui-text-muted mt-1 text-sm">
                      {t('today.progress', {
                        count: Math.round(progress?.percent ?? 0),
                      })}
                    </p>
                  </div>
                  <span aria-hidden="true" class="text-xl">
                    →
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <div class="flex justify-center pt-2">
            <NavigationAction href="/program" variant="ghost">
              {t('today.viewPrograms')}
            </NavigationAction>
          </div>
        </section>
      ) : null}
    </div>
  );
}
