import { createHash } from 'node:crypto';

import { z } from 'zod';

const stableKeySchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const levelKeySchema = z.enum(['insufficient', 'partial', 'mastered']);

export const atomicEvidenceStatusSchema = z.enum([
  'SUPPORTED',
  'CONTRADICTED',
  'NOT_DEMONSTRATED',
  'AMBIGUOUS',
]);

const resolvedAtomicEvidenceStatusSchema = atomicEvidenceStatusSchema.exclude([
  'AMBIGUOUS',
]);

const statusPointsSchema = z
  .object({
    CONTRADICTED: z.number().int(),
    NOT_DEMONSTRATED: z.number().int(),
    SUPPORTED: z.number().int(),
  })
  .strict();

export const evidenceSpanSchema = z
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

const evidenceRuleSchema = z
  .object({
    exactResponseSpansRequired: z.literal(true),
    maximumSpans: z.number().int().positive().max(8),
    minimumSpans: z.number().int().nonnegative().max(8),
    relationshipDescription: z.string().trim().min(1).nullable(),
  })
  .strict()
  .refine(({ maximumSpans, minimumSpans }) => maximumSpans >= minimumSpans, {
    message: 'maximumSpans must be greater than or equal to minimumSpans.',
    path: ['maximumSpans'],
  });

const rubricElementSchema = z
  .object({
    acceptableVariants: z.array(z.string().trim().min(1)).min(1),
    ambiguousResolutions: z
      .array(resolvedAtomicEvidenceStatusSchema)
      .min(2)
      .refine((values) => new Set(values).size === values.length, {
        message: 'Ambiguous resolutions must be unique.',
      }),
    contradictionSignals: z.array(z.string().trim().min(1)),
    evidenceRule: evidenceRuleSchema,
    excludedCriterionKeys: z.array(stableKeySchema),
    key: stableKeySchema,
    negativeExamples: z.array(z.string().trim().min(1)).min(1),
    obligation: z.enum(['REQUIRED', 'SUPPORTING']),
    ownerCriterionKey: stableKeySchema,
    pointsByCriterion: z.record(stableKeySchema, statusPointsSchema),
    polarity: z.enum(['POSITIVE', 'NEGATIVE']),
    positiveExamples: z.array(z.string().trim().min(1)).min(1),
    requiredFromLevelKey: levelKeySchema,
    sharedWithCriterionKeys: z.array(stableKeySchema),
    templates: z
      .object({
        ambiguous: z.string().trim().min(1),
        contradicted: z.string().trim().min(1),
        notDemonstrated: z.string().trim().min(1),
        supported: z.string().trim().min(1),
      })
      .strict(),
    type: z.enum([
      'FACT',
      'RELATION',
      'JUSTIFICATION',
      'CONTRADICTION',
      'HOLISTIC',
    ]),
  })
  .strict();

const rubricCriterionSchema = z
  .object({
    description: z.string().trim().min(1),
    key: stableKeySchema,
    label: z.string().trim().min(1),
    levels: z
      .array(
        z
          .object({
            key: levelKeySchema,
            minimumPoints: z.number().int(),
          })
          .strict(),
      )
      .length(3),
    weight: z.number().int().positive(),
  })
  .strict();

export const executableRubricSchema = z
  .object({
    eligibility: z.enum([
      'FULLY_COMPILABLE',
      'PARTIALLY_COMPILABLE',
      'UNSUPPORTED_AUTONOMOUSLY',
    ]),
    elements: z.array(rubricElementSchema).min(1).max(64),
    language: z.string().trim().min(2),
    lifecycle: z.enum(['DRAFT', 'PUBLISHED', 'RETIRED']),
    modality: z.literal('WRITING'),
    progressionAuthority: z.literal('NONE'),
    rubricKey: stableKeySchema,
    rubricVersion: z.string().trim().min(1),
    ruleSetVersion: z.string().trim().min(1),
    schemaVersion: z.literal(1),
    scorePolicy: z
      .object({
        indicativeScoreEnabled: z.boolean(),
        publishExactScoreWhenAmbiguousLevelIsStable: z.literal(false),
      })
      .strict(),
    criteria: z.array(rubricCriterionSchema).min(1).max(12),
  })
  .strict();

export const evidencePassSchema = z
  .object({
    elements: z.array(
      z
        .object({
          confidence: z.number().min(0).max(1).nullable(),
          contradictions: z.array(z.string().trim().min(1)),
          elementKey: stableKeySchema,
          evidenceSpans: z.array(evidenceSpanSchema),
          status: atomicEvidenceStatusSchema,
        })
        .strict(),
    ),
    pipelineFingerprint: sha256Schema,
    role: z.enum(['EVIDENCE_RESEARCHER', 'EVIDENCE_FALSIFIER']),
  })
  .strict();

export type ExecutableRubric = z.infer<typeof executableRubricSchema>;
export type EvidencePass = z.infer<typeof evidencePassSchema>;
export type AtomicEvidenceStatus = z.infer<typeof atomicEvidenceStatusSchema>;
type ResolvedAtomicEvidenceStatus = z.infer<
  typeof resolvedAtomicEvidenceStatusSchema
>;
export type EvidenceSpan = z.infer<typeof evidenceSpanSchema>;

export type CompiledExecutableRubric = {
  rubric: ExecutableRubric;
  rubricFingerprint: string;
};

export type ConsolidatedElementEvidence = {
  contradictions: string[];
  elementKey: string;
  evidenceSpans: EvidenceSpan[];
  researcherConfidence: number | null;
  status: AtomicEvidenceStatus;
  verifierConfidence: number | null;
};

export type EvidenceCertificate = {
  certificateVersion: 1;
  correctionState:
    | 'FEEDBACK_READY'
    | 'REVISION_REQUIRED'
    | 'CLARIFICATION_REQUIRED';
  criteria: Array<{
    criterionKey: string;
    exactPoints: number | null;
    levelKey: z.infer<typeof levelKeySchema> | null;
    possibleLevelKeys: Array<z.infer<typeof levelKeySchema>>;
    possiblePoints: number[];
    ruleId: string;
  }>;
  elements: ConsolidatedElementEvidence[];
  feedback: Array<{
    criterionKey: string;
    elementKey: string;
    message: string;
    status: AtomicEvidenceStatus;
  }>;
  indicativeScore: number | null;
  pipelineFingerprint: string;
  progressionEffect: 'NONE';
  rubricFingerprint: string;
  rubricKey: string;
  rubricVersion: string;
  ruleSetVersion: string;
};

export class RubricCompilationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'RubricCompilationError';
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalize(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map(canonicalize);
  }
  if (input && typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => [key, canonicalize(value)]),
    );
  }
  return input;
}

export function rubricFingerprint(rubric: ExecutableRubric): string {
  return sha256(JSON.stringify(canonicalize(rubric)));
}

function assertUnique(values: string[], code: string): void {
  if (new Set(values).size !== values.length) {
    throw new RubricCompilationError(code, `${code}: duplicate stable keys.`);
  }
}

function requireValue<T>(value: T | undefined, code: string): T {
  if (value === undefined) {
    throw new Error(code);
  }
  return value;
}

function requireNumber(value: number | null | undefined, code: string): number {
  if (value === null || value === undefined) {
    throw new Error(code);
  }
  return value;
}

function levelForPoints(
  criterion: ExecutableRubric['criteria'][number],
  points: number,
): z.infer<typeof levelKeySchema> {
  const level = [...criterion.levels]
    .sort((left, right) => left.minimumPoints - right.minimumPoints)
    .filter(({ minimumPoints }) => minimumPoints <= points)
    .at(-1);
  if (!level) {
    throw new RubricCompilationError(
      'UNCOVERED_POINT_COMBINATION',
      `No level covers ${criterion.key} at ${points} points.`,
    );
  }
  return level.key;
}

function allPointTotals(pointOptions: number[][]): number[] {
  let totals = [0];
  pointOptions.forEach((options) => {
    totals = totals.flatMap((total) => options.map((option) => total + option));
    if (totals.length > 100_000) {
      throw new RubricCompilationError(
        'COMPILATION_STATE_SPACE_TOO_LARGE',
        'The rubric produces too many atomic status combinations.',
      );
    }
  });
  return [...new Set(totals)].sort((left, right) => left - right);
}

function validateElementPolarity(
  element: ExecutableRubric['elements'][number],
): void {
  Object.entries(element.pointsByCriterion).forEach(([criterionKey, points]) => {
    if (
      element.polarity === 'POSITIVE' &&
      !(
        points.SUPPORTED >= points.NOT_DEMONSTRATED &&
        points.NOT_DEMONSTRATED >= points.CONTRADICTED
      )
    ) {
      throw new RubricCompilationError(
        'NON_MONOTONIC_POSITIVE_ELEMENT',
        `${element.key} can reduce ${criterionKey} when valid evidence is added.`,
      );
    }
    if (
      element.polarity === 'NEGATIVE' &&
      !(
        points.SUPPORTED <= points.NOT_DEMONSTRATED &&
        points.SUPPORTED <= points.CONTRADICTED
      )
    ) {
      throw new RubricCompilationError(
        'NON_MONOTONIC_NEGATIVE_ELEMENT',
        `${element.key} rewards a demonstrated defect on ${criterionKey}.`,
      );
    }
  });
}

export function compileExecutableRubric(input: unknown): CompiledExecutableRubric {
  const rubric = executableRubricSchema.parse(input);
  assertUnique(
    rubric.criteria.map(({ key }) => key),
    'DUPLICATE_CRITERION_KEY',
  );
  assertUnique(
    rubric.elements.map(({ key }) => key),
    'DUPLICATE_ELEMENT_KEY',
  );

  if (rubric.criteria.reduce((sum, criterion) => sum + criterion.weight, 0) !== 100) {
    throw new RubricCompilationError(
      'CRITERION_WEIGHTS_MUST_TOTAL_100',
      'Criterion weights must total 100.',
    );
  }

  const criteriaByKey = new Map(rubric.criteria.map((criterion) => [criterion.key, criterion]));
  rubric.criteria.forEach((criterion) => {
    const levelKeys = criterion.levels.map(({ key }) => key);
    if (
      levelKeys.join('|') !== 'insufficient|partial|mastered' ||
      criterion.levels.some(
        (level, index) =>
          index > 0 &&
          level.minimumPoints <=
            requireValue(criterion.levels.at(index - 1), 'MISSING_PREVIOUS_LEVEL')
              .minimumPoints,
      )
    ) {
      throw new RubricCompilationError(
        'INVALID_LEVEL_ORDER',
        `${criterion.key} must declare strictly increasing insufficient, partial and mastered levels.`,
      );
    }
  });

  rubric.elements.forEach((element) => {
    if (!criteriaByKey.has(element.ownerCriterionKey)) {
      throw new RubricCompilationError(
        'UNKNOWN_ELEMENT_OWNER',
        `${element.key} references an unknown owner criterion.`,
      );
    }
    if (rubric.eligibility === 'FULLY_COMPILABLE' && element.type === 'HOLISTIC') {
      throw new RubricCompilationError(
        'HOLISTIC_ELEMENT_NOT_FULLY_COMPILABLE',
        `${element.key} is holistic and cannot belong to a fully compilable rubric.`,
      );
    }

    const authorizedCriteria = new Set([
      element.ownerCriterionKey,
      ...element.sharedWithCriterionKeys,
    ]);
    const pointCriteria = Object.keys(element.pointsByCriterion);
    assertUnique(element.sharedWithCriterionKeys, 'DUPLICATE_SHARED_CRITERION');
    assertUnique(element.excludedCriterionKeys, 'DUPLICATE_EXCLUDED_CRITERION');
    if (
      element.sharedWithCriterionKeys.some((key) => !criteriaByKey.has(key)) ||
      element.excludedCriterionKeys.some((key) => !criteriaByKey.has(key))
    ) {
      throw new RubricCompilationError(
        'UNKNOWN_ELEMENT_CRITERION_REFERENCE',
        `${element.key} references an unknown shared or excluded criterion.`,
      );
    }
    if (
      element.excludedCriterionKeys.some((key) => authorizedCriteria.has(key)) ||
      pointCriteria.some((key) => !authorizedCriteria.has(key)) ||
      [...authorizedCriteria].some((key) => !pointCriteria.includes(key))
    ) {
      throw new RubricCompilationError(
        'UNAUTHORIZED_CROSS_CRITERION_EFFECT',
        `${element.key} can affect only its owner and explicitly shared criteria.`,
      );
    }
    validateElementPolarity(element);

    if (element.type === 'RELATION' && element.evidenceRule.minimumSpans < 2) {
      throw new RubricCompilationError(
        'RELATION_REQUIRES_MULTIPLE_SPANS',
        `${element.key} must require at least two evidence spans.`,
      );
    }
  });

  rubric.criteria.forEach((criterion) => {
    const affectingElements = rubric.elements.filter((element) =>
      Object.hasOwn(element.pointsByCriterion, criterion.key),
    );
    if (affectingElements.length === 0) {
      throw new RubricCompilationError(
        'CRITERION_WITHOUT_ELEMENTS',
        `${criterion.key} has no executable element.`,
      );
    }
    const totals = allPointTotals(
      affectingElements.map((element) => {
        const points = requireValue(
          element.pointsByCriterion[criterion.key],
          'MISSING_CRITERION_POINT_MAPPING',
        );
        return [points.SUPPORTED, points.CONTRADICTED, points.NOT_DEMONSTRATED];
      }),
    );
    const reachableLevels = new Set(totals.map((points) => levelForPoints(criterion, points)));
    criterion.levels.forEach(({ key }) => {
      if (!reachableLevels.has(key)) {
        throw new RubricCompilationError(
          'UNREACHABLE_LEVEL',
          `${criterion.key}/${key} cannot be reached by any atomic status combination.`,
        );
      }
    });
  });

  return { rubric, rubricFingerprint: rubricFingerprint(rubric) };
}

export function evidenceSpanFor(responseText: string, start: number, end: number): EvidenceSpan {
  const text = responseText.slice(start, end);
  if (!text) {
    throw new Error('EVIDENCE_SPAN_EMPTY');
  }
  return { end, sha256: sha256(text), start, text };
}

function validateEvidenceSpan(responseText: string, span: EvidenceSpan): void {
  const exactText = responseText.slice(span.start, span.end);
  if (exactText !== span.text || sha256(exactText) !== span.sha256) {
    throw new Error('EVIDENCE_SPAN_MISMATCH');
  }
}

function indexEvidencePass(
  compiled: CompiledExecutableRubric,
  responseText: string,
  input: unknown,
): { pass: EvidencePass; elements: Map<string, EvidencePass['elements'][number]> } {
  const pass = evidencePassSchema.parse(input);
  const expectedElementKeys = new Set(compiled.rubric.elements.map(({ key }) => key));
  const actualElementKeys = pass.elements.map(({ elementKey }) => elementKey);
  assertUnique(actualElementKeys, 'DUPLICATE_EVIDENCE_ELEMENT');
  if (
    actualElementKeys.length !== expectedElementKeys.size ||
    actualElementKeys.some((key) => !expectedElementKeys.has(key))
  ) {
    throw new Error('EVIDENCE_ELEMENT_COVERAGE_MISMATCH');
  }
  pass.elements.forEach((finding) => {
    const element = requireValue(
      compiled.rubric.elements.find(({ key }) => key === finding.elementKey),
      'UNKNOWN_EVIDENCE_ELEMENT',
    );
    finding.evidenceSpans.forEach((span) => validateEvidenceSpan(responseText, span));
    if (
      (finding.status === 'SUPPORTED' || finding.status === 'CONTRADICTED') &&
      (finding.evidenceSpans.length < element.evidenceRule.minimumSpans ||
        finding.evidenceSpans.length > element.evidenceRule.maximumSpans)
    ) {
      throw new Error('EVIDENCE_SPAN_CARDINALITY_INVALID');
    }
  });
  return {
    elements: new Map(pass.elements.map((element) => [element.elementKey, element])),
    pass,
  };
}

export function validateEvidencePass(input: {
  compiled: CompiledExecutableRubric;
  pass: unknown;
  responseText: string;
}): EvidencePass {
  return indexEvidencePass(input.compiled, input.responseText, input.pass).pass;
}

function uniqueSpans(spans: EvidenceSpan[]): EvidenceSpan[] {
  return [
    ...new Map(
      spans.map((span) => [`${span.start}:${span.end}:${span.sha256}`, span]),
    ).values(),
  ].sort((left, right) => left.start - right.start || left.end - right.end);
}

export function consolidateIndependentEvidence(input: {
  compiled: CompiledExecutableRubric;
  falsifier: unknown;
  researcher: unknown;
  responseText: string;
}): { elements: ConsolidatedElementEvidence[]; pipelineFingerprint: string } {
  const researcher = indexEvidencePass(
    input.compiled,
    input.responseText,
    input.researcher,
  );
  const falsifier = indexEvidencePass(
    input.compiled,
    input.responseText,
    input.falsifier,
  );
  if (
    researcher.pass.role !== 'EVIDENCE_RESEARCHER' ||
    falsifier.pass.role !== 'EVIDENCE_FALSIFIER'
  ) {
    throw new Error('EVIDENCE_ROLE_MISMATCH');
  }

  const pipelineFingerprint = sha256(
    `${researcher.pass.pipelineFingerprint}:${falsifier.pass.pipelineFingerprint}`,
  );
  const elements = input.compiled.rubric.elements.map(({ key }) => {
    const researchFinding = requireValue(
      researcher.elements.get(key),
      'MISSING_RESEARCHER_ELEMENT',
    );
    const falsifierFinding = requireValue(
      falsifier.elements.get(key),
      'MISSING_FALSIFIER_ELEMENT',
    );
    return {
      contradictions: [
        ...new Set([
          ...researchFinding.contradictions,
          ...falsifierFinding.contradictions,
        ]),
      ],
      elementKey: key,
      evidenceSpans: uniqueSpans([
        ...researchFinding.evidenceSpans,
        ...falsifierFinding.evidenceSpans,
      ]),
      researcherConfidence: researchFinding.confidence,
      status:
        researchFinding.status === falsifierFinding.status
          ? researchFinding.status
          : 'AMBIGUOUS',
      verifierConfidence: falsifierFinding.confidence,
    } satisfies ConsolidatedElementEvidence;
  });
  return { elements, pipelineFingerprint };
}

function possibleStatuses(
  element: ExecutableRubric['elements'][number],
  status: AtomicEvidenceStatus,
): ResolvedAtomicEvidenceStatus[] {
  return status === 'AMBIGUOUS' ? element.ambiguousResolutions : [status];
}

function criterionPossibilities(input: {
  criterion: ExecutableRubric['criteria'][number];
  elements: ConsolidatedElementEvidence[];
  rubric: ExecutableRubric;
}): { levels: Array<z.infer<typeof levelKeySchema>>; points: number[] } {
  const pointOptions = input.rubric.elements
    .filter((element) => Object.hasOwn(element.pointsByCriterion, input.criterion.key))
    .map((element) => {
      const evidence = requireValue(
        input.elements.find(({ elementKey }) => elementKey === element.key),
        'MISSING_CONSOLIDATED_ELEMENT',
      );
      const statusPoints = requireValue(
        element.pointsByCriterion[input.criterion.key],
        'MISSING_CRITERION_POINT_MAPPING',
      );
      return possibleStatuses(element, evidence.status).map((status) => statusPoints[status]);
    });
  const points = allPointTotals(pointOptions);
  const levels = [
    ...new Set(points.map((value) => levelForPoints(input.criterion, value))),
  ];
  return { levels, points };
}

function templateForStatus(
  element: ExecutableRubric['elements'][number],
  status: AtomicEvidenceStatus,
): string {
  if (status === 'SUPPORTED') return element.templates.supported;
  if (status === 'CONTRADICTED') return element.templates.contradicted;
  if (status === 'NOT_DEMONSTRATED') return element.templates.notDemonstrated;
  return element.templates.ambiguous;
}

export function buildEvidenceCertificate(input: {
  compiled: CompiledExecutableRubric;
  consolidatedEvidence: {
    elements: ConsolidatedElementEvidence[];
    pipelineFingerprint: string;
  };
}): EvidenceCertificate {
  const { rubric } = input.compiled;
  const expectedKeys = rubric.elements.map(({ key }) => key);
  assertUnique(
    input.consolidatedEvidence.elements.map(({ elementKey }) => elementKey),
    'DUPLICATE_CONSOLIDATED_ELEMENT',
  );
  if (
    input.consolidatedEvidence.elements.length !== expectedKeys.length ||
    expectedKeys.some(
      (key) =>
        !input.consolidatedEvidence.elements.some(
          ({ elementKey }) => elementKey === key,
        ),
    )
  ) {
    throw new Error('CONSOLIDATED_ELEMENT_COVERAGE_MISMATCH');
  }

  const criteria = rubric.criteria.map((criterion) => {
    const possibilities = criterionPossibilities({
      criterion,
      elements: input.consolidatedEvidence.elements,
      rubric,
    });
    return {
      criterionKey: criterion.key,
      exactPoints: possibilities.points.length === 1 ? (possibilities.points.at(0) ?? null) : null,
      levelKey: possibilities.levels.length === 1 ? (possibilities.levels.at(0) ?? null) : null,
      possibleLevelKeys: possibilities.levels,
      possiblePoints: possibilities.points,
      ruleId: `${rubric.rubricKey}:${rubric.ruleSetVersion}:${criterion.key}`,
    };
  });

  const hasMaterialAmbiguity = criteria.some(({ possibleLevelKeys }) => possibleLevelKeys.length > 1);
  const requiredRevision = rubric.elements.some((element) => {
    const evidence = requireValue(
      input.consolidatedEvidence.elements.find(
        ({ elementKey }) => elementKey === element.key,
      ),
      'MISSING_CONSOLIDATED_ELEMENT',
    );
    if (element.polarity === 'NEGATIVE') {
      return evidence.status === 'SUPPORTED';
    }
    if (element.obligation !== 'REQUIRED') return false;
    return (
      evidence.status === 'NOT_DEMONSTRATED' || evidence.status === 'CONTRADICTED'
    );
  });
  const correctionState = hasMaterialAmbiguity
    ? 'CLARIFICATION_REQUIRED'
    : requiredRevision
      ? 'REVISION_REQUIRED'
      : 'FEEDBACK_READY';

  const exactCriterionPoints = criteria.map(({ exactPoints }) => exactPoints);
  const indicativeScore =
    rubric.scorePolicy.indicativeScoreEnabled &&
    !hasMaterialAmbiguity &&
    exactCriterionPoints.every((points) => points !== null)
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(
              rubric.criteria.reduce((sum, criterion, index) => {
                const points = requireNumber(
                  exactCriterionPoints.at(index),
                  'MISSING_EXACT_CRITERION_POINTS',
                );
                return sum + points * (criterion.weight / 100);
              }, 0) * 100,
            ) / 100,
          ),
        )
      : null;

  return {
    certificateVersion: 1,
    correctionState,
    criteria,
    elements: input.consolidatedEvidence.elements,
    feedback: rubric.elements.map((element) => {
      const evidence = requireValue(
        input.consolidatedEvidence.elements.find(
          ({ elementKey }) => elementKey === element.key,
        ),
        'MISSING_CONSOLIDATED_ELEMENT',
      );
      return {
        criterionKey: element.ownerCriterionKey,
        elementKey: element.key,
        message: templateForStatus(element, evidence.status),
        status: evidence.status,
      };
    }),
    indicativeScore,
    pipelineFingerprint: input.consolidatedEvidence.pipelineFingerprint,
    progressionEffect: 'NONE',
    rubricFingerprint: input.compiled.rubricFingerprint,
    rubricKey: rubric.rubricKey,
    rubricVersion: rubric.rubricVersion,
    ruleSetVersion: rubric.ruleSetVersion,
  };
}
