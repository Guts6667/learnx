import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { NavigationAction } from '@/components/ui/NavigationAction';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  type ReviewItem,
  useCompleteReviewMutation,
  useReviewsQuery,
} from '@/features/reviews/queries';
import { useI18n, type UiLocale } from '@/i18n';
import { formatLocalizedDate } from '@/shared/locale';

function formatDueAt(value: string, locale: UiLocale): string {
  return formatLocalizedDate(value, locale, { dateStyle: 'long' });
}

function isOverdue(value: string): boolean {
  return new Date(value).getTime() < Date.now();
}

function getSafeExternalUrl(value: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);

    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function ReviewCard({
  item,
  onComplete,
  pendingId,
}: {
  item: ReviewItem;
  onComplete: (reviewId: string) => Promise<unknown>;
  pendingId: string | null;
}) {
  const { locale } = useI18n();
  const assessmentHref = `/program/${encodeURIComponent(item.program.slug)}/lesson/${encodeURIComponent(item.lesson.slug)}/assessment?assessmentId=${encodeURIComponent(item.sourceId)}`;

  return (
    <li>
      <Card class="space-y-4">
        <div class="flex flex-wrap items-center gap-2">
          <Badge tone={isOverdue(item.dueAt) ? 'danger' : 'warning'}>
            {isOverdue(item.dueAt) ? 'En retard' : 'À réviser'}
          </Badge>
          {item.isDraft ? <Badge tone="neutral">Brouillon</Badge> : null}
        </div>
        <div>
          <h2 class="text-lg font-semibold">
            {item.conceptTitle ?? item.lesson.title}
          </h2>
          <p class="mt-1 text-sm text-slate-300">
            {item.program.title} · {item.lesson.title}
          </p>
          <p class="mt-2 text-sm text-slate-400">
            À revoir le {formatDueAt(item.dueAt, locale)}
          </p>
        </div>
        {item.assessmentTitle ? (
          <p class="text-sm text-slate-300">{item.assessmentTitle}</p>
        ) : null}
        {item.resources.length > 0 ? (
          <div>
            <h3 class="text-sm font-semibold text-slate-200">
              Ressources suggérées
            </h3>
            <ul class="mt-2 space-y-2">
              {item.resources.map((resource) => {
                const href = getSafeExternalUrl(resource.url);

                return (
                  <li class="text-sm" key={resource.id}>
                    {href ? (
                      <a
                        class="inline-flex min-h-11 items-center text-cyan-300 underline"
                        href={href}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {resource.title}
                      </a>
                    ) : (
                      <span class="text-slate-300">{resource.title}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        <div class="grid gap-3 sm:grid-cols-2">
          <NavigationAction href={assessmentHref} variant="secondary">
            Refaire l’évaluation
          </NavigationAction>
          <Button
            isLoading={pendingId === item.id}
            onClick={() => void onComplete(item.id)}
            variant="secondary"
          >
            Marquer comme terminée
          </Button>
        </div>
      </Card>
    </li>
  );
}

export function ReviewsPage() {
  const query = useReviewsQuery();
  const mutation = useCompleteReviewMutation();

  async function completeReview(reviewId: string) {
    try {
      await mutation.complete(reviewId);
    } catch {
      // L’erreur normalisée est affichée dans la page.
    }
  }

  return (
    <section aria-labelledby="reviews-title" class="page-shell">
      <PageHeader
        description="Reprenez les notions à renforcer et leurs ressources recommandées."
        eyebrow="Consolidation"
        id="reviews-title"
        title="Révisions"
      />

      {mutation.error ? (
        <ErrorState description="La révision n’a pas pu être mise à jour." />
      ) : null}
      {query.isPending ? <Skeleton label="Chargement des révisions" /> : null}
      {query.error ? (
        <ErrorState description="Les révisions n’ont pas pu être chargées." />
      ) : null}
      {!query.isPending && !query.error && query.data?.reviews.length === 0 ? (
        <EmptyState
          description="Une révision apparaîtra ici lorsqu’une notion devra être renforcée."
          title="Aucune révision en attente"
        />
      ) : null}
      {query.data?.reviews.length ? (
        <ul class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {query.data.reviews.map((item) => (
            <ReviewCard
              item={item}
              key={item.id}
              onComplete={completeReview}
              pendingId={mutation.pendingId}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
