import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildAnthropicMessagesRequestBody,
  buildOpenRouterRequestBody,
  type CorrectionProviderRequest,
  type CorrectionReasoningCapabilities,
  type CorrectionReasoningMode,
} from './ai-correction-provider-adapters.ts';
import {
  loadSonnet5ReasoningCapabilities,
  SONNET_5_OPENROUTER_CATALOG_PATH,
  SONNET_5_REASONING_ATTESTATION_PATH,
  sonnet5ReasoningCapabilityAttestationSchema,
  type Sonnet5ReasoningAdapter,
} from './sonnet-5-reasoning-capability-attestation.ts';

const attestationText = readFileSync(
  resolve(process.cwd(), SONNET_5_REASONING_ATTESTATION_PATH),
  'utf8',
);
const catalogAttestationText = readFileSync(
  resolve(process.cwd(), SONNET_5_OPENROUTER_CATALOG_PATH),
  'utf8',
);

function load(adapter: Sonnet5ReasoningAdapter) {
  return loadSonnet5ReasoningCapabilities({
    adapter,
    attestationText,
    ...(adapter === 'OPENROUTER_CHAT' ? { catalogAttestationText } : {}),
  });
}

function profile(
  adapter: Sonnet5ReasoningAdapter,
): CorrectionProviderRequest['profile'] {
  return {
    adapter,
    reasoning: {
      budgetMode: 'OFF',
      budgetTokens: null,
      effort: 'OFF',
    },
    ...(adapter === 'OPENROUTER_CHAT' ? { routeProviders: ['Anthropic'] } : {}),
    temperature: null,
    timeoutMs: 60_000,
    totalOutputTokenLimit: 1_800,
    version: '4.0.0',
    visibleOutputTokenTarget: 1_800,
  };
}

function request(input: {
  adapter: Sonnet5ReasoningAdapter;
  capabilities: CorrectionReasoningCapabilities;
  mode: CorrectionReasoningMode;
}): Omit<CorrectionProviderRequest, 'apiKey'> {
  return {
    jsonSchema: { additionalProperties: false, properties: {}, type: 'object' },
    messages: [
      { content: 'Système', role: 'system' },
      { content: 'Production', role: 'user' },
    ],
    modelId: 'anthropic/claude-sonnet-5',
    profile: profile(input.adapter),
    reasoning: {
      capabilities: input.capabilities,
      mode: input.mode,
    },
  };
}

describe('Sonnet 5 reasoning capability attestation', () => {
  it('loads direct Anthropic DISABLED capability with the official pinned ID', () => {
    const loaded = load('ANTHROPIC_MESSAGES');

    expect(loaded).toMatchObject({
      activeIdentifiers: {
        internalModelId: 'anthropic/claude-sonnet-5',
        pinnedSnapshotId: 'claude-sonnet-5',
        requestedRoute: 'Anthropic',
        wireModelId: 'claude-sonnet-5',
      },
      capabilities: {
        adapter: 'ANTHROPIC_MESSAGES',
        modelId: 'anthropic/claude-sonnet-5',
        providerDefaultMode: 'ADAPTIVE',
        reasoningMandatory: false,
        requestedRoute: 'Anthropic',
        supportedModes: ['DISABLED', 'PROVIDER_DEFAULT'],
      },
      costGate: 'BLOCKED_ESTIMATED_ONLY',
      operationalReadiness: 'REASONING_ATTESTED_COST_BLOCKED',
    });
    expect(loaded.capabilities.supportedAdaptiveEfforts).toBeUndefined();

    expect(
      buildAnthropicMessagesRequestBody(
        request({
          adapter: 'ANTHROPIC_MESSAGES',
          capabilities: loaded.capabilities,
          mode: { mode: 'DISABLED' },
        }),
      ),
    ).toMatchObject({
      model: 'claude-sonnet-5',
      thinking: { type: 'disabled' },
    });
  });

  it('loads the exact OpenRouter route only with its catalog digest', () => {
    const loaded = load('OPENROUTER_CHAT');

    expect(loaded).toMatchObject({
      activeIdentifiers: {
        internalModelId: 'anthropic/claude-sonnet-5',
        pinnedSnapshotId: 'anthropic/claude-sonnet-5-20260630',
        requestedRoute: 'Anthropic',
        wireModelId: 'anthropic/claude-sonnet-5',
      },
      capabilities: {
        adapter: 'OPENROUTER_CHAT',
        providerDefaultMode: 'ADAPTIVE',
        reasoningMandatory: false,
        supportedModes: ['DISABLED', 'PROVIDER_DEFAULT'],
      },
      costGate: 'REQUIRES_ACTUAL_USAGE_COST_PER_ATTEMPT',
      operationalReadiness: 'REASONING_ATTESTED_EXISTING_ACTUAL_COST_PATH',
    });

    expect(
      buildOpenRouterRequestBody(
        request({
          adapter: 'OPENROUTER_CHAT',
          capabilities: loaded.capabilities,
          mode: { mode: 'DISABLED' },
        }),
      ),
    ).toMatchObject({
      model: 'anthropic/claude-sonnet-5',
      provider: {
        allow_fallbacks: false,
        order: ['Anthropic'],
        require_parameters: true,
      },
      reasoning: { effort: 'none' },
    });
  });

  it('fails closed when the OpenRouter catalog is missing or tampered', () => {
    expect(() =>
      loadSonnet5ReasoningCapabilities({
        adapter: 'OPENROUTER_CHAT',
        attestationText,
      }),
    ).toThrow('SONNET_5_REASONING_ROUTE_CATALOG_REQUIRED');

    expect(() =>
      loadSonnet5ReasoningCapabilities({
        adapter: 'OPENROUTER_CHAT',
        attestationText,
        catalogAttestationText: catalogAttestationText.replace(
          '"fallbackAllowed": false',
          '"fallbackAllowed": true',
        ),
      }),
    ).toThrow('SONNET_5_REASONING_CATALOG_DIGEST_MISMATCH');
  });

  it('fails closed on any attestation byte change', () => {
    expect(() =>
      loadSonnet5ReasoningCapabilities({
        adapter: 'ANTHROPIC_MESSAGES',
        attestationText: `${attestationText}\n`,
      }),
    ).toThrow('SONNET_5_REASONING_ATTESTATION_DIGEST_MISMATCH');
  });

  it('keeps the artifact schema strict independently of the digest gate', () => {
    const parsed = JSON.parse(attestationText) as Record<string, unknown>;
    expect(
      sonnet5ReasoningCapabilityAttestationSchema.safeParse({
        ...parsed,
        unexpectedAuthority: true,
      }).success,
    ).toBe(false);
  });

  it('does not attest explicit adaptive effort or legacy budgets', () => {
    const loaded = load('OPENROUTER_CHAT');

    expect(() =>
      buildOpenRouterRequestBody(
        request({
          adapter: 'OPENROUTER_CHAT',
          capabilities: loaded.capabilities,
          mode: { effort: 'low', mode: 'ADAPTIVE' },
        }),
      ),
    ).toThrow('REASONING_MODE_NOT_ATTESTED');
    expect(() =>
      buildOpenRouterRequestBody(
        request({
          adapter: 'OPENROUTER_CHAT',
          capabilities: loaded.capabilities,
          mode: { budgetTokens: 1_024, mode: 'LEGACY_BUDGET' },
        }),
      ),
    ).toThrow('REASONING_MODE_UNSUPPORTED_FOR_MODEL');
  });
});
