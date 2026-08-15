import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { calculateEvidenceResearcherCostBound } from '../src/lib/evidence-extraction-campaign.ts';
import { validateEvidenceResearcherPanelCampaign } from '../src/lib/evidence-researcher-panel-campaign.ts';
import { compileExecutableRubric } from '../src/lib/executable-rubric-engine.ts';
import { validateMechanicalOracle } from '../src/lib/executable-rubric-mechanical-oracle.ts';
import { validateExecutableRubricSemanticSelection } from '../src/lib/executable-rubric-semantic-selection.ts';
import {
  buildEvidenceResearcherPrompt,
  evidenceResearcherProtocolFingerprint,
  researcherJsonSchema,
} from '../src/lib/evidence-researcher-protocol.ts';

const paths = {
  attestation: resolve(
    'benchmarks/ai-correction/executable-rubric/gemini-google-vertex-attestation-2026-08-14-reasoning.json',
  ),
  campaign: resolve(
    'benchmarks/ai-correction/executable-rubric/gemini-evidence-researcher-panel.v1.3-v2.json',
  ),
  historicalCorpus: resolve(
    'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v1.json',
  ),
  mechanicalOracle: resolve(
    'benchmarks/ai-correction/executable-rubric/writing-fr-mechanical-oracle.v1.json',
  ),
  revisedCorpus: resolve(
    'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-three-case-development.v2.json',
  ),
  rubric: resolve(
    'benchmarks/ai-correction/executable-rubric/writing-recommendation-fr.v1.json',
  ),
  semanticSelection: resolve(
    'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v2.manifest.json',
  ),
  spec: resolve('docs/V4_EXECUTABLE_RUBRIC_ENGINE_SPEC.md'),
};

const [
  attestationText,
  campaignText,
  historicalCorpusText,
  mechanicalOracleText,
  revisedCorpusText,
  rubricText,
  semanticSelectionText,
  specText,
] = await Promise.all([
  readFile(paths.attestation, 'utf8'),
  readFile(paths.campaign, 'utf8'),
  readFile(paths.historicalCorpus, 'utf8'),
  readFile(paths.mechanicalOracle, 'utf8'),
  readFile(paths.revisedCorpus, 'utf8'),
  readFile(paths.rubric, 'utf8'),
  readFile(paths.semanticSelection, 'utf8'),
  readFile(paths.spec, 'utf8'),
]);

const rubric = JSON.parse(rubricText) as unknown;
const compiled = compileExecutableRubric(rubric);
const campaign = validateEvidenceResearcherPanelCampaign({
  campaign: JSON.parse(campaignText) as unknown,
  catalogAttestationText: attestationText,
  rubric,
  rubricFileText: rubricText,
  semanticSelectionText,
  specText,
});
const semanticCorpus = validateExecutableRubricSemanticSelection({
  compiled,
  selection: JSON.parse(semanticSelectionText) as unknown,
  sources: [
    {
      path: 'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v1.json',
      text: historicalCorpusText,
    },
    {
      path: 'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-three-case-development.v2.json',
      text: revisedCorpusText,
    },
  ],
});
const mechanicalOracle = validateMechanicalOracle({
  compiled,
  corpus: JSON.parse(mechanicalOracleText) as unknown,
});
const prompts = semanticCorpus.cases.flatMap((caseItem) =>
  ([1, 2] as const).map((repetition) => ({
    caseId: caseItem.caseId,
    prompt: buildEvidenceResearcherPrompt({
      canary: campaign.protocol.securityCanary,
      compiled,
      responseText: caseItem.responseText,
      taskContext: semanticCorpus.task.context,
      taskPrompt: semanticCorpus.task.prompt,
    }),
    repetition,
  })),
);
if (
  prompts.length !== campaign.execution.expectedLogicalWorkflows ||
  JSON.stringify(semanticCorpus.cases.map(({ caseId }) => caseId)) !==
    JSON.stringify(campaign.execution.caseIds)
) {
  throw new Error('EVIDENCE_RESEARCHER_PANEL_CASE_COVERAGE_MISMATCH');
}
const promptUtf8Bytes = prompts.map(({ prompt }) => Buffer.byteLength(prompt));
const schemaUtf8Bytes = Buffer.byteLength(JSON.stringify(researcherJsonSchema()));
const attestation = JSON.parse(attestationText) as {
  pricing: {
    completionUsdPerToken: number;
    promptUsdPerToken: number;
  };
};
const initialCallsCostBound = calculateEvidenceResearcherCostBound({
  completionUsdPerToken: attestation.pricing.completionUsdPerToken,
  maximumPromptUtf8Bytes: Math.max(...promptUtf8Bytes),
  maximumProviderAttempts: campaign.execution.expectedLogicalWorkflows,
  outputTokenLimit: campaign.researcher.requestProfile.totalOutputTokenLimit,
  promptUsdPerToken: attestation.pricing.promptUsdPerToken,
  schemaUtf8Bytes,
  transportAllowanceTokens: 2_048,
});
const maximumAttemptsCostBound = calculateEvidenceResearcherCostBound({
  completionUsdPerToken: attestation.pricing.completionUsdPerToken,
  maximumPromptUtf8Bytes: Math.max(...promptUtf8Bytes),
  maximumProviderAttempts: campaign.retryPolicy.maximumProviderAttempts,
  outputTokenLimit: campaign.researcher.requestProfile.totalOutputTokenLimit,
  promptUsdPerToken: attestation.pricing.promptUsdPerToken,
  schemaUtf8Bytes,
  transportAllowanceTokens: 2_048,
});
if (
  initialCallsCostBound.maximumCampaignCostUsd >
  campaign.budgetProposal.hardCapUsd
) {
  throw new Error('EVIDENCE_RESEARCHER_PANEL_INITIAL_CALLS_EXCEED_HARD_CAP');
}
const maximumAttemptsAdmissibleUnderHardCap = Math.floor(
  campaign.budgetProposal.hardCapUsd /
    maximumAttemptsCostBound.maximumCostPerAttemptUsd,
);

if (process.argv.includes('--execute')) {
  throw new Error(
    'EVIDENCE_RESEARCHER_PANEL_EXECUTION_BLOCKED_FINANCE_AND_OWNER_AUTHORIZATION_REQUIRED',
  );
}

console.log(
  JSON.stringify(
    {
      blockers: campaign.blockers,
      budgetProposal: campaign.budgetProposal,
      campaignId: campaign.campaignId,
      campaignStatus: campaign.status,
      executionMode: 'VALIDATE_ONLY',
      feature: campaign.feature,
      logicalWorkflows: prompts.length,
      mechanicalOracleCases: mechanicalOracle.cases.length,
      modelSnapshot: campaign.researcher.modelSnapshot,
      panelProposal: {
        budgetPreflight: {
          initialCallsCostBound,
          maximumAttemptsAdmissibleUnderHardCap,
          maximumAttemptsCostBound,
          status:
            maximumAttemptsCostBound.maximumCampaignCostUsd <=
            campaign.budgetProposal.hardCapUsd
              ? 'CONSISTENT'
              : 'FINANCE_ARBITRATION_REQUIRED_RETRY_CAPACITY_NOT_GUARANTEED',
        },
        execution: campaign.execution,
        retryPolicy: campaign.retryPolicy,
        schemaUtf8Bytes,
      },
      panelStatus: 'BLOCKED_PENDING_FINANCE_AND_OWNER_AUTHORIZATION',
      promptCharacterRange: {
        maximum: Math.max(...prompts.map(({ prompt }) => prompt.length)),
        minimum: Math.min(...prompts.map(({ prompt }) => prompt.length)),
      },
      promptFingerprint: evidenceResearcherProtocolFingerprint(),
      routeIdentity: {
        expectedObservedProvider: campaign.researcher.expectedObservedProvider,
        requestedRoute: campaign.researcher.requestedRoute,
        version: campaign.researcher.routeObservability.version,
      },
      semanticCases: semanticCorpus.cases.length,
      validationCommand: 'pnpm ai:evidence:panel:validate',
    },
    null,
    2,
  ),
);
