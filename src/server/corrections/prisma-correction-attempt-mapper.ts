import { Prisma } from '../../../generated/prisma/client.js';
import type { RuntimeCorrectionAttempt } from './correction-orchestration-contracts.js';
import { PROMOTED_CORRECTION_IDENTITY } from './promoted-identity.js';

export function toAttemptOutcomeData(
  attempt: RuntimeCorrectionAttempt,
): Prisma.AiCorrectionAttemptUpdateInput {
  return {
    completedAt: new Date(),
    completionTokens: attempt.visibleOutputTokens,
    costConfirmedAt:
      attempt.actualCostUsd === undefined ? undefined : new Date(),
    costSource: attempt.actualCostUsd === undefined ? undefined : 'ACTUAL',
    costUsd: attempt.actualCostUsd,
    dispatchStatus:
      attempt.providerRequestId === undefined ? 'ORPHANED' : 'CONFIRMED',
    errorCode: attempt.errorCode,
    generationId: attempt.providerRequestId,
    latencyMs: attempt.latencyMs,
    modelId: attempt.modelSnapshot ?? PROMOTED_CORRECTION_IDENTITY.modelId,
    promptTokens: attempt.inputTokens,
    provider: attempt.providerRoute ?? PROMOTED_CORRECTION_IDENTITY.provider,
    providerRequestId: attempt.providerRequestId,
    rawOutput:
      attempt.status === 'FAILED' && attempt.output !== undefined
        ? (attempt.output as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    reasoningTokens: attempt.reasoningTokens,
    status: attempt.status,
    structuredResult:
      attempt.status === 'SUCCEEDED' && attempt.output !== undefined
        ? (attempt.output as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    totalTokens:
      attempt.inputTokens === undefined ||
      attempt.visibleOutputTokens === undefined
        ? undefined
        : attempt.inputTokens +
          attempt.visibleOutputTokens +
          (attempt.reasoningTokens ?? 0),
  };
}
