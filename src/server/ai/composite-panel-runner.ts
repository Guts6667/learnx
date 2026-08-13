import { createHash } from 'node:crypto';

import type {
  CorrectionBenchmarkConfiguration,
  CorrectionBenchmarkCorpus,
} from '../../lib/ai-correction-benchmark.js';
import {
  findBenchmarkContract,
  validateBenchmarkProtocol3ModelOutputWithEvidence,
} from '../../lib/ai-correction-benchmark.js';
import type { Protocol3CorrectionArtifactOutput } from '../../lib/ai-correction-contracts.js';
import type { CorrectionContract } from '../../lib/ai-correction-contracts.js';

import {
  calculateIndicativeScore,
  type RoleObservation,
} from './composite-correction.js';
import {
  assertCompositeRunCallAllowed,
  assertFrozenCompositeRunEnvelope,
  classifyV4009BDisagreement,
  compositePanelCellKey,
  createBlindReviewEntry,
  createBlindReviewMapping,
  createCompositeRunEnvelopeFingerprint,
  deriveV4009BTriggerReasons,
  type CompositeRunEnvelope,
  type V4009BTriggerReason,
} from './composite-pipeline-validation.js';

export type CompositePanelRole = 'PRIMARY' | 'TARGETED_VERIFIER';

export interface CompositePanelUsage {
  actualCostUsd?: number;
  costSource: 'ACTUAL' | 'ESTIMATED';
  inputTokens: number;
  reasoningTokens: number;
  visibleOutputTokens: number;
}

export interface CompositePanelProviderResult {
  errorCode?: string;
  latencyMs: number;
  modelSnapshot?: string;
  output?: unknown;
  providerRequestId?: string;
  providerRoute?: string;
  rawModelOutput?: string;
  status: 'ERROR' | 'INVALID' | 'VALID';
  usage?: CompositePanelUsage;
}

export interface CompositePanelProviderPort {
  execute(input: {
    benchmarkCase: CorrectionBenchmarkCorpus['cases'][number];
    candidate: CorrectionBenchmarkConfiguration['candidates'][number];
    idempotencyKey: string;
    role: CompositePanelRole;
  }): Promise<CompositePanelProviderResult>;
}

export interface CompositePanelAttempt extends CompositePanelProviderResult {
  attempt: number;
  authorizedWorstCaseUsd: number;
  budgetRemainingAfterUsd: number;
  budgetRemainingBeforeUsd: number;
  candidateId: string;
  caseId: string;
  cellKey: string;
  idempotencyKey: string;
  modelId: string;
  repetition: number;
  role: CompositePanelRole;
  startedAt: string;
}

export interface CompositePanelCellResult {
  attempts: CompositePanelAttempt[];
  caseId: string;
  consolidation: {
    disagreement: string | null;
    indicativeScore: number | null;
    state: 'COMPLETED' | 'PROVISIONAL' | 'UNCERTAIN' | 'UNUSABLE_RELEASED';
  };
  primary: Protocol3CorrectionArtifactOutput | null;
  repetition: number;
  triggerReasons: readonly V4009BTriggerReason[];
  verifier: Protocol3CorrectionArtifactOutput | null;
}

export interface CompositePanelState {
  attempts: CompositePanelAttempt[];
  cells: CompositePanelCellResult[];
  createdAt: string;
  envelopeFingerprint: string;
  expectedCostExceeded: boolean;
  panelVersion: string;
  schemaVersion: 1;
  stoppedReason: string | null;
  updatedAt: string;
}

export interface CompositePanelRunResult {
  blindReview: unknown;
  blindReviewMapping: unknown;
  state: CompositePanelState;
}

const TRANSIENT_RETRY_CODES = new Set([
  'PROVIDER_HTTP_429',
  'PROVIDER_HTTP_500',
  'PROVIDER_HTTP_502',
  'PROVIDER_HTTP_503',
  'PROVIDER_HTTP_504',
]);

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function asObservation(
  output: Protocol3CorrectionArtifactOutput,
): RoleObservation {
  return {
    criteria: output.criteria.map((criterion) => ({
      confidence: criterion.confidence,
      criterionKey: criterion.criterionKey,
      evidenceQuotes: criterion.evidenceQuotes,
      feedback: criterion.feedback,
      levelKey: criterion.levelKey,
    })),
    overallFeedback: output.overallFeedback,
  };
}

function findCandidate(
  configuration: CorrectionBenchmarkConfiguration,
  candidateId: string,
): CorrectionBenchmarkConfiguration['candidates'][number] {
  const candidate = configuration.candidates.find(
    (entry) => entry.candidateId === candidateId,
  );
  if (!candidate) throw new Error('COMPOSITE_PANEL_CANDIDATE_NOT_FOUND');
  return candidate;
}

function identity(envelope: CompositeRunEnvelope): {
  primary: { candidateId: string };
  trigger: { controlSampleCellKeys: readonly string[] };
  verifier: { candidateId: string };
} {
  const value = envelope.identity as {
    primary?: { candidateId?: string };
    trigger?: { controlSampleCellKeys?: readonly string[] };
    verifier?: { candidateId?: string };
  };
  if (
    !value.primary?.candidateId ||
    !value.verifier?.candidateId ||
    !value.trigger?.controlSampleCellKeys
  ) {
    throw new Error('COMPOSITE_RUN_IDENTITY_INVALID');
  }
  return value as {
    primary: { candidateId: string };
    trigger: { controlSampleCellKeys: readonly string[] };
    verifier: { candidateId: string };
  };
}

export function assertCompositePanelSources(input: {
  caseSha256ById: Readonly<Record<string, string>>;
  configuration: CorrectionBenchmarkConfiguration;
  configurationSha256: string;
  corpus: CorrectionBenchmarkCorpus;
  corpusSha256: string;
  envelope: CompositeRunEnvelope;
}): void {
  assertFrozenCompositeRunEnvelope(input.envelope);
  const frozenIdentity = input.envelope.identity as {
    benchmarkConfigurationSha256?: string;
    protocolVersion?: string;
  };
  if (
    input.corpus.corpusId !== input.envelope.corpusId ||
    input.corpusSha256 !== input.envelope.corpusSha256 ||
    input.configuration.corpusId !== input.corpus.corpusId ||
    input.configuration.requestProtocolVersion !== frozenIdentity.protocolVersion ||
    input.configurationSha256 !== frozenIdentity.benchmarkConfigurationSha256
  ) {
    throw new Error('COMPOSITE_PANEL_SOURCE_IDENTITY_MISMATCH');
  }
  for (const cell of input.envelope.cells) {
    const benchmarkCase = input.corpus.cases.find(
      (entry) => entry.caseId === cell.caseId,
    );
    if (
      !benchmarkCase ||
      input.caseSha256ById[cell.caseId] !== cell.caseDigest
    ) {
      throw new Error('COMPOSITE_PANEL_CASE_DIGEST_MISMATCH');
    }
  }
}

export function estimateCompositePanelWorstCaseUsd(input: {
  candidate: CorrectionBenchmarkConfiguration['candidates'][number];
  envelope: CompositeRunEnvelope;
  messages: readonly { content: string }[];
  role: CompositePanelRole;
}): number {
  const budget = input.envelope.budget as CompositeRunEnvelope['budget'] & {
    rateCardSnapshot?: Record<string, number | string>;
  };
  const rates = budget.rateCardSnapshot;
  if (!rates) throw new Error('COMPOSITE_PANEL_RATE_CARD_MISSING');
  const promptRate = Number(
    input.role === 'PRIMARY'
      ? rates.primaryPromptUsdPerToken
      : rates.verifierPromptUsdPerToken,
  );
  const completionRate = Number(
    input.role === 'PRIMARY'
      ? rates.primaryCompletionUsdPerToken
      : rates.verifierCompletionUsdPerToken,
  );
  if (!(promptRate > 0) || !(completionRate > 0)) {
    throw new Error('COMPOSITE_PANEL_RATE_CARD_INVALID');
  }
  const characters = input.messages.reduce(
    (total, message) => total + message.content.length,
    0,
  );
  const conservativeInputTokens = Math.ceil(characters / 3);
  return (
    conservativeInputTokens * promptRate +
    input.candidate.requestProfile.totalOutputTokenLimit * completionRate
  );
}

function emptyState(envelope: CompositeRunEnvelope): CompositePanelState {
  const now = new Date().toISOString();
  return {
    attempts: [],
    cells: [],
    createdAt: now,
    envelopeFingerprint: createCompositeRunEnvelopeFingerprint(envelope),
    expectedCostExceeded: false,
    panelVersion: envelope.panelVersion,
    schemaVersion: 1,
    stoppedReason: null,
    updatedAt: now,
  };
}

function totalActualCost(attempts: readonly CompositePanelAttempt[]): number {
  return attempts.reduce(
    (total, attempt) => total + (attempt.usage?.actualCostUsd ?? 0),
    0,
  );
}

function validateState(
  state: CompositePanelState,
  envelope: CompositeRunEnvelope,
): void {
  if (
    state.envelopeFingerprint !== createCompositeRunEnvelopeFingerprint(envelope) ||
    new Set(state.cells.map((cell) => compositePanelCellKey(cell))).size !==
      state.cells.length
  ) {
    throw new Error('COMPOSITE_PANEL_RESUME_IDENTITY_MISMATCH');
  }
}

function shouldRetry(attempt: CompositePanelAttempt): boolean {
  return (
    attempt.status === 'ERROR' &&
    attempt.errorCode !== undefined &&
    TRANSIENT_RETRY_CODES.has(attempt.errorCode) &&
    attempt.usage?.actualCostUsd !== undefined
  );
}

function reviewArtifacts(input: {
  corpus: CorrectionBenchmarkCorpus;
  envelope: CompositeRunEnvelope;
  state: CompositePanelState;
}): Pick<CompositePanelRunResult, 'blindReview' | 'blindReviewMapping'> {
  const fingerprint = input.state.envelopeFingerprint;
  const entries = input.state.cells.map((cell) => {
    const benchmarkCase = input.corpus.cases.find(
      (entry) => entry.caseId === cell.caseId,
    );
    if (!benchmarkCase) throw new Error('COMPOSITE_PANEL_CASE_NOT_FOUND');
    const contract = findBenchmarkContract(
      input.corpus,
      benchmarkCase.contractKey,
      benchmarkCase.contractVersion,
    );
    const reviewId = `review-${sha256(`${fingerprint}:${cell.caseId}:${cell.repetition}`).slice(0, 16)}`;
    const rejectedOutputs = cell.attempts
      .filter((attempt) => attempt.status === 'INVALID')
      .map((attempt) => ({
        output: attempt.output ?? attempt.rawModelOutput ?? null,
        status: 'REJECTED',
      }));
    return {
      caseId: cell.caseId,
      repetition: cell.repetition,
      review: {
        ...createBlindReviewEntry(reviewId, {
          candidateConsolidation: cell.consolidation,
          contractKey: contract.contractKey,
          contractVersion: contract.version,
          outputs: cell.verifier
            ? [cell.primary, cell.verifier]
            : [cell.primary],
          rubric: { criteria: contract.criteria },
          responseText: benchmarkCase.responseText,
          taskContext: benchmarkCase.taskContext,
          taskPrompt: benchmarkCase.taskPrompt,
        }),
        rejectedOutputs,
      },
      reviewId,
    };
  });
  const blindReview = {
    entries: entries.map((entry) => entry.review),
    envelopeFingerprint: fingerprint,
    phase: 1,
    schemaVersion: 1,
  };
  const blindReviewMapping = createBlindReviewMapping({
    entries: entries.map(({ caseId, repetition, reviewId }) => ({
      caseId,
      repetition,
      reviewId,
    })),
    envelopeFingerprint: fingerprint,
  });
  return { blindReview, blindReviewMapping };
}

export async function runCompositeMiniPanel(input: {
  caseSha256ById: Readonly<Record<string, string>>;
  configuration: CorrectionBenchmarkConfiguration;
  configurationSha256: string;
  corpus: CorrectionBenchmarkCorpus;
  corpusSha256: string;
  envelope: CompositeRunEnvelope;
  messagesFor(input: {
    benchmarkCase: CorrectionBenchmarkCorpus['cases'][number];
    candidate: CorrectionBenchmarkConfiguration['candidates'][number];
  }): readonly { content: string }[];
  onProgress?: (state: CompositePanelState) => Promise<void>;
  provider: CompositePanelProviderPort;
  resume?: CompositePanelState;
}): Promise<CompositePanelRunResult> {
  assertCompositePanelSources(input);
  const state = structuredClone(input.resume ?? emptyState(input.envelope));
  validateState(state, input.envelope);
  state.stoppedReason = null;
  const frozenIdentity = identity(input.envelope);
  const primaryCandidate = findCandidate(
    input.configuration,
    frozenIdentity.primary.candidateId,
  );
  const verifierCandidate = findCandidate(
    input.configuration,
    frozenIdentity.verifier.candidateId,
  );

  const persist = async (): Promise<void> => {
    state.updatedAt = new Date().toISOString();
    state.expectedCostExceeded =
      totalActualCost(state.attempts) >
      input.envelope.budget.expectedWithoutRetryUsd;
    await input.onProgress?.(structuredClone(state));
  };

  const executeRole = async (params: {
    benchmarkCase: CorrectionBenchmarkCorpus['cases'][number];
    candidate: CorrectionBenchmarkConfiguration['candidates'][number];
    cellKey: string;
    repetition: number;
    role: CompositePanelRole;
  }): Promise<Protocol3CorrectionArtifactOutput | null> => {
    const existing = state.attempts.filter(
      (attempt) =>
        attempt.cellKey === params.cellKey && attempt.role === params.role,
    );
    const terminal = existing.at(-1);
    if (terminal?.status === 'VALID') return terminal.output as Protocol3CorrectionArtifactOutput;
    const maxAttempts = 2;
    for (let attemptNumber = existing.length + 1; attemptNumber <= maxAttempts; attemptNumber += 1) {
      const messages = input.messagesFor({
        benchmarkCase: params.benchmarkCase,
        candidate: params.candidate,
      });
      const worstCase = estimateCompositePanelWorstCaseUsd({
        candidate: params.candidate,
        envelope: input.envelope,
        messages,
        role: params.role,
      });
      const usageBefore = totalActualCost(state.attempts);
      assertCompositeRunCallAllowed({
        envelope: input.envelope,
        estimatedWorstCaseNextCallUsd: worstCase,
        progress: {
          completedCellKeys: state.cells.map(compositePanelCellKey),
          providerCalls: state.attempts.length,
          reservedInFlightUsd: 0,
          usageCostUsd: usageBefore,
        },
      });
      const idempotencyKey = `${state.envelopeFingerprint}:${params.cellKey}:${params.role}:${attemptNumber}`;
      const result = await input.provider.execute({
        benchmarkCase: params.benchmarkCase,
        candidate: params.candidate,
        idempotencyKey,
        role: params.role,
      });
      let normalized = result;
      if (result.status === 'VALID') {
        try {
          const contract = findBenchmarkContract(
            input.corpus,
            params.benchmarkCase.contractKey,
            params.benchmarkCase.contractVersion,
          );
          const validated = validateBenchmarkProtocol3ModelOutputWithEvidence({
            benchmarkCase: params.benchmarkCase,
            canary: input.configuration.controlPrompt.canary,
            contract,
            output: result.output,
          });
          normalized = { ...result, output: validated.output };
        } catch (error) {
          normalized = {
            ...result,
            errorCode: error instanceof Error ? error.message : 'MODEL_OUTPUT_CONTRACT_INVALID',
            status: 'INVALID',
          };
        }
      }
      const actualCost = normalized.usage?.actualCostUsd;
      if (actualCost === undefined || normalized.usage?.costSource !== 'ACTUAL') {
        normalized = {
          ...normalized,
          errorCode: 'COST_RECONCILIATION_REQUIRED',
          status: 'ERROR',
        };
      }
      const attempt: CompositePanelAttempt = {
        ...normalized,
        attempt: attemptNumber,
        authorizedWorstCaseUsd: worstCase,
        budgetRemainingAfterUsd:
          input.envelope.budget.maximumUsageCostUsd -
          (usageBefore + (actualCost ?? worstCase)),
        budgetRemainingBeforeUsd:
          input.envelope.budget.maximumUsageCostUsd - usageBefore,
        candidateId: params.candidate.candidateId,
        caseId: params.benchmarkCase.caseId,
        cellKey: params.cellKey,
        idempotencyKey,
        modelId: params.candidate.modelId,
        repetition: params.repetition,
        role: params.role,
        startedAt: new Date().toISOString(),
      };
      state.attempts.push(attempt);
      await persist();
      if (attempt.status === 'VALID') {
        return attempt.output as Protocol3CorrectionArtifactOutput;
      }
      if (!shouldRetry(attempt) || attemptNumber === maxAttempts) return null;
    }
    return null;
  };

  for (const cell of input.envelope.cells) {
    const cellKey = compositePanelCellKey(cell);
    if (state.cells.some((result) => compositePanelCellKey(result) === cellKey)) {
      continue;
    }
    const benchmarkCase = input.corpus.cases.find(
      (entry) => entry.caseId === cell.caseId,
    );
    if (!benchmarkCase) throw new Error('COMPOSITE_PANEL_CASE_NOT_FOUND');
    const contract = findBenchmarkContract(
      input.corpus,
      benchmarkCase.contractKey,
      benchmarkCase.contractVersion,
    );
    const primary = await executeRole({
      benchmarkCase,
      candidate: primaryCandidate,
      cellKey,
      repetition: cell.repetition,
      role: 'PRIMARY',
    });
    if (!primary) {
      state.cells.push({
        attempts: state.attempts.filter((attempt) => attempt.cellKey === cellKey),
        caseId: cell.caseId,
        consolidation: {
          disagreement: null,
          indicativeScore: null,
          state: 'UNUSABLE_RELEASED',
        },
        primary: null,
        repetition: cell.repetition,
        triggerReasons: [],
        verifier: null,
      });
      state.stoppedReason = 'PRIMARY_UNUSABLE';
      await persist();
      break;
    }
    const primaryObservation = asObservation(primary);
    const triggerReasons = deriveV4009BTriggerReasons({
      contract,
      controlSample: frozenIdentity.trigger.controlSampleCellKeys.includes(cellKey),
      deterministicSecurityReview:
        benchmarkCase.category === 'PROMPT_INJECTION',
      primary: primaryObservation,
      usableValidationWarning: false,
    });
    let verifier: Protocol3CorrectionArtifactOutput | null = null;
    if (triggerReasons.length > 0) {
      verifier = await executeRole({
        benchmarkCase,
        candidate: verifierCandidate,
        cellKey,
        repetition: cell.repetition,
        role: 'TARGETED_VERIFIER',
      });
    }
    const disagreement = verifier
      ? classifyV4009BDisagreement({
          contract,
          hasEvidenceOrSecurityConflict: false,
          primary: primaryObservation,
          verifier: asObservation(verifier),
        })
      : null;
    const resultState =
      triggerReasons.length > 0 && !verifier
        ? 'PROVISIONAL'
        : disagreement === 'MATERIAL_DISAGREEMENT'
          ? 'UNCERTAIN'
          : 'COMPLETED';
    state.cells.push({
      attempts: state.attempts.filter((attempt) => attempt.cellKey === cellKey),
      caseId: cell.caseId,
      consolidation: {
        disagreement,
        indicativeScore:
          resultState === 'UNCERTAIN'
            ? null
            : calculateIndicativeScore({
                contract: contract as CorrectionContract,
                observation: primaryObservation,
              }),
        state: resultState,
      },
      primary,
      repetition: cell.repetition,
      triggerReasons,
      verifier,
    });
    await persist();
    if (resultState === 'PROVISIONAL') {
      state.stoppedReason = 'VERIFIER_UNUSABLE';
      await persist();
      break;
    }
  }
  return { ...reviewArtifacts({ corpus: input.corpus, envelope: input.envelope, state }), state };
}
