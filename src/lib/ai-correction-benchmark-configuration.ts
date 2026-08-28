import { z } from 'zod';
import {
  stableKeySchema,
  languageTagSchema,
} from './ai-correction-benchmark-corpus.js';

const controlPromptSchema = z
  .object({
    canary: z.string().trim().min(12),
    instructions: z.array(z.string().trim().min(1)).min(1),
    language: languageTagSchema,
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
  })
  .strict();

export const exactModelIdSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9.-]+\/[a-z0-9.-]+$/)
  .refine(
    (value) => !/(^|[./-])(auto|latest|free|nitro|floor)([./-]|$)/.test(value),
    'Model identifiers must be exact and must not use dynamic or free routing.',
  );

export const benchmarkCandidateSchema = z
  .object({
    candidateId: stableKeySchema,
    completionUsdPerToken: z.number().nonnegative(),
    label: z.string().trim().min(1),
    modelId: exactModelIdSchema,
    promptUsdPerToken: z.number().nonnegative(),
    provider: z.string().trim().min(1),
    requestProfile: z
      .object({
        adapter: z.enum([
          'OPENROUTER_CHAT',
          'OPENAI_RESPONSES',
          'ANTHROPIC_MESSAGES',
        ]),
        reasoning: z
          .object({
            budgetTokens: z.number().int().positive().nullable(),
            budgetMode: z.enum(['OFF', 'EXPLICIT_MAX', 'EFFORT_ONLY']),
            effort: z.enum(['OFF', 'MINIMAL', 'LOW']),
          })
          .strict(),
        totalOutputTokenLimit: z.number().int().positive(),
        visibleOutputTokenTarget: z.number().int().positive(),
        routeProviders: z.array(z.string().trim().min(1)).length(1).optional(),
        temperature: z.literal(0).nullable(),
        timeoutMs: z.number().int().min(1_000).max(120_000),
        version: z.string().regex(/^\d+\.\d+\.\d+$/),
      })
      .strict(),
  })
  .strict();

const benchmarkGatePolicyV2ThresholdKeys = [
  'decisionAgreementCertainMinimum',
  'eventualUnusableRunRateMaximum',
  'falsePassCountMaximum',
  'firstAttemptInvalidWatchMaximum',
  'twoLevelOrdinalGapCountMaximum',
  'variabilityWatchMaximum',
] as const;

const benchmarkThresholdsSchema = z
  .object({
    criterionAgreementMinimum: z.number().min(0).max(1),
    evidenceHallucinationMaximum: z.number().min(0).max(1),
    fullRunCostUsdMaximum: z.number().positive(),
    injectionSafetyMinimum: z.number().min(0).max(1),
    invalidOutputMaximum: z.number().min(0).max(1),
    meanCalibrationErrorMaximum: z.number().min(0).max(1),
    p90LatencyMsMaximum: z.number().int().positive(),
    transportErrorMaximum: z.number().min(0).max(1),
    variabilityMaximum: z.number().min(0).max(1),
    decisionAgreementCertainMinimum: z.number().min(0).max(1).optional(),
    eventualUnusableRunRateMaximum: z.number().min(0).max(1).optional(),
    falsePassCountMaximum: z.number().int().min(0).optional(),
    firstAttemptInvalidWatchMaximum: z.number().min(0).max(1).optional(),
    twoLevelOrdinalGapCountMaximum: z.number().int().min(0).optional(),
    variabilityWatchMaximum: z.number().min(0).max(1).optional(),
    unsureCriterionRateMaximum: z.number().min(0).max(1).optional(),
  })
  .strict()
  .superRefine((thresholds, context) => {
    const present = benchmarkGatePolicyV2ThresholdKeys.filter(
      (key) => thresholds[key] !== undefined,
    );
    if (
      present.length === 0 ||
      present.length === benchmarkGatePolicyV2ThresholdKeys.length
    ) {
      return;
    }
    for (const key of benchmarkGatePolicyV2ThresholdKeys) {
      if (thresholds[key] === undefined) {
        context.addIssue({
          code: 'custom',
          message:
            'Gate policy v2 thresholds must be declared together (all or none).',
          path: [key],
        });
      }
    }
    if (
      thresholds.unsureCriterionRateMaximum !== undefined &&
      present.length === 0
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'The v3 unsure-criterion gate requires the gate policy v2 threshold block.',
        path: ['unsureCriterionRateMaximum'],
      });
    }
  });

export type BenchmarkGatePolicyV2Thresholds = {
  decisionAgreementCertainMinimum: number;
  eventualUnusableRunRateMaximum: number;
  falsePassCountMaximum: number;
  firstAttemptInvalidWatchMaximum: number;
  twoLevelOrdinalGapCountMaximum: number;
  variabilityWatchMaximum: number;
};

export function getBenchmarkGatePolicyV2Thresholds(
  thresholds: CorrectionBenchmarkConfiguration['thresholds'],
): BenchmarkGatePolicyV2Thresholds | undefined {
  const present = benchmarkGatePolicyV2ThresholdKeys.filter(
    (key) => thresholds[key] !== undefined,
  );
  if (present.length === 0) {
    return undefined;
  }
  const {
    decisionAgreementCertainMinimum,
    eventualUnusableRunRateMaximum,
    falsePassCountMaximum,
    firstAttemptInvalidWatchMaximum,
    twoLevelOrdinalGapCountMaximum,
    variabilityWatchMaximum,
  } = thresholds;
  if (
    decisionAgreementCertainMinimum === undefined ||
    eventualUnusableRunRateMaximum === undefined ||
    falsePassCountMaximum === undefined ||
    firstAttemptInvalidWatchMaximum === undefined ||
    twoLevelOrdinalGapCountMaximum === undefined ||
    variabilityWatchMaximum === undefined
  ) {
    throw new Error('BENCHMARK_GATE_POLICY_V2_THRESHOLDS_INCOMPLETE');
  }
  return {
    decisionAgreementCertainMinimum,
    eventualUnusableRunRateMaximum,
    falsePassCountMaximum,
    firstAttemptInvalidWatchMaximum,
    twoLevelOrdinalGapCountMaximum,
    variabilityWatchMaximum,
  };
}

const benchmarkRegressionLimitsSchema = z
  .object({
    criterionAgreementDropMaximum: z.number().min(0).max(1),
    estimatedCostIncreaseRatioMaximum: z.number().nonnegative(),
    evidenceHallucinationIncreaseMaximum: z.number().min(0).max(1),
    injectionSafetyDropMaximum: z.number().min(0).max(1),
    p90LatencyIncreaseRatioMaximum: z.number().nonnegative(),
  })
  .strict();

export const benchmarkActivityTypeSchema = z.enum([
  'writing',
  'reflection',
  'practice',
  'project',
  'case_study',
  'written_assignment',
  'practical_exercise',
  'oral',
  'simulation',
  'cumulative_exam',
]);

export const correctionBenchmarkConfigurationSchema = z
  .object({
    activityTypeScope: z
      .array(benchmarkActivityTypeSchema)
      .min(1)
      .refine((values) => new Set(values).size === values.length, {
        message: 'Benchmark activity type scope values must be unique.',
      })
      .optional(),
    benchmarkId: stableKeySchema,
    candidates: z.array(benchmarkCandidateSchema).min(3),
    catalogObservedAt: z.iso.datetime({ offset: true }),
    controlPrompt: controlPromptSchema,
    corpusId: stableKeySchema,
    correctionDeliveryPolicy: z.enum(['WHOLE', 'PARTIAL_CRITERION']).optional(),
    language: languageTagSchema,
    maxRetries: z.number().int().min(0).max(3),
    promptVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    requestProtocolVersion: z.literal('3.0.1'),
    regressionLimits: benchmarkRegressionLimitsSchema,
    repetitions: z.number().int().min(2).max(10),
    reviewPanelCaseIds: z.array(stableKeySchema).length(6),
    schemaVersion: z.literal(2),
    scoreGuardBandPoints: z.number().int().positive().max(50).optional(),
    thresholds: benchmarkThresholdsSchema,
  })
  .strict()
  .superRefine((configuration, context) => {
    if (
      (configuration.activityTypeScope === undefined) !==
      (configuration.scoreGuardBandPoints === undefined)
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'A scoped benchmark identity must declare both activityTypeScope and scoreGuardBandPoints.',
        path:
          configuration.activityTypeScope === undefined
            ? ['activityTypeScope']
            : ['scoreGuardBandPoints'],
      });
    }
    if (
      configuration.thresholds.unsureCriterionRateMaximum !== undefined &&
      configuration.correctionDeliveryPolicy !== 'PARTIAL_CRITERION'
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'The unsure-criterion gate requires correctionDeliveryPolicy PARTIAL_CRITERION.',
        path: ['thresholds', 'unsureCriterionRateMaximum'],
      });
    }
    if (
      configuration.correctionDeliveryPolicy === 'PARTIAL_CRITERION' &&
      configuration.thresholds.unsureCriterionRateMaximum === undefined
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'A PARTIAL_CRITERION identity must declare unsureCriterionRateMaximum.',
        path: ['correctionDeliveryPolicy'],
      });
    }
    if (
      configuration.controlPrompt.language !== configuration.language ||
      configuration.controlPrompt.version !== configuration.promptVersion
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'The localized control prompt must match the benchmark language and prompt version.',
        path: ['controlPrompt'],
      });
    }
    const candidateIds = new Set<string>();
    configuration.candidates.forEach((candidate, index) => {
      if (candidateIds.has(candidate.candidateId)) {
        context.addIssue({
          code: 'custom',
          message: 'Benchmark candidate identifiers must be unique.',
          path: ['candidates', index, 'candidateId'],
        });
      }
      candidateIds.add(candidate.candidateId);
      if (
        candidate.requestProfile.adapter === 'OPENROUTER_CHAT' &&
        !candidate.requestProfile.routeProviders
      ) {
        context.addIssue({
          code: 'custom',
          message: 'OpenRouter candidates must pin exactly one provider route.',
          path: ['candidates', index, 'requestProfile', 'routeProviders'],
        });
      }
      if (
        candidate.requestProfile.adapter !== 'OPENROUTER_CHAT' &&
        candidate.requestProfile.routeProviders !== undefined
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Provider routes are only valid for the OpenRouter adapter.',
          path: ['candidates', index, 'requestProfile', 'routeProviders'],
        });
      }
      if (
        candidate.requestProfile.reasoning.effort === 'OFF' &&
        candidate.requestProfile.reasoning.budgetTokens !== null
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'Disabled reasoning cannot reserve a reasoning token budget.',
          path: ['candidates', index, 'requestProfile', 'reasoning'],
        });
      }
      if (
        candidate.requestProfile.reasoning.budgetMode === 'OFF' &&
        (candidate.requestProfile.reasoning.effort !== 'OFF' ||
          candidate.requestProfile.reasoning.budgetTokens !== null ||
          candidate.requestProfile.totalOutputTokenLimit !==
            candidate.requestProfile.visibleOutputTokenTarget)
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'Disabled reasoning must reserve the full total limit for visible output.',
          path: ['candidates', index, 'requestProfile', 'reasoning'],
        });
      }
      if (
        candidate.requestProfile.reasoning.budgetMode === 'EXPLICIT_MAX' &&
        (candidate.requestProfile.reasoning.effort === 'OFF' ||
          candidate.requestProfile.reasoning.budgetTokens === null ||
          candidate.requestProfile.totalOutputTokenLimit !==
            candidate.requestProfile.visibleOutputTokenTarget +
              (candidate.requestProfile.reasoning.budgetTokens ?? 0) ||
          candidate.requestProfile.adapter === 'OPENAI_RESPONSES')
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'Explicit reasoning requires a supported adapter and total = visible target + reasoning max.',
          path: ['candidates', index, 'requestProfile', 'reasoning'],
        });
      }
      if (
        candidate.requestProfile.reasoning.budgetMode === 'EFFORT_ONLY' &&
        (candidate.requestProfile.reasoning.effort === 'OFF' ||
          candidate.requestProfile.reasoning.budgetTokens !== null ||
          candidate.requestProfile.totalOutputTokenLimit <
            candidate.requestProfile.visibleOutputTokenTarget)
      ) {
        context.addIssue({
          code: 'custom',
          message:
            'Effort-only reasoning has no visible-output guarantee and requires explicit total capacity.',
          path: ['candidates', index, 'requestProfile', 'reasoning'],
        });
      }
    });
    if (new Set(configuration.reviewPanelCaseIds).size !== 6) {
      context.addIssue({
        code: 'custom',
        message: 'Review panel case identifiers must be unique.',
        path: ['reviewPanelCaseIds'],
      });
    }
  });

export type CorrectionBenchmarkConfiguration = z.infer<
  typeof correctionBenchmarkConfigurationSchema
>;
