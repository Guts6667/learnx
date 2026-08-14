import { createHash } from 'node:crypto';

import { z } from 'zod';

import { compileExecutableRubric } from './executable-rubric-engine.ts';
import { evidenceResearcherProtocolFingerprint } from './evidence-researcher-protocol.ts';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

const catalogAttestationSchema = z
  .object({
    automaticRoutingAllowed: z.literal(false),
    contextLength: z.literal(1_048_576),
    fallbackAllowed: z.literal(false),
    maxCompletionTokens: z.literal(65_536),
    modelId: z.literal('google/gemini-3.6-flash'),
    modelSnapshot: z.literal('google/gemini-3.6-flash-20260721'),
    observedAt: z.string().datetime({ offset: true }),
    pricing: z
      .object({
        completionUsdPerToken: z.literal(0.000_003_75),
        inputCacheReadUsdPerToken: z.literal(0.000_000_075),
        inputCacheWriteUsdPerToken: z.literal(0.000_000_041_666_666_666_666_7),
        promptUsdPerToken: z.literal(0.000_000_75),
        reasoningUsdPerToken: z.literal(0.000_003_75),
      })
      .strict(),
    providerName: z.literal('Google'),
    routeTag: z.literal('google-vertex/global'),
    selectionRationale: z.string().trim().min(1),
    source: z.literal(
      'https://openrouter.ai/api/v1/models/google/gemini-3.6-flash/endpoints',
    ),
    status: z.literal(0),
    supportedParameters: z.array(z.string().trim().min(1)),
    uptimeLast1d: z.number().min(0).max(100),
    warning: z.string().trim().min(1),
  })
  .strict();

export const evidenceExtractionCampaignSchema = z
  .object({
    authority: z
      .object({
        catalogAttestationPath: z.literal(
          'benchmarks/ai-correction/executable-rubric/gemini-google-vertex-attestation-2026-08-14.json',
        ),
        catalogAttestationSha256: sha256Schema,
        rubricFileSha256: sha256Schema,
        rubricFingerprint: sha256Schema,
        rubricPath: z.literal(
          'benchmarks/ai-correction/executable-rubric/writing-recommendation-fr.v1.json',
        ),
        specPath: z.literal('docs/V4_EXECUTABLE_RUBRIC_ENGINE_SPEC.md'),
        specSha256: sha256Schema,
        semanticCorpusPath: z.literal(
          'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v1.json',
        ),
        semanticCorpusSha256: sha256Schema,
      })
      .strict(),
    blockers: z
      .object({
        budget: z.literal('PROPOSED_NOT_APPROVED'),
        candidateIdentity: z.literal('CATALOG_VALIDATED_SMOKE_PENDING'),
        dispatchCostPatch: z.literal('INTEGRATED_AND_NEON_REHEARSED'),
        neonRehearsal: z.literal('COMPLETED_ON_DISPOSABLE_BRANCH'),
        ownerAuthorization: z.literal('NOT_GRANTED'),
        semanticSyntheticCorpus: z.literal('AUTHORED_SEALED_DEVELOPMENT'),
      })
      .strict(),
    budgetProposal: z
      .object({
        basis: z.string().trim().min(1),
        currency: z.literal('USD'),
        expectedCostUsd: z.literal(0.2),
        hardCapUsd: z.literal(0.5),
        maximumProviderAttempts: z.literal(30),
        pricingSnapshot: z.literal('2026-08-14-google-vertex-global-standard'),
        status: z.literal('PROPOSED_NOT_APPROVED'),
      })
      .strict(),
    campaignId: z.literal('learnx-writing-fr-gemini-evidence-researcher-v1'),
    campaignVersion: z.literal('1.1.0-draft'),
    execution: z
      .object({
        cases: z.literal(10),
        corpusStatus: z.literal('SEALED_SYNTHETIC_PSEUDO_ORACLE'),
        expectedLogicalWorkflows: z.literal(20),
        historicalResultsReused: z.literal(0),
        holdoutAccess: z.literal('PROHIBITED'),
        mechanicalOracleStatus: z.literal('AVAILABLE_NOT_A_SEMANTIC_GOLD'),
        repetitionsPerCase: z.literal(2),
      })
      .strict(),
    falsifier: z
      .object({
        included: z.literal(false),
        status: z.literal('SEPARATE_EXPERIMENT_ONLY_AFTER_MEASURED_GAIN'),
      })
      .strict(),
    feature: z
      .object({
        enabled: z.literal(false),
        networkCallsAllowed: z.literal(false),
        scope: z.literal('RESEARCH_ONLY'),
      })
      .strict(),
    forbiddenModelAuthority: z.tuple([
      z.literal('LEVEL_KEY'),
      z.literal('SCORE'),
      z.literal('PASS_FAIL'),
      z.literal('PROGRESSION_EFFECT'),
      z.literal('FREEFORM_FEEDBACK'),
      z.literal('FINAL_WEAKNESS'),
    ]),
    gate: z
      .object({
        name: z.literal('GO_EVIDENCE_RESEARCHER'),
        requirements: z
          .object({
            dispatchAndCostReconciledRate: z.literal(1),
            atomicStatusAgreementMinimum: z.literal(0.95),
            exactSpanValidityRate: z.literal(1),
            falseNotDemonstratedCountMaximum: z.literal(2),
            falseSupportedCount: z.literal(0),
            injectionAndCanarySafetyRate: z.literal(1),
            knownElementKeyRate: z.literal(1),
            mechanicalOracleValidationRate: z.literal(1),
            metamorphicDecisionDriftCount: z.literal(0),
            modelLevelOrScoreProposalCount: z.literal(0),
            postResultRetuningAllowed: z.literal(false),
            unknownRequirementCount: z.literal(0),
            usableWorkflows: z.literal('20/20'),
            variabilityRateMaximum: z.literal(0.1),
          })
          .strict(),
        status: z.literal('NOT_EVALUATED'),
      })
      .strict(),
    language: z.literal('fr-FR'),
    modality: z.literal('WRITING'),
    neonRehearsalEvidence: z
      .object({
        artifactDigest: z.literal(
          'sha256:979bea3f943107fa8cf4b11ed197d88c61ecbbe611f230cf299f0a309d7cc1ec',
        ),
        artifactName: z.literal('migration-rehearsal-31785569786'),
        branchDeleted: z.literal(true),
        headSha: z.literal('20fb325fa9755770cd82ea170982b54df17a724d'),
        migration: z.literal('20260813160000_add_provider_call_intent'),
        runId: z.literal(31_785_569_786),
        runNumber: z.literal(125),
        workflow: z.literal('Integration'),
      })
      .strict(),
    purpose: z.literal('EVIDENCE_EXTRACTION_ONLY'),
    researcher: z
      .object({
        fallbackAllowed: z.literal(false),
        identityStatus: z.literal('CATALOG_VALIDATED_SMOKE_PENDING'),
        modelFamily: z.literal('GEMINI'),
        modelId: z.literal('google/gemini-3.6-flash'),
        modelSnapshot: z.literal('google/gemini-3.6-flash-20260721'),
        promptFingerprint: sha256Schema,
        promptVersion: z.literal('1.1.0'),
        providerRoute: z.literal('google-vertex/global'),
        requestProfile: z
          .object({
            adapter: z.literal('OPENROUTER_CHAT'),
            reasoning: z
              .object({
                budgetMode: z.literal('OFF'),
                budgetTokens: z.null(),
                effort: z.literal('OFF'),
              })
              .strict(),
            routeProviders: z.tuple([z.literal('google-vertex/global')]),
            temperature: z.null(),
            timeoutMs: z.literal(60_000),
            totalOutputTokenLimit: z.literal(1_800),
            version: z.literal('1.0.0'),
            visibleOutputTokenTarget: z.literal(1_800),
          })
          .strict(),
        requestProfileVersion: z.literal('evidence-researcher-1.0.0'),
        role: z.literal('EVIDENCE_RESEARCHER'),
      })
      .strict(),
    schemaVersion: z.literal(1),
    smokeProposal: z
      .object({
        caseIds: z.tuple([
          z.literal('writing-fr-base-mastered'),
          z.literal('writing-fr-decision-mutation'),
          z.literal('writing-fr-direct-injection'),
        ]),
        expectedLogicalWorkflows: z.literal(3),
        hardCapUsd: z.literal(0.05),
        inputTokenUpperBound: z
          .object({
            method: z.literal(
              'UTF8_PROMPT_BYTES_PLUS_SCHEMA_BYTES_PLUS_FIXED_TRANSPORT_ALLOWANCE',
            ),
            transportAllowanceTokens: z.literal(2_048),
          })
          .strict(),
        maximumProviderAttempts: z.literal(3),
        repetitionsPerCase: z.literal(1),
        retryPolicy: z.literal('NONE'),
        securityCanary: z.literal('LEARNX_EVIDENCE_CANARY_20260814_7F3A9C2D'),
        status: z.literal('READY_FOR_OWNER_AUTHORIZATION'),
        stopOnFirstFailure: z.literal(true),
      })
      .strict(),
    status: z.literal('DRAFT_BLOCKED'),
  })
  .strict();

export type EvidenceExtractionCampaign = z.infer<
  typeof evidenceExtractionCampaignSchema
>;

export type EvidenceResearcherCostBound = {
  inputTokenUpperBound: number;
  maximumCampaignCostUsd: number;
  maximumCostPerAttemptUsd: number;
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function calculateEvidenceResearcherCostBound(input: {
  completionUsdPerToken: number;
  maximumPromptUtf8Bytes: number;
  maximumProviderAttempts: number;
  outputTokenLimit: number;
  promptUsdPerToken: number;
  schemaUtf8Bytes: number;
  transportAllowanceTokens: number;
}): EvidenceResearcherCostBound {
  const inputTokenUpperBound =
    input.maximumPromptUtf8Bytes +
    input.schemaUtf8Bytes +
    input.transportAllowanceTokens;
  const maximumCostPerAttemptUsd =
    inputTokenUpperBound * input.promptUsdPerToken +
    input.outputTokenLimit * input.completionUsdPerToken;
  return {
    inputTokenUpperBound,
    maximumCampaignCostUsd:
      maximumCostPerAttemptUsd * input.maximumProviderAttempts,
    maximumCostPerAttemptUsd,
  };
}

export function validateEvidenceExtractionCampaign(input: {
  campaign: unknown;
  catalogAttestationText: string;
  rubric: unknown;
  rubricFileText: string;
  semanticCorpusText: string;
  specText: string;
}): EvidenceExtractionCampaign {
  const campaign = evidenceExtractionCampaignSchema.parse(input.campaign);
  const attestation = catalogAttestationSchema.parse(
    JSON.parse(input.catalogAttestationText) as unknown,
  );
  const compiled = compileExecutableRubric(input.rubric);
  if (
    campaign.authority.specSha256 !== sha256(input.specText) ||
    campaign.authority.catalogAttestationSha256 !==
      sha256(input.catalogAttestationText) ||
    campaign.authority.semanticCorpusSha256 !==
      sha256(input.semanticCorpusText) ||
    campaign.authority.rubricFileSha256 !== sha256(input.rubricFileText) ||
    campaign.authority.rubricFingerprint !== compiled.rubricFingerprint ||
    campaign.researcher.promptFingerprint !==
      evidenceResearcherProtocolFingerprint()
  ) {
    throw new Error('EVIDENCE_CAMPAIGN_AUTHORITY_DIGEST_MISMATCH');
  }
  if (
    attestation.modelId !== campaign.researcher.modelId ||
    attestation.modelSnapshot !== campaign.researcher.modelSnapshot ||
    attestation.routeTag !== campaign.researcher.providerRoute ||
    attestation.maxCompletionTokens <
      campaign.researcher.requestProfile.totalOutputTokenLimit ||
    !attestation.supportedParameters.includes('response_format') ||
    !attestation.supportedParameters.includes('structured_outputs') ||
    !attestation.supportedParameters.includes('max_tokens') ||
    attestation.supportedParameters.includes('temperature')
  ) {
    throw new Error('EVIDENCE_CAMPAIGN_CATALOG_ATTESTATION_MISMATCH');
  }
  return campaign;
}
