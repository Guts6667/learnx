import { useState } from 'preact/hooks';

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

  return (
    <section
      aria-labelledby="programs-title"
      class="page-layout page-layout--work page-shell"
    >
      <div class="flex min-w-0 items-start justify-between gap-4">
        <PageHeader
          description={t('programs.description')}
          eyebrow={t('programs.eyebrow')}
          id="programs-title"
          title={t('programs.mine')}
        />
        <NavigationAction
          aria-label={t('programs.exploreAction')}
          class="shrink-0"
          href="/discover"
          variant="secondary"
        >
          <span aria-hidden="true">⌕</span>
          <span class="hidden sm:inline">{t('programs.explore')}</span>
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
        <div class="ui-program-lines">
          <ul
            class="ui-list ui-program-list"
            aria-label={t('programs.enrolledSection')}
          >
            {programs.data.items.map(({ enrollment, program, progress }) => {
              const percent = progress?.percent ?? 0;
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
                    class="ui-program-line group"
                    href={`/program/${encodeURIComponent(program.slug)}`}
                  >
                    <div class="min-w-0 flex-1">
                    <h2 class="text-lg font-semibold group-hover:text-[var(--color-action)]">
                      {program.title}
                    </h2>
                    <p class="ui-text-muted mt-1 line-clamp-2 text-sm leading-6">
                      {program.description}
                    </p>
                    <p class="ui-text-muted mt-2 text-sm">
                      {status} ·{' '}
                      <ProgramDuration days={program.estimatedDurationDays} />
                    </p>
                    <ProgressBar
                      class="mt-4"
                      label={t('today.progress', { count: Math.round(percent) })}
                      showValue={false}
                      value={percent}
                    />
                    </div>
                    <span class="ui-program-line__action">
                      {percent > 0 ? t('common.continue') : t('programs.start')}
                      <span aria-hidden="true"> →</span>
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
      class="page-layout page-layout--work page-shell"
    >
      <PageHeader
        description={t('programs.catalogEmpty.description')}
        eyebrow={t('programs.eyebrow')}
        id="discover-title"
        title={t('programs.explore')}
      />

      <form
        class="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(searchInput.trim().replace(/\s+/g, ' '));
        }}
      >
        <label class="ui-field">
          <span class="ui-field__label">{t('programs.search')}</span>
          <input
            class="ui-field__control"
            onInput={(event) => setSearchInput(event.currentTarget.value)}
            placeholder={t('programs.searchPlaceholder')}
            type="search"
            value={searchInput}
          />
        </label>
        <label class="ui-field">
          <span class="ui-field__label">{t('programs.language.label')}</span>
          <select
            class="ui-field__control"
            onChange={(event) =>
              setCatalogLocale(event.currentTarget.value as typeof locale)
            }
            value={catalogLocale}
          >
            <option value="fr">{t('programs.language.fr')}</option>
            <option value="en">{t('programs.language.en')}</option>
          </select>
        </label>
        <Button type="submit" variant="secondary">
          {t('programs.searchAction')}
        </Button>
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
        <ul class="ui-list ui-program-list">
          {catalog.data.items.map((program) => (
            <li
              class="ui-program-line border-b border-[var(--color-border)] last:border-b-0"
              key={program.id}
            >
              <div class="min-w-0 flex-1">
                <h2 class="text-lg font-semibold">{program.title}</h2>
                <p class="ui-text-muted mt-2 text-sm leading-6">
                  {program.description}
                </p>
                <p class="ui-text-muted mt-3 text-sm">
                  <ProgramDuration days={program.estimatedDurationDays} /> ·{' '}
                  {t('programs.stageCount', { count: program.stageCount })}
                </p>
              </div>
              {program.isEnrolled ? (
                <NavigationAction
                  class="w-full sm:w-auto"
                  href={`/program/${encodeURIComponent(program.slug)}`}
                  variant="secondary"
                >
                  {t('programs.open')}
                </NavigationAction>
              ) : (
                <Button
                  class="w-full sm:w-auto"
                  isLoading={enrollment.pendingProgramId === program.id}
                  onClick={() => void enroll(program)}
                  variant="secondary"
                >
                  {t('programs.enroll')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {enrollment.error ? (
        <ErrorState description={t('programs.enrollmentError')} />
      ) : null}
      <p aria-live="polite" class="ui-text-muted text-sm" role="status">
        {announcement}
      </p>
    </section>
  );
}
