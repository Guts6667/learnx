import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildOpenRouterRequestBody } from './ai-correction-provider-adapters.js';
import { validateEvidenceResearcherSonnetPanelCampaign } from './evidence-researcher-sonnet-panel-campaign.ts';

const root = process.cwd();
const paths = {
  attestation: resolve(
    root,
    'benchmarks/ai-correction/executable-rubric/sonnet-5-anthropic-attestation-2026-08-15.json',
  ),
  campaign: resolve(
    root,
    'benchmarks/ai-correction/executable-rubric/sonnet-5-evidence-researcher-panel.v1.json',
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

describe('Sonnet 5 evidence researcher 10x2 panel campaign', () => {
  it('pins the ten discriminating cases with two repetitions and no retry', () => {
    const campaign = validateEvidenceResearcherSonnetPanelCampaign(fixture());

    expect(campaign.execution).toMatchObject({
      expectedLogicalWorkflows: 20,
      historicalResultsReused: 0,
      repetitionsPerCase: 2,
    });
    expect(campaign.execution.caseIds).toEqual([
      'writing-fr-base-mastered',
      'writing-fr-paraphrase-mastered',
      'writing-fr-concise-mastered',
      'writing-fr-typos-unicode-mastered',
      'writing-fr-no-choice-negative',
      'writing-fr-evidence-mutation',
      'writing-fr-reasoning-mutation',
      'writing-fr-contradiction-mutation',
      'writing-fr-direct-injection',
      'writing-fr-unicode-injection',
    ]);
    expect(campaign.retryPolicy).toMatchObject({
      maximumProviderAttempts: 20,
      maximumRetriesPerWorkflow: 0,
    });
  });

  it('records provider-default reasoning while omitting the transport parameter', () => {
    const campaign = validateEvidenceResearcherSonnetPanelCampaign(fixture());
    const body = buildOpenRouterRequestBody({
      idempotencyKey: 'sonnet-panel-test',
      jsonSchema: { type: 'object' },
      messages: [{ content: 'test', role: 'system' }],
      modelId: campaign.researcher.modelId,
      profile: campaign.researcher.requestProfile,
    });

    expect(campaign.researcher.reasoningObservation.mode).toBe(
      'PROVIDER_DEFAULT_UNSPECIFIED',
    );
    expect(body).not.toHaveProperty('reasoning');
    expect(body).not.toHaveProperty('temperature');
    expect(body.provider).toEqual({
      allow_fallbacks: false,
      order: ['Anthropic'],
      require_parameters: true,
    });
  });

  it('keeps all live gates disabled before arbitration', () => {
    const campaign = validateEvidenceResearcherSonnetPanelCampaign(fixture());

    expect(campaign.blockers).toEqual({
      financeArbitration: 'NOT_GRANTED',
      holdout: 'PROHIBITED',
      liveExecution: 'BLOCKED',
      ownerAuthorization: 'NOT_GRANTED',
      productArbitration: 'NOT_GRANTED',
    });
    expect(campaign.feature).toEqual({
      enabled: false,
      networkCallsAllowed: false,
      scope: 'RESEARCH_ONLY',
    });
  });

  it('rejects any semantic selection digest mutation', () => {
    const input = fixture();
    input.semanticSelectionText = `${input.semanticSelectionText}\n`;

    expect(() =>
      validateEvidenceResearcherSonnetPanelCampaign(input),
    ).toThrow('EVIDENCE_SONNET_PANEL_AUTHORITY_DIGEST_MISMATCH');
  });
});
