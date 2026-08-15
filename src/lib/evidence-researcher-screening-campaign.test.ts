import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildOpenRouterRequestBody } from './ai-correction-provider-adapters.js';
import { validateEvidenceResearcherScreeningCampaign } from './evidence-researcher-screening-campaign.js';

const root = resolve('benchmarks/ai-correction/executable-rubric');

async function fixture() {
  const [
    catalogAttestationText,
    campaignText,
    rubricFileText,
    semanticCorpusText,
    specText,
  ] = await Promise.all([
    readFile(resolve(root, 'sonnet-5-anthropic-attestation-2026-08-15.json'), 'utf8'),
    readFile(resolve(root, 'sonnet-5-evidence-researcher-screening.v1.json'), 'utf8'),
    readFile(resolve(root, 'writing-recommendation-fr.v1.json'), 'utf8'),
    readFile(resolve(root, 'writing-fr-semantic-three-case-development.v2.json'), 'utf8'),
    readFile(resolve('docs/V4_EXECUTABLE_RUBRIC_ENGINE_SPEC.md'), 'utf8'),
  ]);
  return {
    campaign: JSON.parse(campaignText) as unknown,
    catalogAttestationText,
    rubric: JSON.parse(rubricFileText) as unknown,
    rubricFileText,
    semanticCorpusText,
    specText,
  };
}

describe('Sonnet 5 evidence researcher screening campaign', () => {
  it('pins the direct Anthropic route under the unchanged protocol', async () => {
    const campaign = validateEvidenceResearcherScreeningCampaign(
      await fixture(),
    );
    expect(campaign.researcher.modelSnapshot).toBe(
      'anthropic/claude-sonnet-5-20260630',
    );
    expect(campaign.researcher.requestedRoute).toBe('Anthropic');
    expect(campaign.researcher.promptVersion).toBe('1.3.0');
    expect(campaign.execution.caseIds).toEqual([
      'writing-fr-base-mastered',
      'writing-fr-no-choice-negative',
      'writing-fr-direct-injection',
    ]);
  });

  it('omits temperature and reasoning from the OpenRouter payload', async () => {
    const campaign = validateEvidenceResearcherScreeningCampaign(
      await fixture(),
    );
    const body = buildOpenRouterRequestBody({
      idempotencyKey: 'screening-test',
      jsonSchema: { type: 'object' },
      messages: [{ content: 'test', role: 'system' }],
      modelId: campaign.researcher.modelId,
      profile: campaign.researcher.requestProfile,
    });
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('reasoning');
    expect(body.provider).toEqual({
      allow_fallbacks: false,
      order: ['Anthropic'],
      require_parameters: true,
    });
  });

  it('rejects any catalog attestation mutation', async () => {
    const input = await fixture();
    input.catalogAttestationText = `${input.catalogAttestationText}\n`;
    expect(() => validateEvidenceResearcherScreeningCampaign(input)).toThrow(
      'EVIDENCE_SCREENING_AUTHORITY_DIGEST_MISMATCH',
    );
  });
});
