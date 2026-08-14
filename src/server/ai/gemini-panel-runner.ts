import { createHash } from 'node:crypto';

import {
  findBenchmarkContract,
  type CorrectionBenchmarkConfiguration,
  type CorrectionBenchmarkCorpus,
} from '../../lib/ai-correction-benchmark.js';
import type { Protocol3CorrectionArtifactOutput } from '../../lib/ai-correction-contracts.js';

import type {
  CompositePanelProviderPort,
  CompositePanelProviderResult,
} from './composite-panel-runner';
import {
  assertGeminiPanelCallAllowed,
  geminiPanelFingerprint,
  type GeminiPanelManifest,
} from './gemini-panel-validation';
import {
  createDeterministicSafetyEnvelope,
  validateDeterministicSafetyOutput,
} from './gemini-safety-envelope';

export interface GeminiPanelAttempt extends CompositePanelProviderResult {
  attempt: number;
  budgetRemainingAfterUsd: number;
  budgetRemainingBeforeUsd: number;
  caseId: string;
  cellKey: string;
  idempotencyKey: string;
  repetition: number;
  riskSignals: readonly string[];
  upstreamErrorCode?: string;
  worstCaseAuthorizedUsd: number;
}

export interface GeminiPanelLedgerEvent {
  attempt: number;
  caseId: string;
  cellKey: string;
  costUsd?: number;
  event: 'CALL_INTENT' | 'CALL_OUTCOME' | 'CALL_RECONCILED';
  idempotencyKey: string;
  previousHash: string | null;
  recordHash: string;
  repetition: number;
  status?: CompositePanelProviderResult['status'];
  worstCaseAuthorizedUsd: number;
}

export interface GeminiPanelState {
  attempts: GeminiPanelAttempt[];
  cells: Array<{
    caseId: string;
    output: Protocol3CorrectionArtifactOutput;
    repetition: number;
    riskSignals: readonly string[];
  }>;
  createdAt: string;
  manifestFingerprint: string;
  schemaVersion: 1;
  stoppedReason: string | null;
  updatedAt: string;
}

export interface GeminiPanelRunResult {
  blindReview: unknown;
  blindReviewMapping: unknown;
  ledger: GeminiPanelLedgerEvent[];
  state: GeminiPanelState;
}

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

function actualCost(attempts: readonly GeminiPanelAttempt[]): number {
  return attempts.reduce(
    (total, attempt) => total + (attempt.usage?.actualCostUsd ?? 0),
    0,
  );
}

function estimateWorstCase(input: {
  candidate: CorrectionBenchmarkConfiguration['candidates'][number];
  manifest: GeminiPanelManifest;
  messages: readonly { content: string }[];
}): number {
  const inputTokens = Math.ceil(
    input.messages.reduce((sum, message) => sum + message.content.length, 0) / 3,
  );
  return (
    inputTokens * input.manifest.budget.promptUsdPerToken +
    input.candidate.requestProfile.totalOutputTokenLimit *
      input.manifest.budget.completionUsdPerToken
  );
}

function createArtifacts(input: {
  corpus: CorrectionBenchmarkCorpus;
  manifest: GeminiPanelManifest;
  state: GeminiPanelState;
}) {
  const fingerprint = input.state.manifestFingerprint;
  const entries = input.state.cells
    .map((cell) => {
      const benchmarkCase = input.corpus.cases.find(
        (entry) => entry.caseId === cell.caseId,
      );
      if (!benchmarkCase) throw new Error('GEMINI_PANEL_CASE_NOT_FOUND');
      const contract = findBenchmarkContract(
        input.corpus,
        benchmarkCase.contractKey,
        benchmarkCase.contractVersion,
      );
      const reviewId = `review-${sha256(`${fingerprint}:${cell.caseId}:${cell.repetition}`).slice(0, 16)}`;
      return {
        mapping: { caseId: cell.caseId, repetition: cell.repetition, reviewId },
        review: {
          contract: {
            contractKey: contract.contractKey,
            criteria: contract.criteria,
            version: contract.version,
          },
          output: cell.output,
          rejectedOutputs: input.state.attempts
            .filter(
              (attempt) =>
                attempt.cellKey === `${cell.caseId}:${cell.repetition}` &&
                attempt.status === 'INVALID',
            )
            .map((attempt) => ({
              output: attempt.output ?? attempt.rawModelOutput ?? null,
              status: 'REJECTED',
            })),
          responseText: benchmarkCase.responseText,
          reviewId,
          taskContext: benchmarkCase.taskContext,
          taskPrompt: benchmarkCase.taskPrompt,
        },
      };
    })
    .toSorted((left, right) => left.review.reviewId.localeCompare(right.review.reviewId));
  return {
    blindReview: {
      entries: entries.map((entry) => entry.review),
      manifestFingerprint: fingerprint,
      phase: 1,
      schemaVersion: 1,
    },
    blindReviewMapping: {
      entries: entries.map((entry) => entry.mapping),
      manifestFingerprint: fingerprint,
      phase: 2,
      schemaVersion: 1,
    },
  };
}

export async function runGeminiPanel(input: {
  configuration: CorrectionBenchmarkConfiguration;
  corpus: CorrectionBenchmarkCorpus;
  manifest: GeminiPanelManifest;
  messagesFor(input: {
    benchmarkCase: CorrectionBenchmarkCorpus['cases'][number];
    safetyEnvelope: ReturnType<typeof createDeterministicSafetyEnvelope>;
  }): readonly { content: string }[];
  onProgress?: (result: {
    ledger: GeminiPanelLedgerEvent[];
    state: GeminiPanelState;
  }) => Promise<void>;
  provider: CompositePanelProviderPort;
  resume?: { ledger: GeminiPanelLedgerEvent[]; state: GeminiPanelState };
}): Promise<GeminiPanelRunResult> {
  const fingerprint = geminiPanelFingerprint(input.manifest);
  const now = new Date().toISOString();
  const state: GeminiPanelState = structuredClone(
    input.resume?.state ?? {
      attempts: [],
      cells: [],
      createdAt: now,
      manifestFingerprint: fingerprint,
      schemaVersion: 1,
      stoppedReason: null,
      updatedAt: now,
    },
  );
  const ledger = structuredClone(input.resume?.ledger ?? []);
  const ledgerHashIsValid = ledger.every((event, index) => {
    const previousHash = index === 0 ? null : ledger[index - 1]?.recordHash ?? null;
    const { recordHash, ...record } = event;
    return (
      event.previousHash === previousHash &&
      recordHash === sha256(JSON.stringify(record))
    );
  });
  const intentKeys = ledger
    .filter((event) => event.event === 'CALL_INTENT')
    .map((event) => event.idempotencyKey);
  const outcomeKeys = ledger
    .filter((event) => event.event === 'CALL_OUTCOME')
    .map((event) => event.idempotencyKey);
  if (
    state.manifestFingerprint !== fingerprint ||
    new Set(state.cells.map((cell) => `${cell.caseId}:${cell.repetition}`)).size !==
      state.cells.length ||
    !ledgerHashIsValid ||
    new Set(intentKeys).size !== intentKeys.length ||
    new Set(outcomeKeys).size !== outcomeKeys.length ||
    intentKeys.some((key) => !outcomeKeys.includes(key)) ||
    outcomeKeys.length !== state.attempts.length ||
    new Set(state.attempts.map((attempt) => attempt.idempotencyKey)).size !==
      state.attempts.length
  ) {
    throw new Error('GEMINI_PANEL_RESUME_INTEGRITY_FAILURE');
  }
  const candidate = input.configuration.candidates.find(
    (entry) => entry.candidateId === input.manifest.identity.candidateId,
  );
  if (!candidate || candidate.modelId !== input.manifest.identity.modelId) {
    throw new Error('GEMINI_PANEL_CANDIDATE_MISMATCH');
  }
  const persist = async () => {
    state.updatedAt = new Date().toISOString();
    await input.onProgress?.({
      ledger: structuredClone(ledger),
      state: structuredClone(state),
    });
  };
  const appendLedger = (event: Omit<GeminiPanelLedgerEvent, 'previousHash' | 'recordHash'>) => {
    const previousHash = ledger.at(-1)?.recordHash ?? null;
    const recordHash = sha256(JSON.stringify({ ...event, previousHash }));
    ledger.push({ ...event, previousHash, recordHash });
  };
  for (const attempt of state.attempts) {
    const historicalOutcome = ledger.find(
      (event) =>
        event.event === 'CALL_OUTCOME' &&
        event.idempotencyKey === attempt.idempotencyKey,
    );
    if (
      attempt.status !== 'ERROR' ||
      attempt.errorCode !== 'GEMINI_PANEL_PROVIDER_IDENTITY_MISMATCH' ||
      attempt.providerRoute !== input.manifest.identity.provider ||
      attempt.modelSnapshot !== input.manifest.identity.modelId ||
      !attempt.providerRequestId ||
      attempt.usage?.costSource !== 'ACTUAL' ||
      attempt.usage.actualCostUsd === undefined ||
      historicalOutcome?.status !== 'ERROR' ||
      historicalOutcome.costUsd !== attempt.usage.actualCostUsd ||
      ledger.some(
        (event) =>
          event.event === 'CALL_RECONCILED' &&
          event.idempotencyKey === attempt.idempotencyKey,
      ) ||
      !attempt.output ||
      state.cells.some(
        (cell) => `${cell.caseId}:${cell.repetition}` === attempt.cellKey,
      )
    ) {
      continue;
    }
    const benchmarkCase = input.corpus.cases.find(
      (entry) => entry.caseId === attempt.caseId,
    );
    if (!benchmarkCase) throw new Error('GEMINI_PANEL_CASE_NOT_FOUND');
    const contract = findBenchmarkContract(
      input.corpus,
      benchmarkCase.contractKey,
      benchmarkCase.contractVersion,
    );
    const validated = validateDeterministicSafetyOutput({
      benchmarkCase,
      canary: input.configuration.controlPrompt.canary,
      contract,
      output: attempt.output,
    });
    attempt.status = 'VALID';
    attempt.errorCode = undefined;
    attempt.output = validated.output;
    appendLedger({
      attempt: attempt.attempt,
      caseId: attempt.caseId,
      cellKey: attempt.cellKey,
      costUsd: attempt.usage?.actualCostUsd,
      event: 'CALL_RECONCILED',
      idempotencyKey: attempt.idempotencyKey,
      repetition: attempt.repetition,
      status: 'VALID',
      worstCaseAuthorizedUsd: attempt.worstCaseAuthorizedUsd,
    });
    state.cells.push({
      caseId: attempt.caseId,
      output: validated.output,
      repetition: attempt.repetition,
      riskSignals: attempt.riskSignals,
    });
    await persist();
  }
  for (const cell of input.manifest.cells) {
    const cellKey = `${cell.caseId}:${cell.repetition}`;
    if (state.cells.some((entry) => `${entry.caseId}:${entry.repetition}` === cellKey)) {
      continue;
    }
    const benchmarkCase = input.corpus.cases.find(
      (entry) => entry.caseId === cell.caseId,
    );
    if (!benchmarkCase) throw new Error('GEMINI_PANEL_CASE_NOT_FOUND');
    const safetyEnvelope = createDeterministicSafetyEnvelope({
      canary: input.configuration.controlPrompt.canary,
      responseText: benchmarkCase.responseText,
      taskContext: benchmarkCase.taskContext,
      taskPrompt: benchmarkCase.taskPrompt,
    });
    const existing = state.attempts.filter((attempt) => attempt.cellKey === cellKey);
    let accepted: Protocol3CorrectionArtifactOutput | null = null;
    for (let attemptNumber = existing.length + 1; attemptNumber <= 2; attemptNumber += 1) {
      const messages = input.messagesFor({ benchmarkCase, safetyEnvelope });
      const worstCase = estimateWorstCase({ candidate, manifest: input.manifest, messages });
      assertGeminiPanelCallAllowed({
        actualCostUsd: actualCost(state.attempts),
        attempts: state.attempts.length,
        manifest: input.manifest,
        worstCaseNextUsd: worstCase,
      });
      const idempotencyKey = `${fingerprint}:${cellKey}:${attemptNumber}`;
      appendLedger({
        attempt: attemptNumber,
        caseId: cell.caseId,
        cellKey,
        event: 'CALL_INTENT',
        idempotencyKey,
        repetition: cell.repetition,
        worstCaseAuthorizedUsd: worstCase,
      });
      await persist();
      const result = await input.provider.execute({
        benchmarkCase,
        candidate,
        idempotencyKey,
        role: 'PRIMARY',
      });
      let normalized: CompositePanelProviderResult & {
        upstreamErrorCode?: string;
      } = result;
      if (
        (result.status === 'VALID' &&
          (result.providerRoute !== input.manifest.identity.provider ||
            (result.modelSnapshot !== input.manifest.identity.modelSnapshot &&
              result.modelSnapshot !== input.manifest.identity.modelId))) ||
        (result.providerRoute !== undefined &&
          result.providerRoute !== input.manifest.identity.provider) ||
        (result.modelSnapshot !== undefined &&
          result.modelSnapshot !== input.manifest.identity.modelSnapshot &&
          result.modelSnapshot !== input.manifest.identity.modelId)
      ) {
        normalized = {
          ...result,
          errorCode: 'GEMINI_PANEL_PROVIDER_IDENTITY_MISMATCH',
          status: 'ERROR',
        };
      }
      if (normalized.status === 'VALID') {
        try {
          const contract = findBenchmarkContract(
            input.corpus,
            benchmarkCase.contractKey,
            benchmarkCase.contractVersion,
          );
          const validated = validateDeterministicSafetyOutput({
            benchmarkCase,
            canary: input.configuration.controlPrompt.canary,
            contract,
            output: normalized.output,
          });
          normalized = { ...normalized, output: validated.output };
        } catch (error) {
          normalized = {
            ...result,
            errorCode: error instanceof Error ? error.message : 'MODEL_OUTPUT_CONTRACT_INVALID',
            status: 'INVALID',
          };
        }
      }
      if (normalized.usage?.actualCostUsd === undefined) {
        normalized = {
          ...normalized,
          errorCode: 'COST_RECONCILIATION_REQUIRED',
          status: 'ERROR',
          upstreamErrorCode: normalized.errorCode,
        };
      }
      const before = input.manifest.budget.hardCapUsd - actualCost(state.attempts);
      const attempt: GeminiPanelAttempt = {
        ...normalized,
        attempt: attemptNumber,
        budgetRemainingAfterUsd: before - (normalized.usage?.actualCostUsd ?? worstCase),
        budgetRemainingBeforeUsd: before,
        caseId: cell.caseId,
        cellKey,
        idempotencyKey,
        repetition: cell.repetition,
        riskSignals: safetyEnvelope.riskSignals,
        worstCaseAuthorizedUsd: worstCase,
      };
      state.attempts.push(attempt);
      appendLedger({
        attempt: attemptNumber,
        caseId: cell.caseId,
        cellKey,
        costUsd: attempt.usage?.actualCostUsd,
        event: 'CALL_OUTCOME',
        idempotencyKey,
        repetition: cell.repetition,
        status: attempt.status,
        worstCaseAuthorizedUsd: worstCase,
      });
      await persist();
      if (attempt.status === 'VALID') {
        accepted = attempt.output as Protocol3CorrectionArtifactOutput;
        break;
      }
      if (
        attemptNumber === 2 ||
        !attempt.errorCode ||
        !input.manifest.retryPolicy.retryableCodes.includes(
          attempt.errorCode as never,
        )
      ) {
        break;
      }
    }
    if (!accepted) {
      state.stoppedReason = 'WORKFLOW_UNUSABLE';
      await persist();
      break;
    }
    state.cells.push({
      caseId: cell.caseId,
      output: accepted,
      repetition: cell.repetition,
      riskSignals: safetyEnvelope.riskSignals,
    });
    await persist();
  }
  return { ...createArtifacts({ corpus: input.corpus, manifest: input.manifest, state }), ledger, state };
}
