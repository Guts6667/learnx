import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { NavigationAction } from '@/components/ui/NavigationAction';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { useOnlineStatus } from '@/features/pwa/online-status';
import {
  type CatalogProgram,
  useCatalogProgramsQuery,
  useEnrolledProgramsQuery,
  useProgramEnrollmentMutation,
} from '@/features/programs/queries';
import { useTodayQuery } from '@/features/today/query';
import { useI18n } from '@/i18n';

function ProgramDuration({ days }: { days: number | null }) {
  const { t } = useI18n();
  return (
    <span>
      {days === null
        ? t('programs.durationUnknown')
        : t('programs.durationDays', { count: days })}
    </span>
  );
}

export function TotemProgramsPage() {
  const { t } = useI18n();
  const isOnline = useOnlineStatus();
  const programs = useEnrolledProgramsQuery('', 'ACTIVE', isOnline);
  const today = useTodayQuery();
  const todayProgramsById = new Map(
    (today.data?.programs ?? []).map((program) => [program.id, program]),
  );

  return (
    <section
      aria-labelledby="programs-title"
      className="totem-programs-page page-layout page-layout--work page-shell"
    >
      <div className="flex min-w-0 items-start justify-between gap-4">
        <PageHeader
          description={t('programs.description')}
          eyebrow={t('programs.eyebrow')}
          id="programs-title"
          title={t('programs.mine')}
        />
        <NavigationAction
          aria-label={t('programs.exploreAction')}
          className="shrink-0"
          href="/discover"
          variant="secondary"
        >
          <span aria-hidden="true">⌕</span>
          <span className="hidden sm:inline">{t('programs.explore')}</span>
        </NavigationAction>
      </div>

      {!isOnline ? (
        <ErrorState
          description={t('programs.offline.description')}
          title={t('programs.offline.title')}
        />
      ) : programs.isPending ? (
        <Skeleton label={t('programs.loadingMine')} />
      ) : programs.error ? (
        <ErrorState
          action={
            <Button onClick={() => void programs.reload()}>
              {t('common.retry')}
            </Button>
          }
          description={t('programs.mineError')}
        />
      ) : programs.data.items.length === 0 ? (
        <EmptyState
          action={
            <NavigationAction href="/discover">
              {t('programs.exploreAction')}
            </NavigationAction>
          }
          description={t('programs.emptyMine.description')}
          title={t('programs.emptyMine.title')}
        />
      ) : (
        <div className="totem-programs-list ui-program-lines">
          <header className="totem-programs-list__header">
            <h2>{t('programs.status.inProgress')}</h2>
            <span>
              {t('programs.activeCount', { count: programs.data.items.length })}
            </span>
          </header>
          <ul
            className="ui-list ui-program-list"
            aria-label={t('programs.enrolledSection')}
          >
            {programs.data.items.map(({ enrollment, program, progress }) => {
              const percent = progress?.percent ?? 0;
              const nextAction = todayProgramsById.get(program.id)?.nextAction;
              const status =
                percent >= 100
                  ? t('programs.status.completed')
                  : percent > 0
                    ? t('programs.status.inProgress')
                    : t('programs.status.notStarted');
              return (
                <li key={enrollment.id}>
                  <a
                    aria-label={`${percent > 0 ? t('common.continue') : t('programs.start')} — ${program.title}`}
                    className="ui-program-line group"
                    href={`/program/${encodeURIComponent(program.slug)}`}
                  >
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-semibold group-hover:text-[var(--color-action)]">
                        {program.title}
                      </h2>
                      <p className="ui-text-muted mt-2 text-sm">
                        {status} · {Math.round(percent)} %
                      </p>
                      {nextAction ? (
                        <p className="totem-programs-page__next">
                          <strong>{t('today.nextAction')}</strong> ·{' '}
                          {nextAction.title}
                        </p>
                      ) : null}
                      <ProgressBar
                        className="mt-4"
                        label={t('today.progress', {
                          count: Math.round(percent),
                        })}
                        showValue={false}
                        value={percent}
                      />
                    </div>
                    <span className="ui-program-line__action">
                      <span aria-hidden="true">›</span>
                      <span className="sr-only">
                        {percent > 0
                          ? t('common.continue')
                          : t('programs.start')}
                      </span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
          {programs.data.nextCursor ? (
            <Button
              isLoading={programs.isLoadingMore}
              onClick={() => void programs.loadMore()}
              variant="secondary"
            >
              {t('programs.showMore')}
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}

export function DiscoverProgramsPage() {
  const { locale, t } = useI18n();
  const isOnline = useOnlineStatus();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [catalogLocale, setCatalogLocale] = useState(locale);
  const [announcement, setAnnouncement] = useState('');
  const catalog = useCatalogProgramsQuery(search, catalogLocale, isOnline);
  const enrollment = useProgramEnrollmentMutation();

  async function enroll(program: CatalogProgram) {
    setAnnouncement('');
    try {
      await enrollment.execute(program.id, 'enroll');
      await catalog.reload();
      setAnnouncement(
        t('programs.addedAnnouncement', { title: program.title }),
      );
    } catch {
      // L’erreur normalisée est affichée sous le catalogue.
    }
  }

  return (
    <section
      aria-labelledby="discover-title"
      className="totem-discover-page page-layout page-layout--work page-shell"
    >
      <NavigationAction
        className="discover-back-link"
        href="/program"
        variant="ghost"
      >
        <span aria-hidden="true">‹</span> {t('programs.mine')}
      </NavigationAction>
      <PageHeader
        description={t('programs.discoverDescription')}
        eyebrow={t('programs.explore')}
        id="discover-title"
        title={t('programs.discoverTitle')}
      />

      <form
        className="discover-search"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(searchInput.trim().replace(/\s+/g, ' '));
        }}
      >
        <label className="ui-field discover-search__field">
          <span className="ui-field__label">{t('programs.search')}</span>
          <span aria-hidden="true" className="discover-search__icon">
            ⌕
          </span>
          <input
            className="ui-field__control"
            onInput={(event) => setSearchInput(event.currentTarget.value)}
            placeholder={t('programs.searchPlaceholder')}
            type="search"
            value={searchInput}
          />
        </label>
        <details className="discover-filters">
          <summary
            aria-label={t('programs.openFilters')}
            className="ui-action ui-action--secondary discover-filters__trigger"
            title={t('programs.openFilters')}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path
                d="M4 7h10M18 7h2M10 17h10M4 17h2M14 4v6M10 14v6"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.8"
              />
            </svg>
            <span className="sr-only">{t('programs.openFilters')}</span>
          </summary>
          <label className="ui-field discover-filters__panel">
            <span className="ui-field__label">
              {t('programs.language.label')}
            </span>
            <select
              className="ui-field__control"
              onChange={(event) =>
                setCatalogLocale(event.currentTarget.value as typeof locale)
              }
              value={catalogLocale}
            >
              <option value="fr">{t('programs.language.fr')}</option>
              <option value="en">{t('programs.language.en')}</option>
            </select>
          </label>
        </details>
      </form>

      {!isOnline ? (
        <ErrorState
          description={t('programs.offline.description')}
          title={t('programs.offline.title')}
        />
      ) : catalog.isPending ? (
        <Skeleton label={t('programs.loadingCatalog')} />
      ) : catalog.error ? (
        <ErrorState
          action={
            <Button onClick={() => void catalog.reload()}>
              {t('common.retry')}
            </Button>
          }
          description={t('programs.catalogError')}
        />
      ) : catalog.data.items.length === 0 ? (
        <EmptyState
          description={t('programs.catalogEmpty.description')}
          title={t('programs.catalogEmpty.title')}
        />
      ) : (
        <section
          className="totem-discover-results"
          aria-labelledby="discover-results-title"
        >
          <header className="totem-programs-list__header">
            <h2 id="discover-results-title">{t('programs.availableTitle')}</h2>
            <span>
              {t('programs.availableCount', {
                count: catalog.data.items.length,
              })}
            </span>
          </header>
          <ul className="ui-list ui-program-list">
            {catalog.data.items.map((program) => (
              <li
                className="ui-program-line border-b border-[var(--color-border)] last:border-b-0"
                key={program.id}
              >
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold">{program.title}</h2>
                  <p className="ui-text-muted mt-2 text-sm leading-6">
                    {program.description}
                  </p>
                  <p className="ui-text-muted mt-3 text-sm">
                    <ProgramDuration days={program.estimatedDurationDays} /> ·{' '}
                    {t('programs.stageCount', { count: program.stageCount })}
                  </p>
                </div>
                {program.isEnrolled ? (
                  <NavigationAction
                    aria-label={`${t('programs.open')} — ${program.title}`}
                    className="discover-result-action"
                    href={`/program/${encodeURIComponent(program.slug)}`}
                    variant="secondary"
                  >
                    <span aria-hidden="true">↗</span>
                    <span className="sr-only">{t('programs.open')}</span>
                  </NavigationAction>
                ) : (
                  <Button
                    className="discover-result-action"
                    isLoading={enrollment.pendingProgramId === program.id}
                    onClick={() => void enroll(program)}
                    variant="secondary"
                  >
                    <span aria-hidden="true">＋</span>
                    <span className="sr-only">{t('programs.enroll')}</span>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {enrollment.error ? (
        <ErrorState description={t('programs.enrollmentError')} />
      ) : null}
      <p aria-live="polite" className="ui-text-muted text-sm" role="status">
        {announcement}
      </p>
    </section>
  );
}
