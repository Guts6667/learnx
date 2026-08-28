import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { useAppQueryClient } from '@/app/providers';
import { apiRequest } from '@/lib/api-client';

interface ReviewResource {
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
  const result = useInfiniteQuery({
    queryKey: ['reviews'],
    queryFn: ({ pageParam }) =>
      apiRequest<ReviewsResponse>(
        pageParam
          ? `/api/reviews?cursor=${encodeURIComponent(pageParam)}`
          : '/api/reviews',
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    initialPageParam: null as string | null,
    staleTime: 0,
  });
  const reviews = useMemo(() => {
    const uniqueReviews = new Map<string, ReviewItem>();
    for (const page of result.data?.pages ?? []) {
      for (const review of page.reviews) uniqueReviews.set(review.id, review);
    }
    return [...uniqueReviews.values()];
  }, [result.data?.pages]);
  const loadMore = useCallback(async () => {
    if (!result.hasNextPage || result.isFetchingNextPage) return;
    try {
      await result.fetchNextPage();
    } catch {
      // React Query conserve les pages déjà chargées et expose l'erreur.
    }
  }, [result.fetchNextPage, result.hasNextPage, result.isFetchingNextPage]);
  const lastPage = result.data?.pages.at(-1);

  return {
    data: result.data
      ? { nextCursor: lastPage?.nextCursor ?? null, reviews }
      : undefined,
    error: result.data ? null : result.error,
    hasMore: result.hasNextPage,
    isPending: result.isPending,
    isLoadingMore: result.isFetchingNextPage,
    loadMore,
    loadMoreError:
      result.data && result.isFetchNextPageError ? result.error : null,
    refetch: result.refetch,
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
