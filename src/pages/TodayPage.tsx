import { PrimaryResumeCard } from '@/components/product/PrimaryResumeCard';
import { ProductPageHeader } from '@/components/product/ProductPageHeader';
import { ProductRail } from '@/components/product/ProductRail';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { NavigationAction } from '@/components/ui/NavigationAction';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Section } from '@/components/ui/Section';
import { Skeleton } from '@/components/ui/Skeleton';
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

type TodayProgram = TodayResponse['programs'][number];

function normalizePrograms(data: TodayResponse): TodayProgram[] {
  if (Array.isArray(data.programs)) return data.programs;
  if (!data.program) return [];

  return [
    {
      ...data.program,
      lastActivity: data.lastActivity,
      nextAction:
        data.action?.programId === data.program.id ? data.action : null,
      resumeHref:
        data.action?.programId === data.program.id
          ? data.action.href
          : (data.lastActivity?.href ?? `/program/${data.program.slug}`),
      status:
        data.program.percent >= 100
          ? 'COMPLETED'
          : data.program.percent > 0
            ? 'IN_PROGRESS'
            : 'NOT_STARTED',
    },
  ];
}

export function TodayPage() {
  const query = useTodayQuery();
  const { t } = useI18n();

  return (
    <section
      aria-labelledby="today-title"
      class="page-layout page-layout--work page-shell"
    >
      <ProductPageHeader
        description={t('today.description')}
        eyebrow={t('today.eyebrow')}
        id="today-title"
        summary={
          query.data?.program
            ? {
                description: t('today.summary.description'),
                eyebrow: t('today.summary.eyebrow'),
                facts: [
                  {
                    label: t('today.summary.programs'),
                    value: query.data.programCount,
                  },
                  {
                    label: t('today.summary.reviews'),
                    value: query.data.reviewsDue,
                  },
                ],
                title: t('today.summary.title'),
              }
            : undefined
        }
        title={t('today.title')}
      />

      {query.isPending ? (
        <Skeleton label={t('today.loading')} />
      ) : query.error ? (
        <ErrorState
          action={
            <Button onClick={() => void query.reload()}>
              {t('common.retry')}
            </Button>
          }
          description={t('today.error')}
        />
      ) : query.data?.program ? (
        <TodayContent
          data={query.data}
          programs={normalizePrograms(query.data)}
        />
      ) : (
        <EmptyState
          action={
            <NavigationAction href="/program?view=discover&onboarding=1">
              {t('today.chooseFirstProgram')}
            </NavigationAction>
          }
          description={t('today.firstArrival.description')}
          title={t('today.firstArrival.title')}
        />
      )}
    </section>
  );
}

function TodayContent({
  data,
  programs,
}: {
  data: TodayResponse;
  programs: TodayProgram[];
}) {
  const { t } = useI18n();
  const primaryProgramId = data.action?.programId ?? data.program?.id;
  const primaryProgram =
    programs.find((program) => program.id === primaryProgramId) ?? programs[0];
  const secondaryPrograms = programs.filter(
    (program) => program.id !== primaryProgram?.id,
  );
  const visibleSecondaryPrograms = secondaryPrograms.slice(0, 5);
  const hiddenProgramCount = Math.max(
    (data.programCount ?? programs.length) -
      visibleSecondaryPrograms.length -
      (primaryProgram ? 1 : 0),
    0,
  );

  return (
    <div class="totem-product-layout">
      <div class="totem-product-main">
        {data.action && primaryProgram ? (
          <PrimaryResumeCard
          actionHref={data.action.href}
          actionLabel={t('common.continue')}
          eyebrow={
            <>
              <span>{primaryProgram.title}</span>
              <span aria-hidden="true"> · </span>
              <span>{t(actionLabelKeys[data.action.kind])}</span>
            </>
          }
          metadata={[
            [
              data.action.stageTitle,
              data.action.moduleTitle,
              data.action.lessonTitle,
            ]
              .filter(Boolean)
              .join(' · '),
            data.action.estimatedMinutes
              ? t('today.duration', { count: data.action.estimatedMinutes })
              : '',
          ].filter(Boolean)}
          progress={
            primaryProgram.percent > 0
              ? {
                  label: t('today.progressLabel'),
                  value: primaryProgram.percent,
                }
              : undefined
          }
          title={data.action.title}
        >
          {data.reviewsDue > 0 ? (
            <p class="ui-text-muted text-sm">
              {t('today.reviewsDueCount', { count: data.reviewsDue })}
            </p>
          ) : null}
          </PrimaryResumeCard>
        ) : primaryProgram ? (
          <Section title={primaryProgram.title}>
            <div class="space-y-4">
              <p class="ui-text-muted leading-7">
                {t('today.upToDate.description')}
              </p>
              {primaryProgram.percent > 0 ? (
                <ProgressBar
                  label={t('today.progressLabel')}
                  value={primaryProgram.percent}
                />
              ) : null}
              {primaryProgram.status === 'COMPLETED' ? (
                <Badge tone="info">{t('today.program.completed')}</Badge>
              ) : null}
            </div>
          </Section>
        ) : null}

        <dl class="totem-product-inline-facts">
          <div>
            <dd>{data.reviewsDue}</dd>
            <dt>{t('today.summary.reviews')}</dt>
          </div>
          <div>
            <dd>{data.programCount}</dd>
            <dt>{t('today.summary.programs')}</dt>
          </div>
        </dl>
      </div>

      {visibleSecondaryPrograms.length > 0 ? (
        <ProductRail
          action={
            <NavigationAction href="/program" variant="secondary">
              {t('today.viewMyPrograms')}
            </NavigationAction>
          }
          description={t('today.activePrograms.description')}
          eyebrow={t('today.otherPrograms.eyebrow')}
          id="today-other-programs-title"
          title={t('today.activePrograms.title')}
        >
          <ul class="totem-product-rows" role="list">
            {visibleSecondaryPrograms.map((program) => (
              <li key={program.id}>
                <ProgramResumeRow program={program} />
              </li>
            ))}
          </ul>
          {hiddenProgramCount > 0 ? (
            <p class="ui-text-muted mt-4 text-sm">
              {t('today.morePrograms', { count: hiddenProgramCount })}
            </p>
          ) : null}
        </ProductRail>
      ) : null}
    </div>
  );
}

function ProgramResumeRow({ program }: { program: TodayProgram }) {
  const { t } = useI18n();
  const statusKey: MessageKey =
    program.status === 'COMPLETED'
      ? 'today.program.completed'
      : program.status === 'IN_PROGRESS'
        ? 'today.program.inProgress'
        : 'today.program.notStarted';
  const actionLabel =
    program.status === 'NOT_STARTED'
      ? t('today.startProgram')
      : t('today.resumeProgram');

  return (
    <article class="totem-product-row">
      <div class="totem-product-row__content">
        <h3 class="font-semibold [overflow-wrap:anywhere]">{program.title}</h3>
        <p class="ui-text-muted text-sm">
          {t(statusKey)}
          {program.percent > 0 && program.status !== 'COMPLETED'
            ? ` · ${t('common.percent', { count: Math.round(program.percent) })}`
            : ''}
        </p>
        {program.lastActivity ? (
          <p class="ui-text-muted text-sm [overflow-wrap:anywhere]">
            {t('today.lastPosition')} · {program.lastActivity.title}
          </p>
        ) : null}
        {program.nextAction ? (
          <p class="ui-text-muted text-sm [overflow-wrap:anywhere]">
            {t('today.nextAction')} · {program.nextAction.title}
          </p>
        ) : null}
      </div>
      {program.status !== 'COMPLETED' && program.resumeHref ? (
        <NavigationAction
          aria-label={`${actionLabel} — ${program.title}`}
          class="totem-product-row__action"
          href={program.resumeHref}
          variant="ghost"
        >
          {actionLabel}
        </NavigationAction>
      ) : (
        <Badge tone="info">{t('today.program.completed')}</Badge>
      )}
    </article>
  );
}
