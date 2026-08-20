import { route } from 'preact-router';
import { useRef, useState } from 'preact/hooks';

import { useBackNavigationTarget } from '@/components/layout/BackNavigationContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { NavigationAction } from '@/components/ui/NavigationAction';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { StageAssessmentCard } from '@/features/stage-assessments/StageAssessmentCard';
import { useOnlineStatus } from '@/features/pwa/online-status';
import {
  type CatalogProgram,
  type EnrolledProgram,
  type EnrollmentStatus,
  useCatalogProgramsQuery,
  useEnrolledProgramsQuery,
  useProgramEnrollmentMutation,
} from '@/features/programs/queries';
import {
  type LessonSummary,
  type ProgramSummary,
  type StageSummary,
  type StageValidation,
  useModuleQuery,
  useModuleRestart,
  useProgramQuery,
  useProgramRestart,
  useProgramsQuery,
  useProgramViewPreference,
  useStageQuery,
} from '@/features/curriculum/queries';
import type { TodayResponse } from '@/features/today/query';
import { useI18n } from '@/i18n';
import type { MessageKey } from '@/i18n/catalogs';
import { apiRequest } from '@/lib/api-client';
import { programStageHref } from '@/lib/curriculum-navigation';

function lessonStatusLabel(lesson: LessonSummary, t: Translate): string {
  if (!lesson.isPublished) return t('common.draft');
  if (lesson.isLocked) return t('curriculum.status.locked');
  if (lesson.progress.status === 'COMPLETED')
    return t('curriculum.status.completed');
  if (lesson.progress.status === 'IN_PROGRESS')
    return t('curriculum.status.inProgress');
  if (lesson.progress.status === 'NEEDS_REVIEW')
    return t('curriculum.status.review');
  return t('curriculum.status.available');
}

function nextActivityLabel(lesson: LessonSummary, t: Translate): string {
  if (lesson.isLocked) return t('curriculum.lesson.next.locked');
  if (lesson.progress.status === 'COMPLETED')
    return t('curriculum.lesson.next.review');
  if (lesson.progress.status === 'IN_PROGRESS')
    return t('curriculum.lesson.next.resume');
  return lesson.isPublished
    ? t('curriculum.lesson.next.start')
    : t('curriculum.lesson.next.preview');
}

function LessonSummaryCard({
  lesson,
  programSlug,
  stageSlug,
}: {
  lesson: LessonSummary;
  programSlug: string;
  stageSlug: string;
}) {
  const { t } = useI18n();
  const counts = lesson.activityCounts;
  const activityTotal =
    counts.resources +
    counts.tasks +
    counts.concepts +
    counts.exercises +
    counts.quizzes;
  const actionLabel =
    lesson.progress.status === 'COMPLETED'
      ? t('curriculum.lesson.review')
      : lesson.progress.status === 'IN_PROGRESS'
        ? t('common.continue')
        : t('curriculum.lesson.start');

  return (
    <Card class="space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="text-lg font-semibold">{lesson.title}</h3>
          <p class="ui-text-muted mt-2 text-sm leading-6">{lesson.summary}</p>
        </div>
        <Badge tone={lesson.isPublished ? 'info' : 'warning'}>
          {lessonStatusLabel(lesson, t)}
        </Badge>
      </div>
      <p class="ui-text-muted text-sm">
        {lesson.estimatedMinutes === null
          ? t('curriculum.durationUnknown')
          : `${lesson.estimatedMinutes} min`}{' '}
        · {t('curriculum.activityCount', { count: activityTotal })}
      </p>
      <p class="ui-text-muted text-sm">
        {t('curriculum.lesson.nextLabel', {
          activity: nextActivityLabel(lesson, t),
        })}
      </p>
      <ProgressBar
        label={t('curriculum.lesson.progress', {
          count: Math.round(lesson.progress.percent),
        })}
        value={lesson.progress.percent}
      />
      <details class="ui-divider rounded-lg border px-4 py-3 text-sm">
        <summary class="ui-text min-h-11 cursor-pointer py-2 font-medium">
          {t('curriculum.lesson.details')}
        </summary>
        <ul class="ui-text-muted space-y-1 pb-2">
          <li>
            {t('curriculum.lesson.resources', { count: counts.resources })}
          </li>
          <li>{t('curriculum.lesson.tasks', { count: counts.tasks })}</li>
          <li>{t('curriculum.lesson.concepts', { count: counts.concepts })}</li>
          <li>
            {t('curriculum.lesson.exercises', { count: counts.exercises })}
          </li>
          <li>{t('curriculum.lesson.quizzes', { count: counts.quizzes })}</li>
        </ul>
      </details>
      <NavigationAction
        href={
          lesson.isLocked
            ? `/program/${encodeURIComponent(programSlug)}/stage/${encodeURIComponent(stageSlug)}`
            : `/program/${encodeURIComponent(programSlug)}/lesson/${encodeURIComponent(lesson.slug)}`
        }
      >
        {lesson.isLocked
          ? t('curriculum.lesson.prerequisites')
          : lesson.isPublished
            ? actionLabel
            : t('curriculum.lesson.preview')}
      </NavigationAction>
    </Card>
  );
}

function getQueryState(error: unknown, isPending: boolean, t: Translate) {
  if (isPending) {
    return <Skeleton label={t('curriculum.loading')} />;
  }

  if (error) {
    return <ErrorState description={t('curriculum.loadError')} />;
  }

  return null;
}

function ProgressPlaceholder() {
  const { t } = useI18n();
  return <ProgressBar label={t('curriculum.progressSoon')} value={0} />;
}

function DraftBadge() {
  const { t } = useI18n();
  return <Badge tone="warning">{t('common.draft')}</Badge>;
}

const progressStatusKeys = {
  AVAILABLE: 'curriculum.status.available',
  COMPLETED: 'curriculum.status.completed',
  IN_PROGRESS: 'curriculum.status.inProgress',
  LOCKED: 'curriculum.status.locked',
} as const;

const lessonProgressIcons = {
  AVAILABLE: '○',
  COMPLETED: '✓',
  IN_PROGRESS: '◐',
  LOCKED: '⌧',
  NEEDS_REVIEW: '↻',
  PREVIEW: '◇',
} as const;

function formatStageDuration(stage: StageSummary, t: Translate): string {
  if (stage.estimatedDurationDays !== null) {
    return `${stage.estimatedDurationDays} j`;
  }
  if (stage.estimatedMinutes !== null) return `${stage.estimatedMinutes} min`;
  return t('curriculum.durationUnknown');
}

function formatLessonDuration(lesson: LessonSummary, t: Translate): string {
  return lesson.estimatedMinutes === null
    ? t('curriculum.durationUnknown')
    : `${lesson.estimatedMinutes} min`;
}

function lessonLineStatus(lesson: LessonSummary, t: Translate) {
  if (!lesson.isPublished) {
    return {
      icon: lessonProgressIcons.PREVIEW,
      label: t('common.draft'),
      tone: 'warning' as const,
    };
  }
  if (lesson.isLocked) {
    return {
      icon: lessonProgressIcons.LOCKED,
      label: t('curriculum.status.locked'),
      tone: 'neutral' as const,
    };
  }
  return {
    icon: lessonProgressIcons[lesson.progress.status],
    label: lessonStatusLabel(lesson, t),
    tone:
      lesson.progress.status === 'IN_PROGRESS'
        ? ('info' as const)
        : lesson.progress.status === 'COMPLETED'
          ? ('success' as const)
          : ('neutral' as const),
  };
}

function ProgramLessonRow({
  lesson,
  moduleTitle,
  programSlug,
}: {
  lesson: LessonSummary;
  moduleTitle: string;
  programSlug: string;
}) {
  const { t } = useI18n();
  const status = lessonLineStatus(lesson, t);
  const content = (
    <>
      <span class="min-w-0 flex-1 lg:flex lg:items-center lg:justify-between lg:gap-4">
        <span
          class={`block min-w-0 break-words font-medium ${
            lesson.isLocked ? 'ui-text-muted' : 'ui-text'
          }`}
        >
          {lesson.title}
        </span>
        <span class="mt-2 flex flex-wrap items-center gap-2 lg:mt-0 lg:shrink-0">
          <span class="ui-text-muted text-sm">
            {formatLessonDuration(lesson, t)}
          </span>
          <Badge class="gap-1" tone={status.tone}>
            <span aria-hidden="true">{status.icon}</span>
            {status.label}
          </Badge>
        </span>
      </span>
      <span
        aria-hidden="true"
        class="ui-text-muted flex min-h-11 w-8 shrink-0 items-center justify-end text-lg"
      >
        {lesson.isLocked ? '⌧' : '›'}
      </span>
    </>
  );
  const className =
    'ui-divider flex min-h-16 w-full min-w-0 items-center gap-3 border-t px-2 py-4 text-left first:border-t-0 sm:px-1';

  if (lesson.isLocked) {
    return (
      <div
        aria-label={t('curriculum.lesson.lockedAria', {
          module: moduleTitle,
          status: status.label,
          title: lesson.title,
        })}
        class={`${className} ui-text-muted cursor-not-allowed`}
      >
        {content}
      </div>
    );
  }

  const action =
    lesson.progress.status === 'COMPLETED'
      ? t('curriculum.lesson.review')
      : lesson.progress.status === 'IN_PROGRESS'
        ? t('curriculum.lesson.resume')
        : t('curriculum.lesson.open');

  return (
    <a
      aria-label={t('curriculum.lesson.aria', {
        action,
        module: moduleTitle,
        status: status.label,
        title: lesson.title,
      })}
      class={`${className} rounded-lg hover:bg-[var(--color-surface-subtle)] focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]`}
      href={`/program/${encodeURIComponent(programSlug)}/lesson/${encodeURIComponent(lesson.slug)}`}
    >
      {content}
    </a>
  );
}

function ModuleLessonList({
  module,
  programSlug,
  showHeading,
}: {
  module: StageSummary['modules'][number];
  programSlug: string;
  showHeading: boolean;
}) {
  const { t } = useI18n();
  const listId = `program-module-lessons-${module.id}`;
  const optionsHref = `/program/${encodeURIComponent(programSlug)}/module/${encodeURIComponent(module.slug)}`;

  return (
    <section aria-labelledby={showHeading ? `${listId}-title` : undefined}>
      {showHeading ? (
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 class="ui-text font-semibold" id={`${listId}-title`}>
            {module.title}
          </h3>
          <NavigationAction href={optionsHref} variant="ghost">
            {t('curriculum.moduleOptionsRestart')}
          </NavigationAction>
        </div>
      ) : null}
      <ul
        aria-label={
          showHeading
            ? undefined
            : t('curriculum.moduleLessons', { title: module.title })
        }
        id={listId}
      >
        {module.lessons.map((lesson) => (
          <li key={lesson.id}>
            <ProgramLessonRow
              lesson={lesson}
              moduleTitle={module.title}
              programSlug={programSlug}
            />
          </li>
        ))}
      </ul>
      {!showHeading ? (
        <NavigationAction class="mt-3" href={optionsHref} variant="ghost">
          {t('curriculum.moduleOptionsRestart')}
        </NavigationAction>
      ) : null}
    </section>
  );
}

function StageAccordionItem({
  isExpanded,
  onToggle,
  programSlug,
  stage,
}: {
  isExpanded: boolean;
  onToggle: () => void;
  programSlug: string;
  stage: StageSummary;
}) {
  const { t } = useI18n();
  const panelId = `program-stage-panel-${stage.id}`;
  const statusLabel = stage.isPublished
    ? t(progressStatusKeys[stage.progress.status])
    : t('common.draft');
  const statusTone = !stage.isPublished
    ? 'warning'
    : stage.progress.status === 'IN_PROGRESS'
      ? 'info'
      : stage.progress.status === 'COMPLETED'
        ? 'success'
        : 'neutral';
  const showModuleHeadings = stage.modules.length > 1;

  return (
    <li>
      <Card class="overflow-hidden p-0">
        <button
          aria-controls={panelId}
          aria-expanded={isExpanded}
          class="flex min-h-20 w-full items-center gap-3 rounded-lg px-4 py-5 text-left transition-colors hover:bg-[var(--color-surface-raised)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-focus)] motion-reduce:transition-none sm:px-5"
          onClick={onToggle}
          type="button"
        >
          <span class="min-w-0 flex-1">
            <span class="flex flex-wrap items-center gap-2">
              <span class="ui-text font-semibold">
                {stage.position}. {stage.title}
              </span>
            </span>
            <span class="ui-text-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span>{formatStageDuration(stage, t)}</span>
              <Badge class="gap-1" tone={statusTone}>
                <span aria-hidden="true">
                  {lessonProgressIcons[stage.progress.status]}
                </span>
                {statusLabel}
              </Badge>
            </span>
          </span>
          <span
            aria-hidden="true"
            class={`ui-text-muted text-xl transition-transform motion-reduce:transition-none ${
              isExpanded ? 'rotate-180' : ''
            }`}
          >
            ⌄
          </span>
        </button>
        {isExpanded ? (
          <div
            aria-label={t('curriculum.stageDetails', { title: stage.title })}
            class="ui-divider space-y-6 border-t px-4 py-4 sm:px-5 sm:py-5"
            id={panelId}
            role="region"
          >
            {stage.modules.length === 0 ? (
              <p class="ui-text-muted text-sm">{t('curriculum.noModules')}</p>
            ) : (
              <div class="space-y-5">
                {stage.modules.map((module) => (
                  <ModuleLessonList
                    key={module.id}
                    module={module}
                    programSlug={programSlug}
                    showHeading={showModuleHeadings}
                  />
                ))}
                <NavigationAction
                  href={`/program/${encodeURIComponent(programSlug)}/stage/${encodeURIComponent(stage.slug)}`}
                  variant="ghost"
                >
                  {t('curriculum.stagePrerequisites')}
                </NavigationAction>
              </div>
            )}
          </div>
        ) : null}
      </Card>
    </li>
  );
}

function StageValidationCard({
  validation,
}: {
  validation: StageValidation | null;
}) {
  const { t } = useI18n();
  if (!validation) return null;

  return (
    <Card class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-xl font-semibold">{t('curriculum.stageValidation')}</h2>
        <Badge tone={validation.isValidated ? 'success' : 'info'}>
          {t(progressStatusKeys[validation.status])}
        </Badge>
      </div>
      <ul class="ui-text-muted space-y-1 text-sm">
        <li>
          {t('curriculum.requiredConcepts', {
            done: validation.requiredConcepts.validated,
            total: validation.requiredConcepts.total,
          })}
        </li>
        <li>
          {t('curriculum.requiredTasks', {
            done: validation.requiredTasks.validated,
            total: validation.requiredTasks.total,
          })}
        </li>
        <li>
          {t('curriculum.requiredExercises', {
            done: validation.requiredExercises?.validated ?? 0,
            total: validation.requiredExercises?.total ?? 0,
          })}
        </li>
        <li>
          {t('curriculum.finalAssessments', {
            done: validation.finalAssessments.validated,
            total: validation.finalAssessments.total,
          })}
        </li>
      </ul>
      {validation.missingRequirements.length === 0 ? (
        <p class="ui-text-success text-sm">
          {t('curriculum.requirementsComplete')}
        </p>
      ) : (
        <div>
          <h3 class="font-semibold">{t('curriculum.missingRequirements')}</h3>
          <ul class="ui-text-warning mt-2 list-disc space-y-1 pl-5 text-sm">
            {validation.missingRequirements.map((requirement) => (
              <li key={`${requirement.type}:${requirement.id ?? 'missing'}`}>
                {requirement.title}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

type Translate = (
  key: MessageKey,
  parameters?: Record<string, string | number>,
) => string;

function durationLabel(days: number | null, t: Translate) {
  if (days === null) return t('programs.durationUnknown');
  return t('programs.durationDays', { count: days });
}

function publishedVersionLabel(version: number, t: Translate) {
  return t('programs.publishedVersion', { version });
}

function programLocaleLabel(
  locale: string | null | undefined,
  t: Translate,
): string {
  return t(
    locale?.toLocaleLowerCase().startsWith('en')
      ? 'programs.language.en'
      : 'programs.language.fr',
  );
}

function CatalogProgramCard({
  isMutationDisabled,
  isMutationLoading,
  onEnroll,
  program,
}: {
  isMutationDisabled: boolean;
  isMutationLoading: boolean;
  onEnroll: (program: CatalogProgram) => void;
  program: CatalogProgram;
}) {
  const { t } = useI18n();
  return (
    <li>
      <Card class="flex h-full flex-col space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <h2 class="text-xl font-semibold">{program.title}</h2>
          <Badge tone={program.isEnrolled ? 'success' : 'info'}>
            {t(program.isEnrolled ? 'programs.enrolled' : 'programs.available')}
          </Badge>
        </div>
        <p class="ui-text-muted text-sm leading-6">{program.description}</p>
        <ul class="ui-text-muted space-y-1 text-sm">
          <li>{programLocaleLabel(program.locale, t)}</li>
          <li>{durationLabel(program.estimatedDurationDays, t)}</li>
          <li>
            {t('programs.publishedStageCount', { count: program.stageCount })}
          </li>
          <li>{publishedVersionLabel(program.publishedVersion.number, t)}</li>
        </ul>
        {program.isEnrolled ? (
          <NavigationAction
            class="mt-auto"
            href={`/program/${encodeURIComponent(program.slug)}`}
          >
            {t('programs.open')}
          </NavigationAction>
        ) : (
          <Button
            class="mt-auto w-full"
            disabled={isMutationDisabled}
            isLoading={isMutationLoading}
            onClick={() => onEnroll(program)}
          >
            {t('programs.enroll')}
          </Button>
        )}
      </Card>
    </li>
  );
}

function EnrolledProgramCard({
  isConfirming,
  isMutationDisabled,
  isMutationLoading,
  onCancel,
  onConfirm,
  onRequestWithdrawal,
  program,
}: {
  isConfirming: boolean;
  isMutationDisabled: boolean;
  isMutationLoading: boolean;
  onCancel: () => void;
  onConfirm: (program: EnrolledProgram) => void;
  onRequestWithdrawal: (program: EnrolledProgram) => void;
  program: EnrolledProgram;
}) {
  const { t } = useI18n();
  const isActive = program.enrollment.status === 'ACTIVE';
  const percent = program.progress?.percent ?? 0;

  return (
    <li>
      <Card class="flex h-full flex-col space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <h2 class="text-xl font-semibold">{program.program.title}</h2>
          <Badge tone={isActive ? 'success' : 'warning'}>
            {t(isActive ? 'programs.enrolled' : 'programs.withdrawnBadge')}
          </Badge>
        </div>
        <p class="ui-text-muted text-sm leading-6">
          {program.program.description}
        </p>
        <ul class="ui-text-muted space-y-1 text-sm">
          <li>{programLocaleLabel(program.program.locale, t)}</li>
          <li>{durationLabel(program.program.estimatedDurationDays, t)}</li>
          <li>
            {publishedVersionLabel(program.program.publishedVersion.number, t)}
          </li>
        </ul>
        <ProgressBar
          label={t('today.progress', { count: Math.round(percent) })}
          value={percent}
        />
        {isActive ? (
          <>
            <NavigationAction
              href={`/program/${encodeURIComponent(program.program.slug)}`}
            >
              {percent > 0 ? t('common.continue') : t('programs.start')}
            </NavigationAction>
            {!isConfirming ? (
              <Button
                disabled={isMutationDisabled}
                onClick={() => onRequestWithdrawal(program)}
                variant="ghost"
              >
                {t('programs.withdraw')}
              </Button>
            ) : (
              <div
                aria-label={t('programs.confirmWithdrawAria', {
                  title: program.program.title,
                })}
                class="ui-feedback ui-feedback--warning space-y-3"
                role="region"
              >
                <p class="text-sm leading-6">
                  {t('programs.withdrawDescription')}
                </p>
                <div class="flex flex-col gap-3 sm:flex-row">
                  <Button
                    disabled={isMutationDisabled}
                    isLoading={isMutationLoading}
                    onClick={() => onConfirm(program)}
                    variant="danger"
                  >
                    {t('programs.confirmWithdraw')}
                  </Button>
                  <Button onClick={onCancel} variant="ghost">
                    {t('programs.cancel')}
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <p class="ui-text-muted text-sm">{t('programs.dataPreserved')}</p>
        )}
      </Card>
    </li>
  );
}

function OwnedProgramCard({ program }: { program: ProgramSummary }) {
  const { t } = useI18n();
  const hasDraftContent =
    program.status === 'DRAFT' ||
    program.stages.some((stage) => !stage.isPublished);
  const percent = program.timeline?.actualPercent ?? 0;

  return (
    <li>
      <Card class="flex h-full flex-col space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <h2 class="text-xl font-semibold">{program.title}</h2>
          <div class="flex flex-wrap gap-2">
            <Badge tone="info">{t('programs.owner')}</Badge>
            <Badge
              tone={program.visibility === 'PRIVATE' ? 'warning' : 'success'}
            >
              {t(
                program.visibility === 'PRIVATE'
                  ? 'programs.private'
                  : 'programs.public',
              )}
            </Badge>
            {hasDraftContent ? <DraftBadge /> : null}
          </div>
        </div>
        <p class="ui-text-muted text-sm leading-6">{program.description}</p>
        <ul class="ui-text-muted space-y-1 text-sm">
          <li>{programLocaleLabel(program.locale, t)}</li>
          <li>{durationLabel(program.estimatedDurationDays, t)}</li>
          <li>{t('programs.stageCount', { count: program.stages.length })}</li>
        </ul>
        <ProgressBar
          label={t('today.progress', { count: Math.round(percent) })}
          value={percent}
        />
        <NavigationAction
          class="mt-auto"
          href={`/program/${encodeURIComponent(program.slug)}`}
        >
          {hasDraftContent ? t('programs.preview') : t('programs.open')}
        </NavigationAction>
      </Card>
    </li>
  );
}

function DirectoryPagination({
  hasMore,
  isLoading,
  onLoadMore,
}: {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
}) {
  const { t } = useI18n();
  if (!hasMore) return null;
  return (
    <div class="flex justify-center">
      <Button isLoading={isLoading} onClick={onLoadMore} variant="secondary">
        {t('programs.showMore')}
      </Button>
    </div>
  );
}

type ProgramsView = 'catalog' | 'enrolled';

function initialProgramsView(): ProgramsView {
  if (typeof window === 'undefined') return 'enrolled';
  return new URLSearchParams(window.location.search).get('view') === 'discover'
    ? 'catalog'
    : 'enrolled';
}

export function ProgramsPage() {
  const { locale, t } = useI18n();
  const isOnline = useOnlineStatus();
  const [activeView, setActiveView] =
    useState<ProgramsView>(initialProgramsView);
  const [enrollmentStatus, setEnrollmentStatus] =
    useState<EnrollmentStatus>('ACTIVE');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [catalogLocale, setCatalogLocale] = useState(locale);
  const [confirmingProgramId, setConfirmingProgramId] = useState<string>();
  const [announcement, setAnnouncement] = useState<string>();
  const enrolledTabRef = useRef<HTMLButtonElement>(null);
  const catalogTabRef = useRef<HTMLButtonElement>(null);
  const onboardingRef = useRef(
    typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('onboarding') === '1',
  );
  const catalog = useCatalogProgramsQuery(search, catalogLocale, isOnline);
  const enrolled = useEnrolledProgramsQuery(search, enrollmentStatus, isOnline);
  const owned = useProgramsQuery(isOnline);
  const mutation = useProgramEnrollmentMutation();
  const normalizedOwnedSearch = search.toLocaleLowerCase(locale);
  const ownedPrograms = (owned.data?.programs ?? []).filter((program) =>
    normalizedOwnedSearch
      ? `${program.title} ${program.description}`
          .toLocaleLowerCase(locale)
          .includes(normalizedOwnedSearch)
      : true,
  );
  const ownedProgramIds = new Set(
    (owned.data?.programs ?? []).map((program) => program.id),
  );
  const enrolledPrograms = enrolled.data.items.filter(
    (program) =>
      enrollmentStatus !== 'ACTIVE' || !ownedProgramIds.has(program.program.id),
  );

  function selectView(view: ProgramsView, focus = false) {
    setActiveView(view);
    setConfirmingProgramId(undefined);
    setSearch('');
    setSearchInput('');
    setSearchVisible(false);
    if (focus) {
      (view === 'enrolled' ? enrolledTabRef : catalogTabRef).current?.focus();
    }
  }

  function handleTabKeyDown(event: KeyboardEvent, view: ProgramsView) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextView =
      event.key === 'Home'
        ? 'enrolled'
        : event.key === 'End'
          ? 'catalog'
          : view === 'enrolled'
            ? 'catalog'
            : 'enrolled';
    selectView(nextView, true);
  }

  async function refreshDirectories() {
    await Promise.all([catalog.reload(), enrolled.reload()]);
  }

  async function enroll(program: CatalogProgram) {
    setAnnouncement(undefined);
    try {
      await mutation.execute(program.id, 'enroll');
      await refreshDirectories();
      setAnnouncement(
        t('programs.addedAnnouncement', { title: program.title }),
      );
      if (onboardingRef.current) {
        const today = await apiRequest<TodayResponse>('/api/today');
        const enrolledProgram = today.programs?.find(
          (candidate) => candidate.id === program.id,
        );
        route(
          enrolledProgram?.resumeHref ??
            (today.action?.programId === program.id
              ? today.action.href
              : `/program/${program.slug}`),
        );
      }
    } catch {
      // The normalized error is rendered below.
    }
  }

  async function withdraw(program: EnrolledProgram) {
    setAnnouncement(undefined);
    try {
      await mutation.execute(program.program.id, 'withdraw');
      setConfirmingProgramId(undefined);
      await refreshDirectories();
      setAnnouncement(
        t('programs.withdrawnAnnouncement', { title: program.program.title }),
      );
    } catch {
      // The normalized error is rendered below.
    }
  }

  function submitSearch(event: SubmitEvent) {
    event.preventDefault();
    setSearch(searchInput.trim().replace(/\s+/g, ' '));
  }

  return (
    <section
      aria-labelledby="programs-title"
      class="page-layout page-layout--work page-shell space-y-6"
    >
      <PageHeader
        description={t('programs.description')}
        eyebrow={t('programs.eyebrow')}
        id="programs-title"
        title={t('programs.title')}
      />
      <div
        aria-label={t('programs.views')}
        class="ui-control-surface grid grid-cols-2 gap-1 rounded-lg p-1"
        role="tablist"
      >
        <button
          aria-controls="enrolled-programs-panel"
          aria-selected={activeView === 'enrolled'}
          class={`min-h-11 rounded-md px-3 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)] ${activeView === 'enrolled' ? 'bg-[var(--color-action)] text-[var(--color-on-action)]' : 'ui-text hover:bg-[var(--color-surface-raised)]'}`}
          id="enrolled-programs-tab"
          onClick={() => selectView('enrolled')}
          onKeyDown={(event) => handleTabKeyDown(event, 'enrolled')}
          ref={enrolledTabRef}
          role="tab"
          type="button"
        >
          {t('programs.mine')}
        </button>
        <button
          aria-controls="catalog-programs-panel"
          aria-selected={activeView === 'catalog'}
          class={`min-h-11 rounded-md px-3 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)] ${activeView === 'catalog' ? 'bg-[var(--color-action)] text-[var(--color-on-action)]' : 'ui-text hover:bg-[var(--color-surface-raised)]'}`}
          id="catalog-programs-tab"
          onClick={() => selectView('catalog')}
          onKeyDown={(event) => handleTabKeyDown(event, 'catalog')}
          ref={catalogTabRef}
          role="tab"
          type="button"
        >
          {t('programs.explore')}
        </button>
      </div>
      {searchVisible ? (
        <form
          class="grid gap-3 sm:grid-cols-[1fr_auto_auto]"
          onSubmit={submitSearch}
        >
          <label class="ui-field__label grid gap-2">
            {t('programs.search')}
            <input
              autoFocus
              class="ui-field__control min-w-0"
              onInput={(event) => setSearchInput(event.currentTarget.value)}
              placeholder={t('programs.searchPlaceholder')}
              type="search"
              value={searchInput}
            />
          </label>
          <Button class="self-end" type="submit" variant="secondary">
            {t('programs.searchAction')}
          </Button>
          <Button
            class="self-end"
            onClick={() => {
              setSearch('');
              setSearchInput('');
              setSearchVisible(false);
            }}
            type="button"
            variant="ghost"
          >
            {t('common.close')}
          </Button>
        </form>
      ) : (
        <div>
          <Button
            aria-expanded="false"
            onClick={() => setSearchVisible(true)}
            variant="secondary"
          >
            {t('programs.revealSearch')}
          </Button>
        </div>
      )}
      {!isOnline ? (
        <ErrorState
          description={t('programs.offline.description')}
          title={t('programs.offline.title')}
        />
      ) : (
        <div
          aria-labelledby={`${activeView}-programs-tab`}
          id={`${activeView}-programs-panel`}
          role="tabpanel"
          tabindex={0}
        >
          {activeView === 'enrolled' ? (
            <div class="space-y-5">
              {enrolled.isPending || owned.isPending ? (
                <Skeleton label={t('programs.loadingMine')} />
              ) : enrolled.error || owned.error ? (
                <ErrorState
                  action={
                    <Button
                      onClick={() => {
                        void enrolled.reload();
                        void owned.reload();
                      }}
                    >
                      {t('common.retry')}
                    </Button>
                  }
                  description={t('programs.mineError')}
                />
              ) : enrolledPrograms.length === 0 &&
                (enrollmentStatus !== 'ACTIVE' ||
                  ownedPrograms.length === 0) ? (
                <EmptyState
                  action={
                    enrollmentStatus === 'ACTIVE' ? (
                      <Button onClick={() => selectView('catalog')}>
                        {t('programs.exploreAction')}
                      </Button>
                    ) : undefined
                  }
                  description={
                    enrollmentStatus === 'ACTIVE'
                      ? t('programs.emptyMine.description')
                      : t('programs.emptyWithdrawn.description')
                  }
                  title={
                    enrollmentStatus === 'ACTIVE'
                      ? t('programs.emptyMine.title')
                      : t('programs.emptyWithdrawn.title')
                  }
                />
              ) : (
                <div class="space-y-6">
                  {enrollmentStatus === 'ACTIVE' && ownedPrograms.length ? (
                    <section
                      aria-labelledby="owned-programs-title"
                      class="space-y-3"
                    >
                      <h2
                        class="ui-text text-lg font-semibold"
                        id="owned-programs-title"
                      >
                        {t('programs.ownedSection')}
                      </h2>
                      <ul class="grid gap-5 md:grid-cols-2">
                        {ownedPrograms.map((program) => (
                          <OwnedProgramCard
                            key={program.id}
                            program={program}
                          />
                        ))}
                      </ul>
                    </section>
                  ) : null}
                  {enrolledPrograms.length ? (
                    <section
                      aria-labelledby="enrolled-programs-title"
                      class="space-y-3"
                    >
                      <h2
                        class="ui-text text-lg font-semibold"
                        id="enrolled-programs-title"
                      >
                        {t('programs.enrolledSection')}
                      </h2>
                      <ul class="grid gap-5 md:grid-cols-2">
                        {enrolledPrograms.map((program) => (
                          <EnrolledProgramCard
                            isConfirming={
                              confirmingProgramId === program.program.id
                            }
                            isMutationDisabled={Boolean(
                              mutation.pendingProgramId,
                            )}
                            isMutationLoading={
                              mutation.pendingProgramId === program.program.id
                            }
                            key={program.enrollment.id}
                            onCancel={() => setConfirmingProgramId(undefined)}
                            onConfirm={(item) => void withdraw(item)}
                            onRequestWithdrawal={(item) =>
                              setConfirmingProgramId(item.program.id)
                            }
                            program={program}
                          />
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </div>
              )}
              <label class="ui-field__label grid max-w-xs gap-2">
                {t('programs.enrollmentStatus')}
                <select
                  class="ui-field__control"
                  onChange={(event) => {
                    setConfirmingProgramId(undefined);
                    setEnrollmentStatus(
                      event.currentTarget.value as EnrollmentStatus,
                    );
                  }}
                  value={enrollmentStatus}
                >
                  <option value="ACTIVE">{t('programs.active')}</option>
                  <option value="WITHDRAWN">{t('programs.withdrawn')}</option>
                </select>
              </label>
              <DirectoryPagination
                hasMore={Boolean(enrolled.data.nextCursor)}
                isLoading={enrolled.isLoadingMore}
                onLoadMore={() => void enrolled.loadMore()}
              />
            </div>
          ) : (
            <div class="space-y-5">
              {catalog.isPending ? (
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
                <ul class="grid gap-5 md:grid-cols-2">
                  {catalog.data.items.map((program) => (
                    <CatalogProgramCard
                      isMutationDisabled={Boolean(mutation.pendingProgramId)}
                      isMutationLoading={
                        mutation.pendingProgramId === program.id
                      }
                      key={program.id}
                      onEnroll={(item) => void enroll(item)}
                      program={program}
                    />
                  ))}
                </ul>
              )}
              <label class="ui-field__label grid max-w-xs gap-2">
                {t('programs.language.label')}
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
              <DirectoryPagination
                hasMore={Boolean(catalog.data.nextCursor)}
                isLoading={catalog.isLoadingMore}
                onLoadMore={() => void catalog.loadMore()}
              />
            </div>
          )}
        </div>
      )}
      {mutation.error ? (
        <ErrorState description={t('programs.enrollmentError')} />
      ) : null}
      <p
        aria-live="polite"
        class="text-sm text-[var(--color-success)]"
        role="status"
      >
        {announcement}
      </p>
    </section>
  );
}

export function ProgramPage({ programSlug }: { programSlug: string }) {
  useBackNavigationTarget({
    href: '/program',
    labelKey: 'navigation.back.programs',
  });
  const query = useProgramQuery(programSlug);
  const { t } = useI18n();
  const preference = useProgramViewPreference(programSlug);
  const restart = useProgramRestart(query.data?.program.id ?? '');
  const [localPreference, setLocalPreference] = useState<{
    expandedStageId: string | null;
    programId: string;
  } | null>(null);
  const state = getQueryState(query.error, query.isPending, t);
  const program = query.data?.program;
  const requestedStageSlug = new URLSearchParams(window.location.search).get(
    'stage',
  );

  if (state) {
    return state;
  }

  if (!program) {
    return (
      <EmptyState
        description={t('curriculum.programNotFound.description')}
        title={t('curriculum.programNotFound.title')}
      />
    );
  }

  const requestedStageId = program.stages.find(
    (stage) => stage.slug === requestedStageSlug,
  )?.id;
  const activeStageId =
    localPreference?.programId === program.id
      ? localPreference.expandedStageId
      : (requestedStageId ??
        program.viewPreference?.expandedStageId ??
        program.stages[0]?.id ??
        null);

  return (
    <section
      aria-labelledby="program-title"
      class="page-layout page-layout--work page-shell"
    >
      <div class="min-w-0">
        <p class="page-eyebrow">{t('curriculum.program')}</p>
        <div class="mt-3 flex min-w-0 flex-wrap items-center gap-3">
          <h1
            id="program-title"
            class="min-w-0 break-words text-3xl font-bold tracking-tight"
          >
            {program.title}
          </h1>
          {program.status === 'DRAFT' ? <DraftBadge /> : null}
        </div>
        <p class="page-description mt-3 break-words">{program.description}</p>
      </div>
      <ProgressBar
        label={t('curriculum.programProgress', {
          count: Math.round(program.timeline?.actualPercent ?? 0),
        })}
        value={program.timeline?.actualPercent ?? 0}
      />
      {program.stages.length === 0 ? (
        <EmptyState
          description={t('curriculum.noStages.description')}
          title={t('curriculum.noStages.title')}
        />
      ) : (
        <ol class="space-y-4">
          {program.stages.map((stage) => (
            <StageAccordionItem
              isExpanded={activeStageId === stage.id}
              key={stage.id}
              onToggle={() => {
                if (activeStageId === stage.id) {
                  setLocalPreference({
                    expandedStageId: null,
                    programId: program.id,
                  });
                  return;
                }
                const previousStageId = activeStageId;
                setLocalPreference({
                  expandedStageId: stage.id,
                  programId: program.id,
                });
                void preference.save(stage.id).catch(() => {
                  setLocalPreference({
                    expandedStageId: previousStageId,
                    programId: program.id,
                  });
                });
              }}
              programSlug={program.slug}
              stage={stage}
            />
          ))}
        </ol>
      )}
      {program.status === 'ACTIVE' ? (
        <Card class="space-y-4">
        <div>
          <h2 class="font-semibold">{t('curriculum.programRestart.title')}</h2>
          <p class="ui-text-muted mt-2 text-sm leading-6">
            {t('curriculum.programRestart.description')}
          </p>
        </div>
        {restart.preview ? (
          <div
            aria-labelledby="program-restart-title"
            class="space-y-4"
            role="alertdialog"
          >
            <h3
              class="ui-text-danger font-semibold"
              id="program-restart-title"
            >
              {t('curriculum.programRestart.confirmTitle')}
            </h3>
            <p class="ui-text-muted text-sm leading-6">
              {t('curriculum.programRestart.resetSummary', {
                concepts: restart.preview.reset.concepts,
                exercises: restart.preview.reset.exercises,
                lessons: restart.preview.reset.lessons,
                modules: restart.preview.reset.modules,
                quizzes: restart.preview.reset.quizzes,
                resources: restart.preview.reset.resources,
                stages: restart.preview.reset.stages,
                tasks: restart.preview.reset.tasks,
              })}
            </p>
            <p class="ui-text-muted text-sm leading-6">
              {t('curriculum.programRestart.preservedSummary', {
                conceptAttempts: restart.preview.preserved.conceptAttempts,
                exerciseSubmissions:
                  restart.preview.preserved.exerciseSubmissions,
                notes: restart.preview.preserved.notes,
                quizAttempts: restart.preview.preserved.quizAttempts,
                stageAssessmentSubmissions:
                  restart.preview.preserved.stageAssessmentSubmissions,
              })}
            </p>
            <div class="flex flex-wrap gap-3">
              <Button
                isLoading={restart.isPending}
                onClick={() => {
                  void restart.restart().then((result) => {
                    if (!result.firstLesson) return;
                    void route(
                      `/program/${encodeURIComponent(program.slug)}/lesson/${encodeURIComponent(result.firstLesson.slug)}`,
                    );
                  });
                }}
                variant="danger"
              >
                {t('curriculum.programRestart.confirm')}
              </Button>
              <Button onClick={restart.cancel} variant="secondary">
                {t('programs.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            isLoading={restart.isPending}
            onClick={() => void restart.loadPreview()}
            variant="danger"
          >
            {t('curriculum.programRestart.action')}
          </Button>
        )}
        {restart.error ? (
          <p class="ui-text-danger text-sm" role="alert">
            {t('curriculum.programRestart.error')}
          </p>
        ) : null}
        </Card>
      ) : null}
      {preference.error ? (
        <p aria-live="polite" class="ui-text-danger text-sm" role="status">
          {t('curriculum.preferenceError')}
        </p>
      ) : null}
    </section>
  );
}

export function StagePage({
  programSlug,
  stageSlug,
}: {
  programSlug: string;
  stageSlug: string;
}) {
  useBackNavigationTarget({
    href: programStageHref(programSlug, stageSlug),
    labelKey: 'navigation.back.program',
  });
  const query = useStageQuery(programSlug, stageSlug);
  const { t } = useI18n();
  const state = getQueryState(query.error, query.isPending, t);

  if (state) {
    return state;
  }

  const stage = query.data?.stage;

  if (!stage) {
    return (
      <EmptyState
        description={t('curriculum.stageNotFound.description')}
        title={t('curriculum.stageNotFound.title')}
      />
    );
  }

  return (
    <section
      aria-labelledby="stage-title"
      class="page-layout page-layout--work page-shell"
    >
      <div>
        <p class="page-eyebrow">{t('curriculum.stage')}</p>
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <h1 id="stage-title" class="text-3xl font-bold tracking-tight">
            {stage.title}
          </h1>
          {stage.isPublished ? null : <DraftBadge />}
        </div>
      </div>
      <ProgressPlaceholder />
      <StageValidationCard validation={stage.validation} />
      {stage.modules.length === 0 ? (
        <EmptyState
          description={t('curriculum.noModules.description')}
          title={t('curriculum.noModules.title')}
        />
      ) : (
        <div class="grid gap-5">
          {stage.modules.map((module) => (
            <Card class="space-y-4" key={module.id}>
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="text-lg font-semibold">{module.title}</h2>
                {module.isPublished ? null : <DraftBadge />}
              </div>
              <NavigationAction
                class="mt-3"
                href={`/program/${programSlug}/module/${module.slug}`}
                variant="secondary"
              >
                {t('curriculum.openModule')}
              </NavigationAction>
              {module.lessons.map((lesson) => (
                <LessonSummaryCard
                  key={lesson.id}
                  lesson={lesson}
                  programSlug={programSlug}
                  stageSlug={stage.slug}
                />
              ))}
            </Card>
          ))}
        </div>
      )}
      <StageAssessmentCard
        isStagePublished={stage.isPublished}
        stageId={stage.id}
      />
    </section>
  );
}

export function ModulePage({
  moduleSlug,
  programSlug,
}: {
  moduleSlug: string;
  programSlug: string;
}) {
  const query = useModuleQuery(moduleSlug);
  const stageSlug = query.data?.module.stage.slug;
  useBackNavigationTarget(
    stageSlug
      ? {
          href: programStageHref(programSlug, stageSlug),
          labelKey: 'navigation.back.program',
        }
      : null,
  );
  const restart = useModuleRestart(query.data?.module.id ?? '');
  const { t } = useI18n();
  const state = getQueryState(query.error, query.isPending, t);

  if (state) {
    return state;
  }

  const module = query.data?.module;

  if (!module) {
    return (
      <EmptyState
        description={t('curriculum.moduleNotFound.description')}
        title={t('curriculum.moduleNotFound.title')}
      />
    );
  }

  return (
    <section
      aria-labelledby="module-title"
      class="page-layout page-layout--work page-shell"
    >
      <div>
        <p class="page-eyebrow">{t('curriculum.module')}</p>
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <h1 id="module-title" class="text-3xl font-bold tracking-tight">
            {module.title}
          </h1>
          {module.isPublished ? null : <DraftBadge />}
        </div>
        <p class="page-description mt-3">{module.description}</p>
      </div>
      <ProgressPlaceholder />
      {module.lessons.length === 0 ? (
        <EmptyState
          description={t('curriculum.noLessons.description')}
          title={t('curriculum.noLessons.title')}
        />
      ) : (
        <div class="grid gap-4 md:grid-cols-2">
          {module.lessons.map((lesson) => (
            <LessonSummaryCard
              key={lesson.id}
              lesson={lesson}
              programSlug={programSlug}
              stageSlug={module.stage.slug}
            />
          ))}
        </div>
      )}
      {module.isPublished && module.stage.isPublished ? (
        <Card class="space-y-4">
          <div>
            <h2 class="font-semibold">{t('curriculum.restart.title')}</h2>
            <p class="ui-text-muted mt-2 text-sm leading-6">
              {t('curriculum.restart.description')}
            </p>
          </div>
          {restart.preview ? (
            <div
              class="space-y-4"
              role="alertdialog"
              aria-labelledby="restart-title"
            >
              <h3 class="ui-text-danger font-semibold" id="restart-title">
                {t('curriculum.restart.confirmTitle')}
              </h3>
              <p class="ui-text-muted text-sm leading-6">
                {t('curriculum.restart.resetSummary', {
                  concepts: restart.preview.reset.concepts,
                  exercises: restart.preview.reset.exercises,
                  lessons: restart.preview.reset.lessons,
                  quizzes: restart.preview.reset.quizzes,
                  resources: restart.preview.reset.resources,
                  tasks: restart.preview.reset.tasks,
                })}
              </p>
              <p class="ui-text-muted text-sm leading-6">
                {t('curriculum.restart.preservedSummary', {
                  conceptAttempts: restart.preview.preserved.conceptAttempts,
                  exerciseSubmissions:
                    restart.preview.preserved.exerciseSubmissions,
                  notes: restart.preview.preserved.notes,
                  quizAttempts: restart.preview.preserved.quizAttempts,
                })}
              </p>
              <div class="flex flex-wrap gap-3">
                <Button
                  isLoading={restart.isPending}
                  onClick={() => {
                    void restart.restart().then((result) => {
                      if (!result.firstLesson) return;
                      void route(
                        `/program/${encodeURIComponent(programSlug)}/lesson/${encodeURIComponent(result.firstLesson.slug)}`,
                      );
                    });
                  }}
                  variant="danger"
                >
                  {t('curriculum.restart.confirm')}
                </Button>
                <Button onClick={restart.cancel} variant="secondary">
                  {t('programs.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              isLoading={restart.isPending}
              onClick={() => void restart.loadPreview()}
              variant="danger"
            >
              {t('curriculum.restart.action')}
            </Button>
          )}
          {restart.error ? (
            <p class="ui-text-danger text-sm" role="alert">
              {t('curriculum.restart.error')}
            </p>
          ) : null}
        </Card>
      ) : null}
    </section>
  );
}
