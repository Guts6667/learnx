import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import {
  GEMINI_WIRE_JSON_SCHEMA_KEYWORDS,
  evidenceAssistGeminiWireJsonSchema,
  evidenceAssistGeminiWireSchemaFingerprint,
} from './evidence-assist-protocol.ts';

const root = process.cwd();
const implementationPath =
  'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-r1-implementation-manifest.v1.json';
const dossierPath =
  'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-r1-freeze.v1.json';
const financePath =
  'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-r1-finance-envelope.draft.v1.json';
const preflightPath =
  'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-r1-runner-preflight.v1.json';

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8');
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

function record(value: unknown): Record<string, unknown> {
  expect(value).toBeTypeOf('object');
  expect(value).not.toBeNull();
  expect(Array.isArray(value)).toBe(false);
  return value as Record<string, unknown>;
}

function publicFile(commit: string, path: string): Buffer {
  const result = spawnSync('git', ['show', `${commit}:${path}`], {
    cwd: root,
    encoding: 'buffer',
  });
  expect(result.status, result.stderr.toString()).toBe(0);
  return result.stdout;
}

describe('Gemini 3.6 R1 frozen hard-off identity', () => {
  it('binds every historical runtime, verification, test, package and lock byte to its public commit', () => {
    const manifest = record(JSON.parse(read(implementationPath)) as unknown);
    const publicCode = record(manifest.publicCode);
    const publicCodeCommit = String(publicCode.commitSha);
    expect(publicCode).toMatchObject({
      commitObjectFormat: 'sha1',
    });
    expect(publicCodeCommit).toMatch(/^[a-f0-9]{40}$/u);
    const commitIdentity = spawnSync(
      'git',
      ['show', '-s', '--format=%H%n%T%n%s', publicCodeCommit],
      { cwd: root, encoding: 'utf8' },
    );
    expect(commitIdentity.status, commitIdentity.stderr).toBe(0);
    expect(commitIdentity.stdout.trim().split('\n')).toEqual([
      publicCodeCommit,
      publicCode.treeSha,
      publicCode.subject,
    ]);
    for (const group of [
      'runtimeFiles',
      'verificationTools',
      'testFiles',
      'persistenceFiles',
    ]) {
      const files = manifest[group];
      expect(Array.isArray(files)).toBe(true);
      for (const entry of files as Array<{ path: string; sha256: string }>) {
        expect(sha256(publicFile(publicCodeCommit, entry.path))).toBe(
          entry.sha256,
        );
      }
    }
    const dependencyFiles = record(manifest.dependencyFiles);
    for (const entry of Object.values(dependencyFiles) as Array<{
      path: string;
      sha256: string;
    }>) {
      expect(sha256(publicFile(publicCodeCommit, entry.path))).toBe(
        entry.sha256,
      );
    }

    expect(manifest.runtimeFilesFingerprint).toBe(
      fingerprint(manifest.runtimeFiles),
    );
    expect(manifest.verificationToolsFingerprint).toBe(
      fingerprint(manifest.verificationTools),
    );
    expect(manifest.testFilesFingerprint).toBe(fingerprint(manifest.testFiles));
    expect(manifest.persistenceFilesFingerprint).toBe(
      fingerprint(manifest.persistenceFiles),
    );
    expect(manifest.dependencyFilesFingerprint).toBe(
      fingerprint(manifest.dependencyFiles),
    );
    const { manifestFingerprint, ...manifestCore } = manifest;
    expect(manifestFingerprint).toBe(fingerprint(manifestCore));
    expect(manifest.executionBoundary).toEqual({
      financeArbitrationEffect: 'NONE',
      modelCallsAllowed: false,
      networkAuthorizationEffect: 'NONE',
      ownerGoEffect: 'NONE',
    });
  });

  it('freezes wire 3.0.1, profile, implementation and semantic fingerprints', () => {
    const dossier = record(JSON.parse(read(dossierPath)) as unknown);
    const manifest = record(JSON.parse(read(implementationPath)) as unknown);
    const publicCodeCommit = String(record(manifest.publicCode).commitSha);
    const identityCore = record(dossier.identityCore);
    const wireContract = record(dossier.wireContract);
    const schema = evidenceAssistGeminiWireJsonSchema();

    expect(Buffer.byteLength(JSON.stringify(canonicalize(schema)))).toBe(439);
    expect(evidenceAssistGeminiWireSchemaFingerprint()).toBe(
      '05719294eed15139abd0039c0f1e91a25489535c882968836fe3ece25b2fdb13',
    );
    expect(JSON.stringify(schema)).not.toContain('"pattern"');
    expect(wireContract).toMatchObject({
      dialect: 'GEMINI_WIRE_3_0_1',
      dialectVersion: 'evidence-assist-wire/3.0.1',
      localSpanIdPatternValidationRetained: true,
      schemaSha256: evidenceAssistGeminiWireSchemaFingerprint(),
      schemaUtf8Bytes: 439,
      wirePatternOmitted: true,
    });
    expect(wireContract.jsonSchemaKeywordAllowlist).toEqual(
      GEMINI_WIRE_JSON_SCHEMA_KEYWORDS,
    );
    expect(wireContract.jsonSchemaKeywordAllowlistFingerprint).toBe(
      fingerprint(GEMINI_WIRE_JSON_SCHEMA_KEYWORDS),
    );
    expect(dossier.requestProfileFingerprint).toBe(
      '98c5e401d2b7a359689ffda42e4a0a04c06ac014c604677e9cb5d39eb2939061',
    );
    expect(dossier.requestProfileFingerprint).toBe(
      fingerprint(dossier.requestProfile),
    );
    expect(dossier.wireContractFingerprint).toBe(fingerprint(wireContract));
    expect(dossier.transportObservabilityContractFingerprint).toBe(
      fingerprint(dossier.transportObservabilityContract),
    );
    expect(dossier.implementationBindingFingerprint).toBe(
      fingerprint(dossier.implementationBinding),
    );
    expect(identityCore).toMatchObject({
      publicCodeCommitSha: publicCodeCommit,
      requestProfileFingerprint: dossier.requestProfileFingerprint,
      runnerImplementationFingerprint: record(dossier.implementationBinding)
        .candidateRunnerImplementationFingerprint,
      transportObservabilityContractFingerprint:
        dossier.transportObservabilityContractFingerprint,
      wireContractFingerprint: dossier.wireContractFingerprint,
    });

    for (const component of [
      'corpus',
      'semanticMapping',
      'runnerContract',
      'telemetryContract',
      'stopPolicy',
    ]) {
      expect(dossier[`${component}Fingerprint`]).toBe(
        fingerprint(dossier[component]),
      );
    }
    expect(dossier.identityFingerprint).toBe(fingerprint(identityCore));
    expect(dossier.identityFingerprint).not.toBe(
      'ef88a8e3b1bfd57ddc4afe787d8a920ea4b329e3d83b28b3fc4029487e88e9ed',
    );

    const authorities = record(dossier.authorities);
    for (const authorityValue of Object.values(authorities)) {
      const authority = authorityValue as { path: string; sha256: string };
      expect(sha256(read(authority.path))).toBe(authority.sha256);
    }
    expect(dossier.authorizationBoundary).toMatchObject({
      financeArbitration: 'NOT_GRANTED',
      modelCallsAllowed: false,
      networkAuthorizationArtifact: null,
      ownerGoToken: null,
      ownerNetworkAuthorization: 'NOT_GRANTED',
    });
  });

  it('recomputes the R1 finance bound and preserves the hard 0.50 USD cap', () => {
    const finance = record(JSON.parse(read(financePath)) as unknown);
    const attempt = record(finance.perAttemptBound);
    const gate = record(finance.gateBound);
    const pricing = record(finance.pricingAuthority);

    expect(attempt.inputTokenUpperBound).toBe(
      Number(attempt.maximumPromptUtf8Bytes) +
        Number(attempt.schemaUtf8Bytes) +
        Number(attempt.transportAllowanceTokens),
    );
    expect(attempt.inputTokenUpperBound).toBe(68_023);
    expect(attempt.maximumCostUsd).toBe(
      Number(attempt.inputTokenUpperBound) * Number(pricing.promptUsdPerToken) +
        Number(attempt.maximumCombinedOutputAndReasoningTokens) *
          Number(pricing.completionAndReasoningUsdPerToken),
    );
    expect(attempt.maximumCostUsd).toBe(0.06039225);
    expect(gate.calculatedMaximumProviderCostUsd).toBe(
      Number(attempt.maximumCostUsd) * Number(gate.maximumProviderAttempts),
    );
    expect(gate).toMatchObject({
      calculatedMaximumProviderCostUsd: 0.241569,
      maximumFallbacks: 0,
      maximumProviderAttempts: 4,
      maximumProviderCostUsd: 0.5,
      maximumRetriesPerWorkflow: 0,
      stopOnFirstDefect: true,
      unusedBudgetTransferable: false,
    });
    expect(finance.campaign).toMatchObject({
      closedQ1BudgetReused: false,
      historicalBudgetReusedUsd: 0,
      identityFingerprint:
        '00cd27d8fb78682e155595dc17d65b8168edbb7a1b938f2777f56f3d171445d0',
    });
    expect(finance.authorizationBoundary).toMatchObject({
      financeArbitration: 'NOT_GRANTED',
      modelCallsAllowed: false,
      networkAuthorizationArtifact: null,
      ownerGoToken: null,
      ownerNetworkAuthorization: 'NOT_GRANTED',
    });
    const { envelopeFingerprint, ...financeCore } = finance;
    expect(envelopeFingerprint).toBe(fingerprint(financeCore));
  });

  it('attests the deterministic 4/4 fake preflight without network or replay', () => {
    const preflight = record(JSON.parse(read(preflightPath)) as unknown);
    const dossier = record(JSON.parse(read(dossierPath)) as unknown);
    const finance = record(JSON.parse(read(financePath)) as unknown);
    const manifest = record(JSON.parse(read(implementationPath)) as unknown);
    const sourceBindings = record(preflight.sourceBindings);
    for (const sourceValue of Object.values(sourceBindings)) {
      const source = sourceValue as { path: string; sha256: string };
      expect(sha256(read(source.path))).toBe(source.sha256);
    }
    expect(preflight.recordedAt).toMatch(/Z$/u);
    expect(preflight.identity).toMatchObject({
      candidateRunnerImplementationFingerprint: record(
        dossier.implementationBinding,
      ).candidateRunnerImplementationFingerprint,
      identityFingerprint: dossier.identityFingerprint,
      requestProfileFingerprint: dossier.requestProfileFingerprint,
      wireContractFingerprint: dossier.wireContractFingerprint,
    });
    expect(record(preflight.proof)).toMatchObject({
      fakeProviderExecutions: 4,
      localPatternRetained: true,
      recursiveKeywordCheck: true,
      replayModelCallsPerformed: 0,
      replayNetworkCallsAllowed: false,
      replayProviderExecutions: 0,
      requiredUsableWorkflows: '4/4',
      usableWorkflows: 4,
      wirePatternOmitted: true,
    });
    expect(preflight.executionBoundary).toEqual({
      financeArbitration: 'NOT_GRANTED',
      liveExecutionAllowed: false,
      mode: 'OFFLINE_FAKE_ONLY',
      modelCallsPerformed: 0,
      networkCallsAllowed: false,
      ownerNetworkAuthorization: 'NOT_GRANTED',
    });
    expect(preflight.caseResults).toHaveLength(4);
    expect(
      (preflight.caseResults as Array<Record<string, unknown>>).every(
        ({ status }) => status === 'VALID',
      ),
    ).toBe(true);
    expect(record(preflight.baseline).publicCommitSha).toBe(
      record(manifest.publicCode).commitSha,
    );
    expect(record(finance.campaign).identityFingerprint).toBe(
      dossier.identityFingerprint,
    );
    const { preflightFingerprint, ...preflightCore } = preflight;
    expect(preflightFingerprint).toBe(fingerprint(preflightCore));

    expect(record(preflight.proof).transportDifferentialFingerprint).toMatch(
      /^[a-f0-9]{64}$/u,
    );
  });

  it('keeps the retired Q1/R1 control plane historical and non-executable', () => {
    const dossier = record(JSON.parse(read(dossierPath)) as unknown);
    const finance = record(JSON.parse(read(financePath)) as unknown);
    const preflight = record(JSON.parse(read(preflightPath)) as unknown);

    expect(dossier.authorizationBoundary).toMatchObject({
      modelCallsAllowed: false,
      ownerGoToken: null,
      ownerNetworkAuthorization: 'NOT_GRANTED',
    });
    expect(finance.authorizationBoundary).toMatchObject({
      modelCallsAllowed: false,
      ownerGoToken: null,
      ownerNetworkAuthorization: 'NOT_GRANTED',
    });
    expect(preflight.executionBoundary).toMatchObject({
      liveExecutionAllowed: false,
      modelCallsPerformed: 0,
      networkCallsAllowed: false,
    });

    for (const retiredPath of [
      'scripts/run-writing-framework-selection-gate-v2.ts',
      'scripts/validate-gemini-3-6-transport-differential.ts',
      'src/server/ai/writing-framework-selection-gate-runner-v2.ts',
      'src/server/ai/writing-framework-selection-openrouter-provider.ts',
    ]) {
      expect(existsSync(resolve(root, retiredPath))).toBe(false);
    }
  });
});
