import { useCallback, useState } from 'react';

import { useAppQueryClient } from '@/app/providers';
import {
  replacePrivateSessionCache,
  type SessionResponse,
} from '@/features/auth/session';
import { apiRequest } from '@/lib/api-client';

interface ActivationInput {
  displayName: string;
  password: string;
  token: string;
}

export function useAccessInvitationActivationMutation() {
  const queryClient = useAppQueryClient();
  const [error, setError] = useState<unknown>();
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = useCallback(
    async (input: ActivationInput) => {
      setError(undefined);
      setIsPending(true);
      try {
        const session = await apiRequest<SessionResponse>(
          '/api/access-invitations/activate',
          {
            body: JSON.stringify(input),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
          },
        );
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
