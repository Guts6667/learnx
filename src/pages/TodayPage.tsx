import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Spinner } from '@/components/ui/Spinner';
import { useTodayQuery, type TodayResponse } from '@/features/today/query';
import type { RecommendationKind } from '@/lib/recommendation';

const actionLabels: Record<RecommendationKind, string> = {
  DUE_TODAY_REVIEW: 'Révision du jour',
  INCOMPLETE_TASK: 'Tâche à poursuivre',
  NEXT_LESSON: 'Prochaine leçon',
  NEXT_MODULE: 'Prochain module',
  NEXT_STAGE: 'Prochaine étape',
  OVERDUE_REVIEW: 'Révision en retard',
  REQUIRED_EXERCISE: 'Évaluation requise',
  REQUIRED_QUIZ: 'Quiz requis',
};

function formatLastActivity(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function TodayPage() {
  const query = useTodayQuery();

  return (
    <section aria-labelledby="today-title" class="space-y-5">
      <div>
        <p class="text-sm font-semibold tracking-[0.2em] text-cyan-400 uppercase">
          Parcours personnel
        </p>
        <h1 id="today-title" class="mt-3 text-3xl font-bold tracking-tight">
          Aujourd’hui
        </h1>
      </div>

      {query.isPending ? (
        <Spinner label="Chargement d’aujourd’hui" />
      ) : query.error ? (
        <ErrorState description="Les recommandations n’ont pas pu être chargées." />
      ) : query.data?.program ? (
        <TodayContent data={query.data} program={query.data.program} />
      ) : (
        <EmptyState
          action={
            <a class="text-cyan-300 underline" href="/program">
              Voir les programmes
            </a>
          }
          description="Démarrez un programme publié pour recevoir une recommandation quotidienne."
          title="Aucun programme actif"
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
  return (
    <>
      <Card class="space-y-4">
        <div>
          <p class="text-sm text-slate-400">Programme actif</p>
          <h2 class="mt-1 text-xl font-semibold">{program.title}</h2>
        </div>
        <ProgressBar
          label={`Progression — ${Math.round(program.percent)} %`}
          value={program.percent}
        />
      </Card>

      {data.action ? (
        <Card class="space-y-4 border-cyan-900">
          <Badge
            tone={data.action.kind === 'OVERDUE_REVIEW' ? 'danger' : 'info'}
          >
            {actionLabels[data.action.kind]}
          </Badge>
          <div>
            <h2 class="text-xl font-semibold">{data.action.title}</h2>
            {data.action.stageTitle ? (
              <p class="mt-2 text-sm text-slate-300">
                {data.action.stageTitle}
                {data.action.moduleTitle ? ` · ${data.action.moduleTitle}` : ''}
              </p>
            ) : null}
            {data.action.estimatedMinutes ? (
              <p class="mt-1 text-sm text-slate-400">
                Durée indicative : {data.action.estimatedMinutes} min
              </p>
            ) : null}
          </div>
          <a
            class="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950"
            href={data.action.href}
          >
            Continuer
          </a>
        </Card>
      ) : (
        <EmptyState
          description="Aucune action pédagogique n’est requise pour le moment."
          title="Tout est à jour"
        />
      )}

      <div class="grid gap-3 sm:grid-cols-2">
        <Card>
          <p class="text-sm text-slate-400">Révisions dues</p>
          <p class="mt-2 text-2xl font-bold">{data.reviewsDue}</p>
        </Card>
        <Card>
          <p class="text-sm text-slate-400">Dernière activité</p>
          {data.lastActivity ? (
            <a
              class="mt-2 block text-sm text-cyan-300 underline"
              href={data.lastActivity.href}
            >
              {data.lastActivity.title} ·{' '}
              {formatLastActivity(data.lastActivity.at)}
            </a>
          ) : (
            <p class="mt-2 text-sm text-slate-300">Aucune activité récente</p>
          )}
        </Card>
      </div>
    </>
  );
}
