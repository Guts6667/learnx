import path from 'node:path';

import {
  benchmarkRunMetadataSchema,
  prepareBenchmarkResume,
  type BenchmarkAttempt,
  type BenchmarkRunMetadata,
  type CorrectionBenchmarkConfiguration,
  type CorrectionBenchmarkCorpus,
} from './ai-correction-benchmark.js';
import {
  attemptsArtifactSchema,
  readJson,
  type LoadedBenchmarkInputs,
} from './ai-correction-benchmark-runner.js';
import {
  SupplierBudgetGuard,
  type SupplierBudgetUsage,
} from './ai-benchmark-supplier-budget.js';

export type BenchmarkCliSelection = {
  requestDelayMs: number;
  requestedCaseId?: string;
  resumePath?: string;
  resumeState?: ReturnType<typeof prepareBenchmarkResume>;
  reviewPanelMode: boolean;
  runMetadata: BenchmarkRunMetadata;
  runMode: 'FULL' | 'REVIEW_PANEL' | 'SMOKE';
  selectedCandidateIds: Set<string>;
  selectedCandidates: CorrectionBenchmarkConfiguration['candidates'];
  selectedCases: CorrectionBenchmarkCorpus['cases'];
  supplierBudget?: SupplierBudgetGuard;
};

function parseRequestDelay(arguments_: string[]): number {
  const argument = arguments_.find((item) => item.startsWith('--delay-ms='));
  const delay = argument
    ? Number.parseInt(argument.slice('--delay-ms='.length), 10)
    : 0;
  if (!Number.isInteger(delay) || delay < 0 || delay > 30_000) {
    throw new Error('BENCHMARK_DELAY_MS_INVALID');
  }
  return delay;
}

function parseSupplierCostCap(arguments_: string[]): number | undefined {
  const argument = arguments_.find((item) =>
    item.startsWith('--supplier-cost-cap-usd='),
  );
  const cap = argument
    ? Number.parseFloat(argument.slice('--supplier-cost-cap-usd='.length))
    : undefined;
  if (cap !== undefined && (!Number.isFinite(cap) || cap <= 0)) {
    throw new Error('SUPPLIER_BUDGET_CAP_INVALID');
  }
  return cap;
}

async function loadResumeState(input: {
  arguments: string[];
  configuration: CorrectionBenchmarkConfiguration;
  corpus: CorrectionBenchmarkCorpus;
  loaded: LoadedBenchmarkInputs;
  requestedCandidateId?: string;
  requestedCaseId?: string;
  requestedModelId?: string;
  reviewPanelMode: boolean;
}): Promise<{
  resumePath?: string;
  resumeState?: ReturnType<typeof prepareBenchmarkResume>;
}> {
  const resumeArgument = input.arguments.find((argument) =>
    argument.startsWith('--resume='),
  );
  if (!resumeArgument) {
    return {};
  }
  if (
    input.requestedCandidateId ||
    input.requestedModelId ||
    input.requestedCaseId ||
    input.reviewPanelMode
  ) {
    throw new Error('BENCHMARK_RESUME_FILTERS_FORBIDDEN');
  }
  const resumePath = path.resolve(resumeArgument.slice('--resume='.length));
  if (!resumePath.endsWith('.attempts.json')) {
    throw new Error('BENCHMARK_RESUME_PATH_INVALID');
  }
  const source = await readJson(resumePath);
  const artifact = attemptsArtifactSchema.parse(source);
  const resumeState = prepareBenchmarkResume({
    artifact: source,
    configuration: input.configuration,
    corpus: input.corpus,
    ...(input.loaded.corpusReviewAuthority === 'AUTONOMOUS_AI_NOT_HUMAN'
      ? {
          configurationSha256: input.loaded.configurationSha256,
          corpusSha256: input.loaded.corpusSha256,
        }
      : {}),
  });
  if (
    input.loaded.corpusReviewAuthority === 'AUTONOMOUS_AI_NOT_HUMAN' &&
    (artifact.supplierCostCapUsd !== input.loaded.supplierCostCapUsd ||
      artifact.supplierBudget?.hardCapUsd !== input.loaded.supplierCostCapUsd)
  ) {
    throw new Error('BENCHMARK_RESUME_AUTONOMOUS_SUPPLIER_CAP_MISMATCH');
  }
  if (
    input.loaded.corpusReviewAuthority === 'AUTONOMOUS_AI_NOT_HUMAN' &&
    JSON.stringify(resumeState.artifact.runMetadata.corpusReview) !==
      JSON.stringify(input.loaded.corpusReview)
  ) {
    throw new Error('BENCHMARK_RESUME_AUTONOMOUS_AUTHORITY_MISMATCH');
  }
  return { resumePath, resumeState };
}

function reconcileResumeBudget(input: {
  attempts: BenchmarkAttempt[] | undefined;
  supplierBudget?: SupplierBudgetGuard;
}): void {
  if (!input.supplierBudget || !input.attempts) {
    return;
  }
  input.attempts
    .filter(
      (attempt) =>
        attempt.errorCode !== 'SCORE_GUARD_SECOND_PASS_SKIPPED_BUDGET' &&
        attempt.errorCode !==
          'SCORE_GUARD_SECOND_PASS_SKIPPED_COST_RECONCILIATION',
    )
    .forEach((attempt) => {
      input.supplierBudget?.reconcile(
        attempt.usage as SupplierBudgetUsage | undefined,
      );
    });
}

export async function selectBenchmarkCliRun(input: {
  arguments: string[];
  configuration: CorrectionBenchmarkConfiguration;
  corpus: CorrectionBenchmarkCorpus;
  loaded: LoadedBenchmarkInputs;
}): Promise<BenchmarkCliSelection> {
  const candidateArgument = input.arguments.find((argument) =>
    argument.startsWith('--candidate='),
  );
  const requestedCandidateId = candidateArgument?.slice('--candidate='.length);
  if (
    input.loaded.authorizedCandidateId &&
    requestedCandidateId &&
    requestedCandidateId !== input.loaded.authorizedCandidateId
  ) {
    throw new Error('BENCHMARK_AUTONOMOUS_CANDIDATE_IDENTITY_MISMATCH');
  }
  const supplierCostCapUsd = parseSupplierCostCap(input.arguments);
  if (
    input.loaded.supplierCostCapUsd !== undefined &&
    supplierCostCapUsd !== undefined &&
    supplierCostCapUsd !== input.loaded.supplierCostCapUsd
  ) {
    throw new Error('BENCHMARK_AUTONOMOUS_SUPPLIER_CAP_IDENTITY_MISMATCH');
  }
  const effectiveCap =
    input.loaded.supplierCostCapUsd === undefined
      ? supplierCostCapUsd
      : Math.min(
          input.loaded.supplierCostCapUsd,
          supplierCostCapUsd ?? input.loaded.supplierCostCapUsd,
        );
  const supplierBudget =
    effectiveCap === undefined
      ? undefined
      : new SupplierBudgetGuard(effectiveCap);
  const modelArgument = input.arguments.find((argument) =>
    argument.startsWith('--model='),
  );
  const requestedModelId = modelArgument?.slice('--model='.length);
  const caseArgument = input.arguments.find((argument) =>
    argument.startsWith('--case='),
  );
  const requestedCaseId = caseArgument?.slice('--case='.length);
  const reviewPanelMode = input.arguments.includes('--review-panel');
  if (requestedCandidateId && requestedModelId) {
    throw new Error('BENCHMARK_FILTER_AMBIGUOUS');
  }
  const { resumePath, resumeState } = await loadResumeState({
    arguments: input.arguments,
    configuration: input.configuration,
    corpus: input.corpus,
    loaded: input.loaded,
    requestedCandidateId,
    requestedCaseId,
    requestedModelId,
    reviewPanelMode,
  });
  const selectedCandidates = resumeState
    ? [resumeState.candidate]
    : requestedCandidateId || input.loaded.authorizedCandidateId
      ? input.configuration.candidates.filter(
          (candidate) =>
            candidate.candidateId ===
            (requestedCandidateId ?? input.loaded.authorizedCandidateId),
        )
      : requestedModelId
        ? input.configuration.candidates.filter(
            (candidate) => candidate.modelId === requestedModelId,
          )
        : input.configuration.candidates;
  if (selectedCandidates.length === 0) {
    throw new Error('BENCHMARK_MODEL_NOT_CONFIGURED');
  }
  if (reviewPanelMode && selectedCandidates.length !== 1) {
    throw new Error('BENCHMARK_REVIEW_PANEL_REQUIRES_ONE_MODEL');
  }
  if (
    input.loaded.corpusReviewAuthority === 'AUTONOMOUS_AI_NOT_HUMAN' &&
    (selectedCandidates.length !== 1 ||
      requestedCaseId !== undefined ||
      reviewPanelMode ||
      selectedCandidates[0]?.requestProfile.adapter !== 'OPENROUTER_CHAT')
  ) {
    throw new Error(
      'BENCHMARK_AUTONOMOUS_RUN_REQUIRES_FULL_SINGLE_ACTUAL_COST_CANDIDATE',
    );
  }
  const panelCases = reviewPanelMode
    ? input.configuration.reviewPanelCaseIds.map((caseId) => {
        const benchmarkCase = input.corpus.cases.find(
          (candidate) => candidate.caseId === caseId,
        );
        if (!benchmarkCase) {
          throw new Error('BENCHMARK_REVIEW_PANEL_CASE_MISSING');
        }
        return benchmarkCase;
      })
    : input.corpus.cases;
  const selectedCases = requestedCaseId
    ? panelCases.filter((item) => item.caseId === requestedCaseId)
    : panelCases;
  if (selectedCases.length === 0) {
    throw new Error('BENCHMARK_CASE_NOT_CONFIGURED');
  }
  const runMode = resumeState
    ? 'FULL'
    : requestedCaseId
      ? 'SMOKE'
      : reviewPanelMode
        ? 'REVIEW_PANEL'
        : 'FULL';
  const runMetadata =
    resumeState?.artifact.runMetadata ??
    benchmarkRunMetadataSchema.parse({
      caseIds: selectedCases.map((item) => item.caseId),
      candidateIds: selectedCandidates.map((item) => item.candidateId),
      configurationSha256: input.loaded.configurationSha256,
      corpusSha256: input.loaded.corpusSha256,
      humanReview: { reviewedAt: null, reviewer: null, status: 'PENDING' },
      mode: runMode,
      repetitions:
        reviewPanelMode || requestedCaseId
          ? 1
          : input.configuration.repetitions,
      ...(input.loaded.corpusReviewAuthority === 'AUTONOMOUS_AI_NOT_HUMAN'
        ? {
            corpusReview: input.loaded.corpusReview,
            corpusReviewAuthority: 'AUTONOMOUS_AI_NOT_HUMAN',
            reviewAuthority: 'NONE',
          }
        : {}),
    });
  reconcileResumeBudget({
    attempts: resumeState?.artifact.attempts,
    supplierBudget,
  });
  return {
    requestDelayMs: parseRequestDelay(input.arguments),
    requestedCaseId,
    resumePath,
    resumeState,
    reviewPanelMode,
    runMetadata,
    runMode,
    selectedCandidateIds: new Set(
      selectedCandidates.map((candidate) => candidate.candidateId),
    ),
    selectedCandidates,
    selectedCases,
    supplierBudget,
  };
}
