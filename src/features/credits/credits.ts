import { useQuery } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

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

export interface CorrectionMonitoringSummary {
  completed: number;
  hardConstraintLevelMismatchSuspected: number;
  partial: number;
  scoreGuardTriggered: number;
  totalCorrections: number;
  totalProviderCostUsd: string;
  unavailable: number;
  unknownCostAttempts: number;
}

export interface CorrectionReleasePreflight {
  apiKeyPresent: boolean;
  deploymentEnvironment: 'development' | 'preview' | 'production';
  identityMatches: boolean;
  killSwitch: boolean;
  promotedBenchmarkId: string;
  state: 'CONFIGURATION_BLOCKED' | 'CONFIGURED_CLOSED' | 'DISABLED' | 'READY';
}

const ownCreditsKey = ['credits', 'own'] as const;
const adminCreditsKey = ['admin', 'credits'] as const;

function useObservedQuery<T>(path: string, queryKey: readonly unknown[]) {
  return useQuery({
    queryFn: () => apiRequest<T>(path),
    queryKey,
    staleTime: 10_000,
  });
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
    refetch: result.refetch,
  };
}

export function useCreditIncreaseRequestMutation() {
  const queryClient = useAppQueryClient();
  const [error, setError] = useState<unknown>();
  const [isPending, setIsPending] = useState(false);
  const pendingAttempt = useRef<{
    idempotencyKey: string;
    reason: string;
  } | null>(null);
  const abandon = useCallback(() => {
    pendingAttempt.current = null;
    setError(undefined);
  }, []);
  const execute = useCallback(
    async (reason: string) => {
      setError(undefined);
      setIsPending(true);
      const attempt =
        pendingAttempt.current?.reason === reason
          ? pendingAttempt.current
          : {
              idempotencyKey: `increase:${crypto.randomUUID()}`,
              reason,
            };
      pendingAttempt.current = attempt;
      try {
        const response = await apiRequest<{ request: { id: string } }>(
          '/api/credits/increase-requests',
          {
            body: JSON.stringify({
              idempotencyKey: attempt.idempotencyKey,
              reason,
            }),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
          },
        );
        await queryClient.invalidateQueries({ queryKey: ownCreditsKey });
        pendingAttempt.current = null;
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
  return { abandon, error, execute, isPending };
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
    retry: result.refetch,
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
    retry: result.refetch,
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
    retry: result.refetch,
  };
}

export function useAdminCorrectionMonitoringQuery() {
  const result = useObservedQuery<{ monitoring: CorrectionMonitoringSummary }>(
    '/api/admin/ai-corrections/monitoring',
    [...adminCreditsKey, 'correction-monitoring'],
  );
  return {
    data: result.data?.monitoring,
    error: result.error,
    isPending: result.isPending,
    retry: result.refetch,
  };
}

export function useAdminCorrectionPreflightQuery() {
  const result = useObservedQuery<{ preflight: CorrectionReleasePreflight }>(
    '/api/admin/ai-corrections/preflight',
    [...adminCreditsKey, 'correction-preflight'],
  );
  return {
    data: result.data?.preflight,
    error: result.error,
    isPending: result.isPending,
    retry: result.refetch,
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
