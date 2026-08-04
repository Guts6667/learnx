import { route } from 'preact-router';

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
import {
  type LessonSummary,
  type StageValidation,
  useModuleQuery,
  useModuleRestart,
  useProgramQuery,
  useProgramsQuery,
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

export function ProgramsPage() {
  const query = useProgramsQuery();
  const state = getQueryState(query.error, query.isPending);

  if (state) {
    return state;
  }

  const programs = query.data?.programs ?? [];

  if (programs.length === 0) {
    return (
      <EmptyState
        description="Les programmes publiés apparaîtront ici."
        title="Aucun programme disponible"
      />
    );
  }

  return (
    <section aria-labelledby="programs-title" class="page-shell">
      <PageHeader
        eyebrow="Parcours"
        id="programs-title"
        title="Mes programmes"
      />
      <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {programs.map((program) => (
          <Card key={program.id} class="flex flex-col space-y-4">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="text-xl font-semibold">{program.title}</h2>
                {program.status === 'DRAFT' ? <DraftBadge /> : null}
              </div>
              <p class="mt-2 text-sm leading-6 text-slate-300">
                {program.description}
              </p>
            </div>
            <ProgressPlaceholder />
            <NavigationAction
              class="mt-auto"
              href={`/program/${program.slug}`}
            >
              Ouvrir le programme
            </NavigationAction>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function ProgramPage({ programSlug }: { programSlug: string }) {
  const query = useProgramQuery(programSlug);
  const state = getQueryState(query.error, query.isPending);

  if (state) {
    return state;
  }

  const program = query.data?.program;

  if (!program) {
    return (
      <EmptyState
        description="Ce programme est indisponible."
        title="Programme introuvable"
      />
    );
  }

  return (
    <section aria-labelledby="program-title" class="page-shell">
      <div>
        <p class="text-sm font-semibold tracking-[0.2em] text-cyan-400 uppercase">
          Programme
        </p>
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <h1 id="program-title" class="text-3xl font-bold tracking-tight">
            {program.title}
          </h1>
          {program.status === 'DRAFT' ? <DraftBadge /> : null}
        </div>
        <p class="mt-3 text-slate-300">{program.description}</p>
      </div>
      <ProgressPlaceholder />
      {program.stages.length === 0 ? (
        <EmptyState
          description="Les étapes publiées apparaîtront ici."
          title="Aucune étape disponible"
        />
      ) : (
        <div class="grid gap-5 xl:grid-cols-2">
          {program.stages.map((stage) => (
            <Card class="space-y-4" key={stage.id}>
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="text-lg font-semibold">{stage.title}</h2>
                {stage.isPublished ? null : <DraftBadge />}
              </div>
              {stage.modules.map((module) => (
                <section class="space-y-3" key={module.id}>
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <h3 class="font-semibold text-slate-200">{module.title}</h3>
                    <NavigationAction
                      href={`/program/${program.slug}/module/${module.slug}`}
                      size="sm"
                      variant="ghost"
                    >
                      Voir le module
                    </NavigationAction>
                  </div>
                  {module.lessons.map((lesson) => (
                    <LessonSummaryCard
                      key={lesson.id}
                      lesson={lesson}
                      programSlug={program.slug}
                      stageSlug={stage.slug}
                    />
                  ))}
                </section>
              ))}
            </Card>
          ))}
        </div>
      )}
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
