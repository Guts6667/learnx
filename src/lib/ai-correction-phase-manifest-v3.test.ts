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
      currentResponsibleAgent: z.literal('AGENT-DEV-LEARNX'),
      currentTicket: z.literal('V4-009C-S2'),
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
      ]),
    }),
    baselines: z.object({
      runtime: z.object({
        commit: z.string().regex(/^[a-f0-9]{40}$/u),
        ref: z.literal('origin/dev'),
      }),
    }),
    deliveryState: z.object({
      offlineCandidate: z.object({
        status: z.literal('INTEGRATED_IN_RUNTIME_HARD_OFF'),
      }),
      runtimeCanonical: z.object({
        evidenceAssistProtocolIntegrated: z.literal(true),
        offlineFakeFlowIntegrated: z.literal(true),
        status: z.literal('DELIVERED_INACTIVE'),
      }),
    }),
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
    immutableVerdicts: z.array(z.unknown()),
    offlineWork: z.object({
      'V4-002': z.object({
        status: z.literal('COMPLETED_OFFLINE_PUBLICATION_BLOCKED'),
      }),
      'V4-003': z.object({
        status: z.literal(
          'FINANCE_ARBITRATED_RUNNER_IMPLEMENTATION_READY_OFFLINE',
        ),
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
              correctiveIndependentAuditVerdict:
                z.literal('READY_TO_FREEZE'),
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
                report: z.literal(
                  'docs/V4_003D_GATE4_FINANCE_ARBITRATION.md',
                ),
                status: z.literal(
                  'FINANCE_ARBITRATED_OWNER_NETWORK_AUTHORIZATION_NOT_GRANTED',
                ),
              }),
              status: z.literal(
                'GATE4_FINANCE_ARBITRATED_RUNNER_IMPLEMENTATION_READY_OFFLINE',
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
          'V4-003D_FINANCE_ARBITRATED_AWAITING_RUNNER_AND_NETWORK_GO',
        ),
      }),
    }),
  })
  .passthrough();

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

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
    expect(
      existsSync(
        resolve(
          process.cwd(),
          successor?.correctiveMechanicalOracle ?? '',
        ),
      ),
    ).toBe(true);
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
      currentResponsibleAgent: 'AGENT-DEV-LEARNX',
      currentTicket: 'V4-009C-S2',
      liveActivationAllowed: false,
      modelCallsAllowed: false,
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
