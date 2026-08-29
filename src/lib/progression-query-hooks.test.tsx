import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import {
  useConceptAssessmentAttemptMutation,
  useConceptAssessmentAttemptsQuery,
} from '@/features/concept-assessments/queries';
import {
  type StageAssessmentDetail,
  type StageAssessmentSubmission,
  useStageAssessmentMutation,
} from '@/features/stage-assessments/queries';
import { apiRequest } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }));

const mockedApiRequest = vi.mocked(apiRequest);
const assessmentId = '11111111-1111-4111-8111-111111111111';
const stageId = '22222222-2222-4222-8222-222222222222';
const submissionId = '33333333-3333-4333-8333-333333333333';

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

const submission: StageAssessmentSubmission = {
  attachmentUrl: null,
  contentMarkdown: 'Une production',
  id: submissionId,
  reviewFeedback: null,
  reviewedAt: null,
  score: null,
  status: 'DRAFT',
  submittedAt: null,
  updatedAt: '2026-08-28T09:00:00.000Z',
};

const stageAssessment: StageAssessmentDetail = {
  description: null,
  id: assessmentId,
  instructions: 'Produire une synthèse.',
  isRequired: true,
  passingScore: 80,
  position: 1,
  rubric: null,
  stageId,
  submission: null,
  title: 'Synthèse finale',
  type: 'WRITING',
};

describe('progression query mutations', () => {
  beforeEach(() => mockedApiRequest.mockReset());

  it('creates, saves and submits a stage assessment through stable API contracts', async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(['stage-assessment', stageId, 'preview'], {
      assessment: stageAssessment,
    });
    mockedApiRequest.mockResolvedValue({ submission });
    const { result } = renderHook(
      () => useStageAssessmentMutation(stageAssessment),
      { wrapper: createWrapper(queryClient) },
    );

    await act(() => result.current.createDraft());
    await act(() =>
      result.current.save(submissionId, {
        attachmentUrl: null,
        contentMarkdown: 'Une production',
      }),
    );
    await act(() => result.current.submit(submissionId));

    expect(mockedApiRequest).toHaveBeenNthCalledWith(
      1,
      `/api/stage-assessments/${assessmentId}/submissions`,
      { method: 'POST' },
    );
    expect(mockedApiRequest).toHaveBeenNthCalledWith(
      2,
      `/api/stage-assessment-submissions/${submissionId}`,
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(mockedApiRequest).toHaveBeenNthCalledWith(
      3,
      `/api/stage-assessment-submissions/${submissionId}/submit`,
      { method: 'POST' },
    );
    expect(
      queryClient.getQueryData<{ assessment: StageAssessmentDetail }>([
        'stage-assessment',
        stageId,
        'preview',
      ])?.assessment.submission,
    ).toEqual(submission);
  });

  it('rejects a concept submission before transport when its id is absent', async () => {
    const { result } = renderHook(
      () => useConceptAssessmentAttemptMutation(null, false),
      { wrapper: createWrapper(createQueryClient()) },
    );

    await expect(act(() => result.current.submit([]))).rejects.toThrow(
      'An assessment identifier is required.',
    );
    expect(mockedApiRequest).not.toHaveBeenCalled();
  });

  it('records a concept attempt in the cache and reports transport failures', async () => {
    const queryClient = createQueryClient();
    const lessonId = '66666666-6666-4666-8666-666666666666';
    queryClient.setQueryData(
      ['concept-assessment-attempts', assessmentId, true],
      { attempts: [], nextCursor: 'next-page' },
    );
    const existingLessonProgress = { lessonProgress: { percent: 25 } };
    queryClient.setQueryData(
      ['lesson-progress', lessonId],
      existingLessonProgress,
    );
    const progress = {
      bestScore: 100,
      lastAttemptAt: '2026-08-28T09:00:00.000Z',
      status: 'VALIDATED',
      validatedAt: '2026-08-28T09:00:00.000Z',
    };
    const response = {
      attempt: {
        id: submissionId,
        passed: true,
        score: 100,
        submittedAt: '2026-08-28T09:00:00.000Z',
      },
      corrections: [],
      progress,
    };
    mockedApiRequest.mockResolvedValueOnce(response);
    const { result } = renderHook(
      () => useConceptAssessmentAttemptMutation(assessmentId, true, lessonId),
      { wrapper: createWrapper(queryClient) },
    );

    await expect(act(() => result.current.submit([]))).resolves.toBe(response);
    expect(mockedApiRequest).toHaveBeenCalledWith(
      `/api/concept-assessments/${assessmentId}/attempts?preview=true`,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(
      queryClient.getQueryData<{
        attempts: Array<{ id: string }>;
        nextCursor: string | null;
      }>(['concept-assessment-attempts', assessmentId, true]),
    ).toEqual({ attempts: [response.attempt], nextCursor: 'next-page' });
    expect(queryClient.getQueryData(['lesson-progress', lessonId])).toEqual(
      existingLessonProgress,
    );
    expect(
      queryClient.getQueryState(['lesson-progress', lessonId])?.isInvalidated,
    ).toBe(true);

    const failure = new Error('concept request failed');
    mockedApiRequest.mockRejectedValueOnce(failure);
    await act(async () => {
      await expect(result.current.submit([])).rejects.toBe(failure);
    });
    expect(result.current.error).toBe(failure);
    expect(result.current.isPending).toBe(false);
  });

  it('paginates concept attempts without duplicating an existing attempt', async () => {
    const queryClient = createQueryClient();
    const firstAttempt = {
      answers: [],
      id: '44444444-4444-4444-8444-444444444444',
      passed: true,
      score: 100,
      submittedAt: '2026-08-28T09:00:00.000Z',
    };
    const secondAttempt = {
      answers: [],
      id: '55555555-5555-4555-8555-555555555555',
      passed: false,
      score: 60,
      submittedAt: '2026-08-27T09:00:00.000Z',
    };
    mockedApiRequest.mockResolvedValueOnce({
      attempts: [firstAttempt],
      nextCursor: 'cursor-2',
    });
    const { result } = renderHook(
      () => useConceptAssessmentAttemptsQuery(assessmentId, false),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(result.current.data?.attempts).toEqual([firstAttempt]);
      expect(result.current.hasMore).toBe(true);
    });

    mockedApiRequest.mockResolvedValueOnce({
      attempts: [firstAttempt, secondAttempt],
      nextCursor: null,
    });
    await act(async () => {
      await result.current.loadMore();
    });

    expect(mockedApiRequest).toHaveBeenLastCalledWith(
      `/api/concept-assessments/${assessmentId}/attempts?cursor=cursor-2`,
    );
    expect(result.current.data?.attempts).toEqual([
      firstAttempt,
      secondAttempt,
    ]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.isLoadingMore).toBe(false);
  });
});
