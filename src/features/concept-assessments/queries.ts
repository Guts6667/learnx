import { QueryObserver } from '@tanstack/query-core';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';

import { useAppQueryClient } from '@/app/providers';
import type {
  AssessmentAttempt,
  AssessmentAttemptResponse,
  AssessmentQuestion,
  SubmittedAssessmentAnswer,
} from '@/features/assessments/QuestionAssessmentExperience';
import { apiRequest } from '@/lib/api-client';

export interface ConceptAssessmentDetail {
  concept: {
    id: string;
    lessonId: string;
    masteryThreshold: number;
    programId: string;
    stageId: string;
    title: string;
  };
  id: string;
  isRequired: boolean;
  position: number;
  questionCount: number;
  questions: AssessmentQuestion[];
  title: string | null;
}

interface ConceptAssessmentResponse {
  assessment: ConceptAssessmentDetail;
}

interface ConceptAssessmentAttemptsResponse {
  attempts: AssessmentAttempt[];
  nextCursor: string | null;
}

function getAssessmentPath(assessmentId: string, preview: boolean): string {
  const basePath = `/api/concept-assessments/${encodeURIComponent(assessmentId)}`;

  return preview ? `${basePath}?preview=true` : basePath;
}

function getAttemptsPath(
  assessmentId: string,
  preview: boolean,
  cursor?: string,
): string {
  const basePath = `/api/concept-assessments/${encodeURIComponent(assessmentId)}/attempts`;
  const parameters = new URLSearchParams();
  if (preview) parameters.set('preview', 'true');
  if (cursor) parameters.set('cursor', cursor);
  const query = parameters.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function useConceptAssessmentQuery(
  assessmentId: string | null,
  preview: boolean,
) {
  const queryClient = useAppQueryClient();
  const observer = useMemo(
    () =>
      new QueryObserver<ConceptAssessmentResponse>(queryClient, {
        enabled: Boolean(assessmentId),
        queryKey: ['concept-assessment', assessmentId, preview],
        queryFn: () =>
          apiRequest<ConceptAssessmentResponse>(
            getAssessmentPath(assessmentId ?? '', preview),
          ),
        staleTime: 0,
      }),
    [assessmentId, preview, queryClient],
  );
  const [result, setResult] = useState(() => observer.getCurrentResult());

  useEffect(() => {
    setResult(observer.getCurrentResult());
    const unsubscribe = observer.subscribe(setResult);

    if (assessmentId) void observer.refetch();

    return unsubscribe;
  }, [assessmentId, observer]);

  return {
    data: result.data,
    error: result.error,
    isPending: Boolean(assessmentId) && result.isPending,
  };
}

export function useConceptAssessmentAttemptsQuery(
  assessmentId: string | null,
  preview: boolean,
) {
  const queryClient = useAppQueryClient();
  const observer = useMemo(
    () =>
      new QueryObserver<ConceptAssessmentAttemptsResponse>(queryClient, {
        enabled: Boolean(assessmentId),
        queryKey: ['concept-assessment-attempts', assessmentId, preview],
        queryFn: () =>
          apiRequest<ConceptAssessmentAttemptsResponse>(
            getAttemptsPath(assessmentId ?? '', preview),
          ),
        staleTime: 0,
      }),
    [assessmentId, preview, queryClient],
  );
  const [result, setResult] = useState(() => observer.getCurrentResult());
  const [attempts, setAttempts] = useState<AssessmentAttempt[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    setResult(observer.getCurrentResult());
    const unsubscribe = observer.subscribe(setResult);

    if (assessmentId) void observer.refetch();

    return unsubscribe;
  }, [assessmentId, observer]);

  useEffect(() => {
    if (!result.data) return;
    setAttempts(result.data.attempts);
    setNextCursor(result.data.nextCursor);
  }, [result.data]);

  const loadMore = useCallback(async () => {
    if (!assessmentId || !nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const page = await apiRequest<ConceptAssessmentAttemptsResponse>(
        getAttemptsPath(assessmentId, preview, nextCursor),
      );
      setAttempts((current) => [
        ...current,
        ...page.attempts.filter(
          (attempt) => !current.some((existing) => existing.id === attempt.id),
        ),
      ]);
      setNextCursor(page.nextCursor);
    } finally {
      setIsLoadingMore(false);
    }
  }, [assessmentId, isLoadingMore, nextCursor, preview]);

  return {
    data: result.data ? { ...result.data, attempts, nextCursor } : undefined,
    error: result.error,
    hasMore: Boolean(nextCursor),
    isPending: Boolean(assessmentId) && result.isPending,
    isLoadingMore,
    loadMore,
  };
}

export function useConceptAssessmentAttemptMutation(
  assessmentId: string | null,
  preview: boolean,
) {
  const queryClient = useAppQueryClient();
  const [error, setError] = useState<unknown>();
  const [isPending, setIsPending] = useState(false);
  const submit = useCallback(
    async (answers: SubmittedAssessmentAnswer[]) => {
      if (!assessmentId) {
        throw new Error('An assessment identifier is required.');
      }

      setError(undefined);
      setIsPending(true);

      try {
        const response = await apiRequest<AssessmentAttemptResponse>(
          getAttemptsPath(assessmentId, preview),
          {
            body: JSON.stringify({ answers }),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
          },
        );

        queryClient.setQueryData<ConceptAssessmentAttemptsResponse>(
          ['concept-assessment-attempts', assessmentId, preview],
          (current) => ({
            attempts: [response.attempt, ...(current?.attempts ?? [])],
            nextCursor: current?.nextCursor ?? null,
          }),
        );
        return response;
      } catch (requestError) {
        setError(requestError);
        throw requestError;
      } finally {
        setIsPending(false);
      }
    },
    [assessmentId, preview, queryClient],
  );

  return { error, isPending, submit };
}
