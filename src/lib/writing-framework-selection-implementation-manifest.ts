import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { z } from 'zod';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const publicCommitSchema = z.string().regex(/^[a-f0-9]{40}$/u);
const relativePathSchema = z
  .string()
  .min(1)
  .refine(
    (path) =>
      !path.startsWith('/') &&
      !path.split('/').some((segment) => segment === '..'),
    'workspace-relative path required',
  );

const fileBindingSchema = z.object({
  path: relativePathSchema,
  sha256: sha256Schema,
});

const publicCodeSchema = z
  .object({
    commitObjectFormat: z.string().min(1),
    commitSha: publicCommitSchema,
    subject: z.string().min(1),
    treeSha: publicCommitSchema,
  })
  .passthrough();

export const writingFrameworkImplementationManifestSchema = z
  .object({
    candidateRunnerImplementationFingerprint: sha256Schema,
    dependencyFiles: z.record(z.string(), fileBindingSchema),
    dependencyFilesFingerprint: sha256Schema,
    manifestFingerprint: sha256Schema,
    persistenceFiles: z.array(fileBindingSchema),
    persistenceFilesFingerprint: sha256Schema,
    publicCode: publicCodeSchema,
    runtimeFiles: z.array(fileBindingSchema).min(1),
    runtimeFilesFingerprint: sha256Schema,
    scopePolicy: z
      .object({
        candidateRunnerImplementationFingerprint: sha256Schema,
        postFreezeCliMayAuthorizeNetwork: z.literal(false),
        postFreezeCliPath: relativePathSchema,
        postFreezeCliRole: z.literal('FROZEN_FAIL_CLOSED_CONTROL_PLANE'),
        verificationToolsAreRunnerRuntime: z.literal(false),
      })
      .passthrough(),
    verificationTools: z.array(fileBindingSchema).min(1),
    verificationToolsFingerprint: sha256Schema,
  })
  .passthrough();

export type WritingFrameworkImplementationManifest = z.infer<
  typeof writingFrameworkImplementationManifestSchema
>;

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
}

export function writingFrameworkImplementationFingerprint(
  value: unknown,
): string {
  return sha256(JSON.stringify(canonicalize(value)));
}

export function candidateRunnerImplementationFingerprint(
  manifest: Pick<
    WritingFrameworkImplementationManifest,
    | 'dependencyFiles'
    | 'persistenceFiles'
    | 'publicCode'
    | 'runtimeFiles'
    | 'verificationTools'
  >,
): string {
  return writingFrameworkImplementationFingerprint({
    dependencyFiles: manifest.dependencyFiles,
    persistenceFiles: manifest.persistenceFiles,
    publicCode: manifest.publicCode,
    runtimeFiles: manifest.runtimeFiles,
    verificationTools: manifest.verificationTools,
  });
}

async function assertCurrentFileBindings(input: {
  bindings: readonly z.infer<typeof fileBindingSchema>[];
  root: string;
}): Promise<void> {
  for (const binding of input.bindings) {
    const bytes = await readFile(resolve(input.root, binding.path));
    if (sha256(bytes) !== binding.sha256) {
      throw new Error(`WRITING_GATE_IMPLEMENTATION_FILE_DRIFT:${binding.path}`);
    }
  }
}

export async function verifyWritingFrameworkImplementationManifest(input: {
  manifestValue: unknown;
  root: string;
}): Promise<WritingFrameworkImplementationManifest> {
  const manifest = writingFrameworkImplementationManifestSchema.parse(
    input.manifestValue,
  );
  const { manifestFingerprint, ...manifestCore } = manifest;
  const candidateFingerprint =
    candidateRunnerImplementationFingerprint(manifest);
  if (
    manifestFingerprint !==
      writingFrameworkImplementationFingerprint(manifestCore) ||
    manifest.runtimeFilesFingerprint !==
      writingFrameworkImplementationFingerprint(manifest.runtimeFiles) ||
    manifest.persistenceFilesFingerprint !==
      writingFrameworkImplementationFingerprint(manifest.persistenceFiles) ||
    manifest.verificationToolsFingerprint !==
      writingFrameworkImplementationFingerprint(manifest.verificationTools) ||
    manifest.dependencyFilesFingerprint !==
      writingFrameworkImplementationFingerprint(manifest.dependencyFiles) ||
    manifest.candidateRunnerImplementationFingerprint !==
      candidateFingerprint ||
    manifest.scopePolicy.candidateRunnerImplementationFingerprint !==
      candidateFingerprint
  ) {
    throw new Error('WRITING_GATE_IMPLEMENTATION_MANIFEST_INVALID');
  }
  await assertCurrentFileBindings({
    bindings: [
      ...manifest.runtimeFiles,
      ...manifest.persistenceFiles,
      ...manifest.verificationTools,
      ...Object.values(manifest.dependencyFiles),
    ],
    root: input.root,
  });
  return manifest;
}
