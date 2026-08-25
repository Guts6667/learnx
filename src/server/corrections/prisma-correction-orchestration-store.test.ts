import { describe, expect, it, vi } from 'vitest';

import type {
  AcceptedQuoteSnapshot,
  OrchestratedCorrectionResult,
} from './correction-orchestration';
import { PrismaCorrectionOrchestrationPorts } from './prisma-correction-orchestration-store';

type CapturedCreateInput = {
  data: Record<string, unknown> & {
    attempts: { create: Array<Record<string, unknown>> };
  };
};

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
      const create = vi.fn(async (input: CapturedCreateInput) => {
        void input;
        return { id: 'correction-1' };
      });
      const ports = new PrismaCorrectionOrchestrationPorts({
        aiCorrection: { create },
      } as never);

      await ports.corrections.persist({
        attempts: [],
        quote: quote(),
        reservationId: '49dbe27b-00a8-4f9a-ba5e-e8530e820e47',
        result: result(runtimeStatus),
        userId: quote().userId,
      });

      const [call] = create.mock.calls;
      expect(call).toBeDefined();
      if (!call) throw new Error('AI_CORRECTION_CREATE_NOT_CALLED');
      const data = call[0].data;
      expect(data).toMatchObject({
        indicativeScore: runtimeStatus === 'COMPLETED' ? 92 : null,
        pipelineKind: 'SINGLE_MODEL',
        status: databaseStatus,
      });
      expect(data).not.toHaveProperty('confidence');
      expect(data).not.toHaveProperty('decision');
      expect(data).not.toHaveProperty('score');
    },
  );

  it('separates validated structured output from a rejected raw output', async () => {
    const create = vi.fn(async (input: CapturedCreateInput) => {
      void input;
      return { id: 'correction-1' };
    });
    const ports = new PrismaCorrectionOrchestrationPorts({
      aiCorrection: { create },
    } as never);

    await ports.corrections.persist({
      attempts: [
        {
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
        {
          errorCode: 'MODEL_OUTPUT_INVALID',
          output: { invalid: true },
          sequence: 2,
          status: 'FAILED',
        },
      ],
      quote: quote(),
      reservationId: '49dbe27b-00a8-4f9a-ba5e-e8530e820e47',
      result: result('COMPLETED'),
      userId: quote().userId,
    });

    const [call] = create.mock.calls;
    expect(call).toBeDefined();
    if (!call) throw new Error('AI_CORRECTION_CREATE_NOT_CALLED');
    const data = call[0].data;
    expect(data.attempts.create[0]).toMatchObject({
      costSource: 'ACTUAL',
      dispatchStatus: 'CONFIRMED',
      rawOutput: undefined,
      structuredResult: { valid: true },
    });
    expect(data.attempts.create[1]).toMatchObject({
      rawOutput: { invalid: true },
      structuredResult: undefined,
    });
  });
});
