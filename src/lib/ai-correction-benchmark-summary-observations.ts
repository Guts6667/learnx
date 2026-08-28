import type { BenchmarkAttempt } from './ai-correction-benchmark-artifacts.js';
import {
  hasHallucinatedEvidence,
  injectionOutputIsSafe,
} from './ai-correction-benchmark-evidence.js';
import {
  outputSignature,
  type BenchmarkCase,
  type BenchmarkContract,
  type LogicalRun,
  type ValidBenchmarkAttempt,
} from './ai-correction-benchmark-summary-support.js';

export function calculateTransportObservations(input: {
  modelRuns: LogicalRun[];
  gatePolicyV2: boolean;
}) {
  const runsWithInvalidFirstAttempt = input.modelRuns.filter(
    (run) => run.attempts[0]?.status === 'INVALID',
  );
  const unusableRuns = input.modelRuns.filter((run) => !run.deliveredAttempt);
  let recoveredTransportRuns = 0;
  const runsWithTransportError = input.modelRuns.filter((run) => {
    const hasError = run.attempts.some(
      (attempt) =>
        attempt.status === 'ERROR' &&
        attempt.workflowPass !== 'SCORE_GUARD_SECOND_PASS',
    );
    if (!hasError) return false;
    if (
      input.gatePolicyV2 &&
      run.attempts.some(
        (attempt) => attempt !== run.finalAttempt && attempt.status === 'ERROR',
      )
    ) {
      recoveredTransportRuns += 1;
    }
    return input.gatePolicyV2 ? run.finalAttempt.status === 'ERROR' : hasError;
  });
  return {
    recoveredTransportRuns,
    runsWithInvalidFirstAttempt,
    runsWithTransportError,
    unusableRuns,
  };
}

export function calculateEvidenceObservations(input: {
  casesById: Map<string, BenchmarkCase>;
  gatePolicyV2: boolean;
  modelRuns: LogicalRun[];
}) {
  let firstAttemptEvidenceRejectionRuns = 0;
  let hallucinationCount = 0;
  for (const run of input.modelRuns) {
    const benchmarkCase = input.casesById.get(run.finalAttempt.caseId);
    const attemptRejectedEvidence = (attempt: BenchmarkAttempt): boolean =>
      attempt.errorCode?.startsWith('MODEL_EVIDENCE_') === true ||
      (attempt.output !== undefined &&
        benchmarkCase !== undefined &&
        hasHallucinatedEvidence(attempt.output, benchmarkCase.responseText));
    if (input.gatePolicyV2) {
      const nonFinalAttempts = run.attempts.filter(
        (attempt) => attempt !== run.finalAttempt,
      );
      if (nonFinalAttempts.some(attemptRejectedEvidence))
        firstAttemptEvidenceRejectionRuns += 1;
      hallucinationCount +=
        run.deliveredAttempt !== undefined &&
        attemptRejectedEvidence(run.deliveredAttempt)
          ? 1
          : 0;
    } else {
      hallucinationCount += run.attempts.some(attemptRejectedEvidence) ? 1 : 0;
    }
  }
  return { firstAttemptEvidenceRejectionRuns, hallucinationCount };
}

export function calculateInjectionObservations(input: {
  casesById: Map<string, BenchmarkCase>;
  canary: string;
  modelAttempts: BenchmarkAttempt[];
}) {
  const injectionAttempts = input.modelAttempts.filter(
    (attempt) =>
      input.casesById.get(attempt.caseId)?.category === 'PROMPT_INJECTION' &&
      attempt.errorCode !== 'SCORE_GUARD_SECOND_PASS_SKIPPED_BUDGET' &&
      attempt.errorCode !==
        'SCORE_GUARD_SECOND_PASS_SKIPPED_COST_RECONCILIATION',
  );
  const injectionRuns = new Map<string, BenchmarkAttempt[]>();
  injectionAttempts.forEach((attempt) => {
    const key = `${attempt.caseId}@${attempt.repetition}`;
    injectionRuns.set(key, [...(injectionRuns.get(key) ?? []), attempt]);
  });
  const safeInjectionRunCount = [...injectionRuns.values()].filter(
    (runAttempts) =>
      runAttempts.every((attempt) => {
        if (attempt.status !== 'VALID' || !attempt.output) return false;
        const benchmarkCase = input.casesById.get(attempt.caseId);
        return benchmarkCase
          ? injectionOutputIsSafe({
              benchmarkCase,
              canary: input.canary,
              output: attempt.output,
            })
          : false;
      }),
  ).length;
  return { injectionRunCount: injectionRuns.size, safeInjectionRunCount };
}

export function calculateStabilityObservations(input: {
  modelRuns: LogicalRun[];
  validAttempts: ValidBenchmarkAttempt[];
}) {
  const signaturesByCase = new Map<string, Set<string>>();
  input.validAttempts.forEach((attempt) => {
    const signatures =
      signaturesByCase.get(attempt.caseId) ?? new Set<string>();
    signatures.add(outputSignature(attempt.output));
    signaturesByCase.set(attempt.caseId, signatures);
  });
  const variableCases = [...signaturesByCase.values()].filter(
    (signatures) => signatures.size > 1,
  ).length;
  const retriedRuns = input.modelRuns.filter((run) =>
    run.attempts
      .slice(1)
      .some((attempt) => attempt.workflowPass !== 'SCORE_GUARD_SECOND_PASS'),
  ).length;
  return {
    retriedRuns,
    variabilityRate:
      signaturesByCase.size === 0 ? 0 : variableCases / signaturesByCase.size,
  };
}

export function calculateUnsureCriterionRate(input: {
  casesById: Map<string, BenchmarkCase>;
  contractsByKey: Map<string, BenchmarkContract>;
  modelRuns: LogicalRun[];
}): number {
  let unsureCriteriaTotal = 0;
  let criteriaTotal = 0;
  for (const run of input.modelRuns) {
    const deliveredAttempt = run.deliveredAttempt;
    const benchmarkCase = input.casesById.get(run.finalAttempt.caseId);
    const contract = benchmarkCase
      ? input.contractsByKey.get(
          `${benchmarkCase.contractKey}|${benchmarkCase.contractVersion}`,
        )
      : undefined;
    if (!benchmarkCase || !contract) continue;
    const unsure = deliveredAttempt?.unsureCriteria?.length ?? 0;
    const delivered = deliveredAttempt
      ? (deliveredAttempt.output?.criteria.length ?? 0)
      : 0;
    const total =
      delivered + unsure > 0 ? delivered + unsure : contract.criteria.length;
    criteriaTotal += total;
    unsureCriteriaTotal += deliveredAttempt ? unsure : total;
  }
  return criteriaTotal === 0 ? 0 : unsureCriteriaTotal / criteriaTotal;
}

export function scoreGuardRunSets(modelRuns: LogicalRun[]) {
  const routed = new Set(
    modelRuns
      .filter((run) =>
        run.attempts.some(
          (attempt) => attempt.workflowPass === 'SCORE_GUARD_SECOND_PASS',
        ),
      )
      .map(
        (run) => `${run.finalAttempt.caseId}|${run.finalAttempt.repetition}`,
      ),
  );
  const executed = new Set(
    modelRuns
      .filter((run) =>
        run.attempts.some(
          (attempt) =>
            attempt.workflowPass === 'SCORE_GUARD_SECOND_PASS' &&
            attempt.errorCode !== 'SCORE_GUARD_SECOND_PASS_SKIPPED_BUDGET' &&
            attempt.errorCode !==
              'SCORE_GUARD_SECOND_PASS_SKIPPED_COST_RECONCILIATION',
        ),
      )
      .map(
        (run) => `${run.finalAttempt.caseId}|${run.finalAttempt.repetition}`,
      ),
  );
  return { executed, routed };
}

export function ordinalLevelKeys(contracts: BenchmarkContract[]): string[] {
  return [
    ...new Set(
      contracts.flatMap((contract) =>
        contract.criteria.flatMap((criterion) =>
          criterion.performanceLevels.map((level) => level.key),
        ),
      ),
    ),
  ].sort();
}
