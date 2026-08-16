import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { executableRubricAutonomousHoldoutManifestSchema } from './executable-rubric-autonomous-holdout-manifest.ts';

const manifestPath = resolve(
  process.cwd(),
  'benchmarks/ai-correction/executable-rubric/writing-fr-holdout.v3.manifest.json',
);

function manifestFixture(): Record<string, unknown> {
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<
    string,
    unknown
  >;
}

describe('autonomous evidence-assist holdout manifest', () => {
  it('keeps the replacement holdout empty, unsealed and non-executable', () => {
    const manifest =
      executableRubricAutonomousHoldoutManifestSchema.parse(manifestFixture());
    const serialized = JSON.stringify(manifest);

    expect(manifest.status).toBe('CONTENT_NOT_AUTHORED');
    expect(manifest.qualification.status).toBe(
      'PENDING_AUTONOMOUS_QUALIFICATION',
    );
    expect(
      manifest.qualification.candidateOutputsAccessibleDuringAuthoring,
    ).toBe(false);
    expect(manifest.sealed).toBe(false);
    expect(manifest.executable).toBe(false);
    expect(serialized).not.toMatch(/human|reviewer/iu);
  });

  it('rejects sealing without every autonomous proof and ciphertext', () => {
    const manifest = manifestFixture();
    manifest['sealed'] = true;
    manifest['status'] = 'SEALED_AWAITING_DEVELOPMENT_GO';

    expect(() =>
      executableRubricAutonomousHoldoutManifestSchema.parse(manifest),
    ).toThrow();
  });

  it('rejects access to candidate outputs during holdout authoring', () => {
    const manifest = manifestFixture();
    const qualification = manifest['qualification'] as Record<string, unknown>;
    qualification['candidateOutputsAccessibleDuringAuthoring'] = true;

    expect(() =>
      executableRubricAutonomousHoldoutManifestSchema.parse(manifest),
    ).toThrow();
  });

  it('rejects partial proof while autonomous qualification is pending', () => {
    const manifest = manifestFixture();
    const qualification = manifest['qualification'] as Record<string, unknown>;
    qualification['constructionManifestSha256'] = 'a'.repeat(64);

    expect(() =>
      executableRubricAutonomousHoldoutManifestSchema.parse(manifest),
    ).toThrow();
  });
});
