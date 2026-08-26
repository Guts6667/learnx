import { QueryObserver } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAppQueryClient } from '@/app/providers';
import { ApiClientError, apiRequest } from '@/lib/api-client';
import type { UiLocale } from '@/i18n';

export interface ProgramSummary {
  canonicalProgramKey: string;
  description: string;
  estimatedDurationDays: number | null;
  id: string;
  locale: UiLocale;
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
  visibility: 'PRIVATE' | 'PUBLIC';
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
  activityCounts: {
    concepts: number;
    exercises: number;
    quizzes: number;
    resources: number;
    tasks: number;
  };
  estimatedMinutes: number | null;
  id: string;
  isLocked: boolean;
  isPublished: boolean;
  position: number;
  progress: { percent: number; status: LessonProgressStatus };
  slug: string;
  summary: string;
  title: string;
}

export interface ModuleSummary {
  id: string;
  isPublished: boolean;
  lessons: LessonSummary[];
  position: number;
  progress: {
    percent: number;
    status: 'AVAILABLE' | 'COMPLETED' | 'IN_PROGRESS' | 'LOCKED';
  };
  slug: string;
  title: string;
}

export interface StageSummary {
  description: string;
  estimatedDurationDays: number | null;
  estimatedMinutes: number | null;
  id: string;
  isPublished: boolean;
  modules: ModuleSummary[];
  position: number;
  progress: {
    percent: number;
    status: 'AVAILABLE' | 'COMPLETED' | 'IN_PROGRESS' | 'LOCKED';
  };
  slug: string;
  timeline: TimelineSnapshot;
  title: string;
}

export interface ProgramDetail extends ProgramSummary {
  stages: StageSummary[];
  viewPreference: { expandedStageId: string | null };
}

export interface StageDetail extends StageSummary {
  estimatedDurationDays: number | null;
  title: string;
  validation: StageValidation | null;
}

export interface StageValidationRequirement {
  id: string | null;
  title: string;
  type:
    | 'FINAL_ASSESSMENT'
    | 'REQUIRED_CONCEPT'
    | 'REQUIRED_EXERCISE'
    | 'REQUIRED_TASK';
}

export interface StageValidation {
  finalAssessments: { total: number; validated: number };
  isValidated: boolean;
  missingRequirements: StageValidationRequirement[];
  requiredConcepts: { total: number; validated: number };
  requiredExercises: { total: number; validated: number };
  requiredTasks: { total: number; validated: number };
  status: 'AVAILABLE' | 'COMPLETED' | 'IN_PROGRESS' | 'LOCKED';
}

export interface ModuleDetail extends ModuleSummary {
  description: string;
  estimatedMinutes: number | null;
  stage: {
    id: string;
    isPublished: boolean;
    program: { id: string; slug: string; title: string };
    slug: string;
    title: string;
  };
}

export interface ModuleRestartPreview {
  currentRunSequence: number;
  firstLesson: { slug: string; title: string } | null;
  moduleId: string;
  moduleTitle: string;
  preserved: {
    conceptAttempts: number;
    exerciseSubmissions: number;
    notes: number;
    quizAttempts: number;
  };
  reset: {
    concepts: number;
    exercises: number;
    lessons: number;
    quizzes: number;
    resources: number;
    tasks: number;
  };
}

export interface ModuleRestartResult extends ModuleRestartPreview {
  idempotent: boolean;
  runId: string;
}

export interface ProgramRestartPreview {
  firstLesson: { slug: string; title: string } | null;
  programId: string;
  programTitle: string;
  preserved: ModuleRestartPreview['preserved'] & {
    stageAssessmentSubmissions: number;
  };
  reset: ModuleRestartPreview['reset'] & { modules: number; stages: number };
}

export interface ProgramRestartResult extends ProgramRestartPreview {
  idempotent: boolean;
  runIds: string[];
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
  key: string;
  position: number;
  type: ContentBlockType;
}

export interface LessonResource {
  author: string | null;
  citation: string | null;
  description: string | null;
  estimatedMinutes: number | null;
  guidance: {
    accessibilityNotes?: string;
    alternativeResourceKey?: string | null;
    instructions: string;
    objective: string;
    scope?: string | null;
    urlStatus: 'broken' | 'ok' | 'redirect' | 'restricted';
  } | null;
  id: string;
  isRequired: boolean;
  key: string;
  position: number;
  title: string;
  type: string;
  url: string | null;
}

export interface LessonTask {
  description: string | null;
  id: string;
  isRequired: boolean;
  key: string;
  position: number;
  resources: LessonResource[];
  title: string;
  type: string;
  weight: number;
}

export interface LessonExerciseSummary {
  id: string;
  key: string;
  instructions: string;
  isRequired: boolean;
  position: number;
  rubric: unknown;
  title: string;
}

export interface LessonQuizSummary {
  description: string | null;
  id: string;
  key: string;
  isRequired: boolean;
  passingScore: number;
  position: number;
  questionCount: number;
  title: string;
}

export interface LessonConceptSummary {
  assessments: Array<{
    id: string;
    key: string;
    isRequired: boolean;
    position: number;
    questionCount: number | null;
    title: string | null;
  }>;
  id: string;
  isRequired: boolean;
  masteryThreshold: number;
  position: number;
  slug: string;
  title: string;
}

export interface LessonDetail extends Omit<
  LessonSummary,
  'activityCounts' | 'progress'
> {
  concepts: LessonConceptSummary[];
  contentBlocks: LessonContentBlock[];
  exercises: LessonExerciseSummary[];
  module: {
    id: string;
    isPublished: boolean;
    slug: string;
    stage: {
      id: string;
      isPublished: boolean;
      program: { id: string; slug: string; title: string };
      slug: string;
      title: string;
    };
    title: string;
  };
  navigation: {
    nextLesson: Omit<LessonSummary, 'activityCounts' | 'progress'> | null;
    previousLesson: Omit<LessonSummary, 'activityCounts' | 'progress'> | null;
  };
  objectives: unknown;
  prerequisites: unknown;
  quizzes: LessonQuizSummary[];
  resources: LessonResource[];
  sequence: Array<{
    id: string;
    key: string;
    kind:
      | 'CONTENT'
      | 'RESOURCE'
      | 'TASK'
      | 'CONCEPT_ASSESSMENT'
      | 'EXERCISE'
      | 'QUIZ';
  }>;
  tasks: LessonTask[];
}

export type LessonProgressStatus =
  'AVAILABLE' | 'COMPLETED' | 'IN_PROGRESS' | 'NEEDS_REVIEW';
export type ResourceProgressStatus = 'COMPLETED' | 'NOT_STARTED' | 'STARTED';
export type TaskCompletionStatus = 'DONE' | 'SKIPPED' | 'TODO';

export interface LessonProgressResponse {
  canComplete: boolean;
  currentActivity: {
    id: string;
    kind:
      | 'CONTENT'
      | 'RESOURCE'
      | 'TASK'
      | 'CONCEPT_ASSESSMENT'
      | 'EXERCISE'
      | 'QUIZ';
  } | null;
  conceptProgress: Record<string, string>;
  exerciseSubmissions: Record<string, string>;
  lessonProgress: {
    completedAt: string | null;
    percent: number;
    startedAt: string | null;
    status: LessonProgressStatus;
  };
  resourceProgress: Record<string, ResourceProgressStatus>;
  quizPassed: Record<string, boolean>;
  taskCompletions: Record<string, TaskCompletionStatus>;
}

function useCurriculumQuery<T>(
  queryKey: readonly string[],
  path: string,
  enabled = true,
  ownerPreviewMode: 'fallback' | 'prefer' | undefined = undefined,
) {
  const queryClient = useAppQueryClient();
  const queryKeyHash = queryKey.join(':');
  const observer = useMemo(
    () =>
      new QueryObserver(queryClient, {
        enabled,
        queryKey,
        queryFn: async () => {
          const separator = path.includes('?') ? '&' : '?';
          const previewPath = `${path}${separator}preview=true`;
          const primaryPath =
            ownerPreviewMode === 'prefer' ? previewPath : path;
          const fallbackPath =
            ownerPreviewMode === 'prefer' ? path : previewPath;
          try {
            return await apiRequest<T>(primaryPath);
          } catch (error) {
            if (
              !ownerPreviewMode ||
              !(error instanceof ApiClientError) ||
              error.status !== 404
            ) {
              throw error;
            }
            return apiRequest<T>(fallbackPath);
          }
        },
        staleTime: 0,
      }),
    [enabled, ownerPreviewMode, path, queryClient, queryKeyHash],
  );
  const [result, setResult] = useState(() => observer.getCurrentResult());

  useEffect(() => {
    setResult(observer.getCurrentResult());
    const unsubscribe = observer.subscribe(setResult);

    if (enabled) void observer.refetch();

    return unsubscribe;
  }, [observer]);

  const reload = useCallback(async () => {
    await observer.refetch();
  }, [observer]);

  return {
    data: result.data,
    error: result.error,
    isPending: enabled && result.isPending,
    reload,
  };
}

export function useProgramsQuery(enabled = true) {
  return useCurriculumQuery<{ programs: ProgramSummary[] }>(
    ['programs', 'preview'],
    '/api/programs?preview=true',
    enabled,
  );
}

export function useProgramQuery(programSlug: string) {
  return useCurriculumQuery<{ program: ProgramDetail }>(
    ['program', programSlug, 'accessible'],
    `/api/programs/${encodeURIComponent(programSlug)}`,
    true,
    'prefer',
  );
}

export function useProgramViewPreference(programSlug: string) {
  const queryClient = useAppQueryClient();
  const [error, setError] = useState<unknown>();
  const [isPending, setIsPending] = useState(false);

  const save = useCallback(
    async (expandedStageId: string) => {
      setError(undefined);
      setIsPending(true);
      const path = `/api/programs/${encodeURIComponent(programSlug)}/view-preference`;
      const request = (requestPath: string) =>
        apiRequest<{ viewPreference: { expandedStageId: string } }>(
          requestPath,
          {
            body: JSON.stringify({ expandedStageId }),
            headers: { 'content-type': 'application/json' },
            method: 'PUT',
          },
        );

      try {
        let response;
        try {
          response = await request(path);
        } catch (requestError) {
          if (
            !(requestError instanceof ApiClientError) ||
            requestError.status !== 404
          ) {
            throw requestError;
          }
          response = await request(`${path}?preview=true`);
        }
        queryClient.setQueryData<{ program: ProgramDetail }>(
          ['program', programSlug, 'accessible'],
          (current) =>
            current
              ? {
                  program: {
                    ...current.program,
                    viewPreference: response.viewPreference,
                  },
                }
              : current,
        );
        return response.viewPreference;
      } catch (requestError) {
        setError(requestError);
        throw requestError;
      } finally {
        setIsPending(false);
      }
    },
    [programSlug, queryClient],
  );

  return { error, isPending, save };
}

export function useStageQuery(programSlug: string, stageSlug: string) {
  return useCurriculumQuery<{ stage: StageDetail }>(
    ['stage', programSlug, stageSlug, 'accessible'],
    `/api/programs/${encodeURIComponent(programSlug)}/stages/${encodeURIComponent(stageSlug)}`,
    true,
    'fallback',
  );
}

export function useModuleQuery(moduleSlug: string) {
  return useCurriculumQuery<{ module: ModuleDetail }>(
    ['module', moduleSlug, 'accessible'],
    `/api/modules/${encodeURIComponent(moduleSlug)}`,
    true,
    'fallback',
  );
}

export function useModuleRestart(moduleId: string) {
  const queryClient = useAppQueryClient();
  const [error, setError] = useState<unknown>();
  const [isPending, setIsPending] = useState(false);
  const [preview, setPreview] = useState<ModuleRestartPreview>();
  const [restartKey, setRestartKey] = useState<string>();

  const loadPreview = useCallback(async () => {
    setError(undefined);
    setIsPending(true);
    try {
      const response = await apiRequest<{ preview: ModuleRestartPreview }>(
        `/api/modules/${encodeURIComponent(moduleId)}/restart-preview`,
      );
      setPreview(response.preview);
      setRestartKey(crypto.randomUUID());
      return response.preview;
    } catch (requestError) {
      setError(requestError);
      throw requestError;
    } finally {
      setIsPending(false);
    }
  }, [moduleId]);

  const restart = useCallback(async () => {
    if (!restartKey) throw new Error('Restart confirmation is required.');
    setError(undefined);
    setIsPending(true);
    try {
      const response = await apiRequest<{ result: ModuleRestartResult }>(
        `/api/modules/${encodeURIComponent(moduleId)}/restart`,
        {
          body: JSON.stringify({ restartKey }),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      );
      await queryClient.invalidateQueries();
      return response.result;
    } catch (requestError) {
      setError(requestError);
      throw requestError;
    } finally {
      setIsPending(false);
    }
  }, [moduleId, queryClient, restartKey]);

  const cancel = useCallback(() => {
    setError(undefined);
    setPreview(undefined);
    setRestartKey(undefined);
  }, []);

  return { cancel, error, isPending, loadPreview, preview, restart };
}

export function useProgramRestart(programId: string) {
  const queryClient = useAppQueryClient();
  const [error, setError] = useState<unknown>();
  const [isPending, setIsPending] = useState(false);
  const [preview, setPreview] = useState<ProgramRestartPreview>();
  const [restartKey, setRestartKey] = useState<string>();

  const loadPreview = useCallback(async () => {
    setError(undefined);
    setIsPending(true);
    try {
      const response = await apiRequest<{ preview: ProgramRestartPreview }>(
        `/api/programs/${encodeURIComponent(programId)}/restart-preview`,
      );
      setPreview(response.preview);
      setRestartKey(crypto.randomUUID());
      return response.preview;
    } catch (requestError) {
      setError(requestError);
      throw requestError;
    } finally {
      setIsPending(false);
    }
  }, [programId]);

  const restart = useCallback(async () => {
    if (!restartKey) throw new Error('Restart confirmation is required.');
    setError(undefined);
    setIsPending(true);
    try {
      const response = await apiRequest<{ result: ProgramRestartResult }>(
        `/api/programs/${encodeURIComponent(programId)}/restart`,
        {
          body: JSON.stringify({ restartKey }),
          headers: { 'content-type': 'application/json' },
          method: 'POST',
        },
      );
      await queryClient.invalidateQueries();
      return response.result;
    } catch (requestError) {
      setError(requestError);
      throw requestError;
    } finally {
      setIsPending(false);
    }
  }, [programId, queryClient, restartKey]);

  const cancel = useCallback(() => {
    setError(undefined);
    setPreview(undefined);
    setRestartKey(undefined);
  }, []);

  return { cancel, error, isPending, loadPreview, preview, restart };
}

export function useLessonQuery(lessonSlug: string) {
  return useCurriculumQuery<{ lesson: LessonDetail }>(
    ['lesson', lessonSlug, 'accessible'],
    `/api/lessons/${encodeURIComponent(lessonSlug)}`,
    true,
    'fallback',
  );
}

export function useLessonProgressQuery(lessonId: string, enabled = true) {
  return useCurriculumQuery<LessonProgressResponse>(
    ['lesson-progress', lessonId],
    `/api/lessons/${encodeURIComponent(lessonId)}/progress`,
    enabled,
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
