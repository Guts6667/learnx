import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  EVIDENCE_ASSIST_FOUR_CASE_MANIFEST_PATH,
  EVIDENCE_ASSIST_FREEZE_SET_MANIFEST_PATH,
  EVIDENCE_ASSIST_PANEL_MANIFEST_PATH,
  type EvidenceAssistGateMetrics,
  sha256,
} from './evidence-assist-development-campaign.ts';
import {
  applyGoAutonomousFormativePromotion,
  artifactSha256,
  createGoAutonomousFormativeArtifact,
  createGoToSealedHoldoutArtifact,
  evidenceAssistPromotionPolicySchema,
  type EvidenceAssistFourCaseResult,
  type EvidenceAssistHoldoutResult,
  type EvidenceAssistPanelResult,
} from './evidence-assist-promotion.ts';

const read = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');
const digest = (character: string): string => character.repeat(64);

const passingMetrics = (): EvidenceAssistGateMetrics => ({
  atomicRelationAgreementRate: 1,
  candidateRelationConsumedByMechanicalDecisionCount: 0,
  dispatchAndCostReconciledRate: 1,
  falseSupportCount: 0,
  injectionAndCanarySafetyRate: 1,
  knownSpanIdentifierRate: 1,
  metamorphicDecisionDriftCount: 0,
  modelForbiddenFieldCount: 0,
  partialFindingIsolationRate: 1,
  rawOutputAndRequestContextBindingRate: 1,
  scoreDerivedFromSemanticRelationCount: 0,
  unknownRequirementCount: 0,
  variabilityRate: 0,
});

const identityFingerprint = JSON.parse(
  read(EVIDENCE_ASSIST_FOUR_CASE_MANIFEST_PATH),
).identity.fingerprint as string;
const freezeSetManifestSha256 = sha256(
  read(EVIDENCE_ASSIST_FREEZE_SET_MANIFEST_PATH),
);

const fourCaseResult = (): EvidenceAssistFourCaseResult => ({
  actualCostUsd: 0.2,
  campaignId: 'learnx-writing-fr-sonnet-5-evidence-assist-four-case-v1',
  campaignIdentityFingerprint: identityFingerprint,
  completedUsableWorkflows: 4,
  dispatchAndCostReconciled: true,
  expectedLogicalWorkflows: 4,
  freezeSetId: 'learnx-writing-fr-sonnet-5-evidence-assist-development-v1',
  freezeSetManifestSha256,
  historicalResultsReused: 0,
  manifestSha256: sha256(read(EVIDENCE_ASSIST_FOUR_CASE_MANIFEST_PATH)),
  metrics: passingMetrics(),
  modelCallsPerformed: 4,
  postResultRetuning: false,
  rawArtifactsBound: true,
  schemaVersion: 1,
  stage: 'FOUR_CASE_GATE',
  status: 'PASSED',
});

const panelResult = (): EvidenceAssistPanelResult => ({
  actualCostUsd: 1,
  campaignId: 'learnx-writing-fr-sonnet-5-evidence-assist-panel-10x2-v1',
  campaignIdentityFingerprint: identityFingerprint,
  completedUsableWorkflows: 20,
  dispatchAndCostReconciled: true,
  expectedLogicalWorkflows: 20,
  freezeSetId: 'learnx-writing-fr-sonnet-5-evidence-assist-development-v1',
  freezeSetManifestSha256,
  historicalResultsReused: 0,
  manifestSha256: sha256(read(EVIDENCE_ASSIST_PANEL_MANIFEST_PATH)),
  metrics: passingMetrics(),
  modelCallsPerformed: 20,
  postResultRetuning: false,
  rawArtifactsBound: true,
  schemaVersion: 1,
  stage: 'CONDITIONAL_PANEL_10X2',
  status: 'PASSED',
});

describe('evidence-assist promotion transitions', () => {
  it('keeps development GO separate from pipeline promotion', () => {
    const development = createGoToSealedHoldoutArtifact({
      createdAt: '2026-08-16T12:00:00Z',
      fourCaseResult: fourCaseResult(),
      panelResult: panelResult(),
    });

    expect(development.decision).toBe('GO_TO_SEALED_HOLDOUT');
    expect(development.pipelinePromoted).toBe(false);
    expect(development.holdoutExecutionAuthorized).toBe(false);
  });

  it('mutates pipelinePromoted only after a bound one-shot holdout passes', () => {
    const development = createGoToSealedHoldoutArtifact({
      createdAt: '2026-08-16T12:00:00Z',
      fourCaseResult: fourCaseResult(),
      panelResult: panelResult(),
    });
    const holdout: EvidenceAssistHoldoutResult = {
      actualCostUsd: 1.1,
      campaignIdentityFingerprint: identityFingerprint,
      candidateOutputsAccessibleDuringAuthoring: false,
      caseCount: 24,
      completedUsableWorkflows: 24,
      constructionManifestSha256: digest('a'),
      developmentDecisionArtifactSha256: artifactSha256(development),
      dispatchAndCostReconciledRate: 1,
      encryptedArtifactSha256: digest('b'),
      falseSupportCount: 0,
      holdoutId: 'writing-fr-evidence-assist-holdout-v3',
      injectionAndCanarySafetyRate: 1,
      knownSpanIdentifierRate: 1,
      metamorphicDecisionDriftCount: 0,
      modelForbiddenFieldCount: 0,
      oneShotOpenCount: 1,
      ownerOneShotAuthorizationConsumed: true,
      partialFindingIsolationRate: 1,
      postResultRetuning: false,
      rawOutputAndRequestContextBindingRate: 1,
      relationAgreementRate: 0.96,
      resultsBundleSha256: digest('c'),
      schemaVersion: 1,
      scoreDerivedFromSemanticRelationCount: 0,
      sealedBeforeOpening: true,
      status: 'PASSED',
      unknownRequirementCount: 0,
      validationRecordSha256: digest('d'),
      variabilityRate: 0.08,
    };
    const promotion = createGoAutonomousFormativeArtifact({
      createdAt: '2026-08-16T13:00:00Z',
      developmentDecision: development,
      holdoutResult: holdout,
      ownerPromotionAuthorization: 'GRANTED',
    });
    const promoted = applyGoAutonomousFormativePromotion({
      artifact: promotion,
      state: {
        campaignIdentityFingerprint: identityFingerprint,
        eligibility: { pipelinePromoted: false },
        promotionArtifactSha256: null,
      },
    });

    expect(promotion.decision).toBe('GO_AUTONOMOUS_FORMATIVE');
    expect(promotion.pipelineMutation).toEqual({
      field: 'eligibility.pipelinePromoted',
      from: false,
      to: true,
    });
    expect(promoted.eligibility.pipelinePromoted).toBe(true);
    expect(promoted.promotionArtifactSha256).toBe(artifactSha256(promotion));
  });

  it('rejects a development transition below the semantic threshold', () => {
    const panel = panelResult();
    panel.metrics.atomicRelationAgreementRate = 0.94;

    expect(() =>
      createGoToSealedHoldoutArtifact({
        createdAt: '2026-08-16T12:00:00Z',
        fourCaseResult: fourCaseResult(),
        panelResult: panel,
      }),
    ).toThrow('EVIDENCE_ASSIST_DEVELOPMENT_GATE_NOT_MET');
  });

  it('rejects a holdout not bound to the development decision', () => {
    const development = createGoToSealedHoldoutArtifact({
      createdAt: '2026-08-16T12:00:00Z',
      fourCaseResult: fourCaseResult(),
      panelResult: panelResult(),
    });

    expect(() =>
      createGoAutonomousFormativeArtifact({
        createdAt: '2026-08-16T13:00:00Z',
        developmentDecision: development,
        holdoutResult: {
          actualCostUsd: 1,
          campaignIdentityFingerprint: identityFingerprint,
          candidateOutputsAccessibleDuringAuthoring: false,
          caseCount: 24,
          completedUsableWorkflows: 24,
          constructionManifestSha256: digest('a'),
          developmentDecisionArtifactSha256: digest('e'),
          dispatchAndCostReconciledRate: 1,
          encryptedArtifactSha256: digest('b'),
          falseSupportCount: 0,
          holdoutId: 'writing-fr-evidence-assist-holdout-v3',
          injectionAndCanarySafetyRate: 1,
          knownSpanIdentifierRate: 1,
          metamorphicDecisionDriftCount: 0,
          modelForbiddenFieldCount: 0,
          oneShotOpenCount: 1,
          ownerOneShotAuthorizationConsumed: true,
          partialFindingIsolationRate: 1,
          postResultRetuning: false,
          rawOutputAndRequestContextBindingRate: 1,
          relationAgreementRate: 0.96,
          resultsBundleSha256: digest('c'),
          schemaVersion: 1,
          scoreDerivedFromSemanticRelationCount: 0,
          sealedBeforeOpening: true,
          status: 'PASSED',
          unknownRequirementCount: 0,
          validationRecordSha256: digest('d'),
          variabilityRate: 0.08,
        },
        ownerPromotionAuthorization: 'GRANTED',
      }),
    ).toThrow('EVIDENCE_ASSIST_HOLDOUT_DEVELOPMENT_BINDING_MISMATCH');
  });

  it('keeps the checked-in policy unpromoted and free of human evaluation', () => {
    const policy = evidenceAssistPromotionPolicySchema.parse(
      JSON.parse(
        read(
          'benchmarks/ai-correction/executable-rubric/evidence-assist-promotion-policy.v1.json',
        ),
      ),
    );

    expect(policy.currentState).toEqual({
      pipelinePromoted: false,
      transitionArtifactsIssued: 0,
    });
    expect(policy.humanEvaluatorRequired).toBe(false);
    expect(policy.transitions.map(({ decision }) => decision)).toEqual([
      'GO_TO_SEALED_HOLDOUT',
      'GO_AUTONOMOUS_FORMATIVE',
    ]);
  });
});
