import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { validateAutonomousGeminiCampaign } from './autonomous-gemini-campaign.ts';

const root = resolve('benchmarks/ai-correction/autonomous');
const campaignDirectory = resolve(root, 'gemini-mini-panel-v1');
const phasePath = resolve('docs/V4_AI_CORRECTION_PHASE_MANIFEST.json');

async function jsonWithText(path: string): Promise<{ parsed: unknown; text: string }> {
  const text = await readFile(path, 'utf8');
  return { parsed: JSON.parse(text) as unknown, text };
}

async function campaignArtifacts() {
  const [configuration, corpus, manifest, phase] = await Promise.all([
    jsonWithText(resolve(campaignDirectory, 'configuration.json')),
    jsonWithText(resolve(root, 'writing-fr-development-mini-panel.v1.json')),
    jsonWithText(resolve(campaignDirectory, 'manifest.json')),
    jsonWithText(phasePath),
  ]);
  return { configuration, corpus, manifest, phase };
}

describe('autonomous Gemini mini-panel preparation', () => {
  it('binds a fresh 10x2 matrix to the autonomous corpus and phase manifest', async () => {
    const artifacts = await campaignArtifacts();
    const result = validateAutonomousGeminiCampaign({
      configuration: artifacts.configuration.parsed,
      configurationText: artifacts.configuration.text,
      corpus: artifacts.corpus.parsed,
      corpusText: artifacts.corpus.text,
      manifest: artifacts.manifest.parsed,
      phaseManifest: artifacts.phase.parsed,
      phaseManifestText: artifacts.phase.text,
    });

    expect(result.manifest.matrix).toHaveLength(20);
    expect(result.configuration.execution).toMatchObject({
      freshLogicalWorkflows: 20,
      historicalResultsReused: 0,
      reusePolicy: 'FRESH_ALL_20_NO_HISTORICAL_REUSE',
    });
    expect(result.manifest.holdoutAccess).toBe('PROHIBITED');
  });

  it('cannot be executed or priced before separate validations', async () => {
    const artifacts = await campaignArtifacts();
    const result = validateAutonomousGeminiCampaign({
      configuration: artifacts.configuration.parsed,
      configurationText: artifacts.configuration.text,
      corpus: artifacts.corpus.parsed,
      corpusText: artifacts.corpus.text,
      manifest: artifacts.manifest.parsed,
      phaseManifest: artifacts.phase.parsed,
      phaseManifestText: artifacts.phase.text,
    });

    expect(result.manifest.executable).toBe(false);
    expect(result.configuration.feature).toMatchObject({
      enabled: false,
      networkCallsAllowed: false,
    });
    expect(result.configuration.authorization.granted).toBe(false);
    expect(result.configuration.candidate).toMatchObject({
      modelId: null,
      modelSnapshot: null,
      providerRoute: null,
      providerRouteValidated: false,
    });
    expect(result.configuration.budget).toMatchObject({
      expectedCostUsd: null,
      hardCapUsd: null,
      maximumProviderAttempts: null,
      pricingSnapshotId: null,
    });
  });

  it('records P0 and disposable Neon rehearsal without enabling the campaign', async () => {
    const artifacts = await campaignArtifacts();
    const result = validateAutonomousGeminiCampaign({
      configuration: artifacts.configuration.parsed,
      configurationText: artifacts.configuration.text,
      corpus: artifacts.corpus.parsed,
      corpusText: artifacts.corpus.text,
      manifest: artifacts.manifest.parsed,
      phaseManifest: artifacts.phase.parsed,
      phaseManifestText: artifacts.phase.text,
    });

    expect(result.configuration.blockers.dispatchCostReconciliation.status).toBe(
      'IMPLEMENTED_AND_NEON_REHEARSED',
    );
    expect(result.configuration.blockers.neonRehearsal).toEqual({
      sharedDatabaseAllowed: false,
      status: 'COMPLETED_ON_DISPOSABLE_BRANCH',
      target: 'DISPOSABLE_NEON_BRANCH',
    });
    expect(result.manifest.executable).toBe(false);
  });

  it('rejects any digest drift before execution can be considered', async () => {
    const artifacts = await campaignArtifacts();
    expect(() =>
      validateAutonomousGeminiCampaign({
        configuration: artifacts.configuration.parsed,
        configurationText: `${artifacts.configuration.text}\n`,
        corpus: artifacts.corpus.parsed,
        corpusText: artifacts.corpus.text,
        manifest: artifacts.manifest.parsed,
        phaseManifest: artifacts.phase.parsed,
        phaseManifestText: artifacts.phase.text,
      }),
    ).toThrow('AUTONOMOUS_GEMINI_CONFIGURATION_DIGEST_MISMATCH');
  });
});
