import { QueryObserver } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAppQueryClient } from '@/app/providers';
import { apiRequest } from '@/lib/api-client';

export interface AdminProgramSummary {
  id: string;
  position: number;
  slug: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
  title: string;
  updatedAt: string;
  visibility: 'PRIVATE' | 'PUBLIC';
  publishedVersion: {
    checksum: string;
    id: string;
    publishedAt: string;
    version: number;
  } | null;
}

export interface AdminStageSummary {
  id: string;
  isPublished: boolean;
  position: number;
  slug: string;
  title: string;
}

export interface AdminModuleSummary {
  description: string;
  id: string;
  isPublished: boolean;
  position: number;
  slug: string;
  title: string;
}

export interface AdminLessonSummary {
  id: string;
  isPublished: boolean;
  position: number;
  slug: string;
  summary: string;
  title: string;
}

export interface AdminProgram extends AdminProgramSummary {
  stages: AdminStageSummary[];
}

export interface AdminStage extends AdminStageSummary {
  modules: AdminModuleSummary[];
  program: AdminProgramSummary;
}

export interface AdminModule extends AdminModuleSummary {
  lessons: AdminLessonSummary[];
  stage: AdminStageSummary & { program: AdminProgramSummary };
}

export interface AdminLesson extends AdminLessonSummary {
  module: AdminModuleSummary & {
    stage: AdminStageSummary & { program: AdminProgramSummary };
  };
}

export type AdminNavigationResponse =
  | { kind: 'LESSON'; lesson: AdminLesson }
  | { kind: 'MODULE'; module: AdminModule }
  | { kind: 'PROGRAM'; program: AdminProgram }
  | { kind: 'PROGRAMS'; programs: AdminProgramSummary[] }
  | { kind: 'STAGE'; stage: AdminStage };

export type AdminNavigationTarget =
  | { id: string; kind: 'LESSON' }
  | { id: string; kind: 'MODULE' }
  | { id: string; kind: 'PROGRAM' }
  | { kind: 'PROGRAMS' }
  | { id: string; kind: 'STAGE' };

interface AdminModuleResponse {
  module: AdminModuleSummary & { lessons: AdminLessonSummary[] };
}

interface AdminLessonResponse {
  lesson: AdminLessonSummary;
}

interface AdminProgramVisibilityResponse {
  program: Pick<
    AdminProgramSummary,
    'id' | 'status' | 'updatedAt' | 'visibility'
  >;
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

const adminNavigationKey = ['admin', 'navigation'] as const;

function navigationRequest(target: AdminNavigationTarget) {
  if (target.kind === 'PROGRAMS') {
    return {
      path: '/api/admin/programs',
      queryKey: [...adminNavigationKey, 'programs'] as const,
    };
  }

  const segment = {
    LESSON: 'lessons',
    MODULE: 'modules',
    PROGRAM: 'programs',
    STAGE: 'stages',
  }[target.kind];

  return {
    path: `/api/admin/${segment}/${encodeURIComponent(target.id)}`,
    queryKey: [...adminNavigationKey, target.kind, target.id] as const,
  };
}

export function useAdminNavigationQuery(target: AdminNavigationTarget) {
  const queryClient = useAppQueryClient();
  const request = navigationRequest(target);
  const targetId = 'id' in target ? target.id : '';
  const observer = useMemo(
    () =>
      new QueryObserver<AdminNavigationResponse>(queryClient, {
        queryFn: () => apiRequest<AdminNavigationResponse>(request.path),
        queryKey: request.queryKey,
        staleTime: 30_000,
      }),
    [queryClient, request.path, target.kind, targetId],
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
          await queryClient.invalidateQueries({ queryKey: adminNavigationKey });
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
      input: Partial<
        Pick<AdminModuleSummary, 'description' | 'position' | 'title'>
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
        Pick<
          AdminLessonSummary,
          'isPublished' | 'position' | 'summary' | 'title'
        >
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
  const updateProgramVisibility = useCallback(
    (
      programId: string,
      input: Pick<AdminProgramSummary, 'updatedAt' | 'visibility'>,
    ) =>
      execute(() =>
        apiRequest<AdminProgramVisibilityResponse>(
          `/api/admin/programs/${encodeURIComponent(programId)}/visibility`,
          {
            body: JSON.stringify({
              expectedUpdatedAt: input.updatedAt,
              visibility: input.visibility,
            }),
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
    updateProgramVisibility,
  };
}
