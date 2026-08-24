import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { validateEvidenceResearcherPanelCampaign } from './evidence-researcher-panel-campaign.ts';

const root = process.cwd();
const paths = {
  attestation: resolve(
    root,
    'benchmarks/ai-correction/executable-rubric/gemini-google-vertex-attestation-2026-08-14-reasoning.json',
  ),
  campaign: resolve(
    root,
    'benchmarks/ai-correction/executable-rubric/gemini-evidence-researcher-panel.v1.3-v2.json',
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

describe('Gemini evidence researcher 10x2 panel campaign', () => {
  it('freezes a non-executable panel with explicit route observations', () => {
    const campaign = validateEvidenceResearcherPanelCampaign(fixture());

    expect(campaign.execution).toMatchObject({
      expectedLogicalWorkflows: 20,
      historicalResultsReused: 0,
      holdoutAccess: 'PROHIBITED',
      repetitionsPerCase: 2,
    });
    expect(campaign.researcher).toMatchObject({
      expectedObservedProvider: 'Google',
      requestedRoute: 'google-vertex/global',
      routeObservability: { version: '2.0.0' },
    });
    expect(campaign.feature).toEqual({
      enabled: false,
      networkCallsAllowed: false,
      scope: 'RESEARCH_ONLY',
    });
    expect(campaign.blockers).toEqual({
      financeArbitration: 'NOT_GRANTED',
      holdout: 'PROHIBITED',
      liveExecution: 'BLOCKED',
      ownerAuthorization: 'NOT_GRANTED',
    });
  });

  it('pins the approved atomic negative and excludes the inconclusive fixture', () => {
    const campaign = validateEvidenceResearcherPanelCampaign(fixture());

    expect(campaign.execution.caseIds).toContain(
      'writing-fr-no-choice-negative',
    );
    expect(campaign.execution.caseIds).not.toContain(
      'writing-fr-decision-mutation',
    );
  });

  it('rejects an unreviewed route or provider mutation', () => {
    const input = fixture();
    const campaign = input.campaign as {
      researcher: { expectedObservedProvider: string };
    };
    campaign.researcher.expectedObservedProvider = 'Unexpected';

    expect(() => validateEvidenceResearcherPanelCampaign(input)).toThrow();
  });

  it('rejects any semantic selection digest mutation', () => {
    const input = fixture();
    input.semanticSelectionText = `${input.semanticSelectionText}\n`;

    expect(() => validateEvidenceResearcherPanelCampaign(input)).toThrow(
      'EVIDENCE_PANEL_AUTHORITY_DIGEST_MISMATCH',
    );
  });
});
