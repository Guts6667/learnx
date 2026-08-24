import { QueryObserver } from '@tanstack/query-core';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';

import { useAppQueryClient } from '@/app/providers';
import { apiRequest } from '@/lib/api-client';

export interface CreditProjectionPart {
  available: string;
  consumed: string;
  expired: string;
  reserved: string;
}

export interface CreditProjection {
  free: CreditProjectionPart;
  purchased: CreditProjectionPart;
  totalAvailable: string;
  totalReserved: string;
}

export interface CreditMemberSummary {
  accountStatus: 'ACTIVE' | 'SUSPENDED';
  displayName: string;
  email: string;
  projection: CreditProjection;
  userId: string;
}

export interface CreditHistoryItem {
  actorUserId: string | null;
  amount: string;
  createdAt: string;
  entryId: string;
  provenance: 'FREE_ALLOCATION' | 'PURCHASED';
  reason: string | null;
  referenceId: string;
  referenceType: string;
  type: string;
}

export interface CreditMemberDetail extends CreditMemberSummary {
  history: CreditHistoryItem[];
  pendingIncreaseRequest: {
    createdAt: string;
    id: string;
    reason: string;
  } | null;
}

export interface CreditMemberPage {
  items: CreditMemberSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CreditPolicySummary {
  id: string;
  key: string;
  status: 'ACTIVE' | 'DRAFT' | 'INACTIVE' | 'RETIRED';
  version: string;
}

const ownCreditsKey = ['credits', 'own'] as const;
const adminCreditsKey = ['admin', 'credits'] as const;

function useObservedQuery<T>(path: string, queryKey: readonly unknown[]) {
  const queryClient = useAppQueryClient();
  const queryKeySignature = JSON.stringify(queryKey);
  const stableQueryKey = useMemo<readonly unknown[]>(
    () => JSON.parse(queryKeySignature) as readonly unknown[],
    [queryKeySignature],
  );
  const observer = useMemo(
    () =>
      new QueryObserver<T>(queryClient, {
        queryFn: () => apiRequest<T>(path),
        queryKey: stableQueryKey,
        staleTime: 10_000,
      }),
    [path, queryClient, stableQueryKey],
  );
  const [result, setResult] = useState(() => observer.getCurrentResult());
  useEffect(() => {
    setResult(observer.getCurrentResult());
    const unsubscribe = observer.subscribe(setResult);
    void observer.refetch();
    return unsubscribe;
  }, [observer]);
  return result;
}

export function useOwnCreditsQuery() {
  const result = useObservedQuery<{ credits: CreditMemberDetail }>(
    '/api/credits',
    ownCreditsKey,
  );
  return {
    data: result.data?.credits,
    error: result.error,
    isPending: result.isPending,
  };
}

export function useCreditIncreaseRequestMutation() {
  const queryClient = useAppQueryClient();
  const [error, setError] = useState<unknown>();
  const [isPending, setIsPending] = useState(false);
  const execute = useCallback(
    async (reason: string) => {
      setError(undefined);
      setIsPending(true);
      try {
        const response = await apiRequest<{ request: { id: string } }>(
          '/api/credits/increase-requests',
          {
            body: JSON.stringify({
              idempotencyKey: `increase:${crypto.randomUUID()}`,
              reason,
            }),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
          },
        );
        await queryClient.invalidateQueries({ queryKey: ownCreditsKey });
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
  return { error, execute, isPending };
}

export function useAdminCreditMembersQuery(input: {
  page: number;
  pageSize: number;
  search: string;
}) {
  const parameters = new URLSearchParams({
    page: String(input.page),
    pageSize: String(input.pageSize),
  });
  if (input.search) parameters.set('search', input.search);
  const path = `/api/admin/credits/members?${parameters.toString()}`;
  const result = useObservedQuery<{ page: CreditMemberPage }>(path, [
    ...adminCreditsKey,
    'members',
    input.page,
    input.pageSize,
    input.search,
  ]);
  return {
    data: result.data?.page,
    error: result.error,
    isPending: result.isPending,
  };
}

export function useAdminCreditMemberQuery(userId: string | undefined) {
  const path = userId
    ? `/api/admin/credits/members/${encodeURIComponent(userId)}`
    : '/api/admin/credits/members/00000000-0000-0000-0000-000000000000';
  const result = useObservedQuery<{ member: CreditMemberDetail }>(path, [
    ...adminCreditsKey,
    'member',
    userId,
  ]);
  return {
    data: userId ? result.data?.member : undefined,
    error: userId ? result.error : undefined,
    isPending: userId ? result.isPending : false,
  };
}

export function useAdminCreditPoliciesQuery() {
  const result = useObservedQuery<{
    policies: {
      allocation: CreditPolicySummary[];
      limits: CreditPolicySummary[];
    };
  }>('/api/admin/credits/policies', [...adminCreditsKey, 'policies']);
  return {
    data: result.data?.policies,
    error: result.error,
    isPending: result.isPending,
  };
}

export function useAdminCreditAdjustmentMutation() {
  const queryClient = useAppQueryClient();
  const [error, setError] = useState<unknown>();
  const [isPending, setIsPending] = useState(false);
  const execute = useCallback(
    async (
      userId: string,
      input: {
        amount: string;
        compensatesEntryId?: string;
        expiresAt?: string;
        reason: string;
      },
    ) => {
      setError(undefined);
      setIsPending(true);
      try {
        const response = await apiRequest<{ member: CreditMemberDetail }>(
          `/api/admin/credits/members/${encodeURIComponent(userId)}/adjustments`,
          {
            body: JSON.stringify({
              ...input,
              idempotencyKey: `adjustment:${crypto.randomUUID()}`,
            }),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
          },
        );
        await queryClient.invalidateQueries({ queryKey: adminCreditsKey });
        return response.member;
      } catch (requestError) {
        setError(requestError);
        throw requestError;
      } finally {
        setIsPending(false);
      }
    },
    [queryClient],
  );
  return { error, execute, isPending };
}
