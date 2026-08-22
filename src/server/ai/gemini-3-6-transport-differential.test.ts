import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  assertGemini36TransportDifferential,
  buildGemini36TransportDifferential,
  GEMINI_3_6_TRANSPORT_DIFFERENTIAL_PATHS,
  type Gemini36TransportDifferentialInput,
} from './gemini-3-6-transport-differential.ts';

const root = process.cwd();

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8');
}

function loadInput(): Gemini36TransportDifferentialInput {
  const correctedDossierText = read(
    GEMINI_3_6_TRANSPORT_DIFFERENTIAL_PATHS.correctedDossier,
  );
  const dossier = JSON.parse(correctedDossierText) as {
    authorities: Record<string, { path: string }>;
  };
  return {
    acceptedCampaignText: read(
      GEMINI_3_6_TRANSPORT_DIFFERENTIAL_PATHS.acceptedCampaign,
    ),
    acceptedCorpusText: read(
      GEMINI_3_6_TRANSPORT_DIFFERENTIAL_PATHS.acceptedCorpus,
    ),
    acceptedResultText: read(
      GEMINI_3_6_TRANSPORT_DIFFERENTIAL_PATHS.acceptedResult,
    ),
    acceptedRubricText: read(
      GEMINI_3_6_TRANSPORT_DIFFERENTIAL_PATHS.acceptedRubric,
    ),
    correctedAuthorityTexts: Object.fromEntries(
      Object.values(dossier.authorities).map(({ path }) => [path, read(path)]),
    ),
    correctedDossierText,
    correctedFinanceText: read(
      GEMINI_3_6_TRANSPORT_DIFFERENTIAL_PATHS.correctedFinance,
    ),
  };
}

describe('Gemini 3.6 offline transport differential', () => {
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
