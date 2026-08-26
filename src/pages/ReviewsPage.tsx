import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { QueryState } from '@/components/learnx/QueryState';
import { NavigationAction } from '@/components/ui/NavigationAction';
import { PageHeader } from '@/components/ui/PageHeader';
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

function isDueTodayOrOverdue(value: string): boolean {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return new Date(value).getTime() <= endOfToday.getTime();
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

function ReviewRow({
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
    <li className="review-priority-row">
      <div className="review-priority-row__content">
        <div className="review-priority-row__status">
          <Badge tone={isOverdue(item.dueAt) ? 'danger' : 'warning'}>
            {t(isOverdue(item.dueAt) ? 'reviews.overdue' : 'reviews.due')}
          </Badge>
          {item.isDraft ? (
            <Badge tone="neutral">{t('common.draft')}</Badge>
          ) : null}
        </div>
        <div className="review-priority-row__heading">
          <h3>{item.conceptTitle ?? item.lesson.title}</h3>
          <p>
            {item.program.title} · {item.lesson.title}
          </p>
          <p>{t('reviews.dueAt', { date: formatDueAt(item.dueAt, locale) })}</p>
        </div>
        {item.assessmentTitle ? (
          <p className="review-priority-row__assessment">
            {item.assessmentTitle}
          </p>
        ) : null}
        {item.resources.length > 0 ? (
          <div className="review-priority-row__resources">
            <strong>{t('reviews.resources')}</strong>
            <ul>
              {item.resources.map((resource) => {
                const href = getSafeExternalUrl(resource.url);

                return (
                  <li key={resource.id}>
                    {href ? (
                      <a
                        className="ui-link inline-flex min-h-11 items-center"
                        href={href}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {resource.title}
                      </a>
                    ) : (
                      <span className="ui-text-muted">{resource.title}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="review-priority-row__actions">
        <NavigationAction href={assessmentHref}>
          {t('reviews.retake')}
        </NavigationAction>
        <Button
          isLoading={pendingId === item.id}
          onClick={() => void onComplete(item.id)}
          variant="ghost"
        >
          {t('reviews.complete')}
        </Button>
      </div>
    </li>
  );
}

export function ReviewsPage() {
  const query = useReviewsQuery();
  const mutation = useCompleteReviewMutation();
  const { t } = useI18n();
  const dueNow =
    query.data?.reviews.filter((item) => isDueTodayOrOverdue(item.dueAt)) ?? [];
  const upcoming =
    query.data?.reviews.filter((item) => !isDueTodayOrOverdue(item.dueAt)) ??
    [];

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
      className="totem-reviews-page page-layout page-layout--work page-shell"
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
      <QueryState
        error={query.error}
        errorDescription={t('reviews.loadError')}
        isPending={query.isPending}
        loadingLabel={t('reviews.loading')}
        onRetry={query.refetch}
        retryLabel={t('common.retry')}
      />
      {!query.isPending && !query.error && query.data?.reviews.length === 0 ? (
        <EmptyState
          description={t('reviews.empty.description')}
          title={t('reviews.empty.title')}
        />
      ) : null}
      {query.data?.reviews.length ? (
        <div className="reviews-priorities">
          <div className="reviews-priorities__summary" role="status">
            <strong>{dueNow.length}</strong>
            <span>{t('reviews.summary', { count: dueNow.length })}</span>
          </div>

          {dueNow.length > 0 ? (
            <section
              aria-labelledby="reviews-today-title"
              className="reviews-priorities__section"
            >
              <div className="reviews-priorities__section-heading">
                <h2 id="reviews-today-title">{t('reviews.todayPriority')}</h2>
                <span>{dueNow.length}</span>
              </div>
              <ul className="reviews-priorities__list">
                {dueNow.map((item) => (
                  <ReviewRow
                    item={item}
                    key={item.id}
                    onComplete={completeReview}
                    pendingId={mutation.pendingId}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {upcoming.length > 0 ? (
            <section
              aria-labelledby="reviews-upcoming-title"
              className="reviews-priorities__section"
            >
              <div className="reviews-priorities__section-heading">
                <h2 id="reviews-upcoming-title">{t('reviews.upcoming')}</h2>
                <span>{upcoming.length}</span>
              </div>
              <ul className="reviews-priorities__list">
                {upcoming.map((item) => (
                  <ReviewRow
                    item={item}
                    key={item.id}
                    onComplete={completeReview}
                    pendingId={mutation.pendingId}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {query.hasMore ? (
            <Button
              isLoading={query.isLoadingMore}
              onClick={() => void query.loadMore()}
              variant="secondary"
            >
              {t('common.loadMore')}
            </Button>
          ) : null}
          {query.loadMoreError ? (
            <ErrorState
              action={
                <Button
                  onClick={() => void query.loadMore()}
                  variant="secondary"
                >
                  {t('common.retry')}
                </Button>
              }
              description={t('reviews.loadMoreError')}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
