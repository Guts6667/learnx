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
import { validateEvidenceResearcherPanelCampaign } from '../src/lib/evidence-researcher-panel-campaign.ts';
import { validateEvidenceResearcherSonnetPanelCampaign } from '../src/lib/evidence-researcher-sonnet-panel-campaign.ts';
import { compileExecutableRubric } from '../src/lib/executable-rubric-engine.ts';
import { validateMechanicalOracle } from '../src/lib/executable-rubric-mechanical-oracle.ts';
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
      requestedRoute: error.requestedRoute,
      rawModelOutput: error.rawModelOutput,
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

const geminiCampaignFile =
  'gemini-evidence-researcher-panel.v1.3-v2.json';
const sonnetCampaignFile = 'sonnet-5-evidence-researcher-panel.v1.json';
const campaignFile = option('campaign') ?? geminiCampaignFile;
if (campaignFile !== geminiCampaignFile && campaignFile !== sonnetCampaignFile) {
  throw new Error('EVIDENCE_RESEARCHER_PANEL_CAMPAIGN_NOT_ALLOWLISTED');
}
const sonnetCampaignSelected = campaignFile === sonnetCampaignFile;
const paths = {
  attestation: resolve(
    sonnetCampaignSelected
      ? 'benchmarks/ai-correction/executable-rubric/sonnet-5-anthropic-attestation-2026-08-15.json'
      : 'benchmarks/ai-correction/executable-rubric/gemini-google-vertex-attestation-2026-08-14-reasoning.json',
  ),
  campaign: resolve(
    'benchmarks/ai-correction/executable-rubric',
    campaignFile,
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
const validationInput = {
  campaign: JSON.parse(campaignText) as unknown,
  catalogAttestationText: attestationText,
  rubric,
  rubricFileText: rubricText,
  semanticSelectionText,
  specText,
};
const campaign = sonnetCampaignSelected
  ? validateEvidenceResearcherSonnetPanelCampaign(validationInput)
  : validateEvidenceResearcherPanelCampaign(validationInput);
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
  providerName: string;
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
if (
  maximumAttemptsCostBound.maximumCampaignCostUsd >
    campaign.budgetProposal.hardCapUsd ||
  maximumAttemptsAdmissibleUnderHardCap <
    campaign.retryPolicy.maximumProviderAttempts
) {
  throw new Error('EVIDENCE_RESEARCHER_PANEL_ATTEMPT_CAP_EXCEEDS_BUDGET');
}

const campaignFingerprint = sha256(campaignText);
const tokenPrefix = sonnetCampaignSelected
  ? 'GO_EVIDENCE_RESEARCHER_SONNET5_PANEL'
  : 'GO_EVIDENCE_RESEARCHER_PANEL';
const exactOwnerGoToken = `${tokenPrefix}_${campaignFingerprint
  .slice(0, 16)
  .toUpperCase()}`;
const campaignArgument = `--campaign=${campaignFile}`;
const exactCommand = `pnpm ai:evidence:panel:validate -- ${campaignArgument} --execute --owner-go=${exactOwnerGoToken}`;
const validation = {
  authorization: {
    commandAfterSeparateOwnerApproval: exactCommand,
    exactToken: exactOwnerGoToken,
    status: 'NOT_GRANTED',
  },
  blockers: campaign.blockers,
  budgetProposal: campaign.budgetProposal,
  campaignId: campaign.campaignId,
  campaignSha256: campaignFingerprint,
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
      status: 'CONSISTENT',
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
  validationCommand: `pnpm ai:evidence:panel:validate -- ${campaignArgument}`,
};

if (!process.argv.includes('--execute')) {
  console.log(JSON.stringify(validation, null, 2));
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
    `benchmarks/ai-correction/results/evidence-researcher-panel/${runId}`,
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
    throw new Error('EVIDENCE_RESEARCHER_PANEL_RESUME_FILES_REQUIRED');
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
  if (resolve(option('resume-ledger') as string) !== ledgerPath) {
    await mkdir(dirname(ledgerPath), { recursive: true });
    await writeFile(ledgerPath, ledgerText, { flag: 'wx' });
  }
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
  corpus: semanticCorpus,
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
        return { ...providerResult, status: 'VALID' as const };
      } catch (error) {
        return normalizeError(error);
      }
    },
  },
  resume,
});

const finalAttempts = campaign.execution.caseIds.flatMap((caseId) =>
  Array.from({ length: campaign.execution.repetitionsPerCase }, (_, index) => {
    const cellKey = `${caseId}:${index + 1}`;
    return result.state.attempts
      .filter((attempt) => attempt.cellKey === cellKey)
      .at(-1);
  }).filter((attempt) => attempt !== undefined),
);
const validFinalAttempts = finalAttempts.filter(
  (attempt) => attempt.status === 'VALID' && attempt.output,
);
const elementComparisons = validFinalAttempts.flatMap((attempt) => {
  const caseItem = semanticCorpus.cases.find(
    ({ caseId }) => caseId === attempt.caseId,
  );
  if (!caseItem || !attempt.output) return [];
  return caseItem.expectedElements.map((expected) => ({
    actual: attempt.output?.elements.find(
      ({ elementKey }) => elementKey === expected.elementKey,
    )?.status,
    expected: expected.status,
  }));
});
const falseSupportedCount = elementComparisons.filter(
  ({ actual, expected }) => actual === 'SUPPORTED' && expected !== 'SUPPORTED',
).length;
const falseNotDemonstratedCount = elementComparisons.filter(
  ({ actual, expected }) =>
    actual === 'NOT_DEMONSTRATED' && expected !== 'NOT_DEMONSTRATED',
).length;
const variabilityCases = campaign.execution.caseIds.filter((caseId) => {
  const vectors = validFinalAttempts
    .filter((attempt) => attempt.caseId === caseId)
    .map((attempt) =>
      JSON.stringify(
        attempt.output?.elements.map(({ elementKey, status }) => ({
          elementKey,
          status,
        })),
      ),
    );
  return new Set(vectors).size > 1;
});
const totalActualCostUsd = result.state.attempts.reduce(
  (total, attempt) => total + (attempt.actualCostUsd ?? 0),
  0,
);
const summary = {
  atomicStatusAgreementRate:
    elementComparisons.length === 0
      ? 0
      : elementComparisons.filter(({ actual, expected }) => actual === expected)
          .length / elementComparisons.length,
  campaignId: campaign.campaignId,
  campaignSha256: campaignFingerprint,
  completedLogicalWorkflows: result.state.completedCellKeys.length,
  falseNotDemonstratedCount,
  falseSupportedCount,
  gatePassed:
    result.state.stoppedReason === null &&
    result.state.completedCellKeys.length ===
      campaign.execution.expectedLogicalWorkflows &&
    elementComparisons.length === 180 &&
    elementComparisons.filter(({ actual, expected }) => actual === expected)
      .length /
      elementComparisons.length >=
      campaign.gate.requirements.atomicStatusAgreementMinimum &&
    falseSupportedCount === campaign.gate.requirements.falseSupportedCount &&
    falseNotDemonstratedCount <=
      campaign.gate.requirements.falseNotDemonstratedCountMaximum &&
    variabilityCases.length / campaign.execution.caseIds.length <=
      campaign.gate.requirements.variabilityRateMaximum,
  providerAttempts: result.state.attempts.length,
  retries: result.state.attempts.length - finalAttempts.length,
  stoppedReason: result.state.stoppedReason,
  totalActualCostUsd,
  variabilityCases,
  variabilityRate: variabilityCases.length / campaign.execution.caseIds.length,
};

const reviewEntries = validFinalAttempts.map((attempt) => {
  const caseItem = semanticCorpus.cases.find(
    ({ caseId }) => caseId === attempt.caseId,
  );
  if (!caseItem || !attempt.output) {
    throw new Error('EVIDENCE_RESEARCHER_PANEL_REVIEW_OUTPUT_MISSING');
  }
  return {
    output: attempt.output,
    responseText: caseItem.responseText,
    reviewId: sha256(`${campaignFingerprint}:${attempt.cellKey}`).slice(0, 16),
    rubric: compiled.rubric,
    taskContext: semanticCorpus.task.context,
    taskPrompt: semanticCorpus.task.prompt,
  };
});
const reviewMapping = validFinalAttempts.map((attempt) => {
  const caseItem = semanticCorpus.cases.find(
    ({ caseId }) => caseId === attempt.caseId,
  );
  return {
    actualCostUsd: attempt.actualCostUsd,
    caseId: attempt.caseId,
    expectedElements: caseItem?.expectedElements,
    repetition: attempt.repetition,
    reviewId: sha256(`${campaignFingerprint}:${attempt.cellKey}`).slice(0, 16),
  };
});
const stateJson = `${JSON.stringify(result.state, null, 2)}\n`;
const ledgerText = result.ledger
  .map((event) => `${JSON.stringify(event)}\n`)
  .join('');
const phase1Text = `${JSON.stringify({ entries: reviewEntries }, null, 2)}\n`;
const mappingText = `${JSON.stringify({ entries: reviewMapping }, null, 2)}\n`;
await Promise.all([
  writeJsonAtomic(statePath, result.state),
  writeJsonAtomic(resolve(outputDirectory, 'summary.json'), summary),
  writeJsonAtomic(resolve(outputDirectory, 'blind-review.phase1.json'), {
    entries: reviewEntries,
  }),
  writeJsonAtomic(resolve(outputDirectory, 'blind-review.mapping.json'), {
    entries: reviewMapping,
  }),
  writeJsonAtomic(resolve(outputDirectory, 'artifact-hashes.json'), {
    campaignSha256: campaignFingerprint,
    catalogAttestationSha256: sha256(attestationText),
    ledgerFinalRecordHash: result.ledger.at(-1)?.recordHash ?? null,
    ledgerSha256: sha256(ledgerText),
    mappingSha256: sha256(mappingText),
    phase1Sha256: sha256(phase1Text),
    stateSha256: sha256(stateJson),
  }),
]);
console.log(JSON.stringify({ outputDirectory, summary }, null, 2));
