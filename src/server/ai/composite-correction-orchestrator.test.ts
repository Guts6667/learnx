import { describe, expect, it, vi } from 'vitest';

import type { StoredPricingQuote } from '../pricing/ai-pricing.js';
import {
  CompositeOrchestrationError,
  createCompositeOrchestrationFingerprint,
  orchestrateCompositeCorrection,
  sumProviderCostsUsd,
  type CompositeExecutionOutcome,
} from './composite-correction-orchestrator.js';

function quote(overrides: Partial<StoredPricingQuote> = {}): StoredPricingQuote {
  return {
    action: 'STANDARD',
    catalogVersionId: 'catalog-id',
    ceilingCredits: 100n,
    costDimensionsSnapshot: { conversionVersion: '1.0.0' },
    contractKey: 'exercise.v1',
    contractVersion: '1.0.0',
    createdAt: new Date('2026-08-13T08:00:00.000Z'),
    estimatedCredits: 60n,
    expiresAt: new Date('2026-08-13T09:00:00.000Z'),
    feeCredits: 2n,
    floorCredits: 1n,
    id: 'quote-id',
    includesAutomaticSecondPass: false,
    includesTargetedVerification: true,
    inputSizeClass: 'SHORT',
    language: 'fr-FR',
    modelId: 'composite',
    pipelineIdentitySnapshot: { fingerprint: 'pipeline-fingerprint' },
    pipelineVersionId: 'pipeline-version-id',
    promptVersion: 'composite',
    requestFingerprint: 'quote-fingerprint',
    target: { id: 'submission-id', kind: 'EXERCISE_SUBMISSION' },
    targetMarginCredits: 3n,
    userId: 'user-id',
    workflowKind: 'COMPOSITE',
    ...overrides,
  };
}

function outcome(
  overrides: Partial<CompositeExecutionOutcome> = {},
): CompositeExecutionOutcome {
  return {
    calls: [
      {
        actualCostUsd: '0.10',
        attemptNumber: 1,
        providerRequestId: 'primary-request',
        role: 'PRIMARY',
        terminalValidated: true,
        usefulToPublishedResult: true,
        wasRetry: false,
      },
    ],
    resultState: 'COMPLETED',
    ...overrides,
  };
}

function primaryCall() {
  return outcome().calls[0] ?? (() => {
    throw new Error('PRIMARY_CALL_FIXTURE_MISSING');
  })();
}

function setup(options: {
  accepted?: {
    financialState:
      | 'PENDING'
      | 'READY_TO_SETTLE'
      | 'RECONCILIATION_REQUIRED'
      | 'RELEASED'
      | 'SETTLED';
    pendingFinalization?: {
      resultState: 'COMPLETED' | 'PROVISIONAL' | 'UNCERTAIN' | 'UNUSABLE_RELEASED';
      settlement: {
        absorbedCeilingOverrunCredits: bigint;
        absorbedProviderCostCredits: bigint;
        billableProviderCostCredits: bigint;
        providerCostCredits: bigint;
        releasedCredits: bigint;
        settledCredits: bigint;
      };
    };
  };
  executionOutcome?: CompositeExecutionOutcome;
} = {}) {
  const guards = {
    assertProviderCallAllowed: vi.fn().mockResolvedValue(undefined),
    validateQuote: vi.fn().mockResolvedValue(quote()),
  };
  const reservation = {
    activateLease: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
    reserve: vi.fn().mockResolvedValue({
      allocationSnapshot: [{ amount: '100', lotId: 'lot-id', position: 1 }],
      reservationId: 'reservation-id',
    }),
    settle: vi.fn().mockResolvedValue(undefined),
  };
  const repository = {
    claim: vi.fn().mockResolvedValue(true),
    completeReleased: vi.fn().mockResolvedValue(undefined),
    completeSettled: vi.fn().mockResolvedValue(undefined),
    markReconciliationRequired: vi.fn().mockResolvedValue(undefined),
    prepareFinancialFinalization: vi.fn().mockResolvedValue(undefined),
    prepare: vi.fn().mockResolvedValue({
      correctionId: 'correction-id',
      financialState: options.accepted?.financialState ?? 'PENDING',
      pendingFinalization: options.accepted?.pendingFinalization ?? null,
      reservationId: 'reservation-id',
      terminalResult: null,
    }),
  };
  const execution = {
    execute: vi.fn().mockImplementation(async ({ beforeRole }) => {
      const selected = options.executionOutcome ?? outcome();
      await beforeRole('PRIMARY');
      if (selected.calls.some((call) => call.role === 'TARGETED_VERIFIER')) {
        await beforeRole('TARGETED_VERIFIER');
      }
      return selected;
    }),
  };
  return { execution, guards, repository, reservation };
}

function run(
  dependencies: ReturnType<typeof setup>,
  overrides: Partial<Parameters<typeof orchestrateCompositeCorrection>[0]> = {},
) {
  return orchestrateCompositeCorrection({
    clock: () => new Date('2026-08-13T08:05:00.000Z'),
    costConversion: {
      summedActualUsdToCredits: ({ actualCostsUsd }) =>
        BigInt(
          Math.round(
            actualCostsUsd.reduce((sum, value) => sum + Number(value), 0) * 100,
          ),
        ),
    },
    execution: dependencies.execution,
    executionLeaseMs: 60_000,
    guards: dependencies.guards,
    idempotencyKey: 'correction:operation:1',
    quoteId: 'quote-id',
    repository: dependencies.repository,
    reservation: dependencies.reservation,
    userId: 'user-id',
    workerId: 'worker-id',
    ...overrides,
  });
}

describe('composite correction orchestration', () => {
  it('never calls a provider before a valid quote and reservation', async () => {
    const dependencies = setup();
    dependencies.guards.validateQuote.mockRejectedValueOnce(
      new Error('QUOTE_EXPIRED'),
    );
    await expect(run(dependencies)).rejects.toThrow('QUOTE_EXPIRED');
    expect(dependencies.reservation.reserve).not.toHaveBeenCalled();
    expect(dependencies.execution.execute).not.toHaveBeenCalled();
  });

  it('settles primary and verifier as one visible operation', async () => {
    const dependencies = setup({
      executionOutcome: outcome({
        calls: [
          primaryCall(),
          {
            actualCostUsd: '0.20',
            attemptNumber: 1,
            providerRequestId: 'verifier-request',
            role: 'TARGETED_VERIFIER',
            terminalValidated: true,
            usefulToPublishedResult: true,
            wasRetry: false,
          },
        ],
      }),
    });
    const result = await run(dependencies);
    expect(result).toMatchObject({
      financialState: 'SETTLED',
      terminalResult: 'COMPLETED',
    });
    expect(dependencies.reservation.reserve).toHaveBeenCalledOnce();
    expect(dependencies.reservation.settle).toHaveBeenCalledWith({
      amount: 35n,
      reservationId: 'reservation-id',
      userId: 'user-id',
    });
    expect(dependencies.guards.assertProviderCallAllowed).toHaveBeenCalledTimes(2);
  });

  it('absorbs retries and never charges more than the accepted ceiling', async () => {
    const dependencies = setup({
      executionOutcome: outcome({
        calls: [
          {
            actualCostUsd: '0.90',
            attemptNumber: 1,
            providerRequestId: 'retry-request',
            role: 'PRIMARY',
            terminalValidated: false,
            usefulToPublishedResult: false,
            wasRetry: true,
          },
          {
            actualCostUsd: '1.50',
            attemptNumber: 2,
            providerRequestId: 'valid-request',
            role: 'PRIMARY',
            terminalValidated: true,
            usefulToPublishedResult: true,
            wasRetry: false,
          },
        ],
      }),
    });
    await run(dependencies);
    expect(dependencies.reservation.settle).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 100n }),
    );
    expect(dependencies.repository.completeSettled).toHaveBeenCalledWith(
      expect.objectContaining({
        settlement: expect.objectContaining({
          absorbedCeilingOverrunCredits: 55n,
          absorbedProviderCostCredits: 90n,
          settledCredits: 100n,
        }),
      }),
    );
    expect(
      dependencies.repository.prepareFinancialFinalization,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        absorbedProviderCostUsd: '0.9',
        billableProviderCostUsd: '1.5',
        providerCostUsd: '2.4',
      }),
    );
  });

  it('releases the full reservation before an unusable terminal state', async () => {
    const dependencies = setup({
      executionOutcome: outcome({
        calls: [
          {
            ...primaryCall(),
            terminalValidated: false,
            usefulToPublishedResult: false,
          },
        ],
        resultState: 'UNUSABLE_RELEASED',
      }),
    });
    const result = await run(dependencies);
    expect(result.financialState).toBe('RELEASED');
    expect(dependencies.reservation.release).toHaveBeenCalledBefore(
      dependencies.repository.completeReleased,
    );
    expect(dependencies.reservation.settle).not.toHaveBeenCalled();
  });

  it('requires reconciliation when a dispatched call has no actual cost', async () => {
    const dependencies = setup({
      executionOutcome: outcome({
        calls: [{ ...primaryCall(), actualCostUsd: null }],
      }),
    });
    const result = await run(dependencies);
    expect(result.financialState).toBe('RECONCILIATION_REQUIRED');
    expect(dependencies.repository.markReconciliationRequired).toHaveBeenCalledOnce();
    expect(dependencies.reservation.settle).not.toHaveBeenCalled();
    expect(dependencies.reservation.release).not.toHaveBeenCalled();
  });

  it('does not duplicate provider or ledger effects when replaying a terminal operation', async () => {
    const dependencies = setup({ accepted: { financialState: 'SETTLED' } });
    const result = await run(dependencies);
    expect(result.financialState).toBe('SETTLED');
    expect(dependencies.repository.claim).not.toHaveBeenCalled();
    expect(dependencies.execution.execute).not.toHaveBeenCalled();
    expect(dependencies.reservation.settle).not.toHaveBeenCalled();
  });

  it('finishes a prepared settlement after a crash without calling the provider again', async () => {
    const dependencies = setup({
      accepted: {
        financialState: 'READY_TO_SETTLE',
        pendingFinalization: {
          resultState: 'COMPLETED',
          settlement: {
            absorbedCeilingOverrunCredits: 0n,
            absorbedProviderCostCredits: 0n,
            billableProviderCostCredits: 30n,
            providerCostCredits: 30n,
            releasedCredits: 70n,
            settledCredits: 30n,
          },
        },
      },
    });
    const result = await run(dependencies);
    expect(result.financialState).toBe('SETTLED');
    expect(dependencies.execution.execute).not.toHaveBeenCalled();
    expect(dependencies.reservation.settle).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 30n }),
    );
    expect(dependencies.repository.completeSettled).toHaveBeenCalledOnce();
  });

  it('does not redispatch a provider call while cost reconciliation is required', async () => {
    const dependencies = setup({
      accepted: { financialState: 'RECONCILIATION_REQUIRED' },
    });
    const result = await run(dependencies);
    expect(result.financialState).toBe('RECONCILIATION_REQUIRED');
    expect(dependencies.repository.claim).not.toHaveBeenCalled();
    expect(dependencies.execution.execute).not.toHaveBeenCalled();
  });

  it('rejects a concurrent worker while the operation lease is active', async () => {
    const dependencies = setup();
    dependencies.repository.claim.mockResolvedValueOnce(false);
    await expect(run(dependencies)).rejects.toEqual(
      new CompositeOrchestrationError('CORRECTION_ALREADY_CLAIMED'),
    );
    expect(dependencies.execution.execute).not.toHaveBeenCalled();
  });

  it('fingerprints the complete accepted operation deterministically', () => {
    const left = createCompositeOrchestrationFingerprint({
      quote: { id: 'quote', pipeline: { version: '1.0.0' } },
      userId: 'user',
    });
    const right = createCompositeOrchestrationFingerprint({
      userId: 'user',
      quote: { pipeline: { version: '1.0.0' }, id: 'quote' },
    });
    expect(left).toBe(right);
    expect(left).not.toBe(
      createCompositeOrchestrationFingerprint({
        quote: { id: 'quote', pipeline: { version: '1.0.1' } },
        userId: 'user',
      }),
    );
  });

  it('adds persisted provider costs exactly without floating-point arithmetic', () => {
    expect(sumProviderCostsUsd(['0.1', '0.2', '1.00000001'])).toBe('1.30000001');
    expect(sumProviderCostsUsd([])).toBe('0');
    expect(() => sumProviderCostsUsd(['NaN'])).toThrow('PROVIDER_COST_INVALID');
  });
});
