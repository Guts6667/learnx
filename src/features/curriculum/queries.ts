import { QueryObserver } from '@tanstack/query-core';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';

import { useAppQueryClient } from '@/app/providers';
import { apiRequest } from '@/lib/api-client';

export interface ProgramSummary {
  description: string;
  estimatedDurationDays: number | null;
  id: string;
  slug: string;
  stages: Array<{ id: string; position: number; slug: string; title: string }>;
  timeline: TimelineSnapshot;
  title: string;
}

export type TemporalStatus =
  | 'ahead'
  | 'behind'
  | 'completed_early'
  | 'completed_late'
  | 'completed_on_time'
  | 'on_track'
  | 'overdue';

export interface TimelineSnapshot {
  actualPercent: number;
  completedAt: string | null;
  expectedPercent: number;
  progressDelta: number;
  startedAt: string | null;
  targetEndAt: string | null;
  temporalStatus: TemporalStatus | null;
}

export interface LessonSummary {
  estimatedMinutes: number | null;
  id: string;
  position: number;
  slug: string;
  summary: string;
  title: string;
}

export interface ModuleSummary {
  id: string;
  lessons: LessonSummary[];
  position: number;
  slug: string;
  title: string;
}

export interface StageSummary {
  id: string;
  modules: ModuleSummary[];
  position: number;
  slug: string;
  timeline: TimelineSnapshot;
  title: string;
}

export interface ProgramDetail extends ProgramSummary {
  stages: StageSummary[];
}

export interface StageDetail extends StageSummary {
  estimatedDurationDays: number | null;
  title: string;
}

export interface ModuleDetail extends ModuleSummary {
  description: string;
  estimatedMinutes: number | null;
}

export type ContentBlockType =
  | 'CALLOUT'
  | 'DEFINITION'
  | 'DIVIDER'
  | 'EMBED'
  | 'EXAMPLE'
  | 'OBJECTIVE'
  | 'QUOTE'
  | 'RICH_TEXT';

export interface LessonContentBlock {
  content: unknown;
  id: string;
  position: number;
  type: ContentBlockType;
}

export interface LessonResource {
  author: string | null;
  citation: string | null;
  description: string | null;
  estimatedMinutes: number | null;
  id: string;
  isRequired: boolean;
  position: number;
  title: string;
  type: string;
  url: string | null;
}

export interface LessonTask {
  description: string | null;
  id: string;
  isRequired: boolean;
  position: number;
  title: string;
  type: string;
  weight: number;
}

export interface LessonDetail extends LessonSummary {
  contentBlocks: LessonContentBlock[];
  objectives: unknown;
  prerequisites: unknown;
  resources: LessonResource[];
  tasks: LessonTask[];
}

export type LessonProgressStatus =
  'AVAILABLE' | 'COMPLETED' | 'IN_PROGRESS' | 'NEEDS_REVIEW';
export type ResourceProgressStatus = 'COMPLETED' | 'NOT_STARTED' | 'STARTED';
export type TaskCompletionStatus = 'DONE' | 'SKIPPED' | 'TODO';

export interface LessonProgressResponse {
  canComplete: boolean;
  lessonProgress: {
    completedAt: string | null;
    percent: number;
    startedAt: string | null;
    status: LessonProgressStatus;
  };
  resourceProgress: Record<string, ResourceProgressStatus>;
  taskCompletions: Record<string, TaskCompletionStatus>;
}

function useCurriculumQuery<T>(queryKey: readonly string[], path: string) {
  const queryClient = useAppQueryClient();
  const queryKeyHash = queryKey.join(':');
  const observer = useMemo(
    () =>
      new QueryObserver(queryClient, {
        queryKey,
        queryFn: () => apiRequest<T>(path),
        staleTime: 0,
      }),
    [path, queryClient, queryKeyHash],
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

export function useProgramsQuery() {
  return useCurriculumQuery<{ programs: ProgramSummary[] }>(
    ['programs'],
    '/api/programs',
  );
}

export function useProgramQuery(programSlug: string) {
  return useCurriculumQuery<{ program: ProgramDetail }>(
    ['program', programSlug],
    `/api/programs/${encodeURIComponent(programSlug)}`,
  );
}

export function useStageQuery(programSlug: string, stageSlug: string) {
  return useCurriculumQuery<{ stage: StageDetail }>(
    ['stage', programSlug, stageSlug],
    `/api/programs/${encodeURIComponent(programSlug)}/stages/${encodeURIComponent(stageSlug)}`,
  );
}

export function useModuleQuery(moduleSlug: string) {
  return useCurriculumQuery<{ module: ModuleDetail }>(
    ['module', moduleSlug],
    `/api/modules/${encodeURIComponent(moduleSlug)}`,
  );
}

export function useLessonQuery(lessonSlug: string) {
  return useCurriculumQuery<{ lesson: LessonDetail }>(
    ['lesson', lessonSlug],
    `/api/lessons/${encodeURIComponent(lessonSlug)}`,
  );
}

export function useLessonProgressQuery(lessonId: string) {
  return useCurriculumQuery<LessonProgressResponse>(
    ['lesson-progress', lessonId],
    `/api/lessons/${encodeURIComponent(lessonId)}/progress`,
  );
}

export function useLessonProgressMutation(lessonId: string) {
  const queryClient = useAppQueryClient();
  const [error, setError] = useState<unknown>();
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = useCallback(
    async (
      path: string,
      method: 'PATCH' | 'POST',
      body?: Record<string, string>,
    ) => {
      setError(undefined);
      setIsPending(true);

      try {
        const response = await apiRequest<LessonProgressResponse>(path, {
          body: body ? JSON.stringify(body) : undefined,
          headers: body ? { 'content-type': 'application/json' } : undefined,
          method,
        });

        queryClient.setQueryData(['lesson-progress', lessonId], response);
        return response;
      } catch (requestError) {
        setError(requestError);
        throw requestError;
      } finally {
        setIsPending(false);
      }
    },
    [lessonId, queryClient],
  );

  return { error, isPending, mutateAsync };
}
