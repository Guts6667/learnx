import { readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import { compileExecutableRubric } from '../src/lib/executable-rubric-engine.ts';
import {
  executableRubricHoldoutManifestSchema,
  sealExecutableRubricHoldout,
  serializeSealedHoldoutArtifact,
  validateExecutableRubricHoldoutPlaintext,
} from '../src/lib/executable-rubric-sealed-holdout.ts';

function parseFlag(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv.slice(2).find((argument) => argument.startsWith(prefix));
  if (!value) throw new Error(`MISSING_${name.toUpperCase().replaceAll('-', '_')}`);
  return value.slice(prefix.length);
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

async function atomicWrite(path: string, value: string): Promise<void> {
  const temporaryPath = `${path}.tmp-${process.pid}`;
  await writeFile(temporaryPath, value, { encoding: 'utf8', mode: 0o600 });
  await rename(temporaryPath, path);
}

function pathIsInside(path: string, directory: string): boolean {
  const relation = relative(directory, path);
  return relation === '' || (!relation.startsWith('..') && !isAbsolute(relation));
}

async function main(): Promise<void> {
  const repositoryRoot = process.cwd();
  const inputPath = resolve(parseFlag('input'));
  const manifestPath = resolve(parseFlag('manifest'));
  const outputPath = resolve(parseFlag('output'));
  const rubricPath = resolve(parseFlag('rubric'));
  if (pathIsInside(inputPath, repositoryRoot)) {
    throw new Error('SEALED_HOLDOUT_PLAINTEXT_MUST_REMAIN_OUTSIDE_REPOSITORY');
  }

  const keyBase64 = process.env['LEARNX_HOLDOUT_SEALING_KEY_BASE64'];
  if (!keyBase64) throw new Error('SEALED_HOLDOUT_KEY_MISSING');
  const key = Buffer.from(keyBase64, 'base64');
  if (key.byteLength !== 32) throw new Error('SEALED_HOLDOUT_KEY_LENGTH_INVALID');

  const manifest = executableRubricHoldoutManifestSchema.parse(
    await readJson(manifestPath),
  );
  const expectedOutputPath = resolve(
    dirname(manifestPath),
    manifest.encryptedArtifact.path,
  );
  if (outputPath !== expectedOutputPath) {
    throw new Error('SEALED_HOLDOUT_OUTPUT_PATH_MISMATCH');
  }
  const compiled = compileExecutableRubric(await readJson(rubricPath));
  const plaintext = validateExecutableRubricHoldoutPlaintext({
    compiled,
    plaintext: await readJson(inputPath),
  });
  const sealed = sealExecutableRubricHoldout({ key, manifest, plaintext });

  await atomicWrite(outputPath, serializeSealedHoldoutArtifact(sealed.envelope));
  await atomicWrite(
    manifestPath,
    serializeSealedHoldoutArtifact(sealed.manifest),
  );
  process.stdout.write(
    JSON.stringify({
      artifactSha256: sealed.artifactSha256,
      caseCount: plaintext.cases.length,
      manifestPath,
      outputPath,
      reviewedContentSha256:
        sealed.manifest.review.reviewedContentSha256,
      status: sealed.manifest.status,
    }) + '\n',
  );
}

await main();
