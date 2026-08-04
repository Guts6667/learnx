import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { NavigationAction } from '@/components/ui/NavigationAction';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
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
    <section aria-labelledby="today-title" class="page-shell">
      <PageHeader
        eyebrow="Parcours personnel"
        id="today-title"
        title="Aujourd’hui"
      />

      {query.isPending ? (
        <Skeleton label="Chargement d’aujourd’hui" />
      ) : query.error ? (
        <ErrorState description="Les recommandations n’ont pas pu être chargées." />
      ) : query.data?.program ? (
        <TodayContent data={query.data} program={query.data.program} />
      ) : (
        <EmptyState
          action={
            <NavigationAction href="/program" variant="secondary">
              Voir les programmes
            </NavigationAction>
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
    <div class="grid min-w-0 gap-5 lg:grid-cols-12">
      {data.action ? (
        <Card class="space-y-5 lg:col-span-7 lg:row-span-2" tone="accent">
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
                {data.action.lessonTitle ? ` · ${data.action.lessonTitle}` : ''}
              </p>
            ) : null}
            {data.action.estimatedMinutes ? (
              <p class="mt-1 text-sm text-slate-400">
                Durée indicative : {data.action.estimatedMinutes} min
              </p>
            ) : null}
          </div>
          <NavigationAction class="w-full" href={data.action.href} size="lg">
            Continuer
          </NavigationAction>
        </Card>
      ) : (
        <EmptyState
          class="lg:col-span-7 lg:row-span-2"
          description="Aucune action pédagogique n’est requise pour le moment."
          title="Tout est à jour"
        />
      )}

      <Card class="space-y-4 lg:col-span-5">
        <div>
          <p class="text-sm text-slate-400">Programme actif</p>
          <h2 class="mt-1 text-xl font-semibold">{program.title}</h2>
        </div>
        <ProgressBar
          label={`Progression — ${Math.round(program.percent)} %`}
          value={program.percent}
        />
      </Card>

      <div class="grid gap-3 sm:grid-cols-2 lg:col-span-5">
        <Card>
          <p class="text-sm text-slate-400">Révisions dues</p>
          <p class="mt-2 text-2xl font-bold">{data.reviewsDue}</p>
        </Card>
        <Card>
          <p class="text-sm text-slate-400">Dernière activité</p>
          {data.lastActivity ? (
            <NavigationAction
              class="mt-2 w-full"
              href={data.lastActivity.href}
              variant="ghost"
            >
              {data.lastActivity.title} ·{' '}
              {formatLastActivity(data.lastActivity.at)}
            </NavigationAction>
          ) : (
            <p class="mt-2 text-sm text-slate-300">Aucune activité récente</p>
          )}
        </Card>
      </div>
    </div>
  );
}
