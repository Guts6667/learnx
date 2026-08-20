import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

import {
  createEvidenceAssistExecutionIdentity,
  EVIDENCE_ASSIST_EVALUATOR_PATH,
  EVIDENCE_ASSIST_FOUR_CASE_MANIFEST_PATH,
  EVIDENCE_ASSIST_FREEZE_SET_MANIFEST_PATH,
  EVIDENCE_ASSIST_GOLD_MAPPING_PATH,
  EVIDENCE_ASSIST_PANEL_MANIFEST_PATH,
  EVIDENCE_ASSIST_RUNNER_PATH,
  EVIDENCE_ASSIST_STOP_POLICY_PATH,
  validateEvidenceAssistDevelopmentCampaign,
} from '../src/lib/evidence-assist-development-campaign.ts';
import {
  SONNET_5_OPENROUTER_CATALOG_PATH,
  SONNET_5_REASONING_ATTESTATION_PATH,
} from '../src/lib/sonnet-5-reasoning-capability-attestation.ts';
import { createEvidenceAssistEphemeralAuthorization } from '../src/server/ai/evidence-assist-development-runner.ts';

const OWNER_GRANT = 'AUTHORIZE_V4_EVIDENCE_ASSIST_GATE4_MAX_0_251136_USD';
const EXPECTED_CAMPAIGN_ID =
  'learnx-writing-fr-sonnet-5-evidence-assist-four-case-v1';
const EXPECTED_MAXIMUM_COST_USD = 0.251136;
const EXPECTED_PROVIDER_ATTEMPTS = 4;
const AUTHORIZATION_LIFETIME_MS = 10 * 60 * 1_000;

const paths = {
  capabilityAttestation: SONNET_5_REASONING_ATTESTATION_PATH,
  catalogAttestation: SONNET_5_OPENROUTER_CATALOG_PATH,
  evaluator: EVIDENCE_ASSIST_EVALUATOR_PATH,
  fourCaseManifest: EVIDENCE_ASSIST_FOUR_CASE_MANIFEST_PATH,
  freezeSetManifest: EVIDENCE_ASSIST_FREEZE_SET_MANIFEST_PATH,
  goldMapping: EVIDENCE_ASSIST_GOLD_MAPPING_PATH,
  panelManifest: EVIDENCE_ASSIST_PANEL_MANIFEST_PATH,
  protocolSpec: 'docs/V4_EVIDENCE_ASSIST_PROTOCOL_SPEC.md',
  rubric:
    'benchmarks/ai-correction/executable-rubric/writing-recommendation-fr.v1.json',
  runner: EVIDENCE_ASSIST_RUNNER_PATH,
  semanticSelection:
    'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v2.manifest.json',
  semanticSourceV1:
    'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v1.json',
  semanticSourceV2:
    'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-three-case-development.v2.json',
  stopPolicy: EVIDENCE_ASSIST_STOP_POLICY_PATH,
} as const;

function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}

async function read(path: string): Promise<string> {
  return readFile(resolve(path), 'utf8');
}

const ownerGrant = option('owner-grant');
if (ownerGrant !== OWNER_GRANT) {
  throw new Error('EVIDENCE_ASSIST_GATE4_OWNER_GRANT_INVALID');
}
const outputArgument = option('output');
if (!outputArgument) {
  throw new Error('EVIDENCE_ASSIST_GATE4_AUTHORIZATION_OUTPUT_REQUIRED');
}
const outputPath = resolve(outputArgument);
const repositoryRoot = process.cwd();
const outputRelativePath = relative(repositoryRoot, outputPath);
if (
  outputRelativePath === '' ||
  (!outputRelativePath.startsWith('..') && !outputRelativePath.startsWith('/'))
) {
  throw new Error('EVIDENCE_ASSIST_GATE4_AUTHORIZATION_MUST_STAY_OUTSIDE_REPOSITORY');
}
const signingSecret =
  process.env.LEARNX_EVIDENCE_ASSIST_AUTHORIZATION_SECRET?.trim();
const nonce = process.env.LEARNX_EVIDENCE_ASSIST_AUTHORIZATION_NONCE?.trim();
if (!signingSecret || !nonce) {
  throw new Error('EVIDENCE_ASSIST_GATE4_AUTHORIZATION_SECRETS_REQUIRED');
}

const [
  capabilityAttestationText,
  catalogAttestationText,
  evaluatorSourceText,
  fourCaseManifestText,
  freezeSetManifestText,
  goldMappingText,
  panelManifestText,
  protocolSpecText,
  rubricFileText,
  runnerSourceText,
  semanticSelectionText,
  semanticSourceV1Text,
  semanticSourceV2Text,
  stopPolicyText,
] = await Promise.all([
  read(paths.capabilityAttestation),
  read(paths.catalogAttestation),
  read(paths.evaluator),
  read(paths.fourCaseManifest),
  read(paths.freezeSetManifest),
  read(paths.goldMapping),
  read(paths.panelManifest),
  read(paths.protocolSpec),
  read(paths.rubric),
  read(paths.runner),
  read(paths.semanticSelection),
  read(paths.semanticSourceV1),
  read(paths.semanticSourceV2),
  read(paths.stopPolicy),
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
const campaign = validated.fourCase;
if (
  campaign.campaignId !== EXPECTED_CAMPAIGN_ID ||
  campaign.stage !== 'FOUR_CASE_GATE' ||
  campaign.budgetProposal.maximumCampaignCostUsd !==
    EXPECTED_MAXIMUM_COST_USD ||
  campaign.execution.maximumProviderAttempts !== EXPECTED_PROVIDER_ATTEMPTS ||
  campaign.execution.caseIds.length !== EXPECTED_PROVIDER_ATTEMPTS ||
  campaign.execution.repetitionsPerCase !== 1 ||
  campaign.execution.maximumRetriesPerWorkflow !== 0 ||
  campaign.identity.fallbackAllowed
) {
  throw new Error('EVIDENCE_ASSIST_GATE4_FROZEN_SCOPE_MISMATCH');
}
const executionIdentity = createEvidenceAssistExecutionIdentity({
  campaignIdentityFingerprint: campaign.identity.fingerprint,
  evaluatorSourceText,
  goldMappingText,
  runnerSourceText,
  semanticSelectionText,
  semanticSourceV1Text,
  semanticSourceV2Text,
  stopPolicyText,
});
const grantedAt = new Date();
const expiresAt = new Date(grantedAt.getTime() + AUTHORIZATION_LIFETIME_MS);
const authorization = createEvidenceAssistEphemeralAuthorization({
  authorization: {
    authorizationId: `gate4-${randomUUID()}`,
    campaignId: campaign.campaignId,
    executionIdentityFingerprint:
      executionIdentity.executionIdentityFingerprint,
    expiresAt: expiresAt.toISOString(),
    financeArbitration: 'GRANTED',
    grantedAt: grantedAt.toISOString(),
    maximumCampaignCostUsd: EXPECTED_MAXIMUM_COST_USD,
    maximumProviderAttempts: EXPECTED_PROVIDER_ATTEMPTS,
    nonceSha256: createHash('sha256').update(nonce).digest('hex'),
    ownerAuthorization: 'GRANTED',
    purpose: 'EVIDENCE_ASSIST_DEVELOPMENT_ONLY',
    schemaVersion: 1,
    singleUse: true,
    stage: 'FOUR_CASE_GATE',
  },
  signingSecret,
});

await mkdir(dirname(outputPath), { recursive: true, mode: 0o700 });
await writeFile(outputPath, `${JSON.stringify(authorization, null, 2)}\n`, {
  encoding: 'utf8',
  flag: 'wx',
  mode: 0o600,
});
process.stdout.write(
  `${JSON.stringify({
    authorizationId: authorization.authorizationId,
    campaignId: authorization.campaignId,
    executionIdentityFingerprint:
      authorization.executionIdentityFingerprint,
    expiresAt: authorization.expiresAt,
    financeArbitration: authorization.financeArbitration,
    maximumCampaignCostUsd: authorization.maximumCampaignCostUsd,
    maximumProviderAttempts: authorization.maximumProviderAttempts,
    ownerAuthorization: authorization.ownerAuthorization,
    outputPath,
    singleUse: authorization.singleUse,
  })}\n`,
);
