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
}

function getAssessmentPath(assessmentId: string, preview: boolean): string {
  const basePath = `/api/concept-assessments/${encodeURIComponent(assessmentId)}`;

  return preview ? `${basePath}?preview=true` : basePath;
}

function getAttemptsPath(assessmentId: string, preview: boolean): string {
  const basePath = `/api/concept-assessments/${encodeURIComponent(assessmentId)}/attempts`;

  return preview ? `${basePath}?preview=true` : basePath;
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
