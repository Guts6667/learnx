import { QueryObserver } from '@tanstack/query-core';
import { useEffect, useMemo, useState } from 'preact/hooks';

import { useAppQueryClient } from '@/app/providers';
import { apiRequest } from '@/lib/api-client';
import type { RecommendationKind } from '@/lib/recommendation';

export interface TodayResponse {
  action: {
    estimatedMinutes: number | null;
    href: string;
    kind: RecommendationKind;
    lessonTitle: string | null;
    moduleTitle: string | null;
    programId: string;
    programSlug: string;
    programTitle: string;
    stageTitle: string | null;
    title: string;
  } | null;
  lastActivity: {
    at: string;
    href: string;
    title: string;
  } | null;
  program: {
    id: string;
    percent: number;
    slug: string;
    title: string;
  } | null;
  hasMorePrograms: boolean;
  programCount: number;
  programs: Array<{
    id: string;
    lastActivity: {
      at: string;
      href: string;
      title: string;
    } | null;
    nextAction: TodayResponse['action'];
    percent: number;
    resumeHref: string | null;
    slug: string;
    status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED';
    title: string;
  }>;
  reviewsDue: number;
}

function getTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function useTodayQuery() {
  const queryClient = useAppQueryClient();
  const timeZone = getTimeZone();
  const observer = useMemo(
    () =>
      new QueryObserver(queryClient, {
        queryKey: ['today', timeZone],
        queryFn: () =>
          apiRequest<TodayResponse>(
            `/api/today?timeZone=${encodeURIComponent(timeZone)}`,
          ),
        staleTime: 60_000,
      }),
    [queryClient, timeZone],
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
    reload: () => observer.refetch(),
  };
}
