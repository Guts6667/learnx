import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  autonomousCaseDigest,
  autonomousOracleDigest,
  parseAutonomousFormativeCorpus,
  parseAutonomousHoldout,
} from './autonomous-formative-corpus.ts';

const directory = resolve('benchmarks/ai-correction/autonomous');

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(directory, path), 'utf8')) as unknown;
}

describe('autonomous formative corpus', () => {
  it('seals ten development cases and the 10x2 execution plan without human review', async () => {
    const raw = await readJson('writing-fr-development-mini-panel.v1.json');
    const corpus = parseAutonomousFormativeCorpus(raw);

    expect('humanReview' in (raw as Record<string, unknown>)).toBe(false);
    expect(corpus.oracleType).toBe('SEALED_AUTONOMOUS');
    expect(corpus.executionPlan).toEqual({
      expectedLogicalWorkflows: 20,
      repetitionsPerCase: 2,
    });
    expect(corpus.cases).toHaveLength(10);

    for (const benchmarkCase of corpus.cases) {
      const { caseDigest, ...caseWithoutDigest } = benchmarkCase;
      expect(caseDigest).toBe(autonomousCaseDigest(caseWithoutDigest));
    }
    expect(corpus.oracleDigest).toBe(autonomousOracleDigest(corpus.cases));
  });

  it('keeps the autonomous holdout distinct, sealed and internally exact', async () => {
    const raw = await readJson('writing-fr-holdout.v1.json');
    const holdout = parseAutonomousHoldout(raw);

    expect('humanReview' in (raw as Record<string, unknown>)).toBe(false);
    expect(holdout.sealed).toBe(true);
    expect(holdout.openedAt).toBeNull();

    for (const benchmarkCase of holdout.cases) {
      const { caseDigest, ...caseWithoutDigest } = benchmarkCase;
      expect(caseDigest).toBe(autonomousCaseDigest(caseWithoutDigest));
      for (const quote of benchmarkCase.expectedEvidenceQuotes) {
        expect(benchmarkCase.responseText).toContain(quote);
      }
      if (benchmarkCase.injectionBoundary) {
        expect(benchmarkCase.responseText).toBe(
          `${benchmarkCase.injectionBoundary.legitimateResponseText} ${benchmarkCase.injectionBoundary.attackText}`,
        );
        for (const quote of benchmarkCase.expectedEvidenceQuotes) {
          expect(benchmarkCase.injectionBoundary.legitimateResponseText).toContain(quote);
        }
      }
    }
    expect(holdout.oracleDigest).toBe(autonomousOracleDigest(holdout.cases));
  });

  it('binds the sealed artifacts to the autonomous manifest', async () => {
    const manifest = (await readJson('manifest.v1.json')) as {
      development: { path: string; sha256: string };
      holdout: { path: string; sha256: string };
      humanValidationClaimed: boolean;
      oracleType: string;
    };
    const sha256 = (value: string) =>
      createHash('sha256').update(value).digest('hex');

    expect(manifest.humanValidationClaimed).toBe(false);
    expect(manifest.oracleType).toBe('SEALED_AUTONOMOUS');
    await expect(
      readFile(resolve(directory, manifest.development.path), 'utf8').then(sha256),
    ).resolves.toBe(manifest.development.sha256);
    await expect(
      readFile(resolve(directory, manifest.holdout.path), 'utf8').then(sha256),
    ).resolves.toBe(manifest.holdout.sha256);
  });
});
