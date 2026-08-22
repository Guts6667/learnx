import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  candidateRunnerImplementationFingerprint,
  verifyWritingFrameworkImplementationManifest,
  writingFrameworkImplementationFingerprint,
} from './writing-framework-selection-implementation-manifest.ts';

const temporaryRoots: string[] = [];

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'learnx-r1-manifest-'));
  temporaryRoots.push(root);
  const runtimeText = 'export const frozen = true;\n';
  const packageText = '{"private":true}\n';
  await writeFile(join(root, 'runtime.ts'), runtimeText, 'utf8');
  await writeFile(join(root, 'package.json'), packageText, 'utf8');
  const manifest = {
    candidateRunnerImplementationFingerprint: '0'.repeat(64),
    dependencyFiles: {
      package: { path: 'package.json', sha256: sha256(packageText) },
    },
    dependencyFilesFingerprint: '0'.repeat(64),
    manifestFingerprint: '0'.repeat(64),
    persistenceFiles: [],
    persistenceFilesFingerprint: '0'.repeat(64),
    publicCode: {
      commitObjectFormat: 'sha1',
      commitSha: '1'.repeat(40),
      subject: 'frozen code baseline',
      treeSha: '2'.repeat(40),
    },
    runtimeFiles: [{ path: 'runtime.ts', sha256: sha256(runtimeText) }],
    runtimeFilesFingerprint: '0'.repeat(64),
    scopePolicy: {
      candidateRunnerImplementationFingerprint: '0'.repeat(64),
      postFreezeCliMayAuthorizeNetwork: false,
      postFreezeCliPath: 'runtime.ts',
      postFreezeCliRole: 'FROZEN_FAIL_CLOSED_CONTROL_PLANE' as const,
      verificationToolsAreRunnerRuntime: false,
    },
    verificationTools: [{ path: 'runtime.ts', sha256: sha256(runtimeText) }],
    verificationToolsFingerprint: '0'.repeat(64),
  };
  manifest.runtimeFilesFingerprint = writingFrameworkImplementationFingerprint(
    manifest.runtimeFiles,
  );
  manifest.persistenceFilesFingerprint =
    writingFrameworkImplementationFingerprint(manifest.persistenceFiles);
  manifest.verificationToolsFingerprint =
    writingFrameworkImplementationFingerprint(manifest.verificationTools);
  manifest.dependencyFilesFingerprint =
    writingFrameworkImplementationFingerprint(manifest.dependencyFiles);
  manifest.candidateRunnerImplementationFingerprint =
    candidateRunnerImplementationFingerprint(manifest);
  manifest.scopePolicy.candidateRunnerImplementationFingerprint =
    manifest.candidateRunnerImplementationFingerprint;
  const core: Record<string, unknown> = { ...manifest };
  delete core.manifestFingerprint;
  manifest.manifestFingerprint =
    writingFrameworkImplementationFingerprint(core);
  return { manifest, root };
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe('writing framework implementation manifest', () => {
  it('accepts the exact frozen local bytes', async () => {
    const { manifest, root } = await fixture();
    await expect(
      verifyWritingFrameworkImplementationManifest({
        manifestValue: manifest,
        root,
      }),
    ).resolves.toMatchObject({
      candidateRunnerImplementationFingerprint:
        manifest.candidateRunnerImplementationFingerprint,
    });
  });

  it('fails closed when an executed file drifts', async () => {
    const { manifest, root } = await fixture();
    await writeFile(join(root, 'runtime.ts'), 'export const frozen = false;\n');
    await expect(
      verifyWritingFrameworkImplementationManifest({
        manifestValue: manifest,
        root,
      }),
    ).rejects.toThrow('WRITING_GATE_IMPLEMENTATION_FILE_DRIFT:runtime.ts');
  });
});
