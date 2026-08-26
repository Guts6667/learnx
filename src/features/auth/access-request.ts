import { useCallback, useState } from 'react';

import { apiRequest } from '@/lib/api-client';
import type { UiLocale } from '@/i18n';

interface AccessRequestResponse {
  message: string;
}

interface EmailVerificationResponse {
  message: string;
  status: 'verified';
}

export function useAccessRequestMutation() {
  const [data, setData] = useState<AccessRequestResponse>();
  const [error, setError] = useState<unknown>();
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = useCallback(async (email: string, locale: UiLocale) => {
    setIsPending(true);
    setError(undefined);

    try {
      const response = await apiRequest<AccessRequestResponse>(
        '/api/access-requests',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, locale }),
        },
      );
      setData(response);
      return response;
    } catch (requestError) {
      setError(requestError);
      throw requestError;
    } finally {
      setIsPending(false);
    }
  }, []);

  return { data, error, isPending, mutateAsync };
}

export function useEmailVerificationMutation() {
  const [data, setData] = useState<EmailVerificationResponse>();
  const [error, setError] = useState<unknown>();
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = useCallback(async (token: string) => {
    setIsPending(true);
    setError(undefined);

    try {
      const response = await apiRequest<EmailVerificationResponse>(
        '/api/access-requests/verify-email',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token }),
        },
      );
      setData(response);
      return response;
    } catch (requestError) {
      setError(requestError);
      throw requestError;
    } finally {
      setIsPending(false);
    }
  }, []);

  return { data, error, isPending, mutateAsync };
}
