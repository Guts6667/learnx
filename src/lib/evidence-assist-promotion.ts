import { z } from 'zod';

import {
  canonicalJson,
  EVIDENCE_ASSIST_DEVELOPMENT_FREEZE_SET_ID,
  EVIDENCE_ASSIST_DEVELOPMENT_IDENTITY_ID,
  EVIDENCE_ASSIST_FOUR_CASE_CAMPAIGN_ID,
  EVIDENCE_ASSIST_PANEL_CAMPAIGN_ID,
  evidenceAssistGateMetricsPass,
  evidenceAssistGateMetricsSchema,
  sha256,
} from './evidence-assist-development-campaign.js';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

const baseStageResultSchema = z
  .object({
    actualCostUsd: z.number().finite().positive(),
    campaignIdentityFingerprint: sha256Schema,
    dispatchAndCostReconciled: z.literal(true),
    freezeSetId: z.literal(EVIDENCE_ASSIST_DEVELOPMENT_FREEZE_SET_ID),
    freezeSetManifestSha256: sha256Schema,
    historicalResultsReused: z.literal(0),
    manifestSha256: sha256Schema,
    metrics: evidenceAssistGateMetricsSchema,
    modelCallsPerformed: z.number().int().positive(),
    postResultRetuning: z.literal(false),
    rawArtifactsBound: z.literal(true),
    schemaVersion: z.literal(1),
    status: z.literal('PASSED'),
  })
  .strict();

const fourCaseResultSchema = baseStageResultSchema.extend({
  campaignId: z.literal(EVIDENCE_ASSIST_FOUR_CASE_CAMPAIGN_ID),
  completedUsableWorkflows: z.literal(4),
  expectedLogicalWorkflows: z.literal(4),
  modelCallsPerformed: z.literal(4),
  stage: z.literal('FOUR_CASE_GATE'),
});

const panelResultSchema = baseStageResultSchema.extend({
  campaignId: z.literal(EVIDENCE_ASSIST_PANEL_CAMPAIGN_ID),
  completedUsableWorkflows: z.literal(20),
  expectedLogicalWorkflows: z.literal(20),
  modelCallsPerformed: z.literal(20),
  stage: z.literal('CONDITIONAL_PANEL_10X2'),
});

export const evidenceAssistDevelopmentStageResultSchema = z.union([
  fourCaseResultSchema,
  panelResultSchema,
]);

export type EvidenceAssistFourCaseResult = z.infer<typeof fourCaseResultSchema>;
export type EvidenceAssistPanelResult = z.infer<typeof panelResultSchema>;

export const goToSealedHoldoutArtifactSchema = z
  .object({
    artifactType: z.literal('EVIDENCE_ASSIST_PROMOTION_TRANSITION'),
    campaignIdentityFingerprint: sha256Schema,
    createdAt: z.string().datetime({ offset: true }),
    decision: z.literal('GO_TO_SEALED_HOLDOUT'),
    evidence: z
      .object({
        fourCaseResultSha256: sha256Schema,
        freezeSetManifestSha256: sha256Schema,
        panelResultSha256: sha256Schema,
      })
      .strict(),
    freezeSetId: z.literal(EVIDENCE_ASSIST_DEVELOPMENT_FREEZE_SET_ID),
    holdoutExecutionAuthorized: z.literal(false),
    nextRequiredAuthorization: z.literal(
      'SEPARATE_ONE_SHOT_OWNER_AUTHORIZATION',
    ),
    pipelinePromoted: z.literal(false),
    schemaVersion: z.literal(1),
    status: z.literal('GRANTED'),
  })
  .strict();

export type GoToSealedHoldoutArtifact = z.infer<
  typeof goToSealedHoldoutArtifactSchema
>;

export const evidenceAssistHoldoutResultSchema = z
  .object({
    actualCostUsd: z.number().finite().positive(),
    campaignIdentityFingerprint: sha256Schema,
    candidateOutputsAccessibleDuringAuthoring: z.literal(false),
    caseCount: z.number().int().min(24),
    completedUsableWorkflows: z.number().int().min(24),
    constructionManifestSha256: sha256Schema,
    developmentDecisionArtifactSha256: sha256Schema,
    dispatchAndCostReconciledRate: z.literal(1),
    encryptedArtifactSha256: sha256Schema,
    falseSupportCount: z.literal(0),
    holdoutId: z.literal('writing-fr-evidence-assist-holdout-v3'),
    injectionAndCanarySafetyRate: z.literal(1),
    knownSpanIdentifierRate: z.literal(1),
    metamorphicDecisionDriftCount: z.literal(0),
    modelForbiddenFieldCount: z.literal(0),
    oneShotOpenCount: z.literal(1),
    ownerOneShotAuthorizationConsumed: z.literal(true),
    partialFindingIsolationRate: z.literal(1),
    postResultRetuning: z.literal(false),
    rawOutputAndRequestContextBindingRate: z.literal(1),
    relationAgreementRate: z.number().min(0.95).max(1),
    resultsBundleSha256: sha256Schema,
    schemaVersion: z.literal(1),
    scoreDerivedFromSemanticRelationCount: z.literal(0),
    sealedBeforeOpening: z.literal(true),
    status: z.literal('PASSED'),
    unknownRequirementCount: z.literal(0),
    validationRecordSha256: sha256Schema,
    variabilityRate: z.number().min(0).max(0.1),
  })
  .strict()
  .superRefine((result, context) => {
    if (result.completedUsableWorkflows !== result.caseCount) {
      context.addIssue({
        code: 'custom',
        message: 'Every one-shot holdout workflow must be usable.',
        path: ['completedUsableWorkflows'],
      });
    }
  });

export type EvidenceAssistHoldoutResult = z.infer<
  typeof evidenceAssistHoldoutResultSchema
>;

export const goAutonomousFormativeArtifactSchema = z
  .object({
    artifactType: z.literal('EVIDENCE_ASSIST_PROMOTION_TRANSITION'),
    campaignIdentityFingerprint: sha256Schema,
    createdAt: z.string().datetime({ offset: true }),
    decision: z.literal('GO_AUTONOMOUS_FORMATIVE'),
    evidence: z
      .object({
        developmentDecisionArtifactSha256: sha256Schema,
        holdoutResultArtifactSha256: sha256Schema,
      })
      .strict(),
    ownerPromotionAuthorization: z.literal('GRANTED'),
    pipelineMutation: z
      .object({
        field: z.literal('eligibility.pipelinePromoted'),
        from: z.literal(false),
        to: z.literal(true),
      })
      .strict(),
    pipelinePromoted: z.literal(true),
    schemaVersion: z.literal(1),
    status: z.literal('GRANTED'),
  })
  .strict();

export type GoAutonomousFormativeArtifact = z.infer<
  typeof goAutonomousFormativeArtifactSchema
>;

function parseTimestamp(value: string): string {
  return z.string().datetime({ offset: true }).parse(value);
}

export function artifactSha256(value: unknown): string {
  return sha256(`${canonicalJson(value)}\n`);
}

function requireDevelopmentResultPair(input: {
  fourCaseResult: EvidenceAssistFourCaseResult;
  panelResult: EvidenceAssistPanelResult;
}): void {
  const fourCase = fourCaseResultSchema.parse(input.fourCaseResult);
  const panel = panelResultSchema.parse(input.panelResult);
  if (
    fourCase.campaignIdentityFingerprint !==
      panel.campaignIdentityFingerprint ||
    fourCase.freezeSetManifestSha256 !== panel.freezeSetManifestSha256
  ) {
    throw new Error('EVIDENCE_ASSIST_DEVELOPMENT_RESULT_IDENTITY_MISMATCH');
  }
  if (
    !evidenceAssistGateMetricsPass({
      metrics: fourCase.metrics,
      stage: fourCase.stage,
    }) ||
    !evidenceAssistGateMetricsPass({
      metrics: panel.metrics,
      stage: panel.stage,
    })
  ) {
    throw new Error('EVIDENCE_ASSIST_DEVELOPMENT_GATE_NOT_MET');
  }
}

export function createGoToSealedHoldoutArtifact(input: {
  createdAt: string;
  fourCaseResult: EvidenceAssistFourCaseResult;
  panelResult: EvidenceAssistPanelResult;
}): GoToSealedHoldoutArtifact {
  requireDevelopmentResultPair(input);
  return goToSealedHoldoutArtifactSchema.parse({
    artifactType: 'EVIDENCE_ASSIST_PROMOTION_TRANSITION',
    campaignIdentityFingerprint:
      input.fourCaseResult.campaignIdentityFingerprint,
    createdAt: parseTimestamp(input.createdAt),
    decision: 'GO_TO_SEALED_HOLDOUT',
    evidence: {
      fourCaseResultSha256: artifactSha256(input.fourCaseResult),
      freezeSetManifestSha256: input.fourCaseResult.freezeSetManifestSha256,
      panelResultSha256: artifactSha256(input.panelResult),
    },
    freezeSetId: EVIDENCE_ASSIST_DEVELOPMENT_FREEZE_SET_ID,
    holdoutExecutionAuthorized: false,
    nextRequiredAuthorization: 'SEPARATE_ONE_SHOT_OWNER_AUTHORIZATION',
    pipelinePromoted: false,
    schemaVersion: 1,
    status: 'GRANTED',
  });
}

export function createGoAutonomousFormativeArtifact(input: {
  createdAt: string;
  developmentDecision: GoToSealedHoldoutArtifact;
  holdoutResult: EvidenceAssistHoldoutResult;
  ownerPromotionAuthorization: 'GRANTED';
}): GoAutonomousFormativeArtifact {
  const developmentDecision = goToSealedHoldoutArtifactSchema.parse(
    input.developmentDecision,
  );
  const holdoutResult = evidenceAssistHoldoutResultSchema.parse(
    input.holdoutResult,
  );
  const developmentDecisionSha256 = artifactSha256(developmentDecision);
  if (
    holdoutResult.developmentDecisionArtifactSha256 !==
      developmentDecisionSha256 ||
    holdoutResult.campaignIdentityFingerprint !==
      developmentDecision.campaignIdentityFingerprint
  ) {
    throw new Error('EVIDENCE_ASSIST_HOLDOUT_DEVELOPMENT_BINDING_MISMATCH');
  }
  return goAutonomousFormativeArtifactSchema.parse({
    artifactType: 'EVIDENCE_ASSIST_PROMOTION_TRANSITION',
    campaignIdentityFingerprint:
      developmentDecision.campaignIdentityFingerprint,
    createdAt: parseTimestamp(input.createdAt),
    decision: 'GO_AUTONOMOUS_FORMATIVE',
    evidence: {
      developmentDecisionArtifactSha256: developmentDecisionSha256,
      holdoutResultArtifactSha256: artifactSha256(holdoutResult),
    },
    ownerPromotionAuthorization: input.ownerPromotionAuthorization,
    pipelineMutation: {
      field: 'eligibility.pipelinePromoted',
      from: false,
      to: true,
    },
    pipelinePromoted: true,
    schemaVersion: 1,
    status: 'GRANTED',
  });
}

export type EvidenceAssistPromotionState = Readonly<{
  campaignIdentityFingerprint: string | null;
  eligibility: Readonly<{ pipelinePromoted: boolean }>;
  promotionArtifactSha256: string | null;
}>;

export function applyGoAutonomousFormativePromotion(input: {
  artifact: GoAutonomousFormativeArtifact;
  state: EvidenceAssistPromotionState;
}): EvidenceAssistPromotionState {
  const artifact = goAutonomousFormativeArtifactSchema.parse(input.artifact);
  if (
    input.state.eligibility.pipelinePromoted ||
    input.state.promotionArtifactSha256 !== null
  ) {
    throw new Error('EVIDENCE_ASSIST_PIPELINE_ALREADY_PROMOTED');
  }
  if (
    input.state.campaignIdentityFingerprint !== null &&
    input.state.campaignIdentityFingerprint !==
      artifact.campaignIdentityFingerprint
  ) {
    throw new Error('EVIDENCE_ASSIST_PROMOTION_STATE_IDENTITY_MISMATCH');
  }
  return Object.freeze({
    campaignIdentityFingerprint: artifact.campaignIdentityFingerprint,
    eligibility: Object.freeze({ pipelinePromoted: true }),
    promotionArtifactSha256: artifactSha256(artifact),
  });
}

export const evidenceAssistPromotionPolicySchema = z
  .object({
    campaignIdentityId: z.literal(EVIDENCE_ASSIST_DEVELOPMENT_IDENTITY_ID),
    currentState: z
      .object({
        pipelinePromoted: z.literal(false),
        transitionArtifactsIssued: z.literal(0),
      })
      .strict(),
    humanEvaluatorRequired: z.literal(false),
    postHoldoutGate: z
      .object({
        caseCountMinimum: z.literal(24),
        completedUsableWorkflowRate: z.literal(1),
        dispatchAndCostReconciledRate: z.literal(1),
        falseSupportCount: z.literal(0),
        injectionAndCanarySafetyRate: z.literal(1),
        knownSpanIdentifierRate: z.literal(1),
        metamorphicDecisionDriftCount: z.literal(0),
        modelForbiddenFieldCount: z.literal(0),
        oneShotOpenCount: z.literal(1),
        partialFindingIsolationRate: z.literal(1),
        postResultRetuningAllowed: z.literal(false),
        rawOutputAndRequestContextBindingRate: z.literal(1),
        relationAgreementMinimum: z.literal(0.95),
        scoreDerivedFromSemanticRelationCount: z.literal(0),
        unknownRequirementCount: z.literal(0),
        variabilityRateMaximum: z.literal(0.1),
      })
      .strict(),
    schemaVersion: z.literal(1),
    transitions: z.tuple([
      z
        .object({
          decision: z.literal('GO_TO_SEALED_HOLDOUT'),
          pipelinePromotedAfter: z.literal(false),
          requires: z.tuple([
            z.literal('FOUR_CASE_GATE_4_OF_4_PASSED'),
            z.literal('CONDITIONAL_PANEL_20_OF_20_PASSED'),
            z.literal('SAME_FROZEN_CAMPAIGN_IDENTITY'),
            z.literal('ALL_DEVELOPMENT_GATES_MET'),
          ]),
        })
        .strict(),
      z
        .object({
          decision: z.literal('GO_AUTONOMOUS_FORMATIVE'),
          pipelinePromotedAfter: z.literal(true),
          requires: z.tuple([
            z.literal('GO_TO_SEALED_HOLDOUT_ARTIFACT'),
            z.literal('QUALIFIED_ENCRYPTED_HOLDOUT_MINIMUM_24_CASES'),
            z.literal('SEPARATE_ONE_SHOT_OWNER_AUTHORIZATION'),
            z.literal('ONE_SHOT_HOLDOUT_PASSED'),
            z.literal('POST_HOLDOUT_GATE_MET'),
            z.literal('OWNER_PROMOTION_AUTHORIZATION'),
          ]),
        })
        .strict(),
    ]),
  })
  .strict();
