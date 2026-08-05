import { QueryObserver } from '@tanstack/query-core';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';

import { useAppQueryClient } from '@/app/providers';
import { apiRequest } from '@/lib/api-client';

export type AccountStatus = 'ACTIVE' | 'SUSPENDED';
export type AccountRole = 'ADMIN' | 'CREATOR' | 'USER';
export type AssignableAccountRole = Exclude<AccountRole, 'ADMIN'>;

export interface AdminAccount {
  accountStatus: AccountStatus;
  createdAt: string;
  displayName: string;
  email: string;
  id: string;
  role: AccountRole;
  suspendedAt: string | null;
  updatedAt: string;
}

export interface AdminAccountPage {
  items: AdminAccount[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AccountFilters {
  page: number;
  pageSize: number;
  search: string;
  status?: AccountStatus;
}

const accountsKey = ['admin', 'accounts'] as const;

export function useAdminAccountsQuery(filters: AccountFilters) {
  const queryClient = useAppQueryClient();
  const searchParams = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  });
  if (filters.search) searchParams.set('search', filters.search);
  if (filters.status) searchParams.set('status', filters.status);
  const path = `/api/admin/accounts?${searchParams.toString()}`;
  const observer = useMemo(
    () =>
      new QueryObserver<AdminAccountPage>(queryClient, {
        queryFn: () =>
          apiRequest<{ page: AdminAccountPage }>(path).then(
            (response) => response.page,
          ),
        queryKey: [...accountsKey, filters] as const,
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
  };
}

export function useAdminAccountStatusMutation() {
  const queryClient = useAppQueryClient();
  const [error, setError] = useState<unknown>();
  const [isPending, setIsPending] = useState(false);

  const execute = useCallback(
    async (account: AdminAccount, action: 'reactivate' | 'suspend') => {
      setError(undefined);
      setIsPending(true);
      try {
        const response = await apiRequest<{ account: AdminAccount }>(
          `/api/admin/accounts/${encodeURIComponent(account.id)}/${action}`,
          {
            body: JSON.stringify({
              expectedStatus: account.accountStatus,
              expectedUpdatedAt: account.updatedAt,
            }),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
          },
        );
        await queryClient.invalidateQueries({ queryKey: accountsKey });
        return response.account;
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

export function useAdminAccountRoleMutation() {
  const queryClient = useAppQueryClient();
  const [error, setError] = useState<unknown>();
  const [isPending, setIsPending] = useState(false);

  const execute = useCallback(
    async (account: AdminAccount, role: AssignableAccountRole) => {
      setError(undefined);
      setIsPending(true);
      try {
        const response = await apiRequest<{ account: AdminAccount }>(
          `/api/admin/accounts/${encodeURIComponent(account.id)}/role`,
          {
            body: JSON.stringify({
              expectedRole: account.role,
              expectedUpdatedAt: account.updatedAt,
              role,
            }),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
          },
        );
        await queryClient.invalidateQueries({ queryKey: accountsKey });
        return response.account;
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
