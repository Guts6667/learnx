import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  buildOpenRouterRequestBody,
  buildOpenRouterTransportManifest,
  type CorrectionProviderRequest,
} from '../../lib/ai-correction-provider-adapters.js';
import {
  EVIDENCE_ASSIST_GEMINI_WIRE_DIALECT,
  EVIDENCE_ASSIST_GEMINI_WIRE_DIALECT_VERSION,
  EVIDENCE_ASSIST_PROTOCOL_VERSION,
  evidenceAssistGeminiWireJsonSchema,
} from '../../lib/evidence-assist-protocol.js';
import {
  canonicalJsonV2,
  prepareEvidenceAssistRequestV2,
} from '../../lib/evidence-assist-protocol-v2-adapter.js';
import {
  evidenceExtractionCampaignSchema,
  type EvidenceExtractionCampaign,
} from '../../lib/evidence-extraction-campaign.js';
import { compileExecutableRubric } from '../../lib/executable-rubric-engine.js';
import { validateExecutableRubricSemanticCorpus } from '../../lib/executable-rubric-semantic-corpus.js';
import {
  buildEvidenceResearcherPrompt,
  EVIDENCE_RESEARCHER_PROTOCOL_VERSION,
  researcherJsonSchema,
} from '../../lib/evidence-researcher-protocol.js';
import {
  buildWritingFrameworkGatePackage,
  type WritingFrameworkGatePackage,
} from './writing-framework-selection-gate-runner-v2.js';
import {
  writingFrameworkGateOpenRouterRequestProfile,
  writingFrameworkGateReasoningCapabilities,
} from './writing-framework-selection-openrouter-provider.js';

export const GEMINI_3_6_TRANSPORT_DIFFERENTIAL_PATHS = Object.freeze({
  acceptedCampaign:
    'benchmarks/ai-correction/executable-rubric/gemini-evidence-researcher-smoke.v1.3.json',
  acceptedCorpus:
    'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v1.json',
  acceptedResult:
    'benchmarks/ai-correction/executable-rubric/gemini-evidence-researcher-smoke.v1.3.result.json',
  acceptedRubric:
    'benchmarks/ai-correction/executable-rubric/writing-recommendation-fr.v1.json',
  correctedDossier:
    'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-freeze.v1.json',
  correctedFinance:
    'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-finance-envelope.approved.v1.json',
});

export const GEMINI_3_6_ACCEPTED_SMOKE_SHA256 = Object.freeze({
  campaign: '8694b09458a572687c9846292424bfa694b790a94076271739036553fc370087',
  result: '1dc19b3a05e3ba94cf1870a1b18aef4dcb55b79fd11604efc495360a0642b30a',
});

export type Gemini36TransportDifferentialInput = Readonly<{
  acceptedCampaignText: string;
  acceptedCorpusText: string;
  acceptedResultText: string;
  acceptedRubricText: string;
  correctedAuthorityTexts: Readonly<Record<string, string>>;
  correctedDossierText: string;
  correctedFinanceText: string;
}>;

const acceptedResultSchema = z
  .object({
    attempt: z
      .object({
        caseId: z.string().min(1),
        modelSnapshot: z.literal('google/gemini-3.6-flash'),
        providerRoute: z.literal('Google'),
        status: z.literal('VALID'),
      })
      .passthrough(),
    campaignId: z.literal('learnx-writing-fr-gemini-evidence-researcher-v1'),
    campaignSha256: z.string().regex(/^[a-f0-9]{64}$/u),
    campaignVersion: z.literal('1.3.0-draft'),
    financeVerdict: z.literal('RECONCILED_CLOSED'),
    modelCallsAuthorizedAfterThisResult: z.literal(false),
    productVerdict: z.literal('APPROVED_POSITIVE_SMOKE_ONLY'),
    providerAttemptsExecuted: z.literal(1),
    status: z.literal('APPROVED_POSITIVE_SMOKE_ONLY'),
  })
  .passthrough();

type TransportView = Readonly<{
  fallbackDisabled: boolean;
  jsonSchema: Readonly<Record<string, unknown>>;
  maxTokens: number;
  messageCount: number;
  messagesSha256: string;
  model: string;
  reasoningEffort: string;
  requestedRoute: string;
  responseFormatStrict: boolean;
  responseFormatType: string;
  schemaRootKeys: readonly string[];
  schemaSha256: string;
  temperatureOmitted: boolean;
}>;

type DifferentialInvariant = Readonly<{
  accepted: unknown;
  corrected: unknown;
  matches: boolean;
  name: string;
}>;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function record(value: unknown, code: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(code);
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, code: string): string {
  if (typeof value !== 'string') throw new Error(code);
  return value;
}

function numberValue(value: unknown, code: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(code);
  }
  return value;
}

function booleanValue(value: unknown, code: string): boolean {
  if (typeof value !== 'boolean') throw new Error(code);
  return value;
}

function singleString(value: unknown, code: string): string {
  if (
    !Array.isArray(value) ||
    value.length !== 1 ||
    typeof value[0] !== 'string'
  ) {
    throw new Error(code);
  }
  return value[0];
}

function containsKey(value: unknown, target: string): boolean {
  if (Array.isArray(value)) {
    return value.some((child) => containsKey(child, target));
  }
  if (typeof value !== 'object' || value === null) return false;
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.some(
    ([key, child]) => key === target || containsKey(child, target),
  );
}

function transportView(input: {
  body: Record<string, unknown>;
  request: Omit<CorrectionProviderRequest, 'apiKey'>;
}): TransportView {
  const provider = record(
    input.body.provider,
    'GEMINI_DIFFERENTIAL_PROVIDER_MISSING',
  );
  const reasoning = record(
    input.body.reasoning,
    'GEMINI_DIFFERENTIAL_REASONING_MISSING',
  );
  const responseFormat = record(
    input.body.response_format,
    'GEMINI_DIFFERENTIAL_RESPONSE_FORMAT_MISSING',
  );
  const jsonSchemaEnvelope = record(
    responseFormat.json_schema,
    'GEMINI_DIFFERENTIAL_JSON_SCHEMA_ENVELOPE_MISSING',
  );
  const jsonSchema = record(
    jsonSchemaEnvelope.schema,
    'GEMINI_DIFFERENTIAL_JSON_SCHEMA_MISSING',
  );
  const properties = record(
    jsonSchema.properties,
    'GEMINI_DIFFERENTIAL_SCHEMA_PROPERTIES_MISSING',
  );
  const messages = input.request.messages;
  return Object.freeze({
    fallbackDisabled: !booleanValue(
      provider.allow_fallbacks,
      'GEMINI_DIFFERENTIAL_FALLBACK_MISSING',
    ),
    jsonSchema,
    maxTokens: numberValue(
      input.body.max_tokens,
      'GEMINI_DIFFERENTIAL_MAX_TOKENS_MISSING',
    ),
    messageCount: messages.length,
    messagesSha256: sha256(canonicalJsonV2(messages)),
    model: stringValue(input.body.model, 'GEMINI_DIFFERENTIAL_MODEL_MISSING'),
    reasoningEffort: stringValue(
      reasoning.effort,
      'GEMINI_DIFFERENTIAL_REASONING_EFFORT_MISSING',
    ).toLocaleUpperCase('en-US'),
    requestedRoute: singleString(
      provider.order,
      'GEMINI_DIFFERENTIAL_ROUTE_INVALID',
    ),
    responseFormatStrict: booleanValue(
      jsonSchemaEnvelope.strict,
      'GEMINI_DIFFERENTIAL_RESPONSE_FORMAT_STRICT_MISSING',
    ),
    responseFormatType: stringValue(
      responseFormat.type,
      'GEMINI_DIFFERENTIAL_RESPONSE_FORMAT_TYPE_MISSING',
    ),
    schemaRootKeys: Object.keys(properties).sort(),
    schemaSha256: sha256(canonicalJsonV2(jsonSchema)),
    temperatureOmitted: !Object.hasOwn(input.body, 'temperature'),
  });
}

function invariant(
  name: string,
  accepted: unknown,
  corrected: unknown,
): DifferentialInvariant {
  return Object.freeze({
    accepted,
    corrected,
    matches: canonicalJsonV2(accepted) === canonicalJsonV2(corrected),
    name,
  });
}

function acceptedTransport(input: {
  campaign: EvidenceExtractionCampaign;
  corpusText: string;
  result: z.infer<typeof acceptedResultSchema>;
  rubricText: string;
}): {
  request: Omit<CorrectionProviderRequest, 'apiKey'>;
  view: TransportView;
} {
  const compiled = compileExecutableRubric(
    JSON.parse(input.rubricText) as unknown,
  );
  const corpus = validateExecutableRubricSemanticCorpus({
    compiled,
    corpus: JSON.parse(input.corpusText) as unknown,
  });
  const caseItem = corpus.cases.find(
    ({ caseId }) => caseId === input.result.attempt.caseId,
  );
  if (!caseItem) throw new Error('GEMINI_DIFFERENTIAL_ACCEPTED_CASE_MISSING');
  const prompt = buildEvidenceResearcherPrompt({
    canary: input.campaign.smokeProposal.securityCanary,
    compiled,
    responseText: caseItem.responseText,
    taskContext: corpus.task.context,
    taskPrompt: corpus.task.prompt,
  });
  const request = {
    idempotencyKey: 'offline-gemini36-differential-accepted',
    jsonSchema: researcherJsonSchema(),
    messages: [{ content: prompt, role: 'system' as const }],
    modelId: input.campaign.researcher.modelId,
    profile: input.campaign.researcher.requestProfile,
  } satisfies Omit<CorrectionProviderRequest, 'apiKey'>;
  return {
    request,
    view: transportView({ body: buildOpenRouterRequestBody(request), request }),
  };
}

function correctedTransport(packageInput: WritingFrameworkGatePackage): {
  request: Omit<CorrectionProviderRequest, 'apiKey'>;
  view: TransportView;
} {
  const caseItem = packageInput.cases[0];
  if (!caseItem) throw new Error('GEMINI_DIFFERENTIAL_CORRECTED_CASE_MISSING');
  const prepared = prepareEvidenceAssistRequestV2({
    canaryFactory: () => 'lx-canary-00000000000000000000000000000000',
    compiled: packageInput.compiled,
    responseText: caseItem.responseText,
    taskContext: packageInput.taskContext,
    taskPrompt: packageInput.taskPrompt,
  });
  const profile = writingFrameworkGateOpenRouterRequestProfile(packageInput);
  const capabilities = writingFrameworkGateReasoningCapabilities(packageInput);
  const request = {
    idempotencyKey: 'offline-gemini36-differential-corrected',
    jsonSchema: { ...evidenceAssistGeminiWireJsonSchema() },
    messages: [...prepared.messages],
    modelId: packageInput.wireModelId,
    profile,
    reasoning: {
      capabilities,
      mode: { effort: 'minimal' as const, mode: 'ADAPTIVE' as const },
    },
  } satisfies Omit<CorrectionProviderRequest, 'apiKey'>;
  return {
    request,
    view: transportView({ body: buildOpenRouterRequestBody(request), request }),
  };
}

export function buildGemini36TransportDifferential(
  input: Gemini36TransportDifferentialInput,
) {
  const campaign = evidenceExtractionCampaignSchema.parse(
    JSON.parse(input.acceptedCampaignText) as unknown,
  );
  const result = acceptedResultSchema.parse(
    JSON.parse(input.acceptedResultText) as unknown,
  );
  const campaignSha256 = sha256(input.acceptedCampaignText);
  const resultSha256 = sha256(input.acceptedResultText);
  if (campaignSha256 !== result.campaignSha256) {
    throw new Error('GEMINI_DIFFERENTIAL_ACCEPTED_LINKAGE_HASH_MISMATCH');
  }
  if (
    campaignSha256 !== GEMINI_3_6_ACCEPTED_SMOKE_SHA256.campaign ||
    resultSha256 !== GEMINI_3_6_ACCEPTED_SMOKE_SHA256.result
  ) {
    throw new Error('GEMINI_DIFFERENTIAL_ACCEPTED_SOURCE_HASH_MISMATCH');
  }
  if (
    sha256(input.acceptedRubricText) !== campaign.authority.rubricFileSha256 ||
    sha256(input.acceptedCorpusText) !== campaign.authority.semanticCorpusSha256
  ) {
    throw new Error('GEMINI_DIFFERENTIAL_ACCEPTED_AUTHORITY_HASH_MISMATCH');
  }

  const packageInput = buildWritingFrameworkGatePackage({
    authorityTexts: input.correctedAuthorityTexts,
    dossierPath: GEMINI_3_6_TRANSPORT_DIFFERENTIAL_PATHS.correctedDossier,
    dossierText: input.correctedDossierText,
    financeText: input.correctedFinanceText,
  });
  const accepted = acceptedTransport({
    campaign,
    corpusText: input.acceptedCorpusText,
    result,
    rubricText: input.acceptedRubricText,
  });
  const corrected = correctedTransport(packageInput);
  const acceptedManifest = buildOpenRouterTransportManifest(accepted.request);
  const correctedManifest = buildOpenRouterTransportManifest(corrected.request);

  const invariants = Object.freeze([
    invariant('WIRE_MODEL', accepted.view.model, corrected.view.model),
    invariant(
      'CATALOG_SNAPSHOT',
      campaign.researcher.modelSnapshot,
      packageInput.catalogSnapshotId,
    ),
    invariant(
      'REQUESTED_ROUTE',
      accepted.view.requestedRoute,
      corrected.view.requestedRoute,
    ),
    invariant(
      'ROUTE_PROVIDER',
      result.attempt.providerRoute,
      packageInput.expectedObservedProvider,
    ),
    invariant(
      'REASONING_EFFORT',
      accepted.view.reasoningEffort,
      corrected.view.reasoningEffort,
    ),
    invariant('MAX_TOKENS', accepted.view.maxTokens, corrected.view.maxTokens),
    invariant(
      'TEMPERATURE_OMITTED',
      accepted.view.temperatureOmitted,
      corrected.view.temperatureOmitted,
    ),
    invariant(
      'RESPONSE_FORMAT_TYPE',
      accepted.view.responseFormatType,
      corrected.view.responseFormatType,
    ),
    invariant(
      'RESPONSE_FORMAT_STRICT',
      accepted.view.responseFormatStrict,
      corrected.view.responseFormatStrict,
    ),
    invariant(
      'FALLBACK_DISABLED',
      accepted.view.fallbackDisabled,
      corrected.view.fallbackDisabled,
    ),
  ]);

  const expectedDifferences = Object.freeze([
    Object.freeze({
      accepted: {
        messageCount: accepted.view.messageCount,
        messagesSha256: accepted.view.messagesSha256,
      },
      corrected: {
        messageCount: corrected.view.messageCount,
        messagesSha256: corrected.view.messagesSha256,
      },
      expected: true,
      name: 'MESSAGES_AND_TRUST_BOUNDARY',
      observed:
        accepted.view.messageCount === 1 &&
        corrected.view.messageCount === 2 &&
        accepted.view.messagesSha256 !== corrected.view.messagesSha256,
      reason:
        'Protocol 1.3 used one exact-quote/status system message; Evidence Assist 3.0 separates trusted system instructions from untrusted learner passages.',
    }),
    Object.freeze({
      accepted: EVIDENCE_RESEARCHER_PROTOCOL_VERSION,
      corrected: EVIDENCE_ASSIST_PROTOCOL_VERSION,
      expected: true,
      name: 'PROTOCOL',
      observed:
        EVIDENCE_RESEARCHER_PROTOCOL_VERSION === '1.3.0' &&
        EVIDENCE_ASSIST_PROTOCOL_VERSION === '3.0.0',
      reason:
        'The accepted smoke returned atomic statuses and exact quotes; the corrected protocol returns candidate relations over server span identifiers.',
    }),
    Object.freeze({
      accepted: {
        rootKeys: accepted.view.schemaRootKeys,
        schemaSha256: accepted.view.schemaSha256,
      },
      corrected: {
        patternPresent: containsKey(corrected.view.jsonSchema, 'pattern'),
        rootKeys: corrected.view.schemaRootKeys,
        schemaSha256: corrected.view.schemaSha256,
        wireDialect: EVIDENCE_ASSIST_GEMINI_WIRE_DIALECT,
        wireDialectVersion: EVIDENCE_ASSIST_GEMINI_WIRE_DIALECT_VERSION,
      },
      expected: true,
      name: 'WIRE_SCHEMA',
      observed:
        accepted.view.schemaSha256 !== corrected.view.schemaSha256 &&
        canonicalJsonV2(accepted.view.schemaRootKeys) ===
          canonicalJsonV2(['elements']) &&
        canonicalJsonV2(corrected.view.schemaRootKeys) ===
          canonicalJsonV2(['findings']) &&
        EVIDENCE_ASSIST_GEMINI_WIRE_DIALECT_VERSION ===
          'evidence-assist-wire/3.0.1' &&
        !containsKey(corrected.view.jsonSchema, 'pattern'),
      reason:
        'Evidence Assist wire 3.0.1 uses findings/relation/spanIds and removes the locally enforced span-id pattern from the Gemini response_format schema.',
    }),
  ]);

  const invariantMatch = invariants.every(({ matches }) => matches);
  const expectedDifferencesObserved = expectedDifferences.every(
    ({ expected, observed }) => expected && observed,
  );
  const core = Object.freeze({
    acceptedReference: {
      campaignId: campaign.campaignId,
      historicalProviderAttempts: result.providerAttemptsExecuted,
      productVerdict: result.productVerdict,
      status: result.status,
    },
    authorityEffects: {
      financeArbitrationCreated: false,
      identityCreated: false,
      networkGoGranted: false,
      ownerAuthorizationCreated: false,
    },
    builders: [
      'buildEvidenceResearcherPrompt',
      'researcherJsonSchema',
      'buildWritingFrameworkGatePackage',
      'prepareEvidenceAssistRequestV2',
      'evidenceAssistGeminiWireJsonSchema',
      'writingFrameworkGateOpenRouterRequestProfile',
      'writingFrameworkGateReasoningCapabilities',
      'buildOpenRouterRequestBody',
      'buildOpenRouterTransportManifest',
    ],
    comparatorId: 'learnx-gemini-3-6-transport-differential-v1',
    comparisonExecution: {
      mode: 'VALIDATE_ONLY',
      modelCallsPerformed: 0,
      networkCallsPerformed: 0,
      writesPerformed: 0,
    },
    correctedReference: {
      financeModelCallsAllowed:
        packageInput.finance.authorizationBoundary.modelCallsAllowed,
      historicalClosedIdentityFingerprint: packageInput.identityFingerprint,
      transportManifestSha256: correctedManifest.manifestSha256,
    },
    expectedDifferences,
    invariants,
    schemaVersion: 1,
    sources: {
      acceptedCampaign: {
        path: GEMINI_3_6_TRANSPORT_DIFFERENTIAL_PATHS.acceptedCampaign,
        sha256: campaignSha256,
      },
      acceptedResult: {
        path: GEMINI_3_6_TRANSPORT_DIFFERENTIAL_PATHS.acceptedResult,
        sha256: resultSha256,
      },
      acceptedTransportManifestSha256: acceptedManifest.manifestSha256,
      correctedAuthoritySetSha256: sha256(
        canonicalJsonV2(
          Object.entries(input.correctedAuthorityTexts)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([path, text]) => ({ path, sha256: sha256(text) })),
        ),
      ),
      correctedDossier: {
        path: GEMINI_3_6_TRANSPORT_DIFFERENTIAL_PATHS.correctedDossier,
        sha256: sha256(input.correctedDossierText),
      },
      correctedFinance: {
        path: GEMINI_3_6_TRANSPORT_DIFFERENTIAL_PATHS.correctedFinance,
        sha256: sha256(input.correctedFinanceText),
      },
    },
    status:
      invariantMatch && expectedDifferencesObserved
        ? 'VALIDATED_INVARIANTS_WITH_EXPECTED_PROTOCOL_DIFFERENCES'
        : 'DIFFERENTIAL_MISMATCH',
  });
  return Object.freeze({
    ...core,
    reportFingerprint: sha256(canonicalJsonV2(core)),
  });
}

export type Gemini36TransportDifferentialReport = ReturnType<
  typeof buildGemini36TransportDifferential
>;

export function assertGemini36TransportDifferential(
  report: Gemini36TransportDifferentialReport,
): void {
  if (
    report.status !==
      'VALIDATED_INVARIANTS_WITH_EXPECTED_PROTOCOL_DIFFERENCES' ||
    report.invariants.some(({ matches }) => !matches) ||
    report.expectedDifferences.some(({ expected, observed }) =>
      expected ? !observed : observed,
    ) ||
    report.comparisonExecution.networkCallsPerformed !== 0 ||
    report.comparisonExecution.modelCallsPerformed !== 0 ||
    report.authorityEffects.identityCreated ||
    report.authorityEffects.financeArbitrationCreated ||
    report.authorityEffects.networkGoGranted ||
    report.authorityEffects.ownerAuthorizationCreated
  ) {
    throw new Error('GEMINI_3_6_TRANSPORT_DIFFERENTIAL_INVALID');
  }
}
