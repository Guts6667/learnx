import { createHash, randomUUID } from 'node:crypto';

import type { CompiledExecutableRubric } from '../../lib/executable-rubric-engine.js';
import {
  buildFormativeEvidenceCertificate,
  type FormativeEvidenceCertificate,
  type FormativeCorrectionState,
  simulatedCorrectionQuote,
} from '../../lib/formative-correction.js';
import type {
  EvidenceAssistOrchestrator,
  EvidenceAssistProviderPort,
} from '../ai/evidence-assist-orchestrator.js';
import { createEvidenceAssistOrchestrator } from '../ai/evidence-assist-orchestrator.js';

export const V4_010_FAKE_FLOW_VERSION = '1.0.0';

export type FormativeCorrectionTarget = Readonly<{
  activityKey: string;
  contentMarkdown: string;
  exerciseId: string;
  lessonSlug: string;
  moduleSlug: string;
  programSlug: string;
  stageSlug: string;
  submissionId: string;
  taskContext: string;
  taskPrompt: string;
  userId: string;
}>;

export type StoredFormativeCorrection = Readonly<{
  attemptCount: number;
  certificate: FormativeEvidenceCertificate | null;
  createdAt: string;
  id: string;
  idempotencyKey: string;
  requestFingerprint: string;
  responseSha256: string;
  responseText: string;
  state: FormativeCorrectionState;
  submissionId: string;
  updatedAt: string;
  userId: string;
  version: number;
}>;

export type PublicFormativeCorrection = Omit<
  StoredFormativeCorrection,
  'idempotencyKey' | 'requestFingerprint' | 'userId'
> & {
  simulation: typeof simulatedCorrectionQuote;
};

export interface FormativeCorrectionRepository {
  create(
    input: Omit<StoredFormativeCorrection, 'createdAt' | 'id' | 'updatedAt'>,
  ): Promise<StoredFormativeCorrection>;
  findById(
    correctionId: string,
    userId: string,
  ): Promise<StoredFormativeCorrection | null>;
  findByIdempotency(
    idempotencyKey: string,
    userId: string,
  ): Promise<StoredFormativeCorrection | null>;
  findTarget(
    submissionId: string,
    userId: string,
  ): Promise<FormativeCorrectionTarget | null>;
  list(
    submissionId: string,
    userId: string,
  ): Promise<StoredFormativeCorrection[]>;
  update(
    correctionId: string,
    userId: string,
    patch: Pick<StoredFormativeCorrection, 'attemptCount' | 'certificate' | 'state'>,
  ): Promise<StoredFormativeCorrection>;
}

export class FormativeCorrectionFlowError extends Error {
  public constructor(
    public readonly code:
      | 'CORRECTION_NOT_RETRYABLE'
      | 'FEATURE_DISABLED'
      | 'IDEMPOTENCY_CONFLICT'
      | 'IDEMPOTENCY_KEY_INVALID'
      | 'INITIAL_RESPONSE_MUST_MATCH_SUBMISSION'
      | 'RESPONSE_REQUIRED'
      | 'SUBMISSION_NOT_ELIGIBLE'
      | 'SUBMISSION_NOT_FOUND',
  ) {
    super(code);
    this.name = 'FormativeCorrectionFlowError';
  }
}

export type FormativeCorrectionHistory = Readonly<{
  corrections: PublicFormativeCorrection[];
  enabled: boolean;
  simulation: typeof simulatedCorrectionQuote;
}>;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function publicRecord(record: StoredFormativeCorrection): PublicFormativeCorrection {
  const { idempotencyKey: _idempotencyKey, requestFingerprint: _fingerprint, userId: _userId, ...safe } =
    record;
  void _idempotencyKey;
  void _fingerprint;
  void _userId;
  return { ...safe, simulation: simulatedCorrectionQuote };
}

function assertIdempotencyKey(value: string): void {
  if (!/^[a-zA-Z0-9._:-]{8,200}$/u.test(value)) {
    throw new FormativeCorrectionFlowError('IDEMPOTENCY_KEY_INVALID');
  }
}

function isPilotTarget(input: {
  bindingTarget: FormativeCorrectionTargetIdentity;
  target: FormativeCorrectionTarget;
}): boolean {
  return (
    input.target.activityKey === input.bindingTarget.activityKey &&
    input.target.lessonSlug === input.bindingTarget.lessonSlug &&
    input.target.moduleSlug === input.bindingTarget.moduleSlug &&
    input.target.programSlug === input.bindingTarget.programSlug &&
    input.target.stageSlug === input.bindingTarget.stageSlug
  );
}

export type FormativeCorrectionTargetIdentity = Readonly<{
  activityKey: string;
  lessonSlug: string;
  moduleSlug: string;
  programSlug: string;
  stageSlug: string;
}>;

export class FormativeCorrectionFakeFlowService {
  public constructor(
    private readonly input: Readonly<{
      bindingTarget: FormativeCorrectionTargetIdentity;
      compiled: CompiledExecutableRubric;
      orchestrator: EvidenceAssistOrchestrator;
      repository: FormativeCorrectionRepository;
    }>,
  ) {}

  private async requireTarget(
    submissionId: string,
    userId: string,
  ): Promise<FormativeCorrectionTarget> {
    const target = await this.input.repository.findTarget(submissionId, userId);
    if (!target) throw new FormativeCorrectionFlowError('SUBMISSION_NOT_FOUND');
    if (!isPilotTarget({ bindingTarget: this.input.bindingTarget, target })) {
      throw new FormativeCorrectionFlowError('SUBMISSION_NOT_ELIGIBLE');
    }
    return target;
  }

  public async history(
    submissionId: string,
    userId: string,
  ): Promise<FormativeCorrectionHistory> {
    const target = await this.input.repository.findTarget(submissionId, userId);
    if (!target) throw new FormativeCorrectionFlowError('SUBMISSION_NOT_FOUND');
    if (!isPilotTarget({ bindingTarget: this.input.bindingTarget, target })) {
      return { corrections: [], enabled: false, simulation: simulatedCorrectionQuote };
    }
    const records = await this.input.repository.list(submissionId, userId);
    return {
      corrections: records.map(publicRecord),
      enabled: true,
      simulation: simulatedCorrectionQuote,
    };
  }

  private async execute(
    correction: StoredFormativeCorrection,
    target: FormativeCorrectionTarget,
  ): Promise<StoredFormativeCorrection> {
    const attemptCount = correction.attemptCount + 1;
    try {
      const candidateResult = await this.input.orchestrator.run({
        compiled: this.input.compiled,
        idempotencyKey: `${correction.id}:attempt:${attemptCount}`,
        responseText: correction.responseText,
        taskContext: target.taskContext,
        taskPrompt: target.taskPrompt,
      });
      const certificate = buildFormativeEvidenceCertificate({
        compiled: this.input.compiled,
        responseText: correction.responseText,
        result: candidateResult,
      });
      return this.input.repository.update(correction.id, correction.userId, {
        attemptCount,
        certificate,
        state: certificate.state,
      });
    } catch {
      return this.input.repository.update(correction.id, correction.userId, {
        attemptCount,
        certificate: null,
        state: 'TEMPORARILY_UNAVAILABLE',
      });
    }
  }

  public async request(input: {
    idempotencyKey: string;
    responseText: string;
    submissionId: string;
    userId: string;
  }): Promise<PublicFormativeCorrection> {
    assertIdempotencyKey(input.idempotencyKey);
    if (!input.responseText.trim()) {
      throw new FormativeCorrectionFlowError('RESPONSE_REQUIRED');
    }
    const target = await this.requireTarget(input.submissionId, input.userId);
    const responseSha256 = sha256(input.responseText);
    const requestFingerprint = sha256(
      JSON.stringify({
        flowVersion: V4_010_FAKE_FLOW_VERSION,
        responseSha256,
        rubricFingerprint: this.input.compiled.rubricFingerprint,
        submissionId: input.submissionId,
      }),
    );
    const idempotent = await this.input.repository.findByIdempotency(
      input.idempotencyKey,
      input.userId,
    );
    if (idempotent) {
      if (idempotent.requestFingerprint !== requestFingerprint) {
        throw new FormativeCorrectionFlowError('IDEMPOTENCY_CONFLICT');
      }
      return publicRecord(idempotent);
    }
    const history = await this.input.repository.list(
      input.submissionId,
      input.userId,
    );
    const reusable = history.find(
      (record) => record.responseSha256 === responseSha256,
    );
    if (reusable) return publicRecord(reusable);
    if (history.length === 0 && input.responseText !== target.contentMarkdown) {
      throw new FormativeCorrectionFlowError(
        'INITIAL_RESPONSE_MUST_MATCH_SUBMISSION',
      );
    }
    const correction = await this.input.repository.create({
      attemptCount: 0,
      certificate: null,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint,
      responseSha256,
      responseText: input.responseText,
      state: 'TEMPORARILY_UNAVAILABLE',
      submissionId: input.submissionId,
      userId: input.userId,
      version:
        history.reduce((maximum, record) => Math.max(maximum, record.version), 0) +
        1,
    });
    return publicRecord(await this.execute(correction, target));
  }

  public async retry(
    correctionId: string,
    userId: string,
  ): Promise<PublicFormativeCorrection> {
    const correction = await this.input.repository.findById(correctionId, userId);
    if (!correction) {
      throw new FormativeCorrectionFlowError('SUBMISSION_NOT_FOUND');
    }
    if (correction.state !== 'TEMPORARILY_UNAVAILABLE') {
      throw new FormativeCorrectionFlowError('CORRECTION_NOT_RETRYABLE');
    }
    const target = await this.requireTarget(correction.submissionId, userId);
    return publicRecord(await this.execute(correction, target));
  }
}

export function createFormativeCorrectionFakeFlow(input: {
  bindingTarget: FormativeCorrectionTargetIdentity;
  compiled: CompiledExecutableRubric;
  provider: EvidenceAssistProviderPort;
  repository: FormativeCorrectionRepository;
}): FormativeCorrectionFakeFlowService {
  return new FormativeCorrectionFakeFlowService({
    ...input,
    orchestrator: createEvidenceAssistOrchestrator({
      gate: { enabled: true, mode: 'OFFLINE_FAKE_ONLY' },
      provider: input.provider,
    }),
  });
}

export class InMemoryFormativeCorrectionRepository
  implements FormativeCorrectionRepository
{
  private readonly records = new Map<string, StoredFormativeCorrection>();

  public constructor(
    private readonly targets: readonly FormativeCorrectionTarget[],
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async create(
    input: Omit<StoredFormativeCorrection, 'createdAt' | 'id' | 'updatedAt'>,
  ): Promise<StoredFormativeCorrection> {
    const existing =
      [...this.records.values()].find(
        (record) =>
          record.idempotencyKey === input.idempotencyKey &&
          record.userId === input.userId,
      ) ?? null;
    if (existing) {
      if (existing.requestFingerprint !== input.requestFingerprint) {
        throw new FormativeCorrectionFlowError('IDEMPOTENCY_CONFLICT');
      }
      return existing;
    }
    const timestamp = this.now().toISOString();
    const record = {
      ...input,
      createdAt: timestamp,
      id: randomUUID(),
      updatedAt: timestamp,
    };
    this.records.set(record.id, record);
    return record;
  }

  public async findById(
    correctionId: string,
    userId: string,
  ): Promise<StoredFormativeCorrection | null> {
    const record = this.records.get(correctionId);
    return record?.userId === userId ? record : null;
  }

  public async findByIdempotency(
    idempotencyKey: string,
    userId: string,
  ): Promise<StoredFormativeCorrection | null> {
    return (
      [...this.records.values()].find(
        (record) =>
          record.idempotencyKey === idempotencyKey && record.userId === userId,
      ) ?? null
    );
  }

  public async findTarget(
    submissionId: string,
    userId: string,
  ): Promise<FormativeCorrectionTarget | null> {
    return (
      this.targets.find(
        (target) =>
          target.submissionId === submissionId && target.userId === userId,
      ) ?? null
    );
  }

  public async list(
    submissionId: string,
    userId: string,
  ): Promise<StoredFormativeCorrection[]> {
    return [...this.records.values()]
      .filter(
        (record) =>
          record.submissionId === submissionId && record.userId === userId,
      )
      .sort((left, right) => left.version - right.version);
  }

  public async update(
    correctionId: string,
    userId: string,
    patch: Pick<StoredFormativeCorrection, 'attemptCount' | 'certificate' | 'state'>,
  ): Promise<StoredFormativeCorrection> {
    const current = await this.findById(correctionId, userId);
    if (!current) throw new FormativeCorrectionFlowError('SUBMISSION_NOT_FOUND');
    const updated = {
      ...current,
      ...patch,
      updatedAt: this.now().toISOString(),
    };
    this.records.set(correctionId, updated);
    return updated;
  }
}
