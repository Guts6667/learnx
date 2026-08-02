import { QueryObserver } from '@tanstack/query-core';
import { useEffect, useMemo, useState } from 'preact/hooks';

import { useAppQueryClient } from '@/app/providers';
import { apiRequest } from '@/lib/api-client';

export interface ProgramSummary {
  description: string;
  id: string;
  slug: string;
  stages: Array<{ id: string; position: number; slug: string; title: string }>;
  title: string;
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
