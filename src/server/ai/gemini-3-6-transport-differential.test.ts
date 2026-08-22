import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  assertGemini36TransportDifferential,
  buildGemini36TransportDifferential,
  gemini36TransportDifferentialPaths,
  type Gemini36TransportDifferentialCandidate,
  type Gemini36TransportDifferentialInput,
} from './gemini-3-6-transport-differential.ts';

const root = process.cwd();

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8');
}

function r1ImplementationManifestPath(): string {
  const path =
    gemini36TransportDifferentialPaths(
      'gemini-3.6-r1',
    ).correctedImplementationManifest;
  if (path === null) throw new Error('R1_IMPLEMENTATION_MANIFEST_PATH_MISSING');
  return path;
}

function loadInput(
  candidate: Gemini36TransportDifferentialCandidate = 'gemini-3.6',
): Gemini36TransportDifferentialInput {
  const paths = gemini36TransportDifferentialPaths(candidate);
  const correctedDossierText = read(paths.correctedDossier);
  const dossier = JSON.parse(correctedDossierText) as {
    authorities: Record<string, { path: string }>;
  };
  return {
    acceptedCampaignText: read(paths.acceptedCampaign),
    acceptedCorpusText: read(paths.acceptedCorpus),
    acceptedResultText: read(paths.acceptedResult),
    acceptedRubricText: read(paths.acceptedRubric),
    candidate,
    correctedAuthorityTexts: Object.fromEntries(
      Object.values(dossier.authorities).map(({ path }) => [path, read(path)]),
    ),
    correctedDossierText,
    correctedFinanceText: read(paths.correctedFinance),
  };
}

function runJsonScript(
  path: string,
  candidate: Gemini36TransportDifferentialCandidate,
): Record<string, unknown> {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', path, `--candidate=${candidate}`],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, OPENROUTER_API_KEY: '' },
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

describe('Gemini 3.6 offline transport differential', () => {
  it('fails closed for an unknown candidate', () => {
    expect(() =>
      gemini36TransportDifferentialPaths(
        'gemini-unknown' as Gemini36TransportDifferentialCandidate,
      ),
    ).toThrow('GEMINI_DIFFERENTIAL_UNKNOWN_CANDIDATE:gemini-unknown');
  });

  it('matches every frozen transport invariant and observes only declared differences', () => {
    const report = buildGemini36TransportDifferential(loadInput());

    expect(() => assertGemini36TransportDifferential(report)).not.toThrow();
    expect(report.status).toBe(
      'VALIDATED_INVARIANTS_WITH_EXPECTED_PROTOCOL_DIFFERENCES',
    );
    expect(report.invariants).toEqual([
      {
        accepted: 'google/gemini-3.6-flash',
        corrected: 'google/gemini-3.6-flash',
        matches: true,
        name: 'WIRE_MODEL',
      },
      {
        accepted: 'google/gemini-3.6-flash-20260721',
        corrected: 'google/gemini-3.6-flash-20260721',
        matches: true,
        name: 'CATALOG_SNAPSHOT',
      },
      {
        accepted: 'google-vertex/global',
        corrected: 'google-vertex/global',
        matches: true,
        name: 'REQUESTED_ROUTE',
      },
      {
        accepted: 'Google',
        corrected: 'Google',
        matches: true,
        name: 'ROUTE_PROVIDER',
      },
      {
        accepted: 'MINIMAL',
        corrected: 'MINIMAL',
        matches: true,
        name: 'REASONING_EFFORT',
      },
      {
        accepted: 2500,
        corrected: 2500,
        matches: true,
        name: 'MAX_TOKENS',
      },
      {
        accepted: true,
        corrected: true,
        matches: true,
        name: 'TEMPERATURE_OMITTED',
      },
      {
        accepted: 'json_schema',
        corrected: 'json_schema',
        matches: true,
        name: 'RESPONSE_FORMAT_TYPE',
      },
      {
        accepted: true,
        corrected: true,
        matches: true,
        name: 'RESPONSE_FORMAT_STRICT',
      },
      {
        accepted: true,
        corrected: true,
        matches: true,
        name: 'FALLBACK_DISABLED',
      },
    ]);
    expect(
      report.expectedDifferences.map(({ name, observed }) => ({
        name,
        observed,
      })),
    ).toEqual([
      { name: 'MESSAGES_AND_TRUST_BOUNDARY', observed: true },
      { name: 'PROTOCOL', observed: true },
      { name: 'WIRE_SCHEMA', observed: true },
    ]);
    expect(report.expectedDifferences[2]?.corrected).toMatchObject({
      patternPresent: false,
      rootKeys: ['findings'],
      wireDialect: 'GEMINI_WIRE_3_0_1',
      wireDialectVersion: 'evidence-assist-wire/3.0.1',
    });
  });

  it('is reproducible and performs no network, model, write, identity, finance, or GO action', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const input = loadInput();

    const first = buildGemini36TransportDifferential(input);
    const second = buildGemini36TransportDifferential(input);

    expect(first.reportFingerprint).toBe(second.reportFingerprint);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(first.comparisonExecution).toEqual({
      mode: 'VALIDATE_ONLY',
      modelCallsPerformed: 0,
      networkCallsPerformed: 0,
      writesPerformed: 0,
    });
    expect(first.authorityEffects).toEqual({
      financeArbitrationCreated: false,
      identityCreated: false,
      networkGoGranted: false,
      ownerAuthorizationCreated: false,
    });
    fetchSpy.mockRestore();
  });

  it('validates R1 from its dossier, Finance draft, and implementation manifest without changing common invariants', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const historical = buildGemini36TransportDifferential(loadInput());
    const r1Input = loadInput('gemini-3.6-r1');
    const r1 = buildGemini36TransportDifferential(r1Input);
    const r1Paths = gemini36TransportDifferentialPaths('gemini-3.6-r1');
    const manifestPath = r1ImplementationManifestPath();
    const manifest = JSON.parse(read(manifestPath)) as {
      manifestFingerprint: string;
      publicCode: { commitSha: string };
    };

    expect(() => assertGemini36TransportDifferential(r1)).not.toThrow();
    expect(r1.invariants).toEqual(historical.invariants);
    expect(r1.expectedDifferences).toEqual(historical.expectedDifferences);
    expect(r1.correctedReference).toMatchObject({
      financeModelCallsAllowed: false,
      identityState: 'R1_FROZEN_HARD_OFF',
    });
    expect(r1.sources.correctedDossier.path).toBe(r1Paths.correctedDossier);
    expect(r1.sources.correctedFinance.path).toBe(r1Paths.correctedFinance);
    expect(r1.sources.correctedImplementationManifest).toMatchObject({
      manifestFingerprint: manifest.manifestFingerprint,
      path: manifestPath,
      publicCodeCommitSha: manifest.publicCode.commitSha,
    });
    expect(r1.comparisonExecution).toEqual({
      mode: 'VALIDATE_ONLY',
      modelCallsPerformed: 0,
      networkCallsPerformed: 0,
      writesPerformed: 0,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('runs the R1 fake preflight 4/4, replays from storage, and validates the offline differential CLI', () => {
    const preflight = runJsonScript(
      'scripts/preflight-writing-framework-selection-gate-v2.ts',
      'gemini-3.6-r1',
    );
    const differential = runJsonScript(
      'scripts/validate-gemini-3-6-transport-differential.ts',
      'gemini-3.6-r1',
    );

    expect(preflight).toMatchObject({
      candidate: 'gemini-3.6-r1',
      mode: 'OFFLINE_FAKE_ONLY',
      modelCallsPerformed: 0,
      networkCallsAllowed: false,
      providerExecutions: 4,
      replayModelCallsPerformed: 0,
      replayNetworkCallsAllowed: false,
      replayProviderExecutions: 0,
      status: 'HARD_OFF_PREFLIGHT_GREEN',
      usableWorkflows: 4,
    });
    expect(preflight.attempts).toHaveLength(4);
    expect(preflight.implementationManifest).toMatchObject({
      path: gemini36TransportDifferentialPaths('gemini-3.6-r1')
        .correctedImplementationManifest,
    });
    expect(differential).toMatchObject({
      candidate: 'gemini-3.6-r1',
      comparisonExecution: {
        mode: 'VALIDATE_ONLY',
        modelCallsPerformed: 0,
        networkCallsPerformed: 0,
        writesPerformed: 0,
      },
      status: 'VALIDATED_INVARIANTS_WITH_EXPECTED_PROTOCOL_DIFFERENCES',
    });
  });

  it('fails closed when the R1 implementation manifest source is absent', () => {
    const input = loadInput('gemini-3.6-r1');
    const manifestPath = r1ImplementationManifestPath();
    const authorityTexts = Object.fromEntries(
      Object.entries(input.correctedAuthorityTexts).filter(
        ([path]) => path !== manifestPath,
      ),
    );

    expect(() =>
      buildGemini36TransportDifferential({
        ...input,
        correctedAuthorityTexts: authorityTexts,
      }),
    ).toThrow(`WRITING_GATE_AUTHORITY_MISMATCH:${manifestPath}`);
  });

  it('fails closed when the accepted campaign/result linkage is altered', () => {
    const input = loadInput();

    expect(() =>
      buildGemini36TransportDifferential({
        ...input,
        acceptedCampaignText: `\n${input.acceptedCampaignText}`,
      }),
    ).toThrow('GEMINI_DIFFERENTIAL_ACCEPTED_LINKAGE_HASH_MISMATCH');
    expect(() =>
      buildGemini36TransportDifferential({
        ...input,
        acceptedResultText: `\n${input.acceptedResultText}`,
      }),
    ).toThrow('GEMINI_DIFFERENTIAL_ACCEPTED_SOURCE_HASH_MISMATCH');
  });
});
