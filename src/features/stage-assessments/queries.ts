import { QueryObserver } from '@tanstack/query-core';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';

import { useAppQueryClient } from '@/app/providers';
import { apiRequest } from '@/lib/api-client';

export type StageAssessmentStatus =
  'DRAFT' | 'NEEDS_REVISION' | 'SUBMITTED' | 'VALIDATED';

export interface StageAssessmentSubmission {
  attachmentUrl: string | null;
  contentMarkdown: string | null;
  id: string;
  reviewFeedback: string | null;
  reviewedAt: string | null;
  score: number | null;
  status: StageAssessmentStatus;
  submittedAt: string | null;
  updatedAt: string;
}

export interface StageAssessmentDetail {
  description: string | null;
  id: string;
  instructions: string | null;
  isRequired: boolean;
  passingScore: number | null;
  position: number;
  rubric: unknown;
  stageId: string;
  submission: StageAssessmentSubmission | null;
  title: string;
  type: string;
}

interface AssessmentResponse {
  assessment: StageAssessmentDetail;
}

interface SubmissionResponse {
  submission: StageAssessmentSubmission;
}

export function useStageAssessmentQuery(stageId: string) {
  const queryClient = useAppQueryClient();
  const observer = useMemo(
    () =>
      new QueryObserver(queryClient, {
        queryKey: ['stage-assessment', stageId, 'preview'],
        queryFn: () =>
          apiRequest<AssessmentResponse>(
            `/api/stages/${encodeURIComponent(stageId)}/assessment?preview=true`,
          ),
        staleTime: 0,
      }),
    [queryClient, stageId],
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

export function useStageAssessmentMutation(assessment: StageAssessmentDetail) {
  const queryClient = useAppQueryClient();
  const [error, setError] = useState<unknown>();
  const [isPending, setIsPending] = useState(false);
  const updateCachedSubmission = useCallback(
    (submission: StageAssessmentSubmission) => {
      queryClient.setQueryData<AssessmentResponse>(
        ['stage-assessment', assessment.stageId, 'preview'],
        (current) =>
          current
            ? {
                assessment: { ...current.assessment, submission },
              }
            : current,
      );
    },
    [assessment.stageId, queryClient],
  );
  const execute = useCallback(
    async (request: () => Promise<SubmissionResponse>) => {
      setError(undefined);
      setIsPending(true);
      try {
        const response = await request();
        updateCachedSubmission(response.submission);
        return response.submission;
      } catch (requestError) {
        setError(requestError);
        throw requestError;
      } finally {
        setIsPending(false);
      }
    },
    [updateCachedSubmission],
  );

  const createDraft = useCallback(
    () =>
      execute(() =>
        apiRequest<SubmissionResponse>(
          `/api/stage-assessments/${encodeURIComponent(assessment.id)}/submissions`,
          { method: 'POST' },
        ),
      ),
    [assessment.id, execute],
  );
  const save = useCallback(
    (
      submissionId: string,
      input: { attachmentUrl: string | null; contentMarkdown: string | null },
    ) =>
      execute(() =>
        apiRequest<SubmissionResponse>(
          `/api/stage-assessment-submissions/${encodeURIComponent(submissionId)}`,
          {
            body: JSON.stringify({ action: 'save', ...input }),
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
          `/api/stage-assessment-submissions/${encodeURIComponent(submissionId)}/submit`,
          { method: 'POST' },
        ),
      ),
    [execute],
  );

  return { createDraft, error, isPending, save, submit };
}
