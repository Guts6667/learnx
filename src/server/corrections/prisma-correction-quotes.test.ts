import type { PrismaClient } from '../../../generated/prisma/client.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveExerciseCorrectionContract } = vi.hoisted(() => ({
  resolveExerciseCorrectionContract: vi.fn(),
}));
vi.mock('../../lib/exercise-correction-contracts.js', () => ({
  resolveExerciseCorrectionContract,
}));

import { PrismaCorrectionQuoteRepository } from './prisma-correction-quotes.js';

const now = new Date('2026-08-28T12:00:00.000Z');

function quote(overrides: Record<string, unknown> = {}) {
  return {
    action: 'STANDARD',
    ceilingCredits: 20n,
    contractKey: 'writing-contract',
    contractVersion: '1.0.0',
    estimatedCredits: 12n,
    expiresAt: new Date('2026-08-28T13:00:00.000Z'),
    id: 'quote-1',
    includesAutomaticSecondPass: false,
    language: 'fr-FR',
    modelId: 'model-1',
    promptVersion: '1.0.0',
    provider: 'provider-1',
    reconsiderationArgument: null,
    reconsiderationOfCorrectionId: null,
    requestFingerprint: 'fingerprint',
    targetId: 'submission-1',
    targetKind: 'EXERCISE_SUBMISSION',
    userId: 'user-1',
    ...overrides,
  };
}

function submission(overrides: Record<string, unknown> = {}) {
  return {
    contentMarkdown: 'Réponse de l’apprenant.',
    exercise: {
      activityType: 'writing',
      instructions: 'Justifiez votre choix.',
      key: 'choose-framework',
      lesson: {
        module: { stage: { program: { slug: 'program-1' } } },
        objectives: ['Choisir', 2, null],
        slug: 'lesson-1',
        summary: 'Résumé de la leçon.',
      },
      rubric: { contractKey: 'writing-contract' },
      title: 'Choisir un cadre',
    },
    id: 'submission-1',
    status: 'SUBMITTED',
    ...overrides,
  };
}

function harness() {
  const prisma = {
    aiCorrection: { findFirst: vi.fn() },
    aiPricingQuote: { findFirst: vi.fn() },
    exerciseSubmission: { findFirst: vi.fn() },
  };
  return {
    prisma,
    repository: new PrismaCorrectionQuoteRepository(
      prisma as unknown as PrismaClient,
    ),
  };
}

describe('PrismaCorrectionQuoteRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveExerciseCorrectionContract.mockReturnValue({
      contract: { contractKey: 'writing-contract' },
      eligible: true,
    });
  });

  it('rejects missing, expired and unsupported quotes before loading a submission', async () => {
    const { prisma, repository } = harness();
    prisma.aiPricingQuote.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        quote({ expiresAt: new Date('2026-08-28T11:59:59.000Z') }),
      )
      .mockResolvedValueOnce(quote({ targetKind: 'STAGE_ASSESSMENT' }));

    await expect(
      repository.quotes.loadAcceptedQuote({
        now,
        quoteId: 'missing',
        userId: 'user-1',
      }),
    ).resolves.toBeNull();
    await expect(
      repository.quotes.loadAcceptedQuote({
        now,
        quoteId: 'expired',
        userId: 'user-1',
      }),
    ).resolves.toBeNull();
    await expect(
      repository.quotes.loadAcceptedQuote({
        now,
        quoteId: 'unsupported',
        userId: 'user-1',
      }),
    ).resolves.toBeNull();
    expect(prisma.exerciseSubmission.findFirst).not.toHaveBeenCalled();
  });

  it('rejects unusable submissions, actions and contract resolutions', async () => {
    const { prisma, repository } = harness();
    prisma.aiPricingQuote.findFirst.mockResolvedValue(quote());
    prisma.exerciseSubmission.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(submission({ status: 'DRAFT' }))
      .mockResolvedValueOnce(submission())
      .mockResolvedValueOnce(submission());

    const input = { now, quoteId: 'quote-1', userId: 'user-1' };
    await expect(
      repository.quotes.loadAcceptedQuote(input),
    ).resolves.toBeNull();
    await expect(
      repository.quotes.loadAcceptedQuote(input),
    ).resolves.toBeNull();

    prisma.aiPricingQuote.findFirst.mockResolvedValueOnce(
      quote({ action: 'UNSUPPORTED' }),
    );
    await expect(
      repository.quotes.loadAcceptedQuote(input),
    ).resolves.toBeNull();

    resolveExerciseCorrectionContract.mockReturnValueOnce({ eligible: false });
    await expect(
      repository.quotes.loadAcceptedQuote(input),
    ).resolves.toBeNull();
  });

  it('returns a standard accepted snapshot with sanitized objectives', async () => {
    const { prisma, repository } = harness();
    prisma.aiPricingQuote.findFirst.mockResolvedValueOnce(quote());
    prisma.exerciseSubmission.findFirst.mockResolvedValueOnce(submission());

    await expect(
      repository.quotes.loadAcceptedQuote({
        now,
        quoteId: 'quote-1',
        userId: 'user-1',
      }),
    ).resolves.toMatchObject({
      action: 'STANDARD',
      contract: { contractKey: 'writing-contract' },
      exerciseInstructions: 'Justifiez votre choix.',
      submissionText: 'Réponse de l’apprenant.',
      target: { id: 'submission-1', kind: 'EXERCISE_SUBMISSION' },
      taskContext: 'Résumé de la leçon.\nChoisir',
    });
    expect(resolveExerciseCorrectionContract).toHaveBeenCalledWith(
      expect.objectContaining({ lessonObjectives: ['Choisir'] }),
    );
    await expect(repository.quotes.markConsumed()).resolves.toBeUndefined();
  });

  it('returns reconsideration only from one settled standard correction', async () => {
    const { prisma, repository } = harness();
    prisma.aiPricingQuote.findFirst.mockResolvedValue(
      quote({
        action: 'RECONSIDERATION',
        reconsiderationArgument: 'La preuve a été ignorée.',
        reconsiderationOfCorrectionId: 'correction-1',
      }),
    );
    prisma.exerciseSubmission.findFirst.mockResolvedValue(submission());
    prisma.aiCorrection.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        contractSnapshot: { contractKey: 'writing-contract' },
        creditReservation: { settledAmount: 12n, status: 'SETTLED' },
        id: 'correction-1',
        pricingQuote: { action: 'STANDARD' },
        promptSnapshot: {
          exerciseInstructions: 'Instruction historique.',
          taskContext: 'Contexte historique.',
        },
        reconsideration: null,
        structuredResult: { correction: { criteria: [] } },
        submissionSnapshot: { text: 'Réponse historique.' },
      });

    const input = { now, quoteId: 'quote-1', userId: 'user-1' };
    await expect(
      repository.quotes.loadAcceptedQuote(input),
    ).resolves.toBeNull();
    await expect(
      repository.quotes.loadAcceptedQuote(input),
    ).resolves.toMatchObject({
      action: 'RECONSIDERATION',
      exerciseInstructions: 'Instruction historique.',
      reconsideration: {
        argument: 'La preuve a été ignorée.',
        sourceCorrectionId: 'correction-1',
      },
      submissionText: 'Réponse historique.',
      taskContext: 'Contexte historique.',
    });
  });

  it('rejects reconsideration when its source chain is not valid', async () => {
    const { prisma, repository } = harness();
    prisma.aiPricingQuote.findFirst.mockResolvedValue(
      quote({ action: 'RECONSIDERATION' }),
    );
    prisma.exerciseSubmission.findFirst.mockResolvedValue(submission());

    await expect(
      repository.quotes.loadAcceptedQuote({
        now,
        quoteId: 'quote-1',
        userId: 'user-1',
      }),
    ).resolves.toBeNull();
    expect(prisma.aiCorrection.findFirst).not.toHaveBeenCalled();
  });
});
