import { createHash } from 'node:crypto';

import type { CompiledExecutableRubric } from '../../lib/executable-rubric-engine.js';
import {
  evidenceAssistJsonSchema,
  evidenceAssistProtocolFingerprint,
  type EvidenceAssistPromptMessage,
  prepareEvidenceAssistRequest,
  validateEvidenceAssistOutput,
} from '../../lib/evidence-assist-protocol.js';

export const EVIDENCE_ASSIST_PRODUCT_ORCHESTRATOR_VERSION = '1.0.0';

export type EvidenceAssistFeatureGate =
  | Readonly<{ enabled: false; mode: 'HARD_OFF' }>
  | Readonly<{ enabled: true; mode: 'OFFLINE_FAKE_ONLY' }>;

export const EVIDENCE_ASSIST_HARD_OFF_GATE: EvidenceAssistFeatureGate =
  Object.freeze({ enabled: false, mode: 'HARD_OFF' });

export interface EvidenceAssistProviderRequest {
  candidateElementKeys: readonly string[];
  idempotencyKey: string;
  messages: readonly [EvidenceAssistPromptMessage, EvidenceAssistPromptMessage];
  operationFingerprint: string;
  outputSchema: Readonly<Record<string, unknown>>;
  protocolFingerprint: string;
  requestContextFingerprint: string;
  spanIds: readonly string[];
}

export interface EvidenceAssistProviderResponse {
  rawModelOutput: string;
}

export interface EvidenceAssistProviderPort {
  readonly kind: 'OFFLINE_FAKE';
  execute(
    request: EvidenceAssistProviderRequest,
  ): Promise<EvidenceAssistProviderResponse>;
}

export type EvidenceAssistPublicState =
  'CANDIDATE_ONLY' | 'PARTIAL' | 'UNRESOLVED';

export interface EvidenceAssistPublicResult {
  authority: 'CANDIDATE_ONLY';
  billingEffect: 'NONE';
  candidateFindings: ReadonlyArray<
    Readonly<{
      candidateOnly: true;
      elementKey: string;
      relation: 'EVIDENCE_AGAINST_ELEMENT' | 'EVIDENCE_FOR_ELEMENT';
      spanIds: readonly string[];
    }>
  >;
  candidateOnly: true;
  indicativeScore: null;
  level: null;
  levelAuthority: 'NONE';
  masteryEffect: 'NONE';
  operationFingerprint: string;
  progressionEffect: 'NONE';
  protocolFingerprint: string;
  rawModelOutputSha256: string;
  rejectedFindingCount: number;
  responseSha256: string;
  score: null;
  scoreAuthority: 'NONE';
  spanManifestSha256: string;
  state: EvidenceAssistPublicState;
  unresolvedElementKeys: readonly string[];
}

export interface RunEvidenceAssistInput {
  compiled: CompiledExecutableRubric;
  idempotencyKey: string;
  responseText: string;
  taskContext: string;
  taskPrompt: string;
}

export interface EvidenceAssistOrchestrator {
  run(input: RunEvidenceAssistInput): Promise<EvidenceAssistPublicResult>;
}

export class EvidenceAssistOrchestrationError extends Error {
  public constructor(
    public readonly code:
      | 'FEATURE_DISABLED'
      | 'IDEMPOTENCY_CONFLICT'
      | 'IDEMPOTENCY_KEY_INVALID'
      | 'OFFLINE_FAKE_PROVIDER_REQUIRED'
      | 'PROVIDER_FAILED'
      | 'PROVIDER_OUTPUT_INVALID'
      | 'VALIDATION_FAILED',
    public readonly cause?: unknown,
  ) {
    super(code);
    this.name = 'EvidenceAssistOrchestrationError';
  }
}

type OperationRecord = Readonly<{
  inputFingerprint: string;
  promise: Promise<EvidenceAssistPublicResult>;
}>;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
}

function fingerprint(value: unknown): string {
  return sha256(JSON.stringify(canonicalize(value)));
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value as Record<string, unknown>).forEach((nested) => {
      deepFreeze(nested);
    });
    Object.freeze(value);
  }
  return value;
}

function assertIdempotencyKey(value: string): void {
  if (!/^[a-zA-Z0-9._:-]{8,200}$/u.test(value)) {
    throw new EvidenceAssistOrchestrationError('IDEMPOTENCY_KEY_INVALID');
  }
}

function assertProviderResponse(
  value: unknown,
): asserts value is EvidenceAssistProviderResponse {
  if (
    typeof value !== 'object' ||
    value === null ||
    Object.keys(value).length !== 1 ||
    !('rawModelOutput' in value) ||
    typeof value.rawModelOutput !== 'string'
  ) {
    throw new EvidenceAssistOrchestrationError('PROVIDER_OUTPUT_INVALID');
  }
}

function publicState(input: {
  candidateFindingCount: number;
  completeness: 'FULL' | 'PARTIAL';
}): EvidenceAssistPublicState {
  if (input.candidateFindingCount === 0) return 'UNRESOLVED';
  return input.completeness === 'FULL' ? 'CANDIDATE_ONLY' : 'PARTIAL';
}

function mapPublicResult(input: {
  operationFingerprint: string;
  validation: ReturnType<typeof validateEvidenceAssistOutput>;
}): EvidenceAssistPublicResult {
  const { validation } = input;
  if (
    validation.level !== null ||
    validation.indicativeScore !== null ||
    validation.levelAuthority !== 'NONE' ||
    validation.scoreAuthority !== 'NONE' ||
    validation.progressionEffect !== 'NONE' ||
    validation.masteryEffect !== 'NONE'
  ) {
    throw new EvidenceAssistOrchestrationError('VALIDATION_FAILED');
  }
  return deepFreeze({
    authority: 'CANDIDATE_ONLY' as const,
    billingEffect: 'NONE' as const,
    candidateFindings: validation.candidateFindings.map((finding) => ({
      candidateOnly: true as const,
      elementKey: finding.elementKey,
      relation: finding.relation,
      spanIds: [...finding.spanIds],
    })),
    candidateOnly: true as const,
    indicativeScore: null,
    level: null,
    levelAuthority: 'NONE' as const,
    masteryEffect: 'NONE' as const,
    operationFingerprint: input.operationFingerprint,
    progressionEffect: 'NONE' as const,
    protocolFingerprint: validation.protocolFingerprint,
    rawModelOutputSha256: validation.rawModelOutputSha256,
    rejectedFindingCount: validation.rejectedFindings.length,
    responseSha256: validation.responseSha256,
    score: null,
    scoreAuthority: 'NONE' as const,
    spanManifestSha256: validation.spanManifestSha256,
    state: publicState({
      candidateFindingCount: validation.candidateFindings.length,
      completeness: validation.completeness,
    }),
    unresolvedElementKeys: [...validation.unresolvedElementKeys],
  }) as EvidenceAssistPublicResult;
}

function inputFingerprint(input: RunEvidenceAssistInput): string {
  return fingerprint({
    idempotencyKey: input.idempotencyKey,
    orchestratorVersion: EVIDENCE_ASSIST_PRODUCT_ORCHESTRATOR_VERSION,
    protocolFingerprint: evidenceAssistProtocolFingerprint(),
    responseSha256: sha256(input.responseText),
    rubricFingerprint: input.compiled.rubricFingerprint,
    taskContextSha256: sha256(input.taskContext),
    taskPromptSha256: sha256(input.taskPrompt),
  });
}

async function executeOperation(input: {
  operationFingerprint: string;
  provider: EvidenceAssistProviderPort;
  runInput: RunEvidenceAssistInput;
}): Promise<EvidenceAssistPublicResult> {
  const prepared = prepareEvidenceAssistRequest({
    compiled: input.runInput.compiled,
    responseText: input.runInput.responseText,
    taskContext: input.runInput.taskContext,
    taskPrompt: input.runInput.taskPrompt,
  });
  const providerRequest = deepFreeze({
    candidateElementKeys: prepared.requestContext.candidateRubric.elements.map(
      ({ key }) => key,
    ),
    idempotencyKey: input.runInput.idempotencyKey,
    messages: prepared.messages,
    operationFingerprint: input.operationFingerprint,
    outputSchema: evidenceAssistJsonSchema(),
    protocolFingerprint: prepared.requestContext.protocolFingerprint,
    requestContextFingerprint: prepared.requestContext.contextFingerprint,
    spanIds: prepared.requestContext.spanManifest.spans.map(
      ({ spanId }) => spanId,
    ),
  }) as EvidenceAssistProviderRequest;
  let providerResponse: unknown;
  try {
    providerResponse = await input.provider.execute(providerRequest);
  } catch (cause) {
    throw new EvidenceAssistOrchestrationError('PROVIDER_FAILED', cause);
  }
  assertProviderResponse(providerResponse);
  let validation: ReturnType<typeof validateEvidenceAssistOutput>;
  try {
    validation = validateEvidenceAssistOutput({
      compiled: input.runInput.compiled,
      pipelineFingerprintSeed: `${EVIDENCE_ASSIST_PRODUCT_ORCHESTRATOR_VERSION}:${input.operationFingerprint}`,
      rawModelOutput: providerResponse.rawModelOutput,
      requestContext: prepared.requestContext,
      responseText: input.runInput.responseText,
    });
  } catch (cause) {
    throw new EvidenceAssistOrchestrationError('VALIDATION_FAILED', cause);
  }
  return mapPublicResult({
    operationFingerprint: input.operationFingerprint,
    validation,
  });
}

export function createEvidenceAssistOrchestrator(input: {
  gate?: EvidenceAssistFeatureGate;
  provider: EvidenceAssistProviderPort;
}): EvidenceAssistOrchestrator {
  const gate = deepFreeze({
    ...(input.gate ?? EVIDENCE_ASSIST_HARD_OFF_GATE),
  }) as EvidenceAssistFeatureGate;
  const operations = new Map<string, OperationRecord>();
  return {
    run(runInput) {
      try {
        if (!gate.enabled) {
          throw new EvidenceAssistOrchestrationError('FEATURE_DISABLED');
        }
        if (input.provider.kind !== 'OFFLINE_FAKE') {
          throw new EvidenceAssistOrchestrationError(
            'OFFLINE_FAKE_PROVIDER_REQUIRED',
          );
        }
        assertIdempotencyKey(runInput.idempotencyKey);
        const currentInputFingerprint = inputFingerprint(runInput);
        const existing = operations.get(runInput.idempotencyKey);
        if (existing) {
          if (existing.inputFingerprint !== currentInputFingerprint) {
            throw new EvidenceAssistOrchestrationError('IDEMPOTENCY_CONFLICT');
          }
          return existing.promise;
        }
        const promise = executeOperation({
          operationFingerprint: currentInputFingerprint,
          provider: input.provider,
          runInput,
        });
        operations.set(runInput.idempotencyKey, {
          inputFingerprint: currentInputFingerprint,
          promise,
        });
        return promise;
      } catch (error) {
        return Promise.reject(error);
      }
    },
  };
}
