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
      currentTicket: z.literal('V4-003C'),
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
        status: z.literal('INDEPENDENT_AUDIT_READY_TO_FREEZE'),
      }),
      'V4-010': z.object({
        status: z.literal('ACTIVE_OFFLINE_LIVE_BLOCKED'),
      }),
    }),
    openBlockers: z.array(
      z
        .object({
          key: z.string(),
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
              successorOfflineEvidence: z
                .object({
                  compilerMutationCaseCount: z.literal(7),
                  mechanicalCaseCount: z.literal(19),
                  mechanicalOracle: z.literal(
                    'benchmarks/ai-correction/executable-rubric/writing-framework-selection-fr.mechanical-oracle.v2.json',
                  ),
                  mechanicalOracleFingerprint: z.literal(
                    '7bbea4ae4d024eed8dc91f0847c8f2021b28fd35e40fe7933b02af4568cf1297',
                  ),
                  mechanicalOracleReport: z.literal(
                    'docs/V4_003A_MECHANICAL_ORACLE_REPORT.md',
                  ),
                  independentAuditReport: z.literal(
                    'docs/V4_003B_INDEPENDENT_AUDIT_REPORT.md',
                  ),
                  independentAuditVerdict: z.literal(
                    'BLOCKED_WITH_FINDINGS',
                  ),
                  correctiveDedicatedTestCount: z.literal(12),
                  correctiveMechanicalCaseCount: z.literal(33),
                  correctiveMechanicalOracle: z.literal(
                    'benchmarks/ai-correction/executable-rubric/writing-framework-selection-fr.mechanical-oracle.v2.1.json',
                  ),
                  correctiveMechanicalOracleFingerprint: z.literal(
                    '2c35125ea438cf1686ae88b01ecdb28bc304a3c9b9af6d45cff81f37306af3c2',
                  ),
                  correctiveMechanicalOracleReport: z.literal(
                    'docs/V4_003A_R1_ORACLE_HARDENING_REPORT.md',
                  ),
                  correctiveMechanicalOracleValidator: z.literal(
                    'src/lib/executable-rubric-mechanical-oracle-v2-1.ts',
                  ),
                  correctiveIndependentAuditReport: z.literal(
                    'docs/V4_003B_R1_INDEPENDENT_AUDIT_REPORT.md',
                  ),
                  correctiveIndependentAuditVerdict:
                    z.literal('READY_TO_FREEZE'),
                  status: z.literal(
                    'MECHANICAL_ORACLE_V2_1_READY_TO_FREEZE',
                  ),
                })
                .optional(),
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
        status: z.literal('V4-003B_R1_READY_TO_FREEZE_AWAITING_V4-003C'),
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
          nextProtocol?.successorOfflineEvidence?.correctiveMechanicalOracle ?? '',
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        resolve(
          process.cwd(),
          nextProtocol?.successorOfflineEvidence
            ?.correctiveMechanicalOracleReport ?? '',
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        resolve(
          process.cwd(),
          nextProtocol?.successorOfflineEvidence
            ?.correctiveIndependentAuditReport ?? '',
        ),
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
      currentTicket: 'V4-003C',
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
