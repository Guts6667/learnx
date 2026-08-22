import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  verifyWritingFrameworkImplementationManifest,
  type WritingFrameworkImplementationManifest,
} from '../src/lib/writing-framework-selection-implementation-manifest.js';
import {
  buildWritingFrameworkGatePackage,
  createWritingGateLiveAuthorizationProof,
  FileWritingFrameworkGateStore,
  runWritingFrameworkSelectionGateLive,
} from '../src/server/ai/writing-framework-selection-gate-runner-v2.js';
import { OpenRouterWritingFrameworkGateProvider } from '../src/server/ai/writing-framework-selection-openrouter-provider.js';

type CandidateExecutionState =
  | 'CLOSED_NO_REPLAY'
  | 'DERIVED_FROM_GOVERNED_ARTIFACTS'
  | 'NETWORK_AUTHORIZATION_NOT_GRANTED';

type CandidateConfiguration = Readonly<{
  authorizationPath: string | null;
  dossierPath: string;
  executionState: CandidateExecutionState;
  financeArbitrationPath: string | null;
  financeDraftPath: string;
  implementationManifestPath: string | null;
  outputSlug: string;
  ownerGoPrefix: string | null;
  preflightPath: string | null;
}>;

const candidates: Readonly<Record<string, CandidateConfiguration>> = {
  'gemini-3.6': {
    authorizationPath: null,
    dossierPath:
      'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-freeze.v1.json',
    executionState: 'CLOSED_NO_REPLAY',
    financeArbitrationPath: null,
    financeDraftPath:
      'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-finance-envelope.approved.v1.json',
    implementationManifestPath: null,
    outputSlug: 'writing-framework-selection-gemini36-v2',
    ownerGoPrefix: null,
    preflightPath: null,
  },
  'gemini-3.6-r1': {
    authorizationPath:
      'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-r1-network-authorization.v1.json',
    dossierPath:
      'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-r1-freeze.v1.json',
    executionState: 'DERIVED_FROM_GOVERNED_ARTIFACTS',
    financeArbitrationPath:
      'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-r1-finance-arbitration.v1.json',
    financeDraftPath:
      'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-r1-finance-envelope.draft.v1.json',
    implementationManifestPath:
      'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-r1-implementation-manifest.v1.json',
    outputSlug: 'writing-framework-selection-gemini36-r1-v2',
    ownerGoPrefix: 'GO_V4_003E_Q1_R1_GEMINI36_',
    preflightPath:
      'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-r1-runner-preflight.v1.json',
  },
  'sonnet-5': {
    authorizationPath: null,
    dossierPath:
      'benchmarks/ai-correction/executable-rubric/writing-framework-selection-sonnet-5-freeze.v1.json',
    executionState: 'NETWORK_AUTHORIZATION_NOT_GRANTED',
    financeArbitrationPath: null,
    financeDraftPath:
      'benchmarks/ai-correction/executable-rubric/writing-framework-selection-sonnet-5-finance-envelope.v1.json',
    implementationManifestPath: null,
    outputSlug: 'writing-framework-selection-sonnet5-v2',
    ownerGoPrefix: null,
    preflightPath: null,
  },
};

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
    financeArbitrationPath: string;
    financeArbitrationSha256: string;
    financeDraftPath: string;
    financeDraftSha256: string;
    implementationManifestPath: string;
    implementationManifestSha256: string;
    transportPreflightPath: string;
    transportPreflightSha256: string;
  };
  status: string;
}>;

type FinanceArbitration = Readonly<{
  arbitrationFingerprint: string;
  authorizationBoundary: {
    financeArbitration: 'GRANTED_FOR_R1_GATE4_ONLY';
    modelCallsAllowed: false;
    ownerNetworkAuthorization: 'NOT_GRANTED';
  };
  campaign: {
    dossierPath: string;
    dossierSha256: string;
    identityFingerprint: string;
  };
  draftBinding: {
    path: string;
    sha256: string;
  };
  gateBound: {
    maximumFallbacks: 0;
    maximumProviderAttempts: 4;
    maximumProviderCostUsd: number;
    maximumRetriesPerWorkflow: 0;
  };
  status: 'IDENTITY_AND_FINANCE_APPROVED_NETWORK_NOT_AUTHORIZED';
}>;

function parseRecord(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('WRITING_GATE_GOVERNED_ARTIFACT_INVALID');
  }
  return parsed as Record<string, unknown>;
}

async function readGovernedArtifact(path: string): Promise<string> {
  try {
    return await readFile(resolve(path), 'utf8');
  } catch {
    throw new Error('WRITING_GATE_NETWORK_AUTHORIZATION_NOT_GRANTED');
  }
}

function validateFinanceArbitration(input: {
  arbitrationText: string;
  draftPath: string;
  draftText: string;
}): FinanceArbitration {
  const arbitrationValue = parseRecord(input.arbitrationText);
  const arbitration = arbitrationValue as unknown as FinanceArbitration;
  const { arbitrationFingerprint, ...core } = arbitrationValue;
  const draftBinding = arbitration.draftBinding;
  const boundary = arbitration.authorizationBoundary;
  const gateBound = arbitration.gateBound;
  if (
    typeof arbitrationFingerprint !== 'string' ||
    arbitrationFingerprint !== sha256(JSON.stringify(canonicalize(core))) ||
    arbitration.status !==
      'IDENTITY_AND_FINANCE_APPROVED_NETWORK_NOT_AUTHORIZED' ||
    !draftBinding ||
    draftBinding.path !== input.draftPath ||
    draftBinding.sha256 !== sha256(input.draftText) ||
    !boundary ||
    boundary.financeArbitration !== 'GRANTED_FOR_R1_GATE4_ONLY' ||
    boundary.modelCallsAllowed !== false ||
    boundary.ownerNetworkAuthorization !== 'NOT_GRANTED' ||
    !gateBound ||
    gateBound.maximumProviderAttempts !== 4 ||
    gateBound.maximumRetriesPerWorkflow !== 0 ||
    gateBound.maximumFallbacks !== 0 ||
    gateBound.maximumProviderCostUsd !== 0.5
  ) {
    throw new Error('WRITING_GATE_FINANCE_ARBITRATION_NOT_GRANTED');
  }
  return arbitration;
}

function assertFinanceArbitrationCampaign(input: {
  arbitration: FinanceArbitration;
  dossierPath: string;
  dossierText: string;
  identityFingerprint: string;
}): void {
  const campaign = input.arbitration.campaign;
  if (
    !campaign ||
    campaign.dossierPath !== input.dossierPath ||
    campaign.dossierSha256 !== sha256(input.dossierText) ||
    campaign.identityFingerprint !== input.identityFingerprint
  ) {
    throw new Error('WRITING_GATE_FINANCE_ARBITRATION_IDENTITY_MISMATCH');
  }
}

type GovernedExecutionArtifacts = Readonly<{
  authorizationText: string;
  financeArbitration: FinanceArbitration;
  financeArbitrationText: string;
  financeDraftText: string;
  implementationManifest: WritingFrameworkImplementationManifest;
  implementationManifestText: string;
  preflightText: string;
}>;

async function loadGovernedExecutionArtifacts(
  configuration: CandidateConfiguration,
): Promise<GovernedExecutionArtifacts> {
  const {
    authorizationPath,
    financeArbitrationPath,
    financeDraftPath,
    implementationManifestPath,
    preflightPath,
  } = configuration;
  if (
    configuration.executionState !== 'DERIVED_FROM_GOVERNED_ARTIFACTS' ||
    !authorizationPath ||
    !financeArbitrationPath ||
    !implementationManifestPath ||
    !preflightPath ||
    option('network-authorization') !== authorizationPath
  ) {
    throw new Error('WRITING_GATE_NETWORK_AUTHORIZATION_NOT_GRANTED');
  }
  const [
    authorizationText,
    financeDraftText,
    financeArbitrationText,
    implementationManifestText,
    preflightText,
  ] = await Promise.all([
    readGovernedArtifact(authorizationPath),
    readGovernedArtifact(financeDraftPath),
    readGovernedArtifact(financeArbitrationPath),
    readGovernedArtifact(implementationManifestPath),
    readGovernedArtifact(preflightPath),
  ]);
  const financeArbitration = validateFinanceArbitration({
    arbitrationText: financeArbitrationText,
    draftPath: financeDraftPath,
    draftText: financeDraftText,
  });
  const implementationManifest =
    await verifyWritingFrameworkImplementationManifest({
      manifestValue: JSON.parse(implementationManifestText) as unknown,
      root: process.cwd(),
    });
  return {
    authorizationText,
    financeArbitration,
    financeArbitrationText,
    financeDraftText,
    implementationManifest,
    implementationManifestText,
    preflightText,
  };
}

async function loadNetworkAuthorization(input: {
  authorizationText: string;
  expectedBaseline: string;
  expectedPath: string;
  financeArbitrationText: string;
  financeDraftText: string;
  implementationManifestText: string;
  ownerGo: string;
  preflightText: string;
}): Promise<NetworkAuthorization> {
  const requestedPath = option('network-authorization');
  if (requestedPath !== input.expectedPath) {
    throw new Error('WRITING_GATE_NETWORK_AUTHORIZATION_NOT_GRANTED');
  }
  const authorization = JSON.parse(
    input.authorizationText,
  ) as NetworkAuthorization;
  const { authorizationFingerprint, ...core } = authorization;
  if (authorizationFingerprint !== sha256(JSON.stringify(canonicalize(core)))) {
    throw new Error('WRITING_GATE_NETWORK_AUTHORIZATION_FINGERPRINT_MISMATCH');
  }
  if (
    authorization.status !== 'GRANTED_SINGLE_USE_UNCONSUMED' ||
    authorization.baseline.commit !== input.expectedBaseline ||
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
    authorization.sourceBindings.financeDraftPath !==
      candidate.financeDraftPath ||
    authorization.sourceBindings.financeDraftSha256 !==
      sha256(input.financeDraftText) ||
    authorization.sourceBindings.financeArbitrationPath !==
      candidate.financeArbitrationPath ||
    authorization.sourceBindings.financeArbitrationSha256 !==
      sha256(input.financeArbitrationText) ||
    authorization.sourceBindings.implementationManifestPath !==
      candidate.implementationManifestPath ||
    authorization.sourceBindings.implementationManifestSha256 !==
      sha256(input.implementationManifestText) ||
    authorization.sourceBindings.transportPreflightPath !==
      candidate.preflightPath ||
    authorization.sourceBindings.transportPreflightSha256 !==
      sha256(input.preflightText) ||
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
const candidate = candidates[candidateName];
if (!candidate) {
  throw new Error(`WRITING_GATE_CANDIDATE_UNSUPPORTED:${candidateName}`);
}
const executeRequested = process.argv.includes('--execute');
if (executeRequested && candidate.executionState === 'CLOSED_NO_REPLAY') {
  throw new Error('WRITING_GATE_IDENTITY_CLOSED_NO_REPLAY');
}
if (
  executeRequested &&
  candidate.executionState !== 'DERIVED_FROM_GOVERNED_ARTIFACTS'
) {
  throw new Error('WRITING_GATE_NETWORK_AUTHORIZATION_NOT_GRANTED');
}
const governedExecution = executeRequested
  ? await loadGovernedExecutionArtifacts(candidate)
  : null;

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
  identityCore?: { publicCodeCommitSha?: string };
};
const authorityTexts = Object.fromEntries(
  await Promise.all(
    Object.values(dossier.authorities).map(async ({ path }) => [
      path,
      await readFile(resolve(path), 'utf8'),
    ]),
  ),
);
const financeDraftText =
  governedExecution?.financeDraftText ??
  (await readFile(resolve(candidate.financeDraftPath), 'utf8'));
const financeText = financeDraftText;
const packageInput = buildWritingFrameworkGatePackage({
  authorityTexts,
  dossierPath: candidate.dossierPath,
  dossierText,
  financeText,
});
if (
  governedExecution &&
  dossier.identityCore?.publicCodeCommitSha !==
    governedExecution.implementationManifest.publicCode.commitSha
) {
  throw new Error('WRITING_GATE_PUBLIC_CODE_BASELINE_MISMATCH');
}
if (governedExecution) {
  assertFinanceArbitrationCampaign({
    arbitration: governedExecution.financeArbitration,
    dossierPath: candidate.dossierPath,
    dossierText,
    identityFingerprint: packageInput.identityFingerprint,
  });
}
if (!executeRequested) {
  console.log(
    JSON.stringify(
      {
        authorization: {
          exactToken: null,
          modelCallsAllowed:
            packageInput.finance.authorizationBoundary.modelCallsAllowed,
          ownerNetworkAuthorization:
            packageInput.finance.authorizationBoundary
              .ownerNetworkAuthorization,
          status:
            candidate.executionState === 'DERIVED_FROM_GOVERNED_ARTIFACTS'
              ? 'NETWORK_AUTHORIZATION_NOT_GRANTED'
              : candidate.executionState,
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

if (
  candidate.authorizationPath === null ||
  candidate.financeArbitrationPath === null ||
  candidate.implementationManifestPath === null ||
  candidate.ownerGoPrefix === null ||
  candidate.preflightPath === null ||
  governedExecution === null
) {
  throw new Error('WRITING_GATE_NETWORK_AUTHORIZATION_NOT_GRANTED');
}
const ownerGo = option('owner-go');
if (!ownerGo || !ownerGo.startsWith(candidate.ownerGoPrefix)) {
  throw new Error('WRITING_GATE_OWNER_GO_NOT_GRANTED');
}
const authorization = await loadNetworkAuthorization({
  authorizationText: governedExecution.authorizationText,
  expectedBaseline:
    governedExecution.implementationManifest.publicCode.commitSha,
  expectedPath: candidate.authorizationPath,
  financeArbitrationText: governedExecution.financeArbitrationText,
  financeDraftText: governedExecution.financeDraftText,
  implementationManifestText: governedExecution.implementationManifestText,
  ownerGo,
  preflightText: governedExecution.preflightText,
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
