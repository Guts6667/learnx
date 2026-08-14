import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  autonomousCaseDigest,
  autonomousOracleDigest,
  parseAutonomousFormativeCorpus,
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

  it('binds development and the non-executable replacement holdout manifest', async () => {
    const manifest = (await readJson('manifest.v1.json')) as {
      development: { path: string; sha256: string };
      holdout: {
        executable: boolean;
        legacyPlaintext: { sha256: string; status: string };
        replacementManifest: { path: string; sha256: string };
        sealed: boolean;
        status: string;
      };
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
    expect(manifest.holdout.status).toBe(
      'REPLACEMENT_PENDING_INDEPENDENT_REVIEW',
    );
    expect(manifest.holdout.sealed).toBe(false);
    expect(manifest.holdout.executable).toBe(false);
    expect(manifest.holdout.legacyPlaintext.status).toBe(
      'COMPROMISED_PLAINTEXT_REMOVED_FROM_ACTIVE_TREE',
    );
    expect(manifest.holdout.legacyPlaintext.sha256).toBe(
      'bac15807866e1e0237c6535aec66b3221546b77c56ab1821c5af53dacf470589',
    );
    await expect(
      readFile(
        resolve(directory, manifest.holdout.replacementManifest.path),
        'utf8',
      ).then(sha256),
    ).resolves.toBe(manifest.holdout.replacementManifest.sha256);
  });
});
