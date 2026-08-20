import { z } from 'zod';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

const autonomousQualificationSchema = z
  .object({
    candidateOutputsAccessibleDuringAuthoring: z.literal(false),
    candidateResultsReused: z.literal(0),
    constructionManifestSha256: sha256Schema.nullable(),
    gates: z
      .object({
        injectionAndCanary: z.boolean(),
        mechanicalOracle: z.boolean(),
        metamorphic: z.boolean(),
        mutation: z.boolean(),
      })
      .strict(),
    qualifiedAt: z.iso.datetime().nullable(),
    status: z.enum(['PENDING_AUTONOMOUS_QUALIFICATION', 'QUALIFIED']),
    validationRecordSha256: sha256Schema.nullable(),
  })
  .strict();

export const executableRubricAutonomousHoldoutManifestSchema = z
  .object({
    caseCount: z.number().int().nonnegative(),
    encryptedArtifact: z
      .object({
        algorithm: z.literal('AES-256-GCM'),
        path: z.literal('writing-fr-holdout.v3.enc.json'),
        sha256: sha256Schema.nullable(),
      })
      .strict(),
    executable: z.boolean(),
    holdoutId: z.literal('writing-fr-evidence-assist-holdout-v3'),
    holdoutVersion: z.literal('3.0.0'),
    language: z.literal('fr-FR'),
    minimumCaseCount: z.literal(24),
    modality: z.literal('WRITING'),
    openedAt: z.iso.datetime().nullable(),
    qualificationRecord: z
      .object({
        path: z.literal('writing-fr-holdout.v3.qualification.json'),
        sha256: sha256Schema,
      })
      .strict()
      .nullable(),
    pendingAuthoring: z
      .object({
        constructionManifest: z
          .object({
            path: z.literal('writing-fr-holdout.v3.construction.json'),
            sha256: sha256Schema,
          })
          .strict(),
        plaintextSha256: sha256Schema,
        prevalidationRecord: z
          .object({
            path: z.literal('writing-fr-holdout.v3.prevalidation.json'),
            sha256: sha256Schema,
          })
          .strict(),
      })
      .strict()
      .nullable(),
    prohibitions: z
      .array(
        z.enum([
          'NO_PLAINTEXT_IN_REPOSITORY',
          'NO_OPEN_BEFORE_FULL_DEVELOPMENT_GO',
          'NO_TUNING_FROM_HOLDOUT',
          'NO_CANDIDATE_OUTPUT_ACCESS_DURING_AUTHORING',
          'NO_EXECUTION_WITHOUT_AUTONOMOUS_QUALIFICATION',
        ]),
      )
      .length(5),
    protocol: z
      .object({
        authorityPath: z.literal('docs/V4_EVIDENCE_ASSIST_PROTOCOL_SPEC.md'),
        segmentationVersion: z.literal('2.0.0'),
      })
      .strict(),
    qualification: autonomousQualificationSchema,
    schemaVersion: z.literal(3),
    sealed: z.boolean(),
    status: z.enum([
      'CONTENT_NOT_AUTHORED',
      'CONTENT_AUTHORED_PENDING_EXPLICIT_OWNER_SEAL',
      'SEALED_AWAITING_DEVELOPMENT_GO',
      'OPENED_ONE_SHOT',
    ]),
  })
  .strict()
  .superRefine((manifest, context) => {
    const qualificationComplete =
      manifest.qualification.status === 'QUALIFIED' &&
      manifest.qualification.qualifiedAt !== null &&
      manifest.qualification.constructionManifestSha256 !== null &&
      manifest.qualification.validationRecordSha256 !== null &&
      Object.values(manifest.qualification.gates).every(Boolean);
    const encryptedArtifactPresent = manifest.encryptedArtifact.sha256 !== null;
    const qualificationRecordPresent = manifest.qualificationRecord !== null;

    if (new Set(manifest.prohibitions).size !== manifest.prohibitions.length) {
      context.addIssue({
        code: 'custom',
        message: 'Autonomous holdout prohibitions must be unique.',
        path: ['prohibitions'],
      });
    }

    if (manifest.qualification.status === 'PENDING_AUTONOMOUS_QUALIFICATION') {
      if (
        manifest.qualification.qualifiedAt !== null ||
        manifest.qualification.constructionManifestSha256 !== null ||
        manifest.qualification.validationRecordSha256 !== null ||
        Object.values(manifest.qualification.gates).some(Boolean)
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'Pending autonomous qualification cannot advertise partial proof.',
          path: ['qualification'],
        });
      }
    } else if (!qualificationComplete) {
      context.addIssue({
        code: 'custom',
        message:
          'Qualified autonomous holdouts require every qualification proof.',
        path: ['qualification'],
      });
    }

    if (manifest.sealed) {
      if (
        !qualificationComplete ||
        !encryptedArtifactPresent ||
        !qualificationRecordPresent ||
        manifest.caseCount < manifest.minimumCaseCount
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'A sealed autonomous holdout requires complete autonomous qualification, an encrypted artifact and the minimum case count.',
          path: ['sealed'],
        });
      }
    } else if (
      qualificationComplete ||
      encryptedArtifactPresent ||
      qualificationRecordPresent
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'An unsealed autonomous holdout cannot advertise qualified content or an encrypted artifact.',
        path: ['sealed'],
      });
    }

    if (manifest.status === 'CONTENT_NOT_AUTHORED') {
      if (
        manifest.sealed ||
        manifest.executable ||
        manifest.openedAt !== null ||
        manifest.caseCount !== 0 ||
        manifest.pendingAuthoring !== null ||
        manifest.qualificationRecord !== null
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'Content-not-authored autonomous holdouts must remain closed and unsealed.',
          path: ['status'],
        });
      }
    }
    if (manifest.status === 'CONTENT_AUTHORED_PENDING_EXPLICIT_OWNER_SEAL') {
      if (
        manifest.sealed ||
        manifest.executable ||
        manifest.openedAt !== null ||
        manifest.caseCount < manifest.minimumCaseCount ||
        manifest.pendingAuthoring === null ||
        manifest.qualificationRecord !== null ||
        manifest.qualification.status !==
          'PENDING_AUTONOMOUS_QUALIFICATION'
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'Prevalidated authoring must remain unsealed, non-executable and explicitly pending owner authorization.',
          path: ['status'],
        });
      }
    }
    if (manifest.status === 'SEALED_AWAITING_DEVELOPMENT_GO') {
      if (
        !manifest.sealed ||
        manifest.executable ||
        manifest.openedAt !== null ||
        manifest.pendingAuthoring !== null ||
        manifest.qualificationRecord === null
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'A sealed autonomous holdout awaiting GO must remain non-executable and unopened.',
          path: ['status'],
        });
      }
    }
    if (manifest.status === 'OPENED_ONE_SHOT') {
      if (
        !manifest.sealed ||
        !manifest.executable ||
        manifest.openedAt === null ||
        manifest.pendingAuthoring !== null ||
        manifest.qualificationRecord === null
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'An opened autonomous holdout requires a sealed artifact and an explicit one-shot opening timestamp.',
          path: ['status'],
        });
      }
    }
  });

export type ExecutableRubricAutonomousHoldoutManifest = z.infer<
  typeof executableRubricAutonomousHoldoutManifestSchema
>;
