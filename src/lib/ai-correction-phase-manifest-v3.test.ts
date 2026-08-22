import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { evidenceAssistProtocolFingerprint } from './evidence-assist-protocol.ts';
import {
  EVIDENCE_ASSIST_FOUR_CASE_MANIFEST_PATH,
  EVIDENCE_ASSIST_FREEZE_SET_MANIFEST_PATH,
  EVIDENCE_ASSIST_PANEL_MANIFEST_PATH,
} from './evidence-assist-development-campaign.ts';
import {
  SONNET_5_REASONING_ATTESTATION_PATH,
  SONNET_5_REASONING_ATTESTATION_SHA256,
} from './sonnet-5-reasoning-capability-attestation.ts';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const historicalManifestSchema = z
  .object({ immutableVerdicts: z.array(z.unknown()) })
  .passthrough();

const activeManifestSchema = z
  .object({
    activeExecutionQueue: z.object({
      currentResponsibleAgent: z.literal('AGENT-PROTOCOLE-IA'),
      currentTicket: z.literal('V4-003E-Q1-R1'),
      liveActivationAllowed: z.literal(false),
      modelCallsAllowed: z.literal(false),
      orderedTickets: z.tuple([
        z.literal('V4-002A'),
        z.literal('V4-002B'),
        z.literal('V4-002C'),
        z.literal('V4-003A'),
        z.literal('V4-003B'),
        z.literal('V4-003A-R1'),
        z.literal('V4-003B-R1'),
        z.literal('V4-003C'),
        z.literal('V4-003D'),
        z.literal('V4-009C-S2'),
        z.literal('V4-003E'),
        z.literal('V4-003E-Q1'),
        z.literal('V4-003E-Q1-R1'),
        z.literal('V4-003E-Q2'),
        z.literal('V4-003E-Q3'),
      ]),
    }),
    baselines: z.object({
      research: z.object({
        commit: z.literal(
          'ba845d8b81c24a5c1d3fe448bf4e808920385f42',
        ),
        ref: z.literal('origin/dev'),
      }),
      runtime: z.object({
        commit: z.string().regex(/^[a-f0-9]{40}$/u),
        ref: z.literal('origin/dev'),
      }),
    }),
    deliveryState: z.object({
      experimental: z.object({
        pipelinePromoted: z.literal(false),
        status: z.literal(
          'V4_003E_Q1_GEMINI_3_6_NO_GO_TECHNICAL_RECONCILIATION_REQUIRED',
        ),
      }),
      offlineCandidate: z.object({
        status: z.literal('INTEGRATED_IN_RUNTIME_HARD_OFF'),
      }),
      runtimeCanonical: z.object({
        evidenceAssistProtocolIntegrated: z.literal(true),
        offlineFakeFlowIntegrated: z.literal(true),
        status: z.literal('DELIVERED_INACTIVE'),
      }),
    }),
    currentCampaignVerdicts: z.array(
      z.union([
      z.object({
        appendOnly: z.literal(true),
        arbitrationReport: z.literal(
          'docs/V4_003E_SONNET_5_SEMANTIC_NO_GO_REPORT.md',
        ),
        canonicalSource: z.object({
          commit: z.literal(
            'ba845d8b81c24a5c1d3fe448bf4e808920385f42',
          ),
          ref: z.literal('origin/dev'),
        }),
        finding: z.object({
          caseId: z.literal('baseline-pico-spider-mastered'),
          elementKey: z.literal('project-b-dimension-scope'),
          expectedAtomicStatus: z.literal('SUPPORTED'),
          expectedCandidateRelation: z.literal('EVIDENCE_FOR_ELEMENT'),
          observedCandidateRelation: z.literal('EVIDENCE_AGAINST_ELEMENT'),
          oracleAmbiguityDemonstrated: z.literal(false),
          spanId: z.literal('s0007-8a2f1b2dd94b10fd'),
        }),
        identityFingerprint: z.literal(
          'cc3b1b52bc0f94198faab362905617a3143169e952a53c38eb37f1571eda5d31',
        ),
        preservation: z.object({
          campaignClosed: z.literal(true),
          closedIdentityOrBudgetReuseAllowed: z.literal(false),
          holdoutAuthorized: z.literal(false),
          liveActivationAllowed: z.literal(false),
          panelAuthorized: z.literal(false),
          postResultRetuningAllowed: z.literal(false),
          replayAllowed: z.literal(false),
        }),
        scope: z.literal('EXACT_FROZEN_IDENTITY_ONLY'),
        statisticalScope: z.object({
          completedUsableWorkflows: z.literal(0),
          gateDecisionValidUnderStopPolicy: z.literal(true),
          maximumAuthorizedCalls: z.literal(4),
          modelCallsPerformed: z.literal(1),
          precisionVarianceRobustnessOrCostQuantilesEstimable:
            z.literal(false),
          statisticalGeneralizationAllowed: z.literal(false),
          unusedCallsNotSent: z.literal(3),
        }),
        telemetry: z.object({
          actualCostUsd: z.literal(0.018828),
          costSource: z.literal('ACTUAL'),
          inputTokens: z.literal(5829),
          latencyMs: z.literal(4228),
          observedProvider: z.literal('Anthropic'),
          reasoningTokens: z.literal(0),
          requestedRoute: z.literal('Anthropic'),
          visibleOutputTokens: z.literal(717),
        }),
        ticket: z.literal('V4-003E'),
        verdict: z.literal('NO-GO_SEMANTIC_DISAGREEMENT'),
        }),
        z.unknown(),
      ]),
    ).min(1),
    eligibility: z
      .object({
        activitiesEligibleForLiveCorrection: z.literal(0),
        pipelinePromoted: z.literal(false),
        publishedV4Contracts: z.literal(0),
      })
      .passthrough(),
    holdout: z
      .object({
        autonomousManifest: z.string().min(1),
        autonomousManifestSha256: z.string().regex(/^[a-f0-9]{64}$/u),
        executable: z.literal(false),
        encryptedArtifact: z.object({
          path: z.string().min(1),
          sha256: z.string().regex(/^[a-f0-9]{64}$/u),
        }),
        qualificationRecord: z.object({
          path: z.string().min(1),
          sha256: z.string().regex(/^[a-f0-9]{64}$/u),
        }),
        replacementManifest: z.string().min(1),
        replacementManifestSha256: z.string().regex(/^[a-f0-9]{64}$/u),
        sealed: z.literal(true),
        status: z.literal('SEALED_AWAITING_DEVELOPMENT_GO'),
      })
      .passthrough(),
    holdoutAdmissionGate: z.object({
      currentBlockers: z.tuple([
        z.literal('CLOSED_SONNET_IDENTITY_FAILED_STAGE_ONE'),
        z.literal('GEMINI_3_6_GATE_NO_GO_TECHNICAL'),
        z.literal('GEMINI_3_6_COST_RECONCILIATION_REQUIRED'),
        z.literal(
          'GEMINI_3_6_NEW_REMEDIATED_IDENTITY_NOT_FROZEN_OR_AUTHORIZED',
        ),
        z.literal('NEW_STAGE_ONE_NOT_EXECUTED'),
      ]),
      status: z.literal('NOT_ELIGIBLE'),
    }),
    immutableVerdicts: z.array(z.unknown()),
    offlineCandidateQueue: z.object({
      commonFrozenCore: z.object({
        candidateSpecificFieldsExcludedFromReuse: z.literal(true),
        candidateRequestProfileFingerprint: z.null(),
        candidateRunnerImplementationFingerprint: z.null(),
        conditionalPanelCaseOrder: z.tuple([
          z.literal('baseline-pico-spider-mastered'),
          z.literal('metamorphic-concise-complete'),
          z.literal('fidelity-a-first-fact-removed'),
          z.literal('fidelity-a-explicit-refusal'),
          z.literal('fidelity-b-explicit-refusal'),
          z.literal('conditional-a-peco-accepted'),
          z.literal('conditional-b-pcc-accepted'),
          z.literal('decision-a-materially-ambiguous'),
          z.literal('rationale-a-internal-contradiction'),
          z.literal('injection-negative-base-remains-partial'),
        ]),
        conditionalPanelFreshLogicalWorkflows: z.literal(20),
        conditionalPanelRepetitionsPerCase: z.literal(2),
        conditionalPanelShape: z.literal('10x2'),
        corpusFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
        gateFourCaseOrder: z.tuple([
          z.literal('baseline-pico-spider-mastered'),
          z.literal('fidelity-a-explicit-refusal'),
          z.literal('fidelity-a-first-fact-removed'),
          z.literal('injection-negative-base-remains-partial'),
        ]),
        oracle: z.object({
          canonicalFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
          path: z.string().min(1),
          sha256: z.string().regex(/^[a-f0-9]{64}$/u),
        }),
        postResultRetuningAllowed: z.literal(false),
        protocol: z.object({
          path: z.literal('docs/V4_EVIDENCE_ASSIST_PROTOCOL_SPEC.md'),
          sha256: z.string().regex(/^[a-f0-9]{64}$/u),
          version: z.literal('3.0.0'),
        }),
        protocolRevisionCondition: z.literal(
          'SAME_ERROR_CLASS_REPRODUCED_BY_MULTIPLE_INDEPENDENT_MODEL_FAMILIES',
        ),
        requiredStageOneResult: z.literal('4/4'),
        rubric: z.object({
          compiledFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
          path: z.string().min(1),
          sha256: z.string().regex(/^[a-f0-9]{64}$/u),
        }),
        semanticMappingFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
        sourceFreezeDossier: z.string().min(1),
        sourceFreezeDossierSha256: z.string().regex(/^[a-f0-9]{64}$/u),
        sourceRunnerBehavioralContractFingerprint: z
          .string()
          .regex(/^[a-f0-9]{64}$/u),
        stopPolicyFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
        telemetryContractFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
      }),
      closedGateTicket: z.literal('V4-003E-Q1'),
      currentTicket: z.literal('V4-003E-Q1-R1'),
      remediation: z.object({
        costReconciliationAuthority: z.object({
          conservativeWriteOffRequiresSeparateFinanceAuthorization:
            z.literal(true),
          path: z.literal(
            'docs/V4_003E_Q1_GEMINI_3_6_COST_RECONCILIATION.md',
          ),
          retryFromUtcDate: z.literal('2026-08-23'),
          sameDayActivityLookup: z.literal('UNAVAILABLE_CURRENT_UTC_DAY'),
          sha256: z.string().regex(/^[a-f0-9]{64}$/u),
          status: z.literal('RECONCILIATION_REQUIRED'),
        }),
        financeArbitrationRequired: z.literal(true),
        informativePublicReattestation: z.object({
          financeArbitrationEffect: z.literal('NONE'),
          mode: z.literal(
            'PUBLIC_CATALOG_AND_DOCUMENTATION_READ_ONLY_NO_INFERENCE',
          ),
          modelCallsPerformed: z.literal(0),
          networkAuthorizationEffect: z.literal('NONE'),
          newIdentityEffect: z.literal('NONE'),
          observedInformativePricingUsdPerMillionTokens: z.object({
            input: z.literal(0.75),
            outputAndReasoning: z.literal(3.75),
          }),
          path: z.literal(
            'benchmarks/ai-correction/executable-rubric/gemini-3-6-google-vertex-attestation-2026-08-22.json',
          ),
          sha256: z.string().regex(/^[a-f0-9]{64}$/u),
          status: z.literal('REATTESTED_OFFLINE_NETWORK_GO_NOT_GRANTED'),
          pricingAuthorityEffect: z.literal(
            'NONE_REQUIRES_FRESH_FINANCE_ARBITRATION',
          ),
        }),
        localFakePreflightRequired: z.literal(true),
        mode: z.literal('OFFLINE_ONLY'),
        modelCallsAllowed: z.literal(false),
        transportRemediation: z.object({
          candidateCause: z.literal('PATTERN_KEYWORD_HYPOTHESIS_NOT_PROVEN'),
          conservativeWriteOffNeverAutomatic: z.literal(true),
          generationAndProviderRequestIdsSeparated: z.literal(true),
          localSpanIdPatternValidationRetained: z.literal(true),
          metadataHeaderEnabled: z.literal(true),
          networkOrModelCallsPerformed: z.literal(0),
          recursiveGeminiKeywordPreflight: z.literal(true),
          requestManifestBeforeCallIntent: z.literal(true),
          status: z.literal(
            'IMPLEMENTED_AND_TESTED_OFFLINE_NEW_IDENTITY_NOT_FROZEN',
          ),
          wireDialect: z.literal('evidence-assist-wire/3.0.1'),
          wirePatternOmitted: z.literal(true),
        }),
        newIdentityFingerprint: z.null(),
        newIdentityRequired: z.literal(true),
        newOwnerSingleUseAuthorizationRequired: z.literal(true),
      }),
      candidates: z.tuple([
        z.object({
          candidate: z.literal('GEMINI_3_6_FLASH'),
          canonicalCatalogId: z.literal(
            'google/gemini-3.6-flash-20260721',
          ),
          costReconciliation: z.object({
            authority: z.literal(
              'docs/V4_003E_Q1_GEMINI_3_6_COST_RECONCILIATION.md',
            ),
            retryFromUtcDate: z.literal('2026-08-23'),
            status: z.literal('RECONCILIATION_REQUIRED'),
            writeOffAutomatic: z.literal(false),
          }),
          financeApproval: z.object({
            approvedCapTreasuryReserveDisplayUsd: z.literal(0.652),
            approvedCapTreasuryReserveUsd: z.literal(0.65199),
            authorizationEffect: z.literal(
              'HISTORICAL_APPROVAL_CONSUMED_NO_REPLAY',
            ),
            calculatedMaximumProviderCostUsd: z.literal(0.483366),
            historicalDraftReused: z.literal(false),
            loadedFxBasisProviderCostUsd: z.literal(0.483366),
            loadedFxEnvelopeUsdExact: z.literal(0.63029959668),
            loadedFxEnvelopeUsdRounded: z.literal(0.63),
            loadedFxMultiplier: z.literal(1.30398),
            maximumCostPerAttemptUsd: z.literal(0.1208415),
            maximumProviderAttempts: z.literal(4),
            approvedProviderCapUsd: z.literal(0.5),
            status: z.literal(
              'APPROVAL_AND_NETWORK_AUTHORIZATION_CONSUMED_GATE_CLOSED_RECONCILIATION_REQUIRED',
            ),
          }),
          financeArbitrationGranted: z.literal(true),
          identityFingerprint: z.literal(
            'ef88a8e3b1bfd57ddc4afe787d8a920ea4b329e3d83b28b3fc4029487e88e9ed',
          ),
          financeEnvelope: z.literal(
            'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-finance-envelope.approved.v1.json',
          ),
          manifestPath: z.literal(
            'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-freeze.v1.json',
          ),
          preflightArtifact: z.literal(
            'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-runner-preflight.v1.json',
          ),
          modelId: z.literal('google/gemini-3.6-flash'),
          networkCallsAllowed: z.literal(false),
          ownerAuthorizationConsumed: z.literal(true),
          ownerAuthorizationGranted: z.literal(true),
          ownerIdentityApprovalGranted: z.literal(true),
          proposedRequestedRoute: z.literal('google-vertex/global'),
          rank: z.literal(1),
          requestCapabilities: z.object({
            reasoning: z.literal('MANDATORY'),
            reasoningEffort: z.literal('MINIMAL'),
            temperature: z.literal('OMIT_UNSUPPORTED'),
          }),
          runnerStatus: z.literal(
            'NETWORK_GATE_STOPPED_AFTER_1_OF_4_NO_RETRY_OR_FALLBACK',
          ),
          routeAttestationStatus: z.literal(
            'READ_ONLY_REATTESTED_2026_08_21_NO_NETWORK_AUTHORIZATION',
          ),
          transportPreflightArtifact: z.literal(
            'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-network-transport-preflight.v1.json',
          ),
          transportPreflightFingerprint: z.literal(
            '317966c06fed11a96a004932e60a8540a3bafb01cc7eceb629c878dada71a079',
          ),
          networkAuthorization: z.string().min(1),
          networkAuthorizationFingerprint: z.literal(
            'a1450be22b255ad7c20d43a76aafc8ea05fa4f5b4af8183b25a1887245b7c906',
          ),
          networkGateResult: z.object({
            actualCostUsd: z.null(),
            financialState: z.literal('RECONCILIATION_REQUIRED'),
            modelCallsPerformed: z.literal(1),
            status: z.literal('NO-GO_TECHNICAL_PROVIDER_HTTP_400'),
            unresolvedReservedCostUsd: z.literal(0.1208415),
            unusedAuthorizedCallsNotSent: z.literal(3),
            usableWorkflows: z.literal(0),
            verificationFingerprint: z.literal(
              '1192bb02f40d4c5ac159be91738b7696e3c615049f7e428b6618a07d6e2b00b4',
            ),
          }),
        }),
        z.object({
          candidate: z.literal('GEMINI_3_7_FLASH_TECHNICAL_OPTION'),
          canonicalCatalogId: z.literal(
            'google/gemini-3.7-flash-20260813',
          ),
          financeEnvelope: z.null(),
          financeStatus: z.literal(
            'RECALCULATION_REQUIRED_NO_VALUES_TRANSFERRED_FROM_GEMINI_3_6',
          ),
          identityFingerprint: z.null(),
          manifestPath: z.null(),
          modelId: z.literal('google/gemini-3.7-flash'),
          networkCallsAllowed: z.literal(false),
          ownerAuthorizationGranted: z.literal(false),
          proposedRequestProfile: z.object({
            maximumTotalOutputTokens: z.literal(8192),
            reasoning: z.literal('MANDATORY'),
            reasoningEffort: z.literal('LOW'),
            temperature: z.literal('OMIT_UNSUPPORTED'),
            timeoutMs: z.literal(60000),
            visibleOutputTokenTarget: z.literal(4096),
          }),
          proposedRequestedRoute: z.literal('google-vertex/global'),
          rank: z.literal(2),
          routeAttestationStatus: z.literal(
            'READ_ONLY_OBSERVATION_REATTESTATION_REQUIRED',
          ),
        }),
        z.object({
          candidate: z.literal('MISTRAL_MEDIUM_3_5_ALTERNATIVE'),
          financeEnvelope: z.null(),
          identityFingerprint: z.null(),
          manifestPath: z.null(),
          modelId: z.literal('mistralai/mistral-medium-3-5'),
          networkCallsAllowed: z.literal(false),
          ownerAuthorizationGranted: z.literal(false),
          queueOrder: z.literal('AFTER_GEMINI_3_7'),
          rank: z.literal(3),
        }),
      ]),
      guards: z.object({
        closedSonnetBudgetReuseAllowed: z.literal(false),
        closedSonnetIdentityReuseAllowed: z.literal(false),
        crossCandidateResultReuseAllowed: z.literal(false),
        holdoutAuthorized: z.literal(false),
        liveActivationAllowed: z.literal(false),
        modelCallsAllowed: z.literal(false),
        panelAuthorized: z.literal(false),
      }),
      status: z.literal(
        'GEMINI_3_6_Q1_R1_ACTIVE_OFFLINE_REMEDIATION_NEW_IDENTITY_REQUIRED',
      ),
    }),
    offlineWork: z.object({
      'V4-002': z.object({
        status: z.literal('COMPLETED_OFFLINE_PUBLICATION_BLOCKED'),
      }),
      'V4-003': z.object({
        status: z.literal(
          'V4_003E_Q1_R1_ACTIVE_OFFLINE_REMEDIATION_NEW_IDENTITY_REQUIRED',
        ),
      }),
      'V4-009C': z.object({
        nextExecutionTicket: z.literal('V4-003E-Q1-R1'),
        status: z.literal('Q1_NO_GO_TECHNICAL_R1_OFFLINE_REMEDIATION'),
      }),
      'V4-010': z.object({
        status: z.literal('ACTIVE_OFFLINE_LIVE_BLOCKED'),
      }),
    }),
    openBlockers: z.array(
      z
        .object({
          key: z.string(),
          successorOfflineEvidence: z
            .object({
              correctiveIndependentAuditReport: z.literal(
                'docs/V4_003B_R1_INDEPENDENT_AUDIT_REPORT.md',
              ),
              correctiveIndependentAuditVerdict: z.literal('READY_TO_FREEZE'),
              correctiveMechanicalOracle: z.literal(
                'benchmarks/ai-correction/executable-rubric/writing-framework-selection-fr.mechanical-oracle.v2.1.json',
              ),
              correctiveMechanicalOracleReport: z.literal(
                'docs/V4_003A_R1_ORACLE_HARDENING_REPORT.md',
              ),
              frozenExperimentDossier: z.object({
                identityFingerprint: z.literal(
                  'cc3b1b52bc0f94198faab362905617a3143169e952a53c38eb37f1571eda5d31',
                ),
                path: z.literal(
                  'benchmarks/ai-correction/executable-rubric/writing-framework-selection-sonnet-5-freeze.v1.json',
                ),
                report: z.literal(
                  'docs/V4_003C_EXPERIMENT_IDENTITY_FREEZE_REPORT.md',
                ),
                status: z.literal('FROZEN_OFFLINE_OWNER_APPROVED'),
              }),
              financeEnvelope: z.object({
                fingerprint: z.literal(
                  '256431012e251498ae021c2bf14f6e11f8373e8baf4117a0bcc7f8436a88e765',
                ),
                maximumCostPerAttemptUsd: z.literal(0.177082),
                maximumProviderAttempts: z.literal(4),
                maximumProviderCostUsd: z.literal(0.708328),
                path: z.literal(
                  'benchmarks/ai-correction/executable-rubric/writing-framework-selection-sonnet-5-finance-envelope.v1.json',
                ),
                report: z.literal('docs/V4_003D_GATE4_FINANCE_ARBITRATION.md'),
                status: z.literal(
                  'FINANCE_ARBITRATED_OWNER_AUTHORIZATION_CONSUMED_CAMPAIGN_CLOSED_NON_TRANSFERABLE',
                ),
              }),
              runnerPreflight: z.object({
                fingerprint: z.literal(
                  'ca81bfec01494d31356d6a3efde9bb7581c1a1ff601013f1c8c6df63ee582f16',
                ),
                maximumAllowedMessageUtf8Bytes: z.literal(65536),
                maximumObservedMessageUtf8Bytes: z.literal(12321),
                modelCallsPerformed: z.literal(0),
                networkCallsAllowed: z.literal(false),
                path: z.literal(
                  'benchmarks/ai-correction/executable-rubric/writing-framework-selection-sonnet-5-runner-preflight.v1.json',
                ),
                replayProviderExecutions: z.literal(0),
                report: z.literal(
                  'docs/V4_009C_S2_OFFLINE_RUNNER_PREFLIGHT.md',
                ),
                status: z.literal('HARD_OFF_PREFLIGHT_GREEN'),
                usableWorkflows: z.literal(4),
              }),
              networkGateResult: z.object({
                actualCostUsd: z.literal(0.018828),
                completedUsableWorkflows: z.literal(0),
                costSource: z.literal('ACTUAL'),
                fallbackCount: z.literal(0),
                ledgerFinalRecordHash: z.string().regex(/^[a-f0-9]{64}$/u),
                ledgerSha256: z.string().regex(/^[a-f0-9]{64}$/u),
                maximumAuthorizedCalls: z.literal(4),
                modelCallsPerformed: z.literal(1),
                observedProvider: z.literal('Anthropic'),
                replayAllowed: z.literal(false),
                report: z.literal('docs/V4_009C_S2_NETWORK_GATE_REPORT.md'),
                resultDirectory: z.literal(
                  'benchmarks/ai-correction/results/writing-framework-selection-sonnet5-v2/2026-08-21T20-24-00-Europe-Paris',
                ),
                requestedRoute: z.literal('Anthropic'),
                retryCount: z.literal(0),
                status: z.literal('NO-GO_SEMANTIC_DISAGREEMENT'),
                stoppedReason: z.literal('SEMANTIC_DISAGREEMENT'),
                summarySha256: z.string().regex(/^[a-f0-9]{64}$/u),
                unusedCallsNotSent: z.literal(3),
              }),
              status: z.literal(
                'GATE4_NETWORK_NO_GO_SEMANTIC_DISAGREEMENT',
              ),
            })
            .optional(),
          nextProtocol: z
            .object({
              campaignFreezeSet: z.object({
                manifest: z.literal(EVIDENCE_ASSIST_FREEZE_SET_MANIFEST_PATH),
                manifestSha256: z.string().regex(/^[a-f0-9]{64}$/u),
                networkCallsAllowed: z.literal(false),
              }),
              executionStatus: z.literal('TWO_CALLS_STOPPED_NO_REPLAY'),
              gatePlan: z.object({
                stageOne: z.object({
                  manifest: z.literal(EVIDENCE_ASSIST_FOUR_CASE_MANIFEST_PATH),
                  manifestSha256: z.string().regex(/^[a-f0-9]{64}$/u),
                  result: z.object({
                    atomicRelationAgreementRate: z.literal(0.8888888888888888),
                    campaignClosed: z.literal(true),
                    completedUsableWorkflows: z.literal(1),
                    dispatchAndCostReconciliationRate: z.literal(1),
                    falseSupportCount: z.literal(0),
                    modelCallsPerformed: z.literal(2),
                    replayAllowed: z.literal(false),
                    status: z.literal('NO_GO'),
                    stoppedReason: z.literal('SEMANTIC_DISAGREEMENT'),
                    totalActualCostUsd: z.literal(0.025622),
                  }),
                }),
                stageTwo: z.object({
                  manifest: z.literal(EVIDENCE_ASSIST_PANEL_MANIFEST_PATH),
                  manifestSha256: z.string().regex(/^[a-f0-9]{64}$/u),
                }),
              }),
              identityAssignmentStatus: z.literal(
                'ASSIGNED_AND_FROZEN_OFFLINE',
              ),
              pinnedIdentifiers: z.object({
                offlineProtocolFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
              }),
              preflight: z.object({
                networkCallsAllowed: z.literal(false),
              }),
              reasoning: z.object({
                attestationPath: z.literal(SONNET_5_REASONING_ATTESTATION_PATH),
                attestationSha256: z.literal(
                  SONNET_5_REASONING_ATTESTATION_SHA256,
                ),
              }),
              status: z.literal('FOUR_CASE_GATE_NO_GO_CLOSED'),
            })
            .optional(),
        })
        .passthrough(),
    ),
    promotionGate: z.object({
      authorityMode: z.literal('AUTONOMOUS_NO_HUMAN_REVIEW'),
      humanReviewRequired: z.literal(false),
      name: z.literal('GO_AUTONOMOUS_FORMATIVE'),
      policy: z.object({
        path: z.literal(
          'benchmarks/ai-correction/executable-rubric/evidence-assist-promotion-policy.v1.json',
        ),
        sha256: z.string().regex(/^[a-f0-9]{64}$/u),
      }),
      status: z.literal('NOT_MET'),
      transitions: z.tuple([
        z.object({
          decision: z.literal('GO_TO_SEALED_HOLDOUT'),
          pipelinePromotedAfter: z.literal(false),
        }),
        z.object({
          decision: z.literal('GO_AUTONOMOUS_FORMATIVE'),
          pipelinePromotedAfter: z.literal(true),
        }),
      ]),
    }),
    schemaVersion: z.literal('3.0.0'),
    status: z.literal('RESEARCH_NO_PIPELINE_PROMOTED'),
    targetArchitecture: z.object({
      modelAuthority: z.literal('CANDIDATE_RELATIONS_ONLY'),
      protocolAuthority: z.literal('docs/V4_EVIDENCE_ASSIST_PROTOCOL_SPEC.md'),
      semanticProtocolStatus: z.literal(
        'EVIDENCE_ASSIST_3_0_CANONICAL_COMPOSITE_AND_SECOND_PASS_SUPERSEDED',
      ),
      semanticLevelAndScoreAuthority: z.literal('NONE'),
      successorSemanticArbitration: z.object({
        authority: z.literal('docs/V4_EVIDENCE_SEMANTIC_ARBITRATION.md'),
        explicitRefutationStatus: z.literal('EXPLICITLY_REFUTED'),
        historicalCampaignMutationAllowed: z.literal(false),
        modelCallsAllowed: z.literal(false),
        mvpLevelEffect: z.literal(
          'SAME_AS_NOT_DEMONSTRATED_FOR_POSITIVE_REQUIRED_ELEMENTS',
        ),
        status: z.literal(
          'V4-009C-S2_NO_GO_SEMANTIC_DISAGREEMENT',
        ),
      }),
    }),
  })
  .passthrough();

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

const v4003eVerdictSchema = z.object({
  appendOnly: z.literal(true),
  arbitrationReport: z.string().min(1),
  finding: z.object({
    elementKey: z.literal('project-b-dimension-scope'),
    expectedAtomicStatus: z.literal('SUPPORTED'),
    expectedCandidateRelation: z.literal('EVIDENCE_FOR_ELEMENT'),
    observedCandidateRelation: z.literal('EVIDENCE_AGAINST_ELEMENT'),
    oracleAmbiguityDemonstrated: z.literal(false),
  }),
  identityFingerprint: z.literal(
    'cc3b1b52bc0f94198faab362905617a3143169e952a53c38eb37f1571eda5d31',
  ),
  preservation: z.object({
    campaignClosed: z.literal(true),
    closedIdentityOrBudgetReuseAllowed: z.literal(false),
    holdoutAuthorized: z.literal(false),
    liveActivationAllowed: z.literal(false),
    panelAuthorized: z.literal(false),
    postResultRetuningAllowed: z.literal(false),
    replayAllowed: z.literal(false),
  }),
  scope: z.literal('EXACT_FROZEN_IDENTITY_ONLY'),
  statisticalScope: z.object({
    completedUsableWorkflows: z.literal(0),
    gateDecisionValidUnderStopPolicy: z.literal(true),
    modelCallsPerformed: z.literal(1),
    statisticalGeneralizationAllowed: z.literal(false),
    unusedCallsNotSent: z.literal(3),
  }),
  verdict: z.literal('NO-GO_SEMANTIC_DISAGREEMENT'),
});

describe('active autonomous correction phase manifest', () => {
  const active = activeManifestSchema.parse(
    JSON.parse(read('docs/V4_AI_CORRECTION_PHASE_MANIFEST_V3.json')) as unknown,
  );
  const historical = historicalManifestSchema.parse(
    JSON.parse(read('docs/V4_AI_CORRECTION_PHASE_MANIFEST.json')) as unknown,
  );

  it('preserves every historical immutable verdict byte-for-meaning', () => {
    expect(active.immutableVerdicts).toEqual(historical.immutableVerdicts);
  });

  it('publishes the exact one-call Sonnet verdict without statistical overclaim', () => {
    const verdict = v4003eVerdictSchema.parse(
      active.currentCampaignVerdicts.find((entry) => {
        const identity = z
          .object({ identityFingerprint: z.string() })
          .safeParse(entry);
        return (
          identity.success &&
          identity.data.identityFingerprint ===
            'cc3b1b52bc0f94198faab362905617a3143169e952a53c38eb37f1571eda5d31'
        );
      }),
    );

    expect(verdict).toMatchObject({
      appendOnly: true,
      identityFingerprint:
        'cc3b1b52bc0f94198faab362905617a3143169e952a53c38eb37f1571eda5d31',
      scope: 'EXACT_FROZEN_IDENTITY_ONLY',
      verdict: 'NO-GO_SEMANTIC_DISAGREEMENT',
    });
    expect(verdict.finding).toMatchObject({
      elementKey: 'project-b-dimension-scope',
      expectedAtomicStatus: 'SUPPORTED',
      expectedCandidateRelation: 'EVIDENCE_FOR_ELEMENT',
      observedCandidateRelation: 'EVIDENCE_AGAINST_ELEMENT',
      oracleAmbiguityDemonstrated: false,
    });
    expect(verdict.statisticalScope).toMatchObject({
      completedUsableWorkflows: 0,
      gateDecisionValidUnderStopPolicy: true,
      modelCallsPerformed: 1,
      statisticalGeneralizationAllowed: false,
      unusedCallsNotSent: 3,
    });
    expect(verdict.preservation).toMatchObject({
      campaignClosed: true,
      closedIdentityOrBudgetReuseAllowed: false,
      holdoutAuthorized: false,
      liveActivationAllowed: false,
      panelAuthorized: false,
      postResultRetuningAllowed: false,
      replayAllowed: false,
    });
    expect(existsSync(resolve(process.cwd(), verdict.arbitrationReport))).toBe(
      true,
    );
  });

  it('records the closed Gemini 3.6 technical gate and unresolved cost', () => {
    const queue = active.offlineCandidateQueue;
    const [gemini36, gemini37, mistral] = queue.candidates;

    expect(queue.currentTicket).toBe('V4-003E-Q1-R1');
    expect(queue.closedGateTicket).toBe('V4-003E-Q1');
    expect(queue.remediation).toMatchObject({
      costReconciliationAuthority: {
        conservativeWriteOffRequiresSeparateFinanceAuthorization: true,
        retryFromUtcDate: '2026-08-23',
        sameDayActivityLookup: 'UNAVAILABLE_CURRENT_UTC_DAY',
        status: 'RECONCILIATION_REQUIRED',
      },
      financeArbitrationRequired: true,
      informativePublicReattestation: {
        financeArbitrationEffect: 'NONE',
        modelCallsPerformed: 0,
        networkAuthorizationEffect: 'NONE',
        newIdentityEffect: 'NONE',
        observedInformativePricingUsdPerMillionTokens: {
          input: 0.75,
          outputAndReasoning: 3.75,
        },
        pricingAuthorityEffect: 'NONE_REQUIRES_FRESH_FINANCE_ARBITRATION',
        status: 'REATTESTED_OFFLINE_NETWORK_GO_NOT_GRANTED',
      },
      localFakePreflightRequired: true,
      mode: 'OFFLINE_ONLY',
      modelCallsAllowed: false,
      transportRemediation: {
        candidateCause: 'PATTERN_KEYWORD_HYPOTHESIS_NOT_PROVEN',
        conservativeWriteOffNeverAutomatic: true,
        generationAndProviderRequestIdsSeparated: true,
        localSpanIdPatternValidationRetained: true,
        metadataHeaderEnabled: true,
        networkOrModelCallsPerformed: 0,
        recursiveGeminiKeywordPreflight: true,
        requestManifestBeforeCallIntent: true,
        status: 'IMPLEMENTED_AND_TESTED_OFFLINE_NEW_IDENTITY_NOT_FROZEN',
        wireDialect: 'evidence-assist-wire/3.0.1',
        wirePatternOmitted: true,
      },
      newIdentityFingerprint: null,
      newIdentityRequired: true,
      newOwnerSingleUseAuthorizationRequired: true,
    });
    expect(
      sha256(read(queue.remediation.costReconciliationAuthority.path)),
    ).toBe(queue.remediation.costReconciliationAuthority.sha256);
    expect(
      sha256(read(queue.remediation.informativePublicReattestation.path)),
    ).toBe(queue.remediation.informativePublicReattestation.sha256);
    expect(gemini36).toMatchObject({
      canonicalCatalogId: 'google/gemini-3.6-flash-20260721',
      costReconciliation: {
        retryFromUtcDate: '2026-08-23',
        status: 'RECONCILIATION_REQUIRED',
        writeOffAutomatic: false,
      },
      identityFingerprint:
        'ef88a8e3b1bfd57ddc4afe787d8a920ea4b329e3d83b28b3fc4029487e88e9ed',
      financeEnvelope:
        'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-finance-envelope.approved.v1.json',
      manifestPath:
        'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-freeze.v1.json',
      modelId: 'google/gemini-3.6-flash',
      networkCallsAllowed: false,
      ownerAuthorizationGranted: true,
      ownerAuthorizationConsumed: true,
      ownerIdentityApprovalGranted: true,
      financeArbitrationGranted: true,
      proposedRequestedRoute: 'google-vertex/global',
      rank: 1,
      runnerStatus:
        'NETWORK_GATE_STOPPED_AFTER_1_OF_4_NO_RETRY_OR_FALLBACK',
      routeAttestationStatus:
        'READ_ONLY_REATTESTED_2026_08_21_NO_NETWORK_AUTHORIZATION',
    });
    expect(gemini36.requestCapabilities).toMatchObject({
      reasoning: 'MANDATORY',
      reasoningEffort: 'MINIMAL',
      temperature: 'OMIT_UNSUPPORTED',
    });
    expect(gemini36.networkGateResult).toMatchObject({
      actualCostUsd: null,
      financialState: 'RECONCILIATION_REQUIRED',
      modelCallsPerformed: 1,
      status: 'NO-GO_TECHNICAL_PROVIDER_HTTP_400',
      unresolvedReservedCostUsd: 0.1208415,
      unusedAuthorizedCallsNotSent: 3,
      usableWorkflows: 0,
    });
    expect(
      gemini36.financeApproval.maximumCostPerAttemptUsd *
        gemini36.financeApproval.maximumProviderAttempts,
    ).toBeCloseTo(
      gemini36.financeApproval.calculatedMaximumProviderCostUsd,
      12,
    );
    expect(gemini36.financeApproval).toMatchObject({
      approvedCapTreasuryReserveDisplayUsd: 0.652,
      approvedProviderCapUsd: 0.5,
      authorizationEffect: 'HISTORICAL_APPROVAL_CONSUMED_NO_REPLAY',
      loadedFxBasisProviderCostUsd: 0.483366,
      status:
        'APPROVAL_AND_NETWORK_AUTHORIZATION_CONSUMED_GATE_CLOSED_RECONCILIATION_REQUIRED',
    });
    expect(
      gemini36.financeApproval.loadedFxBasisProviderCostUsd *
        gemini36.financeApproval.loadedFxMultiplier,
    ).toBeCloseTo(gemini36.financeApproval.loadedFxEnvelopeUsdExact, 12);
    expect(
      Number(gemini36.financeApproval.loadedFxEnvelopeUsdExact.toFixed(2)),
    ).toBe(gemini36.financeApproval.loadedFxEnvelopeUsdRounded);
    expect(gemini37).toMatchObject({
      canonicalCatalogId: 'google/gemini-3.7-flash-20260813',
      financeEnvelope: null,
      identityFingerprint: null,
      manifestPath: null,
      modelId: 'google/gemini-3.7-flash',
      networkCallsAllowed: false,
      ownerAuthorizationGranted: false,
      proposedRequestedRoute: 'google-vertex/global',
      rank: 2,
      routeAttestationStatus:
        'READ_ONLY_OBSERVATION_REATTESTATION_REQUIRED',
    });
    expect(gemini37.proposedRequestProfile).toEqual({
      maximumTotalOutputTokens: 8192,
      reasoning: 'MANDATORY',
      reasoningEffort: 'LOW',
      temperature: 'OMIT_UNSUPPORTED',
      timeoutMs: 60000,
      visibleOutputTokenTarget: 4096,
    });
    expect(mistral).toMatchObject({
      financeEnvelope: null,
      identityFingerprint: null,
      manifestPath: null,
      modelId: 'mistralai/mistral-medium-3-5',
      networkCallsAllowed: false,
      ownerAuthorizationGranted: false,
      queueOrder: 'AFTER_GEMINI_3_7',
      rank: 3,
    });
    expect(queue.guards).toEqual({
      closedSonnetBudgetReuseAllowed: false,
      closedSonnetIdentityReuseAllowed: false,
      crossCandidateResultReuseAllowed: false,
      holdoutAuthorized: false,
      liveActivationAllowed: false,
      modelCallsAllowed: false,
      panelAuthorized: false,
    });
  });

  it('binds the active protocol, campaigns, holdout and capability attestation by SHA-256', () => {
    const promotionBlocker = active.openBlockers.find(
      ({ key }) => key === 'EXECUTABLE_RUBRIC_PROMOTION_GATE',
    );
    expect(
      promotionBlocker?.nextProtocol?.pinnedIdentifiers
        .offlineProtocolFingerprint,
    ).toBe(evidenceAssistProtocolFingerprint());
    expect(sha256(read(active.holdout.replacementManifest))).toBe(
      active.holdout.replacementManifestSha256,
    );
    expect(sha256(read(active.holdout.autonomousManifest))).toBe(
      active.holdout.autonomousManifestSha256,
    );
    expect(sha256(read(active.holdout.encryptedArtifact.path))).toBe(
      active.holdout.encryptedArtifact.sha256,
    );
    expect(sha256(read(active.holdout.qualificationRecord.path))).toBe(
      active.holdout.qualificationRecord.sha256,
    );
    expect(sha256(read(SONNET_5_REASONING_ATTESTATION_PATH))).toBe(
      SONNET_5_REASONING_ATTESTATION_SHA256,
    );
    const nextProtocol = promotionBlocker?.nextProtocol;
    const successor = promotionBlocker?.successorOfflineEvidence;
    const networkGate = successor?.networkGateResult;
    expect(sha256(read(EVIDENCE_ASSIST_FREEZE_SET_MANIFEST_PATH))).toBe(
      nextProtocol?.campaignFreezeSet.manifestSha256,
    );
    expect(sha256(read(EVIDENCE_ASSIST_FOUR_CASE_MANIFEST_PATH))).toBe(
      nextProtocol?.gatePlan.stageOne.manifestSha256,
    );
    expect(sha256(read(EVIDENCE_ASSIST_PANEL_MANIFEST_PATH))).toBe(
      nextProtocol?.gatePlan.stageTwo.manifestSha256,
    );
    expect(sha256(read(active.promotionGate.policy.path))).toBe(
      active.promotionGate.policy.sha256,
    );
    const frozenCore = active.offlineCandidateQueue.commonFrozenCore;
    const sourceFreeze = z
      .object({
        corpus: z.object({
          conditionalPanel10x2: z.object({
            caseIds: z.array(z.string()),
            freshLogicalWorkflows: z.number().int(),
            repetitionsPerCase: z.number().int(),
          }),
          gateFour: z.array(z.object({ caseId: z.string() })),
        }),
        corpusFingerprint: z.string(),
        runnerContractFingerprint: z.string(),
        semanticMappingFingerprint: z.string(),
        stopPolicyFingerprint: z.string(),
        telemetryContractFingerprint: z.string(),
      })
      .parse(JSON.parse(read(frozenCore.sourceFreezeDossier)) as unknown);
    expect(sha256(read(frozenCore.sourceFreezeDossier))).toBe(
      frozenCore.sourceFreezeDossierSha256,
    );
    expect(sha256(read(frozenCore.protocol.path))).toBe(
      frozenCore.protocol.sha256,
    );
    expect(sha256(read(frozenCore.rubric.path))).toBe(frozenCore.rubric.sha256);
    expect(sha256(read(frozenCore.oracle.path))).toBe(frozenCore.oracle.sha256);
    expect(frozenCore.corpusFingerprint).toBe(sourceFreeze.corpusFingerprint);
    expect(frozenCore.semanticMappingFingerprint).toBe(
      sourceFreeze.semanticMappingFingerprint,
    );
    expect(frozenCore.sourceRunnerBehavioralContractFingerprint).toBe(
      sourceFreeze.runnerContractFingerprint,
    );
    expect(frozenCore.telemetryContractFingerprint).toBe(
      sourceFreeze.telemetryContractFingerprint,
    );
    expect(frozenCore.stopPolicyFingerprint).toBe(
      sourceFreeze.stopPolicyFingerprint,
    );
    expect(frozenCore.gateFourCaseOrder).toEqual(
      sourceFreeze.corpus.gateFour.map(({ caseId }) => caseId),
    );
    expect(frozenCore.conditionalPanelCaseOrder).toEqual(
      sourceFreeze.corpus.conditionalPanel10x2.caseIds,
    );
    expect(frozenCore.conditionalPanelRepetitionsPerCase).toBe(
      sourceFreeze.corpus.conditionalPanel10x2.repetitionsPerCase,
    );
    expect(frozenCore.conditionalPanelFreshLogicalWorkflows).toBe(
      sourceFreeze.corpus.conditionalPanel10x2.freshLogicalWorkflows,
    );
    expect(
      existsSync(
        resolve(process.cwd(), successor?.correctiveMechanicalOracle ?? ''),
      ),
    ).toBe(true);
    expect(
      sha256(read(`${networkGate?.resultDirectory ?? ''}/summary.json`)),
    ).toBe(networkGate?.summarySha256);
    expect(
      sha256(read(`${networkGate?.resultDirectory ?? ''}/ledger.jsonl`)),
    ).toBe(networkGate?.ledgerSha256);
    expect(existsSync(resolve(process.cwd(), networkGate?.report ?? ''))).toBe(
      true,
    );
    expect(
      existsSync(
        resolve(
          process.cwd(),
          successor?.correctiveMechanicalOracleReport ?? '',
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        resolve(
          process.cwd(),
          successor?.correctiveIndependentAuditReport ?? '',
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        resolve(process.cwd(), successor?.frozenExperimentDossier.path ?? ''),
      ),
    ).toBe(true);
    expect(
      existsSync(
        resolve(process.cwd(), successor?.frozenExperimentDossier.report ?? ''),
      ),
    ).toBe(true);
    expect(
      existsSync(resolve(process.cwd(), successor?.financeEnvelope.path ?? '')),
    ).toBe(true);
    expect(
      existsSync(
        resolve(process.cwd(), successor?.financeEnvelope.report ?? ''),
      ),
    ).toBe(true);
    expect(
      existsSync(resolve(process.cwd(), successor?.runnerPreflight.path ?? '')),
    ).toBe(true);
    expect(
      existsSync(
        resolve(process.cwd(), successor?.runnerPreflight.report ?? ''),
      ),
    ).toBe(true);
  });

  it('keeps live execution closed while allowing only explicit offline work', () => {
    expect(active.deliveryState.runtimeCanonical).toMatchObject({
      evidenceAssistProtocolIntegrated: true,
      offlineFakeFlowIntegrated: true,
      status: 'DELIVERED_INACTIVE',
    });
    expect(active.deliveryState.offlineCandidate.status).toBe(
      'INTEGRATED_IN_RUNTIME_HARD_OFF',
    );
    expect(active.promotionGate.status).toBe('NOT_MET');
    expect(active.eligibility.pipelinePromoted).toBe(false);
    expect(active.eligibility.publishedV4Contracts).toBe(0);
    expect(active.eligibility.activitiesEligibleForLiveCorrection).toBe(0);
    expect(active.activeExecutionQueue).toMatchObject({
      currentResponsibleAgent: 'AGENT-PROTOCOLE-IA',
      currentTicket: 'V4-003E-Q1-R1',
      liveActivationAllowed: false,
      modelCallsAllowed: false,
    });
    expect(active.deliveryState.experimental).toEqual({
      pipelinePromoted: false,
      status:
        'V4_003E_Q1_GEMINI_3_6_NO_GO_TECHNICAL_RECONCILIATION_REQUIRED',
    });
    expect(active.holdoutAdmissionGate.currentBlockers).toContain(
      'GEMINI_3_6_COST_RECONCILIATION_REQUIRED',
    );
    expect(active.offlineCandidateQueue.guards).toMatchObject({
      holdoutAuthorized: false,
      liveActivationAllowed: false,
      modelCallsAllowed: false,
      panelAuthorized: false,
    });
    expect(
      active.openBlockers.find(
        ({ key }) => key === 'EXECUTABLE_RUBRIC_PROMOTION_GATE',
      )?.nextProtocol?.preflight.networkCallsAllowed,
    ).toBe(false);
    expect(active.offlineWork['V4-002'].status).toContain(
      'PUBLICATION_BLOCKED',
    );
    expect(active.offlineWork['V4-010'].status).toContain('LIVE_BLOCKED');
    expect(
      existsSync(
        resolve(process.cwd(), active.targetArchitecture.protocolAuthority),
      ),
    ).toBe(true);
    expect(
      existsSync(
        resolve(
          process.cwd(),
          active.targetArchitecture.successorSemanticArbitration.authority,
        ),
      ),
    ).toBe(true);
    expect(
      active.targetArchitecture.successorSemanticArbitration.modelCallsAllowed,
    ).toBe(false);
  });
});
