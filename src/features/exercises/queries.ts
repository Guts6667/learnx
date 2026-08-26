import { QueryObserver } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAppQueryClient } from '@/app/providers';
import { apiRequest } from '@/lib/api-client';

export type ExerciseSubmissionStatus = 'DRAFT' | 'SUBMITTED';

export interface ExerciseSubmission {
  contentMarkdown: string;
  createdAt: string;
  exerciseId: string;
  id: string;
  status: ExerciseSubmissionStatus;
  submittedAt: string | null;
  updatedAt: string;
  userId: string;
}

export interface ExerciseDetail {
  aiCorrectionEligible: boolean;
  id: string;
  instructions: string;
  isRequired: boolean;
  lessonId: string;
  position: number;
  rubric: unknown;
  submission: ExerciseSubmission | null;
  title: string;
}

interface ExerciseResponse {
  exercise: ExerciseDetail;
}

interface SubmissionResponse {
  submission: ExerciseSubmission;
}

export function useExerciseQuery(exerciseId: string) {
  const queryClient = useAppQueryClient();
  const observer = useMemo(
    () =>
      new QueryObserver<ExerciseResponse>(queryClient, {
        queryKey: ['exercise', exerciseId],
        queryFn: () =>
          apiRequest<ExerciseResponse>(
            `/api/exercises/${encodeURIComponent(exerciseId)}`,
          ),
        staleTime: 0,
      }),
    [exerciseId, queryClient],
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

export function useExerciseMutation(exerciseId: string) {
  const queryClient = useAppQueryClient();
  const [error, setError] = useState<unknown>();
  const [isPending, setIsPending] = useState(false);
  const updateSubmission = useCallback(
    (submission: ExerciseSubmission) => {
      queryClient.setQueryData<ExerciseResponse>(
        ['exercise', exerciseId],
        (current) =>
          current
            ? {
                exercise: { ...current.exercise, submission },
              }
            : current,
      );
    },
    [exerciseId, queryClient],
  );
  const execute = useCallback(
    async (request: () => Promise<SubmissionResponse>) => {
      setError(undefined);
      setIsPending(true);

      try {
        const response = await request();
        updateSubmission(response.submission);
        return response.submission;
      } catch (requestError) {
        setError(requestError);
        throw requestError;
      } finally {
        setIsPending(false);
      }
    },
    [updateSubmission],
  );
  const createDraft = useCallback(
    () =>
      execute(() =>
        apiRequest<SubmissionResponse>(
          `/api/exercises/${encodeURIComponent(exerciseId)}/submissions`,
          { method: 'POST' },
        ),
      ),
    [execute, exerciseId],
  );
  const save = useCallback(
    (submissionId: string, contentMarkdown: string) =>
      execute(() =>
        apiRequest<SubmissionResponse>(
          `/api/exercise-submissions/${encodeURIComponent(submissionId)}`,
          {
            body: JSON.stringify({ contentMarkdown }),
            headers: { 'content-type': 'application/json' },
            method: 'PATCH',
          },
        ),
      ),
    [execute],
  );
  const submit = useCallback(
    (submissionId: string) =>
      execute(() =>
        apiRequest<SubmissionResponse>(
          `/api/exercise-submissions/${encodeURIComponent(submissionId)}/submit`,
          { method: 'POST' },
        ),
      ),
    [execute],
  );

  return { createDraft, error, isPending, save, submit };
}
