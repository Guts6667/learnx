import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  BenchmarkAttempt,
  BenchmarkSummary,
  CorrectionBenchmarkConfiguration,
  CorrectionBenchmarkCorpus,
} from './ai-correction-benchmark.js';
import {
  resultDirectory,
  type BenchmarkSupplierBudgetPreflight,
  type LoadedBenchmarkInputs,
} from './ai-correction-benchmark-runner.js';
import type { BenchmarkCliSelection } from './ai-correction-benchmark-cli-selection.js';

type BenchmarkSupplierBudgetSnapshot = {
  actualSpentUsd: number;
  hardCapUsd: number;
  reconciliationRequired: boolean;
} | null;

export type BenchmarkCliWriters = {
  attemptsPath: string;
  budgetPreflightPath: string;
  outputStem: string;
  writeAttempts: (attempts: BenchmarkAttempt[]) => Promise<void>;
  writeBudgetPreflight: (
    preflight: BenchmarkSupplierBudgetPreflight,
  ) => Promise<void>;
};

function supplierBudgetSnapshot(input: {
  attempts: BenchmarkAttempt[];
  selection: BenchmarkCliSelection;
}): BenchmarkSupplierBudgetSnapshot {
  const budget = input.selection.supplierBudget;
  return budget
    ? {
        actualSpentUsd: budget.actualSpentUsd,
        hardCapUsd: budget.hardCapUsd,
        reconciliationRequired: input.attempts.some(
          (attempt) =>
            attempt.errorCode !== 'SCORE_GUARD_SECOND_PASS_SKIPPED_BUDGET' &&
            attempt.usage?.costSource !== 'ACTUAL',
        ),
      }
    : null;
}

export async function createBenchmarkCliWriters(input: {
  configuration: CorrectionBenchmarkConfiguration;
  loaded: LoadedBenchmarkInputs;
  selection: BenchmarkCliSelection;
}): Promise<BenchmarkCliWriters> {
  await mkdir(resultDirectory, { recursive: true });
  const runId = new Date().toISOString().replaceAll(/[:.]/g, '-');
  const outputStem = input.selection.resumePath
    ? input.selection.resumePath.slice(0, -'.attempts.json'.length)
    : path.join(resultDirectory, runId);
  const attemptsPath = `${outputStem}.attempts.json`;
  const budgetPreflightPath = `${outputStem}.budget-preflight.final.json`;
  return {
    attemptsPath,
    budgetPreflightPath,
    outputStem,
    writeAttempts: async (attempts) => {
      await writeFile(
        attemptsPath,
        `${JSON.stringify(
          {
            benchmarkId: input.configuration.benchmarkId,
            configurationSha256: input.loaded.configurationSha256,
            corpusId: input.configuration.corpusId,
            corpusSha256: input.loaded.corpusSha256,
            language: input.configuration.language,
            mode: input.selection.runMode,
            runMetadata: input.selection.runMetadata,
            candidates: input.selection.selectedCandidates.map((candidate) => ({
              candidateId: candidate.candidateId,
              modelId: candidate.modelId,
              provider: candidate.provider,
              requestProfile: candidate.requestProfile,
            })),
            modelIds: input.selection.selectedCandidates.map(
              (candidate) => candidate.modelId,
            ),
            promptVersion: input.configuration.promptVersion,
            requestProtocolVersion: input.configuration.requestProtocolVersion,
            supplierCostCapUsd: input.loaded.supplierCostCapUsd,
            supplierBudget: supplierBudgetSnapshot({
              attempts,
              selection: input.selection,
            }),
            attempts,
          },
          null,
          2,
        )}\n`,
        'utf8',
      );
    },
    writeBudgetPreflight: async (preflight) => {
      if (
        input.loaded.corpusReviewAuthority === 'AUTONOMOUS_AI_NOT_HUMAN' &&
        preflight.primaryCallCount !==
          (input.selection.resumeState
            ? input.selection.resumeState.pendingCells.length
            : 72)
      ) {
        throw new Error('BENCHMARK_AUTONOMOUS_PRIMARY_CELL_COUNT_INVALID');
      }
      await writeFile(
        budgetPreflightPath,
        `${JSON.stringify(
          {
            ...preflight,
            ...(input.loaded.budgetPolicyPath
              ? { budgetPolicyPath: input.loaded.budgetPolicyPath }
              : {}),
            ...(input.loaded.budgetPolicySha256
              ? { budgetPolicySha256: input.loaded.budgetPolicySha256 }
              : {}),
            configurationSha256: input.loaded.configurationSha256,
            corpusSha256: input.loaded.corpusSha256,
          },
          null,
          2,
        )}\n`,
        'utf8',
      );
    },
  };
}

export async function writeBenchmarkBlindReviewPacket(input: {
  attempts: BenchmarkAttempt[];
  configuration: CorrectionBenchmarkConfiguration;
  corpus: CorrectionBenchmarkCorpus;
  outputStem: string;
  selection: BenchmarkCliSelection;
}): Promise<void> {
  if (!input.selection.reviewPanelMode) {
    return;
  }
  const finalAttempts = input.attempts.filter(
    (attempt, index) =>
      !input.attempts.some(
        (candidate, candidateIndex) =>
          candidateIndex > index &&
          candidate.caseId === attempt.caseId &&
          candidate.repetition === attempt.repetition &&
          candidate.attempt > attempt.attempt,
      ),
  );
  await writeFile(
    `${input.outputStem}.blind-review.json`,
    `${JSON.stringify(
      {
        anonymousCandidate: 'candidate-a',
        benchmarkId: input.configuration.benchmarkId,
        corpusId: input.configuration.corpusId,
        language: input.configuration.language,
        promptVersion: input.configuration.promptVersion,
        requestProtocolVersion: input.configuration.requestProtocolVersion,
        cases: input.selection.selectedCases.map(
          (benchmarkCase, caseIndex) => ({
            benchmarkCase: {
              caseId: `case-${caseIndex + 1}`,
              contractKey: benchmarkCase.contractKey,
              contractVersion: benchmarkCase.contractVersion,
              responseText: benchmarkCase.responseText,
              taskContext: benchmarkCase.taskContext,
              taskPrompt: benchmarkCase.taskPrompt,
            },
            result: (() => {
              const attempt = finalAttempts.find(
                (candidate) => candidate.caseId === benchmarkCase.caseId,
              );
              return attempt
                ? {
                    attempt: attempt.attempt,
                    errorCode: attempt.errorCode,
                    evidenceMatches: attempt.evidenceMatches,
                    output: attempt.output,
                    repetition: attempt.repetition,
                    status: attempt.status,
                  }
                : undefined;
            })(),
          }),
        ),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

export async function writeBenchmarkSummary(input: {
  attempts: BenchmarkAttempt[];
  outputStem: string;
  selection: BenchmarkCliSelection;
  summary: BenchmarkSummary;
}): Promise<void> {
  await writeFile(
    `${input.outputStem}.summary.json`,
    `${JSON.stringify(
      {
        ...input.summary,
        supplierBudget: supplierBudgetSnapshot({
          attempts: input.attempts,
          selection: input.selection,
        }),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}
