import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

import type { CorrectionProviderResult } from '../../lib/ai-correction-provider-adapters.ts';
import {
  canonicalJson,
  type EvidenceAssistDevelopmentCampaignManifest,
} from '../../lib/evidence-assist-development-campaign.ts';
import {
  type EvidenceAssistDefectClass,
  type EvidenceAssistDevelopmentAttempt,
  evaluateEvidenceAssistAttempt,
  evidenceAssistStopDecision,
} from '../../lib/evidence-assist-development-evaluator.ts';
import type { CompiledExecutableRubric } from '../../lib/executable-rubric-engine.ts';
import type { SelectedExecutableRubricSemanticCorpus } from '../../lib/executable-rubric-semantic-selection.ts';
import {
  evidenceAssistJsonSchema,
  prepareEvidenceAssistRequest,
  validateEvidenceAssistOutput,
} from '../../lib/evidence-assist-protocol.ts';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const nonnegativeFiniteSchema = z.number().finite().nonnegative();
const MAX_AUTHORIZATION_LIFETIME_MS = 15 * 60 * 1_000;
const verifiedAuthorizations = new WeakSet<object>();

const authorizationCoreSchema = z
  .object({
    authorizationId: z.string().trim().min(12),
    campaignId: z.string().trim().min(1),
    executionIdentityFingerprint: sha256Schema,
    expiresAt: z.string().datetime({ offset: true }),
    financeArbitration: z.literal('GRANTED'),
    grantedAt: z.string().datetime({ offset: true }),
    maximumCampaignCostUsd: nonnegativeFiniteSchema,
    maximumProviderAttempts: z.number().int().positive(),
    nonceSha256: sha256Schema,
    ownerAuthorization: z.literal('GRANTED'),
    purpose: z.literal('EVIDENCE_ASSIST_DEVELOPMENT_ONLY'),
    schemaVersion: z.literal(1),
    singleUse: z.literal(true),
    stage: z.enum(['CONDITIONAL_PANEL_10X2', 'FOUR_CASE_GATE']),
  })
  .strict();

export const evidenceAssistEphemeralAuthorizationSchema =
  authorizationCoreSchema
    .extend({ signatureSha256: sha256Schema })
    .strict();

export type EvidenceAssistEphemeralAuthorization = z.infer<
  typeof evidenceAssistEphemeralAuthorizationSchema
>;

type EvidenceAssistAuthorizationCore = z.infer<typeof authorizationCoreSchema>;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function signature(input: {
  authorization: EvidenceAssistAuthorizationCore;
  signingSecret: string;
}): string {
  return createHmac('sha256', input.signingSecret)
    .update(canonicalJson(input.authorization))
    .digest('hex');
}

function requireStrongSecret(value: string, code: string): void {
  if (Buffer.byteLength(value) < 32) throw new Error(code);
}

export function createEvidenceAssistEphemeralAuthorization(input: {
  authorization: EvidenceAssistAuthorizationCore;
  signingSecret: string;
}): EvidenceAssistEphemeralAuthorization {
  requireStrongSecret(
    input.signingSecret,
    'EVIDENCE_ASSIST_AUTHORIZATION_SIGNING_SECRET_WEAK',
  );
  const authorization = authorizationCoreSchema.parse(input.authorization);
  return evidenceAssistEphemeralAuthorizationSchema.parse({
    ...authorization,
    signatureSha256: signature({ authorization, signingSecret: input.signingSecret }),
  });
}

export function verifyEvidenceAssistEphemeralAuthorization(input: {
  authorization: EvidenceAssistEphemeralAuthorization;
  campaign: EvidenceAssistDevelopmentCampaignManifest;
  executionIdentityFingerprint: string;
  nonce: string;
  now: string;
  signingSecret: string;
}): EvidenceAssistEphemeralAuthorization {
  requireStrongSecret(
    input.signingSecret,
    'EVIDENCE_ASSIST_AUTHORIZATION_SIGNING_SECRET_WEAK',
  );
  requireStrongSecret(input.nonce, 'EVIDENCE_ASSIST_AUTHORIZATION_NONCE_WEAK');
  const authorization = evidenceAssistEphemeralAuthorizationSchema.parse(
    input.authorization,
  );
  const { signatureSha256, ...core } = authorization;
  const expected = signature({
    authorization: authorizationCoreSchema.parse(core),
    signingSecret: input.signingSecret,
  });
  if (
    !timingSafeEqual(
      Buffer.from(signatureSha256, 'hex'),
      Buffer.from(expected, 'hex'),
    )
  ) {
    throw new Error('EVIDENCE_ASSIST_AUTHORIZATION_SIGNATURE_INVALID');
  }
  const now = Date.parse(input.now);
  const grantedAt = Date.parse(authorization.grantedAt);
  const expiresAt = Date.parse(authorization.expiresAt);
  if (
    !Number.isFinite(now) ||
    now < grantedAt ||
    now >= expiresAt ||
    expiresAt - grantedAt > MAX_AUTHORIZATION_LIFETIME_MS
  ) {
    throw new Error('EVIDENCE_ASSIST_AUTHORIZATION_EXPIRED_OR_NOT_YET_VALID');
  }
  if (
    authorization.nonceSha256 !== sha256(input.nonce) ||
    authorization.campaignId !== input.campaign.campaignId ||
    authorization.stage !== input.campaign.stage ||
    authorization.executionIdentityFingerprint !==
      input.executionIdentityFingerprint ||
    authorization.maximumCampaignCostUsd !==
      input.campaign.budgetProposal.maximumCampaignCostUsd ||
    authorization.maximumProviderAttempts !==
      input.campaign.execution.maximumProviderAttempts
  ) {
    throw new Error('EVIDENCE_ASSIST_AUTHORIZATION_SCOPE_MISMATCH');
  }
  verifiedAuthorizations.add(authorization);
  return authorization;
}

export type EvidenceAssistDevelopmentProvider = {
  execute(input: {
    caseId: string;
    idempotencyKey: string;
    jsonSchema: Record<string, unknown>;
    messages: readonly { content: string; role: 'system' | 'user' }[];
    repetition: 1 | 2;
  }): Promise<
    CorrectionProviderResult & { transportOutputErrorCode?: string }
  >;
};

export type EvidenceAssistDevelopmentLedgerEvent = Readonly<{
  actualCostUsd: number | null;
  caseId: string;
  event: 'CALL_INTENT' | 'CALL_OUTCOME';
  idempotencyKey: string;
  previousHash: string | null;
  providerRequestId: string | null;
  recordHash: string;
  repetition: 1 | 2;
  status: 'ERROR' | 'INTENDED' | 'INVALID' | 'VALID';
}>;

export type EvidenceAssistDevelopmentRunResult = Readonly<{
  attempts: EvidenceAssistDevelopmentAttempt[];
  authorizationId: string;
  forceNoGo: boolean;
  ledger: EvidenceAssistDevelopmentLedgerEvent[];
  stoppedReason: EvidenceAssistDefectClass | null;
}>;

function appendLedger(
  ledger: EvidenceAssistDevelopmentLedgerEvent[],
  event: Omit<
    EvidenceAssistDevelopmentLedgerEvent,
    'previousHash' | 'recordHash'
  >,
): void {
  const previousHash = ledger.at(-1)?.recordHash ?? null;
  const record = { ...event, previousHash };
  ledger.push(
    Object.freeze({
      ...record,
      recordHash: sha256(canonicalJson(record)),
    }),
  );
}

function requestContextSha256(value: unknown): string {
  return sha256(canonicalJson(value));
}

function providerFailureAttempt(input: {
  caseId: string;
  executionIdentityFingerprint: string;
  repetition: 1 | 2;
  requestContextFingerprint: string;
  requestContextSha256: string;
  requestedRoute: string;
  validationErrorCode: string;
}): EvidenceAssistDevelopmentAttempt {
  return {
    actualCostUsd: null,
    caseId: input.caseId,
    costSource: 'UNKNOWN',
    dispatchState: 'ORPHANED',
    executionIdentityFingerprint: input.executionIdentityFingerprint,
    financialState: 'RECONCILIATION_REQUIRED',
    observedProvider: null,
    providerRequestId: null,
    rawModelOutput: null,
    rawModelOutputSha256: null,
    rawPersistedBeforeValidation: false,
    repetition: input.repetition,
    requestContextFingerprint: input.requestContextFingerprint,
    requestContextSha256: input.requestContextSha256,
    requestedRoute: input.requestedRoute,
    status: 'ERROR',
    validationErrorCode: input.validationErrorCode,
    validationResult: null,
  };
}

export async function runEvidenceAssistDevelopmentCampaign(input: {
  authorization: EvidenceAssistEphemeralAuthorization;
  campaign: EvidenceAssistDevelopmentCampaignManifest;
  compiled: CompiledExecutableRubric;
  corpus: Pick<SelectedExecutableRubricSemanticCorpus, 'cases' | 'task'>;
  executionIdentityFingerprint: string;
  onAuthorizationConsumed: (input: {
    authorizationId: string;
    executionIdentityFingerprint: string;
  }) => Promise<void>;
  onProgress?: (input: EvidenceAssistDevelopmentRunResult) => Promise<void>;
  onRawReceived: (input: {
    actualCostUsd: number | null;
    caseId: string;
    costSource: 'ACTUAL' | 'ESTIMATED';
    idempotencyKey: string;
    modelSnapshot: string;
    observedProvider: string;
    providerRequestId: string | null;
    rawModelOutput: string;
    rawModelOutputSha256: string;
    repetition: 1 | 2;
    requestContextFingerprint: string;
    requestContextSha256: string;
    requestedRoute: string;
  }) => Promise<void>;
  provider: EvidenceAssistDevelopmentProvider;
}): Promise<EvidenceAssistDevelopmentRunResult> {
  if (!verifiedAuthorizations.has(input.authorization)) {
    throw new Error('EVIDENCE_ASSIST_AUTHORIZATION_NOT_VERIFIED');
  }
  await input.onAuthorizationConsumed({
    authorizationId: input.authorization.authorizationId,
    executionIdentityFingerprint: input.executionIdentityFingerprint,
  });
  const attempts: EvidenceAssistDevelopmentAttempt[] = [];
  const ledger: EvidenceAssistDevelopmentLedgerEvent[] = [];
  let forceNoGo = false;
  let stoppedReason: EvidenceAssistDefectClass | null = null;
  const cells = input.campaign.execution.caseIds.flatMap((caseId) =>
    Array.from(
      { length: input.campaign.execution.repetitionsPerCase },
      (_, index) => ({ caseId, repetition: (index + 1) as 1 | 2 }),
    ),
  );
  const persist = async () =>
    input.onProgress?.({
      attempts: structuredClone(attempts),
      authorizationId: input.authorization.authorizationId,
      forceNoGo,
      ledger: structuredClone(ledger),
      stoppedReason,
    });
  const actualCost = () =>
    attempts.reduce((sum, attempt) => sum + (attempt.actualCostUsd ?? 0), 0);
  for (const cell of cells) {
    if (
      attempts.length + 1 > input.authorization.maximumProviderAttempts ||
      actualCost() +
        input.campaign.budgetProposal.maximumCostPerAttemptUsd >
        input.authorization.maximumCampaignCostUsd
    ) {
      forceNoGo = true;
      stoppedReason = 'BUDGET';
      await persist();
      break;
    }
    const caseItem = input.corpus.cases.find(
      ({ caseId }) => caseId === cell.caseId,
    );
    if (!caseItem) throw new Error('EVIDENCE_ASSIST_RUNNER_CASE_MISSING');
    const prepared = prepareEvidenceAssistRequest({
      compiled: input.compiled,
      responseText: caseItem.responseText,
      taskContext: input.corpus.task.context,
      taskPrompt: input.corpus.task.prompt,
    });
    const contextSha256 = requestContextSha256(prepared.requestContext);
    const idempotencyKey = sha256(
      `${input.executionIdentityFingerprint}:${cell.caseId}:${cell.repetition}`,
    );
    appendLedger(ledger, {
      actualCostUsd: null,
      caseId: cell.caseId,
      event: 'CALL_INTENT',
      idempotencyKey,
      providerRequestId: null,
      repetition: cell.repetition,
      status: 'INTENDED',
    });
    await persist();
    let providerResult: Awaited<
      ReturnType<EvidenceAssistDevelopmentProvider['execute']>
    >;
    try {
      providerResult = await input.provider.execute({
        caseId: cell.caseId,
        idempotencyKey,
        jsonSchema: evidenceAssistJsonSchema(),
        messages: prepared.messages,
        repetition: cell.repetition,
      });
    } catch (error) {
      const attempt = providerFailureAttempt({
        caseId: cell.caseId,
        executionIdentityFingerprint: input.executionIdentityFingerprint,
        repetition: cell.repetition,
        requestContextFingerprint: prepared.requestContext.contextFingerprint,
        requestContextSha256: contextSha256,
        requestedRoute: input.campaign.identity.requestedRoute,
        validationErrorCode:
          error instanceof Error ? error.message : 'PROVIDER_FAILURE_UNKNOWN',
      });
      attempts.push(attempt);
      appendLedger(ledger, {
        actualCostUsd: null,
        caseId: cell.caseId,
        event: 'CALL_OUTCOME',
        idempotencyKey,
        providerRequestId: null,
        repetition: cell.repetition,
        status: 'ERROR',
      });
      forceNoGo = true;
      stoppedReason = 'FINANCE';
      await persist();
      break;
    }
    const raw = providerResult.rawModelOutput;
    const rawSha256 = sha256(raw);
    let rawPersisted = true;
    try {
      await input.onRawReceived({
        actualCostUsd: providerResult.usage.actualCostUsd ?? null,
        caseId: cell.caseId,
        costSource: providerResult.usage.costSource,
        idempotencyKey,
        modelSnapshot: providerResult.modelSnapshot,
        observedProvider: providerResult.observedProvider,
        providerRequestId: providerResult.providerRequestId ?? null,
        rawModelOutput: raw,
        rawModelOutputSha256: rawSha256,
        repetition: cell.repetition,
        requestContextFingerprint: prepared.requestContext.contextFingerprint,
        requestContextSha256: contextSha256,
        requestedRoute: providerResult.requestedRoute,
      });
    } catch {
      rawPersisted = false;
    }
    let validationResult = null;
    let validationErrorCode: string | null =
      providerResult.transportOutputErrorCode ?? null;
    try {
      validationResult = validateEvidenceAssistOutput({
        compiled: input.compiled,
        pipelineFingerprintSeed: input.executionIdentityFingerprint,
        rawModelOutput: raw,
        requestContext: prepared.requestContext,
        responseText: caseItem.responseText,
      });
    } catch (error) {
      validationErrorCode ??=
        error instanceof Error ? error.message : 'MODEL_OUTPUT_INVALID';
    }
    const actualCostUsd = providerResult.usage.actualCostUsd ?? null;
    const costSettled =
      actualCostUsd !== null &&
      providerResult.usage.costSource === 'ACTUAL' &&
      providerResult.providerRequestId !== undefined;
    const identityMatches =
      providerResult.observedProvider ===
        input.campaign.identity.expectedObservedProvider &&
      providerResult.requestedRoute === input.campaign.identity.requestedRoute &&
      (providerResult.modelSnapshot === input.campaign.identity.catalogSnapshotId ||
        providerResult.modelSnapshot === input.campaign.identity.wireModelId);
    const status =
      validationResult !== null &&
      validationErrorCode === null &&
      rawPersisted &&
      costSettled &&
      identityMatches
        ? 'VALID'
        : validationResult === null
          ? 'INVALID'
          : 'ERROR';
    const attempt: EvidenceAssistDevelopmentAttempt = {
      actualCostUsd,
      caseId: cell.caseId,
      costSource:
        providerResult.usage.costSource === 'ACTUAL' && actualCostUsd !== null
          ? 'ACTUAL'
          : 'UNKNOWN',
      dispatchState: 'CONFIRMED',
      executionIdentityFingerprint: input.executionIdentityFingerprint,
      financialState: costSettled ? 'SETTLED' : 'RECONCILIATION_REQUIRED',
      observedProvider: providerResult.observedProvider,
      providerRequestId: providerResult.providerRequestId ?? null,
      rawModelOutput: raw,
      rawModelOutputSha256: rawSha256,
      rawPersistedBeforeValidation: rawPersisted,
      repetition: cell.repetition,
      requestContextFingerprint: prepared.requestContext.contextFingerprint,
      requestContextSha256: contextSha256,
      requestedRoute: providerResult.requestedRoute,
      status,
      validationErrorCode:
        validationErrorCode ??
        (!rawPersisted
          ? 'RAW_MODEL_OUTPUT_PERSISTENCE_FAILED'
          : !costSettled
            ? 'COST_RECONCILIATION_REQUIRED'
            : !identityMatches
              ? 'EVIDENCE_ASSIST_PROVIDER_IDENTITY_MISMATCH'
              : null),
      validationResult,
    };
    attempts.push(attempt);
    appendLedger(ledger, {
      actualCostUsd,
      caseId: cell.caseId,
      event: 'CALL_OUTCOME',
      idempotencyKey,
      providerRequestId: providerResult.providerRequestId ?? null,
      repetition: cell.repetition,
      status,
    });
    const evaluated = evaluateEvidenceAssistAttempt({
      attempt,
      caseItem,
      expectedExecutionIdentityFingerprint:
        input.executionIdentityFingerprint,
      expectedObservedProvider: input.campaign.identity.expectedObservedProvider,
    });
    const decision = evidenceAssistStopDecision({
      defectClasses: evaluated.defectClasses,
      stage: input.campaign.stage,
    });
    forceNoGo ||= decision.forceNoGo;
    stoppedReason = decision.shouldStop ? decision.stopClass : null;
    await persist();
    if (decision.shouldStop) break;
  }
  return Object.freeze({
    attempts,
    authorizationId: input.authorization.authorizationId,
    forceNoGo,
    ledger,
    stoppedReason,
  });
}
