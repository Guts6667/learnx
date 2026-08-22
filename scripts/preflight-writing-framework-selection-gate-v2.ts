import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import {
  buildWritingFrameworkGatePackage,
  FileWritingFrameworkGateStore,
  FrozenOracleWritingFrameworkGateProvider,
  runWritingFrameworkSelectionGatePreflight,
} from '../src/server/ai/writing-framework-selection-gate-runner-v2.js';

function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}

const candidate = option('candidate') ?? 'sonnet-5';
const paths =
  candidate === 'gemini-3.6'
    ? {
        dossier:
          'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-freeze.v1.json',
        finance:
          'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-finance-envelope.draft.v1.json',
        implementationManifest: null,
      }
    : candidate === 'gemini-3.6-r1'
      ? {
          dossier:
            'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-r1-freeze.v1.json',
          finance:
            'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-r1-finance-envelope.draft.v1.json',
          implementationManifest:
            'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-r1-implementation-manifest.v1.json',
        }
      : candidate === 'sonnet-5'
        ? {
            dossier:
              'benchmarks/ai-correction/executable-rubric/writing-framework-selection-sonnet-5-freeze.v1.json',
            finance:
              'benchmarks/ai-correction/executable-rubric/writing-framework-selection-sonnet-5-finance-envelope.v1.json',
            implementationManifest: null,
          }
        : null;
if (!paths) throw new Error(`WRITING_GATE_UNKNOWN_CANDIDATE:${candidate}`);
const dossierPath = paths.dossier;
const financePath = paths.finance;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

const dossierText = await readFile(resolve(dossierPath), 'utf8');
const dossier = JSON.parse(dossierText) as {
  authorities: Record<string, { path: string; sha256: string }>;
  implementationBinding?: {
    manifestFingerprint: string;
    manifestPath: string;
    manifestSha256: string;
    publicCodeCommitSha: string;
  };
};
const authorityTexts = Object.fromEntries(
  await Promise.all(
    Object.values(dossier.authorities).map(async ({ path }) => [
      path,
      await readFile(resolve(path), 'utf8'),
    ]),
  ),
);
const implementationManifestText = paths.implementationManifest
  ? await readFile(resolve(paths.implementationManifest), 'utf8')
  : null;
const implementationManifest = implementationManifestText
  ? (JSON.parse(implementationManifestText) as {
      manifestFingerprint: string;
      publicCode: { commitSha: string };
    })
  : null;
if (paths.implementationManifest) {
  const authority = dossier.authorities.implementationManifest;
  const binding = dossier.implementationBinding;
  if (
    !authority ||
    !binding ||
    authority.path !== paths.implementationManifest ||
    binding.manifestPath !== paths.implementationManifest ||
    implementationManifestText === null ||
    implementationManifest === null ||
    authority.sha256 !== sha256(implementationManifestText) ||
    binding.manifestSha256 !== sha256(implementationManifestText) ||
    binding.manifestFingerprint !==
      implementationManifest.manifestFingerprint ||
    binding.publicCodeCommitSha !== implementationManifest.publicCode.commitSha
  ) {
    throw new Error('WRITING_GATE_IMPLEMENTATION_MANIFEST_MISMATCH');
  }
}
const packageInput = buildWritingFrameworkGatePackage({
  authorityTexts,
  dossierPath,
  dossierText,
  financeText: await readFile(resolve(financePath), 'utf8'),
});
const directory = await mkdtemp(resolve(tmpdir(), 'learnx-v4-009c-s2-'));
try {
  const provider = new FrozenOracleWritingFrameworkGateProvider(packageInput);
  const store = await FileWritingFrameworkGateStore.open(directory);
  const canaryFactory = (caseId: string) =>
    `lx-canary-${sha256(`offline-preflight:${caseId}`).slice(0, 32)}`;
  const run = await runWritingFrameworkSelectionGatePreflight({
    canaryFactory,
    packageInput,
    provider,
    store,
  });
  const reopened = await FileWritingFrameworkGateStore.open(directory);
  const replayProvider = new FrozenOracleWritingFrameworkGateProvider(
    packageInput,
  );
  const replay = await runWritingFrameworkSelectionGatePreflight({
    canaryFactory,
    packageInput,
    provider: replayProvider,
    store: reopened,
  });
  const preflightGreen =
    run.mode === 'OFFLINE_FAKE_ONLY' &&
    run.usableWorkflows === 4 &&
    run.attempts.length === 4 &&
    run.providerExecutions === 4 &&
    run.modelCallsPerformed === 0 &&
    !run.networkCallsAllowed &&
    !run.forceNoGo &&
    replay.mode === 'OFFLINE_FAKE_ONLY' &&
    replay.usableWorkflows === 4 &&
    replay.attempts.length === 4 &&
    replay.providerExecutions === 0 &&
    replay.modelCallsPerformed === 0 &&
    !replay.networkCallsAllowed &&
    !replay.forceNoGo;
  if (!preflightGreen) {
    throw new Error('WRITING_GATE_HARD_OFF_PREFLIGHT_FAILED');
  }
  console.log(
    JSON.stringify(
      {
        candidate,
        attempts: run.attempts.map((attempt) => ({
          caseId: attempt.caseId,
          defectClasses: attempt.defectClasses,
          financialState: attempt.financialState,
          messageUtf8Bytes: attempt.messageUtf8Bytes,
          rawPersistedBeforeValidation: attempt.rawPersistedBeforeValidation,
          status: attempt.status,
        })),
        dossierSha256: sha256(dossierText),
        financeEnvelopeSha256: sha256(
          await readFile(resolve(financePath), 'utf8'),
        ),
        ...(paths.implementationManifest
          ? {
              implementationManifest: {
                manifestFingerprint:
                  implementationManifest?.manifestFingerprint,
                path: paths.implementationManifest,
                publicCodeCommitSha:
                  implementationManifest?.publicCode.commitSha,
                sha256:
                  implementationManifestText === null
                    ? null
                    : sha256(implementationManifestText),
              },
              replayModelCallsPerformed: replay.modelCallsPerformed,
              replayNetworkCallsAllowed: replay.networkCallsAllowed,
            }
          : {}),
        identityFingerprint: packageInput.identityFingerprint,
        expectedObservedProvider: packageInput.expectedObservedProvider,
        catalogSnapshotId: packageInput.catalogSnapshotId,
        ledgerEventCount: run.ledger.length,
        maximumObservedMessageUtf8Bytes: Math.max(
          ...run.attempts.map(({ messageUtf8Bytes }) => messageUtf8Bytes),
        ),
        maximumPromptUtf8Bytes: packageInput.maximumPromptUtf8Bytes,
        requestedRoute: packageInput.requestedRoute,
        requestProfile: packageInput.requestProfile,
        wireModelId: packageInput.wireModelId,
        mode: run.mode,
        modelCallsPerformed: run.modelCallsPerformed,
        networkCallsAllowed: run.networkCallsAllowed,
        providerExecutions: run.providerExecutions,
        replayProviderExecutions: replay.providerExecutions,
        status: 'HARD_OFF_PREFLIGHT_GREEN',
        usableWorkflows: run.usableWorkflows,
      },
      null,
      2,
    ),
  );
} finally {
  await rm(directory, { force: true, recursive: true });
}
