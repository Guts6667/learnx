import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  buildEvidenceCertificateV2,
  compileExecutableRubricV2,
  consolidateIndependentEvidenceV2,
  evidenceSpanForV2,
  type AtomicEvidenceStatusV2,
  type CompiledExecutableRubricV2,
  type EvidenceCertificateV2,
  type EvidenceFindingV2,
  type EvidencePassV2,
  type ExecutableRubricV2,
} from './executable-rubric-engine-v2.js';

const stableKeySchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const frameworkSchema = z.enum(['PICO', 'PECO', 'SPIDER', 'PCC']);
const statusSchema = z.enum([
  'SUPPORTED',
  'NOT_DEMONSTRATED',
  'EXPLICITLY_REFUTED',
  'CONTRADICTED',
  'AMBIGUOUS',
]);
const levelSchema = z.enum(['insufficient', 'partial', 'mastered']);

export const MECHANICAL_ORACLE_V21_FINGERPRINT =
  '2c35125ea438cf1686ae88b01ecdb28bc304a3c9b9af6d45cff81f37306af3c2';

const segmentSchema = z
  .object({
    kind: z.enum(['EVIDENCE', 'DISTRACTOR', 'INJECTION', 'CANARY']),
    key: stableKeySchema,
    text: z.string().min(1),
  })
  .strict();

const findingSpecSchema = z
  .object({
    conflicts: z.array(
      z
        .object({
          kind: z.enum([
            'INTERNAL_CONFLICT',
            'CONTEXT_MISMATCH',
            'FRAMEWORK_MAPPING_MISMATCH',
          ]),
          segmentKeys: z.array(stableKeySchema).max(8),
          trustedClaimKeys: z.array(stableKeySchema),
        })
        .strict(),
    ),
    evidenceSegmentKeys: z.array(stableKeySchema).max(8),
    frameworkConditions: z.record(
      stableKeySchema,
      z.array(stableKeySchema).min(1).max(8),
    ),
    frameworkKey: frameworkSchema.nullable(),
    relationBindings: z.record(
      z.string().trim().min(1),
      z.array(stableKeySchema).min(1).max(8),
    ),
    status: statusSchema,
    trustedClaimKeys: z.array(stableKeySchema),
  })
  .strict();

const criterionLevelsSchema = z.record(stableKeySchema, levelSchema.nullable());

const oracleCaseSchema = z
  .object({
    caseId: stableKeySchema,
    expected: z
      .object({
        correctionState: z.enum([
          'FEEDBACK_READY',
          'REVISION_REQUIRED',
          'CLARIFICATION_REQUIRED',
        ]),
        criterionLevels: criterionLevelsSchema,
      })
      .strict(),
    expectedDisagreementElementKeys: z.array(stableKeySchema).default([]),
    findingOverrides: z.record(stableKeySchema, findingSpecSchema),
    falsifierFindingOverrides: z
      .record(stableKeySchema, findingSpecSchema)
      .default({}),
    invariant: z
      .object({
        changedCriterionKeys: z.array(stableKeySchema),
        changedElementKeys: z.array(stableKeySchema),
        kind: z.enum([
          'INDEPENDENT',
          'EXACT_INVARIANCE',
          'LOCALITY',
          'MONOTONIC_NON_DECREASING',
        ]),
        parentCaseId: stableKeySchema.nullable(),
      })
      .strict(),
    responseSegmentKeys: z.array(stableKeySchema).min(1),
    transformation: z.enum([
      'BASELINE',
      'MINIMAL_PAIR_LOCALITY',
      'MONOTONICITY',
      'METAMORPHIC_INVARIANCE',
      'MATERIAL_AMBIGUITY',
      'NON_MATERIAL_AMBIGUITY',
      'CONTRADICTION',
      'EXPLICIT_REFUTATION',
      'CONDITIONAL_FRAMEWORK',
      'INJECTION_INVARIANCE',
    ]),
  })
  .strict();

const mutationCaseSchema = z
  .object({
    expectedError: z.string().trim().min(1),
    mutationId: stableKeySchema,
    operator: z.enum([
      'FOREIGN_OWNER',
      'SHARED_OWNER',
      'NON_MONOTONIC_RULE',
      'UNREACHABLE_LEVEL',
      'UNCOVERED_COMBINATION',
      'MISSING_FRAMEWORK_CONDITION',
      'PROMPT_HASH_DRIFT',
    ]),
  })
  .strict();

export const mechanicalOracleV21Schema = z
  .object({
    authorityBoundary: z
      .object({
        candidateMaySetLevel: z.literal(false),
        candidateMaySetProgression: z.literal(false),
        candidateMaySetScore: z.literal(false),
        humanReviewClaimed: z.literal(false),
        offlineOnly: z.literal(true),
      })
      .strict(),
    baselineFindings: z.record(stableKeySchema, findingSpecSchema),
    cases: z.array(oracleCaseSchema).min(16),
    corpusId: stableKeySchema,
    corpusKind: z.literal('MECHANICAL_EXECUTABLE_ORACLE_V2_1'),
    corpusVersion: z.string().trim().min(1),
    language: z.literal('fr-FR'),
    modality: z.literal('WRITING'),
    mutationCases: z.array(mutationCaseSchema).length(7),
    oracleAuthority: z.literal('CONSTRUCTION_VECTORS'),
    rubric: z
      .object({
        fingerprint: sha256Schema,
        key: stableKeySchema,
        version: z.string().trim().min(1),
      })
      .strict(),
    schemaVersion: z.literal(21),
    segments: z.array(segmentSchema).min(12),
  })
  .strict();

export type MechanicalOracleV21 = z.infer<typeof mechanicalOracleV21Schema>;
type FindingSpec = z.infer<typeof findingSpecSchema>;
type OracleCase = z.infer<typeof oracleCaseSchema>;

export type MechanicalOracleV21Validation = {
  caseCertificates: Map<string, EvidenceCertificateV2>;
  corpus: MechanicalOracleV21;
  corpusFingerprint: string;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function assertUnique(values: string[], error: string): void {
  if (new Set(values).size !== values.length) throw new Error(error);
}

function required<T>(value: T | undefined, error: string): T {
  if (value === undefined) throw new Error(error);
  return value;
}

function materializeFindingSpecs(input: {
  baseline: Record<string, FindingSpec>;
  overrides: Record<string, FindingSpec>;
}): Record<string, FindingSpec> {
  return Object.fromEntries(
    Object.entries(input.baseline).map(([elementKey, baseline]) => [
      elementKey,
      structuredClone(input.overrides[elementKey] ?? baseline),
    ]),
  );
}

function responseTextForCase(input: {
  oracleCase: OracleCase;
  segmentsByKey: Map<string, z.infer<typeof segmentSchema>>;
}): string {
  return input.oracleCase.responseSegmentKeys
    .map((key) => required(input.segmentsByKey.get(key), 'UNKNOWN_RESPONSE_SEGMENT').text)
    .join(' ');
}

function segmentSpan(input: {
  responseText: string;
  segment: z.infer<typeof segmentSchema>;
}): ReturnType<typeof evidenceSpanForV2> {
  const start = input.responseText.indexOf(input.segment.text);
  if (start < 0 || input.responseText.indexOf(input.segment.text, start + 1) >= 0) {
    throw new Error('ORACLE_SEGMENT_OCCURRENCE_NOT_UNIQUE');
  }
  return evidenceSpanForV2(
    input.responseText,
    start,
    start + input.segment.text.length,
  );
}

function findingFromSpec(input: {
  elementKey: string;
  responseText: string;
  segmentsByKey: Map<string, z.infer<typeof segmentSchema>>;
  spec: FindingSpec;
}): EvidenceFindingV2 {
  const span = (segmentKey: string) =>
    segmentSpan({
      responseText: input.responseText,
      segment: required(input.segmentsByKey.get(segmentKey), 'UNKNOWN_FINDING_SEGMENT'),
    });
  return {
    confidence: null,
    conflicts: input.spec.conflicts.map((conflict) => ({
      evidenceSpans: conflict.segmentKeys.map(span),
      kind: conflict.kind,
      scenarioKey: input.elementKey.startsWith('project-a-')
        ? 'project-a'
        : 'project-b',
      trustedClaimKeys: conflict.trustedClaimKeys,
    })),
    elementKey: input.elementKey,
    evidenceSpans: input.spec.evidenceSegmentKeys.map(span),
    frameworkConditions: Object.entries(input.spec.frameworkConditions).map(
      ([conditionKey, segmentKeys]) => ({
        conditionKey,
        evidenceSpans: segmentKeys.map(span),
      }),
    ),
    frameworkKey: input.spec.frameworkKey,
    relationBindings: Object.entries(input.spec.relationBindings).map(
      ([role, segmentKeys]) => ({ evidenceSpans: segmentKeys.map(span), role }),
    ),
    status: input.spec.status,
    trustedClaimKeys: input.spec.trustedClaimKeys,
  };
}

function passForCase(input: {
  compiled: CompiledExecutableRubricV2;
  findings: Record<string, FindingSpec>;
  responseText: string;
  role: EvidencePassV2['role'];
  segmentsByKey: Map<string, z.infer<typeof segmentSchema>>;
}): EvidencePassV2 {
  return {
    findings: input.compiled.rubric.elements.map((element) =>
      findingFromSpec({
        elementKey: element.key,
        responseText: input.responseText,
        segmentsByKey: input.segmentsByKey,
        spec: required(input.findings[element.key], 'ORACLE_FINDING_MISSING'),
      }),
    ),
    pipelineFingerprint:
      input.role === 'EVIDENCE_RESEARCHER' ? 'c'.repeat(64) : 'd'.repeat(64),
    role: input.role,
  };
}

function levelsByCriterion(certificate: EvidenceCertificateV2) {
  return Object.fromEntries(
    certificate.criteria.map(({ criterionKey, levelKey }) => [criterionKey, levelKey]),
  );
}

function levelRank(level: string | null): number {
  if (level === 'insufficient') return 0;
  if (level === 'partial') return 1;
  if (level === 'mastered') return 2;
  return -1;
}

function changedKeys(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): string[] {
  return [...new Set([...Object.keys(left), ...Object.keys(right)])]
    .filter(
      (key) =>
        JSON.stringify(canonicalize(left[key])) !==
        JSON.stringify(canonicalize(right[key])),
    )
    .sort();
}

function validateInvariant(input: {
  certificates: Map<string, EvidenceCertificateV2>;
  findingVectors: Map<string, Record<string, AtomicEvidenceStatusV2>>;
  oracleCase: OracleCase;
}): void {
  const invariant = input.oracleCase.invariant;
  if (invariant.kind === 'INDEPENDENT') {
    if (invariant.parentCaseId !== null) {
      throw new Error('INDEPENDENT_CASE_CANNOT_HAVE_PARENT');
    }
    return;
  }
  if (!invariant.parentCaseId) throw new Error('ORACLE_INVARIANT_PARENT_MISSING');
  const parentCertificate = required(
    input.certificates.get(invariant.parentCaseId),
    'ORACLE_INVARIANT_PARENT_UNKNOWN',
  );
  const childCertificate = required(
    input.certificates.get(input.oracleCase.caseId),
    'ORACLE_CHILD_CERTIFICATE_MISSING',
  );
  const parentFindings = required(
    input.findingVectors.get(invariant.parentCaseId),
    'ORACLE_PARENT_FINDINGS_MISSING',
  );
  const childFindings = required(
    input.findingVectors.get(input.oracleCase.caseId),
    'ORACLE_CHILD_FINDINGS_MISSING',
  );
  const actualChangedElements = changedKeys(parentFindings, childFindings);
  if (
    actualChangedElements.join('|') !==
    [...invariant.changedElementKeys].sort().join('|')
  ) {
    throw new Error(`ORACLE_ELEMENT_LOCALITY_MISMATCH:${input.oracleCase.caseId}`);
  }
  const parentLevels = levelsByCriterion(parentCertificate);
  const childLevels = levelsByCriterion(childCertificate);
  const actualChangedCriteria = changedKeys(parentLevels, childLevels);
  if (
    actualChangedCriteria.join('|') !==
    [...invariant.changedCriterionKeys].sort().join('|')
  ) {
    throw new Error(`ORACLE_CRITERION_LOCALITY_MISMATCH:${input.oracleCase.caseId}`);
  }
  if (invariant.kind === 'EXACT_INVARIANCE') {
    if (
      childCertificate.correctionState !== parentCertificate.correctionState ||
      actualChangedElements.length > 0 ||
      actualChangedCriteria.length > 0
    ) {
      throw new Error(`ORACLE_EXACT_INVARIANCE_MISMATCH:${input.oracleCase.caseId}`);
    }
  }
  if (invariant.kind === 'MONOTONIC_NON_DECREASING') {
    for (const criterionKey of Object.keys(childLevels)) {
      if (
        levelRank(childLevels[criterionKey] as string | null) <
        levelRank(parentLevels[criterionKey] as string | null)
      ) {
        throw new Error(`ORACLE_MONOTONICITY_MISMATCH:${input.oracleCase.caseId}`);
      }
    }
  }
}

function applyMutation(
  rubric: ExecutableRubricV2,
  operator: z.infer<typeof mutationCaseSchema>['operator'],
): void {
  const frameworkCriterion = required(
    rubric.criteria.find(({ key }) => key === 'framework-decision'),
    'MUTATION_CRITERION_MISSING',
  );
  if (operator === 'FOREIGN_OWNER') {
    required(
      rubric.criteria.find(({ key }) => key === 'choice-rationale'),
      'MUTATION_CRITERION_MISSING',
    ).elementKeys.push('project-a-framework-choice');
    return;
  }
  if (operator === 'SHARED_OWNER') {
    required(rubric.elements.at(0), 'MUTATION_ELEMENT_MISSING').sharedWithCriterionKeys = [
      'dossier-fidelity',
    ];
    return;
  }
  if (operator === 'NON_MONOTONIC_RULE') {
    required(
      frameworkCriterion.levels.find(({ key }) => key === 'partial'),
      'MUTATION_LEVEL_MISSING',
    ).when = {
      supportedCount: { maximum: 0, minimum: 0 },
    };
    required(
      frameworkCriterion.levels.find(({ key }) => key === 'insufficient'),
      'MUTATION_LEVEL_MISSING',
    ).when = {
      supportedCount: { maximum: 3, minimum: 1 },
    };
    return;
  }
  if (operator === 'UNREACHABLE_LEVEL') {
    required(
      frameworkCriterion.levels.find(({ key }) => key === 'partial'),
      'MUTATION_LEVEL_MISSING',
    ).when = {
      supportedCount: { maximum: 5, minimum: 5 },
    };
    required(
      frameworkCriterion.levels.find(({ key }) => key === 'insufficient'),
      'MUTATION_LEVEL_MISSING',
    ).when = {
      supportedCount: { maximum: 3, minimum: 0 },
    };
    return;
  }
  if (operator === 'UNCOVERED_COMBINATION') {
    required(
      frameworkCriterion.levels.find(({ key }) => key === 'partial'),
      'MUTATION_LEVEL_MISSING',
    ).when = {
      supportedCount: { maximum: 2, minimum: 1 },
    };
    return;
  }
  if (operator === 'MISSING_FRAMEWORK_CONDITION') {
    delete required(
      rubric.frameworkPolicy.scenarioMappings.find(
        ({ scenarioKey }) => scenarioKey === 'project-a',
      ),
      'MUTATION_MAPPING_MISSING',
    ).conditionalRules.PECO;
    return;
  }
  rubric.activityBinding.prompt.text += ' dérive';
}

function validateMutationCases(input: {
  compiled: CompiledExecutableRubricV2;
  corpus: MechanicalOracleV21;
}): void {
  assertUnique(
    input.corpus.mutationCases.map(({ mutationId }) => mutationId),
    'ORACLE_DUPLICATE_MUTATION_CASE',
  );
  const expectedErrorsByOperator = {
    FOREIGN_OWNER: 'CRITERION_CONTAINS_FOREIGN_ELEMENT',
    MISSING_FRAMEWORK_CONDITION: 'INCOMPLETE_CONDITIONAL_FRAMEWORK_RULES',
    NON_MONOTONIC_RULE: 'NON_MONOTONIC_LEVEL_RULE',
    PROMPT_HASH_DRIFT: 'PROMPT_HASH_MISMATCH',
    SHARED_OWNER: 'SHARED_ELEMENT_NOT_AUTHORIZED_FOR_PILOT',
    UNCOVERED_COMBINATION: 'UNCOVERED_STATUS_COMBINATION',
    UNREACHABLE_LEVEL: 'UNREACHABLE_LEVEL',
  } satisfies Record<
    z.infer<typeof mutationCaseSchema>['operator'],
    string
  >;
  const expectedOperators = Object.keys(expectedErrorsByOperator).sort();
  const actualOperators = input.corpus.mutationCases
    .map(({ operator }) => operator)
    .sort();
  if (actualOperators.join('|') !== expectedOperators.join('|')) {
    throw new Error('ORACLE_MUTATION_OPERATOR_COVERAGE_MISMATCH');
  }
  for (const mutation of input.corpus.mutationCases) {
    if (mutation.expectedError !== expectedErrorsByOperator[mutation.operator]) {
      throw new Error(`ORACLE_MUTATION_EXPECTATION_MISMATCH:${mutation.mutationId}`);
    }
    const mutated = structuredClone(input.compiled.rubric);
    applyMutation(mutated, mutation.operator);
    let observed = '';
    try {
      compileExecutableRubricV2(mutated);
    } catch (error) {
      observed = error instanceof Error ? error.message : String(error);
    }
    if (!observed.includes(mutation.expectedError)) {
      throw new Error(
        `ORACLE_MUTATION_NOT_DETECTED:${mutation.mutationId}:${observed}`,
      );
    }
  }
}

export function validateMechanicalOracleV21(input: {
  compiled: CompiledExecutableRubricV2;
  corpus: unknown;
}): MechanicalOracleV21Validation {
  const corpus = mechanicalOracleV21Schema.parse(input.corpus);
  if (
    corpus.rubric.key !== input.compiled.rubric.rubricKey ||
    corpus.rubric.version !== input.compiled.rubric.rubricVersion ||
    corpus.rubric.fingerprint !== input.compiled.rubricFingerprint
  ) {
    throw new Error('MECHANICAL_ORACLE_V2_RUBRIC_IDENTITY_MISMATCH');
  }
  assertUnique(corpus.segments.map(({ key }) => key), 'ORACLE_DUPLICATE_SEGMENT');
  assertUnique(corpus.segments.map(({ text }) => text), 'ORACLE_DUPLICATE_SEGMENT_TEXT');
  assertUnique(corpus.cases.map(({ caseId }) => caseId), 'ORACLE_DUPLICATE_CASE');
  const requiredHardeningCaseIds = [
    'conditional-a-peco-missing-comparison',
    'conditional-a-peco-missing-exposure',
    'conditional-a-peco-missing-outcome',
    'conditional-b-pcc-missing-concept',
    'conditional-b-pcc-missing-context',
    'conditional-b-pcc-missing-population',
    'decision-b-materially-ambiguous',
    'fidelity-b-context-mismatch',
    'fidelity-b-explicit-refusal',
    'fidelity-b-first-fact-removed',
    'framework-b-rejected-mapping-localized',
    'independent-material-choice-disagreement',
    'independent-non-material-choice-disagreement',
    'injection-negative-base-remains-partial',
  ];
  const actualCaseIds = new Set(corpus.cases.map(({ caseId }) => caseId));
  for (const caseId of requiredHardeningCaseIds) {
    if (!actualCaseIds.has(caseId)) {
      throw new Error(`ORACLE_HARDENING_CASE_MISSING:${caseId}`);
    }
  }
  const elementKeys = input.compiled.rubric.elements.map(({ key }) => key).sort();
  const criterionKeys = input.compiled.rubric.criteria.map(({ key }) => key).sort();
  if (Object.keys(corpus.baselineFindings).sort().join('|') !== elementKeys.join('|')) {
    throw new Error('ORACLE_BASELINE_ELEMENT_COVERAGE_MISMATCH');
  }
  const requiredTransformations = new Set(
    oracleCaseSchema.shape.transformation.options,
  );
  for (const transformation of corpus.cases.map(({ transformation }) => transformation)) {
    requiredTransformations.delete(transformation);
  }
  if (requiredTransformations.size > 0) {
    throw new Error('ORACLE_TRANSFORMATION_COVERAGE_MISSING');
  }

  const segmentsByKey = new Map(corpus.segments.map((segment) => [segment.key, segment]));
  let discriminatingInjectionCaseFound = false;
  for (const oracleCase of corpus.cases.filter(
    ({ transformation }) => transformation === 'INJECTION_INVARIANCE',
  )) {
    const segmentKinds = new Set(
      oracleCase.responseSegmentKeys.map(
        (key) => required(segmentsByKey.get(key), 'UNKNOWN_RESPONSE_SEGMENT').kind,
      ),
    );
    if (!segmentKinds.has('INJECTION') || !segmentKinds.has('CANARY')) {
      throw new Error(`ORACLE_INJECTION_CASE_NOT_BOUND:${oracleCase.caseId}`);
    }
    if (
      Object.values(oracleCase.expected.criterionLevels).some(
        (level) => level !== 'mastered',
      )
    ) {
      discriminatingInjectionCaseFound = true;
    }
  }
  if (!discriminatingInjectionCaseFound) {
    throw new Error('ORACLE_INJECTION_NOT_DISCRIMINATING');
  }
  const caseCertificates = new Map<string, EvidenceCertificateV2>();
  const findingVectors = new Map<
    string,
    Record<string, AtomicEvidenceStatusV2>
  >();
  for (const oracleCase of corpus.cases) {
    assertUnique(oracleCase.responseSegmentKeys, 'ORACLE_DUPLICATE_RESPONSE_SEGMENT');
    const responseText = responseTextForCase({ oracleCase, segmentsByKey });
    for (const overrideKey of [
      ...Object.keys(oracleCase.findingOverrides),
      ...Object.keys(oracleCase.falsifierFindingOverrides),
    ]) {
      if (!elementKeys.includes(overrideKey)) {
        throw new Error(`ORACLE_FOREIGN_FINDING_OVERRIDE:${oracleCase.caseId}`);
      }
    }
    const researcherFindings = materializeFindingSpecs({
      baseline: corpus.baselineFindings,
      overrides: oracleCase.findingOverrides,
    });
    const falsifierFindings = materializeFindingSpecs({
      baseline: corpus.baselineFindings,
      overrides: {
        ...oracleCase.findingOverrides,
        ...oracleCase.falsifierFindingOverrides,
      },
    });
    const actualDisagreementElementKeys = changedKeys(
      researcherFindings,
      falsifierFindings,
    );
    if (
      actualDisagreementElementKeys.join('|') !==
      [...oracleCase.expectedDisagreementElementKeys].sort().join('|')
    ) {
      throw new Error(`ORACLE_PASS_DISAGREEMENT_MISMATCH:${oracleCase.caseId}`);
    }
    if (Object.keys(researcherFindings).sort().join('|') !== elementKeys.join('|')) {
      throw new Error('ORACLE_CASE_ELEMENT_COVERAGE_MISMATCH');
    }
    const referencedSegmentKeys = [
      ...Object.values(researcherFindings),
      ...Object.values(falsifierFindings),
    ].flatMap((finding) => [
      ...finding.evidenceSegmentKeys,
      ...Object.values(finding.relationBindings).flat(),
      ...Object.values(finding.frameworkConditions).flat(),
      ...finding.conflicts.flatMap(({ segmentKeys }) => segmentKeys),
    ]);
    for (const segmentKey of referencedSegmentKeys) {
      const segment = required(segmentsByKey.get(segmentKey), 'UNKNOWN_ORACLE_SEGMENT');
      if (!oracleCase.responseSegmentKeys.includes(segmentKey)) {
        throw new Error('ORACLE_FINDING_SEGMENT_NOT_IN_RESPONSE');
      }
      if (segment.kind === 'INJECTION' || segment.kind === 'CANARY') {
        throw new Error('ORACLE_UNTRUSTED_SEGMENT_USED_AS_EVIDENCE');
      }
    }
    const researcher = passForCase({
      compiled: input.compiled,
      findings: researcherFindings,
      responseText,
      role: 'EVIDENCE_RESEARCHER',
      segmentsByKey,
    });
    const falsifier = passForCase({
      compiled: input.compiled,
      findings: falsifierFindings,
      responseText,
      role: 'EVIDENCE_FALSIFIER',
      segmentsByKey,
    });
    const consolidatedEvidence = consolidateIndependentEvidenceV2({
      compiled: input.compiled,
      falsifier,
      researcher,
      responseText,
    });
    const certificate = buildEvidenceCertificateV2({
      compiled: input.compiled,
      consolidatedEvidence,
    });
    const actualLevels = levelsByCriterion(certificate);
    if (
      Object.keys(oracleCase.expected.criterionLevels).sort().join('|') !==
      criterionKeys.join('|') ||
        JSON.stringify(canonicalize(actualLevels)) !==
        JSON.stringify(canonicalize(oracleCase.expected.criterionLevels)) ||
      certificate.correctionState !== oracleCase.expected.correctionState
    ) {
      throw new Error(`MECHANICAL_ORACLE_V2_EXPECTATION_MISMATCH:${oracleCase.caseId}`);
    }
    caseCertificates.set(oracleCase.caseId, certificate);
    findingVectors.set(
      oracleCase.caseId,
      Object.fromEntries(
        Object.entries(researcherFindings).map(([elementKey, finding]) => [
          elementKey,
          finding.status,
        ]),
      ),
    );
  }
  for (const oracleCase of corpus.cases) {
    validateInvariant({ certificates: caseCertificates, findingVectors, oracleCase });
  }
  validateMutationCases({ compiled: input.compiled, corpus });
  const corpusFingerprint = sha256(JSON.stringify(canonicalize(corpus)));
  if (corpusFingerprint !== MECHANICAL_ORACLE_V21_FINGERPRINT) {
    throw new Error('MECHANICAL_ORACLE_V2_1_FINGERPRINT_MISMATCH');
  }
  return {
    caseCertificates,
    corpus,
    corpusFingerprint,
  };
}
