import { createHash } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

import {
  canonicalAutonomousHoldoutJson,
  evidenceAssistAutonomousHoldoutConstructionSchema,
  evidenceAssistAutonomousHoldoutPrevalidationRecordSchema,
  evidenceAssistAutonomousHoldoutQualificationRecordSchema,
  sealEvidenceAssistAutonomousHoldout,
  validateEvidenceAssistAutonomousHoldout,
} from '../src/lib/evidence-assist-autonomous-holdout.js';
import { compileExecutableRubric } from '../src/lib/executable-rubric-engine.js';
import { executableRubricAutonomousHoldoutManifestSchema } from '../src/lib/executable-rubric-autonomous-holdout-manifest.js';

const AUTHORIZATION = 'AUTHORIZE_V4_HOLDOUT_V3_QUALIFICATION_AND_SEAL';
const AUTHORIZATION_SCOPE =
  'QUALIFICATION_AND_SEAL_ONLY_NO_OPEN_NO_EXECUTION_NO_MODEL_CALL';
const MANIFEST_RELATIVE_PATH =
  'benchmarks/ai-correction/executable-rubric/writing-fr-holdout.v3.manifest.json';
const QUALIFICATION_RECORD_NAME =
  'writing-fr-holdout.v3.qualification.json';

function flag(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv.slice(2).find((item) => item.startsWith(prefix));
  if (!value) throw new Error(`AUTONOMOUS_HOLDOUT_${name.toUpperCase()}_MISSING`);
  return value.slice(prefix.length);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function readText(path: string): Promise<string> {
  return readFile(path, 'utf8');
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readText(path)) as unknown;
}

function pathIsInside(path: string, directory: string): boolean {
  const relation = relative(directory, path);
  return relation === '' || (!relation.startsWith('..') && !isAbsolute(relation));
}

async function atomicWrite(path: string, value: string): Promise<void> {
  const temporaryPath = `${path}.tmp-${process.pid}`;
  await writeFile(temporaryPath, value, { encoding: 'utf8', mode: 0o600 });
  await rename(temporaryPath, path);
}

async function requireArtifactHash(input: {
  expectedSha256: string;
  path: string;
  root: string;
}): Promise<void> {
  const actual = sha256(await readText(resolve(input.root, input.path)));
  if (actual !== input.expectedSha256) {
    throw new Error('AUTONOMOUS_HOLDOUT_AUTHORITY_ARTIFACT_SHA256_MISMATCH');
  }
}

async function main(): Promise<void> {
  const repositoryRoot = process.cwd();
  const plaintextPath = resolve(flag('plaintext'));
  if (pathIsInside(plaintextPath, repositoryRoot)) {
    throw new Error('AUTONOMOUS_HOLDOUT_PLAINTEXT_MUST_STAY_OUTSIDE_REPOSITORY');
  }
  if (flag('authorization') !== AUTHORIZATION) {
    throw new Error('AUTONOMOUS_HOLDOUT_OWNER_AUTHORIZATION_INVALID');
  }

  const keyBase64 = process.env['LEARNX_HOLDOUT_V3_SEALING_KEY_BASE64'];
  if (!keyBase64) throw new Error('AUTONOMOUS_HOLDOUT_KEY_MISSING');
  const key = Buffer.from(keyBase64, 'base64');
  if (key.byteLength !== 32) {
    throw new Error('AUTONOMOUS_HOLDOUT_KEY_LENGTH_INVALID');
  }

  const manifestPath = resolve(repositoryRoot, MANIFEST_RELATIVE_PATH);
  const artifactDirectory = resolve(manifestPath, '..');
  const manifest = executableRubricAutonomousHoldoutManifestSchema.parse(
    await readJson(manifestPath),
  );
  if (
    manifest.status !== 'CONTENT_AUTHORED_PENDING_EXPLICIT_OWNER_SEAL' ||
    manifest.pendingAuthoring === null ||
    manifest.sealed ||
    manifest.executable
  ) {
    throw new Error('AUTONOMOUS_HOLDOUT_NOT_PENDING_OWNER_SEAL');
  }

  const constructionPath = resolve(
    artifactDirectory,
    manifest.pendingAuthoring.constructionManifest.path,
  );
  const prevalidationPath = resolve(
    artifactDirectory,
    manifest.pendingAuthoring.prevalidationRecord.path,
  );
  const constructionText = await readText(constructionPath);
  const prevalidationText = await readText(prevalidationPath);
  if (
    sha256(constructionText) !==
      manifest.pendingAuthoring.constructionManifest.sha256 ||
    sha256(prevalidationText) !==
      manifest.pendingAuthoring.prevalidationRecord.sha256
  ) {
    throw new Error('AUTONOMOUS_HOLDOUT_PENDING_PROOF_SHA256_MISMATCH');
  }
  const construction = evidenceAssistAutonomousHoldoutConstructionSchema.parse(
    JSON.parse(constructionText) as unknown,
  );
  const prevalidation =
    evidenceAssistAutonomousHoldoutPrevalidationRecordSchema.parse(
      JSON.parse(prevalidationText) as unknown,
    );

  await requireArtifactHash({
    expectedSha256: construction.artifacts.binding.sha256,
    path: construction.artifacts.binding.path,
    root: repositoryRoot,
  });
  await requireArtifactHash({
    expectedSha256: construction.artifacts.rubric.sha256,
    path: construction.artifacts.rubric.path,
    root: repositoryRoot,
  });
  const compiled = compileExecutableRubric(
    await readJson(resolve(repositoryRoot, construction.artifacts.rubric.path)),
  );
  if (
    compiled.rubricFingerprint !==
    construction.artifacts.rubric.compiledFingerprint
  ) {
    throw new Error('AUTONOMOUS_HOLDOUT_COMPILED_RUBRIC_MISMATCH');
  }

  const { holdout, summary } = validateEvidenceAssistAutonomousHoldout({
    compiled,
    holdout: await readJson(plaintextPath),
  });
  const plaintextSha256 = sha256(canonicalAutonomousHoldoutJson(holdout));
  if (
    plaintextSha256 !== manifest.pendingAuthoring.plaintextSha256 ||
    plaintextSha256 !== construction.plaintextSha256 ||
    plaintextSha256 !== prevalidation.plaintextSha256 ||
    prevalidation.constructionManifestSha256 !== sha256(constructionText)
  ) {
    throw new Error('AUTONOMOUS_HOLDOUT_PLAINTEXT_IDENTITY_MISMATCH');
  }

  const qualifiedAt = new Date().toISOString();
  const envelope = sealEvidenceAssistAutonomousHoldout({
    holdout,
    key,
    sealedAt: qualifiedAt,
  });
  const envelopeText = canonicalAutonomousHoldoutJson(envelope);
  const encryptedArtifactSha256 = sha256(envelopeText);
  const qualificationRecord =
    evidenceAssistAutonomousHoldoutQualificationRecordSchema.parse({
      authorization: {
        decision: AUTHORIZATION,
        scope: AUTHORIZATION_SCOPE,
      },
      candidateOutputsAccessibleDuringAuthoring: false,
      candidateResultsReused: 0,
      caseCount: summary.caseCount,
      constructionManifestSha256: sha256(constructionText),
      elementCoverageCount: summary.elementCoverageCount,
      encryptedArtifactSha256,
      familyCounts: summary.familyCounts,
      gates: summary.gates,
      holdoutId: holdout.holdoutId,
      holdoutVersion: holdout.holdoutVersion,
      humanValidationClaimed: false,
      plaintextSha256,
      prevalidationRecordSha256: sha256(prevalidationText),
      pseudoOracleQualification:
        'SYNTHETIC_PSEUDO_ORACLE_NOT_FORMAL_TRUTH',
      qualifiedAt,
      schemaVersion: 1,
      status: 'QUALIFIED_AND_SEALED_AUTONOMOUS',
    });
  const qualificationText = canonicalAutonomousHoldoutJson(qualificationRecord);
  const qualificationSha256 = sha256(qualificationText);
  const sealedManifest =
    executableRubricAutonomousHoldoutManifestSchema.parse({
      ...manifest,
      encryptedArtifact: {
        ...manifest.encryptedArtifact,
        sha256: encryptedArtifactSha256,
      },
      executable: false,
      openedAt: null,
      pendingAuthoring: null,
      qualification: {
        ...manifest.qualification,
        constructionManifestSha256: sha256(constructionText),
        gates: summary.gates,
        qualifiedAt,
        status: 'QUALIFIED',
        validationRecordSha256: qualificationSha256,
      },
      qualificationRecord: {
        path: QUALIFICATION_RECORD_NAME,
        sha256: qualificationSha256,
      },
      sealed: true,
      status: 'SEALED_AWAITING_DEVELOPMENT_GO',
    });

  const outputPath = resolve(artifactDirectory, manifest.encryptedArtifact.path);
  const qualificationPath = resolve(artifactDirectory, QUALIFICATION_RECORD_NAME);
  await atomicWrite(outputPath, envelopeText);
  await atomicWrite(qualificationPath, qualificationText);
  await atomicWrite(
    manifestPath,
    canonicalAutonomousHoldoutJson(sealedManifest),
  );

  process.stdout.write(
    `${JSON.stringify({
      artifactSha256: encryptedArtifactSha256,
      caseCount: summary.caseCount,
      executable: false,
      humanValidationClaimed: false,
      modelCallsPerformed: 0,
      networkCallsAllowed: false,
      qualificationRecordSha256: qualificationSha256,
      status: sealedManifest.status,
    })}\n`,
  );
}

await main();
