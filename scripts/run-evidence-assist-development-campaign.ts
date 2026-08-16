import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  EVIDENCE_ASSIST_FOUR_CASE_MANIFEST_PATH,
  EVIDENCE_ASSIST_FREEZE_SET_MANIFEST_PATH,
  EVIDENCE_ASSIST_PANEL_MANIFEST_PATH,
  sha256,
  validateEvidenceAssistDevelopmentCampaign,
} from '../src/lib/evidence-assist-development-campaign.ts';
import {
  SONNET_5_OPENROUTER_CATALOG_PATH,
  SONNET_5_REASONING_ATTESTATION_PATH,
} from '../src/lib/sonnet-5-reasoning-capability-attestation.ts';

const paths = {
  capabilityAttestation: SONNET_5_REASONING_ATTESTATION_PATH,
  catalogAttestation: SONNET_5_OPENROUTER_CATALOG_PATH,
  fourCaseManifest: EVIDENCE_ASSIST_FOUR_CASE_MANIFEST_PATH,
  freezeSetManifest: EVIDENCE_ASSIST_FREEZE_SET_MANIFEST_PATH,
  panelManifest: EVIDENCE_ASSIST_PANEL_MANIFEST_PATH,
  protocolSpec: 'docs/V4_EVIDENCE_ASSIST_PROTOCOL_SPEC.md',
  rubric:
    'benchmarks/ai-correction/executable-rubric/writing-recommendation-fr.v1.json',
  semanticSelection:
    'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v2.manifest.json',
  semanticSourceV1:
    'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v1.json',
  semanticSourceV2:
    'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-three-case-development.v2.json',
} as const;

async function read(path: string): Promise<string> {
  return readFile(resolve(path), 'utf8');
}

if (process.argv.includes('--execute')) {
  throw new Error('EVIDENCE_ASSIST_NETWORK_EXECUTION_NOT_AUTHORIZED');
}

const [
  capabilityAttestationText,
  catalogAttestationText,
  fourCaseManifestText,
  freezeSetManifestText,
  panelManifestText,
  protocolSpecText,
  rubricFileText,
  semanticSelectionText,
  semanticSourceV1Text,
  semanticSourceV2Text,
] = await Promise.all([
  read(paths.capabilityAttestation),
  read(paths.catalogAttestation),
  read(paths.fourCaseManifest),
  read(paths.freezeSetManifest),
  read(paths.panelManifest),
  read(paths.protocolSpec),
  read(paths.rubric),
  read(paths.semanticSelection),
  read(paths.semanticSourceV1),
  read(paths.semanticSourceV2),
]);

const validated = validateEvidenceAssistDevelopmentCampaign({
  capabilityAttestationText,
  catalogAttestationText,
  fourCaseManifestText,
  freezeSetManifestText,
  panelManifestText,
  protocolSpecText,
  rubricFileText,
  semanticSelectionText,
  semanticSourceV1Text,
  semanticSourceV2Text,
});

console.log(
  JSON.stringify(
    {
      budgets: {
        fourCase: validated.fourCase.budgetProposal,
        panelConditional: validated.panel.budgetProposal,
      },
      campaignIdentity: {
        fingerprint: validated.fourCase.identity.fingerprint,
        identityId: validated.fourCase.identity.identityId,
      },
      financeArbitration: 'NOT_GRANTED',
      freezeSet: {
        manifestSha256: sha256(freezeSetManifestText),
        ...validated.freezeSet,
      },
      mode: 'VALIDATE_ONLY',
      modelCallsPerformed: 0,
      networkCallsAllowed: false,
      ownerAuthorization: 'NOT_GRANTED',
      stages: [
        {
          campaignId: validated.fourCase.campaignId,
          manifestSha256: sha256(fourCaseManifestText),
          requestCount: validated.preparation.fourCaseRequestCount,
          status: validated.fourCase.status,
        },
        {
          campaignId: validated.panel.campaignId,
          executionCondition: validated.panel.execution.executionCondition,
          manifestSha256: sha256(panelManifestText),
          requestCount: validated.preparation.panelRequestCount,
          status: validated.panel.status,
        },
      ],
      status: 'OFFLINE_READY_NO_MODEL_CALL',
    },
    null,
    2,
  ),
);
