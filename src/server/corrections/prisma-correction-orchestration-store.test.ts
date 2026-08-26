import { describe, expect, it, vi } from 'vitest';

import type {
  AcceptedQuoteSnapshot,
  OrchestratedCorrectionResult,
} from './correction-orchestration';
import { PrismaCorrectionOrchestrationPorts } from './prisma-correction-orchestration-store';

function quote(): AcceptedQuoteSnapshot {
  return {
    contract: { contractKey: 'writing-pilot' },
    contractKey: 'writing-pilot',
    contractVersion: '1.0.0',
    estimatedCredits: 3n,
    exerciseInstructions: 'Rédigez une réponse.',
    expiresAt: new Date('2026-08-25T20:00:00Z'),
    includesAutomaticSecondPass: true,
    language: 'fr-FR',
    maximumReservedCredits: 6n,
    modelId: 'anthropic/claude-sonnet-4.6',
    promptVersion: '2.2.0',
    provider: 'Anthropic',
    quoteId: '0c94830b-022d-4c3d-9963-77ebdc4f9897',
    requestFingerprint: 'a'.repeat(64),
    submissionText: 'Réponse synthétique.',
    target: {
      id: 'cc077876-bf27-4aea-bd73-35d4424a668f',
      kind: 'EXERCISE_SUBMISSION',
    },
    taskContext: null,
    userId: '6ce94140-7435-426a-9753-90faebc7695a',
  };
}

function result(
  status: OrchestratedCorrectionResult['correction']['status'],
): OrchestratedCorrectionResult['correction'] {
  return {
    criteria: [],
    id: '',
    indicativeScore: status === 'COMPLETED' ? 92 : null,
    modelUsageCostUsd: 0.027993,
    monitoringSignals: [],
    overallFeedback: null,
    secondPassRequired: false,
    status,
    unsureCriteria: [],
    unsureCriterionDetails: [],
  };
}

describe('Prisma correction orchestration store', () => {
  it.each([
    ['COMPLETED', 'COMPLETED'],
    ['COMPLETED_PARTIAL', 'PROVISIONAL'],
    ['FAILED', 'PROVISIONAL'],
  ] as const)(
    'persists the %s formative result as %s without a PASS/FAIL decision',
    async (runtimeStatus, databaseStatus) => {
      const create = vi.fn(async (input: { data: Record<string, unknown> }) => {
        void input;
        return { id: 'correction-1' };
      });
      const update = vi.fn(async (input: { data: Record<string, unknown> }) => {
        void input;
        return { id: 'correction-1' };
      });
      const ports = new PrismaCorrectionOrchestrationPorts({
        aiCorrection: { create, update },
      } as never);

      await ports.corrections.begin({
        quote: quote(),
        reservationId: '49dbe27b-00a8-4f9a-ba5e-e8530e820e47',
        userId: quote().userId,
      });
      await ports.corrections.finalize({
        correctionId: 'correction-1',
        quote: quote(),
        result: result(runtimeStatus),
      });

      const [beginCall] = create.mock.calls;
      expect(beginCall).toBeDefined();
      if (!beginCall) throw new Error('AI_CORRECTION_CREATE_NOT_CALLED');
      expect(beginCall[0].data).toMatchObject({
        pipelineKind: 'SINGLE_MODEL',
        status: 'RESERVED',
      });

      const [finalizeCall] = update.mock.calls;
      expect(finalizeCall).toBeDefined();
      if (!finalizeCall) throw new Error('AI_CORRECTION_UPDATE_NOT_CALLED');
      const data = finalizeCall[0].data;
      expect(data).toMatchObject({
        indicativeScore: runtimeStatus === 'COMPLETED' ? 92 : null,
        status: databaseStatus,
      });
      expect(data).not.toHaveProperty('confidence');
      expect(data).not.toHaveProperty('decision');
      expect(data).not.toHaveProperty('score');
    },
  );

  it('separates validated structured output from a rejected raw output', async () => {
    const attemptCreate = vi.fn(
      async (input: { data: Record<string, unknown> }) => {
        void input;
        return { id: 'attempt-1' };
      },
    );
    const attemptUpdate = vi.fn(
      async (input: { data: Record<string, unknown> }) => {
        void input;
        return { id: 'attempt-1' };
      },
    );
    const ports = new PrismaCorrectionOrchestrationPorts({
      aiCorrectionAttempt: { create: attemptCreate, update: attemptUpdate },
    } as never);

    await ports.corrections.recordAttemptIntent({
      correctionId: 'correction-1',
      sequence: 1,
    });
    await ports.corrections.recordAttemptOutcome({
      attempt: {
        actualCostUsd: 0.012,
        inputTokens: 100,
        modelSnapshot: 'anthropic/claude-4.6-sonnet-20260217',
        output: { valid: true },
        providerRequestId: 'gen-valid',
        providerRoute: 'Anthropic',
        reasoningTokens: 0,
        sequence: 1,
        status: 'SUCCEEDED',
        visibleOutputTokens: 50,
      },
      correctionId: 'correction-1',
    });
    await ports.corrections.recordAttemptIntent({
      correctionId: 'correction-1',
      sequence: 2,
    });
    await ports.corrections.recordAttemptOutcome({
      attempt: {
        errorCode: 'MODEL_OUTPUT_INVALID',
        output: { invalid: true },
        sequence: 2,
        status: 'FAILED',
      },
      correctionId: 'correction-1',
    });

    expect(attemptCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ dispatchStatus: 'CALL_INTENT' }),
      }),
    );
    const firstOutcome = attemptUpdate.mock.calls[0]?.[0].data;
    const secondOutcome = attemptUpdate.mock.calls[1]?.[0].data;
    expect(firstOutcome).toMatchObject({
      costSource: 'ACTUAL',
      dispatchStatus: 'CONFIRMED',
      generationId: 'gen-valid',
      providerRequestId: 'gen-valid',
      structuredResult: { valid: true },
    });
    expect(secondOutcome).toMatchObject({
      dispatchStatus: 'ORPHANED',
      rawOutput: { invalid: true },
    });
  });

  it.each([
    {
      expected: 'READY',
      reservation: {
        id: 'reservation-1',
        settledAmount: 3n,
        status: 'SETTLED',
      },
    },
    {
      expected: 'READY_TO_SETTLE',
      reservation: {
        id: 'reservation-1',
        settledAmount: null,
        status: 'RESERVED',
      },
    },
    {
      expected: 'RECONCILIATION_REQUIRED',
      reservation: {
        id: 'reservation-1',
        settledAmount: null,
        status: 'RELEASED',
      },
    },
  ] as const)(
    'derives replay state $expected from the authoritative reservation',
    async ({ expected, reservation }) => {
      const findFirst = vi.fn(async () => ({
        creditReservation: reservation,
        status: 'COMPLETED',
        structuredResult: {
          correction: { ...result('COMPLETED'), id: 'correction-1' },
          settlement: {
            releasedCredits: '3',
            reservedCredits: '6',
            settledCredits: '3',
          },
        },
      }));
      const ports = new PrismaCorrectionOrchestrationPorts({
        aiCorrection: { findFirst },
      } as never);

      const replay = await ports.corrections.findByQuote({
        requestFingerprint: quote().requestFingerprint,
        userId: quote().userId,
      });

      expect(replay).toMatchObject({ state: expected });
    },
  );

  it('restores only a correction whose credit settlement is authoritative', async () => {
    const findFirst = vi.fn(async () => ({
      creditReservation: {
        settledAmount: 3n,
        status: 'SETTLED',
      },
      structuredResult: {
        correction: { ...result('COMPLETED'), id: 'correction-1' },
        settlement: {
          releasedCredits: '3',
          reservedCredits: '6',
          settledCredits: '3',
        },
      },
    }));
    const ports = new PrismaCorrectionOrchestrationPorts({
      aiCorrection: { findFirst },
    } as never);

    const latest = await ports.findLatestForSubmission({
      submissionId: quote().target.id,
      userId: quote().userId,
    });

    expect(latest).toMatchObject({
      correction: { id: 'correction-1', status: 'COMPLETED' },
      replay: true,
      settlement: { settledCredits: '3' },
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          exerciseSubmissionId: quote().target.id,
          userId: quote().userId,
        },
      }),
    );
  });

  it('does not expose a correction before its credit settlement is complete', async () => {
    const ports = new PrismaCorrectionOrchestrationPorts({
      aiCorrection: {
        findFirst: vi.fn(async () => ({
          creditReservation: {
            settledAmount: null,
            status: 'RESERVED',
          },
          structuredResult: {
            correction: { ...result('COMPLETED'), id: 'correction-1' },
            settlement: {
              releasedCredits: '3',
              reservedCredits: '6',
              settledCredits: '3',
            },
          },
        })),
      },
    } as never);

    await expect(
      ports.findLatestForSubmission({
        submissionId: quote().target.id,
        userId: quote().userId,
      }),
    ).resolves.toBeNull();
  });
});
