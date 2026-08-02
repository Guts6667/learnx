import { QueryObserver } from '@tanstack/query-core';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';

import { useAppQueryClient } from '@/app/providers';
import { apiRequest } from '@/lib/api-client';

export interface ProgramSummary {
  description: string;
  estimatedDurationDays: number | null;
  id: string;
  slug: string;
  stages: Array<{
    id: string;
    isPublished: boolean;
    position: number;
    slug: string;
    title: string;
  }>;
  status: 'ACTIVE' | 'DRAFT';
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
  isPublished: boolean;
  position: number;
  slug: string;
  summary: string;
  title: string;
}

export interface ModuleSummary {
  id: string;
  isPublished: boolean;
  lessons: LessonSummary[];
  position: number;
  slug: string;
  title: string;
}

export interface StageSummary {
  id: string;
  isPublished: boolean;
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
  validation: StageValidation | null;
}

export interface StageValidationRequirement {
  id: string | null;
  title: string;
  type: 'FINAL_ASSESSMENT' | 'REQUIRED_CONCEPT' | 'REQUIRED_TASK';
}

export interface StageValidation {
  finalAssessments: { total: number; validated: number };
  isValidated: boolean;
  missingRequirements: StageValidationRequirement[];
  requiredConcepts: { total: number; validated: number };
  requiredTasks: { total: number; validated: number };
  status: 'AVAILABLE' | 'COMPLETED' | 'IN_PROGRESS' | 'LOCKED';
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
  key: string | null;
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

export interface LessonQuizSummary {
  description: string | null;
  id: string;
  isRequired: boolean;
  passingScore: number;
  position: number;
  questionCount: number;
  title: string;
}

export interface LessonConceptSummary {
  id: string;
  isRequired: boolean;
  masteryThreshold: number;
  position: number;
  slug: string;
  title: string;
}

export interface LessonDetail extends LessonSummary {
  concepts: LessonConceptSummary[];
  contentBlocks: LessonContentBlock[];
  objectives: unknown;
  prerequisites: unknown;
  quizzes: LessonQuizSummary[];
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
    ['programs', 'preview'],
    '/api/programs?preview=true',
  );
}

export function useProgramQuery(programSlug: string) {
  return useCurriculumQuery<{ program: ProgramDetail }>(
    ['program', programSlug, 'preview'],
    `/api/programs/${encodeURIComponent(programSlug)}?preview=true`,
  );
}

export function useStageQuery(programSlug: string, stageSlug: string) {
  return useCurriculumQuery<{ stage: StageDetail }>(
    ['stage', programSlug, stageSlug, 'preview'],
    `/api/programs/${encodeURIComponent(programSlug)}/stages/${encodeURIComponent(stageSlug)}?preview=true`,
  );
}

export function useModuleQuery(moduleSlug: string) {
  return useCurriculumQuery<{ module: ModuleDetail }>(
    ['module', moduleSlug, 'preview'],
    `/api/modules/${encodeURIComponent(moduleSlug)}?preview=true`,
  );
}

export function useLessonQuery(lessonSlug: string) {
  return useCurriculumQuery<{ lesson: LessonDetail }>(
    ['lesson', lessonSlug, 'preview'],
    `/api/lessons/${encodeURIComponent(lessonSlug)}?preview=true`,
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
