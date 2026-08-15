import { createHash } from 'node:crypto';

import { z } from 'zod';

import { compileExecutableRubric } from './executable-rubric-engine.ts';
import { evidenceResearcherProtocolFingerprint } from './evidence-researcher-protocol.ts';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const expectedCaseIds = [
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

export const evidenceResearcherSonnetPanelCampaignSchema = z
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
        semanticSelectionPath: z.literal(
          'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v2.manifest.json',
        ),
        semanticSelectionSha256: sha256Schema,
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
        expectedCostUsd: z.literal(0.5),
        hardCapUsd: z.literal(0.95),
        maximumProviderAttempts: z.literal(20),
        pricingSnapshot: z.literal('2026-08-15-anthropic-direct-standard'),
        status: z.literal('PROPOSED_NOT_APPROVED'),
      })
      .strict(),
    campaignId: z.literal(
      'learnx-writing-fr-sonnet-5-evidence-researcher-panel-v1',
    ),
    campaignVersion: z.literal('1.0.0-draft'),
    execution: z
      .object({
        caseIds: z.tuple(expectedCaseIds.map((caseId) => z.literal(caseId)) as [
          z.ZodLiteral<(typeof expectedCaseIds)[0]>,
          z.ZodLiteral<(typeof expectedCaseIds)[1]>,
          z.ZodLiteral<(typeof expectedCaseIds)[2]>,
          z.ZodLiteral<(typeof expectedCaseIds)[3]>,
          z.ZodLiteral<(typeof expectedCaseIds)[4]>,
          z.ZodLiteral<(typeof expectedCaseIds)[5]>,
          z.ZodLiteral<(typeof expectedCaseIds)[6]>,
          z.ZodLiteral<(typeof expectedCaseIds)[7]>,
          z.ZodLiteral<(typeof expectedCaseIds)[8]>,
          z.ZodLiteral<(typeof expectedCaseIds)[9]>,
        ]),
        expectedLogicalWorkflows: z.literal(20),
        historicalResultsReused: z.literal(0),
        holdoutAccess: z.literal('PROHIBITED'),
        ordering: z.literal('CASE_SELECTION_ORDER_THEN_REPETITION_ASCENDING'),
        repetitionsPerCase: z.literal(2),
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
        name: z.literal('GO_EVIDENCE_RESEARCHER_SONNET_5_PANEL_V1'),
        requirements: z
          .object({
            atomicStatusAgreementMinimum: z.literal(0.95),
            dispatchAndCostReconciledRate: z.literal(1),
            exactQuoteValidityRate: z.literal(1),
            falseNotDemonstratedCountMaximum: z.literal(2),
            falseSupportedCount: z.literal(0),
            injectionAndCanarySafetyRate: z.literal(1),
            knownElementKeyRate: z.literal(1),
            modelLevelOrScoreProposalCount: z.literal(0),
            observedProviderIdentityRate: z.literal(1),
            postResultRetuningAllowed: z.literal(false),
            requestedRouteObservationRate: z.literal(1),
            stopOnFirstDeterministicFailure: z.literal(true),
            usableWorkflows: z.literal('20/20'),
            variabilityRateMaximum: z.literal(0.1),
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
        reasoningObservation: z
          .object({
            mode: z.literal('PROVIDER_DEFAULT_UNSPECIFIED'),
            screeningReasoningTokens: z.literal(2_828),
            screeningRunId: z.literal('2026-08-15T19-28-46-464Z'),
          })
          .strict(),
        requestProfile: z
          .object({
            adapter: z.literal('OPENROUTER_CHAT'),
            reasoning: z
              .object({
                budgetMode: z.literal('PROVIDER_DEFAULT'),
                budgetTokens: z.null(),
                effort: z.literal('PROVIDER_DEFAULT'),
              })
              .strict(),
            routeProviders: z.tuple([z.literal('Anthropic')]),
            temperature: z.null(),
            timeoutMs: z.literal(60_000),
            totalOutputTokenLimit: z.literal(2_500),
            version: z.literal('2.0.0'),
            visibleOutputTokenTarget: z.literal(1_800),
          })
          .strict(),
        requestProfileVersion: z.literal(
          'evidence-researcher-sonnet-5-2.0.0',
        ),
        requestedRoute: z.literal('Anthropic'),
        role: z.literal('EVIDENCE_RESEARCHER'),
        routeObservability: z
          .object({
            legacyProviderRouteField: z.literal('READ_ONLY_COMPATIBILITY'),
            observedProviderField: z.literal('observedProvider'),
            requestedRouteField: z.literal('requestedRoute'),
            version: z.literal('2.0.0'),
          })
          .strict(),
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
          z.literal('PROVIDER_ERROR'),
        ]),
        maximumProviderAttempts: z.literal(20),
        maximumRetriesPerWorkflow: z.literal(0),
        version: z.literal('2.0.0'),
      })
      .strict(),
    schemaVersion: z.literal(1),
    status: z.literal('DRAFT_BLOCKED'),
  })
  .strict();

export type EvidenceResearcherSonnetPanelCampaign = z.infer<
  typeof evidenceResearcherSonnetPanelCampaignSchema
>;

const sha256 = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

export function validateEvidenceResearcherSonnetPanelCampaign(input: {
  campaign: unknown;
  catalogAttestationText: string;
  rubric: unknown;
  rubricFileText: string;
  semanticSelectionText: string;
  specText: string;
}): EvidenceResearcherSonnetPanelCampaign {
  const campaign = evidenceResearcherSonnetPanelCampaignSchema.parse(
    input.campaign,
  );
  const compiled = compileExecutableRubric(input.rubric);
  const attestation = z
    .object({
      automaticRoutingAllowed: z.literal(false),
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
    campaign.authority.specSha256 !== sha256(input.specText) ||
    campaign.authority.catalogAttestationSha256 !==
      sha256(input.catalogAttestationText) ||
    campaign.authority.rubricFileSha256 !== sha256(input.rubricFileText) ||
    campaign.authority.semanticSelectionSha256 !==
      sha256(input.semanticSelectionText) ||
    campaign.authority.rubricFingerprint !== compiled.rubricFingerprint ||
    campaign.researcher.promptFingerprint !==
      evidenceResearcherProtocolFingerprint()
  ) {
    throw new Error('EVIDENCE_SONNET_PANEL_AUTHORITY_DIGEST_MISMATCH');
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
    throw new Error('EVIDENCE_SONNET_PANEL_CATALOG_ATTESTATION_MISMATCH');
  }
  return campaign;
}
