import { createHash } from 'node:crypto';

import { z } from 'zod';

import { compileExecutableRubric } from './executable-rubric-engine.ts';
import { evidenceResearcherProtocolFingerprint } from './evidence-researcher-protocol.ts';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

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
    campaignVersion: z.literal('1.0.0-draft'),
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
        headSha: z.literal(
          '20fb325fa9755770cd82ea170982b54df17a724d',
        ),
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
        promptVersion: z.literal('1.0.0'),
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
            visibleOutputTokenTarget: z.literal(1_800),
          })
          .strict(),
        requestProfileVersion: z.literal('evidence-researcher-1.0.0'),
        role: z.literal('EVIDENCE_RESEARCHER'),
      })
      .strict(),
    schemaVersion: z.literal(1),
    status: z.literal('DRAFT_BLOCKED'),
  })
  .strict();

export type EvidenceExtractionCampaign = z.infer<
  typeof evidenceExtractionCampaignSchema
>;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
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
  return campaign;
}
