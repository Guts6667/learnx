import {
  type CorrectionContract,
  type CorrectionOutput,
  type Protocol3CorrectionArtifactOutput,
  canonicalizeProtocol3CorrectionOutput,
  protocol3CorrectionArtifactOutputSchema,
  validateCorrectionOutputForContract,
} from './ai-correction-contracts.js';
import type { CorrectionBenchmarkCorpus } from './ai-correction-benchmark-corpus.js';
import type { EvidenceMatch } from './ai-correction-benchmark-artifacts.js';
import {
  injectionOutputIsSafe,
  resolveBenchmarkModelEvidence,
  type CorrectionEvidenceContext,
} from './ai-correction-benchmark-evidence.js';

export function findBenchmarkContract(
  corpus: CorrectionBenchmarkCorpus,
  contractKey: string,
  contractVersion: string,
): CorrectionContract {
  const contract = corpus.contracts.find(
    (candidate) =>
      candidate.contractKey === contractKey &&
      candidate.version === contractVersion,
  );
  if (!contract) {
    throw new Error('Benchmark case references an unknown contract.');
  }
  return contract;
}

export function validateBenchmarkModelOutput(input: {
  benchmarkCase: CorrectionBenchmarkCorpus['cases'][number];
  canary?: string;
  contract: CorrectionContract;
  output: unknown;
}): CorrectionOutput {
  return validateBenchmarkModelOutputWithEvidence(input).output;
}

export function validateBenchmarkModelOutputWithEvidence(input: {
  benchmarkCase: CorrectionBenchmarkCorpus['cases'][number];
  canary?: string;
  contract: CorrectionContract;
  output: unknown;
}): { evidenceMatches: EvidenceMatch[]; output: CorrectionOutput } {
  const output = validateCorrectionOutputForContract({
    contract: input.contract,
    output: input.output,
  });
  const resolved = resolveBenchmarkModelEvidence({
    output,
    responseText: input.benchmarkCase.responseText,
  });
  if (
    input.benchmarkCase.category === 'PROMPT_INJECTION' &&
    (!input.canary ||
      !injectionOutputIsSafe({
        benchmarkCase: input.benchmarkCase,
        canary: input.canary,
        output: resolved.output,
      }))
  ) {
    throw new Error('MODEL_PROMPT_INJECTION_SAFETY_FAILURE');
  }
  return resolved as {
    evidenceMatches: EvidenceMatch[];
    output: CorrectionOutput;
  };
}

export function validateBenchmarkProtocol3ModelOutputWithEvidence(input: {
  benchmarkCase: CorrectionEvidenceContext;
  canary?: string;
  contract: CorrectionContract;
  output: unknown;
}): {
  evidenceMatches: EvidenceMatch[];
  output: Protocol3CorrectionArtifactOutput;
} {
  const output = canonicalizeProtocol3CorrectionOutput({
    contract: input.contract,
    output: input.output,
  });
  const resolved = resolveBenchmarkModelEvidence({
    output,
    responseText: input.benchmarkCase.responseText,
  });
  if (
    input.benchmarkCase.category === 'PROMPT_INJECTION' &&
    (!input.canary ||
      !injectionOutputIsSafe({
        benchmarkCase: input.benchmarkCase,
        canary: input.canary,
        output: resolved.output,
      }))
  ) {
    throw new Error('MODEL_PROMPT_INJECTION_SAFETY_FAILURE');
  }
  return {
    evidenceMatches: resolved.evidenceMatches,
    output: protocol3CorrectionArtifactOutputSchema.parse(resolved.output),
  };
}
