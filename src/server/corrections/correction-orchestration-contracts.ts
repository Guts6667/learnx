import type { CorrectionMonitoringSignal } from './correction-monitoring.js';

export type CorrectionOrchestrationErrorCode =
  | 'QUOTE_NOT_FOUND'
  | 'QUOTE_NOT_ACTIVE'
  | 'QUOTE_EXPIRED'
  | 'QUOTE_ALREADY_CONSUMED'
  | 'FINANCIAL_RECONCILIATION_REQUIRED'
  | 'QUOTE_INCOMPATIBLE'
  | 'INSUFFICIENT_CREDITS';

export class CorrectionOrchestrationError extends Error {
  public constructor(public readonly code: CorrectionOrchestrationErrorCode) {
    super(code);
    this.name = 'CorrectionOrchestrationError';
  }
}

export interface AcceptedQuoteSnapshot {
  action?: 'STANDARD' | 'RECONSIDERATION';
  quoteId: string;
  userId: string;
  target: {
    id: string;
    kind: 'EXERCISE_SUBMISSION' | 'STAGE_ASSESSMENT_SUBMISSION';
  };
  language: string;
  estimatedCredits: bigint;
  maximumReservedCredits: bigint;
  expiresAt: Date;
  promptVersion: string;
  modelId: string;
  provider: string;
  includesAutomaticSecondPass: boolean;
  contractKey: string;
  contractVersion: string;
  requestFingerprint: string;
  reconsideration?: {
    argument: string;
    previousCorrection: OrchestratedCorrectionResult['correction'];
    sourceCorrectionId: string;
  };
  submissionText: string;
  exerciseInstructions: string;
  taskContext: string | null;
  contract: unknown;
}

export interface CreditSettlementPort {
  reserve(input: {
    amount: bigint;
    expiresAt: Date;
    idempotencyKey: string;
    reference: { id: string; type: string };
    userId: string;
  }): Promise<{ reservationId: string }>;
  settle(input: {
    amount: bigint;
    reservationId: string;
    userId: string;
  }): Promise<void>;
  release(input: { reservationId: string; userId: string }): Promise<void>;
}

export interface CorrectionTransportPort {
  execute(input: {
    apiKey: string;
    jsonSchema: Record<string, unknown>;
    messages: Array<{ content: string; role: 'system' | 'user' }>;
    modelId: string;
  }): Promise<{
    latencyMs: number;
    modelSnapshot: string;
    output: unknown;
    providerRequestId?: string;
    providerRoute: string;
    usage: {
      actualCostUsd?: number;
      inputTokens: number;
      reasoningTokens: number;
      visibleOutputTokens: number;
    };
  }>;
}

export interface RuntimeCorrectionAttempt {
  actualCostUsd?: number;
  errorCode?: string;
  inputTokens?: number;
  latencyMs?: number;
  modelSnapshot?: string;
  output?: unknown;
  providerRequestId?: string;
  providerRoute?: string;
  reasoningTokens?: number;
  sequence: number;
  status: 'FAILED' | 'SUCCEEDED';
  visibleOutputTokens?: number;
}

export type PersistedCorrectionLookup =
  | { state: 'READY'; result: OrchestratedCorrectionResult }
  | {
      state: 'READY_TO_SETTLE';
      reservationId: string;
      result: OrchestratedCorrectionResult;
    }
  | { state: 'IN_PROGRESS' }
  | { state: 'RECONCILIATION_REQUIRED' };

export interface CorrectionPersistencePort {
  begin(input: {
    reservationId: string;
    userId: string;
    quote: AcceptedQuoteSnapshot;
  }): Promise<{ correctionId: string; created: boolean }>;
  finalize(input: {
    correctionId: string;
    quote: AcceptedQuoteSnapshot;
    result: OrchestratedCorrectionResult['correction'];
  }): Promise<void>;
  findByQuote(input: {
    userId: string;
    requestFingerprint: string;
  }): Promise<PersistedCorrectionLookup | null>;
  markReconciliationRequired(input: { correctionId: string }): Promise<void>;
  recordAttemptIntent(input: {
    correctionId: string;
    sequence: number;
  }): Promise<void>;
  recordAttemptOutcome(input: {
    attempt: RuntimeCorrectionAttempt;
    correctionId: string;
  }): Promise<void>;
}

export interface OrchestratedCorrectionResult {
  correction: {
    id: string;
    status: 'COMPLETED' | 'COMPLETED_PARTIAL' | 'FAILED';
    criteria: Array<{
      key: string;
      label: string;
      weight: number;
      levelKey: string;
      levelLabel: string;
      evidenceStatus: 'FOUND' | 'NO_RELEVANT_EVIDENCE';
      evidenceQuotes: string[];
      feedback: string;
    }>;
    unsureCriteria: string[];
    unsureCriterionDetails: Array<{ key: string; label: string }>;
    overallFeedback: string | null;
    indicativeScore: number | null;
    secondPassRequired: boolean;
    modelUsageCostUsd: number | null;
    monitoringSignals: CorrectionMonitoringSignal[];
  };
  settlement: {
    reservedCredits: string;
    settledCredits: string;
    releasedCredits: string;
  };
  replay: boolean;
}

export interface CorrectionHistoryEntry {
  action?: 'STANDARD' | 'RECONSIDERATION';
  createdAt: Date;
  sourceCorrectionId?: string | null;
  result: OrchestratedCorrectionResult;
}

export interface AcceptedQuotePort {
  loadAcceptedQuote(input: {
    quoteId: string;
    userId: string;
    now: Date;
  }): Promise<AcceptedQuoteSnapshot | null>;
  markConsumed(input: { quoteId: string }): Promise<void>;
}
