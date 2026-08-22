import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { z } from 'zod';

import {
  EVIDENCE_ASSIST_GEMINI_WIRE_DIALECT,
  EVIDENCE_ASSIST_GEMINI_WIRE_DIALECT_VERSION,
  EVIDENCE_ASSIST_PROTOCOL_VERSION,
  evidenceAssistGeminiWireJsonSchema,
  evidenceAssistGeminiWireSchemaFingerprint,
} from '../../lib/evidence-assist-protocol.js';
import type { OpenRouterMetadata } from '../../lib/ai-correction-provider-adapters.js';
import {
  canonicalJsonV2,
  evidenceAssistJsonSchema,
  prepareEvidenceAssistRequestV2,
  validateEvidenceAssistOutputV2,
  type EvidenceAssistRequestContextV2,
  type EvidenceAssistValidationResultV2,
} from '../../lib/evidence-assist-protocol-v2-adapter.js';
import {
  compileExecutableRubricV2,
  type CompiledExecutableRubricV2,
} from '../../lib/executable-rubric-engine-v2.js';
import {
  mechanicalOracleV21Schema,
  validateMechanicalOracleV21,
  type MechanicalOracleV21,
} from '../../lib/executable-rubric-mechanical-oracle-v2-1.js';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const CLOSED_GEMINI_Q1_IDENTITY =
  'ef88a8e3b1bfd57ddc4afe787d8a920ea4b329e3d83b28b3fc4029487e88e9ed';
const defectSchema = z.enum([
  'BUDGET',
  'FINANCE',
  'IDENTITY',
  'LOCAL_FINDING_REJECTION',
  'MODEL_OUTPUT_INVALID',
  'SAFETY',
  'SEMANTIC_DISAGREEMENT',
  'TRACEABILITY',
]);

export type WritingGateDefect = z.infer<typeof defectSchema>;

const authoritySchema = z
  .object({ path: z.string().min(1), sha256: sha256Schema })
  .passthrough();

const frozenDossierSchema = z
  .object({
    authorities: z.record(z.string(), authoritySchema),
    corpus: z
      .object({
        gateFour: z
          .array(z.object({ caseId: z.string().min(1) }).passthrough())
          .length(4),
        responseConstruction: z.literal(
          'JOIN_RESPONSE_SEGMENT_TEXTS_WITH_SINGLE_LF_IN_MANIFEST_ORDER',
        ),
      })
      .passthrough(),
    corpusFingerprint: sha256Schema,
    identityCore: z
      .object({
        catalogSnapshotId: z.string().min(1),
        expectedObservedProvider: z.string().min(1),
        maxOutputTokens: z.number().int().positive(),
        oracleFingerprint: sha256Schema,
        reasoning: z
          .object({
            effort: z.string().min(1).optional(),
            mandatory: z.boolean().optional(),
            mode: z.string().min(1),
          })
          .passthrough(),
        requestedRoute: z.string().min(1),
        rubricFingerprint: sha256Schema,
        temperature: z.number().nullable(),
        timeoutMs: z.number().int().positive(),
        visibleOutputTokenTarget: z.number().int().positive().optional(),
        wireModelId: z.string().min(1),
      })
      .passthrough(),
    identityFingerprint: sha256Schema,
    runnerContract: z
      .object({
        dispatch: z
          .object({
            fallbackAllowed: z.literal(false),
            maximumRetriesPerWorkflow: z.literal(0),
            sequentialOnly: z.literal(true),
          })
          .passthrough(),
        finance: z
          .object({
            actualCostRequired: z.literal(true),
            nullCostMayNeverSettleAsZero: z.literal(true),
            nullCostState: z.literal('RECONCILIATION_REQUIRED'),
          })
          .passthrough(),
        requestPreparation: z
          .object({ compileRubricWith: z.literal('executable-rubric/v2') })
          .passthrough(),
        validation: z
          .object({ rawPersistedBeforeValidation: z.literal(true) })
          .passthrough(),
      })
      .passthrough(),
    runnerContractFingerprint: sha256Schema,
    semanticMapping: z.record(z.string(), z.unknown()),
    semanticMappingFingerprint: sha256Schema,
    stopPolicy: z
      .object({
        gateFour: z
          .object({
            immediateStopDefectClasses: z.array(defectSchema),
            requiredUsableWorkflows: z.literal('4/4'),
            stopOnFirstDefect: z.literal(true),
          })
          .passthrough(),
      })
      .passthrough(),
    stopPolicyFingerprint: sha256Schema,
    telemetryContract: z.record(z.string(), z.unknown()),
    telemetryContractFingerprint: sha256Schema,
  })
  .passthrough();

const financeEnvelopeSchema = z
  .object({
    authorizationBoundary: z
      .object({
        modelCallsAllowed: z.literal(false),
        ownerNetworkAuthorization: z.literal('NOT_GRANTED'),
        runnerImplementationVerified: z.literal(false),
      })
      .passthrough(),
    campaign: z.object({
      dossierPath: z.string().min(1),
      dossierSha256: sha256Schema,
      identityFingerprint: sha256Schema,
    }),
    gateBound: z.object({
      maximumFallbacks: z.literal(0),
      maximumProviderAttempts: z.literal(4),
      maximumProviderCostUsd: z.number().positive(),
      maximumRetriesPerWorkflow: z.literal(0),
      stopOnFirstDefect: z.literal(true),
    }),
    perAttemptBound: z.object({
      maximumCostUsd: z.number().positive(),
      maximumPromptUtf8Bytes: z.literal(65_536),
    }),
    reconciliationPolicy: z
      .object({
        actualCostRequiredPerSentAttempt: z.literal(true),
        missingActualCostMaySettleAsZero: z.literal(false),
        missingActualCostState: z.literal('RECONCILIATION_REQUIRED'),
      })
      .passthrough(),
  })
  .passthrough();

type FrozenDossier = z.infer<typeof frozenDossierSchema>;
type FinanceEnvelope = z.infer<typeof financeEnvelopeSchema>;
type FindingSpec = MechanicalOracleV21['baselineFindings'][string];

type ExpectedFinding = Readonly<{
  elementKey: string;
  evidenceTexts: readonly string[];
  relation: 'EVIDENCE_AGAINST_ELEMENT' | 'EVIDENCE_FOR_ELEMENT';
}>;

export type WritingFrameworkGateCase = Readonly<{
  caseId: string;
  expectedFindings: readonly ExpectedFinding[];
  responseText: string;
  untrustedSegmentTexts: readonly string[];
}>;

export type WritingFrameworkGatePackage = Readonly<{
  cases: readonly WritingFrameworkGateCase[];
  compiled: CompiledExecutableRubricV2;
  catalogSnapshotId: string;
  expectedObservedProvider: string;
  finance: FinanceEnvelope;
  identityFingerprint: string;
  maximumPromptUtf8Bytes: 65_536;
  requestedRoute: string;
  requestProfile: Readonly<{
    maxOutputTokens: number;
    reasoningEffort: string | null;
    reasoningMandatory: boolean;
    reasoningMode: string;
    temperature: number | null;
    timeoutMs: number;
    visibleOutputTokenTarget: number;
  }>;
  taskContext: string;
  taskPrompt: string;
  wireModelId: string;
}>;

export type WritingGateFinancialState =
  | 'CONSERVATIVE_WRITE_OFF'
  | 'OFFLINE_NOT_APPLICABLE'
  | 'RECONCILED'
  | 'RECONCILIATION_REQUIRED';

export type WritingGateCostSource =
  'ACTUAL' | 'CONSERVATIVE_WRITE_OFF' | 'OFFLINE_FAKE' | 'UNKNOWN';

type WritingGateLiveAuthorizationProofCore = Readonly<{
  authorizationFingerprint: string;
  identityFingerprint: string;
  outputDirectory: string;
  runId: string;
  schemaVersion: 1;
}>;

export type WritingGateLiveAuthorizationProof =
  WritingGateLiveAuthorizationProofCore & Readonly<{ proofSha256: string }>;

export type WritingGateAttempt = Readonly<{
  actualCostUsd: number | null;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  caseId: string;
  clientRequestId: string;
  costSource: WritingGateCostSource;
  defectClasses: readonly WritingGateDefect[];
  dispatchState: 'CONFIRMED' | 'ORPHANED' | 'PENDING';
  errorCode: string | null;
  financialState: WritingGateFinancialState;
  generationId: string | null;
  idempotencyKey: string;
  inputTokens: number;
  latencyMs: number;
  messageUtf8Bytes: number;
  observedProvider: string | null;
  openRouterMetadata: OpenRouterMetadata | null;
  providerRequestId: string | null;
  rawOutputSha256: string | null;
  rawPersistedBeforeValidation: boolean;
  reasoningTokens: number;
  repetition: 1;
  requestContextFingerprint: string;
  requestedRoute: string;
  status: 'INVALID' | 'VALID';
  validation: EvidenceAssistValidationResultV2 | null;
  visibleOutputTokens: number;
}>;

export type WritingGateLedgerEvent = Readonly<{
  authorizationFingerprint?: string;
  authorizationProofSha256?: string;
  caseId: string;
  event:
    | 'CALL_INTENT'
    | 'CALL_OUTCOME'
    | 'LIVE_AUTHORIZATION_CONSUMED'
    | 'RAW_RECEIVED'
    | 'REQUEST_MANIFEST';
  idempotencyKey: string;
  previousHash: string | null;
  rawOutputSha256?: string;
  recordHash: string;
  requestManifestSha256?: string;
}>;

export type WritingGateWireDialect =
  typeof EVIDENCE_ASSIST_GEMINI_WIRE_DIALECT | 'EVIDENCE_ASSIST_LOCAL_3_0_0';

type WritingGateRequestManifestCore = Readonly<{
  caseId: string;
  idempotencyKey: string;
  identityFingerprint: string;
  requestContextFingerprint: string;
  schemaVersion: 1;
  transportManifest: Readonly<Record<string, unknown>>;
  transportManifestSha256: string;
  wireDialect: WritingGateWireDialect;
  wireDialectVersion: string;
  wireSchemaSha256: string;
}>;

export type WritingGateRequestManifest = WritingGateRequestManifestCore &
  Readonly<{ manifestSha256: string }>;

export interface WritingFrameworkGateStore {
  consumeLiveAuthorization(
    proof: WritingGateLiveAuthorizationProof,
  ): Promise<'CREATED' | 'EXISTS'>;
  appendRequestManifest(
    manifest: WritingGateRequestManifest,
  ): Promise<'CREATED' | 'EXISTS'>;
  appendCallIntent(input: {
    caseId: string;
    idempotencyKey: string;
    requestManifestSha256: string;
  }): Promise<'CREATED' | 'EXISTS'>;
  appendOutcome(attempt: WritingGateAttempt): Promise<void>;
  appendRaw(input: {
    caseId: string;
    idempotencyKey: string;
    rawOutput: string;
  }): Promise<void>;
  findOutcome(idempotencyKey: string): Promise<WritingGateAttempt | null>;
  ledger(): readonly WritingGateLedgerEvent[];
}

export type WritingFrameworkGateProviderRequestCore = Readonly<{
  caseId: string;
  idempotencyKey: string;
  jsonSchema: Readonly<Record<string, unknown>>;
  messages: EvidenceAssistRequestContextV2['messages'];
  requestContext: EvidenceAssistRequestContextV2;
}>;

export type WritingFrameworkGateProviderRequest =
  WritingFrameworkGateProviderRequestCore &
    Readonly<{ requestManifest: WritingGateRequestManifest }>;

export type WritingFrameworkGateProviderResult = Readonly<{
  actualCostUsd: number | null;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  clientRequestId: string | null;
  costSource: WritingGateCostSource;
  errorCode?: string;
  generationId: string | null;
  inputTokens: number;
  latencyMs: number;
  observedProvider: string | null;
  openRouterMetadata: OpenRouterMetadata | null;
  providerRequestId: string | null;
  rawOutput: string;
  reasoningTokens: number;
  visibleOutputTokens: number;
}>;

export interface WritingFrameworkGateOfflineProvider {
  readonly kind: 'OFFLINE_FAKE';
  prepare(
    request: WritingFrameworkGateProviderRequestCore,
  ): WritingGateRequestManifest;
  execute(
    request: WritingFrameworkGateProviderRequest,
  ): Promise<WritingFrameworkGateProviderResult>;
}

export interface WritingFrameworkGateLiveProvider {
  readonly authorizationProof: WritingGateLiveAuthorizationProof;
  readonly kind: 'OPENROUTER_LIVE';
  readonly authorizedIdentityFingerprint: string;
  prepare(
    request: WritingFrameworkGateProviderRequestCore,
  ): WritingGateRequestManifest;
  execute(
    request: WritingFrameworkGateProviderRequest,
  ): Promise<WritingFrameworkGateProviderResult>;
}

export type WritingFrameworkGateRun = Readonly<{
  attempts: readonly WritingGateAttempt[];
  forceNoGo: boolean;
  ledger: readonly WritingGateLedgerEvent[];
  mode: 'OFFLINE_FAKE_ONLY' | 'OPENROUTER_LIVE';
  modelCallsPerformed: number;
  networkCallsAllowed: boolean;
  providerExecutions: number;
  stoppedReason: WritingGateDefect | null;
  usableWorkflows: number;
}>;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function fingerprint(value: unknown): string {
  return sha256(canonicalJsonV2(value));
}

export function createWritingGateLiveAuthorizationProof(input: {
  authorizationFingerprint: string;
  identityFingerprint: string;
  outputDirectory: string;
  runId: string;
}): WritingGateLiveAuthorizationProof {
  if (
    !sha256Schema.safeParse(input.authorizationFingerprint).success ||
    !sha256Schema.safeParse(input.identityFingerprint).success ||
    input.outputDirectory.trim().length === 0 ||
    input.runId.trim().length === 0
  ) {
    throw new Error('WRITING_GATE_LIVE_AUTHORIZATION_PROOF_INVALID');
  }
  const core: WritingGateLiveAuthorizationProofCore = Object.freeze({
    authorizationFingerprint: input.authorizationFingerprint,
    identityFingerprint: input.identityFingerprint,
    outputDirectory: resolve(input.outputDirectory),
    runId: input.runId,
    schemaVersion: 1,
  });
  return Object.freeze({ ...core, proofSha256: fingerprint(core) });
}

export function assertWritingGateLiveAuthorizationProof(
  proof: WritingGateLiveAuthorizationProof,
): void {
  const { proofSha256, ...core } = proof;
  if (
    core.schemaVersion !== 1 ||
    !sha256Schema.safeParse(core.authorizationFingerprint).success ||
    !sha256Schema.safeParse(core.identityFingerprint).success ||
    core.outputDirectory.trim().length === 0 ||
    resolve(core.outputDirectory) !== core.outputDirectory ||
    core.runId.trim().length === 0 ||
    !sha256Schema.safeParse(proofSha256).success ||
    fingerprint(core) !== proofSha256
  ) {
    throw new Error('WRITING_GATE_LIVE_AUTHORIZATION_PROOF_INVALID');
  }
}

function assertSanitizedTransportManifest(
  value: Readonly<Record<string, unknown>>,
): void {
  const forbiddenKeys = new Set([
    'accesstoken',
    'authorization',
    'body',
    'content',
    'cookie',
    'headers',
    'apikey',
    'messages',
    'password',
    'profile',
    'prompt',
    'rawoutput',
    'rawresponse',
    'refreshtoken',
    'requestbody',
    'secret',
    'submission',
  ]);
  const normalizeKey = (key: string): string =>
    key.toLocaleLowerCase().replaceAll(/[-_\s]/gu, '');
  const visit = (current: unknown): void => {
    if (typeof current === 'string' && /(?:^|\s)bearer\s+\S+/iu.test(current)) {
      throw new Error('WRITING_GATE_REQUEST_MANIFEST_BEARER_VALUE');
    }
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (typeof current !== 'object' || current === null) return;
    for (const [key, child] of Object.entries(
      current as Record<string, unknown>,
    )) {
      if (forbiddenKeys.has(normalizeKey(key))) {
        throw new Error('WRITING_GATE_REQUEST_MANIFEST_SENSITIVE_FIELD');
      }
      visit(child);
    }
  };
  visit(value);
  const headerNames = value.persistedSafeHeaderNames;
  if (
    Array.isArray(headerNames) &&
    headerNames.some(
      (name) =>
        typeof name === 'string' &&
        ['authorization', 'cookie', 'xapikey'].includes(normalizeKey(name)),
    )
  ) {
    throw new Error('WRITING_GATE_REQUEST_MANIFEST_SECRET_HEADER');
  }
}

export function createWritingGateRequestManifest(input: {
  caseId: string;
  idempotencyKey: string;
  identityFingerprint: string;
  requestContextFingerprint: string;
  transportManifest: Readonly<Record<string, unknown>> & {
    manifestSha256: string;
  };
  wireDialect: WritingGateWireDialect;
  wireDialectVersion: string;
  wireSchemaSha256: string;
}): WritingGateRequestManifest {
  assertSanitizedTransportManifest(input.transportManifest);
  const { manifestSha256: transportManifestSha256, ...transportCore } =
    input.transportManifest;
  if (fingerprint(transportCore) !== transportManifestSha256) {
    throw new Error('WRITING_GATE_TRANSPORT_MANIFEST_HASH_MISMATCH');
  }
  const core: WritingGateRequestManifestCore = {
    caseId: input.caseId,
    idempotencyKey: input.idempotencyKey,
    identityFingerprint: input.identityFingerprint,
    requestContextFingerprint: input.requestContextFingerprint,
    schemaVersion: 1,
    transportManifest: structuredClone(input.transportManifest),
    transportManifestSha256,
    wireDialect: input.wireDialect,
    wireDialectVersion: input.wireDialectVersion,
    wireSchemaSha256: input.wireSchemaSha256,
  };
  return Object.freeze({
    ...core,
    manifestSha256: fingerprint(core),
  });
}

function assertRequestManifestIntegrity(
  manifest: WritingGateRequestManifest,
): void {
  const { manifestSha256, ...core } = manifest;
  if (fingerprint(core) !== manifestSha256) {
    throw new Error('WRITING_GATE_REQUEST_MANIFEST_HASH_MISMATCH');
  }
  assertSanitizedTransportManifest(manifest.transportManifest);
  const transportHash = manifest.transportManifest.manifestSha256;
  if (typeof transportHash !== 'string') {
    throw new Error('WRITING_GATE_TRANSPORT_MANIFEST_HASH_MISSING');
  }
  const transportCore: Record<string, unknown> = {
    ...manifest.transportManifest,
  };
  delete transportCore.manifestSha256;
  if (
    transportHash !== manifest.transportManifestSha256 ||
    fingerprint(transportCore) !== transportHash
  ) {
    throw new Error('WRITING_GATE_TRANSPORT_MANIFEST_HASH_MISMATCH');
  }
}

function writingGateWireContract(
  packageInput: WritingFrameworkGatePackage,
): Readonly<{
  dialect: WritingGateWireDialect;
  dialectVersion: string;
  jsonSchema: Readonly<Record<string, unknown>>;
  schemaSha256: string;
}> {
  if (packageInput.wireModelId.startsWith('google/gemini-')) {
    return Object.freeze({
      dialect: EVIDENCE_ASSIST_GEMINI_WIRE_DIALECT,
      dialectVersion: EVIDENCE_ASSIST_GEMINI_WIRE_DIALECT_VERSION,
      jsonSchema: evidenceAssistGeminiWireJsonSchema(),
      schemaSha256: evidenceAssistGeminiWireSchemaFingerprint(),
    });
  }
  const jsonSchema = evidenceAssistJsonSchema();
  return Object.freeze({
    dialect: 'EVIDENCE_ASSIST_LOCAL_3_0_0',
    dialectVersion: EVIDENCE_ASSIST_PROTOCOL_VERSION,
    jsonSchema,
    schemaSha256: fingerprint(jsonSchema),
  });
}

function required<T>(value: T | undefined, code: string): T {
  if (value === undefined) throw new Error(code);
  return value;
}

function verifyDossierFingerprints(dossier: FrozenDossier): void {
  const pairs: Array<[unknown, string, string]> = [
    [dossier.identityCore, dossier.identityFingerprint, 'IDENTITY'],
    [dossier.corpus, dossier.corpusFingerprint, 'CORPUS'],
    [dossier.semanticMapping, dossier.semanticMappingFingerprint, 'MAPPING'],
    [dossier.runnerContract, dossier.runnerContractFingerprint, 'RUNNER'],
    [
      dossier.telemetryContract,
      dossier.telemetryContractFingerprint,
      'TELEMETRY',
    ],
    [dossier.stopPolicy, dossier.stopPolicyFingerprint, 'STOP_POLICY'],
  ];
  for (const [value, expected, name] of pairs) {
    if (fingerprint(value) !== expected) {
      throw new Error(`WRITING_GATE_${name}_FINGERPRINT_MISMATCH`);
    }
  }
}

function verifyAuthorities(input: {
  authorityTexts: Readonly<Record<string, string>>;
  dossier: FrozenDossier;
}): void {
  for (const authority of Object.values(input.dossier.authorities)) {
    const text = input.authorityTexts[authority.path];
    if (text === undefined || sha256(text) !== authority.sha256) {
      throw new Error(`WRITING_GATE_AUTHORITY_MISMATCH:${authority.path}`);
    }
  }
}

function candidateRelation(status: FindingSpec['status']) {
  if (status === 'SUPPORTED') return 'EVIDENCE_FOR_ELEMENT' as const;
  if (status === 'EXPLICITLY_REFUTED') {
    return 'EVIDENCE_AGAINST_ELEMENT' as const;
  }
  return null;
}

function materializeCases(input: {
  dossier: FrozenDossier;
  oracle: MechanicalOracleV21;
}): WritingFrameworkGateCase[] {
  const segments = new Map(
    input.oracle.segments.map((segment) => [segment.key, segment]),
  );
  return input.dossier.corpus.gateFour.map(({ caseId }) => {
    const oracleCase = required(
      input.oracle.cases.find((item) => item.caseId === caseId),
      `WRITING_GATE_CASE_MISSING:${caseId}`,
    );
    const responseSegments = oracleCase.responseSegmentKeys.map((key) =>
      required(segments.get(key), `WRITING_GATE_SEGMENT_MISSING:${key}`),
    );
    const findings = Object.fromEntries(
      Object.entries(input.oracle.baselineFindings).map(([key, baseline]) => [
        key,
        oracleCase.findingOverrides[key] ?? baseline,
      ]),
    );
    const expectedFindings = Object.entries(findings).flatMap(
      ([elementKey, finding]) => {
        const relation = candidateRelation(finding.status);
        return relation
          ? [
              {
                elementKey,
                evidenceTexts: finding.evidenceSegmentKeys.map(
                  (key) =>
                    required(
                      segments.get(key),
                      `WRITING_GATE_EVIDENCE_SEGMENT_MISSING:${key}`,
                    ).text,
                ),
                relation,
              },
            ]
          : [];
      },
    );
    return {
      caseId,
      expectedFindings,
      responseText: responseSegments.map(({ text }) => text).join('\n'),
      untrustedSegmentTexts: responseSegments
        .filter(({ kind }) => kind === 'CANARY' || kind === 'INJECTION')
        .map(({ text }) => text),
    };
  });
}

export function buildWritingFrameworkGatePackage(input: {
  authorityTexts: Readonly<Record<string, string>>;
  dossierPath: string;
  dossierText: string;
  financeText: string;
}): WritingFrameworkGatePackage {
  const dossier = frozenDossierSchema.parse(
    JSON.parse(input.dossierText) as unknown,
  );
  const finance = financeEnvelopeSchema.parse(
    JSON.parse(input.financeText) as unknown,
  );
  verifyDossierFingerprints(dossier);
  verifyAuthorities({ authorityTexts: input.authorityTexts, dossier });
  if (
    finance.campaign.dossierPath !== input.dossierPath ||
    finance.campaign.dossierSha256 !== sha256(input.dossierText) ||
    finance.campaign.identityFingerprint !== dossier.identityFingerprint
  ) {
    throw new Error('WRITING_GATE_FINANCE_DOSSIER_MISMATCH');
  }
  const rubricAuthority = dossier.authorities.rubric;
  const oracleAuthority = dossier.authorities.mechanicalOracle;
  if (!rubricAuthority || !oracleAuthority) {
    throw new Error('WRITING_GATE_REQUIRED_AUTHORITIES_MISSING');
  }
  const compiled = compileExecutableRubricV2(
    JSON.parse(
      required(
        input.authorityTexts[rubricAuthority.path],
        'WRITING_GATE_RUBRIC_TEXT_MISSING',
      ),
    ) as unknown,
  );
  const oracleValue = JSON.parse(
    required(
      input.authorityTexts[oracleAuthority.path],
      'WRITING_GATE_ORACLE_TEXT_MISSING',
    ),
  ) as unknown;
  const oracle = mechanicalOracleV21Schema.parse(oracleValue);
  const validatedOracle = validateMechanicalOracleV21({
    compiled,
    corpus: oracle,
  });
  if (
    compiled.rubricFingerprint !== dossier.identityCore.rubricFingerprint ||
    validatedOracle.corpusFingerprint !== dossier.identityCore.oracleFingerprint
  ) {
    throw new Error('WRITING_GATE_COMPILED_IDENTITY_MISMATCH');
  }
  return Object.freeze({
    cases: materializeCases({ dossier, oracle }),
    catalogSnapshotId: dossier.identityCore.catalogSnapshotId,
    compiled,
    expectedObservedProvider: dossier.identityCore.expectedObservedProvider,
    finance,
    identityFingerprint: dossier.identityFingerprint,
    maximumPromptUtf8Bytes: finance.perAttemptBound.maximumPromptUtf8Bytes,
    requestedRoute: dossier.identityCore.requestedRoute,
    requestProfile: Object.freeze({
      maxOutputTokens: dossier.identityCore.maxOutputTokens,
      reasoningEffort: dossier.identityCore.reasoning.effort ?? null,
      reasoningMandatory: dossier.identityCore.reasoning.mandatory ?? false,
      reasoningMode: dossier.identityCore.reasoning.mode,
      temperature: dossier.identityCore.temperature,
      timeoutMs: dossier.identityCore.timeoutMs,
      visibleOutputTokenTarget:
        dossier.identityCore.visibleOutputTokenTarget ??
        dossier.identityCore.maxOutputTokens,
    }),
    taskContext: compiled.rubric.trustedContext.scenarios
      .map(({ key, text }) => `${key.toLocaleUpperCase()}\n${text}`)
      .join('\n\n'),
    taskPrompt: compiled.rubric.activityBinding.prompt.text,
    wireModelId: dossier.identityCore.wireModelId,
  }) as WritingFrameworkGatePackage;
}

function ledgerRecord(input: {
  authorizationFingerprint?: string;
  authorizationProofSha256?: string;
  caseId: string;
  event: WritingGateLedgerEvent['event'];
  idempotencyKey: string;
  previousHash: string | null;
  rawOutputSha256?: string;
  requestManifestSha256?: string;
}): WritingGateLedgerEvent {
  return Object.freeze({
    ...input,
    recordHash: sha256(canonicalJsonV2(input)),
  });
}

export class InMemoryWritingFrameworkGateStore implements WritingFrameworkGateStore {
  private authorizationProof: WritingGateLiveAuthorizationProof | null = null;
  private readonly events: WritingGateLedgerEvent[] = [];
  private readonly manifests = new Map<string, WritingGateRequestManifest>();
  private readonly outcomes = new Map<string, WritingGateAttempt>();
  private readonly raw = new Set<string>();

  public async consumeLiveAuthorization(
    proof: WritingGateLiveAuthorizationProof,
  ): Promise<'CREATED' | 'EXISTS'> {
    assertWritingGateLiveAuthorizationProof(proof);
    if (this.authorizationProof) {
      if (this.authorizationProof.proofSha256 !== proof.proofSha256) {
        throw new Error('WRITING_GATE_LIVE_AUTHORIZATION_CONFLICT');
      }
      const recorded = this.events.some(
        (event) =>
          event.event === 'LIVE_AUTHORIZATION_CONSUMED' &&
          event.authorizationProofSha256 === proof.proofSha256,
      );
      if (!recorded) {
        throw new Error('WRITING_GATE_LIVE_AUTHORIZATION_LEDGER_MISSING');
      }
      return 'EXISTS';
    }
    this.authorizationProof = structuredClone(proof);
    this.append('LIVE_AUTHORIZATION_CONSUMED', {
      authorizationFingerprint: proof.authorizationFingerprint,
      authorizationProofSha256: proof.proofSha256,
      caseId: '__authorization__',
      idempotencyKey: proof.authorizationFingerprint,
    });
    return 'CREATED';
  }

  public async appendRequestManifest(
    manifest: WritingGateRequestManifest,
  ): Promise<'CREATED' | 'EXISTS'> {
    assertRequestManifestIntegrity(manifest);
    const existing = this.manifests.get(manifest.idempotencyKey);
    if (existing) {
      if (existing.manifestSha256 !== manifest.manifestSha256) {
        throw new Error('WRITING_GATE_REQUEST_MANIFEST_CONFLICT');
      }
      return 'EXISTS';
    }
    this.manifests.set(manifest.idempotencyKey, structuredClone(manifest));
    this.append('REQUEST_MANIFEST', {
      caseId: manifest.caseId,
      idempotencyKey: manifest.idempotencyKey,
      requestManifestSha256: manifest.manifestSha256,
    });
    return 'CREATED';
  }

  public async appendCallIntent(input: {
    caseId: string;
    idempotencyKey: string;
    requestManifestSha256: string;
  }): Promise<'CREATED' | 'EXISTS'> {
    const manifest = this.manifests.get(input.idempotencyKey);
    if (
      !manifest ||
      manifest.caseId !== input.caseId ||
      manifest.manifestSha256 !== input.requestManifestSha256
    ) {
      throw new Error('WRITING_GATE_REQUEST_MANIFEST_REQUIRED');
    }
    if (
      this.events.some(
        (event) =>
          event.event === 'CALL_INTENT' &&
          event.idempotencyKey === input.idempotencyKey,
      )
    ) {
      return 'EXISTS';
    }
    this.append('CALL_INTENT', input);
    return 'CREATED';
  }

  public async appendOutcome(attempt: WritingGateAttempt): Promise<void> {
    if (this.outcomes.has(attempt.idempotencyKey)) {
      throw new Error('WRITING_GATE_OUTCOME_ALREADY_EXISTS');
    }
    this.outcomes.set(attempt.idempotencyKey, structuredClone(attempt));
    this.append('CALL_OUTCOME', {
      caseId: attempt.caseId,
      idempotencyKey: attempt.idempotencyKey,
    });
  }

  public async appendRaw(input: {
    caseId: string;
    idempotencyKey: string;
    rawOutput: string;
  }): Promise<void> {
    if (this.raw.has(input.idempotencyKey)) {
      throw new Error('WRITING_GATE_RAW_ALREADY_EXISTS');
    }
    this.raw.add(input.idempotencyKey);
    this.append('RAW_RECEIVED', {
      caseId: input.caseId,
      idempotencyKey: input.idempotencyKey,
      rawOutputSha256: sha256(input.rawOutput),
    });
  }

  public async findOutcome(
    idempotencyKey: string,
  ): Promise<WritingGateAttempt | null> {
    return structuredClone(this.outcomes.get(idempotencyKey) ?? null);
  }

  public ledger(): readonly WritingGateLedgerEvent[] {
    return structuredClone(this.events);
  }

  private append(
    event: WritingGateLedgerEvent['event'],
    input: {
      authorizationFingerprint?: string;
      authorizationProofSha256?: string;
      caseId: string;
      idempotencyKey: string;
      rawOutputSha256?: string;
      requestManifestSha256?: string;
    },
  ): void {
    this.events.push(
      ledgerRecord({
        ...input,
        event,
        previousHash: this.events.at(-1)?.recordHash ?? null,
      }),
    );
  }
}

type StoredAttemptEnvelope = Readonly<{
  attempt: WritingGateAttempt;
  attemptSha256: string;
  schemaVersion: 1;
}>;

type StoredRawEnvelope = Readonly<{
  caseId: string;
  idempotencyKey: string;
  rawOutput: string;
  rawOutputSha256: string;
  schemaVersion: 1;
}>;

type StoredLiveAuthorizationEnvelopeCore = Readonly<{
  consumedAt: string;
  proof: WritingGateLiveAuthorizationProof;
  schemaVersion: 1;
}>;

type StoredLiveAuthorizationEnvelope = StoredLiveAuthorizationEnvelopeCore &
  Readonly<{ envelopeSha256: string }>;

function isAlreadyExists(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'EEXIST';
}

function verifyLedger(events: readonly WritingGateLedgerEvent[]): void {
  events.forEach((event, index) => {
    const previousHash = events[index - 1]?.recordHash ?? null;
    const { recordHash, ...record } = event;
    if (
      event.previousHash !== previousHash ||
      sha256(canonicalJsonV2(record)) !== recordHash
    ) {
      throw new Error('WRITING_GATE_LEDGER_INTEGRITY_MISMATCH');
    }
  });
}

export class FileWritingFrameworkGateStore implements WritingFrameworkGateStore {
  private readonly events: WritingGateLedgerEvent[];

  private constructor(
    private readonly directory: string,
    events: WritingGateLedgerEvent[],
  ) {
    this.events = events;
  }

  public static async open(
    directory: string,
  ): Promise<FileWritingFrameworkGateStore> {
    const absolute = resolve(directory);
    await mkdir(absolute, { recursive: true });
    let events: WritingGateLedgerEvent[] = [];
    try {
      const text = await readFile(resolve(absolute, 'ledger.jsonl'), 'utf8');
      events = text
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as WritingGateLedgerEvent);
    } catch (error) {
      if (!(
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      )) {
        throw error;
      }
    }
    verifyLedger(events);
    return new FileWritingFrameworkGateStore(absolute, events);
  }

  public async consumeLiveAuthorization(
    proof: WritingGateLiveAuthorizationProof,
  ): Promise<'CREATED' | 'EXISTS'> {
    assertWritingGateLiveAuthorizationProof(proof);
    if (resolve(proof.outputDirectory) !== this.directory) {
      throw new Error('WRITING_GATE_AUTHORIZED_OUTPUT_DIRECTORY_MISMATCH');
    }
    const path = resolve(this.directory, 'authorization-consumption.json');
    const core: StoredLiveAuthorizationEnvelopeCore = {
      consumedAt: new Date().toISOString(),
      proof,
      schemaVersion: 1,
    };
    const envelope: StoredLiveAuthorizationEnvelope = {
      ...core,
      envelopeSha256: fingerprint(core),
    };
    try {
      await this.writeExclusive(path, envelope);
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;
      const existing = await this.readLiveAuthorizationEnvelope(path);
      if (existing.proof.proofSha256 !== proof.proofSha256) {
        throw new Error('WRITING_GATE_LIVE_AUTHORIZATION_CONFLICT', {
          cause: error,
        });
      }
      if (!this.hasLiveAuthorizationLedgerRecord(proof)) {
        throw new Error('WRITING_GATE_LIVE_AUTHORIZATION_LEDGER_MISSING', {
          cause: error,
        });
      }
      return 'EXISTS';
    }
    await this.appendLedger('LIVE_AUTHORIZATION_CONSUMED', {
      authorizationFingerprint: proof.authorizationFingerprint,
      authorizationProofSha256: proof.proofSha256,
      caseId: '__authorization__',
      idempotencyKey: proof.authorizationFingerprint,
    });
    return 'CREATED';
  }

  public async appendRequestManifest(
    manifest: WritingGateRequestManifest,
  ): Promise<'CREATED' | 'EXISTS'> {
    assertRequestManifestIntegrity(manifest);
    const path = this.recordPath('requests', manifest.idempotencyKey);
    try {
      await this.writeExclusive(path, manifest);
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;
      const existing = await this.readRequestManifest(manifest.idempotencyKey);
      if (
        existing.caseId !== manifest.caseId ||
        existing.manifestSha256 !== manifest.manifestSha256
      ) {
        throw new Error('WRITING_GATE_REQUEST_MANIFEST_CONFLICT', {
          cause: error,
        });
      }
      if (!this.hasRequestManifestLedgerRecord(existing)) {
        throw new Error('WRITING_GATE_REQUEST_MANIFEST_LEDGER_MISSING', {
          cause: error,
        });
      }
      return 'EXISTS';
    }
    await this.appendLedger('REQUEST_MANIFEST', {
      caseId: manifest.caseId,
      idempotencyKey: manifest.idempotencyKey,
      requestManifestSha256: manifest.manifestSha256,
    });
    return 'CREATED';
  }

  public async appendCallIntent(input: {
    caseId: string;
    idempotencyKey: string;
    requestManifestSha256: string;
  }): Promise<'CREATED' | 'EXISTS'> {
    const manifest = await this.readRequestManifest(input.idempotencyKey);
    if (
      manifest.caseId !== input.caseId ||
      manifest.manifestSha256 !== input.requestManifestSha256 ||
      !this.hasRequestManifestLedgerRecord(manifest)
    ) {
      throw new Error('WRITING_GATE_REQUEST_MANIFEST_REQUIRED');
    }
    const path = this.recordPath('intents', input.idempotencyKey);
    try {
      await this.writeExclusive(path, {
        ...input,
        createdAt: new Date().toISOString(),
        schemaVersion: 1,
      });
    } catch (error) {
      if (isAlreadyExists(error)) return 'EXISTS';
      throw error;
    }
    await this.appendLedger('CALL_INTENT', input);
    return 'CREATED';
  }

  public async appendOutcome(attempt: WritingGateAttempt): Promise<void> {
    const envelope: StoredAttemptEnvelope = {
      attempt,
      attemptSha256: sha256(canonicalJsonV2(attempt)),
      schemaVersion: 1,
    };
    await this.writeExclusive(
      this.recordPath('outcomes', attempt.idempotencyKey),
      envelope,
    );
    await this.appendLedger('CALL_OUTCOME', {
      caseId: attempt.caseId,
      idempotencyKey: attempt.idempotencyKey,
    });
  }

  public async appendRaw(input: {
    caseId: string;
    idempotencyKey: string;
    rawOutput: string;
  }): Promise<void> {
    const rawOutputSha256 = sha256(input.rawOutput);
    await this.writeExclusive(this.recordPath('raw', input.idempotencyKey), {
      ...input,
      rawOutputSha256,
      schemaVersion: 1,
    } satisfies StoredRawEnvelope);
    await this.appendLedger('RAW_RECEIVED', {
      caseId: input.caseId,
      idempotencyKey: input.idempotencyKey,
      rawOutputSha256,
    });
  }

  public async findOutcome(
    idempotencyKey: string,
  ): Promise<WritingGateAttempt | null> {
    try {
      const envelope = JSON.parse(
        await readFile(this.recordPath('outcomes', idempotencyKey), 'utf8'),
      ) as StoredAttemptEnvelope;
      if (
        envelope.schemaVersion !== 1 ||
        envelope.attempt.idempotencyKey !== idempotencyKey ||
        sha256(canonicalJsonV2(envelope.attempt)) !== envelope.attemptSha256
      ) {
        throw new Error('WRITING_GATE_OUTCOME_INTEGRITY_MISMATCH');
      }
      const hasOutcomeLedgerRecord = this.events.some(
        (event) =>
          event.event === 'CALL_OUTCOME' &&
          event.idempotencyKey === idempotencyKey,
      );
      if (!hasOutcomeLedgerRecord) {
        throw new Error('WRITING_GATE_OUTCOME_LEDGER_MISSING');
      }
      if (envelope.attempt.rawPersistedBeforeValidation) {
        const rawEnvelope = await this.readRawEnvelope(idempotencyKey);
        const rawLedgerRecord = this.events.find(
          (event) =>
            event.event === 'RAW_RECEIVED' &&
            event.idempotencyKey === idempotencyKey,
        );
        if (!rawLedgerRecord) {
          throw new Error('WRITING_GATE_RAW_LEDGER_MISSING');
        }
        if (
          rawEnvelope.caseId !== envelope.attempt.caseId ||
          rawEnvelope.rawOutputSha256 !== envelope.attempt.rawOutputSha256 ||
          (rawLedgerRecord.rawOutputSha256 !== undefined &&
            rawLedgerRecord.rawOutputSha256 !== rawEnvelope.rawOutputSha256)
        ) {
          throw new Error('WRITING_GATE_RAW_INTEGRITY_MISMATCH');
        }
      }
      return structuredClone(envelope.attempt);
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return null;
      }
      throw error;
    }
  }

  public ledger(): readonly WritingGateLedgerEvent[] {
    return structuredClone(this.events);
  }

  private async appendLedger(
    event: WritingGateLedgerEvent['event'],
    input: {
      authorizationFingerprint?: string;
      authorizationProofSha256?: string;
      caseId: string;
      idempotencyKey: string;
      rawOutputSha256?: string;
      requestManifestSha256?: string;
    },
  ): Promise<void> {
    const record = ledgerRecord({
      ...input,
      event,
      previousHash: this.events.at(-1)?.recordHash ?? null,
    });
    await appendFile(
      resolve(this.directory, 'ledger.jsonl'),
      `${JSON.stringify(record)}\n`,
      { encoding: 'utf8', flag: 'a' },
    );
    this.events.push(record);
  }

  private recordPath(
    kind: 'intents' | 'outcomes' | 'raw' | 'requests',
    key: string,
  ): string {
    if (!/^[a-f0-9]{64}$/u.test(key)) {
      throw new Error('WRITING_GATE_IDEMPOTENCY_KEY_INVALID');
    }
    return resolve(this.directory, kind, `${key}.json`);
  }

  private async readRequestManifest(
    idempotencyKey: string,
  ): Promise<WritingGateRequestManifest> {
    const manifest = JSON.parse(
      await readFile(this.recordPath('requests', idempotencyKey), 'utf8'),
    ) as WritingGateRequestManifest;
    if (manifest.idempotencyKey !== idempotencyKey) {
      throw new Error('WRITING_GATE_REQUEST_MANIFEST_IDENTITY_MISMATCH');
    }
    assertRequestManifestIntegrity(manifest);
    return manifest;
  }

  private hasRequestManifestLedgerRecord(
    manifest: WritingGateRequestManifest,
  ): boolean {
    return this.events.some(
      (event) =>
        event.event === 'REQUEST_MANIFEST' &&
        event.idempotencyKey === manifest.idempotencyKey &&
        event.requestManifestSha256 === manifest.manifestSha256,
    );
  }

  private hasLiveAuthorizationLedgerRecord(
    proof: WritingGateLiveAuthorizationProof,
  ): boolean {
    return this.events.some(
      (event) =>
        event.event === 'LIVE_AUTHORIZATION_CONSUMED' &&
        event.authorizationFingerprint === proof.authorizationFingerprint &&
        event.authorizationProofSha256 === proof.proofSha256,
    );
  }

  private async readLiveAuthorizationEnvelope(
    path: string,
  ): Promise<StoredLiveAuthorizationEnvelope> {
    const envelope = JSON.parse(
      await readFile(path, 'utf8'),
    ) as StoredLiveAuthorizationEnvelope;
    const { envelopeSha256, ...core } = envelope;
    assertWritingGateLiveAuthorizationProof(envelope.proof);
    if (
      envelope.schemaVersion !== 1 ||
      !sha256Schema.safeParse(envelopeSha256).success ||
      fingerprint(core) !== envelopeSha256
    ) {
      throw new Error('WRITING_GATE_LIVE_AUTHORIZATION_INTEGRITY_MISMATCH');
    }
    return envelope;
  }

  private async readRawEnvelope(
    idempotencyKey: string,
  ): Promise<StoredRawEnvelope> {
    const envelope = JSON.parse(
      await readFile(this.recordPath('raw', idempotencyKey), 'utf8'),
    ) as StoredRawEnvelope;
    if (
      envelope.schemaVersion !== 1 ||
      envelope.idempotencyKey !== idempotencyKey ||
      !sha256Schema.safeParse(envelope.rawOutputSha256).success ||
      sha256(envelope.rawOutput) !== envelope.rawOutputSha256
    ) {
      throw new Error('WRITING_GATE_RAW_INTEGRITY_MISMATCH');
    }
    return envelope;
  }

  private async writeExclusive(path: string, value: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(value)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
  }
}

function expectedRawOutput(input: {
  caseItem: WritingFrameworkGateCase;
  requestContext: EvidenceAssistRequestContextV2;
}): string {
  const spanIdForText = (text: string): string => {
    const matches = input.requestContext.spanManifest.spans.filter(
      (span) => span.text === text,
    );
    if (matches.length !== 1) {
      throw new Error('WRITING_GATE_GOLD_SPAN_NOT_UNIQUE');
    }
    return required(matches.at(0), 'WRITING_GATE_GOLD_SPAN_MISSING').spanId;
  };
  return JSON.stringify({
    findings: input.caseItem.expectedFindings.map((finding) => ({
      elementKey: finding.elementKey,
      relation: finding.relation,
      spanIds: finding.evidenceTexts.map(spanIdForText),
    })),
  });
}

export class FrozenOracleWritingFrameworkGateProvider implements WritingFrameworkGateOfflineProvider {
  public readonly kind = 'OFFLINE_FAKE' as const;
  public executions = 0;

  public constructor(
    private readonly packageInput: WritingFrameworkGatePackage,
    private readonly overrides: Readonly<{
      actualCostUsd?: number | null;
      rawOutput?: (request: WritingFrameworkGateProviderRequest) => string;
    }> = {},
  ) {}

  public prepare(
    request: WritingFrameworkGateProviderRequestCore,
  ): WritingGateRequestManifest {
    const wire = writingGateWireContract(this.packageInput);
    if (fingerprint(request.jsonSchema) !== wire.schemaSha256) {
      throw new Error('WRITING_GATE_WIRE_SCHEMA_MISMATCH');
    }
    const transportCore = {
      bodySha256: fingerprint({
        jsonSchema: request.jsonSchema,
        messages: request.messages,
      }),
      persistedSafeHeaderNames: [] as string[],
      messagesSha256: fingerprint(request.messages),
      method: 'OFFLINE_FAKE',
      modelId: 'deterministic-frozen-oracle',
      profileSha256: fingerprint({ mode: 'OFFLINE_FAKE_ONLY' }),
      requestedRoute: 'OFFLINE_FAKE',
      schemaSha256: wire.schemaSha256,
      schemaVersion: 1,
      timeoutMs: 0,
      url: 'offline://learnx/frozen-oracle',
    };
    return createWritingGateRequestManifest({
      caseId: request.caseId,
      idempotencyKey: request.idempotencyKey,
      identityFingerprint: this.packageInput.identityFingerprint,
      requestContextFingerprint: request.requestContext.contextFingerprint,
      transportManifest: {
        ...transportCore,
        manifestSha256: fingerprint(transportCore),
      },
      wireDialect: wire.dialect,
      wireDialectVersion: wire.dialectVersion,
      wireSchemaSha256: wire.schemaSha256,
    });
  }

  public async execute(
    request: WritingFrameworkGateProviderRequest,
  ): Promise<WritingFrameworkGateProviderResult> {
    const { requestManifest, ...requestCore } = request;
    if (
      this.prepare(requestCore).manifestSha256 !==
      requestManifest.manifestSha256
    ) {
      throw new Error('WRITING_GATE_REQUEST_MANIFEST_MISMATCH');
    }
    this.executions += 1;
    const caseItem = required(
      this.packageInput.cases.find(({ caseId }) => caseId === request.caseId),
      'WRITING_GATE_FAKE_CASE_MISSING',
    );
    const rawOutput = this.overrides.rawOutput
      ? this.overrides.rawOutput(request)
      : expectedRawOutput({ caseItem, requestContext: request.requestContext });
    const actualCostUsd = Object.hasOwn(this.overrides, 'actualCostUsd')
      ? (this.overrides.actualCostUsd ?? null)
      : 0;
    return {
      actualCostUsd,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      clientRequestId: request.idempotencyKey,
      costSource: actualCostUsd === null ? 'UNKNOWN' : 'OFFLINE_FAKE',
      generationId: null,
      inputTokens: 0,
      latencyMs: 0,
      observedProvider: 'OFFLINE_FAKE',
      openRouterMetadata: null,
      providerRequestId: `offline-fake:${request.idempotencyKey}`,
      rawOutput,
      reasoningTokens: 0,
      visibleOutputTokens: 0,
    };
  }
}

function relationKey(input: {
  elementKey: string;
  relation: string;
  spanIds: readonly string[];
}): string {
  return `${input.elementKey}:${input.relation}:${[...input.spanIds].sort().join(',')}`;
}

function semanticDefects(input: {
  caseItem: WritingFrameworkGateCase;
  requestContext: EvidenceAssistRequestContextV2;
  validation: EvidenceAssistValidationResultV2;
}): WritingGateDefect[] {
  const spanByText = new Map(
    input.requestContext.spanManifest.spans.map((span) => [span.text, span]),
  );
  const untrustedSpanIds = new Set(
    input.caseItem.untrustedSegmentTexts.map(
      (text) =>
        required(spanByText.get(text), 'WRITING_GATE_UNTRUSTED_SPAN_MISSING')
          .spanId,
    ),
  );
  const candidate = input.validation.candidateFindings.map(relationKey).sort();
  const expected = input.caseItem.expectedFindings
    .map((finding) => {
      const spanIds = finding.evidenceTexts.map(
        (text) =>
          required(spanByText.get(text), 'WRITING_GATE_EXPECTED_SPAN_MISSING')
            .spanId,
      );
      return relationKey({ ...finding, spanIds });
    })
    .sort();
  const defects: WritingGateDefect[] = [];
  if (input.validation.rejectedFindings.length > 0) {
    defects.push('LOCAL_FINDING_REJECTION');
  }
  if (candidate.join('|') !== expected.join('|')) {
    defects.push('SEMANTIC_DISAGREEMENT');
  }
  if (
    input.validation.candidateFindings.some(({ spanIds }) =>
      spanIds.some((spanId) => untrustedSpanIds.has(spanId)),
    )
  ) {
    defects.push('SAFETY');
  }
  return defects;
}

function messageBytes(context: EvidenceAssistRequestContextV2): number {
  return Buffer.byteLength(JSON.stringify(context.messages), 'utf8');
}

function idempotencyKey(input: {
  caseId: string;
  identityFingerprint: string;
}): string {
  return sha256(
    `${input.identityFingerprint}:FOUR_CASE_GATE:${input.caseId}:1`,
  );
}

function invalidAttempt(input: {
  caseId: string;
  defects: readonly WritingGateDefect[];
  dispatchState?: WritingGateAttempt['dispatchState'];
  financialState?: WritingGateAttempt['financialState'];
  idempotencyKey: string;
  messageUtf8Bytes: number;
  requestContextFingerprint: string;
  requestedRoute: string;
}): WritingGateAttempt {
  return Object.freeze({
    actualCostUsd: null,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    caseId: input.caseId,
    clientRequestId: input.idempotencyKey,
    costSource: 'UNKNOWN',
    defectClasses: [...input.defects],
    dispatchState: input.dispatchState ?? 'ORPHANED',
    errorCode: null,
    financialState: input.financialState ?? 'RECONCILIATION_REQUIRED',
    generationId: null,
    idempotencyKey: input.idempotencyKey,
    inputTokens: 0,
    latencyMs: 0,
    messageUtf8Bytes: input.messageUtf8Bytes,
    observedProvider: null,
    openRouterMetadata: null,
    providerRequestId: null,
    rawOutputSha256: null,
    rawPersistedBeforeValidation: false,
    reasoningTokens: 0,
    repetition: 1,
    requestContextFingerprint: input.requestContextFingerprint,
    requestedRoute: input.requestedRoute,
    status: 'INVALID',
    validation: null,
    visibleOutputTokens: 0,
  });
}

type GateRunInput = Readonly<{
  canaryFactory?: (caseId: string) => string;
  packageInput: WritingFrameworkGatePackage;
  provider:
    WritingFrameworkGateLiveProvider | WritingFrameworkGateOfflineProvider;
  store: WritingFrameworkGateStore;
}>;

function liveBudgetDefect(input: {
  attempts: readonly WritingGateAttempt[];
  packageInput: WritingFrameworkGatePackage;
}): WritingGateDefect | null {
  const completedProviderAttempts = input.attempts.filter(
    ({ dispatchState }) => dispatchState !== 'PENDING',
  ).length;
  if (
    completedProviderAttempts >=
    input.packageInput.finance.gateBound.maximumProviderAttempts
  ) {
    return 'BUDGET';
  }
  const reconciledCost = input.attempts.reduce(
    (total, attempt) => total + (attempt.actualCostUsd ?? 0),
    0,
  );
  return reconciledCost +
    input.packageInput.finance.perAttemptBound.maximumCostUsd >
    input.packageInput.finance.gateBound.maximumProviderCostUsd + Number.EPSILON
    ? 'BUDGET'
    : null;
}

function providerDefects(input: {
  expectedClientRequestId: string;
  packageInput: WritingFrameworkGatePackage;
  priorAttempts: readonly WritingGateAttempt[];
  providerResult: WritingFrameworkGateProviderResult;
}): WritingGateDefect[] {
  const defects: WritingGateDefect[] = [];
  if (input.providerResult.clientRequestId !== input.expectedClientRequestId) {
    defects.push('TRACEABILITY');
  }
  if (
    input.providerResult.providerRequestId === null &&
    input.providerResult.generationId === null
  ) {
    defects.push('TRACEABILITY');
  }
  if (input.providerResult.errorCode) {
    defects.push(
      input.providerResult.errorCode.startsWith('PROVIDER_')
        ? 'FINANCE'
        : 'MODEL_OUTPUT_INVALID',
    );
  }
  if (
    input.providerResult.observedProvider !==
    input.packageInput.expectedObservedProvider
  ) {
    defects.push('IDENTITY');
  }
  if (
    input.providerResult.actualCostUsd === null ||
    input.providerResult.costSource !== 'ACTUAL'
  ) {
    defects.push('FINANCE');
  } else {
    const totalCost =
      input.priorAttempts.reduce(
        (total, attempt) => total + (attempt.actualCostUsd ?? 0),
        0,
      ) + input.providerResult.actualCostUsd;
    if (
      input.providerResult.actualCostUsd >
        input.packageInput.finance.perAttemptBound.maximumCostUsd ||
      totalCost > input.packageInput.finance.gateBound.maximumProviderCostUsd
    ) {
      defects.push('BUDGET');
    }
  }
  return defects;
}

async function runWritingFrameworkSelectionGate(
  input: GateRunInput,
): Promise<WritingFrameworkGateRun> {
  const live = input.provider.kind === 'OPENROUTER_LIVE';
  if (input.provider.kind === 'OPENROUTER_LIVE') {
    if (input.packageInput.identityFingerprint === CLOSED_GEMINI_Q1_IDENTITY) {
      throw new Error('WRITING_GATE_IDENTITY_CLOSED_NO_REPLAY');
    }
    assertWritingGateLiveAuthorizationProof(input.provider.authorizationProof);
    if (
      input.provider.authorizedIdentityFingerprint !==
        input.packageInput.identityFingerprint ||
      input.provider.authorizationProof.identityFingerprint !==
        input.packageInput.identityFingerprint ||
      input.provider.authorizationProof.identityFingerprint !==
        input.provider.authorizedIdentityFingerprint
    ) {
      throw new Error('WRITING_GATE_NEW_IDENTITY_AUTHORIZATION_REQUIRED');
    }
    await input.store.consumeLiveAuthorization(
      input.provider.authorizationProof,
    );
  }
  const attempts: WritingGateAttempt[] = [];
  let providerExecutions = 0;
  let stoppedReason: WritingGateDefect | null = null;
  for (const caseItem of input.packageInput.cases) {
    const key = idempotencyKey({
      caseId: caseItem.caseId,
      identityFingerprint: input.packageInput.identityFingerprint,
    });
    const existing = await input.store.findOutcome(key);
    if (existing) {
      attempts.push(existing);
      stoppedReason = existing.defectClasses.at(0) ?? null;
      if (stoppedReason) break;
      continue;
    }
    const prepared = prepareEvidenceAssistRequestV2({
      canaryFactory: input.canaryFactory
        ? () => input.canaryFactory?.(caseItem.caseId) ?? ''
        : undefined,
      compiled: input.packageInput.compiled,
      responseText: caseItem.responseText,
      taskContext: input.packageInput.taskContext,
      taskPrompt: input.packageInput.taskPrompt,
    });
    const bytes = messageBytes(prepared.requestContext);
    if (bytes > input.packageInput.maximumPromptUtf8Bytes) {
      const attempt = invalidAttempt({
        caseId: caseItem.caseId,
        defects: ['BUDGET'],
        dispatchState: 'PENDING',
        financialState: live ? 'RECONCILED' : 'OFFLINE_NOT_APPLICABLE',
        idempotencyKey: key,
        messageUtf8Bytes: bytes,
        requestContextFingerprint: prepared.requestContext.contextFingerprint,
        requestedRoute: input.packageInput.requestedRoute,
      });
      attempts.push(attempt);
      stoppedReason = 'BUDGET';
      break;
    }
    if (live) {
      const budgetDefect = liveBudgetDefect({
        attempts,
        packageInput: input.packageInput,
      });
      if (budgetDefect) {
        const attempt = invalidAttempt({
          caseId: caseItem.caseId,
          defects: [budgetDefect],
          dispatchState: 'PENDING',
          financialState: 'RECONCILED',
          idempotencyKey: key,
          messageUtf8Bytes: bytes,
          requestContextFingerprint: prepared.requestContext.contextFingerprint,
          requestedRoute: input.packageInput.requestedRoute,
        });
        attempts.push(attempt);
        stoppedReason = budgetDefect;
        break;
      }
    }
    const wire = writingGateWireContract(input.packageInput);
    const providerRequestCore: WritingFrameworkGateProviderRequestCore = {
      caseId: caseItem.caseId,
      idempotencyKey: key,
      jsonSchema: wire.jsonSchema,
      messages: prepared.messages,
      requestContext: prepared.requestContext,
    };
    const requestManifest = input.provider.prepare(providerRequestCore);
    if (
      requestManifest.caseId !== caseItem.caseId ||
      requestManifest.idempotencyKey !== key ||
      requestManifest.identityFingerprint !==
        input.packageInput.identityFingerprint ||
      requestManifest.requestContextFingerprint !==
        prepared.requestContext.contextFingerprint ||
      requestManifest.wireDialect !== wire.dialect ||
      requestManifest.wireDialectVersion !== wire.dialectVersion ||
      requestManifest.wireSchemaSha256 !== wire.schemaSha256
    ) {
      throw new Error('WRITING_GATE_REQUEST_MANIFEST_IDENTITY_MISMATCH');
    }
    assertRequestManifestIntegrity(requestManifest);
    await input.store.appendRequestManifest(requestManifest);
    const intent = await input.store.appendCallIntent({
      caseId: caseItem.caseId,
      idempotencyKey: key,
      requestManifestSha256: requestManifest.manifestSha256,
    });
    if (intent === 'EXISTS') {
      const attempt = invalidAttempt({
        caseId: caseItem.caseId,
        defects: ['FINANCE'],
        idempotencyKey: key,
        messageUtf8Bytes: bytes,
        requestContextFingerprint: prepared.requestContext.contextFingerprint,
        requestedRoute: input.packageInput.requestedRoute,
      });
      attempts.push(attempt);
      stoppedReason = 'FINANCE';
      break;
    }
    let providerResult: WritingFrameworkGateProviderResult;
    try {
      providerExecutions += 1;
      providerResult = await input.provider.execute({
        ...providerRequestCore,
        requestManifest,
      });
    } catch {
      const attempt = invalidAttempt({
        caseId: caseItem.caseId,
        defects: ['FINANCE'],
        idempotencyKey: key,
        messageUtf8Bytes: bytes,
        requestContextFingerprint: prepared.requestContext.contextFingerprint,
        requestedRoute: input.packageInput.requestedRoute,
      });
      await input.store.appendOutcome(attempt);
      attempts.push(attempt);
      stoppedReason = 'FINANCE';
      break;
    }
    const rawOutputSha256 = sha256(providerResult.rawOutput);
    let rawPersisted = true;
    try {
      await input.store.appendRaw({
        caseId: caseItem.caseId,
        idempotencyKey: key,
        rawOutput: providerResult.rawOutput,
      });
    } catch {
      rawPersisted = false;
    }
    let validation: EvidenceAssistValidationResultV2 | null = null;
    const defects: WritingGateDefect[] = [];
    if (!rawPersisted) defects.push('TRACEABILITY');
    if (rawPersisted && !providerResult.errorCode) {
      try {
        validation = validateEvidenceAssistOutputV2({
          compiled: input.packageInput.compiled,
          pipelineFingerprintSeed: input.packageInput.identityFingerprint,
          rawModelOutput: providerResult.rawOutput,
          requestContext: prepared.requestContext,
          responseText: caseItem.responseText,
        });
        defects.push(
          ...semanticDefects({
            caseItem,
            requestContext: prepared.requestContext,
            validation,
          }),
        );
      } catch (error) {
        defects.push(
          error instanceof Error && error.message.includes('CANARY_LEAK')
            ? 'SAFETY'
            : 'MODEL_OUTPUT_INVALID',
        );
      }
    }
    const costReconciled = live
      ? providerResult.actualCostUsd !== null &&
        providerResult.costSource === 'ACTUAL'
      : providerResult.actualCostUsd !== null &&
        providerResult.costSource === 'OFFLINE_FAKE';
    if (live) {
      defects.push(
        ...providerDefects({
          expectedClientRequestId: key,
          packageInput: input.packageInput,
          priorAttempts: attempts,
          providerResult,
        }),
      );
    } else if (!costReconciled) {
      defects.push('FINANCE');
    }
    const uniqueDefects = [...new Set(defects)];
    const attempt: WritingGateAttempt = Object.freeze({
      actualCostUsd: providerResult.actualCostUsd,
      cacheReadTokens: providerResult.cacheReadTokens,
      cacheWriteTokens: providerResult.cacheWriteTokens,
      caseId: caseItem.caseId,
      clientRequestId: providerResult.clientRequestId ?? key,
      costSource: costReconciled
        ? live
          ? 'ACTUAL'
          : 'OFFLINE_FAKE'
        : 'UNKNOWN',
      defectClasses: uniqueDefects,
      dispatchState:
        providerResult.errorCode === 'PROVIDER_TIMEOUT' ||
        providerResult.errorCode === 'PROVIDER_NETWORK_ERROR'
          ? 'ORPHANED'
          : 'CONFIRMED',
      errorCode: providerResult.errorCode ?? null,
      financialState: costReconciled
        ? live
          ? 'RECONCILED'
          : 'OFFLINE_NOT_APPLICABLE'
        : 'RECONCILIATION_REQUIRED',
      generationId: providerResult.generationId,
      idempotencyKey: key,
      inputTokens: providerResult.inputTokens,
      latencyMs: providerResult.latencyMs,
      messageUtf8Bytes: bytes,
      observedProvider: providerResult.observedProvider,
      openRouterMetadata: providerResult.openRouterMetadata,
      providerRequestId: providerResult.providerRequestId,
      rawOutputSha256,
      rawPersistedBeforeValidation: rawPersisted,
      reasoningTokens: providerResult.reasoningTokens,
      repetition: 1,
      requestContextFingerprint: prepared.requestContext.contextFingerprint,
      requestedRoute: input.packageInput.requestedRoute,
      status: uniqueDefects.length === 0 ? 'VALID' : 'INVALID',
      validation,
      visibleOutputTokens: providerResult.visibleOutputTokens,
    });
    await input.store.appendOutcome(attempt);
    attempts.push(attempt);
    stoppedReason = uniqueDefects.at(0) ?? null;
    if (stoppedReason) break;
  }
  return Object.freeze({
    attempts,
    forceNoGo: stoppedReason !== null,
    ledger: input.store.ledger(),
    mode: live ? ('OPENROUTER_LIVE' as const) : ('OFFLINE_FAKE_ONLY' as const),
    modelCallsPerformed: live ? providerExecutions : 0,
    networkCallsAllowed: live,
    providerExecutions,
    stoppedReason,
    usableWorkflows: attempts.filter(({ status }) => status === 'VALID').length,
  });
}

export async function runWritingFrameworkSelectionGatePreflight(input: {
  canaryFactory?: (caseId: string) => string;
  packageInput: WritingFrameworkGatePackage;
  provider: WritingFrameworkGateOfflineProvider;
  store: WritingFrameworkGateStore;
}): Promise<WritingFrameworkGateRun> {
  if (input.provider.kind !== 'OFFLINE_FAKE') {
    throw new Error('WRITING_GATE_OFFLINE_FAKE_PROVIDER_REQUIRED');
  }
  return runWritingFrameworkSelectionGate(input);
}

export async function runWritingFrameworkSelectionGateLive(input: {
  canaryFactory?: (caseId: string) => string;
  packageInput: WritingFrameworkGatePackage;
  provider: WritingFrameworkGateLiveProvider;
  store: WritingFrameworkGateStore;
}): Promise<WritingFrameworkGateRun> {
  if (input.provider.kind !== 'OPENROUTER_LIVE') {
    throw new Error('WRITING_GATE_OPENROUTER_LIVE_PROVIDER_REQUIRED');
  }
  return runWritingFrameworkSelectionGate(input);
}
