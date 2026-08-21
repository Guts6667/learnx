import { createHash, randomBytes } from 'node:crypto';

import {
  CANDIDATE_EVIDENCE_RULE,
  EVIDENCE_ASSIST_INSTRUCTIONS,
  EVIDENCE_ASSIST_PROTOCOL_VERSION,
  EVIDENCE_ASSIST_VALIDATOR_VERSION,
  MAX_RAW_MODEL_OUTPUT_CHARACTERS,
  evidenceAssistFindingSchema,
  evidenceAssistJsonSchema,
  evidenceAssistOutputSchema,
  evidenceAssistProtocolFingerprint,
  type EvidenceAssistPromptMessage,
  type EvidenceAssistRejectionCode,
} from './evidence-assist-protocol.js';
import type { CompiledExecutableRubricV2 } from './executable-rubric-engine-v2.js';
import {
  createResponseSpanManifest,
  type ResponseSpan,
  type ResponseSpanManifest,
  validateResponseSpanManifest,
} from './response-span-manifest.js';

type CandidateElementV2 = Readonly<{
  acceptableVariants: readonly string[];
  candidateEvidenceRule: typeof CANDIDATE_EVIDENCE_RULE;
  contradictionSignals: readonly string[];
  counterExamples: readonly string[];
  evidenceGuidance: Readonly<{
    maximumResponseSpans: number;
    minimumResponseSpans: number;
    relationRoles: readonly string[];
    trustedClaimReferenceRequired: boolean;
    type: string;
  }>;
  key: string;
  propositionExamples: readonly string[];
}>;

export type EvidenceAssistCandidateRubricViewV2 = Readonly<{
  authority: 'CANDIDATE_ONLY';
  elements: readonly CandidateElementV2[];
  language: 'fr-FR';
  modality: 'WRITING';
  relationSemantics: Readonly<{
    EVIDENCE_AGAINST_ELEMENT: 'SPANS_EXPLICITLY_REFUTE_THE_ELEMENT_PROPOSITION';
    EVIDENCE_FOR_ELEMENT: 'SPANS_SUBSTANTIATE_THE_ELEMENT_PROPOSITION';
  }>;
  rubricKey: string;
  rubricVersion: string;
  schemaVersion: 2;
  sourceRubricFingerprint: string;
}>;

export type EvidenceAssistRequestContextV2 = Readonly<{
  canary: string;
  canarySha256: string;
  candidateRubric: EvidenceAssistCandidateRubricViewV2;
  candidateRubricFingerprint: string;
  contextFingerprint: string;
  messages: readonly [EvidenceAssistPromptMessage, EvidenceAssistPromptMessage];
  messagesSha256: string;
  protocolFingerprint: string;
  protocolVersion: typeof EVIDENCE_ASSIST_PROTOCOL_VERSION;
  responseSha256: string;
  rubricFingerprint: string;
  schemaVersion: 2;
  spanManifest: ResponseSpanManifest;
  spanManifestSha256: string;
  taskContext: string;
  taskContextSha256: string;
  taskPrompt: string;
  taskPromptSha256: string;
  validatorVersion: typeof EVIDENCE_ASSIST_VALIDATOR_VERSION;
}>;

export type EvidenceAssistValidationResultV2 = Readonly<{
  abstainedElementKeys: readonly string[];
  candidateFindings: ReadonlyArray<
    Readonly<{
      candidateOnly: true;
      elementKey: string;
      evidenceSpans: readonly ResponseSpan[];
      relation: 'EVIDENCE_AGAINST_ELEMENT' | 'EVIDENCE_FOR_ELEMENT';
      spanIds: readonly string[];
    }>
  >;
  candidateOnly: true;
  level: null;
  levelAuthority: 'NONE';
  masteryEffect: 'NONE';
  pipelineFingerprint: string;
  progressionEffect: 'NONE';
  protocolFingerprint: string;
  rawModelOutputSha256: string;
  rejectedFindings: ReadonlyArray<
    Readonly<{
      code: EvidenceAssistRejectionCode;
      elementKey: string | null;
      index: number;
    }>
  >;
  requestContextFingerprint: string;
  score: null;
  scoreAuthority: 'NONE';
  semanticAuthority: 'CANDIDATE_ONLY';
  spanManifestSha256: string;
  unresolvedElementKeys: readonly string[];
}>;

type RequestCoreV2 = Omit<
  EvidenceAssistRequestContextV2,
  | 'canary'
  | 'candidateRubric'
  | 'contextFingerprint'
  | 'messages'
  | 'spanManifest'
  | 'taskContext'
  | 'taskPrompt'
>;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
}

export function canonicalJsonV2(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

export function buildEvidenceAssistCandidateRubricViewV2(
  compiled: CompiledExecutableRubricV2,
): EvidenceAssistCandidateRubricViewV2 {
  return deepFreeze({
    authority: 'CANDIDATE_ONLY' as const,
    elements: compiled.rubric.elements.map((element) => ({
      acceptableVariants: [...element.acceptableVariants],
      candidateEvidenceRule: CANDIDATE_EVIDENCE_RULE,
      contradictionSignals: [...element.contradictionKinds],
      counterExamples: [...element.negativeExamples],
      evidenceGuidance: {
        maximumResponseSpans: Math.min(
          CANDIDATE_EVIDENCE_RULE.maximumSpanIds,
          element.evidenceRule.maximumSpans,
        ),
        minimumResponseSpans:
          element.evidenceRule.minimumSpans === 0
            ? CANDIDATE_EVIDENCE_RULE.minimumSpanIds
            : Math.min(
                element.evidenceRule.minimumSpans,
                CANDIDATE_EVIDENCE_RULE.maximumSpanIds,
              ),
        relationRoles: [...(element.evidenceRule.relationRoles ?? [])],
        trustedClaimReferenceRequired:
          element.evidenceRule.trustedClaimReferenceRequired ?? false,
        type: element.type,
      },
      key: element.key,
      propositionExamples: [...element.positiveExamples],
    })),
    language: compiled.rubric.language,
    modality: compiled.rubric.modality,
    relationSemantics: {
      EVIDENCE_AGAINST_ELEMENT:
        'SPANS_EXPLICITLY_REFUTE_THE_ELEMENT_PROPOSITION' as const,
      EVIDENCE_FOR_ELEMENT:
        'SPANS_SUBSTANTIATE_THE_ELEMENT_PROPOSITION' as const,
    },
    rubricKey: compiled.rubric.rubricKey,
    rubricVersion: compiled.rubric.rubricVersion,
    schemaVersion: 2 as const,
    sourceRubricFingerprint: compiled.rubricFingerprint,
  }) as EvidenceAssistCandidateRubricViewV2;
}

function promptSpans(manifest: ResponseSpanManifest) {
  return manifest.spans.map(({ spanId, text }) => ({ spanId, text }));
}

function buildMessages(input: {
  canary: string;
  candidateRubric: EvidenceAssistCandidateRubricViewV2;
  candidateRubricFingerprint: string;
  spanManifest: ResponseSpanManifest;
  taskContext: string;
  taskPrompt: string;
}): readonly [EvidenceAssistPromptMessage, EvidenceAssistPromptMessage] {
  return [
    {
      content: [
        ...EVIDENCE_ASSIST_INSTRUCTIONS,
        `CONFIDENTIAL_CANARY=${JSON.stringify(input.canary)}`,
        `CANDIDATE_RUBRIC_FINGERPRINT=${input.candidateRubricFingerprint}`,
        `CANDIDATE_RUBRIC_JSON=${JSON.stringify(input.candidateRubric)}`,
        `SPAN_MANIFEST_SHA256=${input.spanManifest.manifestSha256}`,
        `RESPONSE_SHA256=${input.spanManifest.responseSha256}`,
        `TASK_CONTEXT=${JSON.stringify(input.taskContext)}`,
        `TASK_PROMPT=${JSON.stringify(input.taskPrompt)}`,
      ].join('\n'),
      role: 'system',
    },
    {
      content: [
        'UNTRUSTED_LEARNER_RESPONSE_SPANS',
        `RESPONSE_SPANS_JSON=${JSON.stringify(promptSpans(input.spanManifest))}`,
      ].join('\n'),
      role: 'user',
    },
  ];
}

function strongCanary(value: string): boolean {
  return /^lx-canary-[a-f0-9]{32}$/u.test(value);
}

function defaultCanary(): string {
  return `lx-canary-${randomBytes(16).toString('hex')}`;
}

function requestContextFingerprint(core: RequestCoreV2): string {
  return sha256(canonicalJsonV2(core));
}

export function prepareEvidenceAssistRequestV2(input: {
  canaryFactory?: () => string;
  compiled: CompiledExecutableRubricV2;
  responseText: string;
  taskContext: string;
  taskPrompt: string;
}): {
  messages: readonly [EvidenceAssistPromptMessage, EvidenceAssistPromptMessage];
  requestContext: EvidenceAssistRequestContextV2;
} {
  const candidateRubric = buildEvidenceAssistCandidateRubricViewV2(
    input.compiled,
  );
  const canary = (input.canaryFactory ?? defaultCanary)();
  if (!strongCanary(canary))
    throw new Error('EVIDENCE_ASSIST_CANARY_NOT_STRONG');
  const trustedAndUntrustedInputs = [
    canonicalJsonV2(candidateRubric),
    input.responseText,
    input.taskContext,
    input.taskPrompt,
  ];
  if (trustedAndUntrustedInputs.some((value) => value.includes(canary))) {
    throw new Error('EVIDENCE_ASSIST_CANARY_COLLISION');
  }
  const candidateRubricFingerprint = sha256(canonicalJsonV2(candidateRubric));
  const spanManifest = createResponseSpanManifest(input.responseText);
  const messages = buildMessages({
    canary,
    candidateRubric,
    candidateRubricFingerprint,
    spanManifest,
    taskContext: input.taskContext,
    taskPrompt: input.taskPrompt,
  });
  const core: RequestCoreV2 = {
    canarySha256: sha256(canary),
    candidateRubricFingerprint,
    messagesSha256: sha256(canonicalJsonV2(messages)),
    protocolFingerprint: evidenceAssistProtocolFingerprint(),
    protocolVersion: EVIDENCE_ASSIST_PROTOCOL_VERSION,
    responseSha256: spanManifest.responseSha256,
    rubricFingerprint: input.compiled.rubricFingerprint,
    schemaVersion: 2,
    spanManifestSha256: spanManifest.manifestSha256,
    taskContextSha256: sha256(input.taskContext),
    taskPromptSha256: sha256(input.taskPrompt),
    validatorVersion: EVIDENCE_ASSIST_VALIDATOR_VERSION,
  };
  const requestContext = deepFreeze({
    ...core,
    canary,
    candidateRubric,
    contextFingerprint: requestContextFingerprint(core),
    messages,
    spanManifest,
    taskContext: input.taskContext,
    taskPrompt: input.taskPrompt,
  }) as EvidenceAssistRequestContextV2;
  return { messages: requestContext.messages, requestContext };
}

function assertRequestContext(input: {
  compiled: CompiledExecutableRubricV2;
  requestContext: EvidenceAssistRequestContextV2;
  responseText: string;
}): ResponseSpanManifest {
  const context = input.requestContext;
  if (!strongCanary(context.canary)) {
    throw new Error('EVIDENCE_ASSIST_CANARY_NOT_STRONG');
  }
  if (
    context.protocolFingerprint !== evidenceAssistProtocolFingerprint() ||
    context.protocolVersion !== EVIDENCE_ASSIST_PROTOCOL_VERSION ||
    context.validatorVersion !== EVIDENCE_ASSIST_VALIDATOR_VERSION ||
    context.rubricFingerprint !== input.compiled.rubricFingerprint
  ) {
    throw new Error('EVIDENCE_ASSIST_REQUEST_IDENTITY_MISMATCH');
  }
  const expectedRubric = buildEvidenceAssistCandidateRubricViewV2(
    input.compiled,
  );
  if (
    context.candidateRubricFingerprint !==
      sha256(canonicalJsonV2(expectedRubric)) ||
    canonicalJsonV2(context.candidateRubric) !== canonicalJsonV2(expectedRubric)
  ) {
    throw new Error('EVIDENCE_ASSIST_CANDIDATE_RUBRIC_MISMATCH');
  }
  const spanManifest = validateResponseSpanManifest({
    manifest: context.spanManifest,
    responseText: input.responseText,
  });
  const expectedMessages = buildMessages({
    canary: context.canary,
    candidateRubric: expectedRubric,
    candidateRubricFingerprint: context.candidateRubricFingerprint,
    spanManifest,
    taskContext: context.taskContext,
    taskPrompt: context.taskPrompt,
  });
  if (
    context.canarySha256 !== sha256(context.canary) ||
    context.messagesSha256 !== sha256(canonicalJsonV2(expectedMessages)) ||
    canonicalJsonV2(context.messages) !== canonicalJsonV2(expectedMessages) ||
    context.responseSha256 !== spanManifest.responseSha256 ||
    context.spanManifestSha256 !== spanManifest.manifestSha256 ||
    context.taskContextSha256 !== sha256(context.taskContext) ||
    context.taskPromptSha256 !== sha256(context.taskPrompt)
  ) {
    throw new Error('EVIDENCE_ASSIST_REQUEST_HASH_MISMATCH');
  }
  const core: RequestCoreV2 = {
    canarySha256: context.canarySha256,
    candidateRubricFingerprint: context.candidateRubricFingerprint,
    messagesSha256: context.messagesSha256,
    protocolFingerprint: context.protocolFingerprint,
    protocolVersion: context.protocolVersion,
    responseSha256: context.responseSha256,
    rubricFingerprint: context.rubricFingerprint,
    schemaVersion: context.schemaVersion,
    spanManifestSha256: context.spanManifestSha256,
    taskContextSha256: context.taskContextSha256,
    taskPromptSha256: context.taskPromptSha256,
    validatorVersion: context.validatorVersion,
  };
  if (context.contextFingerprint !== requestContextFingerprint(core)) {
    throw new Error('EVIDENCE_ASSIST_REQUEST_CONTEXT_MISMATCH');
  }
  return spanManifest;
}

function rawElementKey(value: unknown): string | null {
  if (
    value &&
    typeof value === 'object' &&
    'elementKey' in value &&
    typeof value.elementKey === 'string'
  ) {
    return value.elementKey;
  }
  return null;
}

export function validateEvidenceAssistOutputV2(input: {
  compiled: CompiledExecutableRubricV2;
  pipelineFingerprintSeed: string;
  rawModelOutput: string;
  requestContext: EvidenceAssistRequestContextV2;
  responseText: string;
}): EvidenceAssistValidationResultV2 {
  const spanManifest = assertRequestContext(input);
  if (
    input.rawModelOutput.length === 0 ||
    input.rawModelOutput.length > MAX_RAW_MODEL_OUTPUT_CHARACTERS
  ) {
    throw new Error('EVIDENCE_ASSIST_RAW_OUTPUT_SIZE_INVALID');
  }
  if (input.rawModelOutput.includes(input.requestContext.canary)) {
    throw new Error('EVIDENCE_ASSIST_CANARY_LEAK');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.rawModelOutput) as unknown;
  } catch {
    throw new Error('EVIDENCE_ASSIST_OUTPUT_JSON_INVALID');
  }
  if (canonicalJsonV2(parsed).includes(input.requestContext.canary)) {
    throw new Error('EVIDENCE_ASSIST_CANARY_LEAK');
  }
  const envelope = evidenceAssistOutputSchema.parse(parsed);
  const parsedFindings: Array<{
    finding: ReturnType<typeof evidenceAssistFindingSchema.parse>;
    index: number;
  }> = [];
  const rejectedFindings: Array<{
    code: EvidenceAssistRejectionCode;
    elementKey: string | null;
    index: number;
  }> = [];
  envelope.findings.forEach((finding, index) => {
    const result = evidenceAssistFindingSchema.safeParse(finding);
    if (!result.success) {
      rejectedFindings.push({
        code: 'MALFORMED_FINDING',
        elementKey: rawElementKey(finding),
        index,
      });
      return;
    }
    parsedFindings.push({ finding: result.data, index });
  });
  const counts = new Map<string, number>();
  parsedFindings.forEach(({ finding }) => {
    counts.set(finding.elementKey, (counts.get(finding.elementKey) ?? 0) + 1);
  });
  const candidateElements = new Map(
    input.requestContext.candidateRubric.elements.map((element) => [
      element.key,
      element,
    ]),
  );
  const spans = new Map(spanManifest.spans.map((span) => [span.spanId, span]));
  const abstainedElementKeys: string[] = [];
  const candidateFindings: Array<
    EvidenceAssistValidationResultV2['candidateFindings'][number]
  > = [];
  parsedFindings.forEach(({ finding, index }) => {
    let code: EvidenceAssistRejectionCode | null = null;
    const element = candidateElements.get(finding.elementKey);
    if (!element) code = 'UNKNOWN_ELEMENT_KEY';
    else if ((counts.get(finding.elementKey) ?? 0) > 1) {
      code = 'DUPLICATE_ELEMENT_KEY';
    } else if (finding.relation === 'ABSTAIN') {
      code = finding.spanIds.length === 0 ? null : 'ABSTAIN_WITH_SPANS';
    } else if (new Set(finding.spanIds).size !== finding.spanIds.length) {
      code = 'DUPLICATE_SPAN_ID';
    } else if (finding.spanIds.some((spanId) => !spans.has(spanId))) {
      code = 'UNKNOWN_SPAN_ID';
    } else if (
      finding.spanIds.length < CANDIDATE_EVIDENCE_RULE.minimumSpanIds ||
      finding.spanIds.length > CANDIDATE_EVIDENCE_RULE.maximumSpanIds
    ) {
      code = 'SPAN_CARDINALITY_INVALID';
    }
    if (code) {
      rejectedFindings.push({ code, elementKey: finding.elementKey, index });
      return;
    }
    if (finding.relation === 'ABSTAIN') {
      abstainedElementKeys.push(finding.elementKey);
      return;
    }
    candidateFindings.push({
      candidateOnly: true,
      elementKey: finding.elementKey,
      evidenceSpans: finding.spanIds.map((spanId) => {
        const span = spans.get(spanId);
        if (!span)
          throw new Error('EVIDENCE_ASSIST_UNKNOWN_SPAN_AFTER_VALIDATION');
        return span;
      }),
      relation: finding.relation,
      spanIds: [...finding.spanIds],
    });
  });
  const resolvedKeys = new Set([
    ...abstainedElementKeys,
    ...candidateFindings.map(({ elementKey }) => elementKey),
  ]);
  const rawModelOutputSha256 = sha256(input.rawModelOutput);
  return deepFreeze({
    abstainedElementKeys: [...abstainedElementKeys].sort(),
    candidateFindings,
    candidateOnly: true as const,
    level: null,
    levelAuthority: 'NONE' as const,
    masteryEffect: 'NONE' as const,
    pipelineFingerprint: sha256(
      canonicalJsonV2({
        pipelineFingerprintSeed: input.pipelineFingerprintSeed,
        protocolFingerprint: input.requestContext.protocolFingerprint,
        requestContextFingerprint: input.requestContext.contextFingerprint,
      }),
    ),
    progressionEffect: 'NONE' as const,
    protocolFingerprint: input.requestContext.protocolFingerprint,
    rawModelOutputSha256,
    rejectedFindings,
    requestContextFingerprint: input.requestContext.contextFingerprint,
    score: null,
    scoreAuthority: 'NONE' as const,
    semanticAuthority: 'CANDIDATE_ONLY' as const,
    spanManifestSha256: spanManifest.manifestSha256,
    unresolvedElementKeys: input.compiled.rubric.elements
      .map(({ key }) => key)
      .filter((key) => !resolvedKeys.has(key)),
  }) as EvidenceAssistValidationResultV2;
}

export { evidenceAssistJsonSchema };
