import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  buildWritingFrameworkGatePackage,
  createWritingGateLiveAuthorizationProof,
  FileWritingFrameworkGateStore,
  runWritingFrameworkSelectionGateLive,
} from '../src/server/ai/writing-framework-selection-gate-runner-v2.js';
import { OpenRouterWritingFrameworkGateProvider } from '../src/server/ai/writing-framework-selection-openrouter-provider.js';

const candidates = {
  'gemini-3.6': {
    authorizationPath:
      'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-network-authorization.v1.json',
    dossierPath:
      'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-freeze.v1.json',
    financePath:
      'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-finance-envelope.approved.v1.json',
    outputSlug: 'writing-framework-selection-gemini36-v2',
  },
  'sonnet-5': {
    authorizationPath: null,
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

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
}

type NetworkAuthorization = Readonly<{
  authorizationFingerprint: string;
  baseline: { commit: string; ref: string };
  executionBoundary: {
    holdoutAllowed: boolean;
    maximumFallbacks: number;
    maximumProviderAttempts: number;
    maximumProviderCostUsd: number;
    maximumRetriesPerWorkflow: number;
    outputDirectory: string;
    panel10x2Allowed: boolean;
    runId: string;
    sequentialOnly: boolean;
    stage: string;
    stopOnFirstDefect: boolean;
    v4_010ActivationAllowed: boolean;
  };
  identity: {
    catalogSnapshotId: string;
    expectedObservedProvider: string;
    identityFingerprint: string;
    modelId: string;
    requestedRoute: string;
  };
  ownerGoToken: string;
  sourceBindings: {
    dossierPath: string;
    dossierSha256: string;
    financeEnvelopePath: string;
    financeEnvelopeSha256: string;
    transportPreflightPath: string;
    transportPreflightSha256: string;
  };
  status: string;
}>;

async function loadNetworkAuthorization(input: {
  expectedPath: string | null;
  ownerGo: string;
}): Promise<NetworkAuthorization> {
  const requestedPath = option('network-authorization');
  if (!input.expectedPath || requestedPath !== input.expectedPath) {
    throw new Error('WRITING_GATE_NETWORK_AUTHORIZATION_NOT_GRANTED');
  }
  const text = await readFile(resolve(requestedPath), 'utf8');
  const authorization = JSON.parse(text) as NetworkAuthorization;
  const { authorizationFingerprint, ...core } = authorization;
  if (authorizationFingerprint !== sha256(JSON.stringify(canonicalize(core)))) {
    throw new Error('WRITING_GATE_NETWORK_AUTHORIZATION_FINGERPRINT_MISMATCH');
  }
  if (
    authorization.status !== 'GRANTED_SINGLE_USE_UNCONSUMED' ||
    authorization.baseline.ref !== 'origin/dev' ||
    authorization.baseline.commit !==
      'f6607b9c086cffce1f81ac9a8c2fc36194fe5a25' ||
    authorization.ownerGoToken !== input.ownerGo ||
    authorization.identity.identityFingerprint !==
      packageInput.identityFingerprint ||
    authorization.identity.modelId !== packageInput.wireModelId ||
    authorization.identity.catalogSnapshotId !==
      packageInput.catalogSnapshotId ||
    authorization.identity.requestedRoute !== packageInput.requestedRoute ||
    authorization.identity.expectedObservedProvider !==
      packageInput.expectedObservedProvider ||
    authorization.sourceBindings.dossierPath !== candidate.dossierPath ||
    authorization.sourceBindings.dossierSha256 !== sha256(dossierText) ||
    authorization.sourceBindings.financeEnvelopePath !==
      candidate.financePath ||
    authorization.sourceBindings.financeEnvelopeSha256 !==
      sha256(financeText) ||
    authorization.sourceBindings.transportPreflightSha256 !==
      sha256(
        await readFile(
          resolve(authorization.sourceBindings.transportPreflightPath),
          'utf8',
        ),
      ) ||
    authorization.executionBoundary.stage !== 'FOUR_CASE_GATE' ||
    authorization.executionBoundary.maximumProviderAttempts !==
      packageInput.finance.gateBound.maximumProviderAttempts ||
    authorization.executionBoundary.maximumProviderCostUsd !==
      packageInput.finance.gateBound.maximumProviderCostUsd ||
    authorization.executionBoundary.maximumRetriesPerWorkflow !== 0 ||
    authorization.executionBoundary.maximumFallbacks !== 0 ||
    !authorization.executionBoundary.sequentialOnly ||
    !authorization.executionBoundary.stopOnFirstDefect ||
    authorization.executionBoundary.panel10x2Allowed ||
    authorization.executionBoundary.holdoutAllowed ||
    authorization.executionBoundary.v4_010ActivationAllowed
  ) {
    throw new Error('WRITING_GATE_NETWORK_AUTHORIZATION_IDENTITY_MISMATCH');
  }
  return authorization;
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
const authorization = await loadNetworkAuthorization({
  expectedPath: candidate.authorizationPath,
  ownerGo,
});
const runId = authorization.executionBoundary.runId;
if (option('run-id') && option('run-id') !== runId) {
  throw new Error('WRITING_GATE_AUTHORIZED_RUN_ID_MISMATCH');
}
if (
  option('output-dir') &&
  option('output-dir') !== authorization.executionBoundary.outputDirectory
) {
  throw new Error('WRITING_GATE_AUTHORIZED_OUTPUT_DIRECTORY_MISMATCH');
}
const apiKey = process.env.OPENROUTER_API_KEY?.trim();
if (!apiKey) throw new Error('OPENROUTER_API_KEY_REQUIRED');
const outputDirectory = resolve(
  authorization.executionBoundary.outputDirectory,
);
await mkdir(outputDirectory, { recursive: true });
const store = await FileWritingFrameworkGateStore.open(outputDirectory);
const authorizationProof = createWritingGateLiveAuthorizationProof({
  authorizationFingerprint: authorization.authorizationFingerprint,
  identityFingerprint: authorization.identity.identityFingerprint,
  outputDirectory,
  runId,
});
const provider = new OpenRouterWritingFrameworkGateProvider(
  apiKey,
  packageInput,
  { authorizationProof },
);
const run = await runWritingFrameworkSelectionGateLive({
  canaryFactory: (caseId) =>
    `lx-canary-${sha256(`${runId}:${caseId}`).slice(0, 32)}`,
  packageInput,
  provider,
  store,
});
const costsFullyReconciled = run.attempts.every(
  ({ actualCostUsd, costSource }) =>
    actualCostUsd !== null && costSource === 'ACTUAL',
);
const totalActualCostUsd = costsFullyReconciled
  ? run.attempts.reduce(
      (total, attempt) => total + (attempt.actualCostUsd ?? 0),
      0,
    )
  : null;
const unresolvedReservedCostUsd = run.attempts.reduce(
  (total, attempt) =>
    attempt.actualCostUsd === null
      ? total + packageInput.finance.perAttemptBound.maximumCostUsd
      : total,
  0,
);
const summary = {
  attempts: run.attempts,
  authorizationFingerprint: authorization.authorizationFingerprint,
  completedAt: new Date().toISOString(),
  costsFullyReconciled,
  dossierSha256: sha256(dossierText),
  financeEnvelopeSha256: sha256(financeText),
  forceNoGo: run.forceNoGo,
  gatePassed:
    run.usableWorkflows === 4 &&
    !run.forceNoGo &&
    run.attempts.every(({ status }) => status === 'VALID'),
  identityFingerprint: packageInput.identityFingerprint,
  ledgerFinalRecordHash: run.ledger.at(-1)?.recordHash ?? null,
  maximumProviderCostUsd: packageInput.finance.gateBound.maximumProviderCostUsd,
  mode: run.mode,
  modelCallsPerformed: run.modelCallsPerformed,
  modelId: packageInput.wireModelId,
  outputDirectory,
  requestedRoute: packageInput.requestedRoute,
  stoppedReason: run.stoppedReason,
  totalActualCostUsd,
  unresolvedReservedCostUsd,
  usableWorkflows: run.usableWorkflows,
};
await writeJsonExclusive(resolve(outputDirectory, 'summary.json'), summary);
await writeJsonExclusive(resolve(outputDirectory, 'artifact-hashes.json'), {
  dossierSha256: sha256(dossierText),
  financeEnvelopeSha256: sha256(financeText),
  summarySha256: sha256(`${JSON.stringify(summary, null, 2)}\n`),
});
console.log(JSON.stringify(summary, null, 2));
