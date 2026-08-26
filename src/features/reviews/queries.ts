import { QueryObserver } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAppQueryClient } from '@/app/providers';
import { apiRequest } from '@/lib/api-client';

export interface ReviewResource {
  id: string;
  title: string;
  url: string | null;
}

export interface ReviewItem {
  assessmentTitle: string | null;
  conceptTitle: string | null;
  dueAt: string;
  id: string;
  intervalDays: number;
  isDraft: boolean;
  lesson: { id: string; slug: string; title: string };
  program: { id: string; slug: string; title: string };
  resources: ReviewResource[];
  sourceId: string;
  sourceType: 'CONCEPT_ASSESSMENT';
  status: 'PENDING';
}

interface ReviewsResponse {
  nextCursor: string | null;
  reviews: ReviewItem[];
}

interface CompleteReviewResponse {
  review: { completedAt: string; id: string; status: 'COMPLETED' };
}

export function useReviewsQuery() {
  const queryClient = useAppQueryClient();
  const observer = useMemo(
    () =>
      new QueryObserver<ReviewsResponse>(queryClient, {
        queryKey: ['reviews'],
        queryFn: () => apiRequest<ReviewsResponse>('/api/reviews'),
        staleTime: 0,
      }),
    [queryClient],
  );
  const [result, setResult] = useState(() => observer.getCurrentResult());
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    setResult(observer.getCurrentResult());
    const unsubscribe = observer.subscribe(setResult);
    void observer.refetch();
    return unsubscribe;
  }, [observer]);

  useEffect(() => {
    if (!result.data) return;
    setReviews(result.data.reviews);
    setNextCursor(result.data.nextCursor);
  }, [result.data]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const page = await apiRequest<ReviewsResponse>(
        `/api/reviews?cursor=${encodeURIComponent(nextCursor)}`,
      );
      setReviews((current) => [
        ...current,
        ...page.reviews.filter(
          (review) => !current.some((existing) => existing.id === review.id),
        ),
      ]);
      setNextCursor(page.nextCursor);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, nextCursor]);

  return {
    data: result.data ? { ...result.data, nextCursor, reviews } : undefined,
    error: result.error,
    hasMore: Boolean(nextCursor),
    isPending: result.isPending,
    isLoadingMore,
    loadMore,
  };
}

export function useCompleteReviewMutation() {
  const queryClient = useAppQueryClient();
  const [error, setError] = useState<unknown>();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const complete = useCallback(
    async (reviewId: string) => {
      setError(undefined);
      setPendingId(reviewId);

      try {
        const response = await apiRequest<CompleteReviewResponse>(
          `/api/reviews/${encodeURIComponent(reviewId)}`,
          {
            body: JSON.stringify({ status: 'completed' }),
            headers: { 'content-type': 'application/json' },
            method: 'PATCH',
          },
        );

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['reviews'] }),
          queryClient.invalidateQueries({ queryKey: ['today'] }),
        ]);
        return response.review;
      } catch (requestError) {
        setError(requestError);
        throw requestError;
      } finally {
        setPendingId(null);
      }
    },
    [queryClient],
  );

  return { complete, error, pendingId };
}
