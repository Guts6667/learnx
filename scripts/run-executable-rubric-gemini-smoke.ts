import { createHash } from 'node:crypto';
import {
  appendFile,
  mkdir,
  readFile,
  rename,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

import {
  calculateEvidenceResearcherCostBound,
  validateEvidenceExtractionCampaign,
} from '../src/lib/evidence-extraction-campaign.ts';
import {
  CorrectionModelOutputError,
  CorrectionProviderError,
  getCorrectionProviderAdapter,
} from '../src/lib/ai-correction-provider-adapters.ts';
import { compileExecutableRubric } from '../src/lib/executable-rubric-engine.ts';
import { validateExecutableRubricSemanticCorpus } from '../src/lib/executable-rubric-semantic-corpus.ts';
import {
  buildEvidenceResearcherPrompt,
  researcherJsonSchema,
} from '../src/lib/evidence-researcher-protocol.ts';
import {
  runEvidenceResearcherSmoke,
  type EvidenceResearcherSmokeLedgerEvent,
  type EvidenceResearcherSmokeState,
} from '../src/server/ai/evidence-researcher-smoke.ts';

const option = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
};

const campaignFileName =
  option('campaign') ?? 'gemini-evidence-researcher-smoke.v1.3.json';
const allowedCampaignFileNames = new Set([
  'gemini-evidence-researcher-smoke.v1.3-three-case.json',
  'gemini-evidence-researcher-smoke.v1.3-three-case-v2.json',
  'gemini-evidence-researcher-smoke.v1.3.json',
]);
if (
  basename(campaignFileName) !== campaignFileName ||
  !allowedCampaignFileNames.has(campaignFileName)
) {
  throw new Error('EVIDENCE_RESEARCHER_SMOKE_CAMPAIGN_NOT_ALLOWED');
}

const paths = {
  attestation: resolve(
    'benchmarks/ai-correction/executable-rubric/gemini-google-vertex-attestation-2026-08-14-reasoning.json',
  ),
  campaign: resolve(
    'benchmarks/ai-correction/executable-rubric',
    campaignFileName,
  ),
  corpus: resolve(
    'benchmarks/ai-correction/executable-rubric',
    campaignFileName ===
      'gemini-evidence-researcher-smoke.v1.3-three-case-v2.json'
      ? 'writing-fr-semantic-three-case-development.v2.json'
      : 'writing-fr-semantic-development.v1.json',
  ),
  rubric: resolve(
    'benchmarks/ai-correction/executable-rubric/writing-recommendation-fr.v1.json',
  ),
  spec: resolve('docs/V4_EXECUTABLE_RUBRIC_ENGINE_SPEC.md'),
};

const sha256 = (value: string | Buffer): string =>
  createHash('sha256').update(value).digest('hex');

function ownerGoToken(campaignText: string): string {
  return `GO_EVIDENCE_RESEARCHER_SMOKE_${sha256(campaignText)
    .slice(0, 16)
    .toUpperCase()}`;
}

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
      rawModelOutput: error.rawModelOutput,
      requestedRoute: error.requestedRoute,
      status: 'ERROR' as const,
    };
  }
  throw error;
}

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
const campaign = validateEvidenceExtractionCampaign({
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
  providerName: string;
};
const exactOwnerGoToken = ownerGoToken(campaignText);
const campaignArgument =
  campaignFileName === 'gemini-evidence-researcher-smoke.v1.3.json'
    ? ''
    : ` --campaign=${campaignFileName}`;
const exactCommand = `pnpm ai:evidence:smoke --${campaignArgument} --execute --owner-go=${exactOwnerGoToken}`;
const maximumPromptUtf8Bytes = Math.max(
  ...campaign.smokeProposal.caseIds.map((caseId) => {
    const caseItem = corpus.cases.find((entry) => entry.caseId === caseId);
    if (!caseItem) throw new Error('EVIDENCE_RESEARCHER_SMOKE_CASE_NOT_FOUND');
    return Buffer.byteLength(
      buildEvidenceResearcherPrompt({
        canary: campaign.smokeProposal.securityCanary,
        compiled,
        responseText: caseItem.responseText,
        taskContext: corpus.task.context,
        taskPrompt: corpus.task.prompt,
      }),
    );
  }),
);
const costBound = calculateEvidenceResearcherCostBound({
  completionUsdPerToken: attestation.pricing.completionUsdPerToken,
  maximumPromptUtf8Bytes,
  maximumProviderAttempts: campaign.smokeProposal.maximumProviderAttempts,
  outputTokenLimit: campaign.researcher.requestProfile.totalOutputTokenLimit,
  promptUsdPerToken: attestation.pricing.promptUsdPerToken,
  schemaUtf8Bytes: Buffer.byteLength(JSON.stringify(researcherJsonSchema())),
  transportAllowanceTokens:
    campaign.smokeProposal.inputTokenUpperBound.transportAllowanceTokens,
});

if (!process.argv.includes('--execute')) {
  console.log(
    JSON.stringify(
      {
        authorization: {
          commandAfterSeparateOwnerApproval: exactCommand,
          exactToken: exactOwnerGoToken,
          status: 'NOT_GRANTED',
        },
        costBound,
        hardCapUsd: campaign.smokeProposal.hardCapUsd,
        maximumProviderAttempts: campaign.smokeProposal.maximumProviderAttempts,
        mode: 'VALIDATE_ONLY',
        modelId: campaign.researcher.modelId,
        modelSnapshot: campaign.researcher.modelSnapshot,
        providerRoute: campaign.researcher.providerRoute,
        requestProfile: campaign.researcher.requestProfile,
        retryPolicy: campaign.smokeProposal.retryPolicy,
        smokeCaseIds: campaign.smokeProposal.caseIds,
        stopOnFirstFailure: campaign.smokeProposal.stopOnFirstFailure,
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
    `benchmarks/ai-correction/results/evidence-researcher/${runId}`,
);
const statePath = resolve(outputDirectory, 'state.json');
const ledgerPath = resolve(outputDirectory, 'budget-ledger.jsonl');
let resume:
  | {
      ledger: EvidenceResearcherSmokeLedgerEvent[];
      state: EvidenceResearcherSmokeState;
    }
  | undefined;
if (option('resume-state') || option('resume-ledger')) {
  if (!option('resume-state') || !option('resume-ledger')) {
    throw new Error('EVIDENCE_RESEARCHER_SMOKE_RESUME_FILES_REQUIRED');
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
      .map((line) => JSON.parse(line) as EvidenceResearcherSmokeLedgerEvent),
    state: JSON.parse(stateText) as EvidenceResearcherSmokeState,
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
const result = await runEvidenceResearcherSmoke({
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
        return { ...providerResult, status: 'VALID' as const };
      } catch (error) {
        return normalizeError(error);
      }
    },
  },
  providerName: attestation.providerName,
  resume,
});
const stateJson = `${JSON.stringify(result.state, null, 2)}\n`;
const ledgerText = result.ledger
  .map((event) => `${JSON.stringify(event)}\n`)
  .join('');
await Promise.all([
  writeJsonAtomic(statePath, result.state),
  writeJsonAtomic(resolve(outputDirectory, 'artifact-hashes.json'), {
    campaignSha256: sha256(campaignText),
    catalogAttestationSha256: sha256(attestationText),
    ledgerFinalRecordHash: result.ledger.at(-1)?.recordHash ?? null,
    ledgerSha256: sha256(ledgerText),
    stateSha256: sha256(stateJson),
  }),
]);
console.log(
  JSON.stringify(
    {
      completedCaseIds: result.state.completedCaseIds,
      outputDirectory,
      stoppedReason: result.state.stoppedReason,
    },
    null,
    2,
  ),
);
