import { QueryObserver, type QueryClient } from '@tanstack/query-core';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';

import { useAppQueryClient } from '@/app/providers';
import { apiRequest } from '@/lib/api-client';
import { purgePrivateBrowserStorage } from '@/lib/private-browser-storage';
import type { UiLocale } from '@/i18n';

export interface SessionUser {
  displayName: string;
  email: string;
  id: string;
  locale: UiLocale;
  role: 'USER' | 'CREATOR' | 'ADMIN';
}

export interface SessionResponse {
  user: SessionUser | null;
}

interface LoginInput {
  email: string;
  password: string;
}

const sessionQueryKey = ['session'] as const;

export function replacePrivateSessionCache(
  queryClient: QueryClient,
  session: SessionResponse,
): void {
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== sessionQueryKey[0],
  });
  purgePrivateBrowserStorage();
  queryClient.setQueryData(sessionQueryKey, session);
}

export function getSession(): Promise<SessionResponse> {
  return apiRequest<SessionResponse>('/api/auth/session');
}

export function useSessionQuery() {
  const queryClient = useAppQueryClient();
  const observer = useMemo(
    () =>
      new QueryObserver(queryClient, {
        queryKey: sessionQueryKey,
        queryFn: getSession,
        networkMode: 'always',
        staleTime: 0,
      }),
    [queryClient],
  );
  const [result, setResult] = useState(() => observer.getCurrentResult());

  useEffect(() => {
    const unsubscribe = observer.subscribe(setResult);

    void observer.refetch();

    return unsubscribe;
  }, [observer]);

  const refetch = useCallback(() => observer.refetch(), [observer]);

  return {
    data: result.data,
    error: result.error,
    isFetching: result.isFetching,
    isPending: result.isPending,
    refetch,
  };
}

export function useLoginMutation() {
  const queryClient = useAppQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<unknown>();

  const mutateAsync = useCallback(
    async (input: LoginInput) => {
      setIsPending(true);
      setError(undefined);

      try {
        const session = await apiRequest<SessionResponse>('/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        });

        replacePrivateSessionCache(queryClient, session);
        return session;
      } catch (requestError) {
        setError(requestError);
        throw requestError;
      } finally {
        setIsPending(false);
      }
    },
    [queryClient],
  );

  return { error, isPending, mutateAsync };
}

export function useLogoutMutation() {
  const queryClient = useAppQueryClient();
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = useCallback(async () => {
    setIsPending(true);

    try {
      await apiRequest<undefined>('/api/auth/logout', { method: 'POST' });
      replacePrivateSessionCache(queryClient, {
        user: null,
      });
    } finally {
      setIsPending(false);
    }
  }, [queryClient]);

  return { isPending, mutateAsync };
}

export function useLocaleMutation() {
  const queryClient = useAppQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<unknown>();

  const mutateAsync = useCallback(
    async (locale: UiLocale) => {
      setIsPending(true);
      setError(undefined);
      try {
        await queryClient.cancelQueries({ queryKey: sessionQueryKey });
        const session = await apiRequest<SessionResponse>('/api/auth/locale', {
          body: JSON.stringify({ locale }),
          headers: { 'content-type': 'application/json' },
          method: 'PATCH',
        });
        queryClient.setQueryData(sessionQueryKey, session);
        return session;
      } catch (requestError) {
        setError(requestError);
        throw requestError;
      } finally {
        setIsPending(false);
      }
    },
    [queryClient],
  );

  return { error, isPending, mutateAsync };
}
