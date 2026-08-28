import type { BenchmarkAttempt } from './ai-correction-benchmark-artifacts.js';
import type { CorrectionBenchmarkConfiguration } from './ai-correction-benchmark-configuration.js';
import { correctionBenchmarkConfigurationSchema } from './ai-correction-benchmark-configuration.js';
import type { CorrectionBenchmarkCorpus } from './ai-correction-benchmark-corpus.js';
import { correctionBenchmarkCorpusSchema } from './ai-correction-benchmark-corpus.js';
import { stableSerialize } from './ai-correction-benchmark-serialization.js';

export function parseCorrectionBenchmarkCorpus(
  input: unknown,
): CorrectionBenchmarkCorpus {
  return correctionBenchmarkCorpusSchema.parse(input);
}

export function parseCorrectionBenchmarkConfiguration(
  input: unknown,
): CorrectionBenchmarkConfiguration {
  return correctionBenchmarkConfigurationSchema.parse(input);
}

export function assertBenchmarkCompatibility(input: {
  configuration: CorrectionBenchmarkConfiguration;
  corpus: CorrectionBenchmarkCorpus;
}): void {
  if (input.configuration.corpusId !== input.corpus.corpusId) {
    throw new Error('BENCHMARK_CORPUS_ID_MISMATCH');
  }
  if (input.configuration.language !== input.corpus.language) {
    throw new Error('BENCHMARK_LANGUAGE_MISMATCH');
  }
  if (
    input.configuration.activityTypeScope &&
    input.corpus.contracts.some(
      (contract) =>
        !input.configuration.activityTypeScope?.includes(
          contract.target.activityType,
        ),
    )
  ) {
    throw new Error('BENCHMARK_ACTIVITY_TYPE_OUT_OF_SCOPE');
  }
  const corpusCaseIds = new Set(
    input.corpus.cases.map((benchmarkCase) => benchmarkCase.caseId),
  );
  if (
    input.configuration.reviewPanelCaseIds.some(
      (caseId) => !corpusCaseIds.has(caseId),
    )
  ) {
    throw new Error('BENCHMARK_REVIEW_PANEL_CASE_MISSING');
  }
}

export function calculateCost(
  attempt: BenchmarkAttempt,
  candidate: CorrectionBenchmarkConfiguration['candidates'][number],
): number {
  if (!attempt.usage) {
    return 0;
  }
  if (attempt.usage.actualCostUsd !== undefined) {
    return attempt.usage.actualCostUsd;
  }
  return (
    attempt.usage.inputTokens * candidate.promptUsdPerToken +
    (attempt.usage.visibleOutputTokens + attempt.usage.reasoningTokens) *
      candidate.completionUsdPerToken
  );
}

export function serializeCorrectionBenchmarkConfiguration(
  configuration: unknown,
): string {
  return stableSerialize(parseCorrectionBenchmarkConfiguration(configuration));
}
