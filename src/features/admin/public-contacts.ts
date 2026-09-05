import { QueryObserver } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { useAppQueryClient } from '@/app/providers';
import { apiRequest } from '@/lib/api-client';

export type PublicLeadPurpose = 'EARLY_ADOPTER' | 'LAUNCH_UPDATES';
export type PublicLeadStatus =
  'CONFIRMED' | 'DELETED' | 'PENDING_CONFIRMATION' | 'UNSUBSCRIBED';

export interface PublicContactPurpose {
  confirmedAt: string | null;
  createdAt: string;
  firstName: string | null;
  friction: string | null;
  locale: string;
  motivation: string | null;
  purpose: PublicLeadPurpose;
  status: PublicLeadStatus;
}

export interface PublicContact {
  createdAt: string;
  emailNormalized: string;
  id: string;
  purposes: PublicContactPurpose[];
}

export interface PublicContactPage {
  earlyAdopterApplications: number;
  items: PublicContact[];
  launchUpdatesConfirmed: number;
  limit: number;
  offset: number;
  total: number;
}

interface PublicContactFilters {
  limit: number;
  offset: number;
  purpose?: PublicLeadPurpose;
  search: string;
}

export function useAdminPublicContactsQuery(filters: PublicContactFilters) {
  const queryClient = useAppQueryClient();
  const parameters = new URLSearchParams({
    limit: String(filters.limit),
    offset: String(filters.offset),
  });
  if (filters.purpose) parameters.set('purpose', filters.purpose);
  if (filters.search) parameters.set('search', filters.search);
  const path = `/api/admin/public-leads?${parameters.toString()}`;
  const observer = useMemo(
    () =>
      new QueryObserver<PublicContactPage>(queryClient, {
        queryFn: () =>
          apiRequest<{ page: PublicContactPage }>(path).then(
            (response) => response.page,
          ),
        queryKey: ['admin', 'public-contacts', filters] as const,
        staleTime: 10_000,
      }),
    [
      filters.limit,
      filters.offset,
      filters.purpose,
      filters.search,
      path,
      queryClient,
    ],
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
    retry: () => observer.refetch(),
  };
}
