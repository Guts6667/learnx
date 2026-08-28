import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  benchmarkRunMetadataSchema,
  assertBenchmarkCompatibility,
  modelMeetsPromotionThresholds,
  prepareBenchmarkResume,
  summarizeCorrectionBenchmark,
  type BenchmarkAttempt,
} from './ai-correction-benchmark';
import {
  applyAutonomousReviewedResult,
  applyReviewedResult,
  attemptsArtifactSchema,
  buildBenchmarkSupplierBudgetPreflight,
  loadBenchmarkInputs,
  readJson,
  resultDirectory,
  runBenchmark,
  type BenchmarkSupplierBudgetPreflight,
} from './ai-correction-benchmark-runner';
import {
  SupplierBudgetGuard,
  type SupplierBudgetUsage,
} from './ai-benchmark-supplier-budget';

export async function runAiCorrectionBenchmarkCli(
  arguments_: string[] = process.argv,
): Promise<void> {
  const loaded = await loadBenchmarkInputs(arguments_);
  const { configuration, corpus } = loaded;

  assertBenchmarkCompatibility({ configuration, corpus });

  const reviewArgument = arguments_.find((argument) =>
    argument.startsWith('--apply-review='),
  );
  const autonomousReviewArgument = arguments_.find((argument) =>
    argument.startsWith('--apply-autonomous-review='),
  );
  const blindReviewPacketArgument = arguments_.find((argument) =>
    argument.startsWith('--blind-review-packet='),
  );
  const attemptsArgument = arguments_.find((argument) =>
    argument.startsWith('--attempts='),
  );
  if (
    reviewArgument ||
    autonomousReviewArgument ||
    blindReviewPacketArgument ||
    attemptsArgument
  ) {
    if (reviewArgument && autonomousReviewArgument) {
      throw new Error('BENCHMARK_REVIEW_AUTHORITY_AMBIGUOUS');
    }
    if (autonomousReviewArgument) {
      if (
        !attemptsArgument ||
        !blindReviewPacketArgument ||
        loaded.corpusReviewAuthority !== 'AUTONOMOUS_AI_NOT_HUMAN' ||
        !loaded.corpusReview ||
        loaded.supplierCostCapUsd === undefined
      ) {
        throw new Error(
          'BENCHMARK_AUTONOMOUS_REVIEW_REQUIRES_COMPLETE_AUTHORITY_CHAIN',
        );
      }
      await applyAutonomousReviewedResult({
        attemptsPath: path.resolve(
          attemptsArgument.slice('--attempts='.length),
        ),
        blindReviewPacketPath: path.resolve(
          blindReviewPacketArgument.slice('--blind-review-packet='.length),
        ),
        configuration,
        configurationSha256: loaded.configurationSha256,
        corpus,
        corpusSha256: loaded.corpusSha256,
        ownerAuthorizationReference:
          loaded.corpusReview.ownerAuthorizationReference,
        ownerAuthorizationSha256: loaded.corpusReview.ownerAuthorizationSha256,
        reviewPath: path.resolve(
          autonomousReviewArgument.slice('--apply-autonomous-review='.length),
        ),
        supplierCostCapUsd: loaded.supplierCostCapUsd,
      });
      return;
    }
    if (!reviewArgument || !attemptsArgument || blindReviewPacketArgument) {
      throw new Error('BENCHMARK_REVIEW_REQUIRES_REVIEW_AND_ATTEMPTS_PATHS');
    }
    await applyReviewedResult({
      attemptsPath: path.resolve(attemptsArgument.slice('--attempts='.length)),
      configuration,
      corpus,
      reviewPath: path.resolve(reviewArgument.slice('--apply-review='.length)),
    });
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
  const candidateArgument = arguments_.find((argument) =>
    argument.startsWith('--candidate='),
  );
  const requestedCandidateId = candidateArgument?.slice('--candidate='.length);
  if (
    loaded.authorizedCandidateId &&
    requestedCandidateId &&
    requestedCandidateId !== loaded.authorizedCandidateId
  ) {
    throw new Error('BENCHMARK_AUTONOMOUS_CANDIDATE_IDENTITY_MISMATCH');
  }
  const delayArgument = arguments_.find((argument) =>
    argument.startsWith('--delay-ms='),
  );
  const requestDelayMs = delayArgument
    ? Number.parseInt(delayArgument.slice('--delay-ms='.length), 10)
    : 0;
  if (
    !Number.isInteger(requestDelayMs) ||
    requestDelayMs < 0 ||
    requestDelayMs > 30_000
  ) {
    throw new Error('BENCHMARK_DELAY_MS_INVALID');
  }
  const supplierCostCapArgument = arguments_.find((argument) =>
    argument.startsWith('--supplier-cost-cap-usd='),
  );
  const supplierCostCapUsd = supplierCostCapArgument
    ? Number.parseFloat(
        supplierCostCapArgument.slice('--supplier-cost-cap-usd='.length),
      )
    : undefined;
  if (
    supplierCostCapUsd !== undefined &&
    (!Number.isFinite(supplierCostCapUsd) || supplierCostCapUsd <= 0)
  ) {
    throw new Error('SUPPLIER_BUDGET_CAP_INVALID');
  }
  if (
    loaded.supplierCostCapUsd !== undefined &&
    supplierCostCapUsd !== undefined &&
    supplierCostCapUsd !== loaded.supplierCostCapUsd
  ) {
    throw new Error('BENCHMARK_AUTONOMOUS_SUPPLIER_CAP_IDENTITY_MISMATCH');
  }
  const effectiveSupplierCostCapUsd =
    loaded.supplierCostCapUsd === undefined
      ? supplierCostCapUsd
      : Math.min(
          loaded.supplierCostCapUsd,
          supplierCostCapUsd ?? loaded.supplierCostCapUsd,
        );
  const supplierBudget =
    effectiveSupplierCostCapUsd === undefined
      ? undefined
      : new SupplierBudgetGuard(effectiveSupplierCostCapUsd);
  const modelArgument = arguments_.find((argument) =>
    argument.startsWith('--model='),
  );
  const requestedModelId = modelArgument?.slice('--model='.length);
  const caseArgument = arguments_.find((argument) =>
    argument.startsWith('--case='),
  );
  const requestedCaseId = caseArgument?.slice('--case='.length);
  const reviewPanelMode = arguments_.includes('--review-panel');
  const resumeArgument = arguments_.find((argument) =>
    argument.startsWith('--resume='),
  );
  if (
    resumeArgument &&
    (requestedCandidateId ||
      requestedModelId ||
      requestedCaseId ||
      reviewPanelMode)
  ) {
    throw new Error('BENCHMARK_RESUME_FILTERS_FORBIDDEN');
  }
  if (requestedCandidateId && requestedModelId) {
    throw new Error('BENCHMARK_FILTER_AMBIGUOUS');
  }
  let resumeState: ReturnType<typeof prepareBenchmarkResume> | undefined;
  let resumePath: string | undefined;
  if (resumeArgument) {
    resumePath = path.resolve(resumeArgument.slice('--resume='.length));
    if (!resumePath.endsWith('.attempts.json')) {
      throw new Error('BENCHMARK_RESUME_PATH_INVALID');
    }
    const resumeArtifactSource = await readJson(resumePath);
    const resumeAttemptsArtifact =
      attemptsArtifactSchema.parse(resumeArtifactSource);
    resumeState = prepareBenchmarkResume({
      artifact: resumeArtifactSource,
      configuration,
      corpus,
      ...(loaded.corpusReviewAuthority === 'AUTONOMOUS_AI_NOT_HUMAN'
        ? {
            configurationSha256: loaded.configurationSha256,
            corpusSha256: loaded.corpusSha256,
          }
        : {}),
    });
    if (
      loaded.corpusReviewAuthority === 'AUTONOMOUS_AI_NOT_HUMAN' &&
      (resumeAttemptsArtifact.supplierCostCapUsd !==
        loaded.supplierCostCapUsd ||
        resumeAttemptsArtifact.supplierBudget?.hardCapUsd !==
          loaded.supplierCostCapUsd)
    ) {
      throw new Error('BENCHMARK_RESUME_AUTONOMOUS_SUPPLIER_CAP_MISMATCH');
    }
    if (
      loaded.corpusReviewAuthority === 'AUTONOMOUS_AI_NOT_HUMAN' &&
      JSON.stringify(resumeState.artifact.runMetadata.corpusReview) !==
        JSON.stringify(loaded.corpusReview)
    ) {
      throw new Error('BENCHMARK_RESUME_AUTONOMOUS_AUTHORITY_MISMATCH');
    }
  }
  const selectedCandidates = resumeState
    ? [resumeState.candidate]
    : requestedCandidateId || loaded.authorizedCandidateId
      ? configuration.candidates.filter(
          (candidate) =>
            candidate.candidateId ===
            (requestedCandidateId ?? loaded.authorizedCandidateId),
        )
      : requestedModelId
        ? configuration.candidates.filter(
            (candidate) => candidate.modelId === requestedModelId,
          )
        : configuration.candidates;
  if (selectedCandidates.length === 0) {
    throw new Error('BENCHMARK_MODEL_NOT_CONFIGURED');
  }
  if (reviewPanelMode && selectedCandidates.length !== 1) {
    throw new Error('BENCHMARK_REVIEW_PANEL_REQUIRES_ONE_MODEL');
  }
  if (
    loaded.corpusReviewAuthority === 'AUTONOMOUS_AI_NOT_HUMAN' &&
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
    ? configuration.reviewPanelCaseIds.map((caseId) => {
        const benchmarkCase = corpus.cases.find(
          (candidate) => candidate.caseId === caseId,
        );
        if (!benchmarkCase) {
          throw new Error('BENCHMARK_REVIEW_PANEL_CASE_MISSING');
        }
        return benchmarkCase;
      })
    : corpus.cases;
  const selectedCases = requestedCaseId
    ? panelCases.filter(
        (benchmarkCase) => benchmarkCase.caseId === requestedCaseId,
      )
    : panelCases;
  if (selectedCases.length === 0) {
    throw new Error('BENCHMARK_CASE_NOT_CONFIGURED');
  }
  const selectedCandidateIds = new Set(
    selectedCandidates.map((candidate) => candidate.candidateId),
  );
  const runId = new Date().toISOString().replaceAll(/[:.]/g, '-');
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
      caseIds: selectedCases.map((benchmarkCase) => benchmarkCase.caseId),
      candidateIds: selectedCandidates.map(
        (candidate) => candidate.candidateId,
      ),
      configurationSha256: loaded.configurationSha256,
      corpusSha256: loaded.corpusSha256,
      humanReview: {
        reviewedAt: null,
        reviewer: null,
        status: 'PENDING' as const,
      },
      mode: runMode,
      repetitions:
        reviewPanelMode || requestedCaseId ? 1 : configuration.repetitions,
      ...(loaded.corpusReviewAuthority === 'AUTONOMOUS_AI_NOT_HUMAN'
        ? {
            corpusReview: loaded.corpusReview,
            corpusReviewAuthority: 'AUTONOMOUS_AI_NOT_HUMAN' as const,
            reviewAuthority: 'NONE' as const,
          }
        : {}),
    });
  if (supplierBudget && resumeState) {
    resumeState.artifact.attempts
      .filter(
        (attempt) =>
          attempt.errorCode !== 'SCORE_GUARD_SECOND_PASS_SKIPPED_BUDGET' &&
          attempt.errorCode !==
            'SCORE_GUARD_SECOND_PASS_SKIPPED_COST_RECONCILIATION',
      )
      .forEach((attempt) => {
        supplierBudget.reconcile(
          attempt.usage as SupplierBudgetUsage | undefined,
        );
      });
  }
  await mkdir(resultDirectory, { recursive: true });
  const outputStem = resumePath
    ? resumePath.slice(0, -'.attempts.json'.length)
    : path.join(resultDirectory, runId);
  const attemptsPath = `${outputStem}.attempts.json`;
  const budgetPreflightPath = `${outputStem}.budget-preflight.final.json`;
  const writeBudgetPreflight = async (
    preflight: BenchmarkSupplierBudgetPreflight,
  ): Promise<void> => {
    if (
      loaded.corpusReviewAuthority === 'AUTONOMOUS_AI_NOT_HUMAN' &&
      preflight.primaryCallCount !==
        (resumeState ? resumeState.pendingCells.length : 72)
    ) {
      throw new Error('BENCHMARK_AUTONOMOUS_PRIMARY_CELL_COUNT_INVALID');
    }
    await writeFile(
      budgetPreflightPath,
      `${JSON.stringify(
        {
          ...preflight,
          ...(loaded.budgetPolicyPath
            ? { budgetPolicyPath: loaded.budgetPolicyPath }
            : {}),
          ...(loaded.budgetPolicySha256
            ? { budgetPolicySha256: loaded.budgetPolicySha256 }
            : {}),
          configurationSha256: loaded.configurationSha256,
          corpusSha256: loaded.corpusSha256,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
  };
  if (arguments_.includes('--preflight-only')) {
    if (!supplierBudget) {
      throw new Error('BENCHMARK_PREFLIGHT_REQUIRES_SUPPLIER_BUDGET_CAP');
    }
    const preflight = buildBenchmarkSupplierBudgetPreflight({
      actualSpentUsd: supplierBudget.actualSpentUsd,
      candidates: selectedCandidates,
      cases: selectedCases,
      configuration,
      corpus,
      maxRetries: requestedCaseId ? 0 : configuration.maxRetries,
      ...(resumeState ? { pendingCells: resumeState.pendingCells } : {}),
      repetitions:
        reviewPanelMode || requestedCaseId ? 1 : configuration.repetitions,
      supplierCostCapUsd: supplierBudget.hardCapUsd,
    });
    await writeBudgetPreflight(preflight);
    console.log(
      `Préflight fournisseur écrit sans appel : ${budgetPreflightPath}`,
    );
    return;
  }
  const writeAttempts = async (attempts: BenchmarkAttempt[]): Promise<void> => {
    await writeFile(
      attemptsPath,
      `${JSON.stringify(
        {
          benchmarkId: configuration.benchmarkId,
          configurationSha256: loaded.configurationSha256,
          corpusId: configuration.corpusId,
          corpusSha256: loaded.corpusSha256,
          language: configuration.language,
          mode: runMode,
          runMetadata,
          candidates: selectedCandidates.map((candidate) => ({
            candidateId: candidate.candidateId,
            modelId: candidate.modelId,
            provider: candidate.provider,
            requestProfile: candidate.requestProfile,
          })),
          modelIds: selectedCandidates.map((candidate) => candidate.modelId),
          promptVersion: configuration.promptVersion,
          requestProtocolVersion: configuration.requestProtocolVersion,
          supplierCostCapUsd: loaded.supplierCostCapUsd,
          supplierBudget: supplierBudget
            ? {
                actualSpentUsd: supplierBudget.actualSpentUsd,
                hardCapUsd: supplierBudget.hardCapUsd,
                reconciliationRequired: attempts.some(
                  (attempt) =>
                    attempt.errorCode !==
                      'SCORE_GUARD_SECOND_PASS_SKIPPED_BUDGET' &&
                    attempt.usage?.costSource !== 'ACTUAL',
                ),
              }
            : null,
          attempts,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
  };

  const attempts = await runBenchmark({
    candidates: selectedCandidates,
    cases: selectedCases,
    configuration,
    corpus,
    maxRetries: requestedCaseId ? 0 : undefined,
    onBudgetPreflight: writeBudgetPreflight,
    onProgress: writeAttempts,
    requestDelayMs,
    supplierBudget,
    repetitions:
      reviewPanelMode || requestedCaseId ? 1 : configuration.repetitions,
    initialAttempts: resumeState?.artifact.attempts,
    pendingCells: resumeState?.pendingCells,
  });
  const summary = summarizeCorrectionBenchmark({
    attempts,
    configuration,
    corpus,
    runMetadata,
  });
  const evaluatedSummary = {
    ...summary,
    supplierBudget: supplierBudget
      ? {
          actualSpentUsd: supplierBudget.actualSpentUsd,
          hardCapUsd: supplierBudget.hardCapUsd,
          reconciliationRequired: attempts.some(
            (attempt) =>
              attempt.errorCode !== 'SCORE_GUARD_SECOND_PASS_SKIPPED_BUDGET' &&
              attempt.usage?.costSource !== 'ACTUAL',
          ),
        }
      : null,
    models: summary.models
      .filter((metrics) => selectedCandidateIds.has(metrics.candidateId))
      .map((metrics) => ({
        ...metrics,
        promotionEligible:
          metrics.promotionEligible &&
          modelMeetsPromotionThresholds(metrics, configuration.thresholds),
      })),
  };
  await writeAttempts(attempts);
  if (reviewPanelMode) {
    const finalAttempts = attempts.filter(
      (attempt, index) =>
        !attempts.some(
          (candidate, candidateIndex) =>
            candidateIndex > index &&
            candidate.caseId === attempt.caseId &&
            candidate.repetition === attempt.repetition &&
            candidate.attempt > attempt.attempt,
        ),
    );
    await writeFile(
      `${outputStem}.blind-review.json`,
      `${JSON.stringify(
        {
          anonymousCandidate: 'candidate-a',
          benchmarkId: configuration.benchmarkId,
          corpusId: configuration.corpusId,
          language: configuration.language,
          promptVersion: configuration.promptVersion,
          requestProtocolVersion: configuration.requestProtocolVersion,
          cases: selectedCases.map((benchmarkCase, caseIndex) => ({
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
              if (!attempt) {
                return undefined;
              }
              return {
                attempt: attempt.attempt,
                errorCode: attempt.errorCode,
                evidenceMatches: attempt.evidenceMatches,
                output: attempt.output,
                repetition: attempt.repetition,
                status: attempt.status,
              };
            })(),
          })),
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
  }
  await writeFile(
    `${outputStem}.summary.json`,
    `${JSON.stringify(evaluatedSummary, null, 2)}\n`,
    'utf8',
  );
  console.log(
    `Benchmark terminé : ${attempts.length} appels/tentatives. Résultats locaux dans ${resultDirectory}.`,
  );
}
