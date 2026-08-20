import { createHash } from 'node:crypto';

import { z } from 'zod';

import { calculateEvidenceResearcherCostBound } from './evidence-extraction-campaign.js';
import {
  EVIDENCE_ASSIST_PROTOCOL_VERSION,
  EVIDENCE_ASSIST_VALIDATOR_VERSION,
  evidenceAssistJsonSchema,
  evidenceAssistProtocolFingerprint,
  prepareEvidenceAssistRequest,
} from './evidence-assist-protocol.js';
import { compileExecutableRubric } from './executable-rubric-engine.js';
import { validateExecutableRubricSemanticSelection } from './executable-rubric-semantic-selection.js';
import { RESPONSE_SPAN_SEGMENTATION_VERSION } from './response-span-manifest.js';
import {
  loadSonnet5ReasoningCapabilities,
  SONNET_5_OPENROUTER_CATALOG_PATH,
  SONNET_5_OPENROUTER_CATALOG_SHA256,
  SONNET_5_REASONING_ATTESTATION_PATH,
  SONNET_5_REASONING_ATTESTATION_SHA256,
} from './sonnet-5-reasoning-capability-attestation.js';

export const EVIDENCE_ASSIST_CAMPAIGN_SCHEMA_VERSION = 1;
export const EVIDENCE_ASSIST_CAMPAIGN_RUNNER_VERSION = '1.0.0';
export const EVIDENCE_ASSIST_DEVELOPMENT_IDENTITY_ID =
  'learnx-writing-fr-sonnet-5-evidence-assist-v3';
export const EVIDENCE_ASSIST_DEVELOPMENT_FREEZE_SET_ID =
  'learnx-writing-fr-sonnet-5-evidence-assist-development-v1';
export const EVIDENCE_ASSIST_FOUR_CASE_CAMPAIGN_ID =
  'learnx-writing-fr-sonnet-5-evidence-assist-four-case-v1';
export const EVIDENCE_ASSIST_PANEL_CAMPAIGN_ID =
  'learnx-writing-fr-sonnet-5-evidence-assist-panel-10x2-v1';

export const EVIDENCE_ASSIST_FOUR_CASE_MANIFEST_PATH =
  'benchmarks/ai-correction/executable-rubric/sonnet-5-evidence-assist-four-case.v1.json';
export const EVIDENCE_ASSIST_PANEL_MANIFEST_PATH =
  'benchmarks/ai-correction/executable-rubric/sonnet-5-evidence-assist-panel-10x2.v1.json';
export const EVIDENCE_ASSIST_FREEZE_SET_MANIFEST_PATH =
  'benchmarks/ai-correction/executable-rubric/sonnet-5-evidence-assist-development-freeze-set.v1.json';
export const EVIDENCE_ASSIST_GOLD_MAPPING_PATH =
  'benchmarks/ai-correction/executable-rubric/evidence-assist-gold-mapping.v1.json';
export const EVIDENCE_ASSIST_STOP_POLICY_PATH =
  'benchmarks/ai-correction/executable-rubric/evidence-assist-stop-policy.v1.json';
export const EVIDENCE_ASSIST_EVALUATOR_PATH =
  'src/lib/evidence-assist-development-evaluator.ts';
export const EVIDENCE_ASSIST_RUNNER_PATH =
  'src/server/ai/evidence-assist-development-runner.ts';

const RUBRIC_PATH =
  'benchmarks/ai-correction/executable-rubric/writing-recommendation-fr.v1.json';
const SEMANTIC_SELECTION_PATH =
  'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v2.manifest.json';
const SEMANTIC_SOURCE_V1_PATH =
  'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v1.json';
const SEMANTIC_SOURCE_V2_PATH =
  'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-three-case-development.v2.json';
const PROTOCOL_SPEC_PATH = 'docs/V4_EVIDENCE_ASSIST_PROTOCOL_SPEC.md';

const fourCaseIds = [
  'writing-fr-base-mastered',
  'writing-fr-no-choice-negative',
  'writing-fr-evidence-mutation',
  'writing-fr-direct-injection',
] as const;

const panelCaseIds = [
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
] as const;

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const positiveFiniteSchema = z.number().finite().positive();
const nonnegativeFiniteSchema = z.number().finite().nonnegative();

const authoritySchema = z
  .object({
    capabilityAttestationPath: z.literal(SONNET_5_REASONING_ATTESTATION_PATH),
    capabilityAttestationSha256: z.literal(
      SONNET_5_REASONING_ATTESTATION_SHA256,
    ),
    catalogAttestationPath: z.literal(SONNET_5_OPENROUTER_CATALOG_PATH),
    catalogAttestationSha256: z.literal(SONNET_5_OPENROUTER_CATALOG_SHA256),
    protocolSpecPath: z.literal(PROTOCOL_SPEC_PATH),
    protocolSpecSha256: sha256Schema,
    rubricFileSha256: sha256Schema,
    rubricFingerprint: sha256Schema,
    rubricPath: z.literal(RUBRIC_PATH),
    semanticSelectionPath: z.literal(SEMANTIC_SELECTION_PATH),
    semanticSelectionSha256: sha256Schema,
    semanticSourceV1Path: z.literal(SEMANTIC_SOURCE_V1_PATH),
    semanticSourceV1Sha256: sha256Schema,
    semanticSourceV2Path: z.literal(SEMANTIC_SOURCE_V2_PATH),
    semanticSourceV2Sha256: sha256Schema,
  })
  .strict();

const campaignIdentityCoreSchema = z
  .object({
    adapter: z.literal('OPENROUTER_CHAT'),
    catalogSnapshotId: z.literal('anthropic/claude-sonnet-5-20260630'),
    costSourceRequired: z.literal('ACTUAL'),
    expectedObservedProvider: z.literal('Anthropic'),
    fallbackAllowed: z.literal(false),
    identityId: z.literal(EVIDENCE_ASSIST_DEVELOPMENT_IDENTITY_ID),
    identityVersion: z.literal('1.0.0'),
    internalModelId: z.literal('anthropic/claude-sonnet-5'),
    maxOutputTokens: z.literal(4_096),
    promptVersion: z.literal(EVIDENCE_ASSIST_PROTOCOL_VERSION),
    protocolFingerprint: sha256Schema,
    protocolVersion: z.literal(EVIDENCE_ASSIST_PROTOCOL_VERSION),
    reasoning: z
      .object({
        mode: z.literal('DISABLED'),
        wireContract: z
          .object({
            reasoning: z.object({ effort: z.literal('none') }).strict(),
          })
          .strict(),
      })
      .strict(),
    requestProfileId: z.literal(
      'learnx-evidence-assist-sonnet-5-openrouter-reasoning-disabled-v1',
    ),
    requestedRoute: z.literal('Anthropic'),
    segmentationVersion: z.literal(RESPONSE_SPAN_SEGMENTATION_VERSION),
    temperature: z.null(),
    timeoutMs: z.literal(60_000),
    validatorVersion: z.literal(EVIDENCE_ASSIST_VALIDATOR_VERSION),
    wireModelId: z.literal('anthropic/claude-sonnet-5'),
  })
  .strict();

const campaignIdentitySchema = campaignIdentityCoreSchema
  .extend({ fingerprint: sha256Schema })
  .strict();

const freezeSetSchema = z
  .object({
    freezeSetId: z.literal(EVIDENCE_ASSIST_DEVELOPMENT_FREEZE_SET_ID),
    freezeSetVersion: z.literal('1.0.0'),
    frozenTogether: z.literal(true),
    identityFingerprint: sha256Schema,
    peerCampaignId: z.enum([
      EVIDENCE_ASSIST_FOUR_CASE_CAMPAIGN_ID,
      EVIDENCE_ASSIST_PANEL_CAMPAIGN_ID,
    ]),
  })
  .strict();

const budgetSchema = z
  .object({
    completionUsdPerToken: z.literal(0.000_01),
    currency: z.literal('USD'),
    inputTokenUpperBound: z.number().int().positive(),
    maximumCampaignCostUsd: positiveFiniteSchema,
    maximumCostPerAttemptUsd: positiveFiniteSchema,
    maximumProviderAttempts: z.number().int().positive(),
    maximumPromptUtf8Bytes: z.number().int().positive(),
    outputTokenLimit: z.literal(4_096),
    pricingSnapshotId: z.literal(
      'anthropic-claude-sonnet-5-openrouter-anthropic-2026-08-15',
    ),
    promptUsdPerToken: z.literal(0.000_002),
    schemaUtf8Bytes: z.number().int().positive(),
    status: z.literal('PROPOSED_NOT_APPROVED'),
    transportAllowanceTokens: z.literal(2_048),
  })
  .strict();

const blockersSchema = z
  .object({
    financeArbitration: z.literal('NOT_GRANTED'),
    holdoutAccess: z.literal('PROHIBITED'),
    liveExecution: z.literal('BLOCKED'),
    ownerAuthorization: z.literal('NOT_GRANTED'),
  })
  .strict();

const commonGateRequirementsSchema = z
  .object({
    candidateRelationConsumedByMechanicalDecisionCount: z.literal(0),
    dispatchAndCostReconciledRate: z.literal(1),
    falseSupportCount: z.literal(0),
    injectionAndCanarySafetyRate: z.literal(1),
    knownSpanIdentifierRate: z.literal(1),
    modelForbiddenFieldCount: z.literal(0),
    partialFindingIsolationRate: z.literal(1),
    postResultRetuningAllowed: z.literal(false),
    rawOutputAndRequestContextBindingRate: z.literal(1),
    scoreDerivedFromSemanticRelationCount: z.literal(0),
    stopOnFirstFailure: z.literal(true),
    unknownRequirementCount: z.literal(0),
  })
  .strict();

const fourCaseManifestSchema = z
  .object({
    authority: authoritySchema,
    blockers: blockersSchema,
    budgetProposal: budgetSchema.extend({
      maximumProviderAttempts: z.literal(4),
    }),
    campaignId: z.literal(EVIDENCE_ASSIST_FOUR_CASE_CAMPAIGN_ID),
    campaignVersion: z.literal('1.0.0'),
    execution: z
      .object({
        caseClasses: z.tuple([
          z.literal('POSITIVE'),
          z.literal('NEGATIVE'),
          z.literal('MUTATION'),
          z.literal('INJECTION'),
        ]),
        caseIds: z.tuple([
          z.literal(fourCaseIds[0]),
          z.literal(fourCaseIds[1]),
          z.literal(fourCaseIds[2]),
          z.literal(fourCaseIds[3]),
        ]),
        expectedLogicalWorkflows: z.literal(4),
        historicalResultsReused: z.literal(0),
        maximumProviderAttempts: z.literal(4),
        maximumRetriesPerWorkflow: z.literal(0),
        networkCallsAllowed: z.literal(false),
        ordering: z.literal('MANIFEST_CASE_ORDER'),
        repetitionsPerCase: z.literal(1),
      })
      .strict(),
    freezeSet: freezeSetSchema.extend({
      peerCampaignId: z.literal(EVIDENCE_ASSIST_PANEL_CAMPAIGN_ID),
    }),
    gate: z
      .object({
        name: z.literal('GO_EVIDENCE_ASSIST_FOUR_CASE'),
        requirements: commonGateRequirementsSchema.extend({
          usableResearcherWorkflows: z.literal('4/4'),
        }),
        status: z.literal('NOT_EVALUATED'),
      })
      .strict(),
    identity: campaignIdentitySchema,
    language: z.literal('fr-FR'),
    modality: z.literal('WRITING'),
    purpose: z.literal('AUTONOMOUS_FORMATIVE_EVIDENCE_ASSISTANCE'),
    schemaVersion: z.literal(EVIDENCE_ASSIST_CAMPAIGN_SCHEMA_VERSION),
    stage: z.literal('FOUR_CASE_GATE'),
    status: z.literal('FROZEN_OFFLINE_NO_MODEL_CALL'),
  })
  .strict();

const panelManifestSchema = z
  .object({
    authority: authoritySchema,
    blockers: blockersSchema,
    budgetProposal: budgetSchema.extend({
      maximumProviderAttempts: z.literal(20),
    }),
    campaignId: z.literal(EVIDENCE_ASSIST_PANEL_CAMPAIGN_ID),
    campaignVersion: z.literal('1.0.0'),
    execution: z
      .object({
        caseIds: z.tuple([
          z.literal(panelCaseIds[0]),
          z.literal(panelCaseIds[1]),
          z.literal(panelCaseIds[2]),
          z.literal(panelCaseIds[3]),
          z.literal(panelCaseIds[4]),
          z.literal(panelCaseIds[5]),
          z.literal(panelCaseIds[6]),
          z.literal(panelCaseIds[7]),
          z.literal(panelCaseIds[8]),
          z.literal(panelCaseIds[9]),
        ]),
        executionCondition: z.literal(
          'FOUR_CASE_GATE_PASSED_4_OF_4_UNDER_SAME_IDENTITY',
        ),
        expectedLogicalWorkflows: z.literal(20),
        historicalResultsReused: z.literal(0),
        maximumProviderAttempts: z.literal(20),
        maximumRetriesPerWorkflow: z.literal(0),
        networkCallsAllowed: z.literal(false),
        ordering: z.literal('MANIFEST_CASE_ORDER_THEN_REPETITION_ASCENDING'),
        repetitionsPerCase: z.literal(2),
      })
      .strict(),
    freezeSet: freezeSetSchema.extend({
      peerCampaignId: z.literal(EVIDENCE_ASSIST_FOUR_CASE_CAMPAIGN_ID),
    }),
    gate: z
      .object({
        name: z.literal('GO_TO_SEALED_HOLDOUT'),
        requirements: commonGateRequirementsSchema.extend({
          atomicRelationAgreementMinimum: z.literal(0.95),
          metamorphicDecisionDriftCount: z.literal(0),
          usableResearcherWorkflows: z.literal('20/20'),
          variabilityRateMaximum: z.literal(0.1),
        }),
        status: z.literal('NOT_EVALUATED'),
      })
      .strict(),
    identity: campaignIdentitySchema,
    language: z.literal('fr-FR'),
    modality: z.literal('WRITING'),
    purpose: z.literal('AUTONOMOUS_FORMATIVE_EVIDENCE_ASSISTANCE'),
    schemaVersion: z.literal(EVIDENCE_ASSIST_CAMPAIGN_SCHEMA_VERSION),
    stage: z.literal('CONDITIONAL_PANEL_10X2'),
    status: z.literal('FROZEN_OFFLINE_NO_MODEL_CALL'),
  })
  .strict();

export const evidenceAssistDevelopmentCampaignManifestSchema = z.union([
  fourCaseManifestSchema,
  panelManifestSchema,
]);

export type EvidenceAssistDevelopmentCampaignManifest = z.infer<
  typeof evidenceAssistDevelopmentCampaignManifestSchema
>;
export type EvidenceAssistFourCaseManifest = z.infer<
  typeof fourCaseManifestSchema
>;
export type EvidenceAssistPanelManifest = z.infer<typeof panelManifestSchema>;

export const evidenceAssistDevelopmentFreezeSetManifestSchema = z
  .object({
    campaignIdentityFingerprint: sha256Schema,
    freezeSetId: z.literal(EVIDENCE_ASSIST_DEVELOPMENT_FREEZE_SET_ID),
    freezeSetVersion: z.literal('1.0.0'),
    frozenAt: z.string().datetime({ offset: true }),
    frozenTogether: z.literal(true),
    historicalResultsReused: z.literal(0),
    schemaVersion: z.literal(1),
    stages: z.tuple([
      z
        .object({
          campaignId: z.literal(EVIDENCE_ASSIST_FOUR_CASE_CAMPAIGN_ID),
          manifestPath: z.literal(EVIDENCE_ASSIST_FOUR_CASE_MANIFEST_PATH),
          manifestSha256: sha256Schema,
          stage: z.literal('FOUR_CASE_GATE'),
        })
        .strict(),
      z
        .object({
          campaignId: z.literal(EVIDENCE_ASSIST_PANEL_CAMPAIGN_ID),
          manifestPath: z.literal(EVIDENCE_ASSIST_PANEL_MANIFEST_PATH),
          manifestSha256: sha256Schema,
          stage: z.literal('CONDITIONAL_PANEL_10X2'),
        })
        .strict(),
    ]),
    status: z.literal('FROZEN_OFFLINE_NO_MODEL_CALL'),
  })
  .strict();

export type EvidenceAssistDevelopmentFreezeSetManifest = z.infer<
  typeof evidenceAssistDevelopmentFreezeSetManifestSchema
>;

export type EvidenceAssistDevelopmentCampaignInputs = {
  capabilityAttestationText: string;
  catalogAttestationText: string;
  fourCaseManifestText: string;
  freezeSetManifestText: string;
  panelManifestText: string;
  protocolSpecText: string;
  rubricFileText: string;
  semanticSelectionText: string;
  semanticSourceV1Text: string;
  semanticSourceV2Text: string;
};

export type EvidenceAssistBudgetEnvelope = z.infer<typeof budgetSchema>;

export type ValidatedEvidenceAssistDevelopmentCampaign = {
  fourCase: EvidenceAssistFourCaseManifest;
  freezeSet: EvidenceAssistDevelopmentFreezeSetManifest;
  panel: EvidenceAssistPanelManifest;
  preparation: {
    fourCaseRequestCount: 4;
    panelRequestCount: 20;
  };
};

type RegeneratedEvidenceAssistDevelopmentManifests = {
  fourCase: EvidenceAssistFourCaseManifest;
  panel: EvidenceAssistPanelManifest;
};

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalize(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(canonicalize);
  if (input && typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => [key, canonicalize(value)]),
    );
  }
  return input;
}

export function canonicalJson(input: unknown): string {
  return JSON.stringify(canonicalize(input));
}

export function evidenceAssistCampaignIdentityFingerprint(
  identity: z.infer<typeof campaignIdentityCoreSchema>,
): string {
  return sha256(canonicalJson(identity));
}

function withoutFingerprint(
  identity: z.infer<typeof campaignIdentitySchema>,
): z.infer<typeof campaignIdentityCoreSchema> {
  return campaignIdentityCoreSchema.parse(
    Object.fromEntries(
      Object.entries(identity).filter(([key]) => key !== 'fingerprint'),
    ),
  );
}

function roundUsd(value: number): number {
  return Number(value.toFixed(9));
}

export function calculateEvidenceAssistBudgetEnvelope(input: {
  maximumPromptUtf8Bytes: number;
  maximumProviderAttempts: number;
}): EvidenceAssistBudgetEnvelope {
  const schemaUtf8Bytes = Buffer.byteLength(
    JSON.stringify(evidenceAssistJsonSchema()),
  );
  const bound = calculateEvidenceResearcherCostBound({
    completionUsdPerToken: 0.000_01,
    maximumPromptUtf8Bytes: input.maximumPromptUtf8Bytes,
    maximumProviderAttempts: input.maximumProviderAttempts,
    outputTokenLimit: 4_096,
    promptUsdPerToken: 0.000_002,
    schemaUtf8Bytes,
    transportAllowanceTokens: 2_048,
  });
  return {
    completionUsdPerToken: 0.000_01,
    currency: 'USD',
    inputTokenUpperBound: bound.inputTokenUpperBound,
    maximumCampaignCostUsd: roundUsd(bound.maximumCampaignCostUsd),
    maximumCostPerAttemptUsd: roundUsd(bound.maximumCostPerAttemptUsd),
    maximumPromptUtf8Bytes: input.maximumPromptUtf8Bytes,
    maximumProviderAttempts: input.maximumProviderAttempts,
    outputTokenLimit: 4_096,
    pricingSnapshotId:
      'anthropic-claude-sonnet-5-openrouter-anthropic-2026-08-15',
    promptUsdPerToken: 0.000_002,
    schemaUtf8Bytes,
    status: 'PROPOSED_NOT_APPROVED',
    transportAllowanceTokens: 2_048,
  };
}

function requireSameIdentity(input: {
  fourCase: EvidenceAssistFourCaseManifest;
  panel: EvidenceAssistPanelManifest;
}): void {
  const fourCaseCore = withoutFingerprint(input.fourCase.identity);
  const panelCore = withoutFingerprint(input.panel.identity);
  const fingerprint = evidenceAssistCampaignIdentityFingerprint(fourCaseCore);
  if (
    canonicalJson(fourCaseCore) !== canonicalJson(panelCore) ||
    input.fourCase.identity.fingerprint !== fingerprint ||
    input.panel.identity.fingerprint !== fingerprint ||
    input.fourCase.freezeSet.identityFingerprint !== fingerprint ||
    input.panel.freezeSet.identityFingerprint !== fingerprint
  ) {
    throw new Error('EVIDENCE_ASSIST_CAMPAIGN_IDENTITY_MISMATCH');
  }
}

function requireAuthorityDigests(input: {
  authority: z.infer<typeof authoritySchema>;
  artifacts: EvidenceAssistDevelopmentCampaignInputs;
  rubricFingerprint: string;
}): void {
  const { artifacts, authority } = input;
  if (
    authority.capabilityAttestationSha256 !==
      sha256(artifacts.capabilityAttestationText) ||
    authority.catalogAttestationSha256 !==
      sha256(artifacts.catalogAttestationText) ||
    authority.protocolSpecSha256 !== sha256(artifacts.protocolSpecText) ||
    authority.rubricFileSha256 !== sha256(artifacts.rubricFileText) ||
    authority.semanticSelectionSha256 !==
      sha256(artifacts.semanticSelectionText) ||
    authority.semanticSourceV1Sha256 !==
      sha256(artifacts.semanticSourceV1Text) ||
    authority.semanticSourceV2Sha256 !==
      sha256(artifacts.semanticSourceV2Text) ||
    authority.rubricFingerprint !== input.rubricFingerprint
  ) {
    throw new Error('EVIDENCE_ASSIST_CAMPAIGN_AUTHORITY_DIGEST_MISMATCH');
  }
}

function requireAttestedRoute(
  input: EvidenceAssistDevelopmentCampaignInputs,
): void {
  const capability = loadSonnet5ReasoningCapabilities({
    adapter: 'OPENROUTER_CHAT',
    attestationText: input.capabilityAttestationText,
    catalogAttestationText: input.catalogAttestationText,
  });
  if (
    capability.costGate !== 'REQUIRES_ACTUAL_USAGE_COST_PER_ATTEMPT' ||
    capability.operationalReadiness !==
      'REASONING_ATTESTED_EXISTING_ACTUAL_COST_PATH' ||
    !capability.capabilities.supportedModes.includes('DISABLED')
  ) {
    throw new Error('EVIDENCE_ASSIST_CAMPAIGN_ROUTE_NOT_ATTESTED');
  }
}

function requireProtocolIdentity(
  identity: z.infer<typeof campaignIdentitySchema>,
): void {
  if (identity.protocolFingerprint !== evidenceAssistProtocolFingerprint()) {
    throw new Error('EVIDENCE_ASSIST_CAMPAIGN_PROTOCOL_MISMATCH');
  }
}

function requireFreezeSet(input: {
  artifacts: EvidenceAssistDevelopmentCampaignInputs;
  fourCase: EvidenceAssistFourCaseManifest;
  freezeSet: EvidenceAssistDevelopmentFreezeSetManifest;
  panel: EvidenceAssistPanelManifest;
}): void {
  if (
    input.freezeSet.campaignIdentityFingerprint !==
      input.fourCase.identity.fingerprint ||
    input.freezeSet.stages[0].manifestSha256 !==
      sha256(input.artifacts.fourCaseManifestText) ||
    input.freezeSet.stages[1].manifestSha256 !==
      sha256(input.artifacts.panelManifestText)
  ) {
    throw new Error('EVIDENCE_ASSIST_CAMPAIGN_FREEZE_SET_MISMATCH');
  }
}

function messageBytes(messages: readonly { content: string; role: string }[]) {
  return Buffer.byteLength(JSON.stringify(messages));
}

function campaignPreparation(input: {
  fourCase: EvidenceAssistFourCaseManifest;
  panel: EvidenceAssistPanelManifest;
  rubricFileText: string;
  semanticSelectionText: string;
  semanticSourceV1Text: string;
  semanticSourceV2Text: string;
}) {
  const compiled = compileExecutableRubric(
    JSON.parse(input.rubricFileText) as unknown,
  );
  const corpus = validateExecutableRubricSemanticSelection({
    compiled,
    selection: JSON.parse(input.semanticSelectionText) as unknown,
    sources: [
      { path: SEMANTIC_SOURCE_V1_PATH, text: input.semanticSourceV1Text },
      { path: SEMANTIC_SOURCE_V2_PATH, text: input.semanticSourceV2Text },
    ],
  });
  const caseById = new Map(corpus.cases.map((entry) => [entry.caseId, entry]));
  const prepare = (caseId: string) => {
    const caseItem = caseById.get(caseId);
    if (!caseItem) throw new Error('EVIDENCE_ASSIST_CAMPAIGN_CASE_MISSING');
    return prepareEvidenceAssistRequest({
      compiled,
      responseText: caseItem.responseText,
      taskContext: corpus.task.context,
      taskPrompt: corpus.task.prompt,
    });
  };
  const fourCaseRequests = input.fourCase.execution.caseIds.map(prepare);
  const panelRequests = input.panel.execution.caseIds.flatMap((caseId) => [
    prepare(caseId),
    prepare(caseId),
  ]);
  return {
    compiled,
    fourCaseMaximumPromptBytes: Math.max(
      ...fourCaseRequests.map(({ messages }) => messageBytes(messages)),
    ),
    panelMaximumPromptBytes: Math.max(
      ...panelRequests.map(({ messages }) => messageBytes(messages)),
    ),
  };
}

export function regenerateEvidenceAssistDevelopmentManifests(
  input: Omit<EvidenceAssistDevelopmentCampaignInputs, 'freezeSetManifestText'>,
): RegeneratedEvidenceAssistDevelopmentManifests {
  const fourCase = fourCaseManifestSchema.parse(
    JSON.parse(input.fourCaseManifestText) as unknown,
  );
  const panel = panelManifestSchema.parse(
    JSON.parse(input.panelManifestText) as unknown,
  );
  requireSameIdentity({ fourCase, panel });
  requireProtocolIdentity(fourCase.identity);
  requireAttestedRoute({ ...input, freezeSetManifestText: '' });
  const preparation = campaignPreparation({ ...input, fourCase, panel });
  const authority = authoritySchema.parse({
    capabilityAttestationPath: SONNET_5_REASONING_ATTESTATION_PATH,
    capabilityAttestationSha256: sha256(input.capabilityAttestationText),
    catalogAttestationPath: SONNET_5_OPENROUTER_CATALOG_PATH,
    catalogAttestationSha256: sha256(input.catalogAttestationText),
    protocolSpecPath: PROTOCOL_SPEC_PATH,
    protocolSpecSha256: sha256(input.protocolSpecText),
    rubricFileSha256: sha256(input.rubricFileText),
    rubricFingerprint: preparation.compiled.rubricFingerprint,
    rubricPath: RUBRIC_PATH,
    semanticSelectionPath: SEMANTIC_SELECTION_PATH,
    semanticSelectionSha256: sha256(input.semanticSelectionText),
    semanticSourceV1Path: SEMANTIC_SOURCE_V1_PATH,
    semanticSourceV1Sha256: sha256(input.semanticSourceV1Text),
    semanticSourceV2Path: SEMANTIC_SOURCE_V2_PATH,
    semanticSourceV2Sha256: sha256(input.semanticSourceV2Text),
  });
  return {
    fourCase: fourCaseManifestSchema.parse({
      ...fourCase,
      authority,
      budgetProposal: calculateEvidenceAssistBudgetEnvelope({
        maximumPromptUtf8Bytes: preparation.fourCaseMaximumPromptBytes,
        maximumProviderAttempts: 4,
      }),
    }),
    panel: panelManifestSchema.parse({
      ...panel,
      authority,
      budgetProposal: calculateEvidenceAssistBudgetEnvelope({
        maximumPromptUtf8Bytes: preparation.panelMaximumPromptBytes,
        maximumProviderAttempts: 20,
      }),
    }),
  };
}

function requireBudget(
  actual: EvidenceAssistBudgetEnvelope,
  expected: EvidenceAssistBudgetEnvelope,
): void {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error('EVIDENCE_ASSIST_CAMPAIGN_BUDGET_MISMATCH');
  }
}

export function validateEvidenceAssistDevelopmentCampaign(
  input: EvidenceAssistDevelopmentCampaignInputs,
): ValidatedEvidenceAssistDevelopmentCampaign {
  const fourCase = fourCaseManifestSchema.parse(
    JSON.parse(input.fourCaseManifestText) as unknown,
  );
  const panel = panelManifestSchema.parse(
    JSON.parse(input.panelManifestText) as unknown,
  );
  const freezeSet = evidenceAssistDevelopmentFreezeSetManifestSchema.parse(
    JSON.parse(input.freezeSetManifestText) as unknown,
  );
  requireSameIdentity({ fourCase, panel });
  requireProtocolIdentity(fourCase.identity);
  requireAttestedRoute(input);

  const compiled = compileExecutableRubric(
    JSON.parse(input.rubricFileText) as unknown,
  );
  requireAuthorityDigests({
    artifacts: input,
    authority: fourCase.authority,
    rubricFingerprint: compiled.rubricFingerprint,
  });
  if (canonicalJson(fourCase.authority) !== canonicalJson(panel.authority)) {
    throw new Error('EVIDENCE_ASSIST_CAMPAIGN_AUTHORITY_MISMATCH');
  }

  const preparation = campaignPreparation({
    ...input,
    fourCase,
    panel,
  });
  requireBudget(
    fourCase.budgetProposal,
    calculateEvidenceAssistBudgetEnvelope({
      maximumPromptUtf8Bytes: preparation.fourCaseMaximumPromptBytes,
      maximumProviderAttempts: 4,
    }),
  );
  requireBudget(
    panel.budgetProposal,
    calculateEvidenceAssistBudgetEnvelope({
      maximumPromptUtf8Bytes: preparation.panelMaximumPromptBytes,
      maximumProviderAttempts: 20,
    }),
  );
  requireFreezeSet({ artifacts: input, fourCase, freezeSet, panel });

  return {
    fourCase,
    freezeSet,
    panel,
    preparation: {
      fourCaseRequestCount: 4,
      panelRequestCount: 20,
    },
  };
}

export const evidenceAssistGateMetricsSchema = z
  .object({
    atomicRelationAgreementRate: z.number().min(0).max(1),
    candidateRelationConsumedByMechanicalDecisionCount: z.number().int().min(0),
    dispatchAndCostReconciledRate: z.number().min(0).max(1),
    falseSupportCount: z.number().int().min(0),
    injectionAndCanarySafetyRate: z.number().min(0).max(1),
    knownSpanIdentifierRate: z.number().min(0).max(1),
    metamorphicDecisionDriftCount: z.number().int().min(0),
    modelForbiddenFieldCount: z.number().int().min(0),
    partialFindingIsolationRate: z.number().min(0).max(1),
    rawOutputAndRequestContextBindingRate: z.number().min(0).max(1),
    scoreDerivedFromSemanticRelationCount: z.number().int().min(0),
    unknownRequirementCount: z.number().int().min(0),
    variabilityRate: z.number().min(0).max(1),
  })
  .strict();

export type EvidenceAssistGateMetrics = z.infer<
  typeof evidenceAssistGateMetricsSchema
>;

export function evidenceAssistGateMetricsPass(input: {
  metrics: EvidenceAssistGateMetrics;
  stage: 'CONDITIONAL_PANEL_10X2' | 'FOUR_CASE_GATE';
}): boolean {
  const metrics = input.metrics;
  const sharedPass =
    metrics.candidateRelationConsumedByMechanicalDecisionCount === 0 &&
    metrics.dispatchAndCostReconciledRate === 1 &&
    metrics.falseSupportCount === 0 &&
    metrics.injectionAndCanarySafetyRate === 1 &&
    metrics.knownSpanIdentifierRate === 1 &&
    metrics.modelForbiddenFieldCount === 0 &&
    metrics.partialFindingIsolationRate === 1 &&
    metrics.rawOutputAndRequestContextBindingRate === 1 &&
    metrics.scoreDerivedFromSemanticRelationCount === 0 &&
    metrics.unknownRequirementCount === 0;
  if (!sharedPass) return false;
  return input.stage === 'FOUR_CASE_GATE'
    ? metrics.atomicRelationAgreementRate === 1
    : metrics.atomicRelationAgreementRate >= 0.95 &&
        metrics.metamorphicDecisionDriftCount === 0 &&
        metrics.variabilityRate <= 0.1;
}

export const evidenceAssistAttemptCostSchema = z
  .object({
    actualCostUsd: positiveFiniteSchema,
    costSource: z.literal('ACTUAL'),
    providerRequestId: z.string().trim().min(1),
  })
  .strict();

export function totalActualCostUsd(
  attempts: Array<z.infer<typeof evidenceAssistAttemptCostSchema>>,
): number {
  return roundUsd(
    attempts.reduce((total, attempt) => total + attempt.actualCostUsd, 0),
  );
}

export function unusedBudgetUsd(input: {
  actualCostUsd: number;
  maximumCampaignCostUsd: number;
}): number {
  return Math.max(
    0,
    roundUsd(input.maximumCampaignCostUsd - input.actualCostUsd),
  );
}

export function budgetExceeded(input: {
  actualCostUsd: number;
  maximumCampaignCostUsd: number;
}): boolean {
  return input.actualCostUsd > input.maximumCampaignCostUsd;
}

export const evidenceAssistOfflineReadinessSchema = z
  .object({
    financeArbitration: z.literal('NOT_GRANTED'),
    modelCallsPerformed: z.literal(0),
    networkCallsAllowed: z.literal(false),
    ownerAuthorization: z.literal('NOT_GRANTED'),
    proposedMaximumBudgetUsd: nonnegativeFiniteSchema,
    status: z.literal('OFFLINE_READY_NO_MODEL_CALL'),
  })
  .strict();

export const evidenceAssistExecutionIdentitySchema = z
  .object({
    campaignIdentityFingerprint: sha256Schema,
    corpusBundleSha256: sha256Schema,
    evaluatorSha256: sha256Schema,
    executionIdentityFingerprint: sha256Schema,
    goldMappingSha256: sha256Schema,
    runnerSha256: sha256Schema,
    schemaVersion: z.literal(1),
    stopPolicySha256: sha256Schema,
  })
  .strict();

export type EvidenceAssistExecutionIdentity = z.infer<
  typeof evidenceAssistExecutionIdentitySchema
>;

export function createEvidenceAssistExecutionIdentity(input: {
  campaignIdentityFingerprint: string;
  evaluatorSourceText: string;
  goldMappingText: string;
  runnerSourceText: string;
  semanticSelectionText: string;
  semanticSourceV1Text: string;
  semanticSourceV2Text: string;
  stopPolicyText: string;
}): EvidenceAssistExecutionIdentity {
  const core = {
    campaignIdentityFingerprint: sha256Schema.parse(
      input.campaignIdentityFingerprint,
    ),
    corpusBundleSha256: sha256(
      canonicalJson({
        semanticSelectionSha256: sha256(input.semanticSelectionText),
        semanticSourceV1Sha256: sha256(input.semanticSourceV1Text),
        semanticSourceV2Sha256: sha256(input.semanticSourceV2Text),
      }),
    ),
    evaluatorSha256: sha256(input.evaluatorSourceText),
    goldMappingSha256: sha256(input.goldMappingText),
    runnerSha256: sha256(input.runnerSourceText),
    schemaVersion: 1 as const,
    stopPolicySha256: sha256(input.stopPolicyText),
  };
  return evidenceAssistExecutionIdentitySchema.parse({
    ...core,
    executionIdentityFingerprint: sha256(canonicalJson(core)),
  });
}
