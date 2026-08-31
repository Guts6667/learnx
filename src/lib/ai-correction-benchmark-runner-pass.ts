import {
  benchmarkAttemptSchema,
  findBenchmarkContract,
  salvageProtocol3PartialCorrection,
  validateBenchmarkProtocol3ModelOutputWithEvidence,
  type BenchmarkAttempt,
  type CorrectionBenchmarkConfiguration,
  type CorrectionBenchmarkCorpus,
} from './ai-correction-benchmark.js';
import { canonicalizeProtocol3CorrectionOutput } from './ai-correction-contracts.js';
import {
  CorrectionModelOutputError,
  CorrectionProviderError,
} from './ai-correction-provider-adapters.js';
import {
  serializeRawModelOutput,
  stableModelValidationError,
  type CandidateExecutor,
} from './ai-correction-benchmark-runner-preflight.js';

export async function executeBenchmarkWorkflowPass(input: {
  apiKey: string;
  attemptNumber: number;
  benchmarkCase: CorrectionBenchmarkCorpus['cases'][number];
  candidate: CorrectionBenchmarkConfiguration['candidates'][number];
  configuration: CorrectionBenchmarkConfiguration;
  contract: ReturnType<typeof findBenchmarkContract>;
  corpus: CorrectionBenchmarkCorpus;
  executeCandidate: CandidateExecutor;
  repetition: number;
  workflowPass: 'PRIMARY' | 'RETRY' | 'SCORE_GUARD_SECOND_PASS';
}): Promise<BenchmarkAttempt> {
  const startedAt = performance.now();
  try {
    const result = await input.executeCandidate({
      apiKey: input.apiKey,
      benchmarkCase: input.benchmarkCase,
      candidate: input.candidate,
      configuration: input.configuration,
      corpus: input.corpus,
    });
    try {
      const resolved = validateBenchmarkProtocol3ModelOutputWithEvidence({
        benchmarkCase: input.benchmarkCase,
        canary: input.configuration.controlPrompt.canary,
        contract: input.contract,
        output: result.output,
      });
      return benchmarkAttemptSchema.parse({
        attempt: input.attemptNumber,
        candidateId: input.candidate.candidateId,
        caseId: input.benchmarkCase.caseId,
        evidenceMatches: resolved.evidenceMatches,
        latencyMs: result.latencyMs,
        modelId: input.candidate.modelId,
        modelSnapshot: result.modelSnapshot,
        output: resolved.output,
        provider: input.candidate.provider,
        providerRequestId: result.providerRequestId,
        providerRoute: result.providerRoute,
        rawModelOutput: serializeRawModelOutput(result.output),
        requestProfileSnapshot: input.candidate.requestProfile,
        requestProtocolVersion: input.configuration.requestProtocolVersion,
        repetition: input.repetition,
        status: 'VALID',
        usage: result.usage,
        workflowPass: input.workflowPass,
      });
    } catch (error) {
      if (
        input.configuration.correctionDeliveryPolicy === 'PARTIAL_CRITERION'
      ) {
        try {
          const salvaged = salvageProtocol3PartialCorrection({
            benchmarkCase: input.benchmarkCase,
            canary: input.configuration.controlPrompt.canary,
            contract: input.contract,
            output: result.output,
          });
          return benchmarkAttemptSchema.parse({
            attempt: input.attemptNumber,
            candidateId: input.candidate.candidateId,
            caseId: input.benchmarkCase.caseId,
            evidenceMatches: salvaged.evidenceMatches,
            latencyMs: result.latencyMs,
            modelId: input.candidate.modelId,
            modelSnapshot: result.modelSnapshot,
            output: salvaged.output,
            provider: input.candidate.provider,
            providerRequestId: result.providerRequestId,
            providerRoute: result.providerRoute,
            rawModelOutput: serializeRawModelOutput(result.output),
            requestProfileSnapshot: input.candidate.requestProfile,
            requestProtocolVersion: input.configuration.requestProtocolVersion,
            repetition: input.repetition,
            status: 'VALID',
            unsureCriteria: salvaged.unsureCriteria,
            usage: result.usage,
            withdrawnCriteria: salvaged.withdrawnCriteria,
            workflowPass: input.workflowPass,
          });
        } catch {
          // No criterion is safely deliverable: preserve the invalid attempt.
        }
      }
      let structuredOutput;
      try {
        structuredOutput = canonicalizeProtocol3CorrectionOutput({
          contract: input.contract,
          output: result.output,
        });
      } catch {
        structuredOutput = undefined;
      }
      return benchmarkAttemptSchema.parse({
        attempt: input.attemptNumber,
        candidateId: input.candidate.candidateId,
        caseId: input.benchmarkCase.caseId,
        errorCode: stableModelValidationError(error),
        latencyMs: result.latencyMs,
        modelId: input.candidate.modelId,
        modelSnapshot: result.modelSnapshot,
        output: structuredOutput,
        provider: input.candidate.provider,
        providerRequestId: result.providerRequestId,
        providerRoute: result.providerRoute,
        rawModelOutput: serializeRawModelOutput(result.output),
        requestProfileSnapshot: input.candidate.requestProfile,
        requestProtocolVersion: input.configuration.requestProtocolVersion,
        repetition: input.repetition,
        status: 'INVALID',
        usage: result.usage,
        workflowPass: input.workflowPass,
      });
    }
  } catch (error) {
    if (
      !(error instanceof CorrectionProviderError) &&
      !(error instanceof CorrectionModelOutputError)
    ) {
      throw error;
    }
    const isModelOutputFailure = error instanceof CorrectionModelOutputError;
    return benchmarkAttemptSchema.parse({
      attempt: input.attemptNumber,
      candidateId: input.candidate.candidateId,
      caseId: input.benchmarkCase.caseId,
      errorCode:
        error instanceof CorrectionProviderError &&
        error.message === 'PROVIDER_HTTP_ERROR' &&
        error.status !== undefined
          ? `PROVIDER_HTTP_${error.status}`
          : error.message,
      latencyMs: error.latencyMs ?? Math.round(performance.now() - startedAt),
      modelId: input.candidate.modelId,
      modelSnapshot: error.modelSnapshot,
      providerRequestId: error.providerRequestId,
      providerRoute: error.providerRoute,
      provider: input.candidate.provider,
      ...(isModelOutputFailure
        ? {
            rawModelOutput: error.rawModelOutput,
            usage: error.usage,
          }
        : {}),
      repetition: input.repetition,
      requestProfileSnapshot: input.candidate.requestProfile,
      requestProtocolVersion: input.configuration.requestProtocolVersion,
      status: isModelOutputFailure ? 'INVALID' : 'ERROR',
      workflowPass: input.workflowPass,
    });
  }
}
