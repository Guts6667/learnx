import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { evidenceAssistProtocolFingerprint } from './evidence-assist-protocol.ts';
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
        replacementManifest: z.string().min(1),
        replacementManifestSha256: z.string().regex(/^[a-f0-9]{64}$/u),
        sealed: z.literal(false),
      })
      .passthrough(),
    immutableVerdicts: z.array(z.unknown()),
    offlineWork: z.object({
      'V4-002': z.object({
        status: z.literal('ACTIVE_OFFLINE_PUBLICATION_BLOCKED'),
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
              executionStatus: z.literal('NO_MODEL_CALL'),
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
              status: z.literal('CAPABILITY_ATTESTED_OFFLINE'),
            })
            .optional(),
        })
        .passthrough(),
    ),
    promotionGate: z.object({
      authorityMode: z.literal('AUTONOMOUS_NO_HUMAN_REVIEW'),
      humanReviewRequired: z.literal(false),
      name: z.literal('GO_AUTONOMOUS_FORMATIVE'),
      status: z.literal('NOT_MET'),
    }),
    schemaVersion: z.literal('3.0.0'),
    status: z.literal('RESEARCH_NO_PIPELINE_PROMOTED'),
    targetArchitecture: z.object({
      modelAuthority: z.literal('CANDIDATE_RELATIONS_ONLY'),
      protocolAuthority: z.literal('docs/V4_EVIDENCE_ASSIST_PROTOCOL_SPEC.md'),
      semanticLevelAndScoreAuthority: z.literal('NONE'),
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

  it('binds the active protocol, holdout and capability attestation by SHA-256', () => {
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
    expect(sha256(read(SONNET_5_REASONING_ATTESTATION_PATH))).toBe(
      SONNET_5_REASONING_ATTESTATION_SHA256,
    );
  });

  it('keeps live execution closed while allowing only explicit offline work', () => {
    expect(active.promotionGate.status).toBe('NOT_MET');
    expect(active.eligibility.pipelinePromoted).toBe(false);
    expect(active.eligibility.publishedV4Contracts).toBe(0);
    expect(active.eligibility.activitiesEligibleForLiveCorrection).toBe(0);
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
  });
});
