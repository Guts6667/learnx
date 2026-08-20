import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { executableRubricAutonomousHoldoutManifestSchema } from './executable-rubric-autonomous-holdout-manifest.ts';
import {
  evidenceAssistAutonomousHoldoutConstructionSchema,
  evidenceAssistAutonomousHoldoutPrevalidationRecordSchema,
  evidenceAssistAutonomousHoldoutQualificationRecordSchema,
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
  it('keeps the independently authored holdout qualified, sealed and non-executable', () => {
    const manifest =
      executableRubricAutonomousHoldoutManifestSchema.parse(manifestFixture());
    const serialized = JSON.stringify(manifest);

    expect(manifest.status).toBe('SEALED_AWAITING_DEVELOPMENT_GO');
    expect(manifest.qualification.status).toBe('QUALIFIED');
    expect(
      manifest.qualification.candidateOutputsAccessibleDuringAuthoring,
    ).toBe(false);
    expect(manifest.sealed).toBe(true);
    expect(manifest.executable).toBe(false);
    expect(manifest.caseCount).toBe(24);
    expect(manifest.pendingAuthoring).toBeNull();
    expect(manifest.qualificationRecord).not.toBeNull();
    expect(
      sha256(manifest.qualificationRecord?.path ?? ''),
    ).toBe(manifest.qualificationRecord?.sha256);
    expect(
      sha256(manifest.encryptedArtifact.path),
    ).toBe(manifest.encryptedArtifact.sha256);
    expect(serialized).not.toMatch(/human|reviewer/iu);
  });

  it('rejects sealing without every autonomous proof', () => {
    const manifest = manifestFixture();
    const qualification = manifest['qualification'] as Record<string, unknown>;
    const gates = qualification['gates'] as Record<string, unknown>;
    gates['mutation'] = false;

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

  it('rejects execution before the distinct one-shot opening authorization', () => {
    const manifest = manifestFixture();
    manifest['executable'] = true;

    expect(() =>
      executableRubricAutonomousHoldoutManifestSchema.parse(manifest),
    ).toThrow();
  });

  it('rejects a sealed manifest without its qualification record', () => {
    const manifest = manifestFixture();
    manifest['qualificationRecord'] = null;

    expect(() =>
      executableRubricAutonomousHoldoutManifestSchema.parse(manifest),
    ).toThrow();
  });

  it('binds autonomous qualification to construction, prevalidation and ciphertext hashes', () => {
    const manifest =
      executableRubricAutonomousHoldoutManifestSchema.parse(manifestFixture());
    const qualificationReference = manifest.qualificationRecord;
    if (!qualificationReference) {
      throw new Error('QUALIFICATION_RECORD_MISSING');
    }
    const construction = evidenceAssistAutonomousHoldoutConstructionSchema.parse(
      JSON.parse(
        readFileSync(
          resolve(
            manifestPath,
            '..',
            'writing-fr-holdout.v3.construction.json',
          ),
          'utf8',
        ),
      ) as unknown,
    );
    const prevalidation =
      evidenceAssistAutonomousHoldoutPrevalidationRecordSchema.parse(
        JSON.parse(
          readFileSync(
            resolve(
              manifestPath,
              '..',
              'writing-fr-holdout.v3.prevalidation.json',
            ),
            'utf8',
          ),
        ) as unknown,
      );
    const qualification =
      evidenceAssistAutonomousHoldoutQualificationRecordSchema.parse(
        JSON.parse(
          readFileSync(
            resolve(manifestPath, '..', qualificationReference.path),
            'utf8',
          ),
        ) as unknown,
      );

    expect(construction.status).toContain('PENDING_EXPLICIT_OWNER_SEAL');
    expect(prevalidation.status).toBe(
      'PREVALIDATED_NOT_QUALIFIED_NOT_SEALED',
    );
    expect(prevalidation.constructionManifestSha256).toBe(
      qualification.constructionManifestSha256,
    );
    expect(prevalidation.plaintextSha256).toBe(qualification.plaintextSha256);
    expect(prevalidation.humanValidationClaimed).toBe(false);
    expect(qualification.encryptedArtifactSha256).toBe(
      manifest.encryptedArtifact.sha256,
    );
    expect(qualification.humanValidationClaimed).toBe(false);
    expect(qualification.authorization.scope).toContain('NO_OPEN');
    expect(
      readFileSync(
        resolve(manifestPath, '..', manifest.encryptedArtifact.path),
        'utf8',
      ),
    ).not.toMatch(/responseText|expectedRelations/u);
  });
});
