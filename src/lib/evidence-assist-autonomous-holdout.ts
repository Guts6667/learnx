import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

import { z } from 'zod';

import type { CompiledExecutableRubric } from './executable-rubric-engine.js';
import {
  EVIDENCE_ASSIST_PROTOCOL_VERSION,
  EVIDENCE_ASSIST_VALIDATOR_VERSION,
} from './evidence-assist-protocol.js';
import {
  createResponseSpanManifest,
  RESPONSE_SPAN_SEGMENTATION_VERSION,
} from './response-span-manifest.js';

const stableKeySchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const relationSchema = z.enum([
  'EVIDENCE_FOR_ELEMENT',
  'EVIDENCE_AGAINST_ELEMENT',
]);

const expectedRelationSchema = z
  .object({
    elementKey: stableKeySchema,
    exactEvidenceTexts: z.array(z.string().trim().min(1)).min(1).max(4),
    relation: relationSchema,
  })
  .strict();

const forbiddenRelationSchema = z
  .object({
    elementKey: stableKeySchema,
    relation: relationSchema,
  })
  .strict();

const metamorphicSchema = z
  .object({
    changedElementKeys: z.array(stableKeySchema),
    invariant: z.enum(['RELATION_SET_INVARIANT', 'LOCALITY_ONLY']),
    parentCaseId: stableKeySchema,
    transformation: z.enum([
      'PARAPHRASE',
      'SENTENCE_ORDER',
      'SURFACE_TYPOS',
      'IRRELEVANT_VERBOSITY',
      'REMOVE_ONE_ELEMENT',
      'ADD_ONE_ELEMENT',
    ]),
  })
  .strict();

const injectionBoundarySchema = z
  .object({
    attackFragment: z.string().trim().min(1),
    attackMustNeverBeEvidence: z.literal(true),
    canaryLeakForbidden: z.literal(true),
  })
  .strict();

const holdoutCaseSchema = z
  .object({
    caseId: stableKeySchema,
    expectedRelations: z.array(expectedRelationSchema).min(1),
    family: z.enum([
      'MECHANICAL_ORACLE',
      'SYNTHETIC_PSEUDO_ORACLE',
      'METAMORPHIC',
      'INJECTION_AND_CANARY',
    ]),
    forbiddenRelations: z.array(forbiddenRelationSchema),
    injectionBoundary: injectionBoundarySchema.nullable(),
    metamorphic: metamorphicSchema.nullable(),
    oracleQualification: z.enum([
      'EXECUTABLE_BY_CONSTRUCTION',
      'SYNTHETIC_PSEUDO_ORACLE_NOT_FORMAL_TRUTH',
    ]),
    responseText: z.string().trim().min(1),
    tags: z.array(stableKeySchema).min(1),
  })
  .strict();

export const evidenceAssistAutonomousHoldoutSchema = z
  .object({
    authoringIndependence: z
      .object({
        candidateOutputsAccessibleDuringAuthoring: z.literal(false),
        candidateResultsReused: z.literal(0),
        humanValidationClaimed: z.literal(false),
      })
      .strict(),
    caseCount: z.literal(24),
    cases: z.array(holdoutCaseSchema).length(24),
    holdoutId: z.literal('writing-fr-evidence-assist-holdout-v3'),
    holdoutVersion: z.literal('3.0.0'),
    language: z.literal('fr-FR'),
    modality: z.literal('WRITING'),
    protocol: z
      .object({
        protocolVersion: z.literal(EVIDENCE_ASSIST_PROTOCOL_VERSION),
        segmentationVersion: z.literal(RESPONSE_SPAN_SEGMENTATION_VERSION),
        validatorVersion: z.literal(EVIDENCE_ASSIST_VALIDATOR_VERSION),
      })
      .strict(),
    rubric: z
      .object({
        fingerprint: sha256Schema,
        key: stableKeySchema,
        version: z.string().trim().min(1),
      })
      .strict(),
    schemaVersion: z.literal(3),
    task: z
      .object({
        context: z.string().trim().min(1),
        prompt: z.string().trim().min(1),
      })
      .strict(),
  })
  .strict();

export const evidenceAssistAutonomousHoldoutEnvelopeSchema = z
  .object({
    aadSha256: sha256Schema,
    algorithm: z.literal('AES-256-GCM'),
    authTagBase64: z.string().min(1),
    ciphertextBase64: z.string().min(1),
    holdoutId: z.literal('writing-fr-evidence-assist-holdout-v3'),
    holdoutVersion: z.literal('3.0.0'),
    ivBase64: z.string().min(1),
    plaintextSha256: sha256Schema,
    schemaVersion: z.literal(1),
    sealedAt: z.iso.datetime(),
  })
  .strict();

const repositoryArtifactSchema = z
  .object({
    path: z.string().trim().min(1),
    sha256: sha256Schema,
  })
  .strict();

export const evidenceAssistAutonomousHoldoutConstructionSchema = z
  .object({
    artifacts: z
      .object({
        binding: repositoryArtifactSchema,
        rubric: repositoryArtifactSchema.extend({
          compiledFingerprint: sha256Schema,
        }),
      })
      .strict(),
    authoringIndependence: z
      .object({
        candidateOutputsAccessibleDuringAuthoring: z.literal(false),
        candidateResultsReused: z.literal(0),
        humanValidationClaimed: z.literal(false),
      })
      .strict(),
    caseCount: z.literal(24),
    composition: z
      .object({
        injectionAndCanary: z.literal(4),
        mechanicalOracle: z.literal(6),
        metamorphic: z.literal(8),
        syntheticPseudoOracle: z.literal(6),
      })
      .strict(),
    createdAt: z.iso.datetime(),
    holdoutId: z.literal('writing-fr-evidence-assist-holdout-v3'),
    holdoutVersion: z.literal('3.0.0'),
    plaintextSha256: sha256Schema,
    protocol: z
      .object({
        authorityPath: z.literal('docs/V4_EVIDENCE_ASSIST_PROTOCOL_SPEC.md'),
        version: z.literal(EVIDENCE_ASSIST_PROTOCOL_VERSION),
      })
      .strict(),
    schemaVersion: z.literal(1),
    status: z.literal(
      'AUTHORING_PREVALIDATED_PENDING_EXPLICIT_OWNER_SEAL',
    ),
  })
  .strict();

export const evidenceAssistAutonomousHoldoutPrevalidationRecordSchema = z
  .object({
    caseCount: z.literal(24),
    constructionManifestSha256: sha256Schema,
    elementCoverageCount: z.number().int().positive(),
    gates: z
      .object({
        injectionAndCanary: z.literal('PREVALIDATED'),
        mechanicalOracle: z.literal('PREVALIDATED'),
        metamorphic: z.literal('PREVALIDATED'),
        mutation: z.literal('PREVALIDATED'),
      })
      .strict(),
    holdoutId: z.literal('writing-fr-evidence-assist-holdout-v3'),
    humanValidationClaimed: z.literal(false),
    plaintextSha256: sha256Schema,
    pseudoOracleQualification: z.literal(
      'SYNTHETIC_PSEUDO_ORACLE_NOT_FORMAL_TRUTH',
    ),
    schemaVersion: z.literal(1),
    status: z.literal('PREVALIDATED_NOT_QUALIFIED_NOT_SEALED'),
    validatedAt: z.iso.datetime(),
  })
  .strict();

export type EvidenceAssistAutonomousHoldout = z.infer<
  typeof evidenceAssistAutonomousHoldoutSchema
>;
export type EvidenceAssistAutonomousHoldoutEnvelope = z.infer<
  typeof evidenceAssistAutonomousHoldoutEnvelopeSchema
>;

export type AutonomousHoldoutValidationSummary = Readonly<{
  caseCount: 24;
  elementCoverageCount: number;
  familyCounts: Readonly<Record<EvidenceAssistAutonomousHoldout['cases'][number]['family'], number>>;
  gates: Readonly<{
    injectionAndCanary: true;
    mechanicalOracle: true;
    metamorphic: true;
    mutation: true;
  }>;
  pseudoOracleCaseCount: number;
}>;

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalize(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(canonicalize);
  if (input && typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => [key, canonicalize(value)]),
    );
  }
  return input;
}

export function canonicalAutonomousHoldoutJson(input: unknown): string {
  return `${JSON.stringify(canonicalize(input), null, 2)}\n`;
}

function relationKey(input: { elementKey: string; relation: string }): string {
  return `${input.elementKey}:${input.relation}`;
}

function relationSet(
  relations: EvidenceAssistAutonomousHoldout['cases'][number]['expectedRelations'],
  excludedElementKeys: ReadonlySet<string> = new Set(),
): Set<string> {
  return new Set(
    relations
      .filter(({ elementKey }) => !excludedElementKeys.has(elementKey))
      .map(relationKey),
  );
}

function setsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  return (
    left.size === right.size && [...left].every((value) => right.has(value))
  );
}

function requireValue<T>(value: T | undefined, code: string): T {
  if (value === undefined) throw new Error(code);
  return value;
}

export function validateEvidenceAssistAutonomousHoldout(input: {
  compiled: CompiledExecutableRubric;
  holdout: unknown;
}): {
  holdout: EvidenceAssistAutonomousHoldout;
  summary: AutonomousHoldoutValidationSummary;
} {
  const holdout = evidenceAssistAutonomousHoldoutSchema.parse(input.holdout);
  if (
    holdout.rubric.key !== input.compiled.rubric.rubricKey ||
    holdout.rubric.version !== input.compiled.rubric.rubricVersion ||
    holdout.rubric.fingerprint !== input.compiled.rubricFingerprint
  ) {
    throw new Error('AUTONOMOUS_HOLDOUT_RUBRIC_IDENTITY_MISMATCH');
  }

  const elementKeys = new Set(input.compiled.rubric.elements.map(({ key }) => key));
  const caseIds = holdout.cases.map(({ caseId }) => caseId);
  if (new Set(caseIds).size !== caseIds.length) {
    throw new Error('AUTONOMOUS_HOLDOUT_DUPLICATE_CASE_ID');
  }
  const casesById = new Map(holdout.cases.map((caseItem) => [caseItem.caseId, caseItem]));
  const coveredElements = new Set<string>();

  holdout.cases.forEach((caseItem) => {
    const expectedKeys = caseItem.expectedRelations.map(relationKey);
    const forbiddenKeys = caseItem.forbiddenRelations.map(relationKey);
    if (
      new Set(expectedKeys).size !== expectedKeys.length ||
      new Set(forbiddenKeys).size !== forbiddenKeys.length ||
      expectedKeys.some((key) => forbiddenKeys.includes(key))
    ) {
      throw new Error('AUTONOMOUS_HOLDOUT_RELATION_CONFLICT');
    }
    if (
      [...caseItem.expectedRelations, ...caseItem.forbiddenRelations].some(
        ({ elementKey }) => !elementKeys.has(elementKey),
      )
    ) {
      throw new Error('AUTONOMOUS_HOLDOUT_UNKNOWN_ELEMENT_KEY');
    }
    caseItem.expectedRelations.forEach(({ elementKey }) => coveredElements.add(elementKey));

    const spanTexts = new Set(
      createResponseSpanManifest(caseItem.responseText).spans.map(({ text }) => text),
    );
    caseItem.expectedRelations.forEach(({ exactEvidenceTexts }) => {
      if (exactEvidenceTexts.some((text) => !spanTexts.has(text))) {
        throw new Error('AUTONOMOUS_HOLDOUT_EXPECTED_SPAN_NOT_EXACT');
      }
    });

    if (
      (caseItem.family === 'SYNTHETIC_PSEUDO_ORACLE') !==
      (caseItem.oracleQualification ===
        'SYNTHETIC_PSEUDO_ORACLE_NOT_FORMAL_TRUTH')
    ) {
      throw new Error('AUTONOMOUS_HOLDOUT_ORACLE_QUALIFICATION_MISMATCH');
    }
    if ((caseItem.family === 'METAMORPHIC') !== (caseItem.metamorphic !== null)) {
      throw new Error('AUTONOMOUS_HOLDOUT_METAMORPHIC_METADATA_MISMATCH');
    }
    if (
      (caseItem.family === 'INJECTION_AND_CANARY') !==
      (caseItem.injectionBoundary !== null)
    ) {
      throw new Error('AUTONOMOUS_HOLDOUT_INJECTION_METADATA_MISMATCH');
    }
    if (caseItem.injectionBoundary) {
      const { attackFragment } = caseItem.injectionBoundary;
      if (!caseItem.responseText.includes(attackFragment)) {
        throw new Error('AUTONOMOUS_HOLDOUT_ATTACK_FRAGMENT_MISSING');
      }
      if (
        caseItem.expectedRelations.some(({ exactEvidenceTexts }) =>
          exactEvidenceTexts.some((text) => text.includes(attackFragment)),
        )
      ) {
        throw new Error('AUTONOMOUS_HOLDOUT_ATTACK_USED_AS_EVIDENCE');
      }
    }
    if (caseItem.metamorphic) {
      const parent = requireValue(
        casesById.get(caseItem.metamorphic.parentCaseId),
        'AUTONOMOUS_HOLDOUT_METAMORPHIC_PARENT_MISSING',
      );
      if (parent.caseId === caseItem.caseId) {
        throw new Error('AUTONOMOUS_HOLDOUT_METAMORPHIC_SELF_PARENT');
      }
      const changedKeys = new Set(caseItem.metamorphic.changedElementKeys);
      const parentRelations = relationSet(parent.expectedRelations, changedKeys);
      const childRelations = relationSet(caseItem.expectedRelations, changedKeys);
      if (!setsEqual(parentRelations, childRelations)) {
        throw new Error('AUTONOMOUS_HOLDOUT_METAMORPHIC_INVARIANT_BROKEN');
      }
      if (
        caseItem.metamorphic.invariant === 'RELATION_SET_INVARIANT' &&
        changedKeys.size > 0
      ) {
        throw new Error('AUTONOMOUS_HOLDOUT_INVARIANT_DECLARES_CHANGED_ELEMENT');
      }
      if (
        caseItem.metamorphic.invariant === 'LOCALITY_ONLY' &&
        changedKeys.size !== 1
      ) {
        throw new Error('AUTONOMOUS_HOLDOUT_LOCALITY_REQUIRES_ONE_ELEMENT');
      }
      if (
        caseItem.metamorphic.invariant === 'LOCALITY_ONLY' &&
        setsEqual(
          relationSet(
            parent.expectedRelations.filter(({ elementKey }) =>
              changedKeys.has(elementKey),
            ),
          ),
          relationSet(
            caseItem.expectedRelations.filter(({ elementKey }) =>
              changedKeys.has(elementKey),
            ),
          ),
        )
      ) {
        throw new Error('AUTONOMOUS_HOLDOUT_LOCALITY_MUTATION_HAS_NO_EFFECT');
      }
    }
  });

  const familyCounts = {
    INJECTION_AND_CANARY: holdout.cases.filter(
      ({ family }) => family === 'INJECTION_AND_CANARY',
    ).length,
    MECHANICAL_ORACLE: holdout.cases.filter(
      ({ family }) => family === 'MECHANICAL_ORACLE',
    ).length,
    METAMORPHIC: holdout.cases.filter(({ family }) => family === 'METAMORPHIC')
      .length,
    SYNTHETIC_PSEUDO_ORACLE: holdout.cases.filter(
      ({ family }) => family === 'SYNTHETIC_PSEUDO_ORACLE',
    ).length,
  } as const;
  if (
    familyCounts.MECHANICAL_ORACLE !== 6 ||
    familyCounts.SYNTHETIC_PSEUDO_ORACLE !== 6 ||
    familyCounts.METAMORPHIC !== 8 ||
    familyCounts.INJECTION_AND_CANARY !== 4
  ) {
    throw new Error('AUTONOMOUS_HOLDOUT_FAMILY_DISTRIBUTION_INVALID');
  }
  if (coveredElements.size !== elementKeys.size) {
    throw new Error('AUTONOMOUS_HOLDOUT_ELEMENT_COVERAGE_INCOMPLETE');
  }

  const injectionAndCanaryQualified = holdout.cases
    .filter(({ family }) => family === 'INJECTION_AND_CANARY')
    .every(
      ({ injectionBoundary }) =>
        injectionBoundary?.attackMustNeverBeEvidence === true &&
        injectionBoundary.canaryLeakForbidden === true,
    );
  const mechanicalOracleQualified = holdout.cases
    .filter(({ family }) => family === 'MECHANICAL_ORACLE')
    .every(
      ({ oracleQualification }) =>
        oracleQualification === 'EXECUTABLE_BY_CONSTRUCTION',
    );
  const metamorphicQualified = holdout.cases
    .filter(({ family }) => family === 'METAMORPHIC')
    .every(({ metamorphic }) => metamorphic !== null);
  const mutationQualified =
    holdout.cases.filter(
      ({ metamorphic }) => metamorphic?.invariant === 'LOCALITY_ONLY',
    ).length >= 2;
  if (
    !injectionAndCanaryQualified ||
    !mechanicalOracleQualified ||
    !metamorphicQualified ||
    !mutationQualified
  ) {
    throw new Error('AUTONOMOUS_HOLDOUT_QUALIFICATION_GATE_NOT_MET');
  }

  return {
    holdout,
    summary: Object.freeze({
      caseCount: 24 as const,
      elementCoverageCount: coveredElements.size,
      familyCounts: Object.freeze(familyCounts),
      gates: Object.freeze({
        injectionAndCanary: injectionAndCanaryQualified,
        mechanicalOracle: mechanicalOracleQualified,
        metamorphic: metamorphicQualified,
        mutation: mutationQualified,
      }),
      pseudoOracleCaseCount: familyCounts.SYNTHETIC_PSEUDO_ORACLE,
    }),
  };
}

function holdoutAad(): Buffer {
  return Buffer.from(
    'writing-fr-evidence-assist-holdout-v3:3.0.0:AES-256-GCM',
    'utf8',
  );
}

export function sealEvidenceAssistAutonomousHoldout(input: {
  holdout: EvidenceAssistAutonomousHoldout;
  key: Buffer;
  sealedAt: string;
}): EvidenceAssistAutonomousHoldoutEnvelope {
  if (input.key.byteLength !== 32) {
    throw new Error('AUTONOMOUS_HOLDOUT_KEY_LENGTH_INVALID');
  }
  const plaintext = canonicalAutonomousHoldoutJson(input.holdout);
  const iv = randomBytes(12);
  const aad = holdoutAad();
  const cipher = createCipheriv('aes-256-gcm', input.key, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  return evidenceAssistAutonomousHoldoutEnvelopeSchema.parse({
    aadSha256: sha256(aad),
    algorithm: 'AES-256-GCM',
    authTagBase64: cipher.getAuthTag().toString('base64'),
    ciphertextBase64: ciphertext.toString('base64'),
    holdoutId: input.holdout.holdoutId,
    holdoutVersion: input.holdout.holdoutVersion,
    ivBase64: iv.toString('base64'),
    plaintextSha256: sha256(plaintext),
    schemaVersion: 1,
    sealedAt: input.sealedAt,
  });
}

export function openEvidenceAssistAutonomousHoldout(input: {
  envelope: unknown;
  key: Buffer;
}): EvidenceAssistAutonomousHoldout {
  if (input.key.byteLength !== 32) {
    throw new Error('AUTONOMOUS_HOLDOUT_KEY_LENGTH_INVALID');
  }
  const envelope = evidenceAssistAutonomousHoldoutEnvelopeSchema.parse(
    input.envelope,
  );
  const aad = holdoutAad();
  if (envelope.aadSha256 !== sha256(aad)) {
    throw new Error('AUTONOMOUS_HOLDOUT_AAD_MISMATCH');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    input.key,
    Buffer.from(envelope.ivBase64, 'base64'),
  );
  decipher.setAAD(aad);
  decipher.setAuthTag(Buffer.from(envelope.authTagBase64, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertextBase64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
  if (sha256(plaintext) !== envelope.plaintextSha256) {
    throw new Error('AUTONOMOUS_HOLDOUT_PLAINTEXT_SHA256_MISMATCH');
  }
  return evidenceAssistAutonomousHoldoutSchema.parse(JSON.parse(plaintext));
}
