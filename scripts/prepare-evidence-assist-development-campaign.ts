import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  EVIDENCE_ASSIST_FOUR_CASE_MANIFEST_PATH,
  EVIDENCE_ASSIST_FREEZE_SET_MANIFEST_PATH,
  EVIDENCE_ASSIST_PANEL_MANIFEST_PATH,
  evidenceAssistDevelopmentFreezeSetManifestSchema,
  regenerateEvidenceAssistDevelopmentManifests,
  sha256,
  validateEvidenceAssistDevelopmentCampaign,
} from '../src/lib/evidence-assist-development-campaign.ts';
import {
  SONNET_5_OPENROUTER_CATALOG_PATH,
  SONNET_5_REASONING_ATTESTATION_PATH,
} from '../src/lib/sonnet-5-reasoning-capability-attestation.ts';

type JsonValue = boolean | JsonObject | JsonValue[] | null | number | string;
type JsonObject = { [key: string]: JsonValue };

const paths = {
  capabilityAttestation: SONNET_5_REASONING_ATTESTATION_PATH,
  catalogAttestation: SONNET_5_OPENROUTER_CATALOG_PATH,
  fourCaseManifest: EVIDENCE_ASSIST_FOUR_CASE_MANIFEST_PATH,
  freezeSetManifest: EVIDENCE_ASSIST_FREEZE_SET_MANIFEST_PATH,
  panelManifest: EVIDENCE_ASSIST_PANEL_MANIFEST_PATH,
  phaseManifest: 'docs/V4_AI_CORRECTION_PHASE_MANIFEST_V3.json',
  promotionPolicy:
    'benchmarks/ai-correction/executable-rubric/evidence-assist-promotion-policy.v1.json',
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

const text = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const read = (path: string): Promise<string> => readFile(resolve(path), 'utf8');

function object(value: JsonValue | undefined, code: string): JsonObject {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new Error(code);
  }
  return value;
}

function array(value: JsonValue | undefined, code: string): JsonValue[] {
  if (!Array.isArray(value)) throw new Error(code);
  return value;
}

function updatePhaseManifestHashes(input: {
  fourCaseSha256: string;
  freezeSetSha256: string;
  panelSha256: string;
  phaseManifestText: string;
  promotionPolicySha256: string;
}): JsonObject {
  const phase = object(
    JSON.parse(input.phaseManifestText) as JsonValue,
    'EVIDENCE_ASSIST_PHASE_MANIFEST_INVALID',
  );
  const blockers = array(
    phase.openBlockers,
    'EVIDENCE_ASSIST_PHASE_BLOCKERS_MISSING',
  );
  const promotionBlocker = blockers
    .map((entry) => object(entry, 'EVIDENCE_ASSIST_PHASE_BLOCKER_INVALID'))
    .find((entry) => entry.key === 'EXECUTABLE_RUBRIC_PROMOTION_GATE');
  if (!promotionBlocker) {
    throw new Error('EVIDENCE_ASSIST_PHASE_PROMOTION_BLOCKER_MISSING');
  }
  const nextProtocol = object(
    promotionBlocker.nextProtocol,
    'EVIDENCE_ASSIST_PHASE_NEXT_PROTOCOL_MISSING',
  );
  object(
    nextProtocol.campaignFreezeSet,
    'EVIDENCE_ASSIST_PHASE_FREEZE_SET_MISSING',
  ).manifestSha256 = input.freezeSetSha256;
  const gatePlan = object(
    nextProtocol.gatePlan,
    'EVIDENCE_ASSIST_PHASE_GATE_PLAN_MISSING',
  );
  object(
    gatePlan.stageOne,
    'EVIDENCE_ASSIST_PHASE_STAGE_ONE_MISSING',
  ).manifestSha256 = input.fourCaseSha256;
  object(
    gatePlan.stageTwo,
    'EVIDENCE_ASSIST_PHASE_STAGE_TWO_MISSING',
  ).manifestSha256 = input.panelSha256;
  const promotionGate = object(
    phase.promotionGate,
    'EVIDENCE_ASSIST_PHASE_PROMOTION_GATE_MISSING',
  );
  object(
    promotionGate.policy,
    'EVIDENCE_ASSIST_PHASE_PROMOTION_POLICY_MISSING',
  ).sha256 = input.promotionPolicySha256;
  return phase;
}

async function writeAtomic(path: string, value: string): Promise<void> {
  const absolute = resolve(path);
  const temporary = `${absolute}.tmp`;
  await writeFile(temporary, value, 'utf8');
  await rename(temporary, absolute);
}

if (process.argv.includes('--execute')) {
  throw new Error('EVIDENCE_ASSIST_NETWORK_EXECUTION_NOT_AUTHORIZED');
}

const [
  capabilityAttestationText,
  catalogAttestationText,
  currentFourCaseManifestText,
  currentFreezeSetManifestText,
  currentPanelManifestText,
  phaseManifestText,
  promotionPolicyText,
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
  read(paths.phaseManifest),
  read(paths.promotionPolicy),
  read(paths.protocolSpec),
  read(paths.rubric),
  read(paths.semanticSelection),
  read(paths.semanticSourceV1),
  read(paths.semanticSourceV2),
]);

const common = {
  capabilityAttestationText,
  catalogAttestationText,
  fourCaseManifestText: currentFourCaseManifestText,
  panelManifestText: currentPanelManifestText,
  protocolSpecText,
  rubricFileText,
  semanticSelectionText,
  semanticSourceV1Text,
  semanticSourceV2Text,
};
const regenerated = regenerateEvidenceAssistDevelopmentManifests(common);
const fourCaseManifestText = text(regenerated.fourCase);
const panelManifestText = text(regenerated.panel);
const freezeSet = evidenceAssistDevelopmentFreezeSetManifestSchema.parse({
  ...JSON.parse(currentFreezeSetManifestText),
  campaignIdentityFingerprint: regenerated.fourCase.identity.fingerprint,
  stages: [
    {
      campaignId: regenerated.fourCase.campaignId,
      manifestPath: EVIDENCE_ASSIST_FOUR_CASE_MANIFEST_PATH,
      manifestSha256: sha256(fourCaseManifestText),
      stage: regenerated.fourCase.stage,
    },
    {
      campaignId: regenerated.panel.campaignId,
      manifestPath: EVIDENCE_ASSIST_PANEL_MANIFEST_PATH,
      manifestSha256: sha256(panelManifestText),
      stage: regenerated.panel.stage,
    },
  ],
});
const freezeSetManifestText = text(freezeSet);

validateEvidenceAssistDevelopmentCampaign({
  ...common,
  fourCaseManifestText,
  freezeSetManifestText,
  panelManifestText,
});

const phaseManifest = updatePhaseManifestHashes({
  fourCaseSha256: sha256(fourCaseManifestText),
  freezeSetSha256: sha256(freezeSetManifestText),
  panelSha256: sha256(panelManifestText),
  phaseManifestText,
  promotionPolicySha256: sha256(promotionPolicyText),
});

await Promise.all([
  writeAtomic(paths.fourCaseManifest, fourCaseManifestText),
  writeAtomic(paths.panelManifest, panelManifestText),
  writeAtomic(paths.freezeSetManifest, freezeSetManifestText),
  writeAtomic(paths.phaseManifest, text(phaseManifest)),
]);

console.log(
  JSON.stringify(
    {
      artifacts: {
        fourCase: {
          path: paths.fourCaseManifest,
          sha256: sha256(fourCaseManifestText),
        },
        freezeSet: {
          path: paths.freezeSetManifest,
          sha256: sha256(freezeSetManifestText),
        },
        panel: {
          path: paths.panelManifest,
          sha256: sha256(panelManifestText),
        },
        phaseManifest: { path: paths.phaseManifest },
      },
      mode: 'OFFLINE_REGENERATE_AND_VALIDATE',
      modelCallsPerformed: 0,
      networkCallsAllowed: false,
      status: 'OFFLINE_READY_NO_MODEL_CALL',
    },
    null,
    2,
  ),
);
