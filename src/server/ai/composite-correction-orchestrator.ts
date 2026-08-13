import { createHash } from 'node:crypto';

import {
  calculateCompositeSettlement,
  type CompositeSettlementPreview,
  type StoredPricingQuote,
} from '../pricing/ai-pricing.js';
import type { CompositePipelineState, CompositeRole } from './composite-correction.js';

export type CorrectionFinancialState =
  | 'PENDING'
  | 'READY_TO_SETTLE'
  | 'RECONCILIATION_REQUIRED'
  | 'RELEASED'
  | 'SETTLED';

export type ProviderCallTransportState =
  | 'CALL_INTENT'
  | 'SENT'
  | 'CONFIRMED'
  | 'ORPHANED';

export type ProviderCallOutcomeTransportState = Exclude<
  ProviderCallTransportState,
  'CALL_INTENT'
>;

export interface OrchestratedProviderCall {
  actualCostUsd: string | null;
  attemptNumber: number;
  dispatchStatus: ProviderCallOutcomeTransportState;
  providerIdempotencyKey: string;
  providerRequestId: string | null;
  role: CompositeRole;
  terminalValidated: boolean;
  usefulToPublishedResult: boolean;
  wasRetry: boolean;
}

export interface CompositeExecutionOutcome {
  calls: readonly OrchestratedProviderCall[];
  resultState: CompositePipelineState;
}

export interface AcceptedCorrectionOperation {
  correctionId: string;
  financialState: CorrectionFinancialState;
  pendingFinalization: {
    resultState: CompositePipelineState;
    settlement: CompositeSettlementPreview;
  } | null;
  reservationId: string;
  terminalResult: CompositePipelineState | null;
}

export interface CompositeOrchestrationGuards {
  assertProviderCallAllowed(input: {
    correctionId: string;
    role: CompositeRole;
    userId: string;
  }): Promise<void>;
  validateQuote(input: {
    quoteId: string;
    userId: string;
  }): Promise<StoredPricingQuote>;
}

export interface CompositeReservationPort {
  activateLease(input: {
    expiresAt: Date;
    reservationId: string;
    userId: string;
  }): Promise<void>;
  release(input: { reservationId: string; userId: string }): Promise<void>;
  reserve(input: {
    ceilingCredits: bigint;
    expiresAt: Date;
    fingerprint: string;
    idempotencyKey: string;
    quoteId: string;
    userId: string;
  }): Promise<{ allocationSnapshot: unknown; reservationId: string }>;
  settle(input: {
    amount: bigint;
    reservationId: string;
    userId: string;
  }): Promise<void>;
}

export interface CompositeCorrectionOperationRepository {
  claim(input: {
    correctionId: string;
    leaseExpiresAt: Date;
    workerId: string;
  }): Promise<boolean>;
  completeReleased(input: {
    correctionId: string;
    resultState: 'UNUSABLE_RELEASED';
    settlement: CompositeSettlementPreview;
  }): Promise<void>;
  completeSettled(input: {
    correctionId: string;
    resultState: Exclude<CompositePipelineState, 'UNUSABLE_RELEASED'>;
    settlement: CompositeSettlementPreview;
  }): Promise<void>;
  markProviderCallSent(input: {
    correctionId: string;
    providerIdempotencyKey: string;
  }): Promise<void>;
  reconcileUnresolvedProviderCosts(input: {
    correctionId: string;
  }): Promise<boolean>;
  recordProviderCallIntent(input: {
    attemptNumber: number;
    correctionId: string;
    providerIdempotencyKey: string;
    role: CompositeRole;
  }): Promise<void>;
  recordProviderCallOutcomes(input: {
    calls: readonly OrchestratedProviderCall[];
    correctionId: string;
  }): Promise<void>;
  prepareFinancialFinalization(input: {
    absorbedProviderCostUsd: string;
    billableProviderCostUsd: string;
    correctionId: string;
    providerCostUsd: string;
    resultState: CompositePipelineState;
    settlement: CompositeSettlementPreview;
  }): Promise<void>;
  prepare(input: {
    allocationSnapshot: unknown;
    fingerprint: string;
    idempotencyKey: string;
    quote: StoredPricingQuote;
    reservationId: string;
    userId: string;
  }): Promise<AcceptedCorrectionOperation>;
}

export interface CompositeCorrectionExecutionPort {
  execute(input: {
    beforeCall: (input: {
      attemptNumber: number;
      role: CompositeRole;
    }) => Promise<{ providerIdempotencyKey: string }>;
    correctionId: string;
    markCallSent: (input: { providerIdempotencyKey: string }) => Promise<void>;
  }): Promise<CompositeExecutionOutcome>;
}

export interface CompositeCostConversionPort {
  summedActualUsdToCredits(input: {
    actualCostsUsd: readonly string[];
    quote: StoredPricingQuote;
  }): bigint;
}

export interface OrchestrateCompositeCorrectionInput {
  clock?: () => Date;
  costConversion: CompositeCostConversionPort;
  execution: CompositeCorrectionExecutionPort;
  executionLeaseMs: number;
  guards: CompositeOrchestrationGuards;
  idempotencyKey: string;
  quoteId: string;
  repository: CompositeCorrectionOperationRepository;
  reservation: CompositeReservationPort;
  userId: string;
  workerId: string;
}

export class CompositeOrchestrationError extends Error {
  public constructor(
    public readonly code:
      | 'CORRECTION_ALREADY_CLAIMED'
      | 'INVALID_EXECUTION_LEASE'
      | 'QUOTE_NOT_COMPOSITE'
      | 'QUOTE_TARGETED_VERIFICATION_MISSING',
  ) {
    super(code);
    this.name = 'CompositeOrchestrationError';
  }
}

function canonicalize(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
}

export function createCompositeOrchestrationFingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

export function createProviderCallIdempotencyKey(input: {
  attemptNumber: number;
  correctionId: string;
  role: CompositeRole;
}): string {
  return `learnx-ai-${createCompositeOrchestrationFingerprint(input)}`;
}

function assertCompositeQuote(quote: StoredPricingQuote): void {
  if (quote.workflowKind !== 'COMPOSITE') {
    throw new CompositeOrchestrationError('QUOTE_NOT_COMPOSITE');
  }
  if (
    !quote.includesTargetedVerification ||
    quote.pipelineIdentitySnapshot === null ||
    quote.costDimensionsSnapshot === null
  ) {
    throw new CompositeOrchestrationError(
      'QUOTE_TARGETED_VERIFICATION_MISSING',
    );
  }
}

function isUsableResult(
  state: CompositePipelineState,
): state is Exclude<CompositePipelineState, 'UNUSABLE_RELEASED'> {
  return state !== 'UNUSABLE_RELEASED';
}

export function sumProviderCostsUsd(values: readonly string[]): string {
  if (values.length === 0) return '0';
  const parsed = values.map((value) => {
    const match = /^(\d+)(?:\.(\d{1,8}))?$/.exec(value);
    if (!match) throw new Error('PROVIDER_COST_INVALID');
    return { fraction: match[2] ?? '', whole: match[1] ?? '0' };
  });
  const scale = Math.max(...parsed.map((value) => value.fraction.length));
  const total = parsed.reduce(
    (sum, value) =>
      sum +
      BigInt(
        `${value.whole}${value.fraction.padEnd(scale, '0')}`,
      ),
    0n,
  );
  if (scale === 0) return total.toString();
  const digits = total.toString().padStart(scale + 1, '0');
  const normalized = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`
    .replace(/0+$/, '')
    .replace(/\.$/, '');
  return normalized;
}

async function finalizePreparedOperation(input: {
  operation: AcceptedCorrectionOperation;
  repository: CompositeCorrectionOperationRepository;
  reservation: CompositeReservationPort;
  userId: string;
}): Promise<AcceptedCorrectionOperation> {
  const pending = input.operation.pendingFinalization;
  if (!pending) throw new Error('COMPOSITE_FINALIZATION_SNAPSHOT_MISSING');
  if (!isUsableResult(pending.resultState)) {
    await input.reservation.release({
      reservationId: input.operation.reservationId,
      userId: input.userId,
    });
    await input.repository.completeReleased({
      correctionId: input.operation.correctionId,
      resultState: 'UNUSABLE_RELEASED',
      settlement: pending.settlement,
    });
    return {
      ...input.operation,
      financialState: 'RELEASED',
      terminalResult: 'UNUSABLE_RELEASED',
    };
  }
  await input.reservation.settle({
    amount: pending.settlement.settledCredits,
    reservationId: input.operation.reservationId,
    userId: input.userId,
  });
  await input.repository.completeSettled({
    correctionId: input.operation.correctionId,
    resultState: pending.resultState,
    settlement: pending.settlement,
  });
  return {
    ...input.operation,
    financialState: 'SETTLED',
    terminalResult: pending.resultState,
  };
}

export async function orchestrateCompositeCorrection(
  input: OrchestrateCompositeCorrectionInput,
): Promise<AcceptedCorrectionOperation> {
  if (!Number.isSafeInteger(input.executionLeaseMs) || input.executionLeaseMs <= 0) {
    throw new CompositeOrchestrationError('INVALID_EXECUTION_LEASE');
  }
  const clock = input.clock ?? (() => new Date());
  const quote = await input.guards.validateQuote({
    quoteId: input.quoteId,
    userId: input.userId,
  });
  assertCompositeQuote(quote);
  const fingerprint = createCompositeOrchestrationFingerprint({
    idempotencyKey: input.idempotencyKey,
    pipelineIdentitySnapshot: quote.pipelineIdentitySnapshot,
    quoteId: quote.id,
    quoteRequestFingerprint: quote.requestFingerprint,
    target: quote.target,
    userId: input.userId,
  });
  const reserved = await input.reservation.reserve({
    ceilingCredits: quote.ceilingCredits,
    expiresAt: quote.expiresAt,
    fingerprint,
    idempotencyKey: input.idempotencyKey,
    quoteId: quote.id,
    userId: input.userId,
  });
  const operation = await input.repository.prepare({
    allocationSnapshot: reserved.allocationSnapshot,
    fingerprint,
    idempotencyKey: input.idempotencyKey,
    quote,
    reservationId: reserved.reservationId,
    userId: input.userId,
  });
  if (operation.financialState === 'SETTLED' || operation.financialState === 'RELEASED') {
    return operation;
  }
  if (operation.financialState === 'RECONCILIATION_REQUIRED') return operation;
  if (
    await input.repository.reconcileUnresolvedProviderCosts({
      correctionId: operation.correctionId,
    })
  ) {
    return {
      ...operation,
      financialState: 'RECONCILIATION_REQUIRED',
    };
  }
  if (operation.financialState === 'READY_TO_SETTLE') {
    return finalizePreparedOperation({
      operation,
      repository: input.repository,
      reservation: input.reservation,
      userId: input.userId,
    });
  }
  const leaseExpiresAt = new Date(clock().getTime() + input.executionLeaseMs);
  if (
    !(await input.repository.claim({
      correctionId: operation.correctionId,
      leaseExpiresAt,
      workerId: input.workerId,
    }))
  ) {
    throw new CompositeOrchestrationError('CORRECTION_ALREADY_CLAIMED');
  }
  await input.reservation.activateLease({
    expiresAt: leaseExpiresAt,
    reservationId: operation.reservationId,
    userId: input.userId,
  });
  let outcome: CompositeExecutionOutcome;
  try {
    outcome = await input.execution.execute({
      beforeCall: async ({ attemptNumber, role }) => {
        await input.guards.assertProviderCallAllowed({
          correctionId: operation.correctionId,
          role,
          userId: input.userId,
        });
        const providerIdempotencyKey = createProviderCallIdempotencyKey({
          attemptNumber,
          correctionId: operation.correctionId,
          role,
        });
        await input.repository.recordProviderCallIntent({
          attemptNumber,
          correctionId: operation.correctionId,
          providerIdempotencyKey,
          role,
        });
        return { providerIdempotencyKey };
      },
      correctionId: operation.correctionId,
      markCallSent: async ({ providerIdempotencyKey }) =>
        input.repository.markProviderCallSent({
          correctionId: operation.correctionId,
          providerIdempotencyKey,
        }),
    });
  } catch (error) {
    if (
      await input.repository.reconcileUnresolvedProviderCosts({
        correctionId: operation.correctionId,
      })
    ) {
      return {
        ...operation,
        financialState: 'RECONCILIATION_REQUIRED',
      };
    }
    throw error;
  }
  await input.repository.recordProviderCallOutcomes({
    calls: outcome.calls,
    correctionId: operation.correctionId,
  });
  if (
    await input.repository.reconcileUnresolvedProviderCosts({
      correctionId: operation.correctionId,
    })
  ) {
    return {
      ...operation,
      financialState: 'RECONCILIATION_REQUIRED',
    };
  }
  const billableUsd = outcome.calls.flatMap((call) =>
    call.actualCostUsd !== null &&
    call.terminalValidated &&
    call.usefulToPublishedResult &&
    !call.wasRetry
      ? [call.actualCostUsd]
      : [],
  );
  const absorbedUsd = outcome.calls.flatMap((call) =>
    call.actualCostUsd !== null &&
    (!call.terminalValidated || !call.usefulToPublishedResult || call.wasRetry)
      ? [call.actualCostUsd]
      : [],
  );
  const calls = [
    {
      costCredits: input.costConversion.summedActualUsdToCredits({
        actualCostsUsd: billableUsd,
        quote,
      }),
      role: 'PRIMARY' as const,
      terminalValidated: true,
      usefulToPublishedResult: true,
      wasRetry: false,
    },
    {
      costCredits: input.costConversion.summedActualUsdToCredits({
        actualCostsUsd: absorbedUsd,
        quote,
      }),
      role: 'PRIMARY' as const,
      terminalValidated: false,
      usefulToPublishedResult: false,
      wasRetry: true,
    },
  ];
  const settlement = calculateCompositeSettlement({
    calls,
    ceilingCredits: quote.ceilingCredits,
    feeCredits: quote.feeCredits,
    floorCredits: quote.floorCredits,
    targetMarginCredits: quote.targetMarginCredits,
    usableResult: isUsableResult(outcome.resultState),
  });
  await input.repository.prepareFinancialFinalization({
    absorbedProviderCostUsd: sumProviderCostsUsd(absorbedUsd),
    billableProviderCostUsd: sumProviderCostsUsd(billableUsd),
    correctionId: operation.correctionId,
    providerCostUsd: sumProviderCostsUsd([...billableUsd, ...absorbedUsd]),
    resultState: outcome.resultState,
    settlement,
  });
  return finalizePreparedOperation({
    operation: {
      ...operation,
      financialState: 'READY_TO_SETTLE',
      pendingFinalization: { resultState: outcome.resultState, settlement },
    },
    repository: input.repository,
    reservation: input.reservation,
    userId: input.userId,
  });
}
