import type { PrismaClient } from '../../../generated/prisma/client.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { exerciseResolutionMock, runtimeEligibilityMock } = vi.hoisted(() => ({
  exerciseResolutionMock: vi.fn(),
  runtimeEligibilityMock: vi.fn(),
}));

vi.mock('../../lib/ai-correction-contracts.js', () => ({
  getCorrectionContractRuntimeEligibility: runtimeEligibilityMock,
}));
vi.mock('../../lib/exercise-correction-contracts.js', () => ({
  resolveExerciseCorrectionContract: exerciseResolutionMock,
}));

import { resolvePricingTarget } from './prisma-ai-pricing-targets.js';

const contract = { contractKey: 'writing', version: '1.0.0' };

function repository() {
  const aiCorrectionFindFirst = vi.fn();
  const exerciseSubmissionFindFirst = vi.fn();
  const stageAssessmentSubmissionFindFirst = vi.fn();
  return {
    aiCorrectionFindFirst,
    exerciseSubmissionFindFirst,
    prisma: {
      aiCorrection: { findFirst: aiCorrectionFindFirst },
      exerciseSubmission: { findFirst: exerciseSubmissionFindFirst },
      stageAssessmentSubmission: {
        findFirst: stageAssessmentSubmissionFindFirst,
      },
    } as unknown as PrismaClient,
    stageAssessmentSubmissionFindFirst,
  };
}

const exerciseSubmission = {
  contentMarkdown: 'Une réponse complète.',
  exercise: {
    activityType: 'writing',
    instructions: 'Justifiez votre choix.',
    key: 'exercise-1',
    lesson: {
      module: {
        stage: { program: { locale: 'fr', slug: 'programme' } },
      },
      objectives: ['Décider', 42, null],
      slug: 'lecon',
      summary: 'Résumé',
    },
    rubric: contract,
    title: 'Choisir',
  },
};

describe('resolvePricingTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeEligibilityMock.mockReturnValue({ contract, eligible: true });
    exerciseResolutionMock.mockReturnValue({ contract, eligible: true });
  });

  it('resolves eligible stage submissions and rejects missing or ineligible targets', async () => {
    const first = repository();
    first.stageAssessmentSubmissionFindFirst.mockResolvedValueOnce(null);
    await expect(
      resolvePricingTarget(first.prisma, 'user-1', {
        id: 'stage-submission-1',
        kind: 'STAGE_ASSESSMENT_SUBMISSION',
      }),
    ).resolves.toBeNull();

    first.stageAssessmentSubmissionFindFirst.mockResolvedValue({
      contentMarkdown: 'Réponse',
      stageAssessment: {
        rubric: contract,
        stage: { program: { locale: 'en' } },
      },
    });
    await expect(
      resolvePricingTarget(first.prisma, 'user-1', {
        id: 'stage-submission-1',
        kind: 'STAGE_ASSESSMENT_SUBMISSION',
      }),
    ).resolves.toMatchObject({
      contract,
      inputChars: 7,
      language: 'en-GB',
    });

    runtimeEligibilityMock.mockReturnValueOnce({ eligible: false });
    await expect(
      resolvePricingTarget(first.prisma, 'user-1', {
        id: 'stage-submission-1',
        kind: 'STAGE_ASSESSMENT_SUBMISSION',
      }),
    ).rejects.toThrow('TARGET_NOT_ELIGIBLE');
  });

  it('resolves regular exercise submissions with normalized objectives and language', async () => {
    const first = repository();
    first.exerciseSubmissionFindFirst.mockResolvedValueOnce(exerciseSubmission);
    const target = {
      id: 'exercise-submission-1',
      kind: 'EXERCISE_SUBMISSION',
    } as const;

    await expect(
      resolvePricingTarget(first.prisma, 'user-1', target),
    ).resolves.toMatchObject({
      contract,
      inputChars: exerciseSubmission.contentMarkdown.length,
      language: 'fr-FR',
      target,
    });
    expect(exerciseResolutionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        language: 'fr-FR',
        lessonObjectives: ['Décider'],
      }),
    );

    first.exerciseSubmissionFindFirst.mockResolvedValueOnce(null);
    await expect(
      resolvePricingTarget(first.prisma, 'user-1', target),
    ).resolves.toBeNull();

    first.exerciseSubmissionFindFirst.mockResolvedValueOnce({
      ...exerciseSubmission,
      contentMarkdown: null,
      exercise: {
        ...exerciseSubmission.exercise,
        lesson: {
          ...exerciseSubmission.exercise.lesson,
          objectives: null,
          module: {
            stage: { program: { locale: 'en', slug: 'programme' } },
          },
        },
      },
    });
    exerciseResolutionMock.mockReturnValueOnce({ eligible: false });
    await expect(
      resolvePricingTarget(first.prisma, 'user-1', target),
    ).rejects.toThrow('TARGET_NOT_ELIGIBLE');
  });

  it('accepts only settled, unreconsidered and eligible correction sources', async () => {
    const first = repository();
    const target = {
      id: 'exercise-submission-1',
      kind: 'EXERCISE_SUBMISSION',
      reconsideration: {
        argument: 'Le critère est démontré.',
        sourceCorrectionId: 'correction-1',
      },
    } as const;
    const validSource = {
      contractSnapshot: contract,
      creditReservation: { settledAmount: 12n, status: 'SETTLED' },
      pricingQuote: { action: 'STANDARD', language: 'fr-FR' },
      reconsideration: null,
      submissionSnapshot: { text: 'Réponse initiale' },
    };

    first.aiCorrectionFindFirst.mockResolvedValueOnce(null);
    await expect(
      resolvePricingTarget(first.prisma, 'user-1', target),
    ).resolves.toBeNull();

    for (const source of [
      {
        ...validSource,
        pricingQuote: { action: 'DETAILED', language: 'fr-FR' },
      },
      { ...validSource, reconsideration: { id: 'existing' } },
      {
        ...validSource,
        creditReservation: { settledAmount: 12n, status: 'RELEASED' },
      },
      {
        ...validSource,
        creditReservation: { settledAmount: null, status: 'SETTLED' },
      },
      { ...validSource, submissionSnapshot: { text: 42 } },
    ]) {
      first.aiCorrectionFindFirst.mockResolvedValueOnce(source);
      await expect(
        resolvePricingTarget(first.prisma, 'user-1', target),
      ).resolves.toBeNull();
    }

    first.aiCorrectionFindFirst.mockResolvedValueOnce(validSource);
    runtimeEligibilityMock.mockReturnValueOnce({ eligible: false });
    await expect(
      resolvePricingTarget(first.prisma, 'user-1', target),
    ).resolves.toBeNull();

    first.aiCorrectionFindFirst.mockResolvedValueOnce(validSource);
    await expect(
      resolvePricingTarget(first.prisma, 'user-1', target),
    ).resolves.toMatchObject({
      contract,
      inputChars: 16,
      language: 'fr-FR',
      reconsideration: target.reconsideration,
      target,
    });
  });
});
