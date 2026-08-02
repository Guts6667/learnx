import { QueryObserver } from '@tanstack/query-core';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';

import { useAppQueryClient } from '@/app/providers';
import { apiRequest } from '@/lib/api-client';

export interface SessionUser {
  displayName: string;
  email: string;
  id: string;
  role: 'USER' | 'ADMIN';
}

export interface SessionResponse {
  user: SessionUser | null;
}

interface LoginInput {
  email: string;
  password: string;
}

const sessionQueryKey = ['session'] as const;

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

  return {
    data: result.data,
    isPending: result.isPending,
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

export function useLogoutMutation() {
  const queryClient = useAppQueryClient();
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = useCallback(async () => {
    setIsPending(true);

    try {
      await apiRequest<undefined>('/api/auth/logout', { method: 'POST' });
      queryClient.setQueryData<SessionResponse>(sessionQueryKey, {
        user: null,
      });
    } finally {
      setIsPending(false);
    }
  }, [queryClient]);

  return { isPending, mutateAsync };
}
