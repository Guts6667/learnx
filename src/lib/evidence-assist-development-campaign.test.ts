import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  EVIDENCE_ASSIST_FOUR_CASE_MANIFEST_PATH,
  EVIDENCE_ASSIST_FREEZE_SET_MANIFEST_PATH,
  EVIDENCE_ASSIST_PANEL_MANIFEST_PATH,
  evidenceAssistOfflineReadinessSchema,
  regenerateEvidenceAssistDevelopmentManifests,
  sha256,
  validateEvidenceAssistDevelopmentCampaign,
} from './evidence-assist-development-campaign.ts';
import {
  SONNET_5_OPENROUTER_CATALOG_PATH,
  SONNET_5_REASONING_ATTESTATION_PATH,
} from './sonnet-5-reasoning-capability-attestation.ts';

const read = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const inputs = () => ({
  capabilityAttestationText: read(SONNET_5_REASONING_ATTESTATION_PATH),
  catalogAttestationText: read(SONNET_5_OPENROUTER_CATALOG_PATH),
  fourCaseManifestText: read(EVIDENCE_ASSIST_FOUR_CASE_MANIFEST_PATH),
  freezeSetManifestText: read(EVIDENCE_ASSIST_FREEZE_SET_MANIFEST_PATH),
  panelManifestText: read(EVIDENCE_ASSIST_PANEL_MANIFEST_PATH),
  protocolSpecText: read('docs/V4_EVIDENCE_ASSIST_PROTOCOL_SPEC.md'),
  rubricFileText: read(
    'benchmarks/ai-correction/executable-rubric/writing-recommendation-fr.v1.json',
  ),
  semanticSelectionText: read(
    'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v2.manifest.json',
  ),
  semanticSourceV1Text: read(
    'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v1.json',
  ),
  semanticSourceV2Text: read(
    'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-three-case-development.v2.json',
  ),
});

describe('evidence-assist development campaign', () => {
  it('validates the frozen four-case and conditional 10x2 pair offline', () => {
    const input = inputs();
    const campaign = validateEvidenceAssistDevelopmentCampaign(input);

    expect(campaign.preparation).toEqual({
      fourCaseRequestCount: 4,
      panelRequestCount: 20,
    });
    expect(campaign.fourCase.execution.networkCallsAllowed).toBe(false);
    expect(campaign.panel.execution.networkCallsAllowed).toBe(false);
    expect(campaign.fourCase.identity).toEqual(campaign.panel.identity);
    expect(
      campaign.freezeSet.stages.map(({ manifestSha256 }) => manifestSha256),
    ).toEqual([
      sha256(input.fourCaseManifestText),
      sha256(input.panelManifestText),
    ]);
    expect(campaign.fourCase.budgetProposal.status).toBe(
      'PROPOSED_NOT_APPROVED',
    );
    expect(
      campaign.panel.budgetProposal.maximumCampaignCostUsd,
    ).toBeGreaterThan(campaign.fourCase.budgetProposal.maximumCampaignCostUsd);
  });

  it('regenerates both stage manifests deterministically from local authorities', () => {
    const input = inputs();
    const regenerated = regenerateEvidenceAssistDevelopmentManifests(input);

    expect(`${JSON.stringify(regenerated.fourCase, null, 2)}\n`).toBe(
      input.fourCaseManifestText,
    );
    expect(`${JSON.stringify(regenerated.panel, null, 2)}\n`).toBe(
      input.panelManifestText,
    );
  });

  it('fails closed if network execution is enabled in either stage', () => {
    const input = inputs();
    input.panelManifestText = input.panelManifestText.replace(
      '"networkCallsAllowed": false',
      '"networkCallsAllowed": true',
    );

    expect(() => validateEvidenceAssistDevelopmentCampaign(input)).toThrow();
  });

  it('rejects a manifest changed after the pair was frozen', () => {
    const input = inputs();
    input.panelManifestText = input.panelManifestText.replace(
      '"timeoutMs": 60000',
      '"timeoutMs": 60001',
    );

    expect(() => validateEvidenceAssistDevelopmentCampaign(input)).toThrow();
  });

  it('rejects an uncalculated or silently approved budget', () => {
    const input = inputs();
    input.fourCaseManifestText = input.fourCaseManifestText.replace(
      '"maximumCampaignCostUsd": 0.251136',
      '"maximumCampaignCostUsd": 0.20',
    );

    expect(() => validateEvidenceAssistDevelopmentCampaign(input)).toThrow(
      'EVIDENCE_ASSIST_CAMPAIGN_BUDGET_MISMATCH',
    );
  });

  it('keeps the readiness record explicit about zero calls and missing approvals', () => {
    expect(
      evidenceAssistOfflineReadinessSchema.parse({
        financeArbitration: 'NOT_GRANTED',
        modelCallsPerformed: 0,
        networkCallsAllowed: false,
        ownerAuthorization: 'NOT_GRANTED',
        proposedMaximumBudgetUsd: 0.251136,
        status: 'OFFLINE_READY_NO_MODEL_CALL',
      }),
    ).toBeTruthy();
  });
});
