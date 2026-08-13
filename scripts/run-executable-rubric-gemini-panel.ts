import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { validateEvidenceExtractionCampaign } from '../src/lib/evidence-extraction-campaign.ts';
import { compileExecutableRubric } from '../src/lib/executable-rubric-engine.ts';
import { validateMechanicalOracle } from '../src/lib/executable-rubric-mechanical-oracle.ts';
import { validateExecutableRubricSemanticCorpus } from '../src/lib/executable-rubric-semantic-corpus.ts';
import {
  buildEvidenceResearcherPrompt,
  evidenceResearcherProtocolFingerprint,
} from '../src/lib/evidence-researcher-protocol.ts';

const paths = {
  attestation: resolve(
    'benchmarks/ai-correction/executable-rubric/gemini-google-vertex-attestation-2026-08-14.json',
  ),
  campaign: resolve(
    'benchmarks/ai-correction/executable-rubric/gemini-evidence-researcher-mini-panel.v1.json',
  ),
  mechanicalOracle: resolve(
    'benchmarks/ai-correction/executable-rubric/writing-fr-mechanical-oracle.v1.json',
  ),
  rubric: resolve(
    'benchmarks/ai-correction/executable-rubric/writing-recommendation-fr.v1.json',
  ),
  semanticCorpus: resolve(
    'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v1.json',
  ),
  spec: resolve('docs/V4_EXECUTABLE_RUBRIC_ENGINE_SPEC.md'),
};

const [
  attestationText,
  campaignText,
  mechanicalOracleText,
  rubricText,
  semanticCorpusText,
  specText,
] = await Promise.all([
  readFile(paths.attestation, 'utf8'),
  readFile(paths.campaign, 'utf8'),
  readFile(paths.mechanicalOracle, 'utf8'),
  readFile(paths.rubric, 'utf8'),
  readFile(paths.semanticCorpus, 'utf8'),
  readFile(paths.spec, 'utf8'),
]);

const rubric = JSON.parse(rubricText) as unknown;
const semanticCorpus = JSON.parse(semanticCorpusText) as unknown;
const compiled = compileExecutableRubric(rubric);
const campaign = validateEvidenceExtractionCampaign({
  campaign: JSON.parse(campaignText) as unknown,
  catalogAttestationText: attestationText,
  rubric,
  rubricFileText: rubricText,
  semanticCorpusText,
  specText,
});
const validatedSemanticCorpus = validateExecutableRubricSemanticCorpus({
  compiled,
  corpus: semanticCorpus,
});
const mechanicalOracle = validateMechanicalOracle({
  compiled,
  corpus: JSON.parse(mechanicalOracleText) as unknown,
});
const prompts = validatedSemanticCorpus.cases.flatMap((caseItem) =>
  ([1, 2] as const).map((repetition) => ({
    caseId: caseItem.caseId,
    prompt: buildEvidenceResearcherPrompt({
      compiled,
      responseText: caseItem.responseText,
      taskContext: validatedSemanticCorpus.task.context,
      taskPrompt: validatedSemanticCorpus.task.prompt,
    }),
    repetition,
  })),
);

if (process.argv.includes('--execute')) {
  throw new Error(
    'EVIDENCE_RESEARCHER_EXECUTION_BLOCKED_NEON_BUDGET_OWNER_AUTHORIZATION_REQUIRED',
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
      promptCharacterRange: {
        maximum: Math.max(...prompts.map(({ prompt }) => prompt.length)),
        minimum: Math.min(...prompts.map(({ prompt }) => prompt.length)),
      },
      promptFingerprint: evidenceResearcherProtocolFingerprint(),
      providerRoute: campaign.researcher.providerRoute,
      semanticCases: validatedSemanticCorpus.cases.length,
    },
    null,
    2,
  ),
);
