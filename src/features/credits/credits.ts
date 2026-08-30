import { useCallback, useRef, useState } from 'react';

import { useAppQueryClient } from '@/app/providers';
import { apiRequest } from '@/lib/api-client';
import { useObservedQuery } from '@/lib/observed-query';
import {
  type BreakerStatus,
  correctionMonitoringResponseSchema,
  correctionPreflightResponseSchema,
  creditMemberResponseSchema,
  creditMembersResponseSchema,
  type CreditMemberDetail,
  creditPoliciesResponseSchema,
  ownCreditsResponseSchema,
} from '@/features/credits/credits-contracts';

/**
 * Réexporté uniquement ce que les pages consomment : les types dérivés des
 * schémas restent l'autorité, mais un type réexporté que personne n'importe
 * est du bruit que knip signale à juste titre.
 */
export type {
  BreakerReason,
  BreakerStatus,
  CreditMemberDetail,
  CreditMemberSummary,
} from '@/features/credits/credits-contracts';

const ownCreditsKey = ['credits', 'own'] as const;
const adminCreditsKey = ['admin', 'credits'] as const;

export function useOwnCreditsQuery() {
  const result = useObservedQuery(
    '/api/credits',
    ownCreditsKey,
    ownCreditsResponseSchema,
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
  const result = useObservedQuery(
    path,
    [...adminCreditsKey, 'members', input.page, input.pageSize, input.search],
    creditMembersResponseSchema,
  );
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
  const result = useObservedQuery(
    path,
    [...adminCreditsKey, 'member', userId],
    creditMemberResponseSchema,
  );
  return {
    data: userId ? result.data?.member : undefined,
    error: userId ? result.error : undefined,
    isPending: userId ? result.isPending : false,
    retry: result.refetch,
  };
}

export function useAdminCreditPoliciesQuery() {
  const result = useObservedQuery(
    '/api/admin/credits/policies',
    [...adminCreditsKey, 'policies'],
    creditPoliciesResponseSchema,
  );
  return {
    data: result.data?.policies,
    error: result.error,
    isPending: result.isPending,
    retry: result.refetch,
  };
}

export function useAdminCorrectionMonitoringQuery() {
  const result = useObservedQuery(
    '/api/admin/ai-corrections/monitoring',
    [...adminCreditsKey, 'correction-monitoring'],
    correctionMonitoringResponseSchema,
  );
  return {
    data: result.data?.monitoring,
    error: result.error,
    isPending: result.isPending,
    retry: result.refetch,
  };
}

export function useAdminCorrectionPreflightQuery() {
  const result = useObservedQuery(
    '/api/admin/ai-corrections/preflight',
    [...adminCreditsKey, 'correction-preflight'],
    correctionPreflightResponseSchema,
  );
  return {
    data: result.data?.preflight,
    error: result.error,
    isPending: result.isPending,
    retry: result.refetch,
  };
}

/**
 * Réouverture du coupe-circuit (V4.5-140). Écrit une ligne de journal côté
 * serveur plutôt que d'effacer un drapeau : la note est facultative, mais elle
 * est le seul endroit où « pourquoi on a rouvert » subsiste.
 */
export function useAdminCorrectionBreakerReopenMutation() {
  const queryClient = useAppQueryClient();
  const [error, setError] = useState<unknown>();
  const [isPending, setIsPending] = useState(false);
  const execute = useCallback(
    async (input: { note?: string }) => {
      setError(undefined);
      setIsPending(true);
      try {
        const response = await apiRequest<{
          resource: { breaker: BreakerStatus };
        }>('/api/admin/ai-corrections/breaker/reopen', {
          body: JSON.stringify(
            input.note && input.note.trim().length > 0
              ? { note: input.note.trim() }
              : {},
          ),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        });
        await queryClient.invalidateQueries({ queryKey: adminCreditsKey });
        return response.resource.breaker;
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
