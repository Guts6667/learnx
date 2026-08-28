import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProviders } from '@/app/providers';

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiRequest: apiRequestMock }));

import {
  type StageAssessmentDetail,
  type StageAssessmentSubmission,
  useStageAssessmentMutation,
  useStageAssessmentQuery,
} from './queries';

const submission: StageAssessmentSubmission = {
  attachmentUrl: null,
  contentMarkdown: 'Réponse',
  id: 'submission-1',
  reviewFeedback: null,
  reviewedAt: null,
  score: null,
  status: 'DRAFT',
  submittedAt: null,
  updatedAt: '2026-08-28T00:00:00.000Z',
};

const assessment: StageAssessmentDetail = {
  description: 'Description',
  id: 'assessment-1',
  instructions: 'Répondez.',
  isRequired: true,
  passingScore: 70,
  position: 1,
  rubric: null,
  stageId: 'stage/1',
  submission: null,
  title: 'Évaluation',
  type: 'PROJECT',
};

function wrapper({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}

describe('stage assessment queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and explicitly reloads one stage assessment', async () => {
    apiRequestMock.mockResolvedValue({ assessment });
    const { result } = renderHook(() => useStageAssessmentQuery('stage/1'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.data).toEqual({ assessment }));
    expect(apiRequestMock).toHaveBeenCalledWith(
      '/api/stages/stage%2F1/assessment?preview=true',
    );

    await act(async () => result.current.reload());
    expect(apiRequestMock).toHaveBeenCalledTimes(2);
  });

  it('creates, saves and submits through the mutation contract', async () => {
    apiRequestMock.mockResolvedValue({ submission });
    const { result } = renderHook(
      () => useStageAssessmentMutation(assessment),
      { wrapper },
    );

    await act(async () => {
      await expect(result.current.createDraft()).resolves.toEqual(submission);
    });
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      '/api/stage-assessments/assessment-1/submissions',
      { method: 'POST' },
    );

    await act(async () => {
      await expect(
        result.current.save('submission/1', {
          attachmentUrl: 'https://example.com/proof',
          contentMarkdown: 'Réponse mise à jour',
        }),
      ).resolves.toEqual(submission);
    });
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      '/api/stage-assessment-submissions/submission%2F1',
      {
        body: JSON.stringify({
          action: 'save',
          attachmentUrl: 'https://example.com/proof',
          contentMarkdown: 'Réponse mise à jour',
        }),
        headers: { 'content-type': 'application/json' },
        method: 'PATCH',
      },
    );

    await act(async () => {
      await expect(result.current.submit('submission/1')).resolves.toEqual(
        submission,
      );
    });
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      '/api/stage-assessment-submissions/submission%2F1/submit',
      { method: 'POST' },
    );
    expect(result.current.error).toBeUndefined();
    expect(result.current.isPending).toBe(false);
  });

  it('exposes a failed mutation while preserving the rejection', async () => {
    const failure = new Error('network unavailable');
    apiRequestMock.mockRejectedValueOnce(failure);
    const { result } = renderHook(
      () => useStageAssessmentMutation(assessment),
      { wrapper },
    );

    await act(async () => {
      await expect(result.current.createDraft()).rejects.toBe(failure);
    });
    expect(result.current.error).toBe(failure);
    expect(result.current.isPending).toBe(false);
  });
});
