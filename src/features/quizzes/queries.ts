import { QueryObserver } from '@tanstack/query-core';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';

import { useAppQueryClient } from '@/app/providers';
import { apiRequest } from '@/lib/api-client';

export type QuizQuestionType =
  'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'SINGLE_CHOICE' | 'TRUE_FALSE';

export interface QuizQuestion {
  id: string;
  options: Array<{
    id: string;
    label: string;
    position: number;
  }>;
  position: number;
  prompt: string;
  type: QuizQuestionType;
}

export interface QuizDetail {
  description: string | null;
  id: string;
  isRequired: boolean;
  lessonId: string;
  passingScore: number;
  position: number;
  questionCount: number;
  questions: QuizQuestion[];
  title: string;
}

export interface QuizAttempt {
  answers: unknown;
  id: string;
  passed: boolean;
  score: number;
  submittedAt: string;
}

export interface SubmittedQuizAnswer {
  optionIds: string[];
  questionId: string;
  text?: string;
}

export interface QuizCorrection {
  acceptedAnswers: string[];
  correct: boolean;
  correctOptionIds: string[];
  explanation: string;
  questionId: string;
}

export interface QuizAttemptResponse {
  attempt: QuizAttempt;
  corrections: QuizCorrection[];
}

interface QuizResponse {
  quiz: QuizDetail;
}

interface QuizAttemptsResponse {
  attempts: QuizAttempt[];
  nextCursor: string | null;
}

export function useQuizQuery(quizId: string | null) {
  const queryClient = useAppQueryClient();
  const observer = useMemo(
    () =>
      new QueryObserver<QuizResponse>(queryClient, {
        enabled: Boolean(quizId),
        queryKey: ['quiz', quizId],
        queryFn: () =>
          apiRequest<QuizResponse>(
            `/api/quizzes/${encodeURIComponent(quizId ?? '')}`,
          ),
        staleTime: 0,
      }),
    [queryClient, quizId],
  );
  const [result, setResult] = useState(() => observer.getCurrentResult());

  useEffect(() => {
    setResult(observer.getCurrentResult());
    const unsubscribe = observer.subscribe(setResult);

    if (quizId) void observer.refetch();

    return unsubscribe;
  }, [observer, quizId]);

  return {
    data: result.data,
    error: result.error,
    isPending: Boolean(quizId) && result.isPending,
  };
}

export function useQuizAttemptsQuery(quizId: string | null) {
  const queryClient = useAppQueryClient();
  const observer = useMemo(
    () =>
      new QueryObserver<QuizAttemptsResponse>(queryClient, {
        enabled: Boolean(quizId),
        queryKey: ['quiz-attempts', quizId],
        queryFn: () =>
          apiRequest<QuizAttemptsResponse>(
            `/api/quizzes/${encodeURIComponent(quizId ?? '')}/attempts`,
          ),
        staleTime: 0,
      }),
    [queryClient, quizId],
  );
  const [result, setResult] = useState(() => observer.getCurrentResult());
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    setResult(observer.getCurrentResult());
    const unsubscribe = observer.subscribe(setResult);

    if (quizId) void observer.refetch();

    return unsubscribe;
  }, [observer, quizId]);

  useEffect(() => {
    if (!result.data) return;
    setAttempts(result.data.attempts);
    setNextCursor(result.data.nextCursor);
  }, [result.data]);

  const loadMore = useCallback(async () => {
    if (!quizId || !nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const page = await apiRequest<QuizAttemptsResponse>(
        `/api/quizzes/${encodeURIComponent(quizId)}/attempts?cursor=${encodeURIComponent(nextCursor)}`,
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
  }, [isLoadingMore, nextCursor, quizId]);

  return {
    data: result.data ? { ...result.data, attempts, nextCursor } : undefined,
    error: result.error,
    hasMore: Boolean(nextCursor),
    isPending: Boolean(quizId) && result.isPending,
    isLoadingMore,
    loadMore,
  };
}

export function useQuizAttemptMutation(quizId: string | null) {
  const queryClient = useAppQueryClient();
  const [error, setError] = useState<unknown>();
  const [isPending, setIsPending] = useState(false);
  const submit = useCallback(
    async (answers: SubmittedQuizAnswer[]) => {
      if (!quizId) {
        throw new Error('A quiz identifier is required.');
      }

      setError(undefined);
      setIsPending(true);

      try {
        const response = await apiRequest<QuizAttemptResponse>(
          `/api/quizzes/${encodeURIComponent(quizId)}/attempts`,
          {
            body: JSON.stringify({ answers }),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
          },
        );

        queryClient.setQueryData<QuizAttemptsResponse>(
          ['quiz-attempts', quizId],
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
    [queryClient, quizId],
  );

  return { error, isPending, submit };
}
