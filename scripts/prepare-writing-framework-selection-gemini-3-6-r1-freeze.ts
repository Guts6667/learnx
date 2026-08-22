import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const implementationPath =
  'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-r1-implementation-manifest.v1.json';
const dossierPath =
  'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-r1-freeze.v1.json';
const financePath =
  'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-r1-finance-envelope.draft.v1.json';

const runtimePaths = [
  'src/lib/ai-correction-provider-adapters.ts',
  'src/lib/evidence-assist-protocol.ts',
  'src/lib/evidence-assist-protocol-v2-adapter.ts',
  'src/lib/response-span-manifest.ts',
  'src/lib/executable-rubric-engine-v2.ts',
  'src/lib/executable-rubric-mechanical-oracle-v2-1.ts',
  'src/lib/writing-framework-selection-implementation-manifest.ts',
  'src/server/ai/writing-framework-selection-gate-runner-v2.ts',
  'src/server/ai/writing-framework-selection-openrouter-provider.ts',
] as const;

const persistencePaths = [
  'prisma/schema.prisma',
  'prisma/migrations/20260822120000_add_ai_correction_attempt_request_audit/migration.sql',
  'prisma/ai-correction-attempt-request-audit-schema.test.ts',
] as const;

const verificationToolPaths = [
  'scripts/run-writing-framework-selection-gate-v2.ts',
  'scripts/preflight-writing-framework-selection-gate-v2.ts',
  'src/server/ai/gemini-3-6-transport-differential.ts',
  'scripts/validate-gemini-3-6-transport-differential.ts',
  'scripts/prepare-writing-framework-selection-gemini-3-6-r1-freeze.ts',
] as const;

const testPaths = [
  'src/lib/ai-correction-provider-adapters.test.ts',
  'src/lib/evidence-assist-protocol.test.ts',
  'src/lib/ai-correction-benchmark.test.ts',
  'src/lib/writing-framework-selection-implementation-manifest.test.ts',
  'src/server/ai/gemini-3-6-transport-differential.test.ts',
  'src/server/ai/writing-framework-selection-gate-runner-v2.test.ts',
  'src/server/ai/writing-framework-selection-openrouter-provider.test.ts',
] as const;

const dependencyPaths = {
  lockfile: 'pnpm-lock.yaml',
  package: 'package.json',
  typescript: 'tsconfig.json',
} as const;

function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}

function sha256(value: string | Buffer): string {
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

function fingerprint(value: unknown): string {
  return sha256(JSON.stringify(canonicalize(value)));
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`WRITING_GATE_R1_FREEZE_${label}_INVALID`);
  }
  return value as Record<string, unknown>;
}

function cloneRecord(value: unknown, label: string): Record<string, unknown> {
  return record(JSON.parse(JSON.stringify(value)) as unknown, label);
}

function readJson(path: string): Record<string, unknown> {
  return record(
    JSON.parse(readFileSync(resolve(path), 'utf8')) as unknown,
    path,
  );
}

function publicFile(commit: string, path: string): Buffer {
  return execFileSync('git', ['show', `${commit}:${path}`], {
    cwd: process.cwd(),
    encoding: 'buffer',
    maxBuffer: 16 * 1024 * 1024,
  });
}

function gitText(args: readonly string[]): string {
  return execFileSync('git', [...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  }).trim();
}

function fileEntries(
  commit: string,
  paths: readonly string[],
): Array<{ path: string; sha256: string }> {
  return paths.map((path) => ({
    path,
    sha256: sha256(publicFile(commit, path)),
  }));
}

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function buildArtifacts(commit: string, ref: string) {
  const manifest = cloneRecord(readJson(implementationPath), 'MANIFEST');
  const publicCode = {
    commitObjectFormat: gitText(['rev-parse', '--show-object-format']),
    commitSha: commit,
    subject: gitText(['show', '-s', '--format=%s', commit]),
    treeSha: gitText(['show', '-s', '--format=%T', commit]),
  };
  const runtimeFiles = fileEntries(commit, runtimePaths);
  const persistenceFiles = fileEntries(commit, persistencePaths);
  const verificationTools = fileEntries(commit, verificationToolPaths);
  const testFiles = fileEntries(commit, testPaths);
  const dependencyFiles = Object.fromEntries(
    Object.entries(dependencyPaths).map(([name, path]) => [
      name,
      { path, sha256: sha256(publicFile(commit, path)) },
    ]),
  );
  const candidateRunnerImplementationFingerprint = fingerprint({
    dependencyFiles,
    persistenceFiles,
    publicCode,
    runtimeFiles,
    verificationTools,
  });

  Object.assign(manifest, {
    sourceBaseline: { commitSha: commit, ref },
    publicCode,
    runtimeFiles,
    persistenceFiles,
    verificationTools,
    testFiles,
    dependencyFiles,
    runtimeFilesFingerprint: fingerprint(runtimeFiles),
    persistenceFilesFingerprint: fingerprint(persistenceFiles),
    verificationToolsFingerprint: fingerprint(verificationTools),
    testFilesFingerprint: fingerprint(testFiles),
    dependencyFilesFingerprint: fingerprint(dependencyFiles),
    candidateRunnerImplementationFingerprint,
    scopePolicy: {
      candidateRunnerImplementationScope:
        'PUBLIC_CODE_RUNTIME_PERSISTENCE_VERIFICATION_AND_DEPENDENCIES',
      candidateRunnerImplementationFingerprint,
      postFreezeCliMayAuthorizeNetwork: false,
      postFreezeCliPath: 'scripts/run-writing-framework-selection-gate-v2.ts',
      postFreezeCliRole: 'FROZEN_FAIL_CLOSED_CONTROL_PLANE',
      verificationToolsAreRunnerRuntime: false,
    },
  });
  delete manifest.manifestFingerprint;
  manifest.manifestFingerprint = fingerprint(manifest);
  const manifestText = serialize(manifest);

  const dossier = cloneRecord(readJson(dossierPath), 'DOSSIER');
  const authorities = cloneRecord(dossier.authorities, 'AUTHORITIES');
  authorities.implementationManifest = {
    path: implementationPath,
    sha256: sha256(manifestText),
  };
  dossier.authorities = authorities;
  const implementationBinding = {
    candidateRunnerImplementationFingerprint,
    manifestFingerprint: manifest.manifestFingerprint,
    manifestPath: implementationPath,
    manifestSha256: sha256(manifestText),
    publicCodeCommitSha: commit,
    testFilesFingerprint: manifest.testFilesFingerprint,
  };
  dossier.implementationBinding = implementationBinding;
  dossier.implementationBindingFingerprint = fingerprint(implementationBinding);
  const identityCore = cloneRecord(dossier.identityCore, 'IDENTITY_CORE');
  identityCore.publicCodeCommitSha = commit;
  identityCore.runnerImplementationFingerprint =
    candidateRunnerImplementationFingerprint;
  dossier.identityCore = identityCore;
  dossier.identityFingerprint = fingerprint(identityCore);
  const dossierText = serialize(dossier);

  const finance = cloneRecord(readJson(financePath), 'FINANCE');
  const campaign = cloneRecord(finance.campaign, 'FINANCE_CAMPAIGN');
  campaign.dossierPath = dossierPath;
  campaign.dossierSha256 = sha256(dossierText);
  campaign.identityFingerprint = dossier.identityFingerprint;
  finance.campaign = campaign;
  delete finance.envelopeFingerprint;
  finance.envelopeFingerprint = fingerprint(finance);
  const financeText = serialize(finance);

  return {
    dossier,
    dossierText,
    finance,
    financeText,
    manifest,
    manifestText,
    summary: {
      candidateRunnerImplementationFingerprint,
      dossier: {
        identityFingerprint: dossier.identityFingerprint,
        path: dossierPath,
        sha256: sha256(dossierText),
      },
      financeDraft: {
        envelopeFingerprint: finance.envelopeFingerprint,
        path: financePath,
        sha256: sha256(financeText),
      },
      implementationManifest: {
        manifestFingerprint: manifest.manifestFingerprint,
        path: implementationPath,
        sha256: sha256(manifestText),
      },
      publicCode,
      sourceBaseline: { commitSha: commit, ref },
    },
  };
}

const baseline = option('baseline');
if (!baseline || !/^[a-f0-9]{40}$/u.test(baseline)) {
  throw new Error('WRITING_GATE_R1_EXACT_PUBLIC_BASELINE_REQUIRED');
}
const ref = option('ref') ?? 'origin/dev';
const artifact = option('artifact') ?? 'summary';
const generated = buildArtifacts(baseline, ref);

if (artifact === 'implementation-manifest') {
  process.stdout.write(generated.manifestText);
} else if (artifact === 'dossier') {
  process.stdout.write(generated.dossierText);
} else if (artifact === 'finance-draft') {
  process.stdout.write(generated.financeText);
} else if (artifact === 'summary') {
  process.stdout.write(serialize(generated.summary));
} else {
  throw new Error(`WRITING_GATE_R1_ARTIFACT_UNSUPPORTED:${artifact}`);
}
