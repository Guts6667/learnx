import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isAbsolute, resolve, sep } from 'node:path';

import { z } from 'zod';

import {
  compileExecutableRubric,
  type CompiledExecutableRubric,
} from '@/lib/executable-rubric-engine.ts';
import { EVIDENCE_ASSIST_PROTOCOL_VERSION } from '@/lib/evidence-assist-protocol.ts';

const stableKeySchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const repositoryPathSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (path) =>
      !isAbsolute(path) &&
      !path.includes('\\') &&
      !path.split('/').includes('..'),
    'Expected a repository-relative path without traversal.',
  );

const anchoredArtifactSchema = z
  .object({
    path: repositoryPathSchema,
    sha256: sha256Schema,
  })
  .strict();

export const evidenceAssistCandidateOutcomeSchema = z
  .object({
    indicativeScore: z.null(),
    level: z.null(),
    levelAuthority: z.literal('NONE'),
    masteryEffect: z.literal('NONE'),
    progressionEffect: z.literal('NONE'),
    scoreAuthority: z.literal('NONE'),
    semanticAuthority: z.literal('CANDIDATE_ONLY'),
  })
  .strict();

export const evidenceAssistPilotBindingSchema = z
  .object({
    artifacts: z
      .object({
        pedagogySpec: anchoredArtifactSchema
          .extend({ specId: z.string().regex(/^PEDAGOGY_SPEC_[0-9]{3}$/u) })
          .strict(),
        rubric: anchoredArtifactSchema
          .extend({
            compiledFingerprint: sha256Schema,
            rubricKey: stableKeySchema,
            rubricVersion: z.string().trim().min(1),
          })
          .strict(),
        seedProgram: anchoredArtifactSchema,
      })
      .strict(),
    bindingFingerprint: sha256Schema,
    bindingKey: stableKeySchema,
    bindingVersion: z.string().regex(/^\d+\.\d+\.\d+-draft$/u),
    candidateOutcome: evidenceAssistCandidateOutcomeSchema,
    lifecycle: z.literal('DRAFT'),
    pilotRisk: z.literal('LOW'),
    protocolVersion: z.literal(EVIDENCE_ASSIST_PROTOCOL_VERSION),
    runtime: z
      .object({
        aiCorrectionEligible: z.literal(false),
        allowedExecution: z.literal('OFFLINE_PREPARATION_ONLY'),
        publicationEligible: z.literal(false),
      })
      .strict(),
    schemaVersion: z.literal(1),
    target: z
      .object({
        activityKey: stableKeySchema,
        activityType: z.literal('writing'),
        kind: z.literal('EXERCISE'),
        language: z.literal('fr-FR'),
        lessonSlug: stableKeySchema,
        moduleSlug: stableKeySchema,
        programSlug: stableKeySchema,
        stageSlug: stableKeySchema,
      })
      .strict(),
  })
  .strict();

export type EvidenceAssistPilotBinding = z.infer<
  typeof evidenceAssistPilotBindingSchema
>;

type ArtifactTexts = ReadonlyMap<string, string>;

type TargetTask = Readonly<{
  description: string;
  isRequired: boolean;
  key: string;
  position: number;
  title: string;
  type: 'writing';
  weight: number;
}>;

export type ValidatedEvidenceAssistPilotBinding = Readonly<{
  activity: TargetTask;
  binding: EvidenceAssistPilotBinding;
  compiledRubric: CompiledExecutableRubric;
  runtimeEligibility: Readonly<{
    eligible: false;
    reasons: readonly ['BINDING_DRAFT', 'PUBLICATION_BLOCKED'];
  }>;
}>;

const sourceTaskSchema = z
  .object({
    description: z.string().trim().min(1),
    isRequired: z.boolean(),
    key: stableKeySchema,
    position: z.number().int().positive(),
    title: z.string().trim().min(1),
    type: z.string().trim().min(1),
    weight: z.number().int().positive(),
  })
  .passthrough();
const targetTaskSchema = sourceTaskSchema.extend({
  type: z.literal('writing'),
});

const pedagogySpecAnchorSchema = z
  .object({
    editorial: z.object({ status: z.literal('draft') }).passthrough(),
    lesson: z
      .object({
        slug: stableKeySchema,
        tasks: z.array(sourceTaskSchema),
      })
      .passthrough(),
    moduleSlug: stableKeySchema,
    programSlug: stableKeySchema,
    specId: z.string().min(1),
    stageSlug: stableKeySchema,
  })
  .passthrough();

const seedLessonSchema = z
  .object({
    slug: stableKeySchema,
    tasks: z.array(sourceTaskSchema),
  })
  .passthrough();
const seedModuleSchema = z
  .object({
    lessons: z.array(seedLessonSchema),
    slug: stableKeySchema,
  })
  .passthrough();
const seedStageSchema = z
  .object({
    modules: z.array(seedModuleSchema),
    slug: stableKeySchema,
  })
  .passthrough();
const seedProgramAnchorSchema = z
  .object({
    program: z
      .object({
        slug: stableKeySchema,
        stages: z.array(seedStageSchema),
      })
      .passthrough(),
  })
  .passthrough();

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('EVIDENCE_ASSIST_BINDING_NOT_AN_OBJECT');
  }
  return value as Record<string, unknown>;
}

export function evidenceAssistPilotBindingFingerprint(input: unknown): string {
  const snapshot = { ...requireRecord(input) };
  delete snapshot.bindingFingerprint;
  return sha256(JSON.stringify(canonicalize(snapshot)));
}

function assertBindingFingerprint(binding: EvidenceAssistPilotBinding): void {
  if (
    binding.bindingFingerprint !==
    evidenceAssistPilotBindingFingerprint(binding)
  ) {
    throw new Error('EVIDENCE_ASSIST_BINDING_FINGERPRINT_MISMATCH');
  }
}

function parseJson(text: string, code: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(code);
  }
}

function requireArtifactText(artifacts: ArtifactTexts, path: string): string {
  const text = artifacts.get(path);
  if (text === undefined) {
    throw new Error(`EVIDENCE_ASSIST_BINDING_ARTIFACT_MISSING:${path}`);
  }
  return text;
}

function assertArtifactDigest(input: {
  expectedSha256: string;
  label: string;
  text: string;
}): void {
  if (sha256(input.text) !== input.expectedSha256) {
    throw new Error(`EVIDENCE_ASSIST_BINDING_${input.label}_SHA256_MISMATCH`);
  }
}

function requireValue<T>(value: T | undefined, code: string): T {
  if (value === undefined) throw new Error(code);
  return value;
}

function resolveSpecTask(input: {
  binding: EvidenceAssistPilotBinding;
  text: string;
}): TargetTask {
  const spec = pedagogySpecAnchorSchema.parse(
    parseJson(input.text, 'EVIDENCE_ASSIST_BINDING_SPEC_JSON_INVALID'),
  );
  const { target } = input.binding;
  if (
    spec.specId !== input.binding.artifacts.pedagogySpec.specId ||
    spec.programSlug !== target.programSlug ||
    spec.stageSlug !== target.stageSlug ||
    spec.moduleSlug !== target.moduleSlug ||
    spec.lesson.slug !== target.lessonSlug
  ) {
    throw new Error('EVIDENCE_ASSIST_BINDING_SPEC_TARGET_MISMATCH');
  }
  return targetTaskSchema.parse(
    requireValue(
      spec.lesson.tasks.find(({ key }) => key === target.activityKey),
      'EVIDENCE_ASSIST_BINDING_SPEC_ACTIVITY_MISSING',
    ),
  );
}

function resolveSeedTask(input: {
  binding: EvidenceAssistPilotBinding;
  text: string;
}): TargetTask {
  const seed = seedProgramAnchorSchema.parse(
    parseJson(input.text, 'EVIDENCE_ASSIST_BINDING_SEED_JSON_INVALID'),
  );
  const { target } = input.binding;
  if (seed.program.slug !== target.programSlug) {
    throw new Error('EVIDENCE_ASSIST_BINDING_SEED_PROGRAM_MISMATCH');
  }
  const stage = requireValue(
    seed.program.stages.find(({ slug }) => slug === target.stageSlug),
    'EVIDENCE_ASSIST_BINDING_SEED_STAGE_MISSING',
  );
  const module = requireValue(
    stage.modules.find(({ slug }) => slug === target.moduleSlug),
    'EVIDENCE_ASSIST_BINDING_SEED_MODULE_MISSING',
  );
  const lesson = requireValue(
    module.lessons.find(({ slug }) => slug === target.lessonSlug),
    'EVIDENCE_ASSIST_BINDING_SEED_LESSON_MISSING',
  );
  return targetTaskSchema.parse(
    requireValue(
      lesson.tasks.find(({ key }) => key === target.activityKey),
      'EVIDENCE_ASSIST_BINDING_SEED_ACTIVITY_MISSING',
    ),
  );
}

function assertSameTask(left: TargetTask, right: TargetTask): void {
  const fields = [
    'description',
    'isRequired',
    'key',
    'position',
    'title',
    'type',
    'weight',
  ] as const;
  if (fields.some((field) => left[field] !== right[field])) {
    throw new Error('EVIDENCE_ASSIST_BINDING_ACTIVITY_PROJECTIONS_DIVERGE');
  }
}

function validateRubric(input: {
  binding: EvidenceAssistPilotBinding;
  text: string;
}): CompiledExecutableRubric {
  const compiled = compileExecutableRubric(
    parseJson(input.text, 'EVIDENCE_ASSIST_BINDING_RUBRIC_JSON_INVALID'),
  );
  const { rubric } = compiled;
  const reference = input.binding.artifacts.rubric;
  if (
    rubric.rubricKey !== reference.rubricKey ||
    rubric.rubricVersion !== reference.rubricVersion ||
    compiled.rubricFingerprint !== reference.compiledFingerprint
  ) {
    throw new Error('EVIDENCE_ASSIST_BINDING_RUBRIC_IDENTITY_MISMATCH');
  }
  if (
    rubric.lifecycle !== 'DRAFT' ||
    rubric.language !== input.binding.target.language ||
    rubric.modality !== 'WRITING' ||
    rubric.eligibility !== 'EVIDENCE_ASSIST_ONLY' ||
    rubric.progressionAuthority !== 'NONE' ||
    rubric.scorePolicy.indicativeScoreEnabled ||
    !rubric.candidateRelationPolicy ||
    rubric.elements.some(
      (element) => element.type === 'HOLISTIC' || !element.remediation,
    )
  ) {
    throw new Error('EVIDENCE_ASSIST_BINDING_RUBRIC_NOT_CANDIDATE_ONLY');
  }
  if (
    rubric.candidateRelationPolicy.authority !==
      input.binding.candidateOutcome.semanticAuthority ||
    rubric.candidateRelationPolicy.scoreAuthority !==
      input.binding.candidateOutcome.scoreAuthority ||
    rubric.candidateRelationPolicy.levelAuthority !==
      input.binding.candidateOutcome.levelAuthority ||
    rubric.candidateRelationPolicy.masteryEffect !==
      input.binding.candidateOutcome.masteryEffect ||
    rubric.candidateRelationPolicy.progressionEffect !==
      input.binding.candidateOutcome.progressionEffect
  ) {
    throw new Error('EVIDENCE_ASSIST_BINDING_AUTHORITY_MISMATCH');
  }
  return compiled;
}

export function validateEvidenceAssistPilotBinding(input: {
  artifactTexts: ArtifactTexts;
  binding: unknown;
}): ValidatedEvidenceAssistPilotBinding {
  const binding = evidenceAssistPilotBindingSchema.parse(input.binding);
  assertBindingFingerprint(binding);

  const rubricText = requireArtifactText(
    input.artifactTexts,
    binding.artifacts.rubric.path,
  );
  const pedagogySpecText = requireArtifactText(
    input.artifactTexts,
    binding.artifacts.pedagogySpec.path,
  );
  const seedProgramText = requireArtifactText(
    input.artifactTexts,
    binding.artifacts.seedProgram.path,
  );
  assertArtifactDigest({
    expectedSha256: binding.artifacts.rubric.sha256,
    label: 'RUBRIC',
    text: rubricText,
  });
  assertArtifactDigest({
    expectedSha256: binding.artifacts.pedagogySpec.sha256,
    label: 'SPEC',
    text: pedagogySpecText,
  });
  assertArtifactDigest({
    expectedSha256: binding.artifacts.seedProgram.sha256,
    label: 'SEED',
    text: seedProgramText,
  });

  const compiledRubric = validateRubric({ binding, text: rubricText });
  const specTask = resolveSpecTask({ binding, text: pedagogySpecText });
  const seedTask = resolveSeedTask({ binding, text: seedProgramText });
  assertSameTask(specTask, seedTask);
  if (specTask.type !== binding.target.activityType) {
    throw new Error('EVIDENCE_ASSIST_BINDING_ACTIVITY_TYPE_MISMATCH');
  }

  return Object.freeze({
    activity: Object.freeze({ ...specTask }),
    binding,
    compiledRubric,
    runtimeEligibility: Object.freeze({
      eligible: false as const,
      reasons: ['BINDING_DRAFT', 'PUBLICATION_BLOCKED'] as const,
    }),
  });
}

function resolveRepositoryPath(rootDirectory: string, path: string): string {
  const parsedPath = repositoryPathSchema.parse(path);
  const root = resolve(rootDirectory);
  const resolvedPath = resolve(root, parsedPath);
  if (!resolvedPath.startsWith(`${root}${sep}`)) {
    throw new Error('EVIDENCE_ASSIST_BINDING_PATH_OUTSIDE_REPOSITORY');
  }
  return resolvedPath;
}

export function loadEvidenceAssistPilotBinding(input: {
  bindingPath: string;
  rootDirectory?: string;
}): ValidatedEvidenceAssistPilotBinding {
  const rootDirectory = input.rootDirectory ?? process.cwd();
  const bindingText = readFileSync(
    resolveRepositoryPath(rootDirectory, input.bindingPath),
    'utf8',
  );
  const rawBinding = parseJson(
    bindingText,
    'EVIDENCE_ASSIST_BINDING_JSON_INVALID',
  );
  const binding = evidenceAssistPilotBindingSchema.parse(rawBinding);
  const artifactTexts = new Map<string, string>();
  [
    binding.artifacts.pedagogySpec.path,
    binding.artifacts.rubric.path,
    binding.artifacts.seedProgram.path,
  ].forEach((path) => {
    artifactTexts.set(
      path,
      readFileSync(resolveRepositoryPath(rootDirectory, path), 'utf8'),
    );
  });
  return validateEvidenceAssistPilotBinding({ artifactTexts, binding });
}

export function assertEvidenceAssistPilotBindingSnapshotImmutable(
  previousInput: unknown,
  candidateInput: unknown,
): void {
  const previous = evidenceAssistPilotBindingSchema.parse(previousInput);
  const candidate = evidenceAssistPilotBindingSchema.parse(candidateInput);
  assertBindingFingerprint(previous);
  assertBindingFingerprint(candidate);
  if (
    previous.bindingKey === candidate.bindingKey &&
    previous.bindingVersion === candidate.bindingVersion &&
    previous.bindingFingerprint !== candidate.bindingFingerprint
  ) {
    throw new Error('EVIDENCE_ASSIST_BINDING_VERSION_IMMUTABLE');
  }
}
