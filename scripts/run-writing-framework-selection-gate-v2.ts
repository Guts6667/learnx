import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  buildWritingFrameworkGatePackage,
  FileWritingFrameworkGateStore,
  runWritingFrameworkSelectionGateLive,
} from '../src/server/ai/writing-framework-selection-gate-runner-v2.js';
import { OpenRouterWritingFrameworkGateProvider } from '../src/server/ai/writing-framework-selection-openrouter-provider.js';

const candidates = {
  'gemini-3.6': {
    dossierPath:
      'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-freeze.v1.json',
    financePath:
      'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-finance-envelope.approved.v1.json',
    outputSlug: 'writing-framework-selection-gemini36-v2',
  },
  'sonnet-5': {
    dossierPath:
      'benchmarks/ai-correction/executable-rubric/writing-framework-selection-sonnet-5-freeze.v1.json',
    financePath:
      'benchmarks/ai-correction/executable-rubric/writing-framework-selection-sonnet-5-finance-envelope.v1.json',
    outputSlug: 'writing-framework-selection-sonnet5-v2',
  },
} as const;

function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

const candidateName = option('candidate');
if (!candidateName) {
  throw new Error('WRITING_GATE_CANDIDATE_REQUIRED');
}
if (!(candidateName in candidates)) {
  throw new Error(`WRITING_GATE_CANDIDATE_UNSUPPORTED:${candidateName}`);
}
const candidate = candidates[candidateName as keyof typeof candidates];

async function writeJsonExclusive(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
}

const dossierText = await readFile(resolve(candidate.dossierPath), 'utf8');
const dossier = JSON.parse(dossierText) as {
  authorities: Record<string, { path: string }>;
};
const authorityTexts = Object.fromEntries(
  await Promise.all(
    Object.values(dossier.authorities).map(async ({ path }) => [
      path,
      await readFile(resolve(path), 'utf8'),
    ]),
  ),
);
const financeText = await readFile(resolve(candidate.financePath), 'utf8');
const packageInput = buildWritingFrameworkGatePackage({
  authorityTexts,
  dossierPath: candidate.dossierPath,
  dossierText,
  financeText,
});
const ownerGo =
  candidateName === 'gemini-3.6'
    ? `GO_V4_003E_Q1_GEMINI36_${packageInput.identityFingerprint
        .slice(0, 16)
        .toUpperCase()}`
    : `GO_V4_009C_S2_SONNET5_${packageInput.identityFingerprint
        .slice(0, 16)
        .toUpperCase()}`;

if (!process.argv.includes('--execute')) {
  console.log(
    JSON.stringify(
      {
        authorization: {
          exactToken: ownerGo,
          modelCallsAllowed:
            packageInput.finance.authorizationBoundary.modelCallsAllowed,
          ownerNetworkAuthorization:
            packageInput.finance.authorizationBoundary
              .ownerNetworkAuthorization,
          status: 'NETWORK_GO_NOT_GRANTED',
        },
        candidate: candidateName,
        cases: packageInput.cases.map(({ caseId }) => caseId),
        identityFingerprint: packageInput.identityFingerprint,
        maximumProviderAttempts:
          packageInput.finance.gateBound.maximumProviderAttempts,
        maximumProviderCostUsd:
          packageInput.finance.gateBound.maximumProviderCostUsd,
        mode: 'VALIDATE_ONLY',
        modelId: packageInput.wireModelId,
        requestedRoute: packageInput.requestedRoute,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (option('owner-go') !== ownerGo) {
  throw new Error(`OWNER_GO_REQUIRED_USE_EXACT_TOKEN_${ownerGo}`);
}
if (
  !packageInput.finance.authorizationBoundary.modelCallsAllowed ||
  String(
    packageInput.finance.authorizationBoundary.ownerNetworkAuthorization,
  ) !== 'GRANTED'
) {
  throw new Error('WRITING_GATE_NETWORK_AUTHORIZATION_NOT_GRANTED');
}
const apiKey = process.env.OPENROUTER_API_KEY?.trim();
if (!apiKey) throw new Error('OPENROUTER_API_KEY_REQUIRED');

const runId =
  option('run-id') ?? new Date().toISOString().replaceAll(/[:.]/gu, '-');
const outputDirectory = resolve(
  option('output-dir') ??
    `benchmarks/ai-correction/results/${candidate.outputSlug}/${runId}`,
);
await mkdir(outputDirectory, { recursive: true });
const store = await FileWritingFrameworkGateStore.open(outputDirectory);
const provider = new OpenRouterWritingFrameworkGateProvider(
  apiKey,
  packageInput,
);
const run = await runWritingFrameworkSelectionGateLive({
  canaryFactory: (caseId) =>
    `lx-canary-${sha256(`${runId}:${caseId}`).slice(0, 32)}`,
  packageInput,
  provider,
  store,
});
const totalActualCostUsd = run.attempts.reduce(
  (total, attempt) => total + (attempt.actualCostUsd ?? 0),
  0,
);
const summary = {
  attempts: run.attempts,
  completedAt: new Date().toISOString(),
  dossierSha256: sha256(dossierText),
  financeEnvelopeSha256: sha256(financeText),
  forceNoGo: run.forceNoGo,
  gatePassed:
    run.usableWorkflows === 4 &&
    !run.forceNoGo &&
    run.attempts.every(({ status }) => status === 'VALID'),
  identityFingerprint: packageInput.identityFingerprint,
  ledgerFinalRecordHash: run.ledger.at(-1)?.recordHash ?? null,
  maximumProviderCostUsd:
    packageInput.finance.gateBound.maximumProviderCostUsd,
  mode: run.mode,
  modelCallsPerformed: run.modelCallsPerformed,
  modelId: packageInput.wireModelId,
  outputDirectory,
  requestedRoute: packageInput.requestedRoute,
  stoppedReason: run.stoppedReason,
  totalActualCostUsd,
  usableWorkflows: run.usableWorkflows,
};
await writeJsonExclusive(resolve(outputDirectory, 'summary.json'), summary);
await writeJsonExclusive(resolve(outputDirectory, 'artifact-hashes.json'), {
  dossierSha256: sha256(dossierText),
  financeEnvelopeSha256: sha256(financeText),
  summarySha256: sha256(`${JSON.stringify(summary, null, 2)}\n`),
});
console.log(JSON.stringify(summary, null, 2));
