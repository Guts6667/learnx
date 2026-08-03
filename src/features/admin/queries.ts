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

export interface AdminProgram {
  id: string;
  slug: string;
  stages: AdminStage[];
  status: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
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

export type PublicationAction = 'PUBLISH' | 'UNPUBLISH';
export type PublicationMode = 'FULL' | 'PARENT_ONLY';
export type PublicationTargetType = 'MODULE' | 'PROGRAM' | 'STAGE';

export interface PublicationPlan {
  action: PublicationAction;
  blockers: Array<{
    code: string;
    id: string;
    message: string;
    title: string;
    type: PublicationTargetType | 'LESSON';
  }>;
  changes: Array<{
    from: 'ACTIVE' | 'ARCHIVED' | 'DRAFT' | boolean;
    id: string;
    title: string;
    to: 'ACTIVE' | 'DRAFT' | boolean;
    type: PublicationTargetType | 'LESSON';
  }>;
  mode: PublicationMode;
  planId: string;
  target: { id: string; title: string; type: PublicationTargetType };
  warnings: string[];
}

interface PublicationPlanResponse {
  plan: PublicationPlan;
}

interface PublicationRequest {
  action: PublicationAction;
  mode: PublicationMode;
  targetId: string;
  targetType: PublicationTargetType;
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
    async <T>(request: () => Promise<T>, invalidate = true): Promise<T> => {
      setError(undefined);
      setIsPending(true);

      try {
        const response = await request();
        if (invalidate) {
          await queryClient.invalidateQueries({ queryKey: adminCurriculumKey });
        }
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
      input: Partial<Pick<AdminModule, 'description' | 'position' | 'title'>>,
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
  const previewPublication = useCallback(
    (input: PublicationRequest) =>
      execute(
        () =>
          apiRequest<PublicationPlanResponse>(
            '/api/admin/publication/preview',
            {
              body: JSON.stringify(input),
              headers: { 'content-type': 'application/json' },
              method: 'POST',
            },
          ),
        false,
      ).then(({ plan }) => plan),
    [execute],
  );
  const applyPublication = useCallback(
    (input: PublicationRequest & { planId: string }) =>
      execute(() =>
        apiRequest<PublicationPlanResponse>('/api/admin/publication/apply', {
          body: JSON.stringify(input),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        }),
      ).then(({ plan }) => plan),
    [execute],
  );

  return {
    applyPublication,
    error,
    isPending,
    previewPublication,
    updateLesson,
    updateModule,
  };
}
