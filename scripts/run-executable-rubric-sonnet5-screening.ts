import { createHash } from 'node:crypto';
import {
  appendFile,
  mkdir,
  readFile,
  rename,
  writeFile,
} from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  CorrectionModelOutputError,
  CorrectionProviderError,
  getCorrectionProviderAdapter,
} from '../src/lib/ai-correction-provider-adapters.ts';
import { calculateEvidenceResearcherCostBound } from '../src/lib/evidence-extraction-campaign.ts';
import { validateEvidenceResearcherScreeningCampaign } from '../src/lib/evidence-researcher-screening-campaign.ts';
import { compileExecutableRubric } from '../src/lib/executable-rubric-engine.ts';
import { validateExecutableRubricSemanticCorpus } from '../src/lib/executable-rubric-semantic-corpus.ts';
import {
  buildEvidenceResearcherPrompt,
  evidenceResearcherProtocolFingerprint,
  researcherJsonSchema,
} from '../src/lib/evidence-researcher-protocol.ts';
import {
  runEvidenceResearcherPanel,
  type EvidenceResearcherPanelLedgerEvent,
  type EvidenceResearcherPanelState,
} from '../src/server/ai/evidence-researcher-panel.ts';

const option = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
};
const sha256 = (value: string | Buffer): string =>
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

function normalizeError(error: unknown) {
  if (error instanceof CorrectionModelOutputError) {
    return {
      errorCode: error.message,
      latencyMs: error.latencyMs ?? 0,
      modelSnapshot: error.modelSnapshot,
      observedProvider: error.observedProvider,
      providerRequestId: error.providerRequestId,
      providerRoute: error.providerRoute,
      rawModelOutput: error.rawModelOutput,
      requestedRoute: error.requestedRoute,
      status: 'INVALID' as const,
      usage: error.usage,
    };
  }
  if (error instanceof CorrectionProviderError) {
    return {
      errorCode:
        error.message === 'PROVIDER_HTTP_ERROR' && error.status !== undefined
          ? `PROVIDER_HTTP_${error.status}`
          : error.message,
      latencyMs: error.latencyMs ?? 0,
      modelSnapshot: error.modelSnapshot,
      observedProvider: error.observedProvider,
      providerRequestId: error.providerRequestId,
      providerRoute: error.providerRoute,
      requestedRoute: error.requestedRoute,
      status: 'ERROR' as const,
    };
  }
  throw error;
}

const paths = {
  attestation: resolve(
    'benchmarks/ai-correction/executable-rubric/sonnet-5-anthropic-attestation-2026-08-15.json',
  ),
  campaign: resolve(
    'benchmarks/ai-correction/executable-rubric/sonnet-5-evidence-researcher-screening.v1.json',
  ),
  corpus: resolve(
    'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-three-case-development.v2.json',
  ),
  rubric: resolve(
    'benchmarks/ai-correction/executable-rubric/writing-recommendation-fr.v1.json',
  ),
  spec: resolve('docs/V4_EXECUTABLE_RUBRIC_ENGINE_SPEC.md'),
};
const [attestationText, campaignText, corpusText, rubricText, specText] =
  await Promise.all([
    readFile(paths.attestation, 'utf8'),
    readFile(paths.campaign, 'utf8'),
    readFile(paths.corpus, 'utf8'),
    readFile(paths.rubric, 'utf8'),
    readFile(paths.spec, 'utf8'),
  ]);
const rubric = JSON.parse(rubricText) as unknown;
const compiled = compileExecutableRubric(rubric);
const corpus = validateExecutableRubricSemanticCorpus({
  compiled,
  corpus: JSON.parse(corpusText) as unknown,
});
const campaign = validateEvidenceResearcherScreeningCampaign({
  campaign: JSON.parse(campaignText) as unknown,
  catalogAttestationText: attestationText,
  rubric,
  rubricFileText: rubricText,
  semanticCorpusText: corpusText,
  specText,
});
const attestation = JSON.parse(attestationText) as {
  pricing: {
    completionUsdPerToken: number;
    promptUsdPerToken: number;
  };
};
const prompts = campaign.execution.caseIds.map((caseId) => {
  const caseItem = corpus.cases.find((entry) => entry.caseId === caseId);
  if (!caseItem) throw new Error('EVIDENCE_SCREENING_CASE_NOT_FOUND');
  return buildEvidenceResearcherPrompt({
    canary: campaign.protocol.securityCanary,
    compiled,
    responseText: caseItem.responseText,
    taskContext: corpus.task.context,
    taskPrompt: corpus.task.prompt,
  });
});
const costBound = calculateEvidenceResearcherCostBound({
  completionUsdPerToken: attestation.pricing.completionUsdPerToken,
  maximumPromptUtf8Bytes: Math.max(...prompts.map((prompt) => Buffer.byteLength(prompt))),
  maximumProviderAttempts: campaign.retryPolicy.maximumProviderAttempts,
  outputTokenLimit: campaign.researcher.requestProfile.totalOutputTokenLimit,
  promptUsdPerToken: attestation.pricing.promptUsdPerToken,
  schemaUtf8Bytes: Buffer.byteLength(JSON.stringify(researcherJsonSchema())),
  transportAllowanceTokens: 2_048,
});
if (costBound.maximumCampaignCostUsd > campaign.budgetProposal.hardCapUsd) {
  throw new Error('EVIDENCE_SCREENING_BUDGET_PREFLIGHT_INCONSISTENT');
}
const campaignFingerprint = sha256(campaignText);
const exactOwnerGoToken = `GO_EVIDENCE_RESEARCHER_SONNET5_${campaignFingerprint
  .slice(0, 16)
  .toUpperCase()}`;
const exactCommand = `pnpm ai:evidence:screening:validate -- --execute --owner-go=${exactOwnerGoToken}`;

if (!process.argv.includes('--execute')) {
  console.log(
    JSON.stringify(
      {
        authorization: {
          commandAfterSeparateOwnerApproval: exactCommand,
          exactToken: exactOwnerGoToken,
          status: 'NOT_GRANTED',
        },
        budgetProposal: campaign.budgetProposal,
        campaignId: campaign.campaignId,
        campaignSha256: campaignFingerprint,
        costBound,
        execution: campaign.execution,
        mode: 'VALIDATE_ONLY',
        promptFingerprint: evidenceResearcherProtocolFingerprint(),
        researcher: campaign.researcher,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (option('owner-go') !== exactOwnerGoToken) {
  throw new Error(`OWNER_GO_REQUIRED_USE_EXACT_TOKEN_${exactOwnerGoToken}`);
}
const apiKey = process.env.OPENROUTER_API_KEY?.trim();
if (!apiKey) throw new Error('OPENROUTER_API_KEY_REQUIRED');
const runId =
  option('run-id') ?? new Date().toISOString().replaceAll(/[:.]/gu, '-');
const outputDirectory = resolve(
  option('output-dir') ??
    `benchmarks/ai-correction/results/evidence-researcher-screening/${runId}`,
);
const statePath = resolve(outputDirectory, 'state.json');
const ledgerPath = resolve(outputDirectory, 'budget-ledger.jsonl');
let resume:
  | {
      ledger: EvidenceResearcherPanelLedgerEvent[];
      state: EvidenceResearcherPanelState;
    }
  | undefined;
if (option('resume-state') || option('resume-ledger')) {
  if (!option('resume-state') || !option('resume-ledger')) {
    throw new Error('EVIDENCE_SCREENING_RESUME_FILES_REQUIRED');
  }
  const [stateText, ledgerText] = await Promise.all([
    readFile(resolve(option('resume-state') as string), 'utf8'),
    readFile(resolve(option('resume-ledger') as string), 'utf8'),
  ]);
  resume = {
    ledger: ledgerText
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as EvidenceResearcherPanelLedgerEvent),
    state: JSON.parse(stateText) as EvidenceResearcherPanelState,
  };
}
const adapter = getCorrectionProviderAdapter(
  campaign.researcher.requestProfile.adapter,
);
let persistedLedgerEvents = resume?.ledger.length ?? 0;
const result = await runEvidenceResearcherPanel({
  campaign,
  campaignFileText: campaignText,
  compiled,
  completionUsdPerToken: attestation.pricing.completionUsdPerToken,
  corpus,
  onProgress: async ({ ledger, state }) => {
    const additions = ledger.slice(persistedLedgerEvents);
    if (additions.length > 0) {
      await mkdir(dirname(ledgerPath), { recursive: true });
      await appendFile(
        ledgerPath,
        additions.map((event) => `${JSON.stringify(event)}\n`).join(''),
        'utf8',
      );
      persistedLedgerEvents = ledger.length;
    }
    await writeJsonAtomic(statePath, state);
  },
  onRawReceived: async (receipt) => {
    await writeJsonExclusive(
      resolve(outputDirectory, 'raw-received', `${receipt.idempotencyKey}.json`),
      receipt,
    );
  },
  promptUsdPerToken: attestation.pricing.promptUsdPerToken,
  provider: {
    async execute({ idempotencyKey, prompt }) {
      try {
        const providerResult = await adapter.execute({
          apiKey,
          idempotencyKey,
          jsonSchema: researcherJsonSchema(),
          messages: [{ content: prompt, role: 'system' }],
          modelId: campaign.researcher.modelId,
          profile: campaign.researcher.requestProfile,
        });
        return { ...providerResult, status: 'VALID' as const };
      } catch (error) {
        return normalizeError(error);
      }
    },
  },
  resume,
});
const ledgerText = result.ledger.map((event) => `${JSON.stringify(event)}\n`).join('');
const stateText = `${JSON.stringify(result.state, null, 2)}\n`;
const summary = {
  campaignId: campaign.campaignId,
  campaignSha256: campaignFingerprint,
  completedLogicalWorkflows: result.state.completedCellKeys.length,
  gatePassed:
    result.state.stoppedReason === null &&
    result.state.completedCellKeys.length === 3 &&
    result.state.attempts.every(
      ({ oracleAgreement, status }) => status === 'VALID' && oracleAgreement,
    ),
  providerAttempts: result.state.attempts.length,
  stoppedReason: result.state.stoppedReason,
  totalActualCostUsd: result.state.attempts.reduce(
    (total, attempt) => total + (attempt.actualCostUsd ?? 0),
    0,
  ),
};
await Promise.all([
  writeJsonAtomic(statePath, result.state),
  writeJsonAtomic(resolve(outputDirectory, 'summary.json'), summary),
  writeJsonAtomic(resolve(outputDirectory, 'artifact-hashes.json'), {
    campaignSha256: campaignFingerprint,
    catalogAttestationSha256: sha256(attestationText),
    ledgerFinalRecordHash: result.ledger.at(-1)?.recordHash ?? null,
    ledgerSha256: sha256(ledgerText),
    stateSha256: sha256(stateText),
  }),
]);
console.log(JSON.stringify({ outputDirectory, summary }, null, 2));
