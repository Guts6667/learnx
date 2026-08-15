import { createHash } from 'node:crypto';

import type { CorrectionProviderResult } from '../../lib/ai-correction-provider-adapters.js';
import type { CorrectionBenchmarkConfiguration } from '../../lib/ai-correction-benchmark.js';
import { calculateEvidenceResearcherCostBound } from '../../lib/evidence-extraction-campaign.js';
import type {
  CompiledExecutableRubric,
  EvidencePass,
} from '../../lib/executable-rubric-engine.js';
import type { ExecutableRubricSemanticCorpus } from '../../lib/executable-rubric-semantic-corpus.js';
import type { SelectedExecutableRubricSemanticCorpus } from '../../lib/executable-rubric-semantic-selection.js';
import {
  buildEvidenceResearcherPrompt,
  researcherJsonSchema,
  validateEvidenceResearcherOutput,
} from '../../lib/evidence-researcher-protocol.js';

export type EvidenceResearcherPanelStatus = 'ERROR' | 'INVALID' | 'VALID';

export type EvidenceResearcherPanelAttempt = {
  actualCostUsd?: number;
  attemptNumber: number;
  budgetRemainingAfterUsd: number;
  budgetRemainingBeforeUsd: number;
  caseId: string;
  cellKey: string;
  errorCode?: string;
  idempotencyKey: string;
  latencyMs: number;
  modelSnapshot?: string;
  observedProvider?: string;
  oracleAgreement?: boolean;
  output?: EvidencePass;
  providerRequestId?: string;
  providerRoute?: string;
  repetition: number;
  requestedRoute?: string;
  rawModelOutput?: string;
  rawModelOutputSha256?: string;
  rawModelOutputTruncated?: boolean;
  retryReason?: string;
  status: EvidenceResearcherPanelStatus;
  usage?: CorrectionProviderResult['usage'];
  worstCaseAuthorizedUsd: number;
};

export type EvidenceResearcherPanelRawReceipt = {
  attemptNumber: number;
  campaignFingerprint: string;
  caseId: string;
  cellKey: string;
  idempotencyKey: string;
  modelSnapshot?: string;
  observedProvider?: string;
  providerRequestId?: string;
  providerRoute?: string;
  rawModelOutput: string;
  rawModelOutputSha256: string;
  rawModelOutputTruncated: boolean;
  receivedAt: string;
  repetition: number;
  requestedRoute?: string;
  schemaVersion: 1;
  usage?: CorrectionProviderResult['usage'];
};

export type EvidenceResearcherPanelLedgerEvent = {
  actualCostUsd?: number;
  attemptNumber: number;
  caseId: string;
  cellKey: string;
  event: 'CALL_INTENT' | 'CALL_OUTCOME';
  idempotencyKey: string;
  previousHash: string | null;
  providerRequestId?: string;
  recordHash: string;
  repetition: number;
  status?: EvidenceResearcherPanelStatus;
  worstCaseAuthorizedUsd: number;
};

export type EvidenceResearcherPanelState = {
  attempts: EvidenceResearcherPanelAttempt[];
  campaignFingerprint: string;
  completedCellKeys: string[];
  createdAt: string;
  schemaVersion: 1;
  stoppedReason: string | null;
  updatedAt: string;
};

export type EvidenceResearcherPanelProvider = {
  execute(input: {
    attemptNumber: number;
    caseItem: ExecutableRubricSemanticCorpus['cases'][number];
    cellKey: string;
    idempotencyKey: string;
    prompt: string;
    repetition: number;
  }): Promise<
    | (CorrectionProviderResult & { status: 'VALID' })
    | {
        errorCode: string;
        latencyMs: number;
        modelSnapshot?: string;
        observedProvider?: string;
        providerRequestId?: string;
        providerRoute?: string;
        requestedRoute?: string;
        rawModelOutput?: string;
        status: 'ERROR' | 'INVALID';
        usage?: CorrectionProviderResult['usage'];
      }
  >;
};

type EvidenceResearcherPanelCorpus = Pick<
  SelectedExecutableRubricSemanticCorpus,
  'cases' | 'task'
>;

export type EvidenceResearcherExecutionCampaign = {
  budgetProposal: { hardCapUsd: number };
  execution: {
    caseIds: readonly string[];
    repetitionsPerCase: number;
  };
  protocol: { securityCanary: string };
  researcher: {
    expectedObservedProvider: string;
    modelId: string;
    modelSnapshot: string;
    requestProfile: CorrectionBenchmarkConfiguration['candidates'][number]['requestProfile'];
    requestedRoute: string;
  };
  retryPolicy: {
    allowlistedCodes: readonly string[];
    maximumProviderAttempts: number;
    maximumRetriesPerWorkflow: number;
  };
};

const sha256 = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

function appendLedger(
  ledger: EvidenceResearcherPanelLedgerEvent[],
  event: Omit<EvidenceResearcherPanelLedgerEvent, 'previousHash' | 'recordHash'>,
): void {
  const previousHash = ledger.at(-1)?.recordHash ?? null;
  const record = { ...event, previousHash };
  ledger.push({ ...record, recordHash: sha256(JSON.stringify(record)) });
}

function rawReceipt(input: {
  canary: string;
  result: Awaited<ReturnType<EvidenceResearcherPanelProvider['execute']>>;
}):
  | Pick<
      EvidenceResearcherPanelRawReceipt,
      'rawModelOutput' | 'rawModelOutputSha256' | 'rawModelOutputTruncated'
    >
  | undefined {
  const source =
    input.result.status === 'VALID'
      ? JSON.stringify(input.result.output)
      : input.result.rawModelOutput;
  if (!source) return undefined;
  const sanitized = source.replaceAll(input.canary, '[REDACTED_CANARY]');
  const characters = Array.from(sanitized);
  return {
    rawModelOutput: characters.slice(0, 20_000).join(''),
    rawModelOutputSha256: sha256(source),
    rawModelOutputTruncated: characters.length > 20_000,
  };
}

function injectionIsSafe(input: {
  canary: string;
  caseItem: ExecutableRubricSemanticCorpus['cases'][number];
  output: EvidencePass;
}): boolean {
  const serialized = JSON.stringify(input.output);
  if (serialized.includes(input.canary)) return false;
  const boundary = input.caseItem.injectionBoundary;
  if (!boundary) return true;
  if (
    boundary.forbiddenOutputFragments.some((fragment) =>
      serialized.includes(fragment),
    )
  ) {
    return false;
  }
  return input.output.elements.every((element) =>
    element.evidenceSpans.every(
      (span) => span.end <= boundary.legitimateResponseText.length,
    ),
  );
}

function oracleAgreement(input: {
  caseItem: ExecutableRubricSemanticCorpus['cases'][number];
  output: EvidencePass;
}): boolean {
  return input.caseItem.expectedElements.every((expected) =>
    input.output.elements.some(
      (actual) =>
        actual.elementKey === expected.elementKey &&
        actual.status === expected.status,
    ),
  );
}

function expectedCells(campaign: EvidenceResearcherExecutionCampaign): string[] {
  return campaign.execution.caseIds.flatMap((caseId) =>
    Array.from(
      { length: campaign.execution.repetitionsPerCase },
      (_, index) => `${caseId}:${index + 1}`,
    ),
  );
}

function assertResumeIntegrity(input: {
  campaignFingerprint: string;
  expectedCellKeys: readonly string[];
  ledger: EvidenceResearcherPanelLedgerEvent[];
  state: EvidenceResearcherPanelState;
}): void {
  const ledgerValid = input.ledger.every((event, index) => {
    const previousHash = input.ledger[index - 1]?.recordHash ?? null;
    const { recordHash, ...record } = event;
    return (
      event.previousHash === previousHash &&
      recordHash === sha256(JSON.stringify(record))
    );
  });
  const pairsValid = input.state.attempts.every((attempt, index) => {
    const intent = input.ledger[index * 2];
    const outcome = input.ledger[index * 2 + 1];
    return (
      intent?.event === 'CALL_INTENT' &&
      outcome?.event === 'CALL_OUTCOME' &&
      intent.cellKey === attempt.cellKey &&
      outcome.cellKey === attempt.cellKey &&
      intent.attemptNumber === attempt.attemptNumber &&
      outcome.attemptNumber === attempt.attemptNumber &&
      intent.idempotencyKey === attempt.idempotencyKey &&
      outcome.idempotencyKey === attempt.idempotencyKey &&
      outcome.status === attempt.status &&
      outcome.actualCostUsd === attempt.actualCostUsd &&
      outcome.providerRequestId === attempt.providerRequestId
    );
  });
  const attemptKeys = input.state.attempts.map(
    ({ cellKey, attemptNumber }) => `${cellKey}:${attemptNumber}`,
  );
  const providerRequestIds = input.state.attempts.flatMap(
    ({ providerRequestId }) => (providerRequestId ? [providerRequestId] : []),
  );
  const completedFromAttempts = input.expectedCellKeys.filter((cellKey) => {
    const attempts = input.state.attempts.filter(
      (attempt) => attempt.cellKey === cellKey,
    );
    return attempts.at(-1)?.status === 'VALID';
  });
  if (
    !ledgerValid ||
    !pairsValid ||
    input.state.campaignFingerprint !== input.campaignFingerprint ||
    input.ledger.length !== input.state.attempts.length * 2 ||
    new Set(attemptKeys).size !== attemptKeys.length ||
    new Set(providerRequestIds).size !== providerRequestIds.length ||
    new Set(input.state.completedCellKeys).size !==
      input.state.completedCellKeys.length ||
    input.state.attempts.some(
      ({ cellKey }) => !input.expectedCellKeys.includes(cellKey),
    ) ||
    JSON.stringify(input.state.completedCellKeys) !==
      JSON.stringify(completedFromAttempts)
  ) {
    throw new Error('EVIDENCE_RESEARCHER_PANEL_RESUME_INTEGRITY_FAILURE');
  }
}

export async function runEvidenceResearcherPanel(input: {
  campaign: EvidenceResearcherExecutionCampaign;
  campaignFileText: string;
  compiled: CompiledExecutableRubric;
  completionUsdPerToken: number;
  corpus: EvidenceResearcherPanelCorpus;
  onProgress?: (input: {
    ledger: EvidenceResearcherPanelLedgerEvent[];
    state: EvidenceResearcherPanelState;
  }) => Promise<void>;
  onRawReceived: (receipt: EvidenceResearcherPanelRawReceipt) => Promise<void>;
  promptUsdPerToken: number;
  provider: EvidenceResearcherPanelProvider;
  resume?: {
    ledger: EvidenceResearcherPanelLedgerEvent[];
    state: EvidenceResearcherPanelState;
  };
}): Promise<{
  ledger: EvidenceResearcherPanelLedgerEvent[];
  state: EvidenceResearcherPanelState;
}> {
  const campaignFingerprint = sha256(input.campaignFileText);
  const expectedCellKeys = expectedCells(input.campaign);
  const now = new Date().toISOString();
  const state = structuredClone(
    input.resume?.state ?? {
      attempts: [],
      campaignFingerprint,
      completedCellKeys: [],
      createdAt: now,
      schemaVersion: 1 as const,
      stoppedReason: null,
      updatedAt: now,
    },
  );
  const ledger = structuredClone(input.resume?.ledger ?? []);
  assertResumeIntegrity({ campaignFingerprint, expectedCellKeys, ledger, state });
  const persist = async () => {
    state.updatedAt = new Date().toISOString();
    await input.onProgress?.({
      ledger: structuredClone(ledger),
      state: structuredClone(state),
    });
  };
  const schemaUtf8Bytes = Buffer.byteLength(
    JSON.stringify(researcherJsonSchema()),
  );
  const actualCost = () =>
    state.attempts.reduce(
      (total, attempt) => total + (attempt.actualCostUsd ?? 0),
      0,
    );
  if (state.stoppedReason !== null) return { ledger, state };

  for (const cellKey of expectedCellKeys) {
    if (state.completedCellKeys.includes(cellKey)) continue;
    const separator = cellKey.lastIndexOf(':');
    const caseId = cellKey.slice(0, separator);
    const repetition = Number(cellKey.slice(separator + 1));
    const caseItem = input.corpus.cases.find((entry) => entry.caseId === caseId);
    if (!caseItem) throw new Error('EVIDENCE_RESEARCHER_PANEL_CASE_NOT_FOUND');
    const prompt = buildEvidenceResearcherPrompt({
      canary: input.campaign.protocol.securityCanary,
      compiled: input.compiled,
      responseText: caseItem.responseText,
      taskContext: input.corpus.task.context,
      taskPrompt: input.corpus.task.prompt,
    });
    const costBound = calculateEvidenceResearcherCostBound({
      completionUsdPerToken: input.completionUsdPerToken,
      maximumPromptUtf8Bytes: Buffer.byteLength(prompt),
      maximumProviderAttempts: 1,
      outputTokenLimit: input.campaign.researcher.requestProfile.totalOutputTokenLimit,
      promptUsdPerToken: input.promptUsdPerToken,
      schemaUtf8Bytes,
      transportAllowanceTokens: 2_048,
    });
    let attemptNumber =
      state.attempts.filter((attempt) => attempt.cellKey === cellKey).length + 1;
    while (attemptNumber <= input.campaign.retryPolicy.maximumRetriesPerWorkflow + 1) {
      if (
        state.attempts.length + 1 > input.campaign.retryPolicy.maximumProviderAttempts ||
        actualCost() + costBound.maximumCostPerAttemptUsd >
          input.campaign.budgetProposal.hardCapUsd
      ) {
        state.stoppedReason =
          state.attempts.length + 1 >
          input.campaign.retryPolicy.maximumProviderAttempts
            ? 'ATTEMPT_CAP_REACHED'
            : 'BUDGET_PREFLIGHT_BLOCKED';
        await persist();
        return { ledger, state };
      }
      const idempotencyKey = sha256(
        `${campaignFingerprint}:${cellKey}:${attemptNumber}`,
      );
      appendLedger(ledger, {
        attemptNumber,
        caseId,
        cellKey,
        event: 'CALL_INTENT',
        idempotencyKey,
        repetition,
        worstCaseAuthorizedUsd: costBound.maximumCostPerAttemptUsd,
      });
      await persist();
      let result: Awaited<ReturnType<EvidenceResearcherPanelProvider['execute']>>;
      try {
        result = await input.provider.execute({
          attemptNumber,
          caseItem,
          cellKey,
          idempotencyKey,
          prompt,
          repetition,
        });
      } catch (error) {
        const errorCode =
          error instanceof Error ? error.message : 'PROVIDER_ERROR_UNKNOWN';
        const before = input.campaign.budgetProposal.hardCapUsd - actualCost();
        const attempt: EvidenceResearcherPanelAttempt = {
          attemptNumber,
          budgetRemainingAfterUsd: before - costBound.maximumCostPerAttemptUsd,
          budgetRemainingBeforeUsd: before,
          caseId,
          cellKey,
          errorCode,
          idempotencyKey,
          latencyMs: 0,
          repetition,
          status: 'ERROR',
          worstCaseAuthorizedUsd: costBound.maximumCostPerAttemptUsd,
        };
        state.attempts.push(attempt);
        appendLedger(ledger, {
          attemptNumber,
          caseId,
          cellKey,
          event: 'CALL_OUTCOME',
          idempotencyKey,
          repetition,
          status: 'ERROR',
          worstCaseAuthorizedUsd: costBound.maximumCostPerAttemptUsd,
        });
        state.stoppedReason = 'COST_RECONCILIATION_REQUIRED';
        await persist();
        return { ledger, state };
      }
      const received = rawReceipt({
        canary: input.campaign.protocol.securityCanary,
        result,
      });
      let rawPersistenceFailed = !received;
      if (received) {
        try {
          await input.onRawReceived({
            attemptNumber,
            campaignFingerprint,
            caseId,
            cellKey,
            idempotencyKey,
            modelSnapshot: result.modelSnapshot,
            observedProvider: result.observedProvider,
            providerRequestId: result.providerRequestId,
            providerRoute: result.providerRoute,
            repetition,
            requestedRoute: result.requestedRoute,
            ...received,
            receivedAt: new Date().toISOString(),
            schemaVersion: 1,
            usage: result.usage,
          });
        } catch {
          rawPersistenceFailed = true;
        }
      }
      const before = input.campaign.budgetProposal.hardCapUsd - actualCost();
      const actualCostUsd = result.usage?.actualCostUsd;
      let status: EvidenceResearcherPanelStatus = result.status;
      let errorCode = result.status === 'VALID' ? undefined : result.errorCode;
      let output: EvidencePass | undefined;
      let agreement: boolean | undefined;
      if (rawPersistenceFailed) {
        status = 'ERROR';
        errorCode = 'RAW_MODEL_OUTPUT_PERSISTENCE_FAILED';
      } else if (
        actualCostUsd === undefined ||
        result.usage?.costSource !== 'ACTUAL' ||
        !result.providerRequestId
      ) {
        status = 'ERROR';
        errorCode = 'COST_RECONCILIATION_REQUIRED';
      } else if (
        result.requestedRoute !== input.campaign.researcher.requestedRoute ||
        result.observedProvider !==
          input.campaign.researcher.expectedObservedProvider ||
        (result.modelSnapshot !== input.campaign.researcher.modelSnapshot &&
          result.modelSnapshot !== input.campaign.researcher.modelId)
      ) {
        status = 'ERROR';
        errorCode = 'EVIDENCE_RESEARCHER_PROVIDER_IDENTITY_MISMATCH';
      } else if (result.status === 'VALID') {
        try {
          output = validateEvidenceResearcherOutput({
            compiled: input.compiled,
            output: result.output,
            pipelineFingerprintSeed: campaignFingerprint,
            responseText: caseItem.responseText,
          });
          if (
            !injectionIsSafe({
              canary: input.campaign.protocol.securityCanary,
              caseItem,
              output,
            })
          ) {
            throw new Error('EVIDENCE_RESEARCHER_INJECTION_SAFETY_FAILURE');
          }
          agreement = oracleAgreement({ caseItem, output });
        } catch (error) {
          status = 'INVALID';
          errorCode =
            error instanceof Error ? error.message : 'MODEL_OUTPUT_INVALID';
          output = undefined;
        }
      }
      const attempt: EvidenceResearcherPanelAttempt = {
        ...(actualCostUsd === undefined ? {} : { actualCostUsd }),
        attemptNumber,
        budgetRemainingAfterUsd:
          before - (actualCostUsd ?? costBound.maximumCostPerAttemptUsd),
        budgetRemainingBeforeUsd: before,
        caseId,
        cellKey,
        ...(errorCode ? { errorCode } : {}),
        idempotencyKey,
        latencyMs: result.latencyMs,
        modelSnapshot: result.modelSnapshot,
        observedProvider: result.observedProvider,
        ...(agreement === undefined ? {} : { oracleAgreement: agreement }),
        ...(output ? { output } : {}),
        providerRequestId: result.providerRequestId,
        providerRoute: result.providerRoute,
        repetition,
        requestedRoute: result.requestedRoute,
        ...(received ?? {}),
        status,
        usage: result.usage,
        worstCaseAuthorizedUsd: costBound.maximumCostPerAttemptUsd,
      };
      state.attempts.push(attempt);
      appendLedger(ledger, {
        ...(actualCostUsd === undefined ? {} : { actualCostUsd }),
        attemptNumber,
        caseId,
        cellKey,
        event: 'CALL_OUTCOME',
        idempotencyKey,
        providerRequestId: result.providerRequestId,
        repetition,
        status,
        worstCaseAuthorizedUsd: costBound.maximumCostPerAttemptUsd,
      });
      if (status === 'VALID') {
        state.completedCellKeys.push(cellKey);
        await persist();
        break;
      }
      const retryAllowed =
        status === 'ERROR' &&
        errorCode !== undefined &&
        input.campaign.retryPolicy.allowlistedCodes.includes(
          errorCode as (typeof input.campaign.retryPolicy.allowlistedCodes)[number],
        ) &&
        actualCostUsd !== undefined &&
        result.usage?.costSource === 'ACTUAL' &&
        Boolean(result.providerRequestId) &&
        attemptNumber === 1;
      if (retryAllowed) {
        attempt.retryReason = errorCode;
        await persist();
        attemptNumber += 1;
        continue;
      }
      state.stoppedReason = errorCode ?? 'PANEL_ATTEMPT_FAILED';
      await persist();
      return { ledger, state };
    }
  }
  return { ledger, state };
}
