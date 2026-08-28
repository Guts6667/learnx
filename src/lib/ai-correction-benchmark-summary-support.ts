import type {
  CorrectionOutput,
  Protocol3CorrectionArtifactOutput,
} from './ai-correction-contracts.js';
import type {
  BenchmarkAttempt,
  BenchmarkRunMetadata,
} from './ai-correction-benchmark-artifacts.js';
import type { CorrectionBenchmarkConfiguration } from './ai-correction-benchmark-configuration.js';
import type { CorrectionBenchmarkCorpus } from './ai-correction-benchmark-corpus.js';

export type BenchmarkCorrectionOutput =
  CorrectionOutput | Protocol3CorrectionArtifactOutput;
export type BenchmarkContract = CorrectionBenchmarkCorpus['contracts'][number];
export type BenchmarkCase = CorrectionBenchmarkCorpus['cases'][number];
export type BenchmarkCandidate =
  CorrectionBenchmarkConfiguration['candidates'][number];
export type ValidBenchmarkAttempt = BenchmarkAttempt & {
  output: BenchmarkCorrectionOutput;
};

export type LogicalRun = {
  attempts: BenchmarkAttempt[];
  deliveredAttempt?: BenchmarkAttempt;
  finalAttempt: BenchmarkAttempt;
};

export function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil(percentileValue * sorted.length) - 1;
  return sorted[Math.max(0, index)] ?? 0;
}

export function outputSignature(output: BenchmarkCorrectionOutput): string {
  return [...output.criteria]
    .sort((left, right) => left.criterionKey.localeCompare(right.criterionKey))
    .map((criterion) => `${criterion.criterionKey}:${criterion.levelKey}`)
    .join('|');
}

function criterionLevelScore(input: {
  contract: BenchmarkContract;
  criterionKey: string;
  levelKey: string;
}): number {
  const criterion = input.contract.criteria.find(
    (item) => item.key === input.criterionKey,
  );
  const level = criterion?.performanceLevels.find(
    (item) => item.key === input.levelKey,
  );
  if (!criterion || !level) throw new Error('BENCHMARK_DECISION_LEVEL_UNKNOWN');
  return level.score;
}

export function weightedDecisionScore(input: {
  contract: BenchmarkContract;
  levels: Array<{ criterionKey: string; levelKey: string }>;
}): number {
  const levelsByKey = new Map(
    input.levels.map((item) => [item.criterionKey, item.levelKey]),
  );
  const totalWeight = input.contract.criteria.reduce(
    (total, criterion) => total + criterion.weight,
    0,
  );
  if (totalWeight <= 0) throw new Error('BENCHMARK_DECISION_WEIGHT_INVALID');
  return (
    input.contract.criteria.reduce((total, criterion) => {
      const levelKey = levelsByKey.get(criterion.key);
      if (!levelKey) throw new Error('BENCHMARK_DECISION_CRITERION_MISSING');
      return (
        total +
        criterion.weight *
          criterionLevelScore({
            contract: input.contract,
            criterionKey: criterion.key,
            levelKey,
          })
      );
    }, 0) / totalWeight
  );
}

export function ordinalLevelDistance(input: {
  contract: BenchmarkContract;
  criterionKey: string;
  expectedLevelKey: string;
  actualLevelKey: string;
}): number {
  const criterion = input.contract.criteria.find(
    (item) => item.key === input.criterionKey,
  );
  if (!criterion) throw new Error('BENCHMARK_ORDINAL_CRITERION_UNKNOWN');
  const ordered = [...criterion.performanceLevels].sort(
    (left, right) => left.score - right.score,
  );
  const expectedIndex = ordered.findIndex(
    (level) => level.key === input.expectedLevelKey,
  );
  const actualIndex = ordered.findIndex(
    (level) => level.key === input.actualLevelKey,
  );
  if (expectedIndex < 0 || actualIndex < 0)
    throw new Error('BENCHMARK_ORDINAL_LEVEL_UNKNOWN');
  return Math.abs(expectedIndex - actualIndex);
}

export function sameStringSet(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    new Set(right).size === right.length &&
    left.every((value) => right.includes(value))
  );
}

export function groupLogicalRuns(
  attempts: BenchmarkAttempt[],
): Map<string, LogicalRun> {
  const grouped = new Map<string, BenchmarkAttempt[]>();
  for (const attempt of attempts) {
    const key = `${attempt.candidateId}|${attempt.caseId}|${attempt.repetition}`;
    grouped.set(key, [...(grouped.get(key) ?? []), attempt]);
  }
  const runs = new Map<string, LogicalRun>();
  for (const [key, runAttempts] of grouped) {
    const sorted = [...runAttempts].sort(
      (left, right) => left.attempt - right.attempt,
    );
    const attemptNumbers = sorted.map((attempt) => attempt.attempt);
    if (
      new Set(attemptNumbers).size !== attemptNumbers.length ||
      attemptNumbers.some((attemptNumber, index) => attemptNumber !== index + 1)
    ) {
      throw new Error('BENCHMARK_LOGICAL_RUN_ATTEMPTS_INVALID');
    }
    const finalAttempt = sorted.at(-1);
    if (!finalAttempt) throw new Error('BENCHMARK_LOGICAL_RUN_EMPTY');
    const deliveredAttempt = [...sorted]
      .reverse()
      .find(
        (attempt) => attempt.status === 'VALID' && attempt.output !== undefined,
      );
    runs.set(key, { attempts: sorted, deliveredAttempt, finalAttempt });
  }
  return runs;
}

export function modelDatasetIsComplete(input: {
  candidateId: string;
  configuration: CorrectionBenchmarkConfiguration;
  corpus: CorrectionBenchmarkCorpus;
  modelRuns: LogicalRun[];
  runMetadata: BenchmarkRunMetadata;
}): boolean {
  if (
    input.runMetadata.mode !== 'FULL' ||
    input.runMetadata.candidateIds.length !== 1 ||
    input.runMetadata.candidateIds[0] !== input.candidateId ||
    input.runMetadata.repetitions !== input.configuration.repetitions ||
    !sameStringSet(
      input.runMetadata.caseIds,
      input.corpus.cases.map((benchmarkCase) => benchmarkCase.caseId),
    )
  ) {
    return false;
  }
  const expectedKeys = new Set<string>();
  for (const benchmarkCase of input.corpus.cases) {
    for (
      let repetition = 1;
      repetition <= input.configuration.repetitions;
      repetition += 1
    ) {
      expectedKeys.add(
        `${input.candidateId}|${benchmarkCase.caseId}|${repetition}`,
      );
    }
  }
  const actualKeys = new Set(
    input.modelRuns.map((run) => {
      const sample = run.attempts[0];
      return sample
        ? `${sample.candidateId}|${sample.caseId}|${sample.repetition}`
        : '';
    }),
  );
  return (
    expectedKeys.size === actualKeys.size &&
    [...expectedKeys].every((key) => actualKeys.has(key))
  );
}
