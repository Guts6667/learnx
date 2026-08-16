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
import {
  boundedReasoningUsageError,
  summarizeSonnetBoundedGateMetrics,
  validateEvidenceResearcherSonnetBoundedGateCampaign,
} from '../src/lib/evidence-researcher-sonnet-bounded-gate-campaign.ts';
import { compileExecutableRubric } from '../src/lib/executable-rubric-engine.ts';
import { validateExecutableRubricSemanticSelection } from '../src/lib/executable-rubric-semantic-selection.ts';
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
      rawModelOutput: error.rawModelOutput,
      requestedRoute: error.requestedRoute,
      status: 'ERROR' as const,
    };
  }
  throw error;
}

const base = resolve('benchmarks/ai-correction/executable-rubric');
const paths = {
  attestation: resolve(
    base,
    'sonnet-5-anthropic-bounded-reasoning-attestation-2026-08-16.json',
  ),
  campaign: resolve(
    base,
    'sonnet-5-evidence-researcher-bounded-four-case.v1.json',
  ),
  rubric: resolve(base, 'writing-recommendation-fr.v1.json'),
  selection: resolve(base, 'writing-fr-semantic-development.v2.manifest.json'),
  sourceV1: resolve(base, 'writing-fr-semantic-development.v1.json'),
  sourceV2: resolve(base, 'writing-fr-semantic-three-case-development.v2.json'),
  spec: resolve('docs/V4_EXECUTABLE_RUBRIC_ENGINE_SPEC.md'),
};
const [
  attestationText,
  campaignText,
  rubricText,
  selectionText,
  sourceV1Text,
  sourceV2Text,
  specText,
] = await Promise.all([
  readFile(paths.attestation, 'utf8'),
  readFile(paths.campaign, 'utf8'),
  readFile(paths.rubric, 'utf8'),
  readFile(paths.selection, 'utf8'),
  readFile(paths.sourceV1, 'utf8'),
  readFile(paths.sourceV2, 'utf8'),
  readFile(paths.spec, 'utf8'),
]);
const rubric = JSON.parse(rubricText) as unknown;
const compiled = compileExecutableRubric(rubric);
const corpus = validateExecutableRubricSemanticSelection({
  compiled,
  selection: JSON.parse(selectionText) as unknown,
  sources: [
    {
      path: 'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v1.json',
      text: sourceV1Text,
    },
    {
      path: 'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-three-case-development.v2.json',
      text: sourceV2Text,
    },
  ],
});
const campaign = validateEvidenceResearcherSonnetBoundedGateCampaign({
  campaign: JSON.parse(campaignText) as unknown,
  catalogAttestationText: attestationText,
  rubric,
  rubricFileText: rubricText,
  semanticSelectionText: selectionText,
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
  if (!caseItem) throw new Error('EVIDENCE_SONNET_BOUNDED_GATE_CASE_NOT_FOUND');
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
  maximumPromptUtf8Bytes: Math.max(
    ...prompts.map((prompt) => Buffer.byteLength(prompt)),
  ),
  maximumProviderAttempts: campaign.retryPolicy.maximumProviderAttempts,
  outputTokenLimit: campaign.researcher.requestProfile.totalOutputTokenLimit,
  promptUsdPerToken: attestation.pricing.promptUsdPerToken,
  schemaUtf8Bytes: Buffer.byteLength(JSON.stringify(researcherJsonSchema())),
  transportAllowanceTokens: 2_048,
});
if (costBound.maximumCampaignCostUsd > campaign.budgetProposal.hardCapUsd) {
  throw new Error('EVIDENCE_SONNET_BOUNDED_GATE_BUDGET_PREFLIGHT_INCONSISTENT');
}
const campaignFingerprint = sha256(campaignText);
const exactOwnerGoToken = `GO_EVIDENCE_RESEARCHER_SONNET5_BOUNDED_${campaignFingerprint
  .slice(0, 16)
  .toUpperCase()}`;
const exactCommand = `pnpm ai:evidence:sonnet:gate:validate -- --execute --owner-go=${exactOwnerGoToken}`;

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
    `benchmarks/ai-correction/results/evidence-researcher-sonnet5-bounded-gate/${runId}`,
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
    throw new Error('EVIDENCE_SONNET_BOUNDED_GATE_RESUME_FILES_REQUIRED');
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
      resolve(
        outputDirectory,
        'raw-received',
        `${receipt.idempotencyKey}.json`,
      ),
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
        const usageError = boundedReasoningUsageError({
          reasoningBudgetTokens:
            campaign.researcher.requestProfile.reasoning.budgetTokens,
          totalOutputTokenLimit:
            campaign.researcher.requestProfile.totalOutputTokenLimit,
          usage: providerResult.usage,
        });
        if (usageError) {
          return {
            errorCode: usageError,
            latencyMs: providerResult.latencyMs,
            modelSnapshot: providerResult.modelSnapshot,
            observedProvider: providerResult.observedProvider,
            providerRequestId: providerResult.providerRequestId,
            providerRoute: providerResult.providerRoute,
            rawModelOutput: providerResult.rawModelOutput,
            requestedRoute: providerResult.requestedRoute,
            status: 'ERROR' as const,
            usage: providerResult.usage,
          };
        }
        return { ...providerResult, status: 'VALID' as const };
      } catch (error) {
        return normalizeError(error);
      }
    },
  },
  resume,
  stopOnOracleDisagreement: campaign.gate.requirements.stopOnOracleDisagreement,
});
const ledgerText = result.ledger
  .map((event) => `${JSON.stringify(event)}\n`)
  .join('');
const stateText = `${JSON.stringify(result.state, null, 2)}\n`;
const attempts = result.state.attempts;
const gateMetrics = summarizeSonnetBoundedGateMetrics({
  attempts,
  cases: corpus.cases.filter((caseItem) =>
    campaign.execution.caseIds.includes(
      caseItem.caseId as (typeof campaign.execution.caseIds)[number],
    ),
  ),
  expectedLogicalWorkflows: campaign.execution.expectedLogicalWorkflows,
  expectedObservedProvider: campaign.researcher.expectedObservedProvider,
  reasoningBudgetTokens:
    campaign.researcher.requestProfile.reasoning.budgetTokens,
  requestedRoute: campaign.researcher.requestedRoute,
  totalOutputTokenLimit:
    campaign.researcher.requestProfile.totalOutputTokenLimit,
});
const gatePassed =
  result.state.stoppedReason === null &&
  result.state.completedCellKeys.length === 4 &&
  attempts.every(
    ({ oracleAgreement, status, usage }) =>
      status === 'VALID' &&
      oracleAgreement &&
      usage !== undefined &&
      boundedReasoningUsageError({
        reasoningBudgetTokens:
          campaign.researcher.requestProfile.reasoning.budgetTokens,
        totalOutputTokenLimit:
          campaign.researcher.requestProfile.totalOutputTokenLimit,
        usage,
      }) === undefined,
  );
const summary = {
  campaignId: campaign.campaignId,
  campaignSha256: campaignFingerprint,
  completedLogicalWorkflows: result.state.completedCellKeys.length,
  gatePassed,
  gateMetrics,
  providerAttempts: attempts.length,
  reasoningBudgetCompliant: attempts.every(
    ({ usage }) =>
      usage !== undefined &&
      usage.reasoningTokens <=
        campaign.researcher.requestProfile.reasoning.budgetTokens,
  ),
  stoppedReason: result.state.stoppedReason,
  totalActualCostUsd: attempts.reduce(
    (total, attempt) => total + (attempt.actualCostUsd ?? 0),
    0,
  ),
  visibleOutputPresent: attempts.every(
    ({ usage }) => usage !== undefined && usage.visibleOutputTokens > 0,
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
