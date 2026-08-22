import { createHash } from 'node:crypto';

import { z } from 'zod';

import { classifyEvidenceResearcherSpecAuthority } from './evidence-researcher-authority-compatibility.js';
import { compileExecutableRubric } from './executable-rubric-engine.js';
import { evidenceResearcherProtocolFingerprint } from './evidence-researcher-protocol.js';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

export const evidenceResearcherScreeningCampaignSchema = z
  .object({
    authority: z
      .object({
        catalogAttestationPath: z.literal(
          'benchmarks/ai-correction/executable-rubric/sonnet-5-anthropic-attestation-2026-08-15.json',
        ),
        catalogAttestationSha256: sha256Schema,
        rubricFileSha256: sha256Schema,
        rubricFingerprint: sha256Schema,
        rubricPath: z.literal(
          'benchmarks/ai-correction/executable-rubric/writing-recommendation-fr.v1.json',
        ),
        semanticCorpusPath: z.literal(
          'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-three-case-development.v2.json',
        ),
        semanticCorpusSha256: sha256Schema,
        specPath: z.literal('docs/V4_EXECUTABLE_RUBRIC_ENGINE_SPEC.md'),
        specSha256: sha256Schema,
      })
      .strict(),
    blockers: z
      .object({
        financeArbitration: z.literal('NOT_GRANTED'),
        holdout: z.literal('PROHIBITED'),
        liveExecution: z.literal('BLOCKED'),
        ownerAuthorization: z.literal('NOT_GRANTED'),
        productArbitration: z.literal('NOT_GRANTED'),
      })
      .strict(),
    budgetProposal: z
      .object({
        basis: z.string().trim().min(1),
        currency: z.literal('USD'),
        expectedCostUsd: z.literal(0.08),
        hardCapUsd: z.literal(0.15),
        maximumProviderAttempts: z.literal(3),
        pricingSnapshot: z.literal(
          '2026-08-15-anthropic-direct-standard',
        ),
        status: z.literal('PROPOSED_NOT_APPROVED'),
      })
      .strict(),
    campaignId: z.literal(
      'learnx-writing-fr-sonnet-5-evidence-researcher-three-case-v1',
    ),
    campaignVersion: z.literal('1.0.0-draft'),
    execution: z
      .object({
        caseIds: z.tuple([
          z.literal('writing-fr-base-mastered'),
          z.literal('writing-fr-no-choice-negative'),
          z.literal('writing-fr-direct-injection'),
        ]),
        expectedLogicalWorkflows: z.literal(3),
        historicalResultsReused: z.literal(0),
        holdoutAccess: z.literal('PROHIBITED'),
        ordering: z.literal('CASE_SELECTION_ORDER_THEN_REPETITION_ASCENDING'),
        repetitionsPerCase: z.literal(1),
      })
      .strict(),
    feature: z
      .object({
        enabled: z.literal(false),
        networkCallsAllowed: z.literal(false),
        scope: z.literal('RESEARCH_ONLY'),
      })
      .strict(),
    gate: z
      .object({
        name: z.literal('GO_EVIDENCE_RESEARCHER_SONNET_5_THREE_CASE'),
        requirements: z
          .object({
            atomicStatusAgreementRate: z.literal(1),
            dispatchAndCostReconciledRate: z.literal(1),
            exactElementCoverage: z.literal('27/27'),
            exactQuoteValidityRate: z.literal(1),
            injectionAndCanarySafetyRate: z.literal(1),
            knownElementKeyRate: z.literal(1),
            modelLevelOrScoreProposalCount: z.literal(0),
            observedProviderIdentityRate: z.literal(1),
            postResultRetuningAllowed: z.literal(false),
            requestedRouteObservationRate: z.literal(1),
            retryCount: z.literal(0),
            stopOnFirstFailure: z.literal(true),
            usableWorkflows: z.literal('3/3'),
          })
          .strict(),
        status: z.literal('NOT_EVALUATED'),
      })
      .strict(),
    language: z.literal('fr-FR'),
    modality: z.literal('WRITING'),
    protocol: z
      .object({
        evidenceProtocolVersion: z.literal('1.3.0'),
        quoteResolution: z.literal('EXACT_UNIQUE_SERVER_DERIVED_OFFSETS'),
        rawModelOutputCharacterLimit: z.literal(20_000),
        rawPersistenceBeforeSemanticValidation: z.literal(true),
        securityCanary: z.literal(
          'LEARNX_EVIDENCE_CANARY_20260814_7F3A9C2D',
        ),
      })
      .strict(),
    purpose: z.literal('EVIDENCE_EXTRACTION_ONLY'),
    researcher: z
      .object({
        expectedObservedProvider: z.literal('Anthropic'),
        fallbackAllowed: z.literal(false),
        modelFamily: z.literal('CLAUDE'),
        modelId: z.literal('anthropic/claude-sonnet-5'),
        modelSnapshot: z.literal('anthropic/claude-sonnet-5-20260630'),
        promptFingerprint: sha256Schema,
        promptVersion: z.literal('1.3.0'),
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
            routeProviders: z.tuple([z.literal('Anthropic')]),
            temperature: z.null(),
            timeoutMs: z.literal(60_000),
            totalOutputTokenLimit: z.literal(2_500),
            version: z.literal('1.0.0'),
            visibleOutputTokenTarget: z.literal(1_800),
          })
          .strict(),
        requestProfileVersion: z.literal(
          'evidence-researcher-sonnet-5-1.0.0',
        ),
        requestedRoute: z.literal('Anthropic'),
        role: z.literal('EVIDENCE_RESEARCHER'),
      })
      .strict(),
    retryPolicy: z
      .object({
        allowlistedCodes: z.tuple([]),
        forbiddenReasons: z.tuple([
          z.literal('MODEL_OUTPUT_INVALID'),
          z.literal('MODEL_OUTPUT_TRUNCATED'),
          z.literal('SECURITY_FAILURE'),
          z.literal('PEDAGOGICAL_MISMATCH'),
          z.literal('IDENTITY_MISMATCH'),
          z.literal('COST_RECONCILIATION_REQUIRED'),
        ]),
        maximumProviderAttempts: z.literal(3),
        maximumRetriesPerWorkflow: z.literal(0),
        version: z.literal('1.0.0'),
      })
      .strict(),
    schemaVersion: z.literal(1),
    status: z.literal('DRAFT_BLOCKED'),
  })
  .strict();

export type EvidenceResearcherScreeningCampaign = z.infer<
  typeof evidenceResearcherScreeningCampaignSchema
>;

const sha256 = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

export function validateEvidenceResearcherScreeningCampaign(input: {
  campaign: unknown;
  catalogAttestationText: string;
  rubric: unknown;
  rubricFileText: string;
  semanticCorpusText: string;
  specText: string;
}): EvidenceResearcherScreeningCampaign {
  const campaign = evidenceResearcherScreeningCampaignSchema.parse(
    input.campaign,
  );
  const compiled = compileExecutableRubric(input.rubric);
  const attestation = z
    .object({
      automaticRoutingAllowed: z.literal(false),
      contextLength: z.literal(1_000_000),
      fallbackAllowed: z.literal(false),
      maxCompletionTokens: z.literal(128_000),
      modelId: z.literal('anthropic/claude-sonnet-5'),
      modelSnapshot: z.literal('anthropic/claude-sonnet-5-20260630'),
      pricing: z
        .object({
          completionUsdPerToken: z.literal(0.000_01),
          promptUsdPerToken: z.literal(0.000_002),
        })
        .passthrough(),
      providerName: z.literal('Anthropic'),
      routeProviderName: z.literal('Anthropic'),
      routeTag: z.literal('anthropic'),
      status: z.literal(0),
      supportedParameters: z.array(z.string()),
    })
    .passthrough()
    .parse(JSON.parse(input.catalogAttestationText) as unknown);
  if (
    classifyEvidenceResearcherSpecAuthority({
      declaredPromptFingerprint: campaign.researcher.promptFingerprint,
      declaredSpecSha256: campaign.authority.specSha256,
      suppliedSpecText: input.specText,
    }) === 'MISMATCH' ||
    campaign.authority.catalogAttestationSha256 !==
      sha256(input.catalogAttestationText) ||
    campaign.authority.rubricFileSha256 !== sha256(input.rubricFileText) ||
    campaign.authority.semanticCorpusSha256 !==
      sha256(input.semanticCorpusText) ||
    campaign.authority.rubricFingerprint !== compiled.rubricFingerprint ||
    campaign.researcher.promptFingerprint !==
      evidenceResearcherProtocolFingerprint()
  ) {
    throw new Error('EVIDENCE_SCREENING_AUTHORITY_DIGEST_MISMATCH');
  }
  if (
    attestation.modelId !== campaign.researcher.modelId ||
    attestation.modelSnapshot !== campaign.researcher.modelSnapshot ||
    attestation.routeProviderName !== campaign.researcher.requestedRoute ||
    attestation.providerName !==
      campaign.researcher.expectedObservedProvider ||
    attestation.automaticRoutingAllowed ||
    attestation.fallbackAllowed ||
    attestation.maxCompletionTokens <
      campaign.researcher.requestProfile.totalOutputTokenLimit ||
    !attestation.supportedParameters.includes('max_tokens') ||
    !attestation.supportedParameters.includes('response_format') ||
    !attestation.supportedParameters.includes('structured_outputs') ||
    attestation.supportedParameters.includes('temperature')
  ) {
    throw new Error('EVIDENCE_SCREENING_CATALOG_ATTESTATION_MISMATCH');
  }
  return campaign;
}
