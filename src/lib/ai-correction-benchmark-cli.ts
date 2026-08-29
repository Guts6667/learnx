import {
  assertBenchmarkCompatibility,
  modelMeetsPromotionThresholds,
  summarizeCorrectionBenchmark,
} from './ai-correction-benchmark.js';
import {
  buildBenchmarkSupplierBudgetPreflight,
  loadBenchmarkInputs,
  resultDirectory,
  runBenchmark,
} from './ai-correction-benchmark-runner.js';
import {
  createBenchmarkCliWriters,
  writeBenchmarkBlindReviewPacket,
  writeBenchmarkSummary,
} from './ai-correction-benchmark-cli-output.js';
import { applyBenchmarkReviewArguments } from './ai-correction-benchmark-cli-review.js';
import { selectBenchmarkCliRun } from './ai-correction-benchmark-cli-selection.js';
import {
  readCliOption,
  runRegressionPoolBuild,
  runRegressionPoolValidation,
} from './ai-correction-regression-cli.js';

export async function runAiCorrectionBenchmarkCli(
  arguments_: string[] = process.argv,
): Promise<void> {
  // The regression-pool subcommands are offline by construction and must not
  // require a benchmark configuration, so they answer before any input loading.
  if (arguments_.some((argument) => argument.startsWith('--build-pool'))) {
    await runRegressionPoolBuild(arguments_);
    return;
  }
  if (readCliOption(arguments_, 'pool') !== undefined) {
    await runRegressionPoolValidation(arguments_);
    return;
  }
  if (arguments_.some((argument) => argument.startsWith('--run-pool'))) {
    // Executing the suite needs the promoted identities, which live under
    // src/server; the runner script composes them and calls
    // `runRegressionPool` directly. Reaching here means the command was typed
    // without that composition, so it stops rather than running unpinned.
    throw new Error(
      'REGRESSION_RUN_REQUIRES_PINNED_IDENTITIES: lancez `pnpm ai:benchmark:run-pool`, qui épingle PROMOTED_CORRECTION_IDENTITY et PROMOTED_CHECKER_IDENTITY.',
    );
  }

  const loaded = await loadBenchmarkInputs(arguments_);
  const { configuration, corpus } = loaded;
  assertBenchmarkCompatibility({ configuration, corpus });

  if (
    await applyBenchmarkReviewArguments({
      arguments: arguments_,
      configuration,
      corpus,
      loaded,
    })
  ) {
    return;
  }
  if (arguments_.includes('--validate-only')) {
    console.log(
      `Benchmark validé hors ligne : ${corpus.cases.length} cas, ${configuration.candidates.length} modèles épinglés.`,
    );
    return;
  }
  if (
    loaded.corpusReviewAuthority === 'HUMAN' &&
    corpus.humanReview.status !== 'APPROVED'
  ) {
    throw new Error('BENCHMARK_CORPUS_REQUIRES_HUMAN_PEDAGOGICAL_APPROVAL');
  }

  const selection = await selectBenchmarkCliRun({
    arguments: arguments_,
    configuration,
    corpus,
    loaded,
  });
  const writers = await createBenchmarkCliWriters({
    configuration,
    loaded,
    selection,
  });

  if (arguments_.includes('--preflight-only')) {
    if (!selection.supplierBudget) {
      throw new Error('BENCHMARK_PREFLIGHT_REQUIRES_SUPPLIER_BUDGET_CAP');
    }
    const preflight = buildBenchmarkSupplierBudgetPreflight({
      actualSpentUsd: selection.supplierBudget.actualSpentUsd,
      candidates: selection.selectedCandidates,
      cases: selection.selectedCases,
      configuration,
      corpus,
      maxRetries: selection.requestedCaseId ? 0 : configuration.maxRetries,
      ...(selection.resumeState
        ? { pendingCells: selection.resumeState.pendingCells }
        : {}),
      repetitions:
        selection.reviewPanelMode || selection.requestedCaseId
          ? 1
          : configuration.repetitions,
      supplierCostCapUsd: selection.supplierBudget.hardCapUsd,
    });
    await writers.writeBudgetPreflight(preflight);
    console.log(
      `Préflight fournisseur écrit sans appel : ${writers.budgetPreflightPath}`,
    );
    return;
  }

  const attempts = await runBenchmark({
    candidates: selection.selectedCandidates,
    cases: selection.selectedCases,
    configuration,
    corpus,
    maxRetries: selection.requestedCaseId ? 0 : undefined,
    onBudgetPreflight: writers.writeBudgetPreflight,
    onProgress: writers.writeAttempts,
    requestDelayMs: selection.requestDelayMs,
    supplierBudget: selection.supplierBudget,
    repetitions:
      selection.reviewPanelMode || selection.requestedCaseId
        ? 1
        : configuration.repetitions,
    initialAttempts: selection.resumeState?.artifact.attempts,
    pendingCells: selection.resumeState?.pendingCells,
  });
  const summary = summarizeCorrectionBenchmark({
    attempts,
    configuration,
    corpus,
    runMetadata: selection.runMetadata,
  });
  const evaluatedSummary = {
    ...summary,
    models: summary.models
      .filter((metrics) =>
        selection.selectedCandidateIds.has(metrics.candidateId),
      )
      .map((metrics) => ({
        ...metrics,
        promotionEligible:
          metrics.promotionEligible &&
          modelMeetsPromotionThresholds(metrics, configuration.thresholds),
      })),
  };
  await writers.writeAttempts(attempts);
  await writeBenchmarkBlindReviewPacket({
    attempts,
    configuration,
    corpus,
    outputStem: writers.outputStem,
    selection,
  });
  await writeBenchmarkSummary({
    attempts,
    outputStem: writers.outputStem,
    selection,
    summary: evaluatedSummary,
  });
  console.log(
    `Benchmark terminé : ${attempts.length} appels/tentatives. Résultats locaux dans ${resultDirectory}.`,
  );
}
