import {
  benchmarkAttemptSchema,
  findBenchmarkContract,
  reconcileProtocol3ScoreGuardPasses,
  type BenchmarkAttempt,
  type CorrectionBenchmarkConfiguration,
  type CorrectionBenchmarkCorpus,
} from './ai-correction-benchmark.js';
import { protocol3CorrectionArtifactOutputSchema } from './ai-correction-contracts.js';
import {
  SupplierBudgetError,
  SupplierBudgetGuard,
  type SupplierBudgetUsage,
} from './ai-benchmark-supplier-budget.js';
import {
  buildBenchmarkSupplierBudgetPreflight,
  callCandidate,
  candidateApiKey,
  completeOutputScore,
  conservativeCallCostUsd,
  type BenchmarkSupplierBudgetPreflight,
  type CandidateExecutor,
} from './ai-correction-benchmark-runner-preflight.js';
import { executeBenchmarkWorkflowPass } from './ai-correction-benchmark-runner-pass.js';

export async function runBenchmark(input: {
  /**
   * The bound the caller already computed and had authorised, under whichever
   * bounding convention it declared.
   *
   * When supplied, this guard checks *that* figure against the cap instead of
   * deriving a second one of its own. Two preflights that each compute a bound
   * can disagree — and did, on 30 August 2026: the outer preflight authorised a
   * plan under the measured convention at 13.98 USD while this one refused it
   * under the conservative convention at 23, so a run that had been authorised
   * could not start. One convention, one verdict; this stays the spend-time
   * guard, not a second opinion on the bound.
   */
  authorisedBoundUsd?: number;
  candidates?: CorrectionBenchmarkConfiguration['candidates'];
  cases?: CorrectionBenchmarkCorpus['cases'];
  configuration: CorrectionBenchmarkConfiguration;
  corpus: CorrectionBenchmarkCorpus;
  executeCandidate?: CandidateExecutor;
  onBudgetPreflight?: (
    preflight: BenchmarkSupplierBudgetPreflight,
  ) => Promise<void>;
  onProgress?: (attempts: BenchmarkAttempt[]) => Promise<void>;
  maxRetries?: number;
  requestDelayMs?: number;
  repetitions?: number;
  providerApiKey?: string;
  supplierBudget?: SupplierBudgetGuard;
  initialAttempts?: BenchmarkAttempt[];
  pendingCells?: {
    attemptStart: number;
    candidateId: string;
    caseId: string;
    repetition: number;
  }[];
}): Promise<BenchmarkAttempt[]> {
  const attempts: BenchmarkAttempt[] = [...(input.initialAttempts ?? [])];
  const selectedCandidates = input.candidates ?? input.configuration.candidates;
  const selectedCases = input.cases ?? input.corpus.cases;
  const repetitions = input.repetitions ?? input.configuration.repetitions;
  const pendingCells = input.pendingCells
    ? new Map(
        input.pendingCells.map((cell) => [
          `${cell.candidateId}|${cell.caseId}|${cell.repetition}`,
          cell,
        ]),
      )
    : null;
  let hasStartedRequest = false;
  let supplierCostReconciliationRequired = false;
  const executeCandidate = input.executeCandidate ?? callCandidate;
  const retryMaximum = input.maxRetries ?? input.configuration.maxRetries;
  if (input.supplierBudget) {
    const preflight = buildBenchmarkSupplierBudgetPreflight({
      actualSpentUsd: input.supplierBudget.actualSpentUsd,
      candidates: selectedCandidates,
      cases: selectedCases,
      configuration: input.configuration,
      corpus: input.corpus,
      maxRetries: retryMaximum,
      ...(input.pendingCells ? { pendingCells: input.pendingCells } : {}),
      repetitions,
      supplierCostCapUsd: input.supplierBudget.hardCapUsd,
    });
    await input.onBudgetPreflight?.(preflight);
    // This is the only dispatch guard for the mandatory primary/retry phase.
    // A failure happens after the preflight is persisted but before the first
    // provider request, never mid-exam.
    const bound =
      input.authorisedBoundUsd ??
      preflight.primaryWorstCaseUsd + preflight.retryWorstCaseUsd;
    if (
      input.supplierBudget.actualSpentUsd + bound >
      input.supplierBudget.hardCapUsd + 1e-12
    ) {
      throw new Error('BENCHMARK_SUPPLIER_BUDGET_CONTINGENCY_REQUIRED');
    }
    input.supplierBudget.assertCanDispatch(bound);
  }
  const dispatch = async (dispatchInput: {
    attemptNumber: number;
    benchmarkCase: CorrectionBenchmarkCorpus['cases'][number];
    candidate: CorrectionBenchmarkConfiguration['candidates'][number];
    contract: ReturnType<typeof findBenchmarkContract>;
    deferProgress?: boolean;
    repetition: number;
    workflowPass: 'PRIMARY' | 'RETRY' | 'SCORE_GUARD_SECOND_PASS';
  }): Promise<BenchmarkAttempt> => {
    if (hasStartedRequest && (input.requestDelayMs ?? 0) > 0) {
      await new Promise((resolve) => setTimeout(resolve, input.requestDelayMs));
    }
    hasStartedRequest = true;
    const attempt = await executeBenchmarkWorkflowPass({
      apiKey: input.providerApiKey ?? candidateApiKey(dispatchInput.candidate),
      attemptNumber: dispatchInput.attemptNumber,
      benchmarkCase: dispatchInput.benchmarkCase,
      candidate: dispatchInput.candidate,
      configuration: input.configuration,
      contract: dispatchInput.contract,
      corpus: input.corpus,
      executeCandidate,
      repetition: dispatchInput.repetition,
      workflowPass: dispatchInput.workflowPass,
    });
    attempts.push(attempt);
    try {
      try {
        input.supplierBudget?.reconcile(
          attempt.usage as SupplierBudgetUsage | undefined,
        );
      } catch (error) {
        if (
          error instanceof SupplierBudgetError &&
          error.code === 'SUPPLIER_COST_RECONCILIATION_REQUIRED' &&
          dispatchInput.workflowPass !== 'SCORE_GUARD_SECOND_PASS'
        ) {
          // The complete primary envelope was reserved before the first
          // request. An unknown per-call cost therefore remains a financial
          // reconciliation defect, but it must not burn the sealed exam by
          // interrupting the already-funded primary phase. Guard passes stay
          // closed until every primary cost is reconciled.
          supplierCostReconciliationRequired = true;
        } else {
          throw error;
        }
      }
    } finally {
      if (!dispatchInput.deferProgress) {
        await input.onProgress?.(attempts);
      }
    }
    return attempt;
  };

  const guardedCells: Array<{
    benchmarkCase: CorrectionBenchmarkCorpus['cases'][number];
    candidate: CorrectionBenchmarkConfiguration['candidates'][number];
    contract: ReturnType<typeof findBenchmarkContract>;
    distanceFromPassingScore: number;
    primaryAttempt: BenchmarkAttempt;
    repetition: number;
  }> = [];

  const appendGuardedCell = (guardedInput: {
    benchmarkCase: CorrectionBenchmarkCorpus['cases'][number];
    candidate: CorrectionBenchmarkConfiguration['candidates'][number];
    contract: ReturnType<typeof findBenchmarkContract>;
    primaryAttempt: BenchmarkAttempt;
    repetition: number;
  }): void => {
    if (!guardedInput.primaryAttempt.output) {
      return;
    }
    const completeDelivery =
      (guardedInput.primaryAttempt.unsureCriteria?.length ?? 0) === 0;
    const score = completeDelivery
      ? completeOutputScore({
          contract: guardedInput.contract,
          output: guardedInput.primaryAttempt.output,
        })
      : null;
    if (
      score !== null &&
      input.configuration.scoreGuardBandPoints !== undefined &&
      Math.abs(score - guardedInput.contract.passingScore) <=
        input.configuration.scoreGuardBandPoints
    ) {
      guardedCells.push({
        ...guardedInput,
        distanceFromPassingScore: Math.abs(
          score - guardedInput.contract.passingScore,
        ),
      });
    }
  };

  // On process resume, rebuild the phase-2 schedule from persisted valid
  // primaries. Cells that already contain a real or synthetic guard outcome
  // are terminal and must never dispatch another second pass.
  const initialAttemptsByCell = new Map<string, BenchmarkAttempt[]>();
  for (const attempt of input.initialAttempts ?? []) {
    const key = `${attempt.candidateId}|${attempt.caseId}|${attempt.repetition}`;
    initialAttemptsByCell.set(key, [
      ...(initialAttemptsByCell.get(key) ?? []),
      attempt,
    ]);
  }
  for (const candidate of selectedCandidates) {
    for (const benchmarkCase of selectedCases) {
      const contract = findBenchmarkContract(
        input.corpus,
        benchmarkCase.contractKey,
        benchmarkCase.contractVersion,
      );
      for (let repetition = 1; repetition <= repetitions; repetition += 1) {
        const runAttempts = initialAttemptsByCell.get(
          `${candidate.candidateId}|${benchmarkCase.caseId}|${repetition}`,
        );
        if (
          !runAttempts ||
          runAttempts.some(
            (attempt) => attempt.workflowPass === 'SCORE_GUARD_SECOND_PASS',
          )
        ) {
          continue;
        }
        const primaryAttempt = [...runAttempts]
          .sort((left, right) => right.attempt - left.attempt)
          .find(
            (attempt) =>
              attempt.status === 'VALID' &&
              attempt.output !== undefined &&
              attempt.workflowPass !== 'SCORE_GUARD_SECOND_PASS',
          );
        if (primaryAttempt) {
          appendGuardedCell({
            benchmarkCase,
            candidate,
            contract,
            primaryAttempt,
            repetition,
          });
        }
      }
    }
  }

  // Phase 1: finish every mandatory primary cell (and its preregistered retry
  // budget) before considering a single score-guard pass.
  for (const candidate of selectedCandidates) {
    for (const benchmarkCase of selectedCases) {
      const contract = findBenchmarkContract(
        input.corpus,
        benchmarkCase.contractKey,
        benchmarkCase.contractVersion,
      );
      for (let repetition = 1; repetition <= repetitions; repetition += 1) {
        if (
          pendingCells &&
          !pendingCells.has(
            `${candidate.candidateId}|${benchmarkCase.caseId}|${repetition}`,
          )
        ) {
          continue;
        }
        const pendingCell = pendingCells?.get(
          `${candidate.candidateId}|${benchmarkCase.caseId}|${repetition}`,
        );
        for (
          let attemptNumber = pendingCell?.attemptStart ?? 1;
          attemptNumber <= retryMaximum + 1;
          attemptNumber += 1
        ) {
          const primaryAttempt = await dispatch({
            attemptNumber,
            benchmarkCase,
            candidate,
            contract,
            repetition,
            workflowPass: attemptNumber === 1 ? 'PRIMARY' : 'RETRY',
          });
          if (primaryAttempt.status !== 'VALID' || !primaryAttempt.output) {
            if (attemptNumber > retryMaximum) {
              break;
            }
            continue;
          }
          appendGuardedCell({
            benchmarkCase,
            candidate,
            contract,
            primaryAttempt,
            repetition,
          });
          break;
        }
      }
    }
  }

  // Phase 2: closest-to-threshold guards first, then a stable case/repetition
  // order. A guard that cannot fit is explicitly persisted as skipped; it
  // never causes the completed primary exam to abort or publish an exact
  // score/PASS-FAIL.
  guardedCells.sort(
    (left, right) =>
      left.distanceFromPassingScore - right.distanceFromPassingScore ||
      left.benchmarkCase.caseId.localeCompare(right.benchmarkCase.caseId) ||
      left.repetition - right.repetition ||
      left.candidate.candidateId.localeCompare(right.candidate.candidateId),
  );
  for (const guarded of guardedCells) {
    const guardCost = conservativeCallCostUsd({
      benchmarkCase: guarded.benchmarkCase,
      candidate: guarded.candidate,
      configuration: input.configuration,
      corpus: input.corpus,
    });
    try {
      if (supplierCostReconciliationRequired) {
        throw new SupplierBudgetError('SUPPLIER_COST_RECONCILIATION_REQUIRED');
      }
      input.supplierBudget?.assertCanDispatch(guardCost);
    } catch (error) {
      if (
        !(error instanceof SupplierBudgetError) ||
        ![
          'SUPPLIER_BUDGET_CAP_WOULD_BE_EXCEEDED',
          'SUPPLIER_COST_RECONCILIATION_REQUIRED',
        ].includes(error.code)
      ) {
        throw error;
      }
      attempts.push(
        benchmarkAttemptSchema.parse({
          attempt: guarded.primaryAttempt.attempt + 1,
          candidateId: guarded.candidate.candidateId,
          caseId: guarded.benchmarkCase.caseId,
          errorCode:
            error.code === 'SUPPLIER_COST_RECONCILIATION_REQUIRED'
              ? 'SCORE_GUARD_SECOND_PASS_SKIPPED_COST_RECONCILIATION'
              : 'SCORE_GUARD_SECOND_PASS_SKIPPED_BUDGET',
          latencyMs: 0,
          modelId: guarded.candidate.modelId,
          provider: guarded.candidate.provider,
          repetition: guarded.repetition,
          requestProfileSnapshot: guarded.candidate.requestProfile,
          requestProtocolVersion: input.configuration.requestProtocolVersion,
          status: 'ERROR',
          unsureCriteria: guarded.contract.criteria.map(
            (criterion) => criterion.key,
          ),
          workflowPass: 'SCORE_GUARD_SECOND_PASS',
        }),
      );
      await input.onProgress?.(attempts);
      continue;
    }

    const secondAttempt = await dispatch({
      attemptNumber: guarded.primaryAttempt.attempt + 1,
      benchmarkCase: guarded.benchmarkCase,
      candidate: guarded.candidate,
      contract: guarded.contract,
      deferProgress: true,
      repetition: guarded.repetition,
      workflowPass: 'SCORE_GUARD_SECOND_PASS',
    });
    let reconciledAttempt: BenchmarkAttempt;
    if (
      secondAttempt.status === 'VALID' &&
      secondAttempt.output &&
      guarded.primaryAttempt.output
    ) {
      const reconciled = reconcileProtocol3ScoreGuardPasses({
        contract: guarded.contract,
        primary: {
          output: protocol3CorrectionArtifactOutputSchema.parse(
            guarded.primaryAttempt.output,
          ),
          unsureCriteria: guarded.primaryAttempt.unsureCriteria,
        },
        second: {
          output: protocol3CorrectionArtifactOutputSchema.parse(
            secondAttempt.output,
          ),
          unsureCriteria: secondAttempt.unsureCriteria,
        },
      });
      reconciledAttempt = benchmarkAttemptSchema.parse(
        reconciled.output
          ? {
              ...secondAttempt,
              output: reconciled.output,
              unsureCriteria: reconciled.unsureCriteria,
            }
          : {
              ...secondAttempt,
              errorCode: 'SCORE_GUARD_NO_CONCORDANT_CRITERIA',
              output: undefined,
              status: 'INVALID',
              unsureCriteria: reconciled.unsureCriteria,
            },
      );
    } else {
      reconciledAttempt = benchmarkAttemptSchema.parse({
        ...secondAttempt,
        unsureCriteria: guarded.contract.criteria.map(
          (criterion) => criterion.key,
        ),
      });
    }
    attempts[attempts.length - 1] = reconciledAttempt;
    await input.onProgress?.(attempts);
  }
  return attempts;
}
