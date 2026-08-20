import {
  AiCorrectionMethod,
  AiCorrectionPipelineKind,
  AiCorrectionStatus,
  ExerciseSubmissionStatus,
  Prisma,
  type PrismaClient,
} from '../../../generated/prisma/client.js';
import type { FormativeEvidenceCertificate } from '../../lib/formative-correction.js';
import { formativeEvidenceCertificateSchema } from '../../lib/formative-correction.js';
import { EVIDENCE_ASSIST_PROTOCOL_VERSION } from '../../lib/evidence-assist-protocol.js';
import {
  FormativeCorrectionFlowError,
  type FormativeCorrectionRepository,
  type FormativeCorrectionTarget,
  type StoredFormativeCorrection,
} from './fake-flow.js';

const MODEL_ROLE = 'V4_010_OFFLINE_FAKE';
const PROVIDER = 'offline-fake';

type CorrectionRow = Awaited<ReturnType<PrismaFormativeCorrectionRepository['findRow']>>;

function record(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('V4_010_FAKE_RECORD_INVALID');
  }
  return value as Record<string, unknown>;
}

function numberValue(value: unknown, code: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new Error(code);
  return value;
}

function stringValue(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(code);
  return value;
}

function stateValue(value: unknown): StoredFormativeCorrection['state'] {
  if (
    value === 'FEEDBACK_READY' ||
    value === 'REVISION_REQUIRED' ||
    value === 'CLARIFICATION_REQUIRED' ||
    value === 'TEMPORARILY_UNAVAILABLE'
  ) {
    return value;
  }
  throw new Error('V4_010_FAKE_STATE_INVALID');
}

function mapRow(row: NonNullable<CorrectionRow>): StoredFormativeCorrection {
  const snapshot = record(row.submissionSnapshot);
  const result = record(row.structuredResult);
  const certificateValue = result.certificate;
  const certificate: FormativeEvidenceCertificate | null =
    certificateValue === null || certificateValue === undefined
      ? null
      : formativeEvidenceCertificateSchema.parse(certificateValue);
  return {
    attemptCount: numberValue(result.attemptCount, 'V4_010_FAKE_ATTEMPTS_INVALID'),
    certificate,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    idempotencyKey: row.idempotencyKey,
    requestFingerprint: row.requestFingerprint,
    responseSha256: stringValue(
      snapshot.responseSha256,
      'V4_010_FAKE_RESPONSE_HASH_INVALID',
    ),
    responseText: stringValue(
      snapshot.responseText,
      'V4_010_FAKE_RESPONSE_TEXT_INVALID',
    ),
    state: stateValue(result.state),
    submissionId: stringValue(
      snapshot.submissionId,
      'V4_010_FAKE_SUBMISSION_INVALID',
    ),
    updatedAt: row.updatedAt.toISOString(),
    userId: row.userId,
    version: numberValue(result.version, 'V4_010_FAKE_VERSION_INVALID'),
  };
}

function correctionStatus(state: StoredFormativeCorrection['state']) {
  if (state === 'TEMPORARILY_UNAVAILABLE') {
    return AiCorrectionStatus.UNUSABLE_RELEASED;
  }
  if (state === 'CLARIFICATION_REQUIRED') return AiCorrectionStatus.UNCERTAIN;
  return AiCorrectionStatus.COMPLETED;
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class PrismaFormativeCorrectionRepository
  implements FormativeCorrectionRepository
{
  public constructor(private readonly prisma: PrismaClient) {}

  public findRow(id: string) {
    return this.prisma.aiCorrection.findUnique({ where: { id } });
  }

  public async create(
    input: Omit<StoredFormativeCorrection, 'createdAt' | 'id' | 'updatedAt'>,
  ): Promise<StoredFormativeCorrection> {
    try {
      const created = await this.prisma.aiCorrection.create({
      data: {
        contractSnapshot: asJson({
          authority: 'EVIDENCE_ASSIST_ONLY_DRAFT',
          billingEffect: 'NONE',
          progressionEffect: 'NONE',
        }),
        exerciseSubmissionId: input.submissionId,
        idempotencyKey: input.idempotencyKey,
        method: AiCorrectionMethod.AI,
        modelId: 'deterministic-v4-010',
        modelRole: MODEL_ROLE,
        pipelineKind: AiCorrectionPipelineKind.SINGLE_MODEL,
        promptSnapshot: asJson({ mode: 'OFFLINE_FAKE_ONLY' }),
        promptVersion: EVIDENCE_ASSIST_PROTOCOL_VERSION,
        provider: PROVIDER,
        requestFingerprint: input.requestFingerprint,
        status: AiCorrectionStatus.RESERVED,
        structuredResult: asJson({
          attemptCount: input.attemptCount,
          certificate: input.certificate,
          state: input.state,
          version: input.version,
        }),
        submissionSnapshot: asJson({
          responseSha256: input.responseSha256,
          responseText: input.responseText,
          submissionId: input.submissionId,
        }),
        userId: input.userId,
      },
      });
      return mapRow(created);
    } catch (error) {
      if (
        typeof error !== 'object' ||
        error === null ||
        !('code' in error) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
      const existing = await this.findByIdempotency(
        input.idempotencyKey,
        input.userId,
      );
      if (!existing) throw error;
      if (existing.requestFingerprint !== input.requestFingerprint) {
        throw new FormativeCorrectionFlowError('IDEMPOTENCY_CONFLICT');
      }
      return existing;
    }
  }

  public async findById(
    correctionId: string,
    userId: string,
  ): Promise<StoredFormativeCorrection | null> {
    const row = await this.prisma.aiCorrection.findFirst({
      where: { id: correctionId, modelRole: MODEL_ROLE, userId },
    });
    return row ? mapRow(row) : null;
  }

  public async findByIdempotency(
    idempotencyKey: string,
    userId: string,
  ): Promise<StoredFormativeCorrection | null> {
    const row = await this.prisma.aiCorrection.findUnique({
      where: { userId_idempotencyKey: { idempotencyKey, userId } },
    });
    return row?.modelRole === MODEL_ROLE ? mapRow(row) : null;
  }

  public async findTarget(
    submissionId: string,
    userId: string,
  ): Promise<FormativeCorrectionTarget | null> {
    const submission = await this.prisma.exerciseSubmission.findFirst({
      where: {
        id: submissionId,
        status: ExerciseSubmissionStatus.SUBMITTED,
        userId,
      },
      select: {
        contentMarkdown: true,
        exercise: {
          select: {
            id: true,
            instructions: true,
            key: true,
            lesson: {
              select: {
                module: {
                  select: {
                    slug: true,
                    stage: {
                      select: {
                        program: { select: { slug: true } },
                        slug: true,
                      },
                    },
                  },
                },
                slug: true,
                summary: true,
              },
            },
          },
        },
        id: true,
      },
    });
    if (!submission) return null;
    return {
      activityKey: submission.exercise.key,
      contentMarkdown: submission.contentMarkdown,
      exerciseId: submission.exercise.id,
      lessonSlug: submission.exercise.lesson.slug,
      moduleSlug: submission.exercise.lesson.module.slug,
      programSlug: submission.exercise.lesson.module.stage.program.slug,
      stageSlug: submission.exercise.lesson.module.stage.slug,
      submissionId: submission.id,
      taskContext: submission.exercise.lesson.summary,
      taskPrompt: submission.exercise.instructions,
      userId,
    };
  }

  public async list(
    submissionId: string,
    userId: string,
  ): Promise<StoredFormativeCorrection[]> {
    const rows = await this.prisma.aiCorrection.findMany({
      orderBy: { createdAt: 'asc' },
      where: {
        exerciseSubmissionId: submissionId,
        modelRole: MODEL_ROLE,
        userId,
      },
    });
    return rows.map(mapRow).sort((left, right) => left.version - right.version);
  }

  public async update(
    correctionId: string,
    userId: string,
    patch: Pick<StoredFormativeCorrection, 'attemptCount' | 'certificate' | 'state'>,
  ): Promise<StoredFormativeCorrection> {
    const current = await this.findById(correctionId, userId);
    if (!current) throw new FormativeCorrectionFlowError('SUBMISSION_NOT_FOUND');
    const updated = await this.prisma.aiCorrection.update({
      data: {
        completedAt: new Date(),
        status: correctionStatus(patch.state),
        structuredResult: asJson({
          attemptCount: patch.attemptCount,
          certificate: patch.certificate,
          state: patch.state,
          version: current.version,
        }),
      },
      where: { id: correctionId },
    });
    return mapRow(updated);
  }
}
