import {
  buildOpenRouterTransportManifest,
  CorrectionModelOutputError,
  CorrectionProviderError,
  getCorrectionProviderAdapter,
  type CorrectionProviderAdapter,
  type CorrectionProviderRequest,
  type CorrectionReasoningCapabilities,
  type CorrectionReasoningMode,
} from '../../lib/ai-correction-provider-adapters.js';
import {
  assertGeminiWireJsonSchema,
  EVIDENCE_ASSIST_GEMINI_WIRE_DIALECT,
  EVIDENCE_ASSIST_GEMINI_WIRE_DIALECT_VERSION,
  evidenceAssistGeminiWireSchemaFingerprint,
} from '../../lib/evidence-assist-protocol.js';
import type {
  WritingGateLiveAuthorizationProof,
  WritingFrameworkGateLiveProvider,
  WritingFrameworkGatePackage,
  WritingFrameworkGateProviderRequest,
  WritingFrameworkGateProviderRequestCore,
  WritingFrameworkGateProviderResult,
} from './writing-framework-selection-gate-runner-v2.js';
import {
  assertWritingGateLiveAuthorizationProof,
  createWritingGateRequestManifest,
} from './writing-framework-selection-gate-runner-v2.js';

const CLOSED_GEMINI_Q1_IDENTITY =
  'ef88a8e3b1bfd57ddc4afe787d8a920ea4b329e3d83b28b3fc4029487e88e9ed';

type OpenRouterGateProviderOptions = Readonly<{
  adapter?: CorrectionProviderAdapter;
  authorizationProof?: WritingGateLiveAuthorizationProof;
}>;

function adaptiveEffort(
  value: string | null,
): Extract<CorrectionReasoningMode, { mode: 'ADAPTIVE' }>['effort'] {
  const normalized = value?.toLocaleLowerCase();
  if (
    normalized === 'high' ||
    normalized === 'low' ||
    normalized === 'max' ||
    normalized === 'medium' ||
    normalized === 'minimal'
  ) {
    return normalized;
  }
  throw new Error('WRITING_GATE_REASONING_EFFORT_INVALID');
}

function assertGeminiTransportProfile(
  packageInput: WritingFrameworkGatePackage,
): void {
  const profile = packageInput.requestProfile;
  if (
    packageInput.wireModelId !== 'google/gemini-3.6-flash' ||
    packageInput.catalogSnapshotId !== 'google/gemini-3.6-flash-20260721' ||
    packageInput.requestedRoute !== 'google-vertex/global' ||
    packageInput.expectedObservedProvider !== 'Google' ||
    profile.reasoningMode !== 'EFFORT_ONLY' ||
    profile.reasoningMandatory !== true ||
    profile.reasoningEffort !== 'MINIMAL' ||
    profile.temperature !== null ||
    profile.maxOutputTokens !== 2_500 ||
    profile.visibleOutputTokenTarget !== 1_800 ||
    profile.timeoutMs !== 60_000
  ) {
    throw new Error('WRITING_GATE_OPENROUTER_IDENTITY_MISMATCH');
  }
}

function assertFreshLiveIdentity(
  packageInput: WritingFrameworkGatePackage,
  authorizationProof: WritingGateLiveAuthorizationProof | undefined,
): WritingGateLiveAuthorizationProof {
  assertGeminiTransportProfile(packageInput);
  if (packageInput.identityFingerprint === CLOSED_GEMINI_Q1_IDENTITY) {
    throw new Error('WRITING_GATE_IDENTITY_CLOSED_NO_REPLAY');
  }
  if (!authorizationProof) {
    throw new Error('WRITING_GATE_NEW_IDENTITY_AUTHORIZATION_REQUIRED');
  }
  assertWritingGateLiveAuthorizationProof(authorizationProof);
  if (
    authorizationProof.identityFingerprint !== packageInput.identityFingerprint
  ) {
    throw new Error('WRITING_GATE_NEW_IDENTITY_AUTHORIZATION_REQUIRED');
  }
  return authorizationProof;
}

function omittedTemperature(value: number | null): null {
  if (value !== null) {
    throw new Error('WRITING_GATE_TEMPERATURE_MUST_BE_OMITTED');
  }
  return null;
}

export function writingFrameworkGateOpenRouterRequestProfile(
  packageInput: WritingFrameworkGatePackage,
): CorrectionProviderRequest['profile'] {
  assertGeminiTransportProfile(packageInput);
  return Object.freeze({
    adapter: 'OPENROUTER_CHAT' as const,
    reasoning: {
      budgetMode: 'EFFORT_ONLY' as const,
      budgetTokens: null,
      effort: 'MINIMAL' as const,
    },
    routeProviders: [packageInput.requestedRoute],
    temperature: omittedTemperature(packageInput.requestProfile.temperature),
    timeoutMs: packageInput.requestProfile.timeoutMs,
    totalOutputTokenLimit: packageInput.requestProfile.maxOutputTokens,
    version: '1.0.0',
    visibleOutputTokenTarget:
      packageInput.requestProfile.visibleOutputTokenTarget,
  });
}

export function writingFrameworkGateReasoningCapabilities(
  packageInput: WritingFrameworkGatePackage,
): CorrectionReasoningCapabilities {
  assertGeminiTransportProfile(packageInput);
  const effort = adaptiveEffort(packageInput.requestProfile.reasoningEffort);
  return Object.freeze({
    adapter: 'OPENROUTER_CHAT' as const,
    modelId: packageInput.wireModelId,
    providerDefaultMode: 'ADAPTIVE' as const,
    reasoningMandatory: true,
    requestedRoute: packageInput.requestedRoute,
    supportedAdaptiveEfforts: [effort],
    supportedModes: ['ADAPTIVE'] as const,
  });
}

function errorResult(
  error: CorrectionModelOutputError | CorrectionProviderError,
): WritingFrameworkGateProviderResult {
  const usage =
    error instanceof CorrectionModelOutputError ? error.usage : undefined;
  return Object.freeze({
    actualCostUsd: usage?.actualCostUsd ?? null,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    clientRequestId: error.clientRequestId ?? null,
    costSource:
      usage?.costSource === 'ACTUAL' && usage.actualCostUsd !== undefined
        ? 'ACTUAL'
        : 'UNKNOWN',
    errorCode:
      error instanceof CorrectionProviderError &&
      error.message === 'PROVIDER_HTTP_ERROR' &&
      error.status !== undefined
        ? `PROVIDER_HTTP_${error.status}`
        : error.message,
    generationId: error.generationId ?? null,
    inputTokens: usage?.inputTokens ?? 0,
    latencyMs: error.latencyMs ?? 0,
    observedProvider: error.observedProvider ?? null,
    openRouterMetadata: error.openRouterMetadata ?? null,
    providerRequestId: error.providerRequestId ?? null,
    rawOutput: error.rawModelOutput ?? '',
    reasoningTokens: usage?.reasoningTokens ?? 0,
    visibleOutputTokens: usage?.visibleOutputTokens ?? 0,
  });
}

export class OpenRouterWritingFrameworkGateProvider implements WritingFrameworkGateLiveProvider {
  public readonly kind = 'OPENROUTER_LIVE' as const;
  public readonly authorizationProof: WritingGateLiveAuthorizationProof;
  public readonly authorizedIdentityFingerprint: string;
  private readonly adapter: CorrectionProviderAdapter;
  private readonly capabilities: CorrectionReasoningCapabilities;
  private readonly profile: CorrectionProviderRequest['profile'];

  public constructor(
    private readonly apiKey: string,
    private readonly packageInput: WritingFrameworkGatePackage,
    options: OpenRouterGateProviderOptions = {},
  ) {
    this.authorizationProof = assertFreshLiveIdentity(
      packageInput,
      options.authorizationProof,
    );
    this.authorizedIdentityFingerprint =
      this.authorizationProof.identityFingerprint;
    if (!apiKey.trim()) throw new Error('OPENROUTER_API_KEY_REQUIRED');
    this.adapter =
      options.adapter ?? getCorrectionProviderAdapter('OPENROUTER_CHAT');
    if (this.adapter.kind !== 'OPENROUTER_CHAT') {
      throw new Error('WRITING_GATE_OPENROUTER_ADAPTER_REQUIRED');
    }
    this.profile = writingFrameworkGateOpenRouterRequestProfile(packageInput);
    this.capabilities = writingFrameworkGateReasoningCapabilities(packageInput);
  }

  private adapterRequest(
    request: WritingFrameworkGateProviderRequestCore,
  ): Omit<CorrectionProviderRequest, 'apiKey'> {
    return {
      idempotencyKey: request.idempotencyKey,
      jsonSchema: { ...request.jsonSchema },
      messages: [...request.messages],
      modelId: this.packageInput.wireModelId,
      profile: this.profile,
      reasoning: {
        capabilities: this.capabilities,
        mode: {
          effort: adaptiveEffort(
            this.packageInput.requestProfile.reasoningEffort,
          ),
          mode: 'ADAPTIVE',
        },
      },
    };
  }

  public prepare(
    request: WritingFrameworkGateProviderRequestCore,
  ): ReturnType<WritingFrameworkGateLiveProvider['prepare']> {
    assertGeminiWireJsonSchema(request.jsonSchema);
    const transportManifest = buildOpenRouterTransportManifest(
      this.adapterRequest(request),
    );
    const wireSchemaSha256 = evidenceAssistGeminiWireSchemaFingerprint();
    if (transportManifest.schemaSha256 !== wireSchemaSha256) {
      throw new Error('WRITING_GATE_WIRE_SCHEMA_MISMATCH');
    }
    return createWritingGateRequestManifest({
      caseId: request.caseId,
      idempotencyKey: request.idempotencyKey,
      identityFingerprint: this.packageInput.identityFingerprint,
      requestContextFingerprint: request.requestContext.contextFingerprint,
      transportManifest,
      wireDialect: EVIDENCE_ASSIST_GEMINI_WIRE_DIALECT,
      wireDialectVersion: EVIDENCE_ASSIST_GEMINI_WIRE_DIALECT_VERSION,
      wireSchemaSha256,
    });
  }

  public async execute(
    request: WritingFrameworkGateProviderRequest,
  ): Promise<WritingFrameworkGateProviderResult> {
    const { requestManifest, ...requestCore } = request;
    const expectedManifest = this.prepare(requestCore);
    if (expectedManifest.manifestSha256 !== requestManifest.manifestSha256) {
      throw new Error('WRITING_GATE_REQUEST_MANIFEST_MISMATCH');
    }
    const expectedTransportManifestSha256 =
      requestManifest.transportManifestSha256;
    try {
      const result = await this.adapter.execute({
        apiKey: this.apiKey,
        ...this.adapterRequest(requestCore),
        expectedTransportManifestSha256,
      });
      return Object.freeze({
        actualCostUsd: result.usage.actualCostUsd ?? null,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        clientRequestId: result.clientRequestId ?? null,
        costSource:
          result.usage.costSource === 'ACTUAL' &&
          result.usage.actualCostUsd !== undefined
            ? 'ACTUAL'
            : 'UNKNOWN',
        generationId: result.generationId ?? null,
        inputTokens: result.usage.inputTokens,
        latencyMs: result.latencyMs,
        observedProvider: result.observedProvider,
        openRouterMetadata: result.openRouterMetadata ?? null,
        providerRequestId: result.providerRequestId ?? null,
        rawOutput: result.rawModelOutput,
        reasoningTokens: result.usage.reasoningTokens,
        visibleOutputTokens: result.usage.visibleOutputTokens,
      });
    } catch (error) {
      if (
        error instanceof CorrectionModelOutputError ||
        error instanceof CorrectionProviderError
      ) {
        return errorResult(error);
      }
      throw error;
    }
  }
}
