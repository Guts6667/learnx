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

const dossierPath =
  'benchmarks/ai-correction/executable-rubric/writing-framework-selection-sonnet-5-freeze.v1.json';
const financePath =
  'benchmarks/ai-correction/executable-rubric/writing-framework-selection-sonnet-5-finance-envelope.v1.json';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

const dossierText = await readFile(resolve(dossierPath), 'utf8');
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
  console.log(
    JSON.stringify(
      {
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
        identityFingerprint: packageInput.identityFingerprint,
        ledgerEventCount: run.ledger.length,
        maximumObservedMessageUtf8Bytes: Math.max(
          ...run.attempts.map(({ messageUtf8Bytes }) => messageUtf8Bytes),
        ),
        maximumPromptUtf8Bytes: packageInput.maximumPromptUtf8Bytes,
        mode: run.mode,
        modelCallsPerformed: run.modelCallsPerformed,
        networkCallsAllowed: run.networkCallsAllowed,
        providerExecutions: run.providerExecutions,
        replayProviderExecutions: replay.providerExecutions,
        status:
          run.usableWorkflows === 4 &&
          !run.forceNoGo &&
          replay.providerExecutions === 0
            ? 'HARD_OFF_PREFLIGHT_GREEN'
            : 'HARD_OFF_PREFLIGHT_FAILED',
        usableWorkflows: run.usableWorkflows,
      },
      null,
      2,
    ),
  );
} finally {
  await rm(directory, { force: true, recursive: true });
}
