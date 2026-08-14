import { createHash } from 'node:crypto';

import type { CorrectionProviderResult } from '../../lib/ai-correction-provider-adapters.js';
import type { EvidenceExtractionCampaign } from '../../lib/evidence-extraction-campaign.js';
import { calculateEvidenceResearcherCostBound } from '../../lib/evidence-extraction-campaign.js';
import type {
  CompiledExecutableRubric,
  EvidencePass,
} from '../../lib/executable-rubric-engine.js';
import type { ExecutableRubricSemanticCorpus } from '../../lib/executable-rubric-semantic-corpus.js';
import {
  buildEvidenceResearcherPrompt,
  researcherJsonSchema,
  validateEvidenceResearcherOutput,
} from '../../lib/evidence-researcher-protocol.js';

export type EvidenceResearcherSmokeStatus = 'ERROR' | 'INVALID' | 'VALID';

export type EvidenceResearcherSmokeAttempt = {
  actualCostUsd?: number;
  budgetRemainingAfterUsd: number;
  budgetRemainingBeforeUsd: number;
  caseId: string;
  errorCode?: string;
  idempotencyKey: string;
  latencyMs: number;
  modelSnapshot?: string;
  output?: EvidencePass;
  providerRequestId?: string;
  providerRoute?: string;
  rawModelOutput?: string;
  rawModelOutputSha256?: string;
  rawModelOutputTruncated?: boolean;
  status: EvidenceResearcherSmokeStatus;
  usage?: CorrectionProviderResult['usage'];
  worstCaseAuthorizedUsd: number;
};

export type EvidenceResearcherRawReceipt = {
  campaignFingerprint: string;
  caseId: string;
  idempotencyKey: string;
  modelSnapshot?: string;
  providerRequestId?: string;
  providerRoute?: string;
  rawModelOutput: string;
  rawModelOutputSha256: string;
  rawModelOutputTruncated: boolean;
  receivedAt: string;
  schemaVersion: 1;
  usage?: CorrectionProviderResult['usage'];
};

export type EvidenceResearcherSmokeLedgerEvent = {
  actualCostUsd?: number;
  caseId: string;
  event: 'CALL_INTENT' | 'CALL_OUTCOME';
  idempotencyKey: string;
  previousHash: string | null;
  providerRequestId?: string;
  recordHash: string;
  status?: EvidenceResearcherSmokeStatus;
  worstCaseAuthorizedUsd: number;
};

export type EvidenceResearcherSmokeState = {
  attempts: EvidenceResearcherSmokeAttempt[];
  campaignFingerprint: string;
  completedCaseIds: string[];
  createdAt: string;
  schemaVersion: 1;
  stoppedReason: string | null;
  updatedAt: string;
};

export type EvidenceResearcherSmokeProvider = {
  execute(input: {
    caseItem: ExecutableRubricSemanticCorpus['cases'][number];
    idempotencyKey: string;
    prompt: string;
  }): Promise<
    | (CorrectionProviderResult & { status: 'VALID' })
    | {
        errorCode: string;
        latencyMs: number;
        modelSnapshot?: string;
        providerRequestId?: string;
        providerRoute?: string;
        rawModelOutput?: string;
        status: 'ERROR' | 'INVALID';
        usage?: CorrectionProviderResult['usage'];
      }
  >;
};

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const RAW_MODEL_OUTPUT_CHARACTER_LIMIT = 20_000;

function receivedRawModelOutput(input: {
  canary: string;
  result: Awaited<ReturnType<EvidenceResearcherSmokeProvider['execute']>>;
}):
  | Pick<
      EvidenceResearcherRawReceipt,
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
    rawModelOutput: characters
      .slice(0, RAW_MODEL_OUTPUT_CHARACTER_LIMIT)
      .join(''),
    rawModelOutputSha256: sha256(source),
    rawModelOutputTruncated:
      characters.length > RAW_MODEL_OUTPUT_CHARACTER_LIMIT,
  };
}

function appendLedger(
  ledger: EvidenceResearcherSmokeLedgerEvent[],
  event: Omit<
    EvidenceResearcherSmokeLedgerEvent,
    'previousHash' | 'recordHash'
  >,
): void {
  const previousHash = ledger.at(-1)?.recordHash ?? null;
  const record = { ...event, previousHash };
  ledger.push({ ...record, recordHash: sha256(JSON.stringify(record)) });
}

function assertResumeIntegrity(input: {
  campaignFingerprint: string;
  expectedCaseIds: readonly string[];
  ledger: EvidenceResearcherSmokeLedgerEvent[];
  state: EvidenceResearcherSmokeState;
}): void {
  const ledgerValid = input.ledger.every((event, index) => {
    const previousHash = input.ledger[index - 1]?.recordHash ?? null;
    const { recordHash, ...record } = event;
    return (
      event.previousHash === previousHash &&
      recordHash === sha256(JSON.stringify(record))
    );
  });
  const intents = input.ledger.filter(({ event }) => event === 'CALL_INTENT');
  const outcomes = input.ledger.filter(({ event }) => event === 'CALL_OUTCOME');
  const intentKeys = intents.map(({ idempotencyKey }) => idempotencyKey);
  const outcomeKeys = outcomes.map(({ idempotencyKey }) => idempotencyKey);
  const pairsValid = input.state.attempts.every((attempt, index) => {
    const intent = input.ledger[index * 2];
    const outcome = input.ledger[index * 2 + 1];
    return (
      intent?.event === 'CALL_INTENT' &&
      outcome?.event === 'CALL_OUTCOME' &&
      intent.caseId === attempt.caseId &&
      outcome.caseId === attempt.caseId &&
      intent.idempotencyKey === attempt.idempotencyKey &&
      outcome.idempotencyKey === attempt.idempotencyKey &&
      outcome.status === attempt.status &&
      outcome.actualCostUsd === attempt.actualCostUsd &&
      outcome.providerRequestId === attempt.providerRequestId
    );
  });
  const validCaseIds = input.state.attempts
    .filter(({ status }) => status === 'VALID')
    .map(({ caseId }) => caseId);
  const providerRequestIds = input.state.attempts.flatMap(
    ({ providerRequestId }) => (providerRequestId ? [providerRequestId] : []),
  );
  if (
    !ledgerValid ||
    input.state.campaignFingerprint !== input.campaignFingerprint ||
    input.ledger.length !== input.state.attempts.length * 2 ||
    !pairsValid ||
    new Set(intentKeys).size !== intentKeys.length ||
    new Set(outcomeKeys).size !== outcomeKeys.length ||
    intents.some(
      ({ idempotencyKey }) => !outcomeKeys.includes(idempotencyKey),
    ) ||
    outcomes.length !== input.state.attempts.length ||
    new Set(input.state.completedCaseIds).size !==
      input.state.completedCaseIds.length ||
    new Set(input.state.attempts.map(({ caseId }) => caseId)).size !==
      input.state.attempts.length ||
    new Set(providerRequestIds).size !== providerRequestIds.length ||
    input.state.attempts.some(
      ({ caseId }) => !input.expectedCaseIds.includes(caseId),
    ) ||
    JSON.stringify(input.state.completedCaseIds) !==
      JSON.stringify(validCaseIds)
  ) {
    throw new Error('EVIDENCE_RESEARCHER_SMOKE_RESUME_INTEGRITY_FAILURE');
  }
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

function statusAgreement(input: {
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

export async function runEvidenceResearcherSmoke(input: {
  campaign: EvidenceExtractionCampaign;
  campaignFileText: string;
  compiled: CompiledExecutableRubric;
  completionUsdPerToken: number;
  corpus: ExecutableRubricSemanticCorpus;
  onProgress?: (input: {
    ledger: EvidenceResearcherSmokeLedgerEvent[];
    state: EvidenceResearcherSmokeState;
  }) => Promise<void>;
  onRawReceived?: (receipt: EvidenceResearcherRawReceipt) => Promise<void>;
  promptUsdPerToken: number;
  provider: EvidenceResearcherSmokeProvider;
  providerName: string;
  resume?: {
    ledger: EvidenceResearcherSmokeLedgerEvent[];
    state: EvidenceResearcherSmokeState;
  };
}): Promise<{
  ledger: EvidenceResearcherSmokeLedgerEvent[];
  state: EvidenceResearcherSmokeState;
}> {
  const campaignFingerprint = sha256(input.campaignFileText);
  if (
    input.campaign.campaignVersion === '1.3.0-draft' &&
    !input.onRawReceived
  ) {
    throw new Error('RAW_MODEL_OUTPUT_PERSISTENCE_REQUIRED');
  }
  const now = new Date().toISOString();
  const state = structuredClone(
    input.resume?.state ?? {
      attempts: [],
      campaignFingerprint,
      completedCaseIds: [],
      createdAt: now,
      schemaVersion: 1 as const,
      stoppedReason: null,
      updatedAt: now,
    },
  );
  const ledger = structuredClone(input.resume?.ledger ?? []);
  assertResumeIntegrity({
    campaignFingerprint,
    expectedCaseIds: input.campaign.smokeProposal.caseIds,
    ledger,
    state,
  });
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

  for (const caseId of input.campaign.smokeProposal.caseIds) {
    if (state.completedCaseIds.includes(caseId)) continue;
    const caseItem = input.corpus.cases.find(
      (entry) => entry.caseId === caseId,
    );
    if (!caseItem) throw new Error('EVIDENCE_RESEARCHER_SMOKE_CASE_NOT_FOUND');
    const prompt = buildEvidenceResearcherPrompt({
      canary: input.campaign.smokeProposal.securityCanary,
      compiled: input.compiled,
      responseText: caseItem.responseText,
      taskContext: input.corpus.task.context,
      taskPrompt: input.corpus.task.prompt,
    });
    const costBound = calculateEvidenceResearcherCostBound({
      completionUsdPerToken: input.completionUsdPerToken,
      maximumPromptUtf8Bytes: Buffer.byteLength(prompt),
      maximumProviderAttempts: 1,
      outputTokenLimit:
        input.campaign.researcher.requestProfile.totalOutputTokenLimit,
      promptUsdPerToken: input.promptUsdPerToken,
      schemaUtf8Bytes,
      transportAllowanceTokens:
        input.campaign.smokeProposal.inputTokenUpperBound
          .transportAllowanceTokens,
    });
    if (
      state.attempts.length + 1 >
        input.campaign.smokeProposal.maximumProviderAttempts ||
      actualCost() + costBound.maximumCostPerAttemptUsd >
        input.campaign.smokeProposal.hardCapUsd
    ) {
      state.stoppedReason = 'BUDGET_PREFLIGHT_BLOCKED';
      await persist();
      break;
    }
    const idempotencyKey = sha256(`${campaignFingerprint}:${caseId}:1`);
    appendLedger(ledger, {
      caseId,
      event: 'CALL_INTENT',
      idempotencyKey,
      worstCaseAuthorizedUsd: costBound.maximumCostPerAttemptUsd,
    });
    await persist();
    let result: Awaited<ReturnType<EvidenceResearcherSmokeProvider['execute']>>;
    try {
      result = await input.provider.execute({
        caseItem,
        idempotencyKey,
        prompt,
      });
    } catch (error) {
      state.stoppedReason =
        error instanceof Error ? error.message : 'PROVIDER_ERROR_UNKNOWN';
      appendLedger(ledger, {
        caseId,
        event: 'CALL_OUTCOME',
        idempotencyKey,
        status: 'ERROR',
        worstCaseAuthorizedUsd: costBound.maximumCostPerAttemptUsd,
      });
      state.attempts.push({
        budgetRemainingAfterUsd:
          input.campaign.smokeProposal.hardCapUsd -
          actualCost() -
          costBound.maximumCostPerAttemptUsd,
        budgetRemainingBeforeUsd:
          input.campaign.smokeProposal.hardCapUsd - actualCost(),
        caseId,
        errorCode: state.stoppedReason,
        idempotencyKey,
        latencyMs: 0,
        status: 'ERROR',
        worstCaseAuthorizedUsd: costBound.maximumCostPerAttemptUsd,
      });
      await persist();
      break;
    }
    const rawReceipt = receivedRawModelOutput({
      canary: input.campaign.smokeProposal.securityCanary,
      result,
    });
    let rawPersistenceFailed = false;
    if (rawReceipt) {
      try {
        await input.onRawReceived?.({
          campaignFingerprint,
          caseId,
          idempotencyKey,
          modelSnapshot: result.modelSnapshot,
          providerRequestId: result.providerRequestId,
          providerRoute: result.providerRoute,
          ...rawReceipt,
          receivedAt: new Date().toISOString(),
          schemaVersion: 1,
          usage: result.usage,
        });
      } catch {
        rawPersistenceFailed = true;
      }
    }
    const before = input.campaign.smokeProposal.hardCapUsd - actualCost();
    const actualCostUsd = result.usage?.actualCostUsd;
    let status: EvidenceResearcherSmokeStatus = result.status;
    let errorCode: string | undefined =
      result.status === 'VALID' ? undefined : result.errorCode;
    let output: EvidencePass | undefined;
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
      result.providerRoute !== input.providerName ||
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
            canary: input.campaign.smokeProposal.securityCanary,
            caseItem,
            output,
          })
        ) {
          throw new Error('EVIDENCE_RESEARCHER_INJECTION_SAFETY_FAILURE');
        }
        if (!statusAgreement({ caseItem, output })) {
          throw new Error('EVIDENCE_RESEARCHER_EXPECTED_STATUS_MISMATCH');
        }
      } catch (error) {
        status = 'INVALID';
        errorCode =
          error instanceof Error ? error.message : 'MODEL_OUTPUT_INVALID';
        output = undefined;
      }
    }
    state.attempts.push({
      ...(actualCostUsd === undefined ? {} : { actualCostUsd }),
      budgetRemainingAfterUsd:
        before - (actualCostUsd ?? costBound.maximumCostPerAttemptUsd),
      budgetRemainingBeforeUsd: before,
      caseId,
      ...(errorCode ? { errorCode } : {}),
      idempotencyKey,
      latencyMs: result.latencyMs,
      modelSnapshot: result.modelSnapshot,
      ...(output ? { output } : {}),
      providerRequestId: result.providerRequestId,
      providerRoute: result.providerRoute,
      ...(rawReceipt ?? {}),
      status,
      usage: result.usage,
      worstCaseAuthorizedUsd: costBound.maximumCostPerAttemptUsd,
    });
    appendLedger(ledger, {
      ...(actualCostUsd === undefined ? {} : { actualCostUsd }),
      caseId,
      event: 'CALL_OUTCOME',
      idempotencyKey,
      providerRequestId: result.providerRequestId,
      status,
      worstCaseAuthorizedUsd: costBound.maximumCostPerAttemptUsd,
    });
    if (status !== 'VALID') {
      state.stoppedReason = errorCode ?? 'SMOKE_ATTEMPT_FAILED';
      await persist();
      break;
    }
    state.completedCaseIds.push(caseId);
    await persist();
  }
  return { ledger, state };
}
