import { QueryObserver } from '@tanstack/query-core';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';

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

  useEffect(() => {
    setResult(observer.getCurrentResult());
    const unsubscribe = observer.subscribe(setResult);
    void observer.refetch();
    return unsubscribe;
  }, [observer]);

  return {
    data: result.data,
    error: result.error,
    isPending: result.isPending,
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
