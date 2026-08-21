import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  compileExecutableRubric,
  type CompiledExecutableRubric,
} from './executable-rubric-engine.js';

const stableKeySchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const levelKeySchema = z.enum(['insufficient', 'partial', 'mastered']);
const frameworkSchema = z.enum(['PICO', 'PECO', 'SPIDER', 'PCC']);

export const atomicEvidenceStatusV2Schema = z.enum([
  'SUPPORTED',
  'NOT_DEMONSTRATED',
  'EXPLICITLY_REFUTED',
  'CONTRADICTED',
  'AMBIGUOUS',
]);

const resolvedAtomicEvidenceStatusV2Schema =
  atomicEvidenceStatusV2Schema.exclude(['AMBIGUOUS']);

const contradictionKindSchema = z.enum([
  'INTERNAL_CONFLICT',
  'CONTEXT_MISMATCH',
  'FRAMEWORK_MAPPING_MISMATCH',
]);

export const evidenceSpanV2Schema = z
  .object({
    end: z.number().int().positive(),
    sha256: sha256Schema,
    start: z.number().int().nonnegative(),
    text: z.string().min(1),
  })
  .strict()
  .refine(({ end, start }) => end > start, {
    message: 'Evidence span end must be greater than start.',
    path: ['end'],
  });

const relationBindingV2Schema = z
  .object({
    evidenceSpans: z.array(evidenceSpanV2Schema).min(1).max(8),
    role: z.string().trim().min(1),
  })
  .strict();

const frameworkConditionEvidenceV2Schema = z
  .object({
    conditionKey: stableKeySchema,
    evidenceSpans: z.array(evidenceSpanV2Schema).min(1).max(8),
  })
  .strict();

const supportedCountConditionSchema = z
  .object({
    ignoreBlockedDependencies: z.boolean().optional(),
    supportedCount: z
      .object({
        maximum: z.number().int().nonnegative(),
        minimum: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict()
  .refine(
    ({ supportedCount }) =>
      supportedCount.maximum >= supportedCount.minimum,
    { message: 'supportedCount maximum must be greater than its minimum.' },
  );

const levelConditionAtomSchema = z.union([
  z.object({ allOfSupported: z.array(stableKeySchema).min(1) }).strict(),
  supportedCountConditionSchema,
  z
    .object({
      groupSupportedCount: z
        .object({
          exactly: z.number().int().nonnegative(),
          groupKey: stableKeySchema,
        })
        .strict(),
    })
    .strict(),
  z.object({ hasUnresolvedContextMismatch: z.boolean() }).strict(),
]);

const levelConditionSchema = z.union([
  levelConditionAtomSchema,
  z.object({ allOf: z.array(levelConditionAtomSchema).min(1) }).strict(),
  z.object({ anyOf: z.array(levelConditionAtomSchema).min(1) }).strict(),
]);

const criterionSchema = z
  .object({
    description: z.string().trim().min(1),
    elementKeys: z.array(stableKeySchema).min(1),
    evaluationOrder: z.array(levelKeySchema).length(3),
    key: stableKeySchema,
    label: z.string().trim().min(1),
    levels: z
      .array(
        z
          .object({
            key: levelKeySchema,
            when: levelConditionSchema,
          })
          .strict(),
      )
      .length(3),
    contextMismatchPolicy: z
      .literal('FORCE_INSUFFICIENT_ONCE_PER_SCENARIO')
      .optional(),
    whenNoEvaluableElements: z.literal('BLOCKED_BY_DEPENDENCY').optional(),
  })
  .strict();

const evidenceRuleV2Schema = z
  .object({
    contextMismatchObjectsAllowed: z.boolean().optional(),
    exactResponseSpansRequired: z.literal(true),
    maximumSpans: z.number().int().positive().max(8),
    minimumSpans: z.number().int().nonnegative().max(8),
    relationRoles: z.array(z.string().trim().min(1)).min(2).optional(),
    trustedClaimReferenceRequired: z.literal(true).optional(),
  })
  .strict()
  .refine(({ maximumSpans, minimumSpans }) => maximumSpans >= minimumSpans, {
    message: 'maximumSpans must be greater than or equal to minimumSpans.',
    path: ['maximumSpans'],
  });

const dependencySchema = z.union([
  z
    .object({
      elementKey: stableKeySchema,
      whenUnsatisfied: z.literal('BLOCKED_BY_DEPENDENCY'),
    })
    .strict(),
  z
    .object({
      responsePropertyScenarioKey: stableKeySchema,
      whenEmpty: z.literal('BLOCKED_BY_DEPENDENCY'),
    })
    .strict(),
]);

const elementSchema = z
  .object({
    acceptableVariants: z.array(z.string().trim().min(1)).min(1),
    ambiguousResolutions: z
      .array(resolvedAtomicEvidenceStatusV2Schema)
      .min(2),
    contradictionKinds: z.array(contradictionKindSchema),
    dependsOn: dependencySchema.optional(),
    distinctEvidenceGroup: stableKeySchema.optional(),
    evidenceRule: evidenceRuleV2Schema,
    excludedCriterionKeys: z.array(stableKeySchema),
    explicitRefutationEnabled: z.boolean(),
    key: stableKeySchema,
    negativeExamples: z.array(z.string().trim().min(1)).min(1),
    obligation: z.enum(['REQUIRED', 'SUPPORTING']),
    ownerCriterionKey: stableKeySchema,
    positiveExamples: z.array(z.string().trim().min(1)).min(1),
    remediation: z
      .object({
        completionEvidence: z.string().trim().min(1),
        learnerAction: z.string().trim().min(1),
      })
      .strict(),
    scenarioKey: stableKeySchema,
    sharedWithCriterionKeys: z.array(stableKeySchema),
    templates: z
      .object({
        ambiguous: z.string().trim().min(1),
        contradicted: z.string().trim().min(1),
        explicitlyRefuted: z.string().trim().min(1),
        notDemonstrated: z.string().trim().min(1),
        supported: z.string().trim().min(1),
      })
      .strict(),
    trustedClaimGroup: stableKeySchema.optional(),
    type: z.enum(['FACT', 'RELATION', 'JUSTIFICATION', 'CONTRADICTION', 'HOLISTIC']),
  })
  .strict();

const trustedScenarioSchema = z
  .object({
    claims: z
      .array(
        z
          .object({
            key: stableKeySchema,
            text: z.string().trim().min(1),
          })
          .strict(),
      )
      .min(1),
    key: stableKeySchema,
    text: z.string().min(1),
    textSha256: sha256Schema,
  })
  .strict();

const evidenceGroupSchema = z
  .object({
    canonicalOrder: z.literal('TRUSTED_CLAIM_KEY_THEN_RESPONSE_OFFSET'),
    deduplicateRefusalAndContradictionFeedback: z.literal(true),
    elementKeys: z.array(stableKeySchema).min(2),
    key: stableKeySchema,
    minimumDistinctClaimsForMastered: z.number().int().positive(),
  })
  .strict();

const frameworkConditionalRuleSchema = z
  .object({
    description: z.string().trim().min(1),
    requiredConditionKeys: z.array(stableKeySchema).min(1),
  })
  .strict();

export const executableRubricV2Schema = z
  .object({
    activityBinding: z
      .object({
        activityKey: stableKeySchema,
        lessonKey: stableKeySchema,
        moduleKey: stableKeySchema,
        programKey: stableKeySchema,
        prompt: z
          .object({ sha256: sha256Schema, text: z.string().min(1) })
          .strict(),
        publicationBindingStatus: z.literal(
          'PENDING_VERSIONED_PEDAGOGY_CHANGE',
        ),
        publishedProgramVersionChecksum: sha256Schema.nullable(),
        publishedProgramVersionId: z.string().trim().min(1).nullable(),
        seedSha256: sha256Schema,
        specificationPath: z.string().trim().min(1),
        specificationSha256: sha256Schema,
        specificationVersion: z.string().trim().min(1),
        stageKey: stableKeySchema,
      })
      .strict(),
    approval: z
      .object({
        approvedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
        gate: z.literal('Rayan B'),
        scope: z.string().trim().min(1),
        status: z.literal('APPROVED_INPUT_V4_002C'),
      })
      .strict(),
    compilationStatus: z.literal('NOT_COMPILED'),
    compilationTarget: z.literal('FULLY_COMPILABLE'),
    criteria: z.array(criterionSchema).min(1).max(12),
    elements: z.array(elementSchema).min(1).max(64),
    evidenceGroups: z.array(evidenceGroupSchema),
    frameworkPolicy: z
      .object({
        knownFrameworks: z.array(frameworkSchema).min(1),
        lexicalVariants: z.record(
          frameworkSchema,
          z.array(z.string().trim().min(1)).min(1),
        ),
        scenarioMappings: z.array(
          z
            .object({
              acceptedFrameworks: z.array(frameworkSchema).min(1),
              conditionalRules: z.record(
                z.string(),
                frameworkConditionalRuleSchema,
              ),
              referenceFramework: frameworkSchema,
              rejectedUnlessReauthored: z.array(frameworkSchema),
              scenarioKey: stableKeySchema,
            })
            .strict(),
        ),
      })
      .strict(),
    language: z.literal('fr-FR'),
    lifecycle: z.literal('DRAFT'),
    modality: z.literal('WRITING'),
    modelAuthorityPolicy: z
      .object({
        evidenceAuthority: z.literal('CANDIDATE_ONLY'),
        feedbackAuthority: z.literal('NONE'),
        levelAuthority: z.literal('NONE'),
        masteryEffect: z.literal('NONE'),
        progressionEffect: z.literal('NONE'),
        scoreAuthority: z.literal('NONE'),
      })
      .strict(),
    progressionAuthority: z.literal('NONE'),
    publicationPolicy: z
      .object({
        contractMayPublishBeforeCompilation: z.literal(false),
        requiresPublishedProgramVersionBinding: z.literal(true),
        requiresRayanB: z.literal(false),
        requiresV4002C: z.literal(true),
        requiresVersionedPedagogyChange: z.literal(true),
      })
      .strict(),
    resolutionPolicy: z
      .object({
        ambiguousResolutionMode: z.literal('ENUMERATE_ALL'),
        dependencyState: z.literal('BLOCKED_BY_DEPENDENCY'),
        explicitlyRefutedLevelEffect: z.literal(
          'SAME_AS_NOT_DEMONSTRATED_FOR_POSITIVE_ELEMENTS',
        ),
        feedbackDeduplication: z.literal('OWNER_AND_ROOT_CAUSE'),
        materialAmbiguityState: z.literal('CLARIFICATION_REQUIRED'),
      })
      .strict(),
    riskLevel: z.literal('LOW'),
    rubricKey: stableKeySchema,
    rubricVersion: z.string().trim().min(1),
    ruleSetVersion: z.string().trim().min(1),
    schemaVersion: z.literal(2),
    scorePolicy: z
      .object({
        indicativeScoreEnabled: z.literal(false),
        publishExactScoreWhenAmbiguousLevelIsStable: z.literal(false),
      })
      .strict(),
    trustedContext: z
      .object({ scenarios: z.array(trustedScenarioSchema).min(1) })
      .strict(),
  })
  .strict();

export type ExecutableRubricV2 = z.infer<typeof executableRubricV2Schema>;
export type AtomicEvidenceStatusV2 = z.infer<
  typeof atomicEvidenceStatusV2Schema
>;
type ResolvedAtomicEvidenceStatusV2 = z.infer<
  typeof resolvedAtomicEvidenceStatusV2Schema
>;
export type EvidenceSpanV2 = z.infer<typeof evidenceSpanV2Schema>;

export type CompiledExecutableRubricV2 = {
  certificateVersion: 2;
  compilationStatus: 'COMPILED_OFFLINE';
  rubric: ExecutableRubricV2;
  rubricFingerprint: string;
};

export class RubricV2CompilationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'RubricV2CompilationError';
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalize(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(canonicalize);
  if (input && typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => [key, canonicalize(value)]),
    );
  }
  return input;
}

export function rubricFingerprintV2(rubric: ExecutableRubricV2): string {
  return sha256(JSON.stringify(canonicalize(rubric)));
}

function fail(code: string, message: string): never {
  throw new RubricV2CompilationError(code, `${code}: ${message}`);
}

function requireValue<T>(value: T | undefined, code: string): T {
  if (value === undefined) fail(code, 'Required value is missing.');
  return value;
}

function assertUnique(values: string[], code: string): void {
  if (new Set(values).size !== values.length) {
    fail(code, 'Stable keys must be unique.');
  }
}

function allCombinations<T>(optionsByPosition: T[][]): T[][] {
  let combinations: T[][] = [[]];
  for (const options of optionsByPosition) {
    combinations = combinations.flatMap((combination) =>
      options.map((option) => [...combination, option]),
    );
    if (combinations.length > 100_000) {
      fail(
        'COMPILATION_STATE_SPACE_TOO_LARGE',
        'The rubric produces more than 100,000 states.',
      );
    }
  }
  return combinations;
}

type EvaluationStatus =
  | ResolvedAtomicEvidenceStatusV2
  | 'BLOCKED_BY_DEPENDENCY';

type EvaluationContext = {
  contextMismatch: boolean;
  criterion: ExecutableRubricV2['criteria'][number];
  groupsByKey: Map<string, ExecutableRubricV2['evidenceGroups'][number]>;
  statuses: Map<string, EvaluationStatus>;
};

function conditionElementKeys(
  condition: z.infer<typeof levelConditionSchema>,
): string[] {
  if ('allOfSupported' in condition) return condition.allOfSupported;
  if ('groupSupportedCount' in condition) return [];
  if ('supportedCount' in condition) return [];
  if ('hasUnresolvedContextMismatch' in condition) return [];
  const children = 'allOf' in condition ? condition.allOf : condition.anyOf;
  return children.flatMap(conditionElementKeys);
}

function conditionGroupKeys(
  condition: z.infer<typeof levelConditionSchema>,
): string[] {
  if ('groupSupportedCount' in condition) {
    return [condition.groupSupportedCount.groupKey];
  }
  if (
    'allOfSupported' in condition ||
    'supportedCount' in condition ||
    'hasUnresolvedContextMismatch' in condition
  ) {
    return [];
  }
  const children = 'allOf' in condition ? condition.allOf : condition.anyOf;
  return children.flatMap(conditionGroupKeys);
}

function evaluableStatuses(context: EvaluationContext): EvaluationStatus[] {
  return context.criterion.elementKeys
    .map((key) => requireValue(context.statuses.get(key), 'MISSING_ELEMENT_STATUS'))
    .filter((status) => status !== 'BLOCKED_BY_DEPENDENCY');
}

function evaluateConditionAtom(
  condition: z.infer<typeof levelConditionAtomSchema>,
  context: EvaluationContext,
): boolean {
  if ('allOfSupported' in condition) {
    return condition.allOfSupported.every(
      (key) => context.statuses.get(key) === 'SUPPORTED',
    );
  }
  if ('supportedCount' in condition) {
    const statuses = condition.ignoreBlockedDependencies
      ? evaluableStatuses(context)
      : context.criterion.elementKeys.map((key) =>
          requireValue(context.statuses.get(key), 'MISSING_ELEMENT_STATUS'),
        );
    const count = statuses.filter((status) => status === 'SUPPORTED').length;
    return (
      count >= condition.supportedCount.minimum &&
      count <= condition.supportedCount.maximum
    );
  }
  if ('groupSupportedCount' in condition) {
    const group = requireValue(
      context.groupsByKey.get(condition.groupSupportedCount.groupKey),
      'UNKNOWN_EVIDENCE_GROUP',
    );
    const count = group.elementKeys.filter(
      (key) => context.statuses.get(key) === 'SUPPORTED',
    ).length;
    return count === condition.groupSupportedCount.exactly;
  }
  return (
    context.contextMismatch === condition.hasUnresolvedContextMismatch
  );
}

function evaluateCondition(
  condition: z.infer<typeof levelConditionSchema>,
  context: EvaluationContext,
): boolean {
  if ('allOf' in condition) {
    return condition.allOf.every((item) =>
      evaluateConditionAtom(item, context),
    );
  }
  if ('anyOf' in condition) {
    return condition.anyOf.some((item) =>
      evaluateConditionAtom(item, context),
    );
  }
  return evaluateConditionAtom(condition, context);
}

function matchingLevelKeys(input: {
  contextMismatch: boolean;
  criterion: ExecutableRubricV2['criteria'][number];
  groupsByKey: Map<string, ExecutableRubricV2['evidenceGroups'][number]>;
  statuses: Map<string, EvaluationStatus>;
}): Array<z.infer<typeof levelKeySchema>> {
  if (
    input.criterion.whenNoEvaluableElements === 'BLOCKED_BY_DEPENDENCY' &&
    evaluableStatuses(input).length === 0
  ) {
    return [];
  }
  return input.criterion.evaluationOrder.filter((levelKey) => {
    const level = requireValue(
      input.criterion.levels.find(({ key }) => key === levelKey),
      'MISSING_CRITERION_LEVEL',
    );
    return evaluateCondition(level.when, input);
  });
}

type StaticStatus =
  | ResolvedAtomicEvidenceStatusV2
  | 'CONTEXT_MISMATCH';

const staticStatuses: StaticStatus[] = [
  'SUPPORTED',
  'NOT_DEMONSTRATED',
  'EXPLICITLY_REFUTED',
  'CONTRADICTED',
  'CONTEXT_MISMATCH',
];

function staticStatusMap(
  criterion: ExecutableRubricV2['criteria'][number],
  statuses: StaticStatus[],
): Map<string, EvaluationStatus> {
  return new Map(
    criterion.elementKeys.map((key, index) => {
      const status = requireValue(statuses.at(index), 'MISSING_STATIC_STATUS');
      return [
        key,
        status === 'CONTEXT_MISMATCH' ? 'CONTRADICTED' : status,
      ];
    }),
  );
}

function levelRank(levelKey: z.infer<typeof levelKeySchema>): number {
  return levelKeySchema.options.indexOf(levelKey);
}

function validateRuleReferences(input: {
  criterion: ExecutableRubricV2['criteria'][number];
  elementsByKey: Map<string, ExecutableRubricV2['elements'][number]>;
  groupsByKey: Map<string, ExecutableRubricV2['evidenceGroups'][number]>;
}): void {
  for (const level of input.criterion.levels) {
    for (const key of conditionElementKeys(level.when)) {
      if (!input.criterion.elementKeys.includes(key)) {
        fail(
          'CROSS_CRITERION_LEVEL_REFERENCE',
          `${input.criterion.key}/${level.key} references ${key}.`,
        );
      }
    }
    for (const groupKey of conditionGroupKeys(level.when)) {
      const group = input.groupsByKey.get(groupKey);
      if (
        !group ||
        group.elementKeys.some(
          (key) => !input.criterion.elementKeys.includes(key),
        )
      ) {
        fail(
          'INVALID_LEVEL_GROUP_REFERENCE',
          `${input.criterion.key}/${level.key} references ${groupKey}.`,
        );
      }
    }
  }
  for (const key of input.criterion.elementKeys) {
    if (!input.elementsByKey.has(key)) {
      fail('UNKNOWN_CRITERION_ELEMENT', `${input.criterion.key} references ${key}.`);
    }
  }
}

function validateCriterionStateSpace(input: {
  criterion: ExecutableRubricV2['criteria'][number];
  groupsByKey: Map<string, ExecutableRubricV2['evidenceGroups'][number]>;
}): void {
  const assignments = allCombinations(
    input.criterion.elementKeys.map(() => staticStatuses),
  );
  const reachable = new Set<string>();
  for (const assignment of assignments) {
    const statuses = staticStatusMap(input.criterion, assignment);
    const contextMismatch = assignment.includes('CONTEXT_MISMATCH');
    const levels = matchingLevelKeys({
      contextMismatch,
      criterion: input.criterion,
      groupsByKey: input.groupsByKey,
      statuses,
    });
    if (levels.length !== 1) {
      fail(
        levels.length === 0
          ? 'UNCOVERED_STATUS_COMBINATION'
          : 'OVERLAPPING_LEVEL_RULES',
        `${input.criterion.key} resolves ${levels.length} levels for ${assignment.join('|')}.`,
      );
    }
    const level = requireValue(levels.at(0), 'MISSING_MATCHED_LEVEL');
    reachable.add(level);
    if (
      level === 'mastered' &&
      assignment.some((status) => status !== 'SUPPORTED')
    ) {
      fail(
        'MASTERED_ALLOWS_INCOMPLETE_SCENARIO',
        `${input.criterion.key} reaches mastered without all required elements.`,
      );
    }

    assignment.forEach((status, index) => {
      if (status === 'SUPPORTED') return;
      const improved = [...assignment];
      improved[index] = 'SUPPORTED';
      const improvedLevels = matchingLevelKeys({
        contextMismatch: improved.includes('CONTEXT_MISMATCH'),
        criterion: input.criterion,
        groupsByKey: input.groupsByKey,
        statuses: staticStatusMap(input.criterion, improved),
      });
      if (improvedLevels.length !== 1) return;
      if (
        levelRank(requireValue(improvedLevels.at(0), 'MISSING_IMPROVED_LEVEL')) <
        levelRank(level)
      ) {
        fail(
          'NON_MONOTONIC_LEVEL_RULE',
          `${input.criterion.key} decreases when ${input.criterion.elementKeys[index]} becomes supported.`,
        );
      }
    });

    assignment.forEach((status, index) => {
      if (status !== 'NOT_DEMONSTRATED') return;
      const explicitlyRefuted = [...assignment];
      explicitlyRefuted[index] = 'EXPLICITLY_REFUTED';
      const refutedLevels = matchingLevelKeys({
        contextMismatch: explicitlyRefuted.includes('CONTEXT_MISMATCH'),
        criterion: input.criterion,
        groupsByKey: input.groupsByKey,
        statuses: staticStatusMap(input.criterion, explicitlyRefuted),
      });
      if (
        refutedLevels.length !== 1 ||
        requireValue(refutedLevels.at(0), 'MISSING_REFUTED_LEVEL') !== level
      ) {
        fail(
          'EXPLICIT_REFUTATION_LEVEL_EFFECT_MISMATCH',
          `${input.criterion.key} treats refusal differently from absence.`,
        );
      }
    });
  }
  for (const levelKey of levelKeySchema.options) {
    if (!reachable.has(levelKey)) {
      fail(
        'UNREACHABLE_LEVEL',
        `${input.criterion.key}/${levelKey} cannot be reached.`,
      );
    }
  }
}

function validateFrameworkPolicy(rubric: ExecutableRubricV2): void {
  assertUnique(rubric.frameworkPolicy.knownFrameworks, 'DUPLICATE_FRAMEWORK');
  const known = new Set(rubric.frameworkPolicy.knownFrameworks);
  const lexicalFrameworks = new Set(
    Object.keys(rubric.frameworkPolicy.lexicalVariants),
  );
  if (
    lexicalFrameworks.size !== known.size ||
    [...known].some((framework) => !lexicalFrameworks.has(framework))
  ) {
    fail('FRAMEWORK_LEXICON_MISMATCH', 'Lexical variants must match known frameworks.');
  }
  const scenarioKeys = new Set(
    rubric.trustedContext.scenarios.map(({ key }) => key),
  );
  assertUnique(
    rubric.frameworkPolicy.scenarioMappings.map(({ scenarioKey }) => scenarioKey),
    'DUPLICATE_FRAMEWORK_SCENARIO_MAPPING',
  );
  if (
    rubric.frameworkPolicy.scenarioMappings.length !== scenarioKeys.size ||
    [...scenarioKeys].some(
      (scenarioKey) =>
        !rubric.frameworkPolicy.scenarioMappings.some(
          (mapping) => mapping.scenarioKey === scenarioKey,
        ),
    )
  ) {
    fail(
      'INCOMPLETE_FRAMEWORK_SCENARIO_MAPPING',
      'Every trusted scenario requires exactly one framework mapping.',
    );
  }
  for (const mapping of rubric.frameworkPolicy.scenarioMappings) {
    if (!scenarioKeys.has(mapping.scenarioKey)) {
      fail('UNKNOWN_FRAMEWORK_SCENARIO', mapping.scenarioKey);
    }
    if (
      !known.has(mapping.referenceFramework) ||
      !mapping.acceptedFrameworks.includes(mapping.referenceFramework)
    ) {
      fail('INVALID_REFERENCE_FRAMEWORK', mapping.scenarioKey);
    }
    const partition = [
      ...mapping.acceptedFrameworks,
      ...mapping.rejectedUnlessReauthored,
    ];
    if (
      partition.some(
        (framework) => !known.has(framework),
      ) ||
      mapping.acceptedFrameworks.some((framework) =>
        mapping.rejectedUnlessReauthored.includes(framework),
      ) ||
      new Set(partition).size !== known.size ||
      [...known].some((framework) => !partition.includes(framework))
    ) {
      fail('INVALID_FRAMEWORK_PARTITION', mapping.scenarioKey);
    }
    const conditionalFrameworks = Object.keys(mapping.conditionalRules);
    const expectedConditionalFrameworks = mapping.acceptedFrameworks.filter(
      (framework) => framework !== mapping.referenceFramework,
    );
    if (
      conditionalFrameworks.some(
        (framework) =>
          !mapping.acceptedFrameworks.includes(
            framework as z.infer<typeof frameworkSchema>,
          ),
      )
    ) {
      fail('UNAUTHORIZED_FRAMEWORK_CONDITION', mapping.scenarioKey);
    }
    if (
      conditionalFrameworks.length !== expectedConditionalFrameworks.length ||
      expectedConditionalFrameworks.some(
        (framework) => !conditionalFrameworks.includes(framework),
      )
    ) {
      fail('INCOMPLETE_CONDITIONAL_FRAMEWORK_RULES', mapping.scenarioKey);
    }
    for (const rule of Object.values(mapping.conditionalRules)) {
      assertUnique(
        rule.requiredConditionKeys,
        'DUPLICATE_FRAMEWORK_CONDITION_KEY',
      );
    }
  }
}

function validateDependencies(
  rubric: ExecutableRubricV2,
  elementsByKey: Map<string, ExecutableRubricV2['elements'][number]>,
): void {
  for (const element of rubric.elements) {
    if (!element.dependsOn) continue;
    if ('elementKey' in element.dependsOn) {
      const dependency = elementsByKey.get(element.dependsOn.elementKey);
      if (!dependency) {
        fail('UNKNOWN_ELEMENT_DEPENDENCY', element.key);
      }
      if (dependency.scenarioKey !== element.scenarioKey) {
        fail('CROSS_SCENARIO_DEPENDENCY', element.key);
      }
      const visited = new Set([element.key]);
      let cursor: ExecutableRubricV2['elements'][number] | undefined = dependency;
      while (cursor?.dependsOn && 'elementKey' in cursor.dependsOn) {
        if (visited.has(cursor.key)) {
          fail('CYCLIC_ELEMENT_DEPENDENCY', element.key);
        }
        visited.add(cursor.key);
        cursor = elementsByKey.get(cursor.dependsOn.elementKey);
      }
    } else if (
      element.dependsOn.responsePropertyScenarioKey !== element.scenarioKey
    ) {
      fail('CROSS_SCENARIO_DEPENDENCY', element.key);
    }
  }
}

function validateGroups(input: {
  elementsByKey: Map<string, ExecutableRubricV2['elements'][number]>;
  groups: ExecutableRubricV2['evidenceGroups'];
}): void {
  assertUnique(input.groups.map(({ key }) => key), 'DUPLICATE_EVIDENCE_GROUP');
  for (const group of input.groups) {
    assertUnique(group.elementKeys, 'DUPLICATE_GROUP_ELEMENT');
    if (group.minimumDistinctClaimsForMastered !== group.elementKeys.length) {
      fail('INVALID_GROUP_DISTINCT_CLAIM_TARGET', group.key);
    }
    const elements = group.elementKeys.map((key) =>
      requireValue(input.elementsByKey.get(key), 'UNKNOWN_GROUP_ELEMENT'),
    );
    if (
      new Set(elements.map(({ scenarioKey }) => scenarioKey)).size !== 1 ||
      new Set(elements.map(({ ownerCriterionKey }) => ownerCriterionKey)).size !==
        1 ||
      elements.some(
        (element) =>
          element.distinctEvidenceGroup !== group.key ||
          element.evidenceRule.trustedClaimReferenceRequired !== true,
      )
    ) {
      fail('INVALID_EVIDENCE_GROUP_MEMBERSHIP', group.key);
    }
  }
}

function validateElementFeedbackPolicy(input: {
  element: ExecutableRubricV2['elements'][number];
  groupsByKey: Map<string, ExecutableRubricV2['evidenceGroups'][number]>;
}): void {
  const groupOnlyTemplates = Object.values(input.element.templates).filter(
    (template) => template === 'GROUP_MESSAGE_ONLY',
  );
  if (groupOnlyTemplates.length === 0) return;
  const group = input.element.distinctEvidenceGroup
    ? input.groupsByKey.get(input.element.distinctEvidenceGroup)
    : undefined;
  if (!group?.deduplicateRefusalAndContradictionFeedback) {
    fail(
      'UNSAFE_GROUP_ONLY_FEEDBACK_SENTINEL',
      `${input.element.key} can leak GROUP_MESSAGE_ONLY.`,
    );
  }
}

export function compileExecutableRubricV2(
  input: unknown,
): CompiledExecutableRubricV2 {
  const rubric = executableRubricV2Schema.parse(input);
  if (sha256(rubric.activityBinding.prompt.text) !== rubric.activityBinding.prompt.sha256) {
    fail('PROMPT_HASH_MISMATCH', rubric.activityBinding.activityKey);
  }
  assertUnique(
    rubric.trustedContext.scenarios.map(({ key }) => key),
    'DUPLICATE_SCENARIO_KEY',
  );
  const claimKeys: string[] = [];
  for (const scenario of rubric.trustedContext.scenarios) {
    if (sha256(scenario.text) !== scenario.textSha256) {
      fail('SCENARIO_HASH_MISMATCH', scenario.key);
    }
    assertUnique(
      scenario.claims.map(({ key }) => key),
      'DUPLICATE_SCENARIO_CLAIM',
    );
    claimKeys.push(...scenario.claims.map(({ key }) => key));
  }
  assertUnique(claimKeys, 'DUPLICATE_TRUSTED_CLAIM_KEY');

  assertUnique(rubric.criteria.map(({ key }) => key), 'DUPLICATE_CRITERION_KEY');
  assertUnique(rubric.elements.map(({ key }) => key), 'DUPLICATE_ELEMENT_KEY');
  if (
    rubric.rubricKey === 'v4-writing-framework-selection-fr' &&
    (rubric.criteria.length !== 3 || rubric.elements.length !== 10)
  ) {
    fail(
      'PILOT_STRUCTURE_MISMATCH',
      'The approved pilot requires exactly 3 criteria and 10 elements.',
    );
  }

  const criteriaByKey = new Map(
    rubric.criteria.map((criterion) => [criterion.key, criterion]),
  );
  const elementsByKey = new Map(
    rubric.elements.map((element) => [element.key, element]),
  );
  const groupsByKey = new Map(
    rubric.evidenceGroups.map((group) => [group.key, group]),
  );
  const scenarioKeys = new Set(
    rubric.trustedContext.scenarios.map(({ key }) => key),
  );
  const trustedClaimGroups = new Map(
    rubric.trustedContext.scenarios.map((scenario) => [
      `${scenario.key}-claims`,
      scenario.key,
    ]),
  );

  for (const criterion of rubric.criteria) {
    assertUnique(criterion.elementKeys, 'DUPLICATE_CRITERION_ELEMENT');
    assertUnique(criterion.evaluationOrder, 'DUPLICATE_LEVEL_EVALUATION_ORDER');
    assertUnique(
      criterion.levels.map(({ key }) => key),
      'DUPLICATE_CRITERION_LEVEL',
    );
    if (
      levelKeySchema.options.some(
        (key) => !criterion.evaluationOrder.includes(key),
      ) ||
      levelKeySchema.options.some(
        (key) => !criterion.levels.some((level) => level.key === key),
      )
    ) {
      fail('INCOMPLETE_CRITERION_LEVEL_SET', criterion.key);
    }
    validateRuleReferences({ criterion, elementsByKey, groupsByKey });
    for (const elementKey of criterion.elementKeys) {
      if (elementsByKey.get(elementKey)?.ownerCriterionKey !== criterion.key) {
        fail(
          'CRITERION_CONTAINS_FOREIGN_ELEMENT',
          `${criterion.key} cannot consume ${elementKey}.`,
        );
      }
    }
  }

  for (const element of rubric.elements) {
    const owner = criteriaByKey.get(element.ownerCriterionKey);
    if (!owner || !owner.elementKeys.includes(element.key)) {
      fail('UNKNOWN_OR_MISMATCHED_ELEMENT_OWNER', element.key);
    }
    if (!scenarioKeys.has(element.scenarioKey)) {
      fail('UNKNOWN_ELEMENT_SCENARIO', element.key);
    }
    if (element.sharedWithCriterionKeys.length > 0) {
      fail('SHARED_ELEMENT_NOT_AUTHORIZED_FOR_PILOT', element.key);
    }
    if (
      element.distinctEvidenceGroup &&
      !groupsByKey.has(element.distinctEvidenceGroup)
    ) {
      fail('UNKNOWN_ELEMENT_EVIDENCE_GROUP', element.key);
    }
    if (element.evidenceRule.trustedClaimReferenceRequired) {
      if (
        !element.trustedClaimGroup ||
        trustedClaimGroups.get(element.trustedClaimGroup) !==
          element.scenarioKey
      ) {
        fail('INVALID_ELEMENT_TRUSTED_CLAIM_GROUP', element.key);
      }
    } else if (element.trustedClaimGroup) {
      fail('UNEXPECTED_ELEMENT_TRUSTED_CLAIM_GROUP', element.key);
    }
    assertUnique(element.excludedCriterionKeys, 'DUPLICATE_EXCLUDED_CRITERION');
    const expectedExclusions = rubric.criteria
      .map(({ key }) => key)
      .filter((key) => key !== element.ownerCriterionKey)
      .sort();
    if (
      element.excludedCriterionKeys.slice().sort().join('|') !==
      expectedExclusions.join('|')
    ) {
      fail('INCOMPLETE_ELEMENT_EXCLUSIONS', element.key);
    }
    if (element.type === 'HOLISTIC') {
      fail('HOLISTIC_ELEMENT_NOT_FULLY_COMPILABLE', element.key);
    }
    if (!element.explicitRefutationEnabled) {
      fail('EXPLICIT_REFUTATION_NOT_ENABLED', element.key);
    }
    if (new Set(element.ambiguousResolutions).size !== element.ambiguousResolutions.length) {
      fail('DUPLICATE_AMBIGUOUS_RESOLUTION', element.key);
    }
    if (
      element.ambiguousResolutions.includes('NOT_DEMONSTRATED') &&
      !element.ambiguousResolutions.includes('EXPLICITLY_REFUTED')
    ) {
      fail('EXPLICIT_REFUTATION_MISSING_FROM_AMBIGUITY', element.key);
    }
    if (
      (element.type === 'RELATION' || element.type === 'JUSTIFICATION') &&
      !element.evidenceRule.relationRoles
    ) {
      fail('RELATION_ROLES_MISSING', element.key);
    }
    if (
      element.type === 'JUSTIFICATION' &&
      element.evidenceRule.minimumSpans < 2
    ) {
      fail('JUSTIFICATION_REQUIRES_MULTIPLE_SPANS', element.key);
    }
    validateElementFeedbackPolicy({ element, groupsByKey });
  }

  validateGroups({ elementsByKey, groups: rubric.evidenceGroups });
  validateDependencies(rubric, elementsByKey);
  validateFrameworkPolicy(rubric);
  for (const criterion of rubric.criteria) {
    validateCriterionStateSpace({ criterion, groupsByKey });
  }

  return {
    certificateVersion: 2,
    compilationStatus: 'COMPILED_OFFLINE',
    rubric,
    rubricFingerprint: rubricFingerprintV2(rubric),
  };
}

export type CompiledExecutableRubricByVersion =
  | { compiled: CompiledExecutableRubric; schemaVersion: 1 }
  | { compiled: CompiledExecutableRubricV2; schemaVersion: 2 };

export function compileExecutableRubricBySchemaVersion(
  input: unknown,
): CompiledExecutableRubricByVersion {
  if (!input || typeof input !== 'object' || !('schemaVersion' in input)) {
    fail('MISSING_RUBRIC_SCHEMA_VERSION', 'schemaVersion is required.');
  }
  const schemaVersion = (input as { schemaVersion?: unknown }).schemaVersion;
  if (schemaVersion === 1) {
    return { compiled: compileExecutableRubric(input), schemaVersion: 1 };
  }
  if (schemaVersion === 2) {
    return { compiled: compileExecutableRubricV2(input), schemaVersion: 2 };
  }
  fail('UNSUPPORTED_RUBRIC_SCHEMA_VERSION', String(schemaVersion));
}

const evidenceConflictV2Schema = z
  .object({
    evidenceSpans: z.array(evidenceSpanV2Schema).max(8),
    kind: contradictionKindSchema,
    scenarioKey: stableKeySchema,
    trustedClaimKeys: z.array(stableKeySchema),
  })
  .strict();

export const evidenceFindingV2Schema = z
  .object({
    confidence: z.number().min(0).max(1).nullable(),
    conflicts: z.array(evidenceConflictV2Schema),
    elementKey: stableKeySchema,
    evidenceSpans: z.array(evidenceSpanV2Schema).max(8),
    frameworkConditions: z.array(frameworkConditionEvidenceV2Schema),
    frameworkKey: frameworkSchema.nullable(),
    relationBindings: z.array(relationBindingV2Schema),
    status: atomicEvidenceStatusV2Schema,
    trustedClaimKeys: z.array(stableKeySchema),
  })
  .strict();

export const evidencePassV2Schema = z
  .object({
    findings: z.array(evidenceFindingV2Schema),
    pipelineFingerprint: sha256Schema,
    role: z.enum(['EVIDENCE_RESEARCHER', 'EVIDENCE_FALSIFIER']),
  })
  .strict();

export type EvidenceFindingV2 = z.infer<typeof evidenceFindingV2Schema>;
export type EvidencePassV2 = z.infer<typeof evidencePassV2Schema>;

export type ConsolidatedElementEvidenceV2 = {
  conflicts: EvidenceFindingV2['conflicts'];
  contextMismatchState: 'NONE' | 'CONFIRMED' | 'AMBIGUOUS';
  elementKey: string;
  evidenceSpans: EvidenceSpanV2[];
  frameworkConditions: Array<z.infer<typeof frameworkConditionEvidenceV2Schema>>;
  frameworkKey: z.infer<typeof frameworkSchema> | null;
  researcherConfidence: number | null;
  relationBindings: Array<z.infer<typeof relationBindingV2Schema>>;
  status: AtomicEvidenceStatusV2;
  trustedClaimKeys: string[];
  verifierConfidence: number | null;
};

declare const consolidatedEvidenceV2Brand: unique symbol;

const validatedConsolidatedEvidenceV2 = new WeakSet<object>();

export type ConsolidatedEvidenceV2 = {
  elements: ConsolidatedElementEvidenceV2[];
  pipelineFingerprint: string;
  [consolidatedEvidenceV2Brand]: true;
};

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export type EvidenceCertificateV2 = {
  certificateVersion: 2;
  correctionState:
    | 'FEEDBACK_READY'
    | 'REVISION_REQUIRED'
    | 'CLARIFICATION_REQUIRED';
  criteria: Array<{
    criterionKey: string;
    levelKey: z.infer<typeof levelKeySchema> | null;
    possibleLevelKeys: Array<z.infer<typeof levelKeySchema>>;
    resolutionState: 'RESOLVED' | 'BLOCKED_BY_DEPENDENCY';
    ruleId: string | null;
    ruleIds: string[];
  }>;
  elements: Array<{
    conflicts: EvidenceFindingV2['conflicts'];
    contextMismatchState: 'NONE' | 'CONFIRMED' | 'AMBIGUOUS';
    criterionKey: string;
    elementKey: string;
    evidenceSpans: EvidenceSpanV2[];
    frameworkConditions: Array<z.infer<typeof frameworkConditionEvidenceV2Schema>>;
    frameworkKey: z.infer<typeof frameworkSchema> | null;
    proposedStatus: AtomicEvidenceStatusV2;
    relationBindings: Array<z.infer<typeof relationBindingV2Schema>>;
    resolutionState: AtomicEvidenceStatusV2 | 'BLOCKED_BY_DEPENDENCY';
    scenarioKey: string;
    trustedClaimKeys: string[];
  }>;
  feedback: Array<{
    criterionKey: string;
    elementKey: string;
    message: string;
    status: AtomicEvidenceStatusV2;
  }>;
  indicativeScore: null;
  pipelineFingerprint: string;
  progressionEffect: 'NONE';
  rubricFingerprint: string;
  rubricKey: string;
  rubricVersion: string;
  ruleSetVersion: string;
};

export function evidenceSpanForV2(
  responseText: string,
  start: number,
  end: number,
): EvidenceSpanV2 {
  const text = responseText.slice(start, end);
  if (!text) throw new Error('EVIDENCE_SPAN_EMPTY');
  return { end, sha256: sha256(text), start, text };
}

function spanKey(span: EvidenceSpanV2): string {
  return `${span.start}:${span.end}:${span.sha256}`;
}

function validateSpan(responseText: string, span: EvidenceSpanV2): void {
  const exact = responseText.slice(span.start, span.end);
  if (exact !== span.text || sha256(exact) !== span.sha256) {
    throw new Error('EVIDENCE_SPAN_MISMATCH');
  }
}

function uniqueSpans(spans: EvidenceSpanV2[]): EvidenceSpanV2[] {
  return [
    ...new Map(spans.map((span) => [spanKey(span), span])).values(),
  ].sort((left, right) => left.start - right.start || left.end - right.end);
}

function trustedClaimsByKey(
  rubric: ExecutableRubricV2,
): Map<string, { scenarioKey: string; text: string }> {
  return new Map(
    rubric.trustedContext.scenarios.flatMap((scenario) =>
      scenario.claims.map((claim) => [
        claim.key,
        { scenarioKey: scenario.key, text: claim.text },
      ] as const),
    ),
  );
}

function validateFinding(input: {
  compiled: CompiledExecutableRubricV2;
  finding: EvidenceFindingV2;
  responseText: string;
}): void {
  const element = requireValue(
    input.compiled.rubric.elements.find(
      ({ key }) => key === input.finding.elementKey,
    ),
    'UNKNOWN_EVIDENCE_ELEMENT',
  );
  const allSpans = [
    ...input.finding.evidenceSpans,
    ...input.finding.conflicts.flatMap(({ evidenceSpans }) => evidenceSpans),
  ];
  for (const span of allSpans) validateSpan(input.responseText, span);
  if (new Set(allSpans.map(spanKey)).size !== allSpans.length) {
    throw new Error('EVIDENCE_SPAN_DUPLICATE');
  }

  const cardinalitySpans =
    input.finding.status === 'CONTRADICTED'
      ? allSpans
      : input.finding.evidenceSpans;
  const evidenceRequired = ['SUPPORTED', 'CONTRADICTED', 'EXPLICITLY_REFUTED'].includes(
    input.finding.status,
  );
  if (
    evidenceRequired &&
    (cardinalitySpans.length < element.evidenceRule.minimumSpans ||
      cardinalitySpans.length > element.evidenceRule.maximumSpans)
  ) {
    throw new Error('EVIDENCE_SPAN_CARDINALITY_INVALID');
  }
  if (input.finding.status === 'AMBIGUOUS' && allSpans.length === 0) {
    throw new Error('AMBIGUOUS_REQUIRES_EXACT_EVIDENCE');
  }
  if (
    input.finding.status === 'EXPLICITLY_REFUTED' &&
    !element.explicitRefutationEnabled
  ) {
    throw new Error('EXPLICIT_REFUTATION_NOT_AUTHORIZED');
  }
  if (
    input.finding.status === 'CONTRADICTED' &&
    input.finding.conflicts.length === 0
  ) {
    throw new Error('CONTRADICTED_REQUIRES_STRUCTURED_CONFLICT');
  }

  const claims = trustedClaimsByKey(input.compiled.rubric);
  assertUnique(input.finding.trustedClaimKeys, 'DUPLICATE_FINDING_CLAIM');
  for (const claimKey of input.finding.trustedClaimKeys) {
    const claim = claims.get(claimKey);
    if (!claim || claim.scenarioKey !== element.scenarioKey) {
      throw new Error('TRUSTED_CLAIM_SCENARIO_MISMATCH');
    }
  }
  if (
    input.finding.status === 'SUPPORTED' &&
    element.evidenceRule.trustedClaimReferenceRequired &&
    input.finding.trustedClaimKeys.length !== 1
  ) {
    throw new Error('SUPPORTED_FACT_REQUIRES_ONE_TRUSTED_CLAIM');
  }

  const frameworkBindingRequired =
    element.key.endsWith('-framework-choice') ||
    element.evidenceRule.relationRoles?.some(
      (role) => role === 'FRAMEWORK' || role === 'FRAMEWORK_CHOICE',
    );
  if (
    input.finding.status === 'SUPPORTED' &&
    frameworkBindingRequired &&
    !input.finding.frameworkKey
  ) {
    throw new Error('SUPPORTED_RELATION_REQUIRES_FRAMEWORK_BINDING');
  }
  if (!frameworkBindingRequired && input.finding.frameworkKey) {
    throw new Error('UNEXPECTED_FRAMEWORK_BINDING');
  }

  assertUnique(
    input.finding.relationBindings.map(({ role }) => role),
    'DUPLICATE_RELATION_ROLE',
  );
  const expectedRelationRoles = element.evidenceRule.relationRoles ?? [];
  if (
    input.finding.relationBindings.some(
      ({ role }) => !expectedRelationRoles.includes(role),
    )
  ) {
    throw new Error('UNKNOWN_EVIDENCE_RELATION_ROLE');
  }
  if (
    input.finding.status === 'SUPPORTED' &&
    expectedRelationRoles.some(
      (role) =>
        !input.finding.relationBindings.some(
          (binding) => binding.role === role,
        ),
    )
  ) {
    throw new Error('EVIDENCE_RELATION_ROLE_COVERAGE_MISMATCH');
  }
  const directSpanKeys = new Set(input.finding.evidenceSpans.map(spanKey));
  for (const binding of input.finding.relationBindings) {
    for (const span of binding.evidenceSpans) {
      validateSpan(input.responseText, span);
      if (!directSpanKeys.has(spanKey(span))) {
        throw new Error('RELATION_ROLE_SPAN_NOT_IN_FINDING');
      }
    }
  }

  assertUnique(
    input.finding.frameworkConditions.map(({ conditionKey }) => conditionKey),
    'DUPLICATE_FRAMEWORK_CONDITION_EVIDENCE',
  );
  const scenarioMapping = requireValue(
    input.compiled.rubric.frameworkPolicy.scenarioMappings.find(
      ({ scenarioKey }) => scenarioKey === element.scenarioKey,
    ),
    'FRAMEWORK_SCENARIO_MAPPING_MISSING',
  );
  const allowedConditionKeys = new Set(
    input.finding.frameworkKey
      ? (scenarioMapping.conditionalRules[input.finding.frameworkKey]
          ?.requiredConditionKeys ?? [])
      : [],
  );
  if (
    input.finding.frameworkConditions.length > 0 &&
    (element.ownerCriterionKey !== 'choice-rationale' ||
      input.finding.status !== 'SUPPORTED' ||
      input.finding.frameworkConditions.some(
        ({ conditionKey }) => !allowedConditionKeys.has(conditionKey),
      ))
  ) {
    throw new Error('UNAUTHORIZED_FRAMEWORK_CONDITION_EVIDENCE');
  }
  for (const condition of input.finding.frameworkConditions) {
    for (const span of condition.evidenceSpans) {
      validateSpan(input.responseText, span);
      if (!directSpanKeys.has(spanKey(span))) {
        throw new Error('FRAMEWORK_CONDITION_SPAN_NOT_IN_FINDING');
      }
    }
  }

  for (const conflict of input.finding.conflicts) {
    if (
      conflict.scenarioKey !== element.scenarioKey ||
      !element.contradictionKinds.includes(conflict.kind)
    ) {
      throw new Error('EVIDENCE_CONFLICT_NOT_AUTHORIZED');
    }
    for (const claimKey of conflict.trustedClaimKeys) {
      const claim = claims.get(claimKey);
      if (!claim || claim.scenarioKey !== element.scenarioKey) {
        throw new Error('CONFLICT_TRUSTED_CLAIM_SCENARIO_MISMATCH');
      }
    }
    if (
      conflict.kind === 'CONTEXT_MISMATCH' &&
      (conflict.evidenceSpans.length === 0 || conflict.trustedClaimKeys.length === 0)
    ) {
      throw new Error('CONTEXT_MISMATCH_REQUIRES_SPAN_AND_TRUSTED_CLAIM');
    }
  }
}

function validateFrameworkBindingsForPass(input: {
  compiled: CompiledExecutableRubricV2;
  findings: Map<string, EvidenceFindingV2>;
}): void {
  for (const mapping of input.compiled.rubric.frameworkPolicy.scenarioMappings) {
    const scenarioElements = input.compiled.rubric.elements.filter(
      ({ scenarioKey }) => scenarioKey === mapping.scenarioKey,
    );
    const choiceElement = scenarioElements.find(({ key }) =>
      key.endsWith('-framework-choice'),
    );
    if (!choiceElement) throw new Error('FRAMEWORK_CHOICE_ELEMENT_MISSING');
    const choice = requireValue(
      input.findings.get(choiceElement.key),
      'FRAMEWORK_CHOICE_FINDING_MISSING',
    );
    for (const element of scenarioElements) {
      const finding = requireValue(
        input.findings.get(element.key),
        'MISSING_SCENARIO_FINDING',
      );
      if (
        finding.status === 'SUPPORTED' &&
        finding.frameworkKey &&
        choice.status === 'SUPPORTED' &&
        choice.frameworkKey &&
        finding.frameworkKey !== choice.frameworkKey
      ) {
        throw new Error('FRAMEWORK_BINDING_MISMATCH');
      }
      if (
        element.ownerCriterionKey === 'choice-rationale' &&
        finding.status === 'SUPPORTED' &&
        finding.frameworkKey &&
        !mapping.acceptedFrameworks.includes(finding.frameworkKey)
      ) {
        throw new Error('UNAUTHORIZED_FRAMEWORK_MAPPING');
      }
    }
    if (choice.status === 'SUPPORTED' && choice.frameworkKey) {
      const conditionalRule = mapping.conditionalRules[choice.frameworkKey];
      if (conditionalRule) {
        const rationaleElement = requireValue(
          scenarioElements.find(
            ({ ownerCriterionKey }) => ownerCriterionKey === 'choice-rationale',
          ),
          'FRAMEWORK_RATIONALE_ELEMENT_MISSING',
        );
        const rationale = requireValue(
          input.findings.get(rationaleElement.key),
          'FRAMEWORK_RATIONALE_FINDING_MISSING',
        );
        if (
          rationale.status === 'SUPPORTED' &&
          conditionalRule.requiredConditionKeys.some(
            (conditionKey) =>
              !rationale.frameworkConditions.some(
                (condition) => condition.conditionKey === conditionKey,
              ),
          )
        ) {
          throw new Error('FRAMEWORK_CONDITIONS_NOT_DEMONSTRATED');
        }
      }
    }
  }
}

function indexEvidencePassV2(input: {
  compiled: CompiledExecutableRubricV2;
  pass: unknown;
  responseText: string;
}): { findings: Map<string, EvidenceFindingV2>; pass: EvidencePassV2 } {
  const pass = evidencePassV2Schema.parse(input.pass);
  const expectedKeys = input.compiled.rubric.elements.map(({ key }) => key);
  assertUnique(
    pass.findings.map(({ elementKey }) => elementKey),
    'DUPLICATE_EVIDENCE_ELEMENT',
  );
  if (
    pass.findings.length !== expectedKeys.length ||
    expectedKeys.some(
      (key) => !pass.findings.some(({ elementKey }) => elementKey === key),
    )
  ) {
    throw new Error('EVIDENCE_ELEMENT_COVERAGE_MISMATCH');
  }
  for (const finding of pass.findings) {
    validateFinding({ ...input, finding });
  }
  const findings = new Map(
    pass.findings.map((finding) => [finding.elementKey, finding]),
  );
  validateFrameworkBindingsForPass({ compiled: input.compiled, findings });
  return {
    findings,
    pass,
  };
}

function canonicalizeEvidenceGroup(input: {
  compiled: CompiledExecutableRubricV2;
  findings: Map<string, EvidenceFindingV2>;
  group: ExecutableRubricV2['evidenceGroups'][number];
}): void {
  const supported = input.group.elementKeys
    .map((key) => requireValue(input.findings.get(key), 'MISSING_GROUP_FINDING'))
    .filter(({ status }) => status === 'SUPPORTED')
    .sort((left, right) => {
      const claim = (left.trustedClaimKeys.at(0) ?? '').localeCompare(
        right.trustedClaimKeys.at(0) ?? '',
      );
      if (claim !== 0) return claim;
      return (
        (left.evidenceSpans.at(0)?.start ?? 0) -
        (right.evidenceSpans.at(0)?.start ?? 0)
      );
    });
  const claimKeys = supported.flatMap(({ trustedClaimKeys }) => trustedClaimKeys);
  if (new Set(claimKeys).size !== claimKeys.length) {
    throw new Error('EVIDENCE_GROUP_DUPLICATE_TRUSTED_CLAIM');
  }
  const occurrences = supported.flatMap(({ evidenceSpans }) =>
    evidenceSpans.map(spanKey),
  );
  if (new Set(occurrences).size !== occurrences.length) {
    throw new Error('EVIDENCE_GROUP_DUPLICATE_RESPONSE_SPAN');
  }

  const remaining = input.group.elementKeys
    .map((key) => requireValue(input.findings.get(key), 'MISSING_GROUP_FINDING'))
    .filter(({ status }) => status !== 'SUPPORTED')
    .sort((left, right) => {
      const priority: Record<AtomicEvidenceStatusV2, number> = {
        EXPLICITLY_REFUTED: 0,
        CONTRADICTED: 1,
        AMBIGUOUS: 2,
        NOT_DEMONSTRATED: 3,
        SUPPORTED: 4,
      };
      return (
        priority[left.status] - priority[right.status] ||
        left.elementKey.localeCompare(right.elementKey)
      );
    });
  const canonicalElementKeys = [...input.group.elementKeys].sort();
  [...supported, ...remaining].forEach((finding, index) => {
    const targetKey = requireValue(
      canonicalElementKeys.at(index),
      'MISSING_CANONICAL_GROUP_SLOT',
    );
    input.findings.set(targetKey, { ...finding, elementKey: targetKey });
  });
}

function canonicalizeEvidencePassV2(input: {
  compiled: CompiledExecutableRubricV2;
  indexed: { findings: Map<string, EvidenceFindingV2>; pass: EvidencePassV2 };
}): Map<string, EvidenceFindingV2> {
  const findings = new Map(
    [...input.indexed.findings].map(([key, finding]) => [
      key,
      structuredClone(finding),
    ]),
  );
  for (const group of input.compiled.rubric.evidenceGroups) {
    canonicalizeEvidenceGroup({ compiled: input.compiled, findings, group });
  }
  return findings;
}

export function validateEvidencePassV2(input: {
  compiled: CompiledExecutableRubricV2;
  pass: unknown;
  responseText: string;
}): EvidencePassV2 {
  return indexEvidencePassV2(input).pass;
}

function mergeConflicts(
  left: EvidenceFindingV2['conflicts'],
  right: EvidenceFindingV2['conflicts'],
): EvidenceFindingV2['conflicts'] {
  const byKey = new Map<string, EvidenceFindingV2['conflicts'][number]>();
  for (const conflict of [...left, ...right]) {
    const key = JSON.stringify(canonicalize(conflict));
    byKey.set(key, conflict);
  }
  return [...byKey.values()];
}

export function consolidateIndependentEvidenceV2(input: {
  compiled: CompiledExecutableRubricV2;
  falsifier: unknown;
  researcher: unknown;
  responseText: string;
}): ConsolidatedEvidenceV2 {
  const researcher = indexEvidencePassV2({
    compiled: input.compiled,
    pass: input.researcher,
    responseText: input.responseText,
  });
  const falsifier = indexEvidencePassV2({
    compiled: input.compiled,
    pass: input.falsifier,
    responseText: input.responseText,
  });
  if (
    researcher.pass.role !== 'EVIDENCE_RESEARCHER' ||
    falsifier.pass.role !== 'EVIDENCE_FALSIFIER'
  ) {
    throw new Error('EVIDENCE_ROLE_MISMATCH');
  }
  const researcherFindings = canonicalizeEvidencePassV2({
    compiled: input.compiled,
    indexed: researcher,
  });
  const falsifierFindings = canonicalizeEvidencePassV2({
    compiled: input.compiled,
    indexed: falsifier,
  });
  const elements = input.compiled.rubric.elements.map((element) => {
    const { key } = element;
    const research = requireValue(
      researcherFindings.get(key),
      'MISSING_RESEARCHER_ELEMENT',
    );
    const verification = requireValue(
      falsifierFindings.get(key),
      'MISSING_FALSIFIER_ELEMENT',
    );
    const frameworkBindingMustAgree =
      element.key.endsWith('-framework-choice') ||
      Boolean(element.evidenceRule.relationRoles);
    const trustedClaimBindingMustAgree =
      element.evidenceRule.trustedClaimReferenceRequired === true;
    const trustedClaimsAgree =
      [...research.trustedClaimKeys].sort().join('|') ===
      [...verification.trustedClaimKeys].sort().join('|');
    const status =
      research.status === verification.status &&
      (!frameworkBindingMustAgree ||
        research.frameworkKey === verification.frameworkKey) &&
      (!trustedClaimBindingMustAgree || trustedClaimsAgree)
        ? research.status
        : 'AMBIGUOUS';
    const researcherHasContextMismatch = research.conflicts.some(
      ({ kind }) => kind === 'CONTEXT_MISMATCH',
    );
    const verifierHasContextMismatch = verification.conflicts.some(
      ({ kind }) => kind === 'CONTEXT_MISMATCH',
    );
    const contextMismatchState =
      researcherHasContextMismatch && verifierHasContextMismatch
        ? 'CONFIRMED'
        : researcherHasContextMismatch || verifierHasContextMismatch
          ? 'AMBIGUOUS'
          : 'NONE';
    return {
      conflicts: mergeConflicts(research.conflicts, verification.conflicts),
      contextMismatchState,
      elementKey: key,
      evidenceSpans: uniqueSpans([
        ...research.evidenceSpans,
        ...verification.evidenceSpans,
      ]),
      frameworkConditions: [
        ...new Map(
          [...research.frameworkConditions, ...verification.frameworkConditions].map(
            (condition) => [
              condition.conditionKey,
              {
                conditionKey: condition.conditionKey,
                evidenceSpans: uniqueSpans(condition.evidenceSpans),
              },
            ],
          ),
        ).values(),
      ].sort((left, right) =>
        left.conditionKey.localeCompare(right.conditionKey),
      ),
      frameworkKey:
        research.frameworkKey === verification.frameworkKey
          ? research.frameworkKey
          : null,
      researcherConfidence: research.confidence,
      relationBindings: [
        ...new Map(
          [...research.relationBindings, ...verification.relationBindings].map(
            (binding) => [
              binding.role,
              {
                evidenceSpans: uniqueSpans(binding.evidenceSpans),
                role: binding.role,
              },
            ],
          ),
        ).values(),
      ].sort((left, right) => left.role.localeCompare(right.role)),
      status,
      trustedClaimKeys: [
        ...new Set([
          ...research.trustedClaimKeys,
          ...verification.trustedClaimKeys,
        ]),
      ].sort(),
      verifierConfidence: verification.confidence,
    } satisfies ConsolidatedElementEvidenceV2;
  });
  const consolidatedEvidence = deepFreeze({
    elements,
    pipelineFingerprint: sha256(
      `${researcher.pass.pipelineFingerprint}:${falsifier.pass.pipelineFingerprint}`,
    ),
  }) as ConsolidatedEvidenceV2;
  validatedConsolidatedEvidenceV2.add(consolidatedEvidence);
  return consolidatedEvidence;
}

function possibleStatusesV2(input: {
  element: ExecutableRubricV2['elements'][number];
  status: AtomicEvidenceStatusV2;
}): ResolvedAtomicEvidenceStatusV2[] {
  return input.status === 'AMBIGUOUS'
    ? input.element.ambiguousResolutions
    : [input.status];
}

function findingHasProjectProperty(finding: ConsolidatedElementEvidenceV2): boolean {
  if (
    finding.status === 'NOT_DEMONSTRATED' ||
    finding.status === 'EXPLICITLY_REFUTED'
  ) {
    return false;
  }
  if (finding.status === 'SUPPORTED') {
    return (
      finding.trustedClaimKeys.length === 1 &&
      finding.evidenceSpans.length > 0
    );
  }
  return (
    finding.evidenceSpans.length > 0 ||
    finding.conflicts.some(({ evidenceSpans }) => evidenceSpans.length > 0)
  );
}

function duplicateGroupRootCauseIsBlocked(input: {
  element: ExecutableRubricV2['elements'][number];
  elementsByKey: Map<string, ExecutableRubricV2['elements'][number]>;
  evidenceByKey: Map<string, ConsolidatedElementEvidenceV2>;
}): boolean {
  if (!input.element.distinctEvidenceGroup) return false;
  const groupElements = [...input.elementsByKey.values()]
    .filter(
      ({ distinctEvidenceGroup }) =>
        distinctEvidenceGroup === input.element.distinctEvidenceGroup,
    )
    .sort((left, right) => left.key.localeCompare(right.key));
  const evidence = requireValue(
    input.evidenceByKey.get(input.element.key),
    'MISSING_GROUP_EVIDENCE',
  );
  if (evidence.status === 'EXPLICITLY_REFUTED') {
    const refusals = groupElements.filter(
      (candidate) =>
        input.evidenceByKey.get(candidate.key)?.status ===
        'EXPLICITLY_REFUTED',
    );
    return refusals.length > 1 && refusals.at(0)?.key !== input.element.key;
  }
  if (evidence.status !== 'CONTRADICTED' || evidence.conflicts.length === 0) {
    return false;
  }
  const signature = JSON.stringify(canonicalize(evidence.conflicts));
  const duplicates = groupElements.filter((candidate) => {
    const candidateEvidence = input.evidenceByKey.get(candidate.key);
    return (
      candidateEvidence?.status === 'CONTRADICTED' &&
      JSON.stringify(canonicalize(candidateEvidence.conflicts)) === signature
    );
  });
  return duplicates.length > 1 && duplicates.at(0)?.key !== input.element.key;
}

function applyDependencies(input: {
  elementsByKey: Map<string, ExecutableRubricV2['elements'][number]>;
  evidenceByKey: Map<string, ConsolidatedElementEvidenceV2>;
  statuses: Map<string, EvaluationStatus>;
}): Map<string, EvaluationStatus> {
  const resolved = new Map(input.statuses);
  let changed = true;
  while (changed) {
    changed = false;
    for (const element of input.elementsByKey.values()) {
      if (
        duplicateGroupRootCauseIsBlocked({
          element,
          elementsByKey: input.elementsByKey,
          evidenceByKey: input.evidenceByKey,
        })
      ) {
        if (resolved.get(element.key) !== 'BLOCKED_BY_DEPENDENCY') {
          resolved.set(element.key, 'BLOCKED_BY_DEPENDENCY');
          changed = true;
        }
        continue;
      }
      if (!element.dependsOn) continue;
      const dependency = element.dependsOn;
      const blocked =
        'elementKey' in dependency
          ? resolved.get(dependency.elementKey) !== 'SUPPORTED'
          : [...input.elementsByKey.values()]
              .filter(
                (candidate) =>
                  candidate.scenarioKey ===
                    dependency.responsePropertyScenarioKey &&
                  candidate.ownerCriterionKey === 'dossier-fidelity',
              )
              .every((candidate) => {
                const evidence = requireValue(
                  input.evidenceByKey.get(candidate.key),
                  'MISSING_CONSOLIDATED_ELEMENT',
                );
                return !findingHasProjectProperty(evidence);
              });
      if (blocked && resolved.get(element.key) !== 'BLOCKED_BY_DEPENDENCY') {
        resolved.set(element.key, 'BLOCKED_BY_DEPENDENCY');
        changed = true;
      }
    }
  }
  return resolved;
}

function criterionPossibilitiesV2(input: {
  compiled: CompiledExecutableRubricV2;
  criterion: ExecutableRubricV2['criteria'][number];
  evidenceByKey: Map<string, ConsolidatedElementEvidenceV2>;
}): {
  blocked: boolean;
  levels: Array<z.infer<typeof levelKeySchema>>;
  ruleIds: string[];
} {
  const elementsByKey = new Map(
    input.compiled.rubric.elements.map((element) => [element.key, element]),
  );
  const groupsByKey = new Map(
    input.compiled.rubric.evidenceGroups.map((group) => [group.key, group]),
  );
  const relevantElements = input.criterion.elementKeys.map((key) =>
    requireValue(elementsByKey.get(key), 'UNKNOWN_CRITERION_ELEMENT'),
  );
  const assignments = allCombinations(
    relevantElements.map((element) => {
      const evidence = requireValue(
        input.evidenceByKey.get(element.key),
        'MISSING_CONSOLIDATED_ELEMENT',
      );
      return possibleStatusesV2({ element, status: evidence.status }).map(
        (status) => [element.key, status] as const,
      );
    }),
  );
  const levels = new Set<z.infer<typeof levelKeySchema>>();
  const ruleIds = new Set<string>();
  let blockedAssignments = 0;
  for (const assignment of assignments) {
    const statuses = applyDependencies({
      elementsByKey,
      evidenceByKey: input.evidenceByKey,
      statuses: new Map(assignment),
    });
    const confirmedContextMismatch = relevantElements.some((element) => {
      const evidence = requireValue(
        input.evidenceByKey.get(element.key),
        'MISSING_CONSOLIDATED_ELEMENT',
      );
      return evidence.contextMismatchState === 'CONFIRMED';
    });
    const ambiguousContextMismatch = relevantElements.some((element) => {
      const evidence = requireValue(
        input.evidenceByKey.get(element.key),
        'MISSING_CONSOLIDATED_ELEMENT',
      );
      return evidence.contextMismatchState === 'AMBIGUOUS';
    });
    const contextMismatchOptions = confirmedContextMismatch
      ? [true]
      : ambiguousContextMismatch
        ? [false, true]
        : [false];
    let assignmentResolved = false;
    for (const contextMismatch of contextMismatchOptions) {
      const matched = matchingLevelKeys({
        contextMismatch,
        criterion: input.criterion,
        groupsByKey,
        statuses,
      });
      if (matched.length === 0) continue;
      assignmentResolved = true;
      if (matched.length !== 1) {
        throw new Error('RUNTIME_LEVEL_RULE_OVERLAP');
      }
      const level = requireValue(matched.at(0), 'MISSING_RUNTIME_LEVEL');
      levels.add(level);
      ruleIds.add(
        `${input.compiled.rubric.rubricKey}:${input.compiled.rubric.ruleSetVersion}:${input.criterion.key}:${level}`,
      );
    }
    if (!assignmentResolved) blockedAssignments += 1;
  }
  return {
    blocked: blockedAssignments === assignments.length,
    levels: [...levels].sort((left, right) => levelRank(left) - levelRank(right)),
    ruleIds: [...ruleIds].sort(),
  };
}

function deterministicResolutionState(input: {
  element: ExecutableRubricV2['elements'][number];
  elementsByKey: Map<string, ExecutableRubricV2['elements'][number]>;
  evidenceByKey: Map<string, ConsolidatedElementEvidenceV2>;
}): AtomicEvidenceStatusV2 | 'BLOCKED_BY_DEPENDENCY' {
  const evidence = requireValue(
    input.evidenceByKey.get(input.element.key),
    'MISSING_CONSOLIDATED_ELEMENT',
  );
  if (duplicateGroupRootCauseIsBlocked(input)) {
    return 'BLOCKED_BY_DEPENDENCY';
  }
  if (!input.element.dependsOn) return evidence.status;
  if ('elementKey' in input.element.dependsOn) {
    const dependency = requireValue(
      input.evidenceByKey.get(input.element.dependsOn.elementKey),
      'MISSING_DEPENDENCY_EVIDENCE',
    );
    if (
      dependency.status !== 'SUPPORTED' &&
      dependency.status !== 'AMBIGUOUS'
    ) {
      return 'BLOCKED_BY_DEPENDENCY';
    }
    return evidence.status;
  }
  const scenarioKey = input.element.dependsOn.responsePropertyScenarioKey;
  const hasProperty = [...input.elementsByKey.values()]
    .filter(
      (candidate) =>
        candidate.scenarioKey === scenarioKey &&
        candidate.ownerCriterionKey === 'dossier-fidelity',
    )
    .some((candidate) =>
      findingHasProjectProperty(
        requireValue(
          input.evidenceByKey.get(candidate.key),
          'MISSING_CONSOLIDATED_ELEMENT',
        ),
      ),
    );
  return hasProperty ? evidence.status : 'BLOCKED_BY_DEPENDENCY';
}

function templateForStatusV2(input: {
  element: ExecutableRubricV2['elements'][number];
  status: AtomicEvidenceStatusV2;
}): string {
  if (input.status === 'SUPPORTED') return input.element.templates.supported;
  if (input.status === 'NOT_DEMONSTRATED') {
    return input.element.templates.notDemonstrated;
  }
  if (input.status === 'EXPLICITLY_REFUTED') {
    return input.element.templates.explicitlyRefuted;
  }
  if (input.status === 'CONTRADICTED') {
    return input.element.templates.contradicted;
  }
  return input.element.templates.ambiguous;
}

function feedbackV2(input: {
  compiled: CompiledExecutableRubricV2;
  evidenceByKey: Map<string, ConsolidatedElementEvidenceV2>;
}): EvidenceCertificateV2['feedback'] {
  const elementsByKey = new Map(
    input.compiled.rubric.elements.map((element) => [element.key, element]),
  );
  const groupRootKeys = new Map(
    input.compiled.rubric.evidenceGroups.map((group) => [
      group.key,
      [...group.elementKeys].sort().at(0),
    ]),
  );
  const feedback: EvidenceCertificateV2['feedback'] = [];
  const emittedGroupRootCauses = new Set<string>();
  for (const element of input.compiled.rubric.elements) {
    const evidence = requireValue(
      input.evidenceByKey.get(element.key),
      'MISSING_CONSOLIDATED_ELEMENT',
    );
    const resolutionState = deterministicResolutionState({
      element,
      elementsByKey,
      evidenceByKey: input.evidenceByKey,
    });
    if (resolutionState === 'BLOCKED_BY_DEPENDENCY') continue;
    let message = templateForStatusV2({ element, status: evidence.status });
    if (message === 'GROUP_MESSAGE_ONLY') {
      const groupKey = requireValue(
        element.distinctEvidenceGroup,
        'GROUP_MESSAGE_WITHOUT_GROUP',
      );
      const rootKey = requireValue(
        groupRootKeys.get(groupKey),
        'GROUP_MESSAGE_WITHOUT_ROOT',
      );
      const root = requireValue(elementsByKey.get(rootKey), 'MISSING_GROUP_ROOT');
      message = templateForStatusV2({ element: root, status: evidence.status });
    }
    if (
      element.distinctEvidenceGroup &&
      ['EXPLICITLY_REFUTED', 'CONTRADICTED'].includes(evidence.status)
    ) {
      const deduplicationKey = `${element.distinctEvidenceGroup}:${evidence.status}`;
      if (emittedGroupRootCauses.has(deduplicationKey)) continue;
      emittedGroupRootCauses.add(deduplicationKey);
    }
    feedback.push({
      criterionKey: element.ownerCriterionKey,
      elementKey: element.key,
      message,
      status: evidence.status,
    });
  }
  return feedback;
}

function validateConsolidatedEvidenceV2(input: {
  compiled: CompiledExecutableRubricV2;
  consolidatedEvidence: ConsolidatedEvidenceV2;
}): Map<string, ConsolidatedElementEvidenceV2> {
  if (!validatedConsolidatedEvidenceV2.has(input.consolidatedEvidence)) {
    throw new Error('UNVALIDATED_CONSOLIDATED_EVIDENCE');
  }
  if (!sha256Schema.safeParse(input.consolidatedEvidence.pipelineFingerprint).success) {
    throw new Error('INVALID_PIPELINE_FINGERPRINT');
  }
  const expectedKeys = input.compiled.rubric.elements.map(({ key }) => key);
  assertUnique(
    input.consolidatedEvidence.elements.map(({ elementKey }) => elementKey),
    'DUPLICATE_CONSOLIDATED_ELEMENT',
  );
  if (
    expectedKeys.length !== input.consolidatedEvidence.elements.length ||
    expectedKeys.some(
      (key) =>
        !input.consolidatedEvidence.elements.some(
          ({ elementKey }) => elementKey === key,
        ),
    )
  ) {
    throw new Error('CONSOLIDATED_ELEMENT_COVERAGE_MISMATCH');
  }
  const byKey = new Map(
    input.consolidatedEvidence.elements.map((element) => [
      element.elementKey,
      element,
    ]),
  );
  const trustedClaims = trustedClaimsByKey(input.compiled.rubric);
  for (const evidence of input.consolidatedEvidence.elements) {
    const element = requireValue(
      input.compiled.rubric.elements.find(
        ({ key }) => key === evidence.elementKey,
      ),
      'UNKNOWN_CONSOLIDATED_ELEMENT',
    );
    for (const span of [
      ...evidence.evidenceSpans,
      ...evidence.conflicts.flatMap(({ evidenceSpans }) => evidenceSpans),
    ]) {
      if (
        span.end - span.start !== span.text.length ||
        sha256(span.text) !== span.sha256
      ) {
        throw new Error('INVALID_CONSOLIDATED_EVIDENCE_SPAN');
      }
    }
    for (const claimKey of evidence.trustedClaimKeys) {
      if (trustedClaims.get(claimKey)?.scenarioKey !== element.scenarioKey) {
        throw new Error('CONSOLIDATED_TRUSTED_CLAIM_SCENARIO_MISMATCH');
      }
    }
    if (
      evidence.status === 'SUPPORTED' &&
      element.evidenceRule.trustedClaimReferenceRequired &&
      evidence.trustedClaimKeys.length !== 1
    ) {
      throw new Error('CONSOLIDATED_SUPPORTED_FACT_REQUIRES_ONE_CLAIM');
    }
    const expectedRoles = element.evidenceRule.relationRoles ?? [];
    if (
      evidence.status === 'SUPPORTED' &&
      expectedRoles.some(
        (role) =>
          !evidence.relationBindings.some(
            (binding) => binding.role === role,
          ),
      )
    ) {
      throw new Error('CONSOLIDATED_RELATION_ROLE_COVERAGE_MISMATCH');
    }
  }
  for (const group of input.compiled.rubric.evidenceGroups) {
    const supported = group.elementKeys
      .map((key) => requireValue(byKey.get(key), 'MISSING_GROUP_EVIDENCE'))
      .filter(({ status }) => status === 'SUPPORTED');
    const claims = supported.flatMap(({ trustedClaimKeys }) => trustedClaimKeys);
    if (new Set(claims).size !== claims.length) {
      throw new Error('EVIDENCE_GROUP_DUPLICATE_TRUSTED_CLAIM');
    }
    const spans = supported.flatMap(({ evidenceSpans }) =>
      evidenceSpans.map(spanKey),
    );
    if (new Set(spans).size !== spans.length) {
      throw new Error('EVIDENCE_GROUP_DUPLICATE_RESPONSE_SPAN');
    }
  }
  return byKey;
}

export function buildEvidenceCertificateV2(input: {
  compiled: CompiledExecutableRubricV2;
  consolidatedEvidence: ConsolidatedEvidenceV2;
}): EvidenceCertificateV2 {
  const evidenceByKey = validateConsolidatedEvidenceV2(input);
  const elementsByKey = new Map(
    input.compiled.rubric.elements.map((element) => [element.key, element]),
  );
  const criteria = input.compiled.rubric.criteria.map((criterion) => {
    const possibilities = criterionPossibilitiesV2({
      compiled: input.compiled,
      criterion,
      evidenceByKey,
    });
    const levelKey =
      possibilities.levels.length === 1
        ? (possibilities.levels.at(0) ?? null)
        : null;
    return {
      criterionKey: criterion.key,
      levelKey,
      possibleLevelKeys: possibilities.levels,
      resolutionState: possibilities.blocked
        ? ('BLOCKED_BY_DEPENDENCY' as const)
        : ('RESOLVED' as const),
      ruleId:
        possibilities.ruleIds.length === 1
          ? (possibilities.ruleIds.at(0) ?? null)
          : null,
      ruleIds: possibilities.ruleIds,
    };
  });
  const materialAmbiguity = criteria.some(
    ({ possibleLevelKeys }) => possibleLevelKeys.length > 1,
  );
  const requiredRevision = input.compiled.rubric.elements.some((element) => {
    if (element.obligation !== 'REQUIRED') return false;
    const evidence = requireValue(
      evidenceByKey.get(element.key),
      'MISSING_CONSOLIDATED_ELEMENT',
    );
    const resolutionState = deterministicResolutionState({
      element,
      elementsByKey,
      evidenceByKey,
    });
    if (
      resolutionState === 'BLOCKED_BY_DEPENDENCY' ||
      evidence.status === 'AMBIGUOUS'
    ) {
      return false;
    }
    return evidence.status !== 'SUPPORTED';
  });
  const correctionState = materialAmbiguity
    ? 'CLARIFICATION_REQUIRED'
    : requiredRevision
      ? 'REVISION_REQUIRED'
      : 'FEEDBACK_READY';

  return {
    certificateVersion: 2,
    correctionState,
    criteria,
    elements: input.compiled.rubric.elements.map((element) => {
      const evidence = requireValue(
        evidenceByKey.get(element.key),
        'MISSING_CONSOLIDATED_ELEMENT',
      );
      return {
        conflicts: evidence.conflicts,
        contextMismatchState: evidence.contextMismatchState,
        criterionKey: element.ownerCriterionKey,
        elementKey: element.key,
        evidenceSpans: evidence.evidenceSpans,
        frameworkConditions: evidence.frameworkConditions,
        frameworkKey: evidence.frameworkKey,
        proposedStatus: evidence.status,
        relationBindings: evidence.relationBindings,
        resolutionState: deterministicResolutionState({
          element,
          elementsByKey,
          evidenceByKey,
        }),
        scenarioKey: element.scenarioKey,
        trustedClaimKeys: evidence.trustedClaimKeys,
      };
    }),
    feedback: feedbackV2({ compiled: input.compiled, evidenceByKey }),
    indicativeScore: null,
    pipelineFingerprint: input.consolidatedEvidence.pipelineFingerprint,
    progressionEffect: 'NONE',
    rubricFingerprint: input.compiled.rubricFingerprint,
    rubricKey: input.compiled.rubric.rubricKey,
    rubricVersion: input.compiled.rubric.rubricVersion,
    ruleSetVersion: input.compiled.rubric.ruleSetVersion,
  };
}
