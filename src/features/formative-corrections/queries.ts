import { QueryObserver } from '@tanstack/query-core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';

import { useAppQueryClient } from '@/app/providers';
import type {
  FormativeCorrectionHistory,
  PublicFormativeCorrection,
} from '@/server/formative-correction/fake-flow';
import { apiRequest } from '@/lib/api-client';

interface HistoryResponse {
  flow: FormativeCorrectionHistory;
}

interface CorrectionResponse {
  correction: PublicFormativeCorrection;
}

function correctionPath(submissionId: string): string {
  return `/api/exercise-submissions/${encodeURIComponent(submissionId)}/formative-corrections`;
}

function updateHistory(
  current: HistoryResponse | undefined,
  correction: PublicFormativeCorrection,
): HistoryResponse | undefined {
  if (!current) return current;
  const corrections = current.flow.corrections.filter(
    (candidate) => candidate.id !== correction.id,
  );
  corrections.push(correction);
  corrections.sort((left, right) => left.version - right.version);
  return { flow: { ...current.flow, corrections } };
}

export function useFormativeCorrectionHistory(submissionId: string | null) {
  const queryClient = useAppQueryClient();
  const observer = useMemo(
    () =>
      new QueryObserver<HistoryResponse>(queryClient, {
        enabled: Boolean(submissionId),
        queryFn: () =>
          apiRequest<HistoryResponse>(correctionPath(submissionId ?? '')),
        queryKey: ['formative-corrections', submissionId],
        staleTime: 0,
      }),
    [queryClient, submissionId],
  );
  const [result, setResult] = useState(() => observer.getCurrentResult());

  useEffect(() => {
    setResult(observer.getCurrentResult());
    const unsubscribe = observer.subscribe(setResult);
    if (submissionId) void observer.refetch();
    return unsubscribe;
  }, [observer, submissionId]);

  return {
    data: result.data,
    error: result.error,
    isPending: Boolean(submissionId) && result.isPending,
    refetch: () => observer.refetch(),
  };
}

export function useFormativeCorrectionMutation(submissionId: string) {
  const queryClient = useAppQueryClient();
  const [error, setError] = useState<unknown>();
  const [isPending, setIsPending] = useState(false);
  const pendingRef = useRef(false);

  const execute = useCallback(
    async (request: () => Promise<CorrectionResponse>) => {
      if (pendingRef.current) return null;
      pendingRef.current = true;
      setError(undefined);
      setIsPending(true);
      try {
        const response = await request();
        queryClient.setQueryData<HistoryResponse>(
          ['formative-corrections', submissionId],
          (current) => updateHistory(current, response.correction),
        );
        return response.correction;
      } catch (requestError) {
        setError(requestError);
        throw requestError;
      } finally {
        pendingRef.current = false;
        setIsPending(false);
      }
    },
    [queryClient, submissionId],
  );

  const request = useCallback(
    (responseText: string) =>
      execute(() =>
        apiRequest<CorrectionResponse>(correctionPath(submissionId), {
          body: JSON.stringify({
            idempotencyKey: `v4-010:${submissionId}:${crypto.randomUUID()}`,
            responseText,
          }),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        }),
      ),
    [execute, submissionId],
  );

  const retry = useCallback(
    (correctionId: string) =>
      execute(() =>
        apiRequest<CorrectionResponse>(
          `/api/formative-corrections/${encodeURIComponent(correctionId)}/retry`,
          { method: 'POST' },
        ),
      ),
    [execute],
  );

  return { error, isPending, request, retry };
}
