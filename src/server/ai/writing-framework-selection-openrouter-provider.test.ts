import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  evidenceAssistJsonSchema,
  prepareEvidenceAssistRequestV2,
} from '../../lib/evidence-assist-protocol-v2-adapter.ts';
import {
  buildWritingFrameworkGatePackage,
  type WritingFrameworkGatePackage,
  type WritingFrameworkGateProviderRequest,
} from './writing-framework-selection-gate-runner-v2.ts';
import {
  OpenRouterWritingFrameworkGateProvider,
  writingFrameworkGateOpenRouterRequestProfile,
  writingFrameworkGateReasoningCapabilities,
} from './writing-framework-selection-openrouter-provider.ts';

const root = process.cwd();
const dossierPath =
  'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-freeze.v1.json';
const financePath =
  'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-finance-envelope.approved.v1.json';

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8');
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function loadPackage(): WritingFrameworkGatePackage {
  const dossierText = read(dossierPath);
  const dossier = JSON.parse(dossierText) as {
    authorities: Record<string, { path: string }>;
  };
  return buildWritingFrameworkGatePackage({
    authorityTexts: Object.fromEntries(
      Object.values(dossier.authorities).map(({ path }) => [path, read(path)]),
    ),
    dossierPath,
    dossierText,
    financeText: read(financePath),
  });
}

function providerRequest(
  packageInput: WritingFrameworkGatePackage,
): WritingFrameworkGateProviderRequest {
  const caseItem = packageInput.cases[0];
  if (!caseItem) throw new Error('TEST_GATE_CASE_MISSING');
  const prepared = prepareEvidenceAssistRequestV2({
    canaryFactory: () => 'lx-canary-0123456789abcdef0123456789abcdef',
    compiled: packageInput.compiled,
    responseText: caseItem.responseText,
    taskContext: packageInput.taskContext,
    taskPrompt: packageInput.taskPrompt,
  });
  return {
    caseId: caseItem.caseId,
    idempotencyKey: 'a'.repeat(64),
    jsonSchema: evidenceAssistJsonSchema(),
    messages: prepared.messages,
    requestContext: prepared.requestContext,
  };
}

function openRouterResponse(input: {
  cost?: number;
  id?: string;
}): Response {
  return new Response(
    JSON.stringify({
      choices: [
        {
          finish_reason: 'stop',
          message: { content: JSON.stringify({ findings: [] }) },
        },
      ],
      ...(input.id === undefined ? {} : { id: input.id }),
      model: 'google/gemini-3.6-flash',
      provider: 'Google',
      usage: {
        completion_tokens: 80,
        completion_tokens_details: { reasoning_tokens: 20 },
        ...(input.cost === undefined ? {} : { cost: input.cost }),
        prompt_tokens: 120,
      },
    }),
    { headers: { 'content-type': 'application/json' }, status: 200 },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Gemini 3.6 writing framework OpenRouter transport', () => {
  it('fails before key lookup or network when the candidate is absent', () => {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'scripts/run-writing-framework-selection-gate-v2.ts'],
      {
        cwd: root,
        encoding: 'utf8',
        env: { PATH: process.env.PATH ?? '' },
      },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('WRITING_GATE_CANDIDATE_REQUIRED');
    expect(result.stderr).not.toContain('OPENROUTER_API_KEY_REQUIRED');
  });

  it('rejects the inherited Sonnet GO namespace before key lookup or network', () => {
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        'scripts/run-writing-framework-selection-gate-v2.ts',
        '--candidate=gemini-3.6',
        '--execute',
        '--owner-go=GO_V4_009C_S2_EF88A8E3B1BFD57D',
      ],
      {
        cwd: root,
        encoding: 'utf8',
        env: { PATH: process.env.PATH ?? '' },
      },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      'OWNER_GO_REQUIRED_USE_EXACT_TOKEN_GO_V4_003E_Q1_GEMINI36_EF88A8E3B1BFD57D',
    );
    expect(result.stderr).not.toContain('OPENROUTER_API_KEY_REQUIRED');
  });

  it('binds the approved envelope and simulated transport proof', () => {
    const finance = JSON.parse(read(financePath)) as Record<string, unknown>;
    expect(finance).toMatchObject({
      authorizationBoundary: {
        modelCallsAllowed: false,
        ownerNetworkAuthorization: 'NOT_GRANTED',
      },
      campaign: {
        identityFingerprint:
          'ef88a8e3b1bfd57ddc4afe787d8a920ea4b329e3d83b28b3fc4029487e88e9ed',
      },
      gateBound: { maximumProviderCostUsd: 0.5 },
      treasuryStress: {
        approvedCapTreasuryReserveDisplayUsd: 0.652,
        approvedCapTreasuryReserveUsd: 0.65199,
        calculatedBoundLoadedAndFxUsd: 0.63029959668,
      },
    });
    const artifact = JSON.parse(
      read(
        'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-network-transport-preflight.v1.json',
      ),
    ) as Record<string, unknown>;
    const { preflightFingerprint, ...core } = artifact;
    expect(preflightFingerprint).toBe(
      '317966c06fed11a96a004932e60a8540a3bafb01cc7eceb629c878dada71a079',
    );
    expect(sha256(JSON.stringify(canonicalize(core)))).toBe(
      preflightFingerprint,
    );
    expect(artifact).toMatchObject({
      authorizationBoundary: {
        modelCallsAllowed: false,
        ownerNetworkAuthorization: 'NOT_GRANTED',
      },
      simulation: { actualNetworkRequests: 0, modelCallsPerformed: 0 },
    });
    const bindings = artifact.sourceBindings as Record<
      string,
      { path: string; sha256: string }
    >;
    for (const { path, sha256: expectedSha } of Object.values(bindings)) {
      expect(sha256(read(path))).toBe(expectedSha);
    }
  });

  it('derives the exact payload from the approved frozen dossier', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(openRouterResponse({ cost: 0.01, id: 'gen-test-1' }));
    vi.stubGlobal('fetch', fetchMock);
    const packageInput = loadPackage();
    const provider = new OpenRouterWritingFrameworkGateProvider(
      'test-key-never-sent',
      packageInput,
    );

    const result = await provider.execute(providerRequest(packageInput));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      max_tokens: 2500,
      model: 'google/gemini-3.6-flash',
      provider: {
        allow_fallbacks: false,
        order: ['google-vertex/global'],
        require_parameters: true,
      },
      reasoning: { effort: 'minimal' },
      response_format: {
        json_schema: { strict: true },
        type: 'json_schema',
      },
    });
    expect(body).not.toHaveProperty('temperature');
    expect(JSON.stringify(body)).not.toMatch(/sonnet|anthropic/iu);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(result).toMatchObject({
      actualCostUsd: 0.01,
      costSource: 'ACTUAL',
      observedProvider: 'Google',
      providerRequestId: 'gen-test-1',
      reasoningTokens: 20,
      visibleOutputTokens: 60,
    });
  });

  it('exposes the dossier-derived profile and mandatory minimal reasoning', () => {
    const packageInput = loadPackage();
    expect(writingFrameworkGateOpenRouterRequestProfile(packageInput)).toEqual({
      adapter: 'OPENROUTER_CHAT',
      reasoning: {
        budgetMode: 'EFFORT_ONLY',
        budgetTokens: null,
        effort: 'MINIMAL',
      },
      routeProviders: ['google-vertex/global'],
      temperature: null,
      timeoutMs: 60000,
      totalOutputTokenLimit: 2500,
      version: '1.0.0',
      visibleOutputTokenTarget: 1800,
    });
    expect(writingFrameworkGateReasoningCapabilities(packageInput)).toEqual({
      adapter: 'OPENROUTER_CHAT',
      modelId: 'google/gemini-3.6-flash',
      providerDefaultMode: 'ADAPTIVE',
      reasoningMandatory: true,
      requestedRoute: 'google-vertex/global',
      supportedAdaptiveEfforts: ['minimal'],
      supportedModes: ['ADAPTIVE'],
    });
  });

  it('fails closed on any identity or profile drift', () => {
    const packageInput = loadPackage();
    expect(
      () =>
        new OpenRouterWritingFrameworkGateProvider('test-key', {
          ...packageInput,
          requestProfile: {
            ...packageInput.requestProfile,
            temperature: 0,
          },
        }),
    ).toThrow('WRITING_GATE_OPENROUTER_IDENTITY_MISMATCH');
    expect(read('src/server/ai/writing-framework-selection-openrouter-provider.ts')).not.toMatch(
      /sonnet|anthropic/iu,
    );
  });

  it('preserves missing cost and request id as null instead of inventing them', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(openRouterResponse({}));
    vi.stubGlobal('fetch', fetchMock);
    const packageInput = loadPackage();
    const result = await new OpenRouterWritingFrameworkGateProvider(
      'test-key-never-sent',
      packageInput,
    ).execute(providerRequest(packageInput));

    expect(result).toMatchObject({
      actualCostUsd: null,
      costSource: 'UNKNOWN',
      observedProvider: 'Google',
      providerRequestId: null,
    });
  });

  it('normalizes a simulated timeout without a retry', async () => {
    const timeout = new DOMException('simulated timeout', 'TimeoutError');
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(timeout);
    vi.stubGlobal('fetch', fetchMock);
    const packageInput = loadPackage();
    const result = await new OpenRouterWritingFrameworkGateProvider(
      'test-key-never-sent',
      packageInput,
    ).execute(providerRequest(packageInput));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      actualCostUsd: null,
      costSource: 'UNKNOWN',
      errorCode: 'PROVIDER_TIMEOUT',
      providerRequestId: null,
    });
  });
});
