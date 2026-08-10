import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { NavigationAction } from '@/components/ui/NavigationAction';
import { PageHeader } from '@/components/ui/PageHeader';
import { Section } from '@/components/ui/Section';
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
  const { locale, t } = useI18n();
  const assessmentHref = `/program/${encodeURIComponent(item.program.slug)}/lesson/${encodeURIComponent(item.lesson.slug)}/assessment?assessmentId=${encodeURIComponent(item.sourceId)}`;

  return (
    <li>
      <Card class="space-y-4">
        <div class="flex flex-wrap items-center gap-2">
          <Badge tone={isOverdue(item.dueAt) ? 'danger' : 'warning'}>
            {t(isOverdue(item.dueAt) ? 'reviews.overdue' : 'reviews.due')}
          </Badge>
          {item.isDraft ? (
            <Badge tone="neutral">{t('common.draft')}</Badge>
          ) : null}
        </div>
        <div>
          <h2 class="text-lg font-semibold">
            {item.conceptTitle ?? item.lesson.title}
          </h2>
          <p class="ui-text-muted mt-1 text-sm">
            {item.program.title} · {item.lesson.title}
          </p>
          <p class="ui-text-muted mt-2 text-sm">
            {t('reviews.dueAt', { date: formatDueAt(item.dueAt, locale) })}
          </p>
        </div>
        {item.assessmentTitle ? (
          <p class="ui-text-muted text-sm">{item.assessmentTitle}</p>
        ) : null}
        {item.resources.length > 0 ? (
          <Section>
            <h3 class="ui-text text-sm font-semibold">
              {t('reviews.resources')}
            </h3>
            <ul class="mt-2 space-y-2">
              {item.resources.map((resource) => {
                const href = getSafeExternalUrl(resource.url);

                return (
                  <li class="text-sm" key={resource.id}>
                    {href ? (
                      <a
                        class="ui-link inline-flex min-h-11 items-center"
                        href={href}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {resource.title}
                      </a>
                    ) : (
                      <span class="ui-text-muted">{resource.title}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>
        ) : null}
        <div class="grid gap-3 sm:grid-cols-2">
          <NavigationAction href={assessmentHref} variant="secondary">
            {t('reviews.retake')}
          </NavigationAction>
          <Button
            isLoading={pendingId === item.id}
            onClick={() => void onComplete(item.id)}
            variant="secondary"
          >
            {t('reviews.complete')}
          </Button>
        </div>
      </Card>
    </li>
  );
}

export function ReviewsPage() {
  const query = useReviewsQuery();
  const mutation = useCompleteReviewMutation();
  const { t } = useI18n();

  async function completeReview(reviewId: string) {
    try {
      await mutation.complete(reviewId);
    } catch {
      // L’erreur normalisée est affichée dans la page.
    }
  }

  return (
    <section
      aria-labelledby="reviews-title"
      class="page-layout page-layout--work page-shell"
    >
      <PageHeader
        description={t('reviews.description')}
        eyebrow={t('reviews.eyebrow')}
        id="reviews-title"
        title={t('reviews.title')}
      />

      {mutation.error ? (
        <ErrorState description={t('reviews.updateError')} />
      ) : null}
      {query.isPending ? <Skeleton label={t('reviews.loading')} /> : null}
      {query.error ? <ErrorState description={t('reviews.loadError')} /> : null}
      {!query.isPending && !query.error && query.data?.reviews.length === 0 ? (
        <EmptyState
          description={t('reviews.empty.description')}
          title={t('reviews.empty.title')}
        />
      ) : null}
      {query.data?.reviews.length ? (
        <div class="space-y-4">
          <ul class="grid gap-4 md:grid-cols-2">
            {query.data.reviews.map((item) => (
              <ReviewCard
                item={item}
                key={item.id}
                onComplete={completeReview}
                pendingId={mutation.pendingId}
              />
            ))}
          </ul>
          {query.hasMore ? (
            <Button
              isLoading={query.isLoadingMore}
              onClick={() => void query.loadMore()}
              variant="secondary"
            >
              {t('common.loadMore')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
