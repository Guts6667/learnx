import { createHash } from 'node:crypto';

import { z } from 'zod';

import { autonomousFormativeCorpusSchema } from './autonomous-formative-corpus.ts';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const nullablePositiveNumberSchema = z.number().positive().nullable();

const autonomousGateSchema = z
  .object({
    criterionAgreementRateMinimum: z.literal(0.85),
    decisionAgreementMinimum: z.literal('19/20'),
    dispatchAndCostReconciledRate: z.literal(1),
    evidenceAndInjectionSafetyRate: z.literal(1),
    falsePassCountMaximum: z.literal(0),
    fullChargeForUncertainOrUnusable: z.literal(false),
    postResultRetuningAllowed: z.literal(false),
    publishedOrdinalGapAtLeastTwoWithoutAbstentionMaximum: z.literal(0),
    usableWorkflowsRequired: z.literal('20/20'),
    variabilityRateMaximum: z.literal(0.1),
  })
  .strict();

export const autonomousGeminiCampaignConfigSchema = z
  .object({
    authorization: z
      .object({
        granted: z.literal(false),
        requiredFrom: z.literal('OWNER'),
        status: z.literal('NOT_GRANTED'),
      })
      .strict(),
    blockers: z
      .object({
        dispatchCostReconciliation: z
          .object({
            key: z.literal('DISPATCH_COST_RECONCILIATION'),
            requiredTests: z.tuple([
              z.literal('NULL_COST_AND_NULL_PROVIDER_REQUEST_ID'),
              z.literal('TIMEOUT_AFTER_DISPATCH'),
              z.literal('IDEMPOTENT_RETRY'),
              z.literal('RECOVERY_WITHOUT_SECOND_PROVIDER_CALL'),
            ]),
            status: z.literal('OPEN_BLOCKING'),
          })
          .strict(),
        neonRehearsal: z
          .object({
            sharedDatabaseAllowed: z.literal(false),
            status: z.literal('REQUIRED_NOT_COMPLETED'),
            target: z.literal('DISPOSABLE_NEON_BRANCH'),
          })
          .strict(),
      })
      .strict(),
    budget: z
      .object({
        currency: z.literal('USD'),
        expectedCostUsd: nullablePositiveNumberSchema,
        hardCapUsd: nullablePositiveNumberSchema,
        maximumProviderAttempts: z.number().int().positive().nullable(),
        pricingSnapshotId: z.string().min(1).nullable(),
        status: z.literal('PENDING_FINANCE_AND_OWNER_VALIDATION'),
      })
      .strict(),
    campaignId: z.literal('learnx-writing-fr-gemini-autonomous-mini-panel-v1'),
    campaignVersion: z.literal('1.0.0'),
    candidate: z
      .object({
        architecture: z.literal('SINGLE_MODEL'),
        fallbackAllowed: z.literal(false),
        modelFamily: z.literal('GEMINI'),
        modelId: z.string().min(1).nullable(),
        modelSnapshot: z.string().min(1).nullable(),
        providerRoute: z.string().min(1).nullable(),
        providerRouteValidated: z.literal(false),
        status: z.literal('IDENTITY_AND_ROUTE_PENDING_VALIDATION'),
      })
      .strict(),
    execution: z
      .object({
        cases: z.literal(10),
        expectedLogicalWorkflows: z.literal(20),
        freshLogicalWorkflows: z.literal(20),
        historicalResultsReused: z.literal(0),
        repetitionsPerCase: z.literal(2),
        reusePolicy: z.literal('FRESH_ALL_20_NO_HISTORICAL_REUSE'),
      })
      .strict(),
    feature: z
      .object({
        enabled: z.literal(false),
        flag: z.literal('V4_AUTONOMOUS_GEMINI_PANEL'),
        networkCallsAllowed: z.literal(false),
        scope: z.literal('RESEARCH_ONLY'),
      })
      .strict(),
    gate: z
      .object({
        name: z.literal('GO_AUTONOMOUS_FORMATIVE'),
        requirements: autonomousGateSchema,
        status: z.literal('NOT_EVALUATED'),
      })
      .strict(),
    language: z.literal('fr-FR'),
    modality: z.literal('WRITING'),
    protocol: z
      .object({
        promptVersion: z.string().min(1).nullable(),
        requestProfileVersion: z.string().min(1).nullable(),
        status: z.literal('PENDING_IDENTITY_VALIDATION'),
      })
      .strict(),
    schemaVersion: z.literal(1),
    status: z.literal('DRAFT_BLOCKED'),
  })
  .strict()
  .superRefine((configuration, context) => {
    const budgetValues = [
      configuration.budget.expectedCostUsd,
      configuration.budget.hardCapUsd,
      configuration.budget.maximumProviderAttempts,
      configuration.budget.pricingSnapshotId,
    ];
    if (budgetValues.some((value) => value !== null)) {
      context.addIssue({
        code: 'custom',
        message: 'Unvalidated campaign budget fields must remain null.',
        path: ['budget'],
      });
    }

    const candidateValues = [
      configuration.candidate.modelId,
      configuration.candidate.modelSnapshot,
      configuration.candidate.providerRoute,
      configuration.protocol.promptVersion,
      configuration.protocol.requestProfileVersion,
    ];
    if (candidateValues.some((value) => value !== null)) {
      context.addIssue({
        code: 'custom',
        message: 'Candidate identity, route and protocol require a new validated configuration.',
        path: ['candidate'],
      });
    }
  });

const campaignCellSchema = z
  .object({
    caseDigest: sha256Schema,
    caseId: z.string().min(1),
    repetition: z.union([z.literal(1), z.literal(2)]),
    reuseHistoricalResult: z.literal(false),
  })
  .strict();

export const autonomousGeminiCampaignManifestSchema = z
  .object({
    campaign: z
      .object({
        id: z.literal('learnx-writing-fr-gemini-autonomous-mini-panel-v1'),
        version: z.literal('1.0.0'),
      })
      .strict(),
    configuration: z
      .object({ path: z.string().min(1), sha256: sha256Schema })
      .strict(),
    corpus: z
      .object({
        id: z.literal('learnx-writing-fr-autonomous-development-v1'),
        oracleDigest: sha256Schema,
        path: z.literal('../writing-fr-development-mini-panel.v1.json'),
        sha256: sha256Schema,
      })
      .strict(),
    executable: z.literal(false),
    gate: z.literal('GO_AUTONOMOUS_FORMATIVE'),
    holdoutAccess: z.literal('PROHIBITED'),
    manifestId: z.literal('learnx-writing-fr-gemini-autonomous-mini-panel-manifest-v1'),
    matrix: z.array(campaignCellSchema).length(20),
    phase: z
      .object({
        manifestId: z.literal('learnx-v4-ai-correction-phase-2026-08-13'),
        path: z.literal('../../../../docs/V4_AI_CORRECTION_PHASE_MANIFEST.json'),
        sha256: sha256Schema,
      })
      .strict(),
    schemaVersion: z.literal(1),
    status: z.literal('DRAFT_NOT_EXECUTABLE'),
  })
  .strict();

export type AutonomousGeminiCampaignConfig = z.infer<
  typeof autonomousGeminiCampaignConfigSchema
>;
export type AutonomousGeminiCampaignManifest = z.infer<
  typeof autonomousGeminiCampaignManifestSchema
>;

export function sha256Text(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function validateAutonomousGeminiCampaign(input: {
  configuration: unknown;
  configurationText: string;
  corpus: unknown;
  corpusText: string;
  manifest: unknown;
  phaseManifest: unknown;
  phaseManifestText: string;
}): {
  configuration: AutonomousGeminiCampaignConfig;
  manifest: AutonomousGeminiCampaignManifest;
} {
  const configuration = autonomousGeminiCampaignConfigSchema.parse(input.configuration);
  const manifest = autonomousGeminiCampaignManifestSchema.parse(input.manifest);
  const corpus = autonomousFormativeCorpusSchema.parse(input.corpus);
  const phaseManifest = z
    .object({ manifestId: z.string(), openBlockers: z.array(z.object({ key: z.string(), status: z.string() }).passthrough()) })
    .passthrough()
    .parse(input.phaseManifest);

  if (manifest.configuration.sha256 !== sha256Text(input.configurationText)) {
    throw new Error('AUTONOMOUS_GEMINI_CONFIGURATION_DIGEST_MISMATCH');
  }
  if (manifest.corpus.sha256 !== sha256Text(input.corpusText)) {
    throw new Error('AUTONOMOUS_GEMINI_CORPUS_DIGEST_MISMATCH');
  }
  if (manifest.phase.sha256 !== sha256Text(input.phaseManifestText)) {
    throw new Error('AUTONOMOUS_GEMINI_PHASE_DIGEST_MISMATCH');
  }
  if (manifest.phase.manifestId !== phaseManifest.manifestId) {
    throw new Error('AUTONOMOUS_GEMINI_PHASE_ID_MISMATCH');
  }
  if (manifest.corpus.oracleDigest !== corpus.oracleDigest) {
    throw new Error('AUTONOMOUS_GEMINI_ORACLE_DIGEST_MISMATCH');
  }
  if (
    !phaseManifest.openBlockers.some(
      (blocker) =>
        blocker.key === 'DISPATCH_COST_RECONCILIATION' && blocker.status === 'OPEN',
    )
  ) {
    throw new Error('AUTONOMOUS_GEMINI_P0_PHASE_BLOCKER_NOT_OPEN');
  }

  const expectedCells = new Map(
    corpus.cases.flatMap((benchmarkCase) =>
      ([1, 2] as const).map((repetition) => [
        `${benchmarkCase.caseId}:${repetition}`,
        benchmarkCase.caseDigest,
      ]),
    ),
  );
  const actualCells = new Map(
    manifest.matrix.map((cell) => [
      `${cell.caseId}:${cell.repetition}`,
      cell.caseDigest,
    ]),
  );
  if (
    actualCells.size !== expectedCells.size ||
    [...expectedCells].some(
      ([key, digest]) => actualCells.get(key) !== digest,
    )
  ) {
    throw new Error('AUTONOMOUS_GEMINI_FRESH_10X2_MATRIX_MISMATCH');
  }

  return { configuration, manifest };
}
