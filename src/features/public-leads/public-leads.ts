import { useCallback, useState } from 'react';

import type { UiLocale } from '@/i18n';
import { apiRequest } from '@/lib/api-client';

export type PublicLeadPurpose = 'LAUNCH_UPDATES' | 'EARLY_ADOPTER';
type PublicLeadAction = 'confirm' | 'unsubscribe' | 'delete';

export function usePublicLeadMutation() {
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<unknown>();

  const mutateAsync = useCallback(
    async (input: {
      consent: true;
      email: string;
      locale: UiLocale;
      motivation?: string;
      purpose: PublicLeadPurpose;
    }) => {
      setIsPending(true);
      setError(undefined);
      try {
        await apiRequest('/api/public-leads', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        });
        setIsSuccess(true);
      } catch (requestError) {
        setError(requestError);
        throw requestError;
      } finally {
        setIsPending(false);
      }
    },
    [],
  );

  return { error, isPending, isSuccess, mutateAsync };
}

export async function applyPublicLeadAction(
  action: PublicLeadAction,
  token: string,
) {
  return apiRequest<{ status: string }>(`/api/public-leads/${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}
