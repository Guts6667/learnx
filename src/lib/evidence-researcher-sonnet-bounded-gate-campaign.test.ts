import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildOpenRouterRequestBody } from './ai-correction-provider-adapters.js';
import {
  boundedReasoningUsageError,
  summarizeSonnetBoundedGateMetrics,
  validateEvidenceResearcherSonnetBoundedGateCampaign,
} from './evidence-researcher-sonnet-bounded-gate-campaign.ts';

const root = process.cwd();
const paths = {
  attestation: resolve(
    root,
    'benchmarks/ai-correction/executable-rubric/sonnet-5-anthropic-bounded-reasoning-attestation-2026-08-16.json',
  ),
  campaign: resolve(
    root,
    'benchmarks/ai-correction/executable-rubric/sonnet-5-evidence-researcher-bounded-four-case.v1.json',
  ),
  rubric: resolve(
    root,
    'benchmarks/ai-correction/executable-rubric/writing-recommendation-fr.v1.json',
  ),
  selection: resolve(
    root,
    'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v2.manifest.json',
  ),
  spec: resolve(root, 'docs/V4_EXECUTABLE_RUBRIC_ENGINE_SPEC.md'),
};

function fixture() {
  const rubricFileText = readFileSync(paths.rubric, 'utf8');
  return {
    campaign: JSON.parse(readFileSync(paths.campaign, 'utf8')) as unknown,
    catalogAttestationText: readFileSync(paths.attestation, 'utf8'),
    rubric: JSON.parse(rubricFileText) as unknown,
    rubricFileText,
    semanticSelectionText: readFileSync(paths.selection, 'utf8'),
    specText: readFileSync(paths.spec, 'utf8'),
  };
}

describe('Sonnet 5 bounded evidence researcher four-case gate', () => {
  it('pins four fresh cases, no retry, and all live gates disabled', () => {
    const campaign =
      validateEvidenceResearcherSonnetBoundedGateCampaign(fixture());

    expect(campaign.execution.caseIds).toEqual([
      'writing-fr-base-mastered',
      'writing-fr-no-choice-negative',
      'writing-fr-evidence-mutation',
      'writing-fr-direct-injection',
    ]);
    expect(campaign.execution).toMatchObject({
      expectedLogicalWorkflows: 4,
      historicalResultsReused: 0,
      repetitionsPerCase: 1,
    });
    expect(campaign.retryPolicy).toMatchObject({
      maximumProviderAttempts: 4,
      maximumRetriesPerWorkflow: 0,
    });
    expect(campaign.blockers).toEqual({
      financeArbitration: 'NOT_GRANTED',
      holdout: 'PROHIBITED',
      liveExecution: 'BLOCKED',
      ownerAuthorization: 'NOT_GRANTED',
      productArbitration: 'NOT_GRANTED',
    });
    expect(campaign.feature.networkCallsAllowed).toBe(false);
  });

  it('sends an explicit 1024-token reasoning maximum and preserves 1800 visible tokens', () => {
    const campaign =
      validateEvidenceResearcherSonnetBoundedGateCampaign(fixture());
    const body = buildOpenRouterRequestBody({
      idempotencyKey: 'sonnet-bounded-gate-test',
      jsonSchema: { type: 'object' },
      messages: [{ content: 'test', role: 'system' }],
      modelId: campaign.researcher.modelId,
      profile: campaign.researcher.requestProfile,
    });

    expect(campaign.researcher.requestProfile).toMatchObject({
      reasoning: {
        budgetMode: 'EXPLICIT_MAX',
        budgetTokens: 1024,
      },
      totalOutputTokenLimit: 2824,
      visibleOutputTokenTarget: 1800,
    });
    expect(body).toMatchObject({
      max_tokens: 2824,
      reasoning: { max_tokens: 1024 },
      provider: {
        allow_fallbacks: false,
        order: ['Anthropic'],
        require_parameters: true,
      },
    });
    expect(body).not.toHaveProperty('temperature');
  });

  it('fails closed when the attestation does not expose reasoning', () => {
    const input = fixture();
    const attestation = JSON.parse(input.catalogAttestationText) as {
      supportedParameters: string[];
    };
    attestation.supportedParameters = attestation.supportedParameters.filter(
      (parameter) => parameter !== 'reasoning',
    );
    input.catalogAttestationText = `${JSON.stringify(attestation, null, 2)}\n`;
    const campaign = input.campaign as {
      authority: { catalogAttestationSha256: string };
    };
    campaign.authority.catalogAttestationSha256 = createHash('sha256')
      .update(input.catalogAttestationText)
      .digest('hex');

    expect(() =>
      validateEvidenceResearcherSonnetBoundedGateCampaign(input),
    ).toThrow('EVIDENCE_SONNET_BOUNDED_GATE_ATTESTATION_MISMATCH');
  });

  it('rejects missing visible output and any observed budget overflow', () => {
    expect(
      boundedReasoningUsageError({
        reasoningBudgetTokens: 1024,
        totalOutputTokenLimit: 2824,
        usage: { reasoningTokens: 1024, visibleOutputTokens: 0 },
      }),
    ).toBe('EVIDENCE_RESEARCHER_NO_VISIBLE_MODEL_OUTPUT');
    expect(
      boundedReasoningUsageError({
        reasoningBudgetTokens: 1024,
        totalOutputTokenLimit: 2824,
        usage: { reasoningTokens: 1025, visibleOutputTokens: 100 },
      }),
    ).toBe('EVIDENCE_RESEARCHER_REASONING_BUDGET_EXCEEDED');
    expect(
      boundedReasoningUsageError({
        reasoningBudgetTokens: 1024,
        totalOutputTokenLimit: 2824,
        usage: { reasoningTokens: 1024, visibleOutputTokens: 1801 },
      }),
    ).toBe('EVIDENCE_RESEARCHER_TOTAL_OUTPUT_BUDGET_EXCEEDED');
    expect(
      boundedReasoningUsageError({
        reasoningBudgetTokens: 1024,
        totalOutputTokenLimit: 2824,
        usage: { reasoningTokens: 1024, visibleOutputTokens: 1800 },
      }),
    ).toBeUndefined();
  });

  it('reports explicit workflow, atomic, safety, identity, and cost gates', () => {
    const output = (
      elementKey: string,
      status: 'NOT_DEMONSTRATED' | 'SUPPORTED',
    ) => ({
      elements: [
        {
          confidence: 0.95,
          contradictions: [],
          elementKey,
          evidenceSpans: [],
          status,
        },
      ],
      pipelineFingerprint: 'a'.repeat(64),
      role: 'EVIDENCE_RESEARCHER' as const,
    });
    const attempts = [
      {
        actualCostUsd: 0.01,
        caseId: 'positive',
        observedProvider: 'Anthropic',
        output: output('positive-element', 'SUPPORTED'),
        providerRequestId: 'request-positive',
        requestedRoute: 'Anthropic',
        status: 'VALID' as const,
        usage: {
          costSource: 'ACTUAL' as const,
          reasoningTokens: 100,
          visibleOutputTokens: 200,
        },
      },
      {
        actualCostUsd: 0.01,
        caseId: 'injection',
        observedProvider: 'Anthropic',
        output: output('negative-element', 'NOT_DEMONSTRATED'),
        providerRequestId: 'request-injection',
        requestedRoute: 'Anthropic',
        status: 'VALID' as const,
        usage: {
          costSource: 'ACTUAL' as const,
          reasoningTokens: 100,
          visibleOutputTokens: 200,
        },
      },
    ];

    expect(
      summarizeSonnetBoundedGateMetrics({
        attempts,
        cases: [
          {
            caseId: 'positive',
            expectedElements: [
              { elementKey: 'positive-element', status: 'SUPPORTED' },
            ],
          },
          {
            caseId: 'injection',
            expectedElements: [
              {
                elementKey: 'negative-element',
                status: 'NOT_DEMONSTRATED',
              },
            ],
            injectionBoundary: {},
          },
        ],
        expectedLogicalWorkflows: 2,
        expectedObservedProvider: 'Anthropic',
        reasoningBudgetTokens: 1024,
        requestedRoute: 'Anthropic',
        totalOutputTokenLimit: 2824,
      }),
    ).toEqual({
      atomicAgreementRate: 1,
      atomicComparisons: '2/2',
      dispatchAndCostReconciledRate: 1,
      exactElementCoverage: '2/2',
      exactQuoteValidityRate: 1,
      falseSupportedCount: 0,
      injectionAndCanarySafetyRate: 1,
      knownElementKeyRate: 1,
      observedProviderIdentityRate: 1,
      reasoningBudgetComplianceRate: 1,
      requestedRouteObservationRate: 1,
      usableWorkflows: '2/2',
      visibleOutputPresenceRate: 1,
    });
  });
});
