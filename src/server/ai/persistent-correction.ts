import { createHash } from 'node:crypto';

import {
  correctionContractSchema,
  correctionOutputSchema,
  deriveCorrectionSecondPassDecision,
  getCorrectionContractRuntimeEligibility,
  validateCorrectionOutputForContract,
  type CorrectionContract,
  type CorrectionOutput,
} from '../../lib/ai-correction-contracts.js';
import {
  AiProviderError,
  type AiModelRole,
  type AiPromptMessage,
  type AiGenerationMetadata,
  type StructuredAiProvider,
} from './structured-provider.js';

type CorrectionMethod = 'AI' | 'DETERMINISTIC';

export type CorrectionStatus =
  | 'RESERVED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'AI_REVIEW_REQUIRED'
  | 'RETRY_PENDING'
  | 'FAILED_RELEASED';

export type CorrectionDecision =
  | 'PASSED'
  | 'NOT_PASSED'
  | 'REVIEW_REQUIRED';

export type CorrectionTarget =
  | { exerciseSubmissionId: string; kind: 'EXERCISE' }
  | {
      kind: 'STAGE_ASSESSMENT';
      stageAssessmentSubmissionId: string;
    };

export interface PersistentCorrectionRecord {
  confidence: number | null;
  contractSnapshot: unknown;
  decision: CorrectionDecision | null;
  id: string;
  idempotencyKey: string;
  method: CorrectionMethod;
  promptSnapshot: unknown;
  requestFingerprint: string;
  score: number | null;
  status: CorrectionStatus;
  structuredResult: unknown | null;
  submissionSnapshot: unknown;
  userId: string;
}

export interface CorrectionReservationInput {
  contractSnapshot: CorrectionContract;
  idempotencyKey: string;
  method: CorrectionMethod;
  modelRole: AiModelRole;
  promptSnapshot: {
    messages: AiPromptMessage[];
    outputSchemaName: string;
  };
  promptVersion: string;
  requestFingerprint: string;
  target: CorrectionTarget;
  userId: string;
}

export interface ClaimedCorrection {
  attemptId: string;
  attemptSequence: number;
  correction: PersistentCorrectionRecord;
}

export interface CorrectionAttemptFailure {
  attemptId: string;
  correctionId: string;
  errorCode: string;
  retryable: boolean;
}

export interface CorrectionAttemptSuccess {
  attemptId: string;
  confidence: number;
  correctionId: string;
  decision: CorrectionDecision;
  metadata: AiGenerationMetadata;
  output: CorrectionOutput;
  score: number;
  status: 'AI_REVIEW_REQUIRED' | 'COMPLETED';
}

export interface PersistentCorrectionRepository {
  claim(correctionId: string): Promise<ClaimedCorrection | null>;
  complete(input: CorrectionAttemptSuccess): Promise<PersistentCorrectionRecord>;
  fail(input: CorrectionAttemptFailure): Promise<PersistentCorrectionRecord>;
  get(correctionId: string): Promise<PersistentCorrectionRecord>;
  reserve(input: CorrectionReservationInput): Promise<PersistentCorrectionRecord>;
}

export class CorrectionEngineError extends Error {
  public constructor(
    public readonly code:
      | 'CONTRACT_NOT_ELIGIBLE'
      | 'DUPLICATE_OPERATION_CONFLICT'
      | 'INVALID_IDEMPOTENCY_KEY'
      | 'TARGET_CONTRACT_MISMATCH'
      | 'TRANSITION_CONFLICT',
  ) {
    super(code);
    this.name = 'CorrectionEngineError';
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== 'object' || value === null) return value;

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
}

function createCorrectionRequestFingerprint(input: {
  contract: CorrectionContract;
  maxOutputTokens: number;
  messages: AiPromptMessage[];
  method: CorrectionMethod;
  modelRole: AiModelRole;
  promptVersion: string;
  target: CorrectionTarget;
}): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(input)))
    .digest('hex');
}

export function calculateServerCorrectionResult(input: {
  contract: CorrectionContract;
  output: CorrectionOutput;
}): {
  confidence: number;
  decision: CorrectionDecision;
  score: number;
  status: 'AI_REVIEW_REQUIRED' | 'COMPLETED';
} {
  const output = validateCorrectionOutputForContract(input);
  const corrections = new Map(
    output.criteria.map((criterion) => [criterion.criterionKey, criterion]),
  );
  const rawScore = input.contract.criteria.reduce((total, criterion) => {
    const correction = corrections.get(criterion.key);
    const level = criterion.performanceLevels.find(
      (candidate) => candidate.key === correction?.levelKey,
    );
    if (!correction || !level) {
      throw new AiProviderError('PROVIDER_RESPONSE_INVALID', false);
    }
    return total + (criterion.weight * level.score) / 100;
  }, 0);
  const score = Math.round(rawScore * 100) / 100;
  const confidence = Math.min(
    output.overallConfidence,
    ...output.criteria.map((criterion) => criterion.confidence),
  );
  const secondPass = deriveCorrectionSecondPassDecision({
    contract: input.contract,
    evaluations: [output],
  });
  const reviewRequired = secondPass.required;

  if (reviewRequired) {
    return {
      confidence,
      decision: 'REVIEW_REQUIRED',
      score,
      status: 'AI_REVIEW_REQUIRED',
    };
  }

  return {
    confidence,
    decision: score >= input.contract.passingScore ? 'PASSED' : 'NOT_PASSED',
    score,
    status: 'COMPLETED',
  };
}

function assertIdempotencyKey(value: string): void {
  if (!/^[a-zA-Z0-9._:-]{8,200}$/.test(value)) {
    throw new CorrectionEngineError('INVALID_IDEMPOTENCY_KEY');
  }
}

function assertTargetMatchesContract(
  target: CorrectionTarget,
  contract: CorrectionContract,
): void {
  if (target.kind !== contract.target.kind) {
    throw new CorrectionEngineError('TARGET_CONTRACT_MISMATCH');
  }
}

function providerFailure(error: unknown): {
  errorCode: string;
  retryable: boolean;
} {
  if (error instanceof AiProviderError) {
    return { errorCode: error.code, retryable: error.retryable };
  }
  return { errorCode: 'PROVIDER_RESPONSE_INVALID', retryable: false };
}

export class PersistentCorrectionEngine {
  public constructor(
    private readonly repository: PersistentCorrectionRepository,
    private readonly provider: StructuredAiProvider,
  ) {}

  public async correct(input: {
    contract: unknown;
    idempotencyKey: string;
    maxOutputTokens: number;
    messages: AiPromptMessage[];
    promptVersion: string;
    role: AiModelRole;
    target: CorrectionTarget;
    userId: string;
  }): Promise<PersistentCorrectionRecord> {
    assertIdempotencyKey(input.idempotencyKey);
    const eligibility = getCorrectionContractRuntimeEligibility(input.contract);
    if (!eligibility.eligible) {
      throw new CorrectionEngineError('CONTRACT_NOT_ELIGIBLE');
    }
    const contract = correctionContractSchema.parse(eligibility.contract);
    assertTargetMatchesContract(input.target, contract);
    const requestFingerprint = createCorrectionRequestFingerprint({
      contract,
      maxOutputTokens: input.maxOutputTokens,
      messages: input.messages,
      method: 'AI',
      modelRole: input.role,
      promptVersion: input.promptVersion,
      target: input.target,
    });
    const correction = await this.repository.reserve({
      contractSnapshot: contract,
      idempotencyKey: input.idempotencyKey,
      method: 'AI',
      modelRole: input.role,
      promptSnapshot: {
        messages: input.messages,
        outputSchemaName: 'learnx_correction_output_v1',
      },
      promptVersion: input.promptVersion,
      requestFingerprint,
      target: input.target,
      userId: input.userId,
    });

    if (
      correction.status === 'COMPLETED' ||
      correction.status === 'AI_REVIEW_REQUIRED' ||
      correction.status === 'FAILED_RELEASED' ||
      correction.status === 'PROCESSING'
    ) {
      return correction;
    }

    const claimed = await this.repository.claim(correction.id);
    if (!claimed) return this.repository.get(correction.id);

    let success: CorrectionAttemptSuccess;
    try {
      const generation = await this.provider.generate({
        idempotencyKey: `${correction.id}:attempt:${claimed.attemptSequence}`,
        maxOutputTokens: input.maxOutputTokens,
        messages: input.messages,
        outputSchema: correctionOutputSchema,
        outputSchemaName: 'learnx_correction_output_v1',
        role: input.role,
      });
      const output = validateCorrectionOutputForContract({
        contract,
        output: generation.output,
      });
      const result = calculateServerCorrectionResult({ contract, output });
      success = {
        attemptId: claimed.attemptId,
        correctionId: correction.id,
        metadata: generation.metadata,
        output,
        ...result,
      };
    } catch (error) {
      const failure = providerFailure(error);
      return this.repository.fail({
        attemptId: claimed.attemptId,
        correctionId: correction.id,
        ...failure,
      });
    }
    return this.repository.complete(success);
  }
}
