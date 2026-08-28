import {
  CorrectionModelOutputError,
  CorrectionProviderError,
} from '../../lib/ai-correction-provider-adapters.js';
import type {
  CorrectionTransportPort,
  RuntimeCorrectionAttempt,
} from './correction-orchestration-contracts.js';

export function successfulAttempt(input: {
  generation: Awaited<ReturnType<CorrectionTransportPort['execute']>>;
  sequence: number;
  valid: boolean;
}): RuntimeCorrectionAttempt {
  return {
    ...(input.generation.usage.actualCostUsd === undefined
      ? {}
      : { actualCostUsd: input.generation.usage.actualCostUsd }),
    ...(input.valid ? {} : { errorCode: 'MODEL_OUTPUT_INVALID' }),
    inputTokens: input.generation.usage.inputTokens,
    latencyMs: input.generation.latencyMs,
    modelSnapshot: input.generation.modelSnapshot,
    output: input.generation.output,
    ...(input.generation.providerRequestId === undefined
      ? {}
      : { providerRequestId: input.generation.providerRequestId }),
    providerRoute: input.generation.providerRoute,
    reasoningTokens: input.generation.usage.reasoningTokens,
    sequence: input.sequence,
    status: input.valid ? 'SUCCEEDED' : 'FAILED',
    visibleOutputTokens: input.generation.usage.visibleOutputTokens,
  };
}

function modelOutputFailure(
  error: CorrectionModelOutputError,
  sequence: number,
): RuntimeCorrectionAttempt {
  return {
    ...(error.usage?.actualCostUsd === undefined
      ? {}
      : { actualCostUsd: error.usage.actualCostUsd }),
    errorCode: error.message,
    ...(error.usage === undefined
      ? {}
      : {
          inputTokens: error.usage.inputTokens,
          reasoningTokens: error.usage.reasoningTokens,
          visibleOutputTokens: error.usage.visibleOutputTokens,
        }),
    ...(error.latencyMs === undefined ? {} : { latencyMs: error.latencyMs }),
    ...(error.modelSnapshot === undefined
      ? {}
      : { modelSnapshot: error.modelSnapshot }),
    ...(error.rawModelOutput === undefined
      ? {}
      : { output: error.rawModelOutput }),
    ...(error.providerRequestId === undefined
      ? {}
      : { providerRequestId: error.providerRequestId }),
    ...(error.providerRoute === undefined
      ? {}
      : { providerRoute: error.providerRoute }),
    sequence,
    status: 'FAILED',
  };
}

export function failedAttempt(
  error: unknown,
  sequence: number,
): RuntimeCorrectionAttempt {
  if (error instanceof CorrectionModelOutputError) {
    return modelOutputFailure(error, sequence);
  }
  if (error instanceof CorrectionProviderError) {
    return {
      errorCode: error.message,
      ...(error.latencyMs === undefined ? {} : { latencyMs: error.latencyMs }),
      ...(error.modelSnapshot === undefined
        ? {}
        : { modelSnapshot: error.modelSnapshot }),
      ...(error.providerRequestId === undefined
        ? {}
        : { providerRequestId: error.providerRequestId }),
      ...(error.providerRoute === undefined
        ? {}
        : { providerRoute: error.providerRoute }),
      sequence,
      status: 'FAILED',
    };
  }
  return {
    errorCode: error instanceof Error ? error.message : 'TRANSPORT_ERROR',
    sequence,
    status: 'FAILED',
  };
}
