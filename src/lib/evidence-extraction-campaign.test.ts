import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { validateEvidenceExtractionCampaign } from './evidence-extraction-campaign.ts';

const campaignPath = resolve(
  process.cwd(),
  'benchmarks/ai-correction/executable-rubric/gemini-evidence-researcher-mini-panel.v1.json',
);
const rubricPath = resolve(
  process.cwd(),
  'benchmarks/ai-correction/executable-rubric/writing-recommendation-fr.v1.json',
);
const specPath = resolve(
  process.cwd(),
  'docs/V4_EXECUTABLE_RUBRIC_ENGINE_SPEC.md',
);

function loadInputs() {
  const campaignText = readFileSync(campaignPath, 'utf8');
  const rubricFileText = readFileSync(rubricPath, 'utf8');
  const specText = readFileSync(specPath, 'utf8');
  return {
    campaign: JSON.parse(campaignText) as unknown,
    rubric: JSON.parse(rubricFileText) as unknown,
    rubricFileText,
    specText,
  };
}

describe('Gemini evidence researcher campaign', () => {
  it('is bound to the executable rubric while remaining non-executable', () => {
    const campaign = validateEvidenceExtractionCampaign(loadInputs());

    expect(campaign.purpose).toBe('EVIDENCE_EXTRACTION_ONLY');
    expect(campaign.researcher.modelId).toBeNull();
    expect(campaign.falsifier.included).toBe(false);
    expect(campaign.feature).toEqual({
      enabled: false,
      networkCallsAllowed: false,
      scope: 'RESEARCH_ONLY',
    });
    expect(campaign.execution.historicalResultsReused).toBe(0);
  });

  it('forbids any model authority over levels, scores and feedback', () => {
    const campaign = validateEvidenceExtractionCampaign(loadInputs());

    expect(campaign.forbiddenModelAuthority).toEqual([
      'LEVEL_KEY',
      'SCORE',
      'PASS_FAIL',
      'PROGRESSION_EFFECT',
      'FREEFORM_FEEDBACK',
      'FINAL_WEAKNESS',
    ]);
  });

  it('fails closed when the executable rubric changes', () => {
    const input = loadInputs();
    input.rubricFileText = `${input.rubricFileText}\n`;

    expect(() => validateEvidenceExtractionCampaign(input)).toThrow(
      'EVIDENCE_CAMPAIGN_AUTHORITY_DIGEST_MISMATCH',
    );
  });
});
