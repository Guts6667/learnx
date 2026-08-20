import { createHash } from 'node:crypto';

import { z } from 'zod';

import type { CorrectionReasoningCapabilities } from './ai-correction-provider-adapters.js';

export const SONNET_5_REASONING_ATTESTATION_PATH =
  'benchmarks/ai-correction/executable-rubric/sonnet-5-reasoning-capability-attestation-2026-08-16.json';
export const SONNET_5_REASONING_ATTESTATION_SHA256 =
  '620a9a993004545028811f39ce1f39ac59e73730b3844b3346229165a32b1834';
export const SONNET_5_OPENROUTER_CATALOG_PATH =
  'benchmarks/ai-correction/executable-rubric/sonnet-5-anthropic-attestation-2026-08-15.json';
export const SONNET_5_OPENROUTER_CATALOG_SHA256 =
  'c30f95888e9774842262743593fca498a97c6cd335ad287e918da7b9eee350a3';

const sourceSchema = z
  .object({
    locator: z.string().trim().min(1),
    sourceId: z.string().trim().min(1),
    supports: z.array(z.string().trim().min(1)).min(1),
    url: z.string().url(),
  })
  .strict();

const directRouteSchema = z
  .object({
    adapter: z.literal('ANTHROPIC_MESSAGES'),
    costGate: z.literal('BLOCKED_ESTIMATED_ONLY'),
    derivation: z.tuple([
      z.literal('ANTHROPIC_API_MODEL_ID'),
      z.literal('ANTHROPIC_DATELESS_PINNED_SNAPSHOT'),
      z.literal('ANTHROPIC_DEFAULT_ADAPTIVE'),
      z.literal('ANTHROPIC_DISABLED_WIRE'),
      z.literal('ANTHROPIC_LEGACY_BUDGET_REJECTED'),
    ]),
    disabledWireContract: z
      .object({
        thinking: z.object({ type: z.literal('disabled') }).strict(),
      })
      .strict(),
    operationalReadiness: z.literal('REASONING_ATTESTED_COST_BLOCKED'),
    requestedRoute: z.literal('Anthropic'),
    supportedModes: z.tuple([
      z.literal('DISABLED'),
      z.literal('PROVIDER_DEFAULT'),
    ]),
    wireModelId: z.literal('claude-sonnet-5'),
  })
  .strict();

const openRouterRouteSchema = z
  .object({
    adapter: z.literal('OPENROUTER_CHAT'),
    catalogSnapshotId: z.literal('anthropic/claude-sonnet-5-20260630'),
    costGate: z.literal('REQUIRES_ACTUAL_USAGE_COST_PER_ATTEMPT'),
    derivation: z.tuple([
      z.literal('ANTHROPIC_API_MODEL_ID'),
      z.literal('ANTHROPIC_DEFAULT_ADAPTIVE'),
      z.literal('ANTHROPIC_DISABLED_WIRE'),
      z.literal('ANTHROPIC_LEGACY_BUDGET_REJECTED'),
      z.literal('OPENROUTER_NONE_DISABLES_REASONING'),
      z.literal('OPENROUTER_CLAUDE_46_PLUS_EFFORT_MAPPING'),
      z.literal('OPENROUTER_EXACT_ROUTE_SUPPORTS_REASONING_PARAMETERS'),
    ]),
    disabledWireContract: z
      .object({
        reasoning: z.object({ effort: z.literal('none') }).strict(),
      })
      .strict(),
    exactRouteCatalog: z
      .object({
        fallbackAllowed: z.literal(false),
        path: z.literal(SONNET_5_OPENROUTER_CATALOG_PATH),
        providerName: z.literal('Anthropic'),
        requiredSupportedParameters: z.tuple([
          z.literal('reasoning'),
          z.literal('reasoning_effort'),
        ]),
        sha256: z.literal(SONNET_5_OPENROUTER_CATALOG_SHA256),
      })
      .strict(),
    operationalReadiness: z.literal(
      'REASONING_ATTESTED_EXISTING_ACTUAL_COST_PATH',
    ),
    requestedRoute: z.literal('Anthropic'),
    supportedModes: z.tuple([
      z.literal('DISABLED'),
      z.literal('PROVIDER_DEFAULT'),
    ]),
    wireModelId: z.literal('anthropic/claude-sonnet-5'),
  })
  .strict();

export const sonnet5ReasoningCapabilityAttestationSchema = z
  .object({
    attestationId: z.literal(
      'learnx-sonnet-5-reasoning-capabilities-2026-08-16',
    ),
    claims: z
      .object({
        explicitAdaptiveEffortsAttested: z.literal(false),
        explicitDisabledSupported: z.literal(true),
        legacyBudgetSupported: z.literal(false),
        providerDefaultMode: z.literal('ADAPTIVE'),
        reasoningMandatory: z.literal(false),
      })
      .strict(),
    limitations: z.tuple([
      z.literal(
        'This attestation does not authorize a model call or promotion.',
      ),
      z.literal(
        'No explicit adaptive effort value is attested for the exact route.',
      ),
      z.literal(
        'The Anthropic Messages adapter reports estimated cost only and cannot satisfy the current reconciliation gate.',
      ),
      z.literal(
        'The OpenRouter route remains fail-closed if usage.cost is absent or is not normalized as ACTUAL.',
      ),
    ]),
    modelIdentity: z
      .object({
        anthropicApiModelId: z.literal('claude-sonnet-5'),
        anthropicPinnedSnapshotId: z.literal('claude-sonnet-5'),
        anthropicVersioningSemantics: z.literal(
          'DATELESS_ID_IS_PINNED_SNAPSHOT',
        ),
        internalModelId: z.literal('anthropic/claude-sonnet-5'),
      })
      .strict(),
    observedAt: z.literal('2026-08-16T00:00:00+02:00'),
    routes: z.tuple([directRouteSchema, openRouterRouteSchema]),
    schemaVersion: z.literal(1),
    scope: z
      .object({
        costAttested: z.literal(false),
        modelCallPerformed: z.literal(false),
        promotionGranted: z.literal(false),
        purpose: z.literal('REQUEST_REASONING_SERIALIZATION_ONLY'),
        qualityAttested: z.literal(false),
      })
      .strict(),
    sources: z.tuple([
      sourceSchema.extend({
        locator: z.literal('API model ID and thinking behavior sections'),
        sourceId: z.literal('ANTHROPIC_SONNET_5_WHATS_NEW'),
        supports: z.tuple([
          z.literal('ANTHROPIC_API_MODEL_ID'),
          z.literal('ANTHROPIC_DEFAULT_ADAPTIVE'),
          z.literal('ANTHROPIC_DISABLED_WIRE'),
          z.literal('ANTHROPIC_LEGACY_BUDGET_REJECTED'),
        ]),
        url: z.literal(
          'https://platform.claude.com/docs/en/about-claude/models/whats-new-sonnet-5',
        ),
      }),
      sourceSchema.extend({
        locator: z.literal('Claude 4.6 and later versioning section'),
        sourceId: z.literal('ANTHROPIC_MODEL_IDS_AND_VERSIONS'),
        supports: z.tuple([z.literal('ANTHROPIC_DATELESS_PINNED_SNAPSHOT')]),
        url: z.literal(
          'https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions',
        ),
      }),
      sourceSchema.extend({
        locator: z.literal('Sonnet 5 disabled-thinking request example'),
        sourceId: z.literal('ANTHROPIC_EXTENDED_THINKING_MODELS'),
        supports: z.tuple([z.literal('ANTHROPIC_DISABLED_WIRE')]),
        url: z.literal(
          'https://platform.claude.com/docs/en/about-claude/models/extended-thinking-models',
        ),
      }),
      sourceSchema.extend({
        locator: z.literal(
          'Unified reasoning configuration and effort none semantics',
        ),
        sourceId: z.literal('OPENROUTER_REASONING_TOKENS'),
        supports: z.tuple([z.literal('OPENROUTER_NONE_DISABLES_REASONING')]),
        url: z.literal(
          'https://openrouter.ai/docs/guides/best-practices/reasoning-tokens',
        ),
      }),
      sourceSchema.extend({
        locator: z.literal('Claude 4.6+ reasoning effort mapping section'),
        sourceId: z.literal('OPENROUTER_CLAUDE_46_MIGRATION'),
        supports: z.tuple([
          z.literal('OPENROUTER_CLAUDE_46_PLUS_EFFORT_MAPPING'),
          z.literal('OPENROUTER_NONE_DISABLES_REASONING'),
        ]),
        url: z.literal(
          'https://openrouter.ai/docs/cookbook/evaluate-and-optimize/model-migrations/claude-4-6',
        ),
      }),
    ]),
    status: z.literal('REASONING_CAPABILITY_ATTESTED_ONLY'),
  })
  .strict();

const openRouterCatalogSchema = z
  .object({
    automaticRoutingAllowed: z.literal(false),
    contextLength: z.literal(1_000_000),
    fallbackAllowed: z.literal(false),
    maxCompletionTokens: z.literal(128_000),
    modelId: z.literal('anthropic/claude-sonnet-5'),
    modelSnapshot: z.literal('anthropic/claude-sonnet-5-20260630'),
    observedAt: z.literal('2026-08-15T19:15:00+02:00'),
    pricing: z
      .object({
        completionUsdPerToken: z.literal(0.00001),
        inputCacheReadUsdPerToken: z.literal(0.0000002),
        inputCacheWriteUsdPerToken: z.literal(0.0000025),
        promptUsdPerToken: z.literal(0.000002),
      })
      .strict(),
    providerName: z.literal('Anthropic'),
    routeProviderName: z.literal('Anthropic'),
    routeTag: z.literal('anthropic'),
    schemaVersion: z.literal(1),
    selectionRationale: z.literal(
      'Direct Anthropic route supports strict structured outputs and omits temperature; the candidate is screened under the unchanged evidence researcher 1.3 protocol.',
    ),
    source: z.literal(
      'https://openrouter.ai/api/v1/models/anthropic/claude-sonnet-5/endpoints',
    ),
    status: z.literal(0),
    supportedParameters: z.tuple([
      z.literal('max_tokens'),
      z.literal('stop'),
      z.literal('reasoning'),
      z.literal('include_reasoning'),
      z.literal('tools'),
      z.literal('tool_choice'),
      z.literal('structured_outputs'),
      z.literal('response_format'),
      z.literal('verbosity'),
      z.literal('reasoning_effort'),
    ]),
    warning: z.literal(
      'Read-only catalog snapshot for a bounded R&D gate; it is not a production activation or price guarantee.',
    ),
  })
  .strict();

export type Sonnet5ReasoningAdapter = 'ANTHROPIC_MESSAGES' | 'OPENROUTER_CHAT';

export type Sonnet5ReasoningCapabilityLoadResult = {
  activeIdentifiers: {
    internalModelId: 'anthropic/claude-sonnet-5';
    pinnedSnapshotId: 'anthropic/claude-sonnet-5-20260630' | 'claude-sonnet-5';
    requestedRoute: 'Anthropic';
    wireModelId: 'anthropic/claude-sonnet-5' | 'claude-sonnet-5';
  };
  capabilities: CorrectionReasoningCapabilities;
  costGate: 'BLOCKED_ESTIMATED_ONLY' | 'REQUIRES_ACTUAL_USAGE_COST_PER_ATTEMPT';
  operationalReadiness:
    | 'REASONING_ATTESTED_COST_BLOCKED'
    | 'REASONING_ATTESTED_EXISTING_ACTUAL_COST_PATH';
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function requireApprovedArtifact(attestationText: string) {
  if (sha256(attestationText) !== SONNET_5_REASONING_ATTESTATION_SHA256) {
    throw new Error('SONNET_5_REASONING_ATTESTATION_DIGEST_MISMATCH');
  }
  return sonnet5ReasoningCapabilityAttestationSchema.parse(
    JSON.parse(attestationText) as unknown,
  );
}

function requireExactOpenRouterCatalog(catalogText: string): void {
  if (sha256(catalogText) !== SONNET_5_OPENROUTER_CATALOG_SHA256) {
    throw new Error('SONNET_5_REASONING_CATALOG_DIGEST_MISMATCH');
  }
  openRouterCatalogSchema.parse(JSON.parse(catalogText) as unknown);
}

function correctionCapabilities(
  adapter: Sonnet5ReasoningAdapter,
): CorrectionReasoningCapabilities {
  return {
    adapter,
    modelId: 'anthropic/claude-sonnet-5',
    providerDefaultMode: 'ADAPTIVE',
    reasoningMandatory: false,
    requestedRoute: 'Anthropic',
    supportedModes: ['DISABLED', 'PROVIDER_DEFAULT'],
  };
}

export function loadSonnet5ReasoningCapabilities(input: {
  adapter: Sonnet5ReasoningAdapter;
  attestationText: string;
  catalogAttestationText?: string;
}): Sonnet5ReasoningCapabilityLoadResult {
  const attestation = requireApprovedArtifact(input.attestationText);
  const route =
    input.adapter === 'ANTHROPIC_MESSAGES'
      ? attestation.routes[0]
      : attestation.routes[1];

  if (input.adapter === 'OPENROUTER_CHAT') {
    if (input.catalogAttestationText === undefined) {
      throw new Error('SONNET_5_REASONING_ROUTE_CATALOG_REQUIRED');
    }
    requireExactOpenRouterCatalog(input.catalogAttestationText);
  }

  return {
    activeIdentifiers: {
      internalModelId: attestation.modelIdentity.internalModelId,
      pinnedSnapshotId:
        route.adapter === 'ANTHROPIC_MESSAGES'
          ? attestation.modelIdentity.anthropicPinnedSnapshotId
          : route.catalogSnapshotId,
      requestedRoute: route.requestedRoute,
      wireModelId: route.wireModelId,
    },
    capabilities: correctionCapabilities(input.adapter),
    costGate: route.costGate,
    operationalReadiness: route.operationalReadiness,
  };
}
