import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

import { z } from 'zod';

import {
  type CompiledExecutableRubric,
  evidenceSpanFor,
  validateEvidencePass,
} from './executable-rubric-engine.js';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const stableKeySchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
const resolvedStatusSchema = z.enum([
  'SUPPORTED',
  'CONTRADICTED',
  'NOT_DEMONSTRATED',
]);

const holdoutPassElementSchema = z
  .object({
    elementKey: stableKeySchema,
    evidenceQuotes: z.array(z.string().min(1)),
    status: resolvedStatusSchema,
  })
  .strict();

const holdoutEvidencePassSchema = z
  .object({
    elements: z.array(holdoutPassElementSchema).min(1),
    role: z.enum(['EVIDENCE_RESEARCHER', 'EVIDENCE_FALSIFIER']),
  })
  .strict();

const holdoutInjectionBoundarySchema = z
  .object({
    attackText: z.string().min(1),
    forbiddenOutputFragments: z.array(z.string().min(1)).min(1),
    legitimateResponseText: z.string().min(1),
  })
  .strict();

const sealedHoldoutCaseSchema = z
  .object({
    caseId: stableKeySchema,
    evidencePasses: z.array(holdoutEvidencePassSchema).min(1).max(2),
    injectionBoundary: holdoutInjectionBoundarySchema.optional(),
    responseText: z.string().min(1),
    taskContext: z.string().min(1),
    taskPrompt: z.string().min(1),
  })
  .strict();

export const executableRubricHoldoutPlaintextSchema = z
  .object({
    cases: z.array(sealedHoldoutCaseSchema).min(24),
    holdoutId: z.literal('writing-fr-executable-rubric-holdout-v2'),
    holdoutVersion: z.literal('2.0.0'),
    humanReview: z
      .object({
        reviewedAt: z.iso.datetime(),
        reviewer: z.string().trim().min(1),
        status: z.literal('APPROVED'),
      })
      .strict(),
    language: z.literal('fr-FR'),
    modality: z.literal('WRITING'),
    rubric: z
      .object({
        fingerprint: sha256Schema,
        key: z.literal('v4-writing-recommendation-fr'),
        version: z.literal('1.0.0-draft'),
      })
      .strict(),
    schemaVersion: z.literal(2),
  })
  .strict();

export const executableRubricSealedHoldoutEnvelopeSchema = z
  .object({
    algorithm: z.literal('AES-256-GCM'),
    authTagBase64: z.string().min(1),
    ciphertextBase64: z.string().min(1),
    holdoutId: z.literal('writing-fr-executable-rubric-holdout-v2'),
    holdoutVersion: z.literal('2.0.0'),
    ivBase64: z.string().min(1),
    schemaVersion: z.literal(1),
  })
  .strict();

export const executableRubricHoldoutManifestSchema = z
  .object({
    caseCount: z.number().int().nonnegative(),
    encryptedArtifact: z
      .object({
        algorithm: z.literal('AES-256-GCM'),
        path: z.literal('writing-fr-holdout.v2.enc.json'),
        sha256: sha256Schema.nullable(),
      })
      .strict(),
    executable: z.boolean(),
    holdoutId: z.literal('writing-fr-executable-rubric-holdout-v2'),
    holdoutVersion: z.literal('2.0.0'),
    language: z.literal('fr-FR'),
    legacyPlaintext: z
      .object({
        path: z.literal('../autonomous/writing-fr-holdout.v1.json'),
        sha256: sha256Schema,
        status: z.literal('COMPROMISED_PLAINTEXT_REMOVED_FROM_ACTIVE_TREE'),
      })
      .strict(),
    minimumCaseCount: z.literal(24),
    modality: z.literal('WRITING'),
    openedAt: z.iso.datetime().nullable(),
    prohibitions: z
      .array(
        z.enum([
          'NO_PLAINTEXT_IN_REPOSITORY',
          'NO_OPEN_BEFORE_FULL_DEVELOPMENT_GO',
          'NO_TUNING_FROM_HOLDOUT',
          'NO_EXECUTION_WITHOUT_INDEPENDENT_REVIEW',
        ]),
      )
      .length(4),
    review: z
      .object({
        reviewedAt: z.iso.datetime().nullable(),
        reviewedContentSha256: sha256Schema.nullable(),
        reviewer: z.string().trim().min(1).nullable(),
        status: z.enum([
          'PENDING_INDEPENDENT_HUMAN_REVIEW',
          'APPROVED',
        ]),
      })
      .strict(),
    rubric: z
      .object({
        fingerprint: sha256Schema,
        key: z.literal('v4-writing-recommendation-fr'),
        path: z.literal('writing-recommendation-fr.v1.json'),
        version: z.literal('1.0.0-draft'),
      })
      .strict(),
    schemaVersion: z.literal(2),
    sealed: z.boolean(),
    status: z.enum([
      'CONTENT_NOT_AUTHORED',
      'SEALED_AWAITING_DEVELOPMENT_GO',
      'OPENED_ONE_SHOT',
    ]),
  })
  .strict()
  .superRefine((manifest, context) => {
    const hasCompleteReview =
      manifest.review.status === 'APPROVED' &&
      manifest.review.reviewer !== null &&
      manifest.review.reviewedAt !== null &&
      manifest.review.reviewedContentSha256 !== null;
    const hasEncryptedArtifact = manifest.encryptedArtifact.sha256 !== null;

    if (manifest.sealed) {
      if (
        !hasCompleteReview ||
        !hasEncryptedArtifact ||
        manifest.caseCount < manifest.minimumCaseCount
      ) {
        context.addIssue({
          code: 'custom',
          message: 'A sealed holdout requires an approved review, an encrypted artifact and the minimum case count.',
          path: ['sealed'],
        });
      }
    } else if (
      hasCompleteReview ||
      hasEncryptedArtifact ||
      manifest.caseCount !== 0
    ) {
      context.addIssue({
        code: 'custom',
        message: 'An unsealed holdout cannot advertise reviewed content or an encrypted artifact.',
        path: ['sealed'],
      });
    }

    if (manifest.status === 'CONTENT_NOT_AUTHORED') {
      if (manifest.sealed || manifest.executable || manifest.openedAt !== null) {
        context.addIssue({
          code: 'custom',
          message: 'Content-not-authored holdouts must remain closed and unsealed.',
          path: ['status'],
        });
      }
    }
    if (manifest.status === 'SEALED_AWAITING_DEVELOPMENT_GO') {
      if (!manifest.sealed || manifest.executable || manifest.openedAt !== null) {
        context.addIssue({
          code: 'custom',
          message: 'A sealed holdout awaiting GO must remain non-executable and unopened.',
          path: ['status'],
        });
      }
    }
    if (manifest.status === 'OPENED_ONE_SHOT') {
      if (!manifest.sealed || !manifest.executable || manifest.openedAt === null) {
        context.addIssue({
          code: 'custom',
          message: 'An opened holdout requires a sealed artifact and an explicit opening timestamp.',
          path: ['status'],
        });
      }
    }
  });

export type ExecutableRubricHoldoutPlaintext = z.infer<
  typeof executableRubricHoldoutPlaintextSchema
>;
export type ExecutableRubricSealedHoldoutEnvelope = z.infer<
  typeof executableRubricSealedHoldoutEnvelopeSchema
>;
export type ExecutableRubricHoldoutManifest = z.infer<
  typeof executableRubricHoldoutManifestSchema
>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function executableRubricHoldoutCanonicalSha256(input: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(input)))
    .digest('hex');
}

export function serializeSealedHoldoutArtifact(input: unknown): string {
  return `${JSON.stringify(input, null, 2)}\n`;
}

function assertUnique(values: string[], code: string): void {
  if (new Set(values).size !== values.length) throw new Error(code);
}

export function validateExecutableRubricHoldoutPlaintext(input: {
  compiled: CompiledExecutableRubric;
  plaintext: unknown;
}): ExecutableRubricHoldoutPlaintext {
  const plaintext = executableRubricHoldoutPlaintextSchema.parse(input.plaintext);
  if (
    plaintext.rubric.key !== input.compiled.rubric.rubricKey ||
    plaintext.rubric.version !== input.compiled.rubric.rubricVersion ||
    plaintext.rubric.fingerprint !== input.compiled.rubricFingerprint
  ) {
    throw new Error('SEALED_HOLDOUT_RUBRIC_IDENTITY_MISMATCH');
  }
  assertUnique(
    plaintext.cases.map(({ caseId }) => caseId),
    'SEALED_HOLDOUT_DUPLICATE_CASE_ID',
  );
  const expectedElementKeys = input.compiled.rubric.elements.map(({ key }) => key);
  plaintext.cases.forEach((caseItem) => {
    assertUnique(
      caseItem.evidencePasses.map(({ role }) => role),
      'SEALED_HOLDOUT_DUPLICATE_ROLE',
    );
    caseItem.evidencePasses.forEach((pass) => {
      const actualElementKeys = pass.elements.map(({ elementKey }) => elementKey);
      assertUnique(actualElementKeys, 'SEALED_HOLDOUT_DUPLICATE_ELEMENT_KEY');
      if (
        actualElementKeys.length !== expectedElementKeys.length ||
        expectedElementKeys.some((key) => !actualElementKeys.includes(key))
      ) {
        throw new Error('SEALED_HOLDOUT_ELEMENT_COVERAGE_MISMATCH');
      }
      pass.elements.flatMap(({ evidenceQuotes }) => evidenceQuotes).forEach((quote) => {
        if (!caseItem.responseText.includes(quote)) {
          throw new Error('SEALED_HOLDOUT_QUOTE_NOT_IN_RESPONSE');
        }
        if (
          caseItem.injectionBoundary &&
          !caseItem.injectionBoundary.legitimateResponseText.includes(quote)
        ) {
          throw new Error('SEALED_HOLDOUT_ATTACK_USED_AS_EVIDENCE');
        }
      });
      validateEvidencePass({
        compiled: input.compiled,
        pass: {
          elements: pass.elements.map((element) => ({
            confidence: null,
            contradictions: [],
            elementKey: element.elementKey,
            evidenceSpans: element.evidenceQuotes.map((quote) => {
              const start = caseItem.responseText.indexOf(quote);
              return evidenceSpanFor(
                caseItem.responseText,
                start,
                start + quote.length,
              );
            }),
            status: element.status,
          })),
          pipelineFingerprint: '0'.repeat(64),
          role: pass.role,
        },
        responseText: caseItem.responseText,
      });
    });
    if (caseItem.injectionBoundary) {
      if (
        caseItem.responseText !==
        `${caseItem.injectionBoundary.legitimateResponseText} ${caseItem.injectionBoundary.attackText}`
      ) {
        throw new Error('SEALED_HOLDOUT_INJECTION_BOUNDARY_MISMATCH');
      }
      caseItem.injectionBoundary.forbiddenOutputFragments.forEach((fragment) => {
        if (!caseItem.injectionBoundary?.attackText.includes(fragment)) {
          throw new Error('SEALED_HOLDOUT_FORBIDDEN_FRAGMENT_NOT_IN_ATTACK');
        }
      });
    }
  });
  return plaintext;
}

export function sealExecutableRubricHoldout(input: {
  key: Buffer;
  manifest: unknown;
  plaintext: ExecutableRubricHoldoutPlaintext;
  iv?: Buffer;
}): {
  artifactSha256: string;
  envelope: ExecutableRubricSealedHoldoutEnvelope;
  manifest: ExecutableRubricHoldoutManifest;
} {
  if (input.key.byteLength !== 32) throw new Error('SEALED_HOLDOUT_KEY_LENGTH_INVALID');
  const manifest = executableRubricHoldoutManifestSchema.parse(input.manifest);
  if (manifest.status !== 'CONTENT_NOT_AUTHORED') {
    throw new Error('SEALED_HOLDOUT_MANIFEST_NOT_PENDING');
  }
  const iv = input.iv ?? randomBytes(12);
  if (iv.byteLength !== 12) throw new Error('SEALED_HOLDOUT_IV_LENGTH_INVALID');
  const cipher = createCipheriv('aes-256-gcm', input.key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(canonicalize(input.plaintext)), 'utf8'),
    cipher.final(),
  ]);
  const envelope = executableRubricSealedHoldoutEnvelopeSchema.parse({
    algorithm: 'AES-256-GCM',
    authTagBase64: cipher.getAuthTag().toString('base64'),
    ciphertextBase64: ciphertext.toString('base64'),
    holdoutId: input.plaintext.holdoutId,
    holdoutVersion: input.plaintext.holdoutVersion,
    ivBase64: iv.toString('base64'),
    schemaVersion: 1,
  });
  const artifactSha256 = createHash('sha256')
    .update(serializeSealedHoldoutArtifact(envelope))
    .digest('hex');
  const sealedManifest = executableRubricHoldoutManifestSchema.parse({
    ...manifest,
    caseCount: input.plaintext.cases.length,
    encryptedArtifact: {
      ...manifest.encryptedArtifact,
      sha256: artifactSha256,
    },
    review: {
      reviewedAt: input.plaintext.humanReview.reviewedAt,
      reviewedContentSha256: executableRubricHoldoutCanonicalSha256(
        input.plaintext,
      ),
      reviewer: input.plaintext.humanReview.reviewer,
      status: 'APPROVED',
    },
    sealed: true,
    status: 'SEALED_AWAITING_DEVELOPMENT_GO',
  });
  return { artifactSha256, envelope, manifest: sealedManifest };
}

export function openExecutableRubricHoldout(input: {
  envelope: unknown;
  key: Buffer;
}): unknown {
  if (input.key.byteLength !== 32) throw new Error('SEALED_HOLDOUT_KEY_LENGTH_INVALID');
  const envelope = executableRubricSealedHoldoutEnvelopeSchema.parse(input.envelope);
  const decipher = createDecipheriv(
    'aes-256-gcm',
    input.key,
    Buffer.from(envelope.ivBase64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(envelope.authTagBase64, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertextBase64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
  return JSON.parse(plaintext) as unknown;
}
