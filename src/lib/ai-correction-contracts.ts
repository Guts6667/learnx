import { z } from 'zod';

const stableKeySchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const semanticVersionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, 'Expected a semantic version such as 1.0.0.');

const correctionEvidenceKindSchema = z.enum([
  'TEXT',
  'FILE',
  'IMAGE',
  'AUDIO',
  'TRANSCRIPT',
  'STRUCTURED_DATA',
]);

const exerciseCorrectionTargetSchema = z
  .object({
    activityKey: stableKeySchema,
    activityType: z.enum(['writing', 'reflection', 'practice', 'project']),
    kind: z.literal('EXERCISE'),
  })
  .strict();

const stageAssessmentCorrectionTargetSchema = z
  .object({
    activityKey: stableKeySchema,
    activityType: z.enum([
      'project',
      'case_study',
      'written_assignment',
      'practical_exercise',
      'oral',
      'simulation',
      'cumulative_exam',
    ]),
    kind: z.literal('STAGE_ASSESSMENT'),
  })
  .strict();

const correctionTargetSchema = z.discriminatedUnion('kind', [
  exerciseCorrectionTargetSchema,
  stageAssessmentCorrectionTargetSchema,
]);

export const legacyCorrectionRubricSchema = z
  .array(
    z
      .object({
        criterion: z.string().trim().min(1),
        requirements: z.array(z.string().trim().min(1)).min(1),
        weight: z.number().int().positive().max(100),
      })
      .strict(),
  )
  .min(1)
  .refine(
    (rubric) =>
      rubric.reduce((total, criterion) => total + criterion.weight, 0) === 100,
    'Legacy rubric weights must total exactly 100.',
  );

const performanceLevelSchema = z
  .object({
    description: z.string().trim().min(1),
    key: stableKeySchema,
    label: z.string().trim().min(1),
    score: z.number().int().min(0).max(100),
  })
  .strict();

const calibratedExampleSchema = z
  .object({
    expectedLevelKey: stableKeySchema,
    rationale: z.string().trim().min(1),
    responseExcerpt: z.string().trim().min(1),
  })
  .strict();

const correctionCriterionSchema = z
  .object({
    acceptableVariants: z.array(z.string().trim().min(1)).default([]),
    calibratedExamples: z.array(calibratedExampleSchema).default([]),
    commonErrors: z.array(z.string().trim().min(1)).default([]),
    expectedElements: z.array(z.string().trim().min(1)).min(1),
    key: stableKeySchema,
    label: z.string().trim().min(1),
    objective: z.string().trim().min(1),
    performanceLevels: z.array(performanceLevelSchema).min(2),
    weight: z.number().int().positive().max(100),
  })
  .strict()
  .superRefine((criterion, context) => {
    const levelKeys = new Set<string>();
    const levelScores = new Set<number>();

    criterion.performanceLevels.forEach((level, index) => {
      if (levelKeys.has(level.key)) {
        context.addIssue({
          code: 'custom',
          message: 'Performance level keys must be unique within a criterion.',
          path: ['performanceLevels', index, 'key'],
        });
      }
      if (levelScores.has(level.score)) {
        context.addIssue({
          code: 'custom',
          message:
            'Performance level scores must be unique within a criterion.',
          path: ['performanceLevels', index, 'score'],
        });
      }
      levelKeys.add(level.key);
      levelScores.add(level.score);
    });

    criterion.calibratedExamples.forEach((example, index) => {
      if (!levelKeys.has(example.expectedLevelKey)) {
        context.addIssue({
          code: 'custom',
          message: 'A calibrated example must reference a performance level.',
          path: ['calibratedExamples', index, 'expectedLevelKey'],
        });
      }
    });
  });

const authorizedReferenceSchema = z
  .object({
    locator: z.string().trim().min(1).optional(),
    referenceId: z.string().trim().min(1),
  })
  .strict();

const secondPassPolicySchema = z
  .object({
    confidenceThreshold: z.number().min(0).max(1),
    enabled: z.boolean(),
    maxPasses: z.literal(2),
    triggers: z
      .array(
        z.enum([
          'LOW_CONFIDENCE',
          'CRITERION_DISAGREEMENT',
          'OUTPUT_VALIDATION_WARNING',
        ]),
      )
      .min(1),
  })
  .strict();

const correctionContractLifecycleSchema = z.discriminatedUnion('status', [
  z
    .object({
      publishedAt: z.null(),
      status: z.literal('DRAFT'),
    })
    .strict(),
  z
    .object({
      publishedAt: z.iso.datetime({ offset: true }),
      status: z.literal('PUBLISHED'),
    })
    .strict(),
]);

export const correctionContractSchema = z
  .object({
    authorizedReferences: z.array(authorizedReferenceSchema).default([]),
    contractKey: stableKeySchema,
    criteria: z.array(correctionCriterionSchema).min(1),
    evidence: z
      .object({
        acceptedKinds: z.array(correctionEvidenceKindSchema).min(1),
        primaryKind: correctionEvidenceKindSchema,
      })
      .strict(),
    lifecycle: correctionContractLifecycleSchema,
    objectives: z.array(z.string().trim().min(1)).min(1),
    passingScore: z.number().int().min(0).max(100),
    schemaVersion: z.literal(1),
    secondPass: secondPassPolicySchema,
    target: correctionTargetSchema,
    version: semanticVersionSchema,
  })
  .strict()
  .superRefine((contract, context) => {
    const criterionKeys = new Set<string>();
    const totalWeight = contract.criteria.reduce(
      (total, criterion) => total + criterion.weight,
      0,
    );

    if (totalWeight !== 100) {
      context.addIssue({
        code: 'custom',
        message: 'Correction criterion weights must total exactly 100.',
        path: ['criteria'],
      });
    }

    contract.criteria.forEach((criterion, index) => {
      if (criterionKeys.has(criterion.key)) {
        context.addIssue({
          code: 'custom',
          message: 'Correction criterion keys must be unique.',
          path: ['criteria', index, 'key'],
        });
      }
      criterionKeys.add(criterion.key);
    });

    if (
      !contract.evidence.acceptedKinds.includes(contract.evidence.primaryKind)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'The primary evidence kind must be accepted by the contract.',
        path: ['evidence', 'primaryKind'],
      });
    }
  });

const criterionCorrectionSchema = z
  .object({
    confidence: z.number().min(0).max(1),
    criterionKey: stableKeySchema,
    evidenceQuotes: z.array(z.string().trim().min(1)).min(1),
    feedback: z.string().trim().min(1),
    levelKey: stableKeySchema,
  })
  .strict();

const secondPassOutputSchema = z
  .object({
    reasons: z.array(z.string().trim().min(1)),
    required: z.boolean(),
  })
  .strict()
  .superRefine((secondPass, context) => {
    if (secondPass.required && secondPass.reasons.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'A required second pass must include at least one reason.',
        path: ['reasons'],
      });
    }
    if (!secondPass.required && secondPass.reasons.length > 0) {
      context.addIssue({
        code: 'custom',
        message:
          'Second-pass reasons require the pass to be marked as required.',
        path: ['reasons'],
      });
    }
  });

export const correctionOutputSchema = z
  .object({
    contractKey: stableKeySchema,
    contractVersion: semanticVersionSchema,
    criteria: z.array(criterionCorrectionSchema).min(1),
    overallConfidence: z.number().min(0).max(1),
    overallFeedback: z.string().trim().min(1),
    secondPass: secondPassOutputSchema,
  })
  .strict();

export type CorrectionContract = z.infer<typeof correctionContractSchema>;
export type CorrectionOutput = z.infer<typeof correctionOutputSchema>;

const protocol3FoundCriterionSchema = z
  .object({
    confidence: z.number().min(0).max(1),
    evidenceQuotes: z.array(z.string().trim().min(1)).min(1),
    evidenceStatus: z.literal('FOUND'),
    feedback: z.string().trim().min(1),
    levelKey: stableKeySchema,
  })
  .strict();

const protocol3NoEvidenceCriterionSchema = z
  .object({
    confidence: z.number().min(0).max(1),
    evidenceQuotes: z.array(z.string()).length(0),
    evidenceStatus: z.literal('NO_RELEVANT_EVIDENCE'),
    feedback: z.string().trim().min(1),
    levelKey: stableKeySchema,
  })
  .strict();

const protocol3CriterionSchema = z.discriminatedUnion('evidenceStatus', [
  protocol3FoundCriterionSchema,
  protocol3NoEvidenceCriterionSchema,
]);

const protocol3ArtifactFoundCriterionSchema = protocol3FoundCriterionSchema
  .extend({ criterionKey: stableKeySchema })
  .strict();
const protocol3ArtifactNoEvidenceCriterionSchema =
  protocol3NoEvidenceCriterionSchema
    .extend({ criterionKey: stableKeySchema })
    .strict();

export const protocol3CorrectionArtifactOutputSchema = z
  .object({
    contractKey: stableKeySchema,
    contractVersion: semanticVersionSchema,
    criteria: z
      .array(
        z.discriminatedUnion('evidenceStatus', [
          protocol3ArtifactFoundCriterionSchema,
          protocol3ArtifactNoEvidenceCriterionSchema,
        ]),
      )
      .min(1),
    overallConfidence: z.number().min(0).max(1),
    overallFeedback: z.string().trim().min(1),
    secondPass: secondPassOutputSchema,
  })
  .strict();

export type Protocol3CorrectionArtifactOutput = z.infer<
  typeof protocol3CorrectionArtifactOutputSchema
>;

export function buildProtocol3CorrectionOutputSchema(contractInput: unknown) {
  const contract = correctionContractSchema.parse(contractInput);
  const criteriaShape = Object.fromEntries(
    contract.criteria.map((criterion) => [
      criterion.key,
      protocol3CriterionSchema,
    ]),
  );
  return z
    .object({
      criteria: z.object(criteriaShape).strict(),
      overallFeedback: z.string().trim().min(1),
    })
    .strict();
}

export function buildProtocol3TransportJsonSchema(
  contractInput: unknown,
): Record<string, unknown> {
  const contract = correctionContractSchema.parse(contractInput);
  const criterionProperties = Object.fromEntries(
    contract.criteria.map((criterion) => [
      criterion.key,
      {
        additionalProperties: false,
        properties: {
          confidence: { type: 'number' },
          evidenceQuotes: { items: { type: 'string' }, type: 'array' },
          evidenceStatus: {
            enum: ['FOUND', 'NO_RELEVANT_EVIDENCE'],
            type: 'string',
          },
          feedback: { type: 'string' },
          levelKey: {
            enum: criterion.performanceLevels.map((level) => level.key),
            type: 'string',
          },
        },
        required: [
          'confidence',
          'evidenceQuotes',
          'evidenceStatus',
          'feedback',
          'levelKey',
        ],
        type: 'object',
      },
    ]),
  );
  return {
    additionalProperties: false,
    properties: {
      criteria: {
        additionalProperties: false,
        properties: criterionProperties,
        required: contract.criteria.map((criterion) => criterion.key),
        type: 'object',
      },
      overallFeedback: { type: 'string' },
    },
    required: ['criteria', 'overallFeedback'],
    type: 'object',
  };
}

type Protocol3CorrectionOutput = {
  criteria: Record<string, z.infer<typeof protocol3CriterionSchema>>;
  overallFeedback: string;
};

export function canonicalizeProtocol3CorrectionOutput(input: {
  contract: unknown;
  output: unknown;
}): Protocol3CorrectionArtifactOutput {
  const contract = correctionContractSchema.parse(input.contract);
  const parsed = buildProtocol3CorrectionOutputSchema(contract).parse(
    input.output,
  ) as Protocol3CorrectionOutput;
  const criteria = contract.criteria.map((criterion) => {
    const result = parsed.criteria[criterion.key];
    if (!result) {
      throw new Error('PROTOCOL_3_CRITERION_MISSING');
    }
    if (
      !criterion.performanceLevels.some(
        (level) => level.key === result.levelKey,
      )
    ) {
      throw new Error('PROTOCOL_3_LEVEL_UNKNOWN');
    }
    const lowestScore = Math.min(
      ...criterion.performanceLevels.map((level) => level.score),
    );
    const selectedLevel = criterion.performanceLevels.find(
      (level) => level.key === result.levelKey,
    );
    if (
      result.evidenceStatus === 'NO_RELEVANT_EVIDENCE' &&
      selectedLevel?.score !== lowestScore
    ) {
      throw new Error('PROTOCOL_3_NO_EVIDENCE_LEVEL_INCONSISTENT');
    }
    return {
      confidence: result.confidence,
      criterionKey: criterion.key,
      evidenceQuotes: result.evidenceQuotes,
      evidenceStatus: result.evidenceStatus,
      feedback: result.feedback,
      levelKey: result.levelKey,
    };
  });
  const overallConfidence =
    criteria.reduce((total, result) => {
      const criterion = contract.criteria.find(
        (item) => item.key === result.criterionKey,
      );
      return total + result.confidence * (criterion?.weight ?? 0);
    }, 0) / 100;
  const base: Protocol3CorrectionArtifactOutput = {
    contractKey: contract.contractKey,
    contractVersion: contract.version,
    criteria,
    overallConfidence,
    overallFeedback: parsed.overallFeedback,
    secondPass: { reasons: [], required: false },
  };
  return {
    ...base,
    secondPass: deriveCorrectionSecondPassDecision({
      contract,
      evaluations: [base as CorrectionOutput],
    }),
  };
}

type CorrectionSecondPassSignal =
  'LOW_CONFIDENCE' | 'CRITERION_DISAGREEMENT' | 'OUTPUT_VALIDATION_WARNING';

export type CorrectionSecondPassDecision = {
  reasons: CorrectionSecondPassSignal[];
  required: boolean;
};

export type CorrectionSecondPassGateMetrics = {
  falseNegativeRate: number;
  falsePositiveRate: number;
};

export function deriveCorrectionSecondPassDecision(input: {
  contract: CorrectionContract;
  evaluations: CorrectionOutput[];
  outputValidationWarning?: boolean;
}): CorrectionSecondPassDecision {
  if (!input.contract.secondPass.enabled || input.evaluations.length === 0) {
    return { reasons: [], required: false };
  }

  const configuredTriggers = new Set(input.contract.secondPass.triggers);
  const reasons: CorrectionSecondPassSignal[] = [];
  const lowestConfidence = Math.min(
    ...input.evaluations.flatMap((evaluation) => [
      evaluation.overallConfidence,
      ...evaluation.criteria.map((criterion) => criterion.confidence),
    ]),
  );
  if (
    configuredTriggers.has('LOW_CONFIDENCE') &&
    lowestConfidence < input.contract.secondPass.confidenceThreshold
  ) {
    reasons.push('LOW_CONFIDENCE');
  }

  const levelsByCriterion = new Map<string, Set<string>>();
  for (const evaluation of input.evaluations) {
    for (const criterion of evaluation.criteria) {
      const levels = levelsByCriterion.get(criterion.criterionKey) ?? new Set();
      levels.add(criterion.levelKey);
      levelsByCriterion.set(criterion.criterionKey, levels);
    }
  }
  if (
    configuredTriggers.has('CRITERION_DISAGREEMENT') &&
    [...levelsByCriterion.values()].some((levels) => levels.size > 1)
  ) {
    reasons.push('CRITERION_DISAGREEMENT');
  }
  if (
    configuredTriggers.has('OUTPUT_VALIDATION_WARNING') &&
    input.outputValidationWarning === true
  ) {
    reasons.push('OUTPUT_VALIDATION_WARNING');
  }

  return { reasons, required: reasons.length > 0 };
}

export function evaluateCorrectionSecondPassGate(
  cases: Array<{
    actual: CorrectionSecondPassDecision;
    expectedRequired: boolean;
  }>,
): CorrectionSecondPassGateMetrics {
  const expectedPositive = cases.filter((entry) => entry.expectedRequired);
  const expectedNegative = cases.filter((entry) => !entry.expectedRequired);
  return {
    falseNegativeRate:
      expectedPositive.length === 0
        ? 0
        : expectedPositive.filter((entry) => !entry.actual.required).length /
          expectedPositive.length,
    falsePositiveRate:
      expectedNegative.length === 0
        ? 0
        : expectedNegative.filter((entry) => entry.actual.required).length /
          expectedNegative.length,
  };
}

export type CorrectionContractRuntimeEligibility =
  | { eligible: true; contract: CorrectionContract }
  | { eligible: false; reasons: string[] };

export function getCorrectionContractRuntimeEligibility(
  input: unknown,
): CorrectionContractRuntimeEligibility {
  const parsed = correctionContractSchema.safeParse(input);

  if (!parsed.success) {
    return { eligible: false, reasons: ['INVALID_CONTRACT'] };
  }

  const reasons: string[] = [];
  const contract = parsed.data;

  if (contract.lifecycle.status !== 'PUBLISHED') {
    reasons.push('CONTRACT_NOT_PUBLISHED');
  }
  if (
    contract.evidence.primaryKind !== 'TEXT' ||
    contract.evidence.acceptedKinds.some((kind) => kind !== 'TEXT')
  ) {
    reasons.push('EVIDENCE_KIND_NOT_SUPPORTED');
  }
  if (
    contract.target.kind === 'STAGE_ASSESSMENT' &&
    contract.target.activityType === 'oral'
  ) {
    reasons.push('ACTIVITY_TYPE_NOT_SUPPORTED');
  }

  return reasons.length > 0
    ? { eligible: false, reasons }
    : { contract, eligible: true };
}

export function assertPublishedCorrectionContractIsImmutable(
  previousInput: unknown,
  candidateInput: unknown,
): void {
  const previous = correctionContractSchema.parse(previousInput);
  const candidate = correctionContractSchema.parse(candidateInput);

  if (
    previous.lifecycle.status === 'PUBLISHED' &&
    previous.contractKey === candidate.contractKey &&
    previous.version === candidate.version &&
    JSON.stringify(previous) !== JSON.stringify(candidate)
  ) {
    throw new Error(
      'A published correction contract version cannot be modified.',
    );
  }
}

export function validateCorrectionOutputForContract(input: {
  contract: unknown;
  output: unknown;
}): CorrectionOutput {
  const contract = correctionContractSchema.parse(input.contract);
  const output = correctionOutputSchema.parse(input.output);

  if (
    output.contractKey !== contract.contractKey ||
    output.contractVersion !== contract.version
  ) {
    throw new Error(
      'Correction output references a different contract version.',
    );
  }

  const correctionsByCriterion = new Map(
    output.criteria.map((criterion) => [criterion.criterionKey, criterion]),
  );

  if (
    correctionsByCriterion.size !== contract.criteria.length ||
    output.criteria.length !== contract.criteria.length
  ) {
    throw new Error(
      'Correction output must assess every criterion exactly once.',
    );
  }

  contract.criteria.forEach((criterion) => {
    const correction = correctionsByCriterion.get(criterion.key);
    if (!correction) {
      throw new Error(
        'Correction output must assess every criterion exactly once.',
      );
    }
    if (
      !criterion.performanceLevels.some(
        (level) => level.key === correction.levelKey,
      )
    ) {
      throw new Error(
        'Correction output references an unknown performance level.',
      );
    }
  });

  return output;
}
