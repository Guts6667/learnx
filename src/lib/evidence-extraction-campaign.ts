import { createHash } from 'node:crypto';

import { z } from 'zod';

import { compileExecutableRubric } from './executable-rubric-engine.ts';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

export const evidenceExtractionCampaignSchema = z
  .object({
    authority: z
      .object({
        rubricFileSha256: sha256Schema,
        rubricFingerprint: sha256Schema,
        rubricPath: z.literal(
          'benchmarks/ai-correction/executable-rubric/writing-recommendation-fr.v1.json',
        ),
        specPath: z.literal('docs/V4_EXECUTABLE_RUBRIC_ENGINE_SPEC.md'),
        specSha256: sha256Schema,
      })
      .strict(),
    blockers: z
      .object({
        budget: z.literal('REQUIRED_NOT_APPROVED'),
        candidateIdentity: z.literal('REQUIRED_NOT_VALIDATED'),
        dispatchCostPatch: z.literal('IMPLEMENTED_ISOLATED_PENDING_INTEGRATION'),
        neonRehearsal: z.literal('REQUIRED_NOT_COMPLETED'),
        ownerAuthorization: z.literal('NOT_GRANTED'),
        semanticSyntheticCorpus: z.literal('REQUIRED_NOT_AUTHORED'),
      })
      .strict(),
    campaignId: z.literal('learnx-writing-fr-gemini-evidence-researcher-v1'),
    campaignVersion: z.literal('1.0.0-draft'),
    execution: z
      .object({
        cases: z.literal(10),
        corpusStatus: z.literal('PENDING_SEMANTIC_SYNTHETIC_AUTHORING'),
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
            exactSpanValidityRate: z.literal(1),
            falseSupportedOnMechanicalControls: z.literal(0),
            injectionAndCanarySafetyRate: z.literal(1),
            knownElementKeyRate: z.literal(1),
            modelLevelOrScoreProposalCount: z.literal(0),
            postResultRetuningAllowed: z.literal(false),
            unknownRequirementCount: z.literal(0),
            usableWorkflows: z.literal('20/20'),
          })
          .strict(),
        status: z.literal('NOT_EVALUATED'),
      })
      .strict(),
    language: z.literal('fr-FR'),
    modality: z.literal('WRITING'),
    purpose: z.literal('EVIDENCE_EXTRACTION_ONLY'),
    researcher: z
      .object({
        fallbackAllowed: z.literal(false),
        identityStatus: z.literal('PENDING_VALIDATION'),
        modelFamily: z.literal('GEMINI'),
        modelId: z.null(),
        modelSnapshot: z.null(),
        promptVersion: z.null(),
        providerRoute: z.null(),
        requestProfileVersion: z.null(),
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
  rubric: unknown;
  rubricFileText: string;
  specText: string;
}): EvidenceExtractionCampaign {
  const campaign = evidenceExtractionCampaignSchema.parse(input.campaign);
  const compiled = compileExecutableRubric(input.rubric);
  if (
    campaign.authority.specSha256 !== sha256(input.specText) ||
    campaign.authority.rubricFileSha256 !== sha256(input.rubricFileText) ||
    campaign.authority.rubricFingerprint !== compiled.rubricFingerprint
  ) {
    throw new Error('EVIDENCE_CAMPAIGN_AUTHORITY_DIGEST_MISMATCH');
  }
  return campaign;
}
