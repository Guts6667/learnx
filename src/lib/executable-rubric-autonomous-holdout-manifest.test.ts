import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { executableRubricAutonomousHoldoutManifestSchema } from './executable-rubric-autonomous-holdout-manifest.ts';
import {
  evidenceAssistAutonomousHoldoutConstructionSchema,
  evidenceAssistAutonomousHoldoutPrevalidationRecordSchema,
} from './evidence-assist-autonomous-holdout.ts';

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

function sha256(path: string): string {
  return createHash('sha256')
    .update(readFileSync(resolve(manifestPath, '..', path), 'utf8'))
    .digest('hex');
}

describe('autonomous evidence-assist holdout manifest', () => {
  it('keeps the independently authored holdout prevalidated but unsealed and non-executable', () => {
    const manifest =
      executableRubricAutonomousHoldoutManifestSchema.parse(manifestFixture());
    const serialized = JSON.stringify(manifest);

    expect(manifest.status).toBe(
      'CONTENT_AUTHORED_PENDING_EXPLICIT_OWNER_SEAL',
    );
    expect(manifest.qualification.status).toBe(
      'PENDING_AUTONOMOUS_QUALIFICATION',
    );
    expect(
      manifest.qualification.candidateOutputsAccessibleDuringAuthoring,
    ).toBe(false);
    expect(manifest.sealed).toBe(false);
    expect(manifest.executable).toBe(false);
    expect(manifest.caseCount).toBe(24);
    expect(manifest.pendingAuthoring).not.toBeNull();
    expect(
      sha256(manifest.pendingAuthoring?.constructionManifest.path ?? ''),
    ).toBe(manifest.pendingAuthoring?.constructionManifest.sha256);
    expect(
      sha256(manifest.pendingAuthoring?.prevalidationRecord.path ?? ''),
    ).toBe(manifest.pendingAuthoring?.prevalidationRecord.sha256);
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

  it('rejects a pending authoring snapshot that claims encryption or execution', () => {
    const manifest = manifestFixture();
    manifest['executable'] = true;

    expect(() =>
      executableRubricAutonomousHoldoutManifestSchema.parse(manifest),
    ).toThrow();
  });

  it('binds pending authoring to independently hashed construction and prevalidation records', () => {
    const manifest =
      executableRubricAutonomousHoldoutManifestSchema.parse(manifestFixture());
    const pending = manifest.pendingAuthoring;
    if (!pending) throw new Error('PENDING_AUTHORING_MISSING');
    const construction = evidenceAssistAutonomousHoldoutConstructionSchema.parse(
      JSON.parse(
        readFileSync(
          resolve(manifestPath, '..', pending.constructionManifest.path),
          'utf8',
        ),
      ) as unknown,
    );
    const prevalidation =
      evidenceAssistAutonomousHoldoutPrevalidationRecordSchema.parse(
        JSON.parse(
          readFileSync(
            resolve(manifestPath, '..', pending.prevalidationRecord.path),
            'utf8',
          ),
        ) as unknown,
      );

    expect(construction.status).toContain('PENDING_EXPLICIT_OWNER_SEAL');
    expect(prevalidation.status).toBe(
      'PREVALIDATED_NOT_QUALIFIED_NOT_SEALED',
    );
    expect(prevalidation.constructionManifestSha256).toBe(
      pending.constructionManifest.sha256,
    );
    expect(prevalidation.plaintextSha256).toBe(pending.plaintextSha256);
    expect(prevalidation.humanValidationClaimed).toBe(false);
  });
});
