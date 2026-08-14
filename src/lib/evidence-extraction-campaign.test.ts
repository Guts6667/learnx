import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildOpenRouterRequestBody } from './ai-correction-provider-adapters.ts';
import {
  calculateEvidenceResearcherCostBound,
  validateEvidenceExtractionCampaign,
} from './evidence-extraction-campaign.ts';

const campaignPath = resolve(
  process.cwd(),
  'benchmarks/ai-correction/executable-rubric/gemini-evidence-researcher-smoke.v1.2.json',
);
const legacyCampaignPath = resolve(
  process.cwd(),
  'benchmarks/ai-correction/executable-rubric/gemini-evidence-researcher-mini-panel.v1.json',
);
const rubricPath = resolve(
  process.cwd(),
  'benchmarks/ai-correction/executable-rubric/writing-recommendation-fr.v1.json',
);
const semanticCorpusPath = resolve(
  process.cwd(),
  'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v1.json',
);
const catalogAttestationPath = resolve(
  process.cwd(),
  'benchmarks/ai-correction/executable-rubric/gemini-google-vertex-attestation-2026-08-14-reasoning.json',
);
const legacyCatalogAttestationPath = resolve(
  process.cwd(),
  'benchmarks/ai-correction/executable-rubric/gemini-google-vertex-attestation-2026-08-14.json',
);
const specPath = resolve(
  process.cwd(),
  'docs/V4_EXECUTABLE_RUBRIC_ENGINE_SPEC.md',
);

function loadInputs(options: { legacy?: boolean } = {}) {
  const campaignText = readFileSync(
    options.legacy ? legacyCampaignPath : campaignPath,
    'utf8',
  );
  const rubricFileText = readFileSync(rubricPath, 'utf8');
  const semanticCorpusText = readFileSync(semanticCorpusPath, 'utf8');
  const catalogAttestationText = readFileSync(
    options.legacy ? legacyCatalogAttestationPath : catalogAttestationPath,
    'utf8',
  );
  const specText = readFileSync(specPath, 'utf8');
  return {
    campaign: JSON.parse(campaignText) as unknown,
    catalogAttestationText,
    rubric: JSON.parse(rubricFileText) as unknown,
    rubricFileText,
    semanticCorpusText,
    specText,
  };
}

describe('Gemini evidence researcher campaign', () => {
  it('is bound to the executable rubric while remaining non-executable', () => {
    const campaign = validateEvidenceExtractionCampaign(loadInputs());

    expect(campaign.purpose).toBe('EVIDENCE_EXTRACTION_ONLY');
    expect(campaign.researcher).toMatchObject({
      modelId: 'google/gemini-3.6-flash',
      modelSnapshot: 'google/gemini-3.6-flash-20260721',
      providerRoute: 'google-vertex/global',
      identityStatus: 'CATALOG_VALIDATED_PROFILE_DIAGNOSED_SMOKE_PENDING',
    });
    expect(campaign.falsifier.included).toBe(false);
    expect(campaign.feature).toEqual({
      enabled: false,
      networkCallsAllowed: false,
      scope: 'RESEARCH_ONLY',
    });
    expect(campaign.execution.historicalResultsReused).toBe(0);
    expect(campaign.execution.corpusStatus).toBe(
      'SEALED_SYNTHETIC_PSEUDO_ORACLE',
    );
    expect(campaign.blockers.dispatchCostPatch).toBe(
      'INTEGRATED_AND_NEON_REHEARSED',
    );
    expect(campaign.blockers.neonRehearsal).toBe(
      'COMPLETED_ON_DISPOSABLE_BRANCH',
    );
    expect(campaign.neonRehearsalEvidence).toEqual({
      artifactDigest:
        'sha256:979bea3f943107fa8cf4b11ed197d88c61ecbbe611f230cf299f0a309d7cc1ec',
      artifactName: 'migration-rehearsal-31785569786',
      branchDeleted: true,
      headSha: '20fb325fa9755770cd82ea170982b54df17a724d',
      migration: '20260813160000_add_provider_call_intent',
      runId: 31_785_569_786,
      runNumber: 125,
      workflow: 'Integration',
    });
    expect(campaign.budgetProposal).toMatchObject({
      hardCapUsd: 0.5,
      status: 'PROPOSED_NOT_APPROVED',
    });
    expect(campaign.smokeProposal).toMatchObject({
      expectedLogicalWorkflows: 3,
      hardCapUsd: 0.055,
      maximumProviderAttempts: 3,
      retryPolicy: 'NONE',
      securityCanary: 'LEARNX_EVIDENCE_CANARY_20260814_7F3A9C2D',
      status: 'DRAFT_REQUIRES_FINANCE_AND_OWNER_AUTHORIZATION',
    });
  });

  it('keeps the executed 1.1.0 identity readable without reclassifying it', () => {
    const campaign = validateEvidenceExtractionCampaign(
      loadInputs({ legacy: true }),
    );

    expect(campaign.campaignVersion).toBe('1.1.0-draft');
    expect(campaign.researcher.requestProfile.reasoning).toEqual({
      budgetMode: 'OFF',
      budgetTokens: null,
      effort: 'OFF',
    });
  });

  it('sends the mandatory Gemini reasoning level explicitly', () => {
    const campaign = validateEvidenceExtractionCampaign(loadInputs());

    const body = buildOpenRouterRequestBody({
      jsonSchema: { type: 'object' },
      messages: [{ content: 'test', role: 'system' }],
      modelId: campaign.researcher.modelId,
      profile: campaign.researcher.requestProfile,
    });

    expect(body).toMatchObject({
      max_tokens: 2_500,
      reasoning: { effort: 'minimal' },
    });
    expect(body).not.toHaveProperty('temperature');
  });

  it('forbids any model authority over levels, scores and feedback', () => {
    const campaign = validateEvidenceExtractionCampaign(loadInputs());

    expect(campaign.forbiddenModelAuthority).toEqual([
      'LEVEL_KEY',
      'SCORE',
      'PASS_FAIL',
      'PROGRESSION_EFFECT',
      'FREEFORM_FEEDBACK',
      'FINAL_WEAKNESS',
    ]);
  });

  it('fails closed when the executable rubric changes', () => {
    const input = loadInputs();
    input.rubricFileText = `${input.rubricFileText}\n`;

    expect(() => validateEvidenceExtractionCampaign(input)).toThrow(
      'EVIDENCE_CAMPAIGN_AUTHORITY_DIGEST_MISMATCH',
    );
  });

  it('bounds the smoke below its hard cap without using historical averages', () => {
    const bound = calculateEvidenceResearcherCostBound({
      completionUsdPerToken: 0.000_003_75,
      maximumPromptUtf8Bytes: 8_000,
      maximumProviderAttempts: 3,
      outputTokenLimit: 2_500,
      promptUsdPerToken: 0.000_000_75,
      schemaUtf8Bytes: 1_000,
      transportAllowanceTokens: 2_048,
    });

    expect(bound).toEqual({
      inputTokenUpperBound: 11_048,
      maximumCampaignCostUsd: 0.052_983,
      maximumCostPerAttemptUsd: 0.017_661,
    });
    expect(bound.maximumCampaignCostUsd).toBeLessThan(0.055);
  });

  it('rejects an omitted reasoning policy for the mandatory-reasoning identity', () => {
    const input = loadInputs();
    const campaign = input.campaign as {
      researcher: {
        requestProfile: {
          reasoning: {
            budgetMode: string;
            budgetTokens: null;
            effort: string;
          };
        };
      };
    };
    campaign.researcher.requestProfile.reasoning = {
      budgetMode: 'OFF',
      budgetTokens: null,
      effort: 'OFF',
    };

    expect(() => validateEvidenceExtractionCampaign(input)).toThrow(
      'EVIDENCE_CAMPAIGN_REQUEST_PROFILE_IDENTITY_MISMATCH',
    );
  });

  it('fails closed when the attested route gains an unsupported temperature parameter', () => {
    const input = loadInputs();
    const attestation = JSON.parse(input.catalogAttestationText) as {
      supportedParameters: string[];
    };
    attestation.supportedParameters.push('temperature');
    input.catalogAttestationText = `${JSON.stringify(attestation, null, 2)}\n`;
    const campaign = input.campaign as {
      authority: { catalogAttestationSha256: string };
    };
    campaign.authority.catalogAttestationSha256 = createHash('sha256')
      .update(input.catalogAttestationText)
      .digest('hex');

    expect(() => validateEvidenceExtractionCampaign(input)).toThrow(
      'EVIDENCE_CAMPAIGN_CATALOG_ATTESTATION_MISMATCH',
    );
  });
});
