import { QueryObserver } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAppQueryClient } from '@/app/providers';
import { apiRequest } from '@/lib/api-client';

export type AccessRequestStatus = 'APPROVED' | 'PENDING_APPROVAL' | 'REJECTED';
export type AssignableRole = 'ADMIN' | 'CREATOR' | 'USER';

export interface AdminAccessRequest {
  assignedRole: AssignableRole | null;
  createdAt: string;
  emailNormalized: string;
  emailVerifiedAt: string;
  id: string;
  invitationExpiresAt: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  status: AccessRequestStatus;
  version: number;
}

export interface AdminAccessRequestPage {
  items: AdminAccessRequest[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface AccessRequestFilters {
  page: number;
  pageSize: number;
  search: string;
  status: AccessRequestStatus;
}

const accessRequestsKey = ['admin', 'access-requests'] as const;

export function useAdminAccessRequestsQuery(filters: AccessRequestFilters) {
  const queryClient = useAppQueryClient();
  const searchParams = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.pageSize),
    status: filters.status,
  });
  if (filters.search) searchParams.set('search', filters.search);
  const path = `/api/admin/access-requests?${searchParams.toString()}`;
  const observer = useMemo(
    () =>
      new QueryObserver<AdminAccessRequestPage>(queryClient, {
        queryFn: () =>
          apiRequest<{ page: AdminAccessRequestPage }>(path).then(
            (response) => response.page,
          ),
        queryKey: [...accessRequestsKey, filters] as const,
        staleTime: 10_000,
      }),
    [
      filters.page,
      filters.pageSize,
      filters.search,
      filters.status,
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

export function useAdminAccessRequestReviewMutation() {
  const queryClient = useAppQueryClient();
  const [error, setError] = useState<unknown>();
  const [isPending, setIsPending] = useState(false);

  const execute = useCallback(
    async (
      requestId: string,
      action: 'approve' | 'reject' | 'resend-invitation',
      input:
        | { expectedVersion: number }
        | { expectedVersion: number; reason: string }
        | { expectedVersion: number; role: AssignableRole },
    ) => {
      setError(undefined);
      setIsPending(true);
      try {
        const response = await apiRequest<{ request: AdminAccessRequest }>(
          `/api/admin/access-requests/${encodeURIComponent(requestId)}/${action}`,
          {
            body: JSON.stringify(input),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
          },
        );
        await queryClient.invalidateQueries({ queryKey: accessRequestsKey });
        return response.request;
      } catch (requestError) {
        setError(requestError);
        throw requestError;
      } finally {
        setIsPending(false);
      }
    },
    [queryClient],
  );

  return {
    approve: (
      requestId: string,
      input: { expectedVersion: number; role: AssignableRole },
    ) => execute(requestId, 'approve', input),
    error,
    isPending,
    reject: (
      requestId: string,
      input: { expectedVersion: number; reason: string },
    ) => execute(requestId, 'reject', input),
    resend: (requestId: string, input: { expectedVersion: number }) =>
      execute(requestId, 'resend-invitation', input),
  };
}
