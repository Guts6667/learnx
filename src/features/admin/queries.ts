import { QueryObserver } from '@tanstack/query-core';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';

import { useAppQueryClient } from '@/app/providers';
import { apiRequest } from '@/lib/api-client';

export interface AdminLesson {
  id: string;
  isPublished: boolean;
  position: number;
  slug: string;
  summary: string;
  title: string;
}

export interface AdminModule {
  description: string;
  id: string;
  isPublished: boolean;
  lessons: AdminLesson[];
  position: number;
  slug: string;
  title: string;
}

export interface AdminStage {
  id: string;
  isPublished: boolean;
  modules: AdminModule[];
  position: number;
  slug: string;
  title: string;
}

interface AdminProgram {
  id: string;
  slug: string;
  stages: AdminStage[];
  title: string;
}

interface AdminCurriculumResponse {
  programs: AdminProgram[];
}

interface AdminModuleResponse {
  module: AdminModule;
}

interface AdminLessonResponse {
  lesson: AdminLesson;
}

interface AdminStageResponse {
  stage: Pick<AdminStage, 'id' | 'isPublished'>;
}

const adminCurriculumKey = ['admin', 'curriculum'] as const;

export function useAdminCurriculumQuery(enabled: boolean) {
  const queryClient = useAppQueryClient();
  const observer = useMemo(
    () =>
      new QueryObserver<AdminCurriculumResponse>(queryClient, {
        enabled,
        queryFn: () =>
          apiRequest<AdminCurriculumResponse>('/api/admin/curriculum'),
        queryKey: adminCurriculumKey,
        staleTime: 0,
      }),
    [enabled, queryClient],
  );
  const [result, setResult] = useState(() => observer.getCurrentResult());

  useEffect(() => {
    setResult(observer.getCurrentResult());
    const unsubscribe = observer.subscribe(setResult);

    if (enabled) void observer.refetch();

    return unsubscribe;
  }, [enabled, observer]);

  return {
    data: result.data,
    error: result.error,
    isPending: enabled && result.isPending,
  };
}

export function useAdminCurriculumMutation() {
  const queryClient = useAppQueryClient();
  const [error, setError] = useState<unknown>();
  const [isPending, setIsPending] = useState(false);
  const execute = useCallback(
    async <T>(request: () => Promise<T>): Promise<T> => {
      setError(undefined);
      setIsPending(true);

      try {
        const response = await request();
        await queryClient.invalidateQueries({ queryKey: adminCurriculumKey });
        return response;
      } catch (requestError) {
        setError(requestError);
        throw requestError;
      } finally {
        setIsPending(false);
      }
    },
    [queryClient],
  );
  const updateModule = useCallback(
    (
      moduleId: string,
      input: Partial<
        Pick<AdminModule, 'description' | 'isPublished' | 'position' | 'title'>
      >,
    ) =>
      execute(() =>
        apiRequest<AdminModuleResponse>(
          `/api/admin/modules/${encodeURIComponent(moduleId)}`,
          {
            body: JSON.stringify(input),
            headers: { 'content-type': 'application/json' },
            method: 'PATCH',
          },
        ),
      ),
    [execute],
  );
  const updateLesson = useCallback(
    (
      lessonId: string,
      input: Partial<
        Pick<AdminLesson, 'isPublished' | 'position' | 'summary' | 'title'>
      >,
    ) =>
      execute(() =>
        apiRequest<AdminLessonResponse>(
          `/api/admin/lessons/${encodeURIComponent(lessonId)}`,
          {
            body: JSON.stringify(input),
            headers: { 'content-type': 'application/json' },
            method: 'PATCH',
          },
        ),
      ),
    [execute],
  );
  const updateStage = useCallback(
    (stageId: string, isPublished: boolean) =>
      execute(() =>
        apiRequest<AdminStageResponse>(
          `/api/admin/stages/${encodeURIComponent(stageId)}`,
          {
            body: JSON.stringify({ isPublished }),
            headers: { 'content-type': 'application/json' },
            method: 'PATCH',
          },
        ),
      ),
    [execute],
  );

  return { error, isPending, updateLesson, updateModule, updateStage };
}
