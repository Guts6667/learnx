import { useCallback, useState } from 'preact/hooks';

import { apiRequest } from '@/lib/api-client';

interface AccessRequestResponse {
  message: string;
}

export function useAccessRequestMutation() {
  const [data, setData] = useState<AccessRequestResponse>();
  const [error, setError] = useState<unknown>();
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = useCallback(async (email: string) => {
    setIsPending(true);
    setError(undefined);

    try {
      const response = await apiRequest<AccessRequestResponse>(
        '/api/access-requests',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email }),
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
