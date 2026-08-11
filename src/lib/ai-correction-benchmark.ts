import { z } from 'zod';

import {
  correctionContractSchema,
  correctionOutputSchema,
  validateCorrectionOutputForContract,
  type CorrectionContract,
  type CorrectionOutput,
} from './ai-correction-contracts.ts';

const stableKeySchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const languageTagSchema = z
  .string()
  .trim()
  .min(2)
  .max(35)
  .refine((value) => {
    try {
      return Intl.getCanonicalLocales(value)[0] === value;
    } catch {
      return false;
    }
  }, 'Language must be a canonical BCP 47 tag such as fr-FR or en-GB.');

export const benchmarkResponseCategorySchema = z.enum([
  'SUCCESSFUL',
  'PARTIAL',
  'ERRONEOUS',
  'AMBIGUOUS',
  'OFF_TOPIC',
  'PROMPT_INJECTION',
]);

const benchmarkReviewSchema = z.discriminatedUnion('status', [
  z
    .object({
      reviewedAt: z.null(),
      reviewer: z.null(),
      status: z.literal('PENDING'),
    })
    .strict(),
  z
    .object({
      reviewedAt: z.iso.datetime({ offset: true }),
      reviewer: z.string().trim().min(1),
      status: z.literal('APPROVED'),
    })
    .strict(),
]);

const expectedCriterionSchema = z
  .object({
    criterionKey: stableKeySchema,
    levelKey: stableKeySchema,
  })
  .strict();

const expectedSecondPassSchema = z
  .object({
    rationale: z.string().trim().min(1),
    required: z.boolean(),
  })
  .strict();

const benchmarkCaseSchema = z
  .object({
    caseId: stableKeySchema,
    category: benchmarkResponseCategorySchema,
    contractKey: stableKeySchema,
    contractVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    expectedCriteria: z.array(expectedCriterionSchema).min(1),
    expectedSecondPass: expectedSecondPassSchema,
    goldRationale: z.string().trim().min(1),
    responseText: z.string().trim().min(1),
    taskContext: z.string().trim().min(1),
    taskPrompt: z.string().trim().min(1),
  })
  .strict();

export const correctionBenchmarkCorpusSchema = z
  .object({
    cases: z.array(benchmarkCaseSchema).min(1),
    contracts: z.array(correctionContractSchema).min(1),
    corpusId: stableKeySchema,
    humanReview: benchmarkReviewSchema,
    language: languageTagSchema,
    schemaVersion: z.literal(1),
    syntheticOnly: z.literal(true),
  })
  .strict()
  .superRefine((corpus, context) => {
    const contractsById = new Map(
      corpus.contracts.map((contract) => [
        `${contract.contractKey}@${contract.version}`,
        contract,
      ]),
    );
    const caseIds = new Set<string>();

    corpus.cases.forEach((benchmarkCase, caseIndex) => {
      if (caseIds.has(benchmarkCase.caseId)) {
        context.addIssue({
          code: 'custom',
          message: 'Benchmark case identifiers must be unique.',
          path: ['cases', caseIndex, 'caseId'],
        });
      }
      caseIds.add(benchmarkCase.caseId);

      const contract = contractsById.get(
        `${benchmarkCase.contractKey}@${benchmarkCase.contractVersion}`,
      );
      if (!contract) {
        context.addIssue({
          code: 'custom',
          message: 'Benchmark case references an unknown contract.',
          path: ['cases', caseIndex, 'contractKey'],
        });
        return;
      }

      const expectedByCriterion = new Map(
        benchmarkCase.expectedCriteria.map((criterion) => [
          criterion.criterionKey,
          criterion.levelKey,
        ]),
      );
      if (
        expectedByCriterion.size !== contract.criteria.length ||
        benchmarkCase.expectedCriteria.length !== contract.criteria.length
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Every contract criterion must have one expected level.',
          path: ['cases', caseIndex, 'expectedCriteria'],
        });
      }

      contract.criteria.forEach((criterion) => {
        const expectedLevel = expectedByCriterion.get(criterion.key);
        if (
          !expectedLevel ||
          !criterion.performanceLevels.some(
            (level) => level.key === expectedLevel,
          )
        ) {
          context.addIssue({
            code: 'custom',
            message: 'Expected level must belong to the referenced criterion.',
            path: ['cases', caseIndex, 'expectedCriteria'],
          });
        }
      });
    });
  });

const exactModelIdSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9.-]+\/[a-z0-9.-]+-\d{8}$/)
  .refine(
    (value) => !value.includes('latest') && !value.includes('auto'),
    'Model identifiers must be exact and must not use latest or auto routing.',
  );

const benchmarkCandidateSchema = z
  .object({
    completionUsdPerToken: z.number().nonnegative(),
    label: z.string().trim().min(1),
    modelId: exactModelIdSchema,
    promptUsdPerToken: z.number().nonnegative(),
    provider: z.string().trim().min(1),
  })
  .strict();

const benchmarkThresholdsSchema = z
  .object({
    criterionAgreementMinimum: z.number().min(0).max(1),
    evidenceHallucinationMaximum: z.number().min(0).max(1),
    fullRunCostUsdMaximum: z.number().positive(),
    injectionSafetyMinimum: z.number().min(0).max(1),
    invalidOutputMaximum: z.number().min(0).max(1),
    meanCalibrationErrorMaximum: z.number().min(0).max(1),
    p90LatencyMsMaximum: z.number().int().positive(),
    secondPassAgreementMinimum: z.number().min(0).max(1),
    variabilityMaximum: z.number().min(0).max(1),
  })
  .strict();

const benchmarkRegressionLimitsSchema = z
  .object({
    criterionAgreementDropMaximum: z.number().min(0).max(1),
    estimatedCostIncreaseRatioMaximum: z.number().nonnegative(),
    evidenceHallucinationIncreaseMaximum: z.number().min(0).max(1),
    injectionSafetyDropMaximum: z.number().min(0).max(1),
    p90LatencyIncreaseRatioMaximum: z.number().nonnegative(),
    secondPassAgreementDropMaximum: z.number().min(0).max(1),
  })
  .strict();

export const correctionBenchmarkConfigurationSchema = z
  .object({
    benchmarkId: stableKeySchema,
    candidates: z.array(benchmarkCandidateSchema).min(3),
    catalogObservedAt: z.iso.datetime({ offset: true }),
    corpusId: stableKeySchema,
    maxRetries: z.number().int().min(0).max(3),
    promptVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    regressionLimits: benchmarkRegressionLimitsSchema,
    repetitions: z.number().int().min(2).max(10),
    schemaVersion: z.literal(1),
    thresholds: benchmarkThresholdsSchema,
  })
  .strict()
  .superRefine((configuration, context) => {
    const modelIds = new Set<string>();
    configuration.candidates.forEach((candidate, index) => {
      if (modelIds.has(candidate.modelId)) {
        context.addIssue({
          code: 'custom',
          message: 'Benchmark candidate model identifiers must be unique.',
          path: ['candidates', index, 'modelId'],
        });
      }
      modelIds.add(candidate.modelId);
    });
  });

const benchmarkUsageSchema = z
  .object({
    completionTokens: z.number().int().nonnegative(),
    promptTokens: z.number().int().nonnegative(),
  })
  .strict();

export const benchmarkAttemptSchema = z
  .object({
    attempt: z.number().int().positive(),
    caseId: stableKeySchema,
    errorCode: z.string().trim().min(1).optional(),
    latencyMs: z.number().int().nonnegative(),
    modelId: exactModelIdSchema,
    output: correctionOutputSchema.optional(),
    repetition: z.number().int().positive(),
    status: z.enum(['VALID', 'INVALID', 'ERROR']),
    usage: benchmarkUsageSchema.optional(),
  })
  .strict()
  .superRefine((attempt, context) => {
    if (attempt.status === 'VALID' && !attempt.output) {
      context.addIssue({
        code: 'custom',
        message: 'A valid attempt must include a structured output.',
        path: ['output'],
      });
    }
    if (attempt.status !== 'VALID' && !attempt.errorCode) {
      context.addIssue({
        code: 'custom',
        message: 'An invalid or failed attempt must include an error code.',
        path: ['errorCode'],
      });
    }
  });

export type CorrectionBenchmarkCorpus = z.infer<
  typeof correctionBenchmarkCorpusSchema
>;
export type CorrectionBenchmarkConfiguration = z.infer<
  typeof correctionBenchmarkConfigurationSchema
>;
export type BenchmarkAttempt = z.infer<typeof benchmarkAttemptSchema>;

export type ModelBenchmarkMetrics = {
  criterionAgreement: number;
  evidenceHallucinationRate: number;
  estimatedCostUsd: number;
  injectionSafetyRate: number;
  invalidOutputRate: number;
  meanCalibrationError: number;
  medianLatencyMs: number;
  modelId: string;
  p75LatencyMs: number;
  p90LatencyMs: number;
  retryRate: number;
  secondPassAgreement: number;
  secondPassRate: number;
  variabilityRate: number;
};

export type BenchmarkSummary = {
  interModelDisagreementRate: number;
  models: ModelBenchmarkMetrics[];
};

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

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil(percentileValue * sorted.length) - 1;
  return sorted[Math.max(0, index)] ?? 0;
}

function outputSignature(output: CorrectionOutput): string {
  return [...output.criteria]
    .sort((left, right) => left.criterionKey.localeCompare(right.criterionKey))
    .map((criterion) => `${criterion.criterionKey}:${criterion.levelKey}`)
    .join('|');
}

function hasHallucinatedEvidence(
  output: CorrectionOutput,
  responseText: string,
): boolean {
  return output.criteria.some((criterion) =>
    criterion.evidenceQuotes.some((quote) => !responseText.includes(quote)),
  );
}

function calculateCost(
  attempt: BenchmarkAttempt,
  candidate: CorrectionBenchmarkConfiguration['candidates'][number],
): number {
  if (!attempt.usage) {
    return 0;
  }
  return (
    attempt.usage.promptTokens * candidate.promptUsdPerToken +
    attempt.usage.completionTokens * candidate.completionUsdPerToken
  );
}

export function summarizeCorrectionBenchmark(input: {
  attempts: unknown[];
  configuration: unknown;
  corpus: unknown;
}): BenchmarkSummary {
  const corpus = parseCorrectionBenchmarkCorpus(input.corpus);
  const configuration = parseCorrectionBenchmarkConfiguration(
    input.configuration,
  );
  const attempts = input.attempts.map((attempt) =>
    benchmarkAttemptSchema.parse(attempt),
  );
  const casesById = new Map(
    corpus.cases.map((benchmarkCase) => [benchmarkCase.caseId, benchmarkCase]),
  );
  const finalAttempts = attempts.filter((attempt, index) => {
    const laterAttemptExists = attempts.some(
      (candidate, candidateIndex) =>
        candidateIndex > index &&
        candidate.modelId === attempt.modelId &&
        candidate.caseId === attempt.caseId &&
        candidate.repetition === attempt.repetition &&
        candidate.attempt > attempt.attempt,
    );
    return !laterAttemptExists;
  });

  const models = configuration.candidates.map((candidate) => {
    const modelAttempts = attempts.filter(
      (attempt) => attempt.modelId === candidate.modelId,
    );
    const finalModelAttempts = finalAttempts.filter(
      (attempt) => attempt.modelId === candidate.modelId,
    );
    const validAttempts = finalModelAttempts.filter(
      (attempt): attempt is BenchmarkAttempt & { output: CorrectionOutput } =>
        attempt.status === 'VALID' && attempt.output !== undefined,
    );

    let criterionCount = 0;
    let criterionMatches = 0;
    let confidenceError = 0;
    let injectionCount = 0;
    let safeInjectionCount = 0;
    let hallucinationCount = 0;
    let secondPassMatches = 0;

    validAttempts.forEach((attempt) => {
      const benchmarkCase = casesById.get(attempt.caseId);
      if (!benchmarkCase) {
        throw new Error(`Unknown benchmark case: ${attempt.caseId}`);
      }
      const expected = new Map(
        benchmarkCase.expectedCriteria.map((criterion) => [
          criterion.criterionKey,
          criterion.levelKey,
        ]),
      );
      let allCriteriaMatch = true;
      attempt.output.criteria.forEach((criterion) => {
        const matches =
          expected.get(criterion.criterionKey) === criterion.levelKey;
        criterionCount += 1;
        criterionMatches += matches ? 1 : 0;
        confidenceError += Math.abs(criterion.confidence - (matches ? 1 : 0));
        allCriteriaMatch = allCriteriaMatch && matches;
      });
      const hallucinated = hasHallucinatedEvidence(
        attempt.output,
        benchmarkCase.responseText,
      );
      hallucinationCount += hallucinated ? 1 : 0;
      secondPassMatches +=
        attempt.output.secondPass.required ===
        benchmarkCase.expectedSecondPass.required
          ? 1
          : 0;
      if (benchmarkCase.category === 'PROMPT_INJECTION') {
        injectionCount += 1;
        safeInjectionCount += allCriteriaMatch && !hallucinated ? 1 : 0;
      }
    });

    const signaturesByCase = new Map<string, Set<string>>();
    validAttempts.forEach((attempt) => {
      const signatures =
        signaturesByCase.get(attempt.caseId) ?? new Set<string>();
      signatures.add(outputSignature(attempt.output));
      signaturesByCase.set(attempt.caseId, signatures);
    });
    const variableCases = [...signaturesByCase.values()].filter(
      (signatures) => signatures.size > 1,
    ).length;
    const retryAttempts = modelAttempts.filter(
      (attempt) => attempt.attempt > 1,
    ).length;

    return {
      criterionAgreement:
        criterionCount === 0 ? 0 : criterionMatches / criterionCount,
      evidenceHallucinationRate:
        validAttempts.length === 0
          ? 0
          : hallucinationCount / validAttempts.length,
      estimatedCostUsd: modelAttempts.reduce(
        (total, attempt) => total + calculateCost(attempt, candidate),
        0,
      ),
      injectionSafetyRate:
        injectionCount === 0 ? 0 : safeInjectionCount / injectionCount,
      invalidOutputRate:
        finalModelAttempts.length === 0
          ? 0
          : (finalModelAttempts.length - validAttempts.length) /
            finalModelAttempts.length,
      meanCalibrationError:
        criterionCount === 0 ? 0 : confidenceError / criterionCount,
      medianLatencyMs: percentile(
        modelAttempts.map((attempt) => attempt.latencyMs),
        0.5,
      ),
      modelId: candidate.modelId,
      p75LatencyMs: percentile(
        modelAttempts.map((attempt) => attempt.latencyMs),
        0.75,
      ),
      p90LatencyMs: percentile(
        modelAttempts.map((attempt) => attempt.latencyMs),
        0.9,
      ),
      retryRate:
        modelAttempts.length === 0 ? 0 : retryAttempts / modelAttempts.length,
      secondPassAgreement:
        validAttempts.length === 0
          ? 0
          : secondPassMatches / validAttempts.length,
      secondPassRate:
        validAttempts.length === 0
          ? 0
          : validAttempts.filter(
              (attempt) => attempt.output.secondPass.required,
            ).length / validAttempts.length,
      variabilityRate:
        signaturesByCase.size === 0 ? 0 : variableCases / signaturesByCase.size,
    };
  });

  const signaturesByRun = new Map<string, Set<string>>();
  finalAttempts.forEach((attempt) => {
    if (attempt.status !== 'VALID' || !attempt.output) {
      return;
    }
    const key = `${attempt.caseId}@${attempt.repetition}`;
    const signatures = signaturesByRun.get(key) ?? new Set<string>();
    signatures.add(outputSignature(attempt.output));
    signaturesByRun.set(key, signatures);
  });
  const disagreements = [...signaturesByRun.values()].filter(
    (signatures) => signatures.size > 1,
  ).length;

  return {
    interModelDisagreementRate:
      signaturesByRun.size === 0 ? 0 : disagreements / signaturesByRun.size,
    models,
  };
}

export function modelMeetsPromotionThresholds(
  metrics: ModelBenchmarkMetrics,
  thresholds: CorrectionBenchmarkConfiguration['thresholds'],
): boolean {
  return (
    metrics.criterionAgreement >= thresholds.criterionAgreementMinimum &&
    metrics.evidenceHallucinationRate <=
      thresholds.evidenceHallucinationMaximum &&
    metrics.estimatedCostUsd <= thresholds.fullRunCostUsdMaximum &&
    metrics.injectionSafetyRate >= thresholds.injectionSafetyMinimum &&
    metrics.invalidOutputRate <= thresholds.invalidOutputMaximum &&
    metrics.meanCalibrationError <= thresholds.meanCalibrationErrorMaximum &&
    metrics.p90LatencyMs <= thresholds.p90LatencyMsMaximum &&
    metrics.secondPassAgreement >= thresholds.secondPassAgreementMinimum &&
    metrics.variabilityRate <= thresholds.variabilityMaximum
  );
}

export function benchmarkRegressed(input: {
  baseline: ModelBenchmarkMetrics;
  candidate: ModelBenchmarkMetrics;
  limits: CorrectionBenchmarkConfiguration['regressionLimits'];
}): boolean {
  const latencyIncreaseRatio =
    input.baseline.p90LatencyMs === 0
      ? 0
      : (input.candidate.p90LatencyMs - input.baseline.p90LatencyMs) /
        input.baseline.p90LatencyMs;
  const costIncreaseRatio =
    input.baseline.estimatedCostUsd === 0
      ? 0
      : (input.candidate.estimatedCostUsd - input.baseline.estimatedCostUsd) /
        input.baseline.estimatedCostUsd;

  return (
    input.baseline.criterionAgreement - input.candidate.criterionAgreement >
      input.limits.criterionAgreementDropMaximum ||
    input.candidate.evidenceHallucinationRate -
      input.baseline.evidenceHallucinationRate >
      input.limits.evidenceHallucinationIncreaseMaximum ||
    input.baseline.injectionSafetyRate - input.candidate.injectionSafetyRate >
      input.limits.injectionSafetyDropMaximum ||
    input.baseline.secondPassAgreement - input.candidate.secondPassAgreement >
      input.limits.secondPassAgreementDropMaximum ||
    latencyIncreaseRatio > input.limits.p90LatencyIncreaseRatioMaximum ||
    costIncreaseRatio > input.limits.estimatedCostIncreaseRatioMaximum
  );
}

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
  contract: CorrectionContract;
  output: unknown;
}): CorrectionOutput {
  const output = validateCorrectionOutputForContract({
    contract: input.contract,
    output: input.output,
  });
  if (hasHallucinatedEvidence(output, input.benchmarkCase.responseText)) {
    throw new Error('MODEL_EVIDENCE_NOT_IN_RESPONSE');
  }
  return output;
}
