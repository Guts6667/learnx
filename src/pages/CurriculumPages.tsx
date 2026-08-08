import { route } from 'preact-router';
import { useRef, useState } from 'preact/hooks';

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
  type StageSummary,
  type StageValidation,
  useModuleQuery,
  useModuleRestart,
  useProgramQuery,
  useProgramViewPreference,
  useStageQuery,
} from '@/features/curriculum/queries';

function lessonStatusLabel(lesson: LessonSummary): string {
  if (!lesson.isPublished) return 'Brouillon';
  if (lesson.isLocked) return 'Verrouillée';
  if (lesson.progress.status === 'COMPLETED') return 'Terminée';
  if (lesson.progress.status === 'IN_PROGRESS') return 'En cours';
  if (lesson.progress.status === 'NEEDS_REVIEW') return 'À revoir';
  return 'Disponible';
}

function nextActivityLabel(lesson: LessonSummary): string {
  if (lesson.isLocked) return 'Prérequis à valider';
  if (lesson.progress.status === 'COMPLETED') return 'Leçon à revoir';
  if (lesson.progress.status === 'IN_PROGRESS')
    return 'Reprendre l’activité en cours';
  return lesson.isPublished
    ? 'Commencer par le contenu'
    : 'Prévisualiser le contenu';
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
  const counts = lesson.activityCounts;
  const activityTotal =
    counts.resources +
    counts.tasks +
    counts.concepts +
    counts.exercises +
    counts.quizzes;
  const actionLabel =
    lesson.progress.status === 'COMPLETED'
      ? 'Revoir'
      : lesson.progress.status === 'IN_PROGRESS'
        ? 'Continuer'
        : 'Commencer';

  return (
    <Card class="space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="text-lg font-semibold">{lesson.title}</h3>
          <p class="mt-2 text-sm leading-6 text-slate-300">{lesson.summary}</p>
        </div>
        <Badge tone={lesson.isPublished ? 'info' : 'warning'}>
          {lessonStatusLabel(lesson)}
        </Badge>
      </div>
      <p class="text-sm text-slate-400">
        {lesson.estimatedMinutes === null
          ? 'Durée non renseignée'
          : `${lesson.estimatedMinutes} min`}{' '}
        · {activityTotal} activités
      </p>
      <p class="text-sm text-slate-300">
        Prochaine activité : {nextActivityLabel(lesson)}
      </p>
      <ProgressBar
        label={`Progression — ${Math.round(lesson.progress.percent)} %`}
        value={lesson.progress.percent}
      />
      <details class="rounded-xl border border-slate-800 px-4 py-3 text-sm">
        <summary class="min-h-11 cursor-pointer py-2 font-medium text-slate-200">
          Détail des activités
        </summary>
        <ul class="space-y-1 pb-2 text-slate-400">
          <li>{counts.resources} ressources</li>
          <li>{counts.tasks} tâches</li>
          <li>{counts.concepts} notions</li>
          <li>{counts.exercises} exercices</li>
          <li>{counts.quizzes} quiz</li>
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
          ? 'Voir les prérequis'
          : lesson.isPublished
            ? actionLabel
            : 'Prévisualiser'}
      </NavigationAction>
    </Card>
  );
}

function getQueryState(error: unknown, isPending: boolean) {
  if (isPending) {
    return <Skeleton label="Chargement du parcours" />;
  }

  if (error) {
    return <ErrorState description="Le parcours n’a pas pu être chargé." />;
  }

  return null;
}

function ProgressPlaceholder() {
  return <ProgressBar label="Progression — bientôt disponible" value={0} />;
}

function DraftBadge() {
  return <Badge tone="warning">Brouillon</Badge>;
}

const compactProgressStatusLabels = {
  AVAILABLE: 'Disponible',
  COMPLETED: 'Terminée',
  IN_PROGRESS: 'En cours',
  LOCKED: 'Verrouillée',
} as const;

const lessonProgressIcons = {
  AVAILABLE: '○',
  COMPLETED: '✓',
  IN_PROGRESS: '◐',
  LOCKED: '⌧',
  NEEDS_REVIEW: '↻',
  PREVIEW: '◇',
} as const;

function formatStageDuration(stage: StageSummary): string {
  if (stage.estimatedDurationDays !== null) {
    return `${stage.estimatedDurationDays} j`;
  }
  if (stage.estimatedMinutes !== null) return `${stage.estimatedMinutes} min`;
  return 'Durée non renseignée';
}

function formatLessonDuration(lesson: LessonSummary): string {
  return lesson.estimatedMinutes === null
    ? 'Durée non renseignée'
    : `${lesson.estimatedMinutes} min`;
}

function lessonLineStatus(lesson: LessonSummary) {
  if (!lesson.isPublished) {
    return {
      icon: lessonProgressIcons.PREVIEW,
      label: 'Brouillon',
      tone: 'warning' as const,
    };
  }
  if (lesson.isLocked) {
    return {
      icon: lessonProgressIcons.LOCKED,
      label: 'Verrouillée',
      tone: 'neutral' as const,
    };
  }
  return {
    icon: lessonProgressIcons[lesson.progress.status],
    label: lessonStatusLabel(lesson),
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
  const status = lessonLineStatus(lesson);
  const content = (
    <>
      <span class="min-w-0 flex-1 lg:flex lg:items-center lg:justify-between lg:gap-4">
        <span
          class={`block min-w-0 break-words font-medium ${
            lesson.isLocked ? 'text-slate-400' : 'text-slate-100'
          }`}
        >
          {lesson.title}
        </span>
        <span class="mt-2 flex flex-wrap items-center gap-2 lg:mt-0 lg:shrink-0">
          <span class="text-sm text-slate-400">
            {formatLessonDuration(lesson)}
          </span>
          <Badge class="gap-1" tone={status.tone}>
            <span aria-hidden="true">{status.icon}</span>
            {status.label}
          </Badge>
        </span>
      </span>
      <span
        aria-hidden="true"
        class="flex min-h-11 w-8 shrink-0 items-center justify-end text-lg text-slate-400"
      >
        {lesson.isLocked ? '⌧' : '›'}
      </span>
    </>
  );
  const className =
    'flex min-h-16 w-full min-w-0 items-center gap-3 border-t border-slate-800 px-2 py-4 text-left first:border-t-0 sm:px-1';

  if (lesson.isLocked) {
    return (
      <div
        aria-label={`${lesson.title}, module ${moduleTitle}, ${status.label}`}
        class={`${className} cursor-not-allowed text-slate-400`}
      >
        {content}
      </div>
    );
  }

  const action =
    lesson.progress.status === 'COMPLETED'
      ? 'Revoir'
      : lesson.progress.status === 'IN_PROGRESS'
        ? 'Reprendre'
        : 'Ouvrir';

  return (
    <a
      aria-label={`${action} ${lesson.title}, module ${moduleTitle}, ${status.label}`}
      class={`${className} rounded-lg hover:bg-slate-900/70 focus-visible:outline-2 focus-visible:outline-cyan-300`}
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
  const listId = `program-module-lessons-${module.id}`;

  return (
    <section aria-labelledby={showHeading ? `${listId}-title` : undefined}>
      {showHeading ? (
        <h3 class="mb-2 font-semibold text-slate-200" id={`${listId}-title`}>
          {module.title}
        </h3>
      ) : null}
      <ul
        aria-label={showHeading ? undefined : `Leçons du module ${module.title}`}
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
  const panelId = `program-stage-panel-${stage.id}`;
  const statusLabel = stage.isPublished
    ? compactProgressStatusLabels[stage.progress.status]
    : 'Brouillon';
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
          class="flex min-h-20 w-full items-center gap-3 rounded-2xl px-4 py-5 text-left transition-colors hover:bg-slate-800/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cyan-300 motion-reduce:transition-none sm:px-5"
          onClick={onToggle}
          type="button"
        >
          <span class="min-w-0 flex-1">
            <span class="flex flex-wrap items-center gap-2">
              <span class="font-semibold text-slate-100">
                {stage.position}. {stage.title}
              </span>
            </span>
            <span class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
              <span>{formatStageDuration(stage)}</span>
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
            class={`text-xl text-slate-300 transition-transform motion-reduce:transition-none ${
              isExpanded ? 'rotate-180' : ''
            }`}
          >
            ⌄
          </span>
        </button>
        {isExpanded ? (
          <div
            aria-label={`Détails de l’étape ${stage.title}`}
            class="space-y-6 border-t border-slate-800 px-4 py-4 sm:px-5 sm:py-5"
            id={panelId}
            role="region"
          >
            {stage.modules.length === 0 ? (
              <p class="text-sm text-slate-400">Aucun module disponible.</p>
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
              </div>
            )}
          </div>
        ) : null}
      </Card>
    </li>
  );
}

const stageStatusLabels: Record<StageValidation['status'], string> = {
  AVAILABLE: 'Disponible',
  COMPLETED: 'Terminée',
  IN_PROGRESS: 'En cours',
  LOCKED: 'Verrouillée',
};

function StageValidationCard({
  validation,
}: {
  validation: StageValidation | null;
}) {
  if (!validation) return null;

  return (
    <Card class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-xl font-semibold">Validation de l’étape</h2>
        <Badge tone={validation.isValidated ? 'success' : 'info'}>
          {stageStatusLabels[validation.status]}
        </Badge>
      </div>
      <ul class="space-y-1 text-sm text-slate-300">
        <li>
          Notions obligatoires : {validation.requiredConcepts.validated}/
          {validation.requiredConcepts.total}
        </li>
        <li>
          Tâches obligatoires : {validation.requiredTasks.validated}/
          {validation.requiredTasks.total}
        </li>
        <li>
          Exercices obligatoires : {validation.requiredExercises?.validated ?? 0}/
          {validation.requiredExercises?.total ?? 0}
        </li>
        <li>
          Évaluations finales : {validation.finalAssessments.validated}/
          {validation.finalAssessments.total}
        </li>
      </ul>
      {validation.missingRequirements.length === 0 ? (
        <p class="text-sm text-emerald-300">
          Toutes les exigences obligatoires sont validées.
        </p>
      ) : (
        <div>
          <h3 class="font-semibold">Prérequis manquants</h3>
          <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-200">
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

function durationLabel(days: number | null) {
  if (days === null) return 'Durée non renseignée';
  return `${days} jour${days > 1 ? 's' : ''}`;
}

function publishedVersionLabel(version: number) {
  return `Version publiée ${version}`;
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
  return (
    <li>
      <Card class="flex h-full flex-col space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <h2 class="text-xl font-semibold">{program.title}</h2>
          <Badge tone={program.isEnrolled ? 'success' : 'info'}>
            {program.isEnrolled ? 'Inscrit' : 'Disponible'}
          </Badge>
        </div>
        <p class="text-sm leading-6 text-slate-300">{program.description}</p>
        <ul class="space-y-1 text-sm text-slate-400">
          <li>{durationLabel(program.estimatedDurationDays)}</li>
          <li>
            {program.stageCount} étape{program.stageCount > 1 ? 's' : ''}{' '}
            publiée{program.stageCount > 1 ? 's' : ''}
          </li>
          <li>{publishedVersionLabel(program.publishedVersion.number)}</li>
        </ul>
        {program.isEnrolled ? (
          <NavigationAction
            class="mt-auto"
            href={`/program/${encodeURIComponent(program.slug)}`}
          >
            Ouvrir le programme
          </NavigationAction>
        ) : (
          <Button
            class="mt-auto w-full"
            disabled={isMutationDisabled}
            isLoading={isMutationLoading}
            onClick={() => onEnroll(program)}
          >
            S’inscrire
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
  const isActive = program.enrollment.status === 'ACTIVE';
  const percent = program.progress?.percent ?? 0;

  return (
    <li>
      <Card class="flex h-full flex-col space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <h2 class="text-xl font-semibold">{program.program.title}</h2>
          <Badge tone={isActive ? 'success' : 'warning'}>
            {isActive ? 'Inscrit' : 'Désinscrit'}
          </Badge>
        </div>
        <p class="text-sm leading-6 text-slate-300">
          {program.program.description}
        </p>
        <ul class="space-y-1 text-sm text-slate-400">
          <li>{durationLabel(program.program.estimatedDurationDays)}</li>
          <li>
            {publishedVersionLabel(program.program.publishedVersion.number)}
          </li>
        </ul>
        <ProgressBar
          label={`Progression — ${Math.round(percent)} %`}
          value={percent}
        />
        {isActive ? (
          <>
            <NavigationAction
              href={`/program/${encodeURIComponent(program.program.slug)}`}
            >
              {percent > 0 ? 'Continuer' : 'Commencer'}
            </NavigationAction>
            {!isConfirming ? (
              <Button
                disabled={isMutationDisabled}
                onClick={() => onRequestWithdrawal(program)}
                variant="ghost"
              >
                Se désinscrire
              </Button>
            ) : (
              <div
                aria-label={`Confirmer la désinscription de ${program.program.title}`}
                class="space-y-3 rounded-xl border border-amber-800 bg-amber-950/30 p-4"
                role="region"
              >
                <p class="text-sm leading-6 text-amber-100">
                  L’accès au programme sera retiré. Vos notes, votre progression
                  et vos tentatives seront conservées.
                </p>
                <div class="flex flex-col gap-3 sm:flex-row">
                  <Button
                    disabled={isMutationDisabled}
                    isLoading={isMutationLoading}
                    onClick={() => onConfirm(program)}
                    variant="danger"
                  >
                    Confirmer la désinscription
                  </Button>
                  <Button onClick={onCancel} variant="ghost">
                    Annuler
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <p class="text-sm text-slate-400">
            Vos données personnelles d’apprentissage sont conservées.
          </p>
        )}
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
  if (!hasMore) return null;
  return (
    <div class="flex justify-center">
      <Button
        isLoading={isLoading}
        onClick={onLoadMore}
        variant="secondary"
      >
        Afficher plus
      </Button>
    </div>
  );
}

type ProgramsView = 'catalog' | 'enrolled';

export function ProgramsPage() {
  const isOnline = useOnlineStatus();
  const [activeView, setActiveView] = useState<ProgramsView>('enrolled');
  const [enrollmentStatus, setEnrollmentStatus] =
    useState<EnrollmentStatus>('ACTIVE');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [confirmingProgramId, setConfirmingProgramId] = useState<string>();
  const [announcement, setAnnouncement] = useState<string>();
  const enrolledTabRef = useRef<HTMLButtonElement>(null);
  const catalogTabRef = useRef<HTMLButtonElement>(null);
  const catalog = useCatalogProgramsQuery(search, isOnline);
  const enrolled = useEnrolledProgramsQuery(
    search,
    enrollmentStatus,
    isOnline,
  );
  const mutation = useProgramEnrollmentMutation();

  function selectView(view: ProgramsView, focus = false) {
    setActiveView(view);
    setConfirmingProgramId(undefined);
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
      setAnnouncement(`${program.title} a été ajouté à Mes programmes.`);
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
      setAnnouncement(`Vous êtes désinscrit de ${program.program.title}.`);
    } catch {
      // The normalized error is rendered below.
    }
  }

  function submitSearch(event: SubmitEvent) {
    event.preventDefault();
    setSearch(searchInput.trim().replace(/\s+/g, ' '));
  }

  return (
    <section aria-labelledby="programs-title" class="page-shell space-y-6">
      <PageHeader
        description="Retrouvez vos apprentissages ou explorez les programmes disponibles."
        eyebrow="Parcours"
        id="programs-title"
        title="Programmes"
      />
      <div
        aria-label="Choisir une vue des programmes"
        class="grid grid-cols-2 gap-2 rounded-2xl border border-slate-700 bg-slate-900 p-1"
        role="tablist"
      >
        <button
          aria-controls="enrolled-programs-panel"
          aria-selected={activeView === 'enrolled'}
          class={`min-h-11 rounded-xl px-3 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 ${activeView === 'enrolled' ? 'bg-cyan-400 text-slate-950' : 'text-slate-200 hover:bg-slate-800'}`}
          id="enrolled-programs-tab"
          onClick={() => selectView('enrolled')}
          onKeyDown={(event) => handleTabKeyDown(event, 'enrolled')}
          ref={enrolledTabRef}
          role="tab"
          type="button"
        >
          Mes programmes
        </button>
        <button
          aria-controls="catalog-programs-panel"
          aria-selected={activeView === 'catalog'}
          class={`min-h-11 rounded-xl px-3 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 ${activeView === 'catalog' ? 'bg-cyan-400 text-slate-950' : 'text-slate-200 hover:bg-slate-800'}`}
          id="catalog-programs-tab"
          onClick={() => selectView('catalog')}
          onKeyDown={(event) => handleTabKeyDown(event, 'catalog')}
          ref={catalogTabRef}
          role="tab"
          type="button"
        >
          Explorer
        </button>
      </div>
      <form class="grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={submitSearch}>
        <label class="grid gap-2 text-sm font-medium text-slate-200">
          Rechercher un programme
          <input
            class="min-h-11 min-w-0 rounded-xl border border-slate-600 bg-slate-950 px-3 text-white placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
            onInput={(event) => setSearchInput(event.currentTarget.value)}
            placeholder="Titre ou description"
            type="search"
            value={searchInput}
          />
        </label>
        <Button class="self-end" type="submit" variant="secondary">
          Rechercher
        </Button>
      </form>
      {!isOnline ? (
        <ErrorState
          description="Reconnectez-vous pour consulter le catalogue privé et gérer vos inscriptions."
          title="Programmes indisponibles hors ligne"
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
              <label class="grid max-w-xs gap-2 text-sm font-medium text-slate-200">
                Statut de l’inscription
                <select
                  class="min-h-11 rounded-xl border border-slate-600 bg-slate-950 px-3 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                  onChange={(event) => {
                    setConfirmingProgramId(undefined);
                    setEnrollmentStatus(
                      event.currentTarget.value as EnrollmentStatus,
                    );
                  }}
                  value={enrollmentStatus}
                >
                  <option value="ACTIVE">Programmes en cours</option>
                  <option value="WITHDRAWN">Programmes quittés</option>
                </select>
              </label>
              {enrolled.isPending ? (
                <Skeleton label="Chargement de Mes programmes" />
              ) : enrolled.error ? (
                <ErrorState
                  action={
                    <Button onClick={() => void enrolled.reload()}>
                      Réessayer
                    </Button>
                  }
                  description="Mes programmes n’ont pas pu être chargés."
                />
              ) : enrolled.data.items.length === 0 ? (
                <EmptyState
                  action={
                    enrollmentStatus === 'ACTIVE' ? (
                      <Button onClick={() => selectView('catalog')}>
                        Explorer les programmes
                      </Button>
                    ) : undefined
                  }
                  description={
                    enrollmentStatus === 'ACTIVE'
                      ? 'Inscrivez-vous à un programme pour le retrouver ici.'
                      : 'Aucune ancienne inscription ne correspond à cette recherche.'
                  }
                  title={
                    enrollmentStatus === 'ACTIVE'
                      ? 'Aucun programme suivi'
                      : 'Aucun programme quitté'
                  }
                />
              ) : (
                <ul class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {enrolled.data.items.map((program) => (
                    <EnrolledProgramCard
                      isConfirming={
                        confirmingProgramId === program.program.id
                      }
                      isMutationDisabled={Boolean(mutation.pendingProgramId)}
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
              )}
              <DirectoryPagination
                hasMore={Boolean(enrolled.data.nextCursor)}
                isLoading={enrolled.isLoadingMore}
                onLoadMore={() => void enrolled.loadMore()}
              />
            </div>
          ) : (
            <div class="space-y-5">
              {catalog.isPending ? (
                <Skeleton label="Chargement du catalogue" />
              ) : catalog.error ? (
                <ErrorState
                  action={
                    <Button onClick={() => void catalog.reload()}>
                      Réessayer
                    </Button>
                  }
                  description="Le catalogue n’a pas pu être chargé."
                />
              ) : catalog.data.items.length === 0 ? (
                <EmptyState
                  description="Aucun programme public ne correspond à votre recherche."
                  title="Catalogue vide"
                />
              ) : (
                <ul class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
        <ErrorState description="L’inscription n’a pas pu être mise à jour. Réessayez." />
      ) : null}
      <p aria-live="polite" class="text-sm text-emerald-200" role="status">
        {announcement}
      </p>
    </section>
  );
}

export function ProgramPage({ programSlug }: { programSlug: string }) {
  const query = useProgramQuery(programSlug);
  const preference = useProgramViewPreference(programSlug);
  const [localPreference, setLocalPreference] = useState<{
    expandedStageId: string | null;
    programId: string;
  } | null>(null);
  const state = getQueryState(query.error, query.isPending);
  const program = query.data?.program;

  if (state) {
    return state;
  }

  if (!program) {
    return (
      <EmptyState
        description="Ce programme est indisponible."
        title="Programme introuvable"
      />
    );
  }

  const activeStageId =
    localPreference?.programId === program.id
      ? localPreference.expandedStageId
      : (program.viewPreference?.expandedStageId ??
        program.stages[0]?.id ??
        null);

  return (
    <section aria-labelledby="program-title" class="page-shell">
      <div class="min-w-0">
        <p class="text-sm font-semibold tracking-[0.2em] text-cyan-400 uppercase">
          Programme
        </p>
        <div class="mt-3 flex min-w-0 flex-wrap items-center gap-3">
          <h1
            id="program-title"
            class="min-w-0 break-words text-3xl font-bold tracking-tight"
          >
            {program.title}
          </h1>
          {program.status === 'DRAFT' ? <DraftBadge /> : null}
        </div>
        <p class="mt-3 break-words text-slate-300">{program.description}</p>
      </div>
      <ProgressBar
        label={`Progression du programme — ${Math.round(program.timeline?.actualPercent ?? 0)} %`}
        value={program.timeline?.actualPercent ?? 0}
      />
      {program.stages.length === 0 ? (
        <EmptyState
          description="Les étapes publiées apparaîtront ici."
          title="Aucune étape disponible"
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
      {preference.error ? (
        <p aria-live="polite" class="text-sm text-rose-200" role="status">
          L’étape ouverte n’a pas pu être mémorisée.
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
  const query = useStageQuery(programSlug, stageSlug);
  const state = getQueryState(query.error, query.isPending);

  if (state) {
    return state;
  }

  const stage = query.data?.stage;

  if (!stage) {
    return (
      <EmptyState
        description="Cette étape est indisponible."
        title="Étape introuvable"
      />
    );
  }

  return (
    <section aria-labelledby="stage-title" class="page-shell">
      <div>
        <p class="text-sm font-semibold tracking-[0.2em] text-cyan-400 uppercase">
          Étape
        </p>
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
          description="Les modules publiés apparaîtront ici."
          title="Aucun module disponible"
        />
      ) : (
        <div class="grid gap-5 xl:grid-cols-2">
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
                Ouvrir le module
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
  const restart = useModuleRestart(query.data?.module.id ?? '');
  const state = getQueryState(query.error, query.isPending);

  if (state) {
    return state;
  }

  const module = query.data?.module;

  if (!module) {
    return (
      <EmptyState
        description="Ce module est indisponible."
        title="Module introuvable"
      />
    );
  }

  return (
    <section aria-labelledby="module-title" class="page-shell">
      <div>
        <p class="text-sm font-semibold tracking-[0.2em] text-cyan-400 uppercase">
          Module
        </p>
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <h1 id="module-title" class="text-3xl font-bold tracking-tight">
            {module.title}
          </h1>
          {module.isPublished ? null : <DraftBadge />}
        </div>
        <p class="mt-3 text-slate-300">{module.description}</p>
      </div>
      <ProgressPlaceholder />
      {module.lessons.length === 0 ? (
        <EmptyState
          description="Les leçons publiées apparaîtront ici."
          title="Aucune leçon disponible"
        />
      ) : (
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
        <Card class="space-y-4 border border-red-950/80">
          <div>
            <h2 class="font-semibold">Reprendre ce module depuis le début</h2>
            <p class="mt-2 text-sm leading-6 text-slate-300">
              Cette action crée une nouvelle reprise. L’historique reste
              conservé.
            </p>
          </div>
          {restart.preview ? (
            <div
              class="space-y-4"
              role="alertdialog"
              aria-labelledby="restart-title"
            >
              <h3 class="font-semibold text-red-200" id="restart-title">
                Confirmer la reprise du module
              </h3>
              <p class="text-sm leading-6 text-slate-300">
                Seront remis à zéro : {restart.preview.reset.lessons} leçons,{' '}
                {restart.preview.reset.tasks} tâches,{' '}
                {restart.preview.reset.resources} ressources,{' '}
                {restart.preview.reset.concepts} notions,{' '}
                {restart.preview.reset.quizzes} quiz réussis et{' '}
                {restart.preview.reset.exercises} exercices de la reprise
                courante.
              </p>
              <p class="text-sm leading-6 text-slate-300">
                Seront conservés : {restart.preview.preserved.notes} notes,{' '}
                {restart.preview.preserved.quizAttempts} tentatives de quiz,{' '}
                {restart.preview.preserved.conceptAttempts} tentatives de
                mini-évaluation et{' '}
                {restart.preview.preserved.exerciseSubmissions} soumissions
                d’exercice.
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
                  Oui, recommencer ce module
                </Button>
                <Button onClick={restart.cancel} variant="secondary">
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <Button
              isLoading={restart.isPending}
              onClick={() => void restart.loadPreview()}
              variant="danger"
            >
              Recommencer ce module
            </Button>
          )}
          {restart.error ? (
            <p class="text-sm text-red-300" role="alert">
              La reprise du module n’a pas pu être effectuée.
            </p>
          ) : null}
        </Card>
      ) : null}
    </section>
  );
}
