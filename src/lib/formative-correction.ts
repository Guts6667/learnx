import { createHash } from 'node:crypto';

import { z } from 'zod';

import type { CompiledExecutableRubric } from './executable-rubric-engine.js';
import type { EvidenceAssistPublicResult } from '../server/ai/evidence-assist-orchestrator.js';
import {
  createResponseSpanManifest,
  type ResponseSpan,
} from './response-span-manifest.js';

export const formativeCorrectionStateSchema = z.enum([
  'FEEDBACK_READY',
  'REVISION_REQUIRED',
  'CLARIFICATION_REQUIRED',
  'TEMPORARILY_UNAVAILABLE',
]);

export type FormativeCorrectionState = z.infer<
  typeof formativeCorrectionStateSchema
>;

const publicEvidenceSpanSchema = z
  .object({
    end: z.number().int().positive(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    spanId: z.string().min(1),
    start: z.number().int().nonnegative(),
    text: z.string().min(1),
  })
  .strict();

const feedbackItemSchema = z
  .object({
    criterionKey: z.string().min(1),
    criterionLabel: z.string().min(1),
    elementKey: z.string().min(1),
    evidenceSpans: z.array(publicEvidenceSpanSchema),
    kind: z.enum(['OBSERVED_STRENGTH', 'POINT_TO_CLARIFY', 'MECHANICAL_REVISION']),
    message: z.string().min(1),
    relation: z
      .enum(['EVIDENCE_FOR_ELEMENT', 'EVIDENCE_AGAINST_ELEMENT'])
      .nullable(),
  })
  .strict();

export const formativeEvidenceCertificateSchema = z
  .object({
    authority: z.literal('LEARNX_SERVER_VALIDATED_CANDIDATES'),
    billingEffect: z.literal('NONE'),
    certificateVersion: z.literal(1),
    feedback: z.array(feedbackItemSchema),
    indicativeScore: z.null(),
    level: z.null(),
    masteryEffect: z.literal('NONE'),
    operationFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    pipelineFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    progressionEffect: z.literal('NONE'),
    protocolFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    responseSha256: z.string().regex(/^[a-f0-9]{64}$/u),
    rubricFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    state: formativeCorrectionStateSchema.exclude(['TEMPORARILY_UNAVAILABLE']),
  })
  .strict();

export type FormativeEvidenceCertificate = z.infer<
  typeof formativeEvidenceCertificateSchema
>;

export const simulatedCorrectionQuote = Object.freeze({
  acceptedCeilingCredits: null,
  billingEffect: 'NONE' as const,
  mode: 'OFFLINE_SIMULATION' as const,
  reservationStatus: 'SIMULATED' as const,
  settledCredits: null,
});

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function requireValue<T>(value: T | undefined, code: string): T {
  if (value === undefined) throw new Error(code);
  return value;
}

function normalized(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[’']/gu, "'")
    .toLowerCase();
}

function decisionContradictionSpans(spans: readonly ResponseSpan[]): ResponseSpan[] {
  const go = spans.find(({ text }) =>
    /\bje recommande (?:un )?go(?:\s|[.,;:!?]|$)/u.test(normalized(text)),
  );
  const noGo = spans.find(({ text }) =>
    /\bje recommande (?:un )?no-go(?:\s|[.,;:!?]|$)/u.test(normalized(text)),
  );
  return go && noGo && go.spanId !== noGo.spanId ? [go, noGo] : [];
}

function publicSpan(span: ResponseSpan) {
  return {
    end: span.end,
    sha256: span.sha256,
    spanId: span.spanId,
    start: span.start,
    text: span.text,
  };
}

function candidateFeedback(input: {
  compiled: CompiledExecutableRubric;
  result: EvidenceAssistPublicResult;
  spansById: ReadonlyMap<string, ResponseSpan>;
}): FormativeEvidenceCertificate['feedback'] {
  return input.result.candidateFindings.map((finding) => {
    const element = requireValue(
      input.compiled.rubric.elements.find(({ key }) => key === finding.elementKey),
      'FORMATIVE_CORRECTION_UNKNOWN_ELEMENT',
    );
    const criterion = requireValue(
      input.compiled.rubric.criteria.find(
        ({ key }) => key === element.ownerCriterionKey,
      ),
      'FORMATIVE_CORRECTION_UNKNOWN_CRITERION',
    );
    const supportsAUsefulObservation =
      (element.polarity === 'POSITIVE' &&
        finding.relation === 'EVIDENCE_FOR_ELEMENT') ||
      (element.polarity === 'NEGATIVE' &&
        finding.relation === 'EVIDENCE_AGAINST_ELEMENT');

    return {
      criterionKey: criterion.key,
      criterionLabel: criterion.label,
      elementKey: element.key,
      evidenceSpans: finding.spanIds.map((spanId) =>
        publicSpan(
          requireValue(
            input.spansById.get(spanId),
            'FORMATIVE_CORRECTION_UNKNOWN_SPAN',
          ),
        ),
      ),
      kind: supportsAUsefulObservation
        ? ('OBSERVED_STRENGTH' as const)
        : ('POINT_TO_CLARIFY' as const),
      message: supportsAUsefulObservation
        ? element.templates.supported
        : element.templates.ambiguous,
      relation: finding.relation,
    };
  });
}

function mechanicalFeedback(input: {
  compiled: CompiledExecutableRubric;
  spans: readonly ResponseSpan[];
}): FormativeEvidenceCertificate['feedback'] {
  const evidenceSpans = decisionContradictionSpans(input.spans);
  if (evidenceSpans.length === 0) return [];
  const element = input.compiled.rubric.elements.find(
    ({ key }) => key === 'unresolved-decision-contradiction',
  );
  if (!element) return [];
  const criterion = requireValue(
    input.compiled.rubric.criteria.find(
      ({ key }) => key === element.ownerCriterionKey,
    ),
    'FORMATIVE_CORRECTION_UNKNOWN_CRITERION',
  );
  return [
    {
      criterionKey: criterion.key,
      criterionLabel: criterion.label,
      elementKey: element.key,
      evidenceSpans: evidenceSpans.map(publicSpan),
      kind: 'MECHANICAL_REVISION',
      message: element.templates.supported,
      relation: null,
    },
  ];
}

export function buildFormativeEvidenceCertificate(input: {
  compiled: CompiledExecutableRubric;
  responseText: string;
  result: EvidenceAssistPublicResult;
}): FormativeEvidenceCertificate {
  if (
    input.compiled.rubric.lifecycle !== 'DRAFT' ||
    input.compiled.rubric.eligibility !== 'EVIDENCE_ASSIST_ONLY' ||
    input.result.authority !== 'CANDIDATE_ONLY' ||
    input.result.billingEffect !== 'NONE' ||
    input.result.score !== null ||
    input.result.level !== null ||
    input.result.progressionEffect !== 'NONE' ||
    input.result.masteryEffect !== 'NONE'
  ) {
    throw new Error('FORMATIVE_CORRECTION_AUTHORITY_VIOLATION');
  }
  const manifest = createResponseSpanManifest(input.responseText);
  if (
    manifest.responseSha256 !== input.result.responseSha256 ||
    manifest.manifestSha256 !== input.result.spanManifestSha256
  ) {
    throw new Error('FORMATIVE_CORRECTION_RESPONSE_MISMATCH');
  }
  const spansById = new Map(manifest.spans.map((span) => [span.spanId, span]));
  const mechanical = mechanicalFeedback({
    compiled: input.compiled,
    spans: manifest.spans,
  });
  const candidates = candidateFeedback({
    compiled: input.compiled,
    result: input.result,
    spansById,
  }).filter(
    ({ elementKey }) =>
      !mechanical.some((finding) => finding.elementKey === elementKey),
  );
  const feedback = [...mechanical, ...candidates];
  const state: FormativeEvidenceCertificate['state'] =
    mechanical.length > 0
      ? 'REVISION_REQUIRED'
      : feedback.length === 0 || input.result.state === 'UNRESOLVED'
        ? 'CLARIFICATION_REQUIRED'
        : 'FEEDBACK_READY';
  const certificate = {
    authority: 'LEARNX_SERVER_VALIDATED_CANDIDATES' as const,
    billingEffect: 'NONE' as const,
    certificateVersion: 1 as const,
    feedback,
    indicativeScore: null,
    level: null,
    masteryEffect: 'NONE' as const,
    operationFingerprint: input.result.operationFingerprint,
    pipelineFingerprint: sha256(
      `${input.result.operationFingerprint}:${input.compiled.rubricFingerprint}`,
    ),
    progressionEffect: 'NONE' as const,
    protocolFingerprint: input.result.protocolFingerprint,
    responseSha256: input.result.responseSha256,
    rubricFingerprint: input.compiled.rubricFingerprint,
    state,
  };
  return formativeEvidenceCertificateSchema.parse(certificate);
}
