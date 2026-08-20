import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  CorrectionModelOutputError,
  type CorrectionProviderRequest,
  getCorrectionProviderAdapter,
} from '../src/lib/ai-correction-provider-adapters.ts';
import {
  createEvidenceAssistExecutionIdentity,
  EVIDENCE_ASSIST_EVALUATOR_PATH,
  EVIDENCE_ASSIST_FOUR_CASE_MANIFEST_PATH,
  EVIDENCE_ASSIST_FREEZE_SET_MANIFEST_PATH,
  EVIDENCE_ASSIST_GOLD_MAPPING_PATH,
  EVIDENCE_ASSIST_PANEL_MANIFEST_PATH,
  EVIDENCE_ASSIST_RUNNER_PATH,
  EVIDENCE_ASSIST_STOP_POLICY_PATH,
  type EvidenceAssistDevelopmentCampaignManifest,
  sha256,
  validateEvidenceAssistDevelopmentCampaign,
} from '../src/lib/evidence-assist-development-campaign.ts';
import {
  evaluateEvidenceAssistDevelopmentCampaign,
  validateEvidenceAssistEvaluatorAuthorities,
} from '../src/lib/evidence-assist-development-evaluator.ts';
import { compileExecutableRubric } from '../src/lib/executable-rubric-engine.ts';
import { validateExecutableRubricSemanticSelection } from '../src/lib/executable-rubric-semantic-selection.ts';
import {
  loadSonnet5ReasoningCapabilities,
  SONNET_5_OPENROUTER_CATALOG_PATH,
  SONNET_5_REASONING_ATTESTATION_PATH,
} from '../src/lib/sonnet-5-reasoning-capability-attestation.ts';
import {
  evidenceAssistEphemeralAuthorizationSchema,
  runEvidenceAssistDevelopmentCampaign,
  verifyEvidenceAssistEphemeralAuthorization,
} from '../src/server/ai/evidence-assist-development-runner.ts';

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

const option = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
};
const read = (path: string): Promise<string> => readFile(resolve(path), 'utf8');
const digest = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, path);
}

async function writeJsonExclusive(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
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
validateEvidenceAssistEvaluatorAuthorities({ goldMappingText, stopPolicyText });
const requestedStage = option('stage') ?? 'four-case';
if (requestedStage !== 'four-case' && requestedStage !== 'panel') {
  throw new Error('EVIDENCE_ASSIST_STAGE_INVALID');
}
const campaign: EvidenceAssistDevelopmentCampaignManifest =
  requestedStage === 'four-case' ? validated.fourCase : validated.panel;
const manifestText =
  requestedStage === 'four-case' ? fourCaseManifestText : panelManifestText;
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

if (!process.argv.includes('--execute')) {
  console.log(
    JSON.stringify(
      {
        authorization: {
          ephemeral: true,
          financeArbitration: 'NOT_GRANTED',
          maximumLifetimeMinutes: 15,
          ownerAuthorization: 'NOT_GRANTED',
          signedArtifactRequired: true,
          singleUse: true,
        },
        budgetProposal: campaign.budgetProposal,
        campaignId: campaign.campaignId,
        executionIdentity,
        mode: 'VALIDATE_ONLY',
        modelCallsPerformed: 0,
        networkCallsAllowed: false,
        stage: campaign.stage,
        status: 'HARD_OFF',
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const authorizationPath = option('authorization');
if (!authorizationPath) {
  throw new Error('EVIDENCE_ASSIST_EPHEMERAL_AUTHORIZATION_FILE_REQUIRED');
}
const signingSecret =
  process.env.LEARNX_EVIDENCE_ASSIST_AUTHORIZATION_SECRET?.trim();
const nonce = process.env.LEARNX_EVIDENCE_ASSIST_AUTHORIZATION_NONCE?.trim();
const apiKey = process.env.OPENROUTER_API_KEY?.trim();
if (!signingSecret || !nonce) {
  throw new Error('EVIDENCE_ASSIST_EPHEMERAL_AUTHORIZATION_SECRETS_REQUIRED');
}
if (!apiKey) throw new Error('OPENROUTER_API_KEY_REQUIRED');
const authorization = verifyEvidenceAssistEphemeralAuthorization({
  authorization: evidenceAssistEphemeralAuthorizationSchema.parse(
    JSON.parse(await read(authorizationPath)) as unknown,
  ),
  campaign,
  executionIdentityFingerprint: executionIdentity.executionIdentityFingerprint,
  nonce,
  now: new Date().toISOString(),
  signingSecret,
});

if (campaign.stage === 'CONDITIONAL_PANEL_10X2') {
  const proofPath = option('four-case-proof');
  if (!proofPath) throw new Error('EVIDENCE_ASSIST_FOUR_CASE_PROOF_REQUIRED');
  const proof = JSON.parse(await read(proofPath)) as Record<string, unknown>;
  if (
    proof.stage !== 'FOUR_CASE_GATE' ||
    proof.gatePassed !== true ||
    proof.executionIdentityFingerprint !==
      executionIdentity.executionIdentityFingerprint ||
    proof.campaignIdentityFingerprint !== campaign.identity.fingerprint
  ) {
    throw new Error('EVIDENCE_ASSIST_FOUR_CASE_PROOF_INVALID');
  }
}

const compiled = compileExecutableRubric(
  JSON.parse(rubricFileText) as unknown,
);
const corpus = validateExecutableRubricSemanticSelection({
  compiled,
  selection: JSON.parse(semanticSelectionText) as unknown,
  sources: [
    { path: paths.semanticSourceV1, text: semanticSourceV1Text },
    { path: paths.semanticSourceV2, text: semanticSourceV2Text },
  ],
});
const capabilities = loadSonnet5ReasoningCapabilities({
  adapter: 'OPENROUTER_CHAT',
  attestationText: capabilityAttestationText,
  catalogAttestationText,
});
const profile: CorrectionProviderRequest['profile'] = {
  adapter: 'OPENROUTER_CHAT',
  reasoning: {
    budgetMode: 'OFF',
    budgetTokens: null,
    effort: 'OFF',
  },
  routeProviders: ['Anthropic'],
  temperature: null,
  timeoutMs: campaign.identity.timeoutMs,
  totalOutputTokenLimit: campaign.identity.maxOutputTokens,
  version: '3.0.0',
  visibleOutputTokenTarget: 2_048,
};
const adapter = getCorrectionProviderAdapter('OPENROUTER_CHAT');
const runId =
  option('run-id') ?? new Date().toISOString().replaceAll(/[:.]/gu, '-');
const outputDirectory = resolve(
  option('output-dir') ??
    `benchmarks/ai-correction/results/evidence-assist/${campaign.stage.toLocaleLowerCase()}/${runId}`,
);

const run = await runEvidenceAssistDevelopmentCampaign({
  authorization,
  campaign,
  compiled,
  corpus,
  executionIdentityFingerprint: executionIdentity.executionIdentityFingerprint,
  onAuthorizationConsumed: async (consumption) => {
    await writeJsonExclusive(
      resolve(
        'benchmarks/ai-correction/results/evidence-assist/authorization-consumptions',
        `${authorization.authorizationId}.json`,
      ),
      {
        ...consumption,
        authorizationArtifactSha256: sha256(
          `${JSON.stringify(authorization)}\n`,
        ),
        consumedAt: new Date().toISOString(),
        singleUse: true,
      },
    );
  },
  onProgress: async (progress) => {
    await writeJsonAtomic(resolve(outputDirectory, 'state.json'), progress);
  },
  onRawReceived: async (receipt) => {
    await writeJsonExclusive(
      resolve(
        outputDirectory,
        'raw-received',
        `${receipt.idempotencyKey}.json`,
      ),
      receipt,
    );
  },
  provider: {
    async execute({ idempotencyKey, jsonSchema, messages }) {
      try {
        return await adapter.execute({
          apiKey,
          idempotencyKey,
          jsonSchema,
          messages: [...messages],
          modelId: campaign.identity.wireModelId,
          profile,
          reasoning: {
            capabilities: capabilities.capabilities,
            mode: { mode: 'DISABLED' },
          },
        });
      } catch (error) {
        if (
          error instanceof CorrectionModelOutputError &&
          error.rawModelOutput !== undefined &&
          error.usage !== undefined
        ) {
          return {
            latencyMs: error.latencyMs ?? 0,
            modelSnapshot:
              error.modelSnapshot ?? campaign.identity.catalogSnapshotId,
            observedProvider:
              error.observedProvider ??
              campaign.identity.expectedObservedProvider,
            output: null,
            providerRequestId: error.providerRequestId,
            providerRoute:
              error.providerRoute ?? campaign.identity.expectedObservedProvider,
            rawModelOutput: error.rawModelOutput,
            requestedRoute:
              error.requestedRoute ?? campaign.identity.requestedRoute,
            transportOutputErrorCode: error.message,
            usage: error.usage,
          };
        }
        throw error;
      }
    },
  },
});
const evaluation = evaluateEvidenceAssistDevelopmentCampaign({
  attempts: run.attempts,
  compiled,
  corpus,
  executionIdentityFingerprint: executionIdentity.executionIdentityFingerprint,
  expectedCaseIds: campaign.execution.caseIds,
  expectedObservedProvider: campaign.identity.expectedObservedProvider,
  repetitionsPerCase: campaign.execution.repetitionsPerCase,
  stage: campaign.stage,
});
const summary = {
  ...evaluation,
  authorizationId: authorization.authorizationId,
  campaignId: campaign.campaignId,
  campaignIdentityFingerprint: campaign.identity.fingerprint,
  campaignManifestSha256: sha256(manifestText),
  executionIdentity,
  executionIdentityFingerprint: executionIdentity.executionIdentityFingerprint,
  forceNoGo: run.forceNoGo,
  modelCallsPerformed: run.attempts.length,
  stage: campaign.stage,
  stoppedReason: run.stoppedReason,
};
await Promise.all([
  writeJsonAtomic(resolve(outputDirectory, 'summary.json'), summary),
  writeJsonAtomic(resolve(outputDirectory, 'artifact-hashes.json'), {
    campaignManifestSha256: sha256(manifestText),
    evaluatorSha256: digest(evaluatorSourceText),
    goldMappingSha256: digest(goldMappingText),
    runnerSha256: digest(runnerSourceText),
    stopPolicySha256: digest(stopPolicyText),
  }),
]);
console.log(JSON.stringify({ outputDirectory, summary }, null, 2));
