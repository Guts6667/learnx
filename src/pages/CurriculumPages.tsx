import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Spinner } from '@/components/ui/Spinner';
import { StageAssessmentCard } from '@/features/stage-assessments/StageAssessmentCard';
import {
  type StageValidation,
  useModuleQuery,
  useProgramQuery,
  useProgramsQuery,
  useStageQuery,
} from '@/features/curriculum/queries';

function getQueryState(error: unknown, isPending: boolean) {
  if (isPending) {
    return <Spinner label="Chargement du parcours" />;
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
    <section aria-labelledby="programs-title" class="space-y-5">
      <div>
        <p class="text-sm font-semibold tracking-[0.2em] text-cyan-400 uppercase">
          Parcours
        </p>
        <h1 id="programs-title" class="mt-3 text-3xl font-bold tracking-tight">
          Mes programmes
        </h1>
      </div>
      {programs.map((program) => (
        <Card key={program.id} class="space-y-4">
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
          <a
            class="inline-flex min-h-11 items-center rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950"
            href={`/program/${program.slug}`}
          >
            Ouvrir le programme
          </a>
        </Card>
      ))}
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
    <section aria-labelledby="program-title" class="space-y-5">
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
        <div class="space-y-3">
          {program.stages.map((stage) => (
            <Card key={stage.id}>
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="text-lg font-semibold">{stage.title}</h2>
                {stage.isPublished ? null : <DraftBadge />}
              </div>
              <a
                class="mt-3 inline-flex min-h-11 items-center text-cyan-300 underline"
                href={`/program/${program.slug}/stage/${stage.slug}`}
              >
                Ouvrir l’étape
              </a>
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
    <section aria-labelledby="stage-title" class="space-y-5">
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
        stage.modules.map((module) => (
          <Card key={module.id}>
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-lg font-semibold">{module.title}</h2>
              {module.isPublished ? null : <DraftBadge />}
            </div>
            <a
              class="mt-3 inline-flex min-h-11 items-center text-cyan-300 underline"
              href={`/program/${programSlug}/module/${module.slug}`}
            >
              Ouvrir le module
            </a>
          </Card>
        ))
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
    <section aria-labelledby="module-title" class="space-y-5">
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
        <div class="space-y-3">
          {module.lessons.map((lesson) => (
            <Card key={lesson.id}>
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="text-lg font-semibold">{lesson.title}</h2>
                {lesson.isPublished ? null : <DraftBadge />}
              </div>
              <p class="mt-2 text-sm text-slate-300">{lesson.summary}</p>
              <a
                class="mt-3 inline-flex min-h-11 items-center text-cyan-300 underline"
                href={`/program/${programSlug}/lesson/${lesson.slug}`}
              >
                Ouvrir la leçon
              </a>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
