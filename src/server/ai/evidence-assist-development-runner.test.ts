import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createEvidenceAssistExecutionIdentity,
  EVIDENCE_ASSIST_EVALUATOR_PATH,
  EVIDENCE_ASSIST_FOUR_CASE_MANIFEST_PATH,
  EVIDENCE_ASSIST_GOLD_MAPPING_PATH,
  EVIDENCE_ASSIST_PANEL_MANIFEST_PATH,
  EVIDENCE_ASSIST_RUNNER_PATH,
  EVIDENCE_ASSIST_STOP_POLICY_PATH,
  type EvidenceAssistDevelopmentCampaignManifest,
} from '../../lib/evidence-assist-development-campaign.ts';
import { compileExecutableRubric } from '../../lib/executable-rubric-engine.ts';
import { validateExecutableRubricSemanticSelection } from '../../lib/executable-rubric-semantic-selection.ts';
import {
  createEvidenceAssistEphemeralAuthorization,
  runEvidenceAssistDevelopmentCampaign,
  verifyEvidenceAssistEphemeralAuthorization,
} from './evidence-assist-development-runner.ts';

const read = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');
const rubricText = read(
  'benchmarks/ai-correction/executable-rubric/writing-recommendation-fr.v1.json',
);
const selectionText = read(
  'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v2.manifest.json',
);
const sourceV1Text = read(
  'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v1.json',
);
const sourceV2Text = read(
  'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-three-case-development.v2.json',
);
const compiled = compileExecutableRubric(JSON.parse(rubricText) as unknown);
const corpus = validateExecutableRubricSemanticSelection({
  compiled,
  selection: JSON.parse(selectionText) as unknown,
  sources: [
    {
      path: 'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-development.v1.json',
      text: sourceV1Text,
    },
    {
      path: 'benchmarks/ai-correction/executable-rubric/writing-fr-semantic-three-case-development.v2.json',
      text: sourceV2Text,
    },
  ],
});
const fourCase = JSON.parse(
  read(EVIDENCE_ASSIST_FOUR_CASE_MANIFEST_PATH),
) as EvidenceAssistDevelopmentCampaignManifest;
const panel = JSON.parse(
  read(EVIDENCE_ASSIST_PANEL_MANIFEST_PATH),
) as EvidenceAssistDevelopmentCampaignManifest;
const executionIdentity = createEvidenceAssistExecutionIdentity({
  campaignIdentityFingerprint: fourCase.identity.fingerprint,
  evaluatorSourceText: read(EVIDENCE_ASSIST_EVALUATOR_PATH),
  goldMappingText: read(EVIDENCE_ASSIST_GOLD_MAPPING_PATH),
  runnerSourceText: read(EVIDENCE_ASSIST_RUNNER_PATH),
  semanticSelectionText: selectionText,
  semanticSourceV1Text: sourceV1Text,
  semanticSourceV2Text: sourceV2Text,
  stopPolicyText: read(EVIDENCE_ASSIST_STOP_POLICY_PATH),
});
const signingSecret = 'signing-secret-for-evidence-assist-tests-1234567890';
const nonce = 'ephemeral-nonce-for-evidence-assist-tests-1234567890';

function authorization(
  campaign: EvidenceAssistDevelopmentCampaignManifest,
  grantedAt = '2026-08-20T10:00:00Z',
) {
  return createEvidenceAssistEphemeralAuthorization({
    authorization: {
      authorizationId: `authorization-${campaign.stage.toLocaleLowerCase()}`,
      campaignId: campaign.campaignId,
      executionIdentityFingerprint:
        executionIdentity.executionIdentityFingerprint,
      expiresAt: new Date(Date.parse(grantedAt) + 10 * 60_000).toISOString(),
      financeArbitration: 'GRANTED',
      grantedAt,
      maximumCampaignCostUsd: campaign.budgetProposal.maximumCampaignCostUsd,
      maximumProviderAttempts: campaign.execution.maximumProviderAttempts,
      nonceSha256: createHash('sha256').update(nonce).digest('hex'),
      ownerAuthorization: 'GRANTED',
      purpose: 'EVIDENCE_ASSIST_DEVELOPMENT_ONLY',
      schemaVersion: 1,
      singleUse: true,
      stage: campaign.stage,
    },
    signingSecret,
  });
}

function verifiedAuthorization(
  campaign: EvidenceAssistDevelopmentCampaignManifest,
) {
  return verifyEvidenceAssistEphemeralAuthorization({
    authorization: authorization(campaign),
    campaign,
    executionIdentityFingerprint: executionIdentity.executionIdentityFingerprint,
    nonce,
    now: '2026-08-20T10:05:00Z',
    signingSecret,
  });
}

describe('evidence-assist development runner', () => {
  it('requires a valid, scoped and short-lived signed authorization', () => {
    const signed = authorization(fourCase);
    expect(
      verifyEvidenceAssistEphemeralAuthorization({
        authorization: signed,
        campaign: fourCase,
        executionIdentityFingerprint:
          executionIdentity.executionIdentityFingerprint,
        nonce,
        now: '2026-08-20T10:05:00Z',
        signingSecret,
      }).authorizationId,
    ).toBe(signed.authorizationId);
    expect(() =>
      verifyEvidenceAssistEphemeralAuthorization({
        authorization: signed,
        campaign: fourCase,
        executionIdentityFingerprint:
          executionIdentity.executionIdentityFingerprint,
        nonce,
        now: '2026-08-20T10:11:00Z',
        signingSecret,
      }),
    ).toThrow('EVIDENCE_ASSIST_AUTHORIZATION_EXPIRED_OR_NOT_YET_VALID');
    expect(() =>
      verifyEvidenceAssistEphemeralAuthorization({
        authorization: signed,
        campaign: fourCase,
        executionIdentityFingerprint: 'f'.repeat(64),
        nonce,
        now: '2026-08-20T10:05:00Z',
        signingSecret,
      }),
    ).toThrow('EVIDENCE_ASSIST_AUTHORIZATION_SCOPE_MISMATCH');
  });

  it('refuses a signed artifact that was not verified in the current process', async () => {
    await expect(
      runEvidenceAssistDevelopmentCampaign({
        authorization: authorization(fourCase),
        campaign: fourCase,
        compiled,
        corpus,
        executionIdentityFingerprint:
          executionIdentity.executionIdentityFingerprint,
        onAuthorizationConsumed: async () => undefined,
        onRawReceived: async () => undefined,
        provider: {
          async execute() {
            throw new Error('NETWORK_MUST_NOT_BE_REACHED');
          },
        },
      }),
    ).rejects.toThrow('EVIDENCE_ASSIST_AUTHORIZATION_NOT_VERIFIED');
  });

  it('persists CALL_INTENT and raw output before stopping the four-case gate on first semantic defect', async () => {
    const events: string[] = [];
    const result = await runEvidenceAssistDevelopmentCampaign({
      authorization: verifiedAuthorization(fourCase),
      campaign: fourCase,
      compiled,
      corpus,
      executionIdentityFingerprint:
        executionIdentity.executionIdentityFingerprint,
      onAuthorizationConsumed: async () => {
        events.push('authorization');
      },
      onProgress: async ({ ledger }) => {
        if (ledger.at(-1)?.event === 'CALL_INTENT') events.push('intent');
      },
      onRawReceived: async () => {
        events.push('raw');
      },
      provider: {
        async execute() {
          events.push('network');
          return {
            latencyMs: 1,
            modelSnapshot: fourCase.identity.catalogSnapshotId,
            observedProvider: 'Anthropic',
            output: { findings: [] },
            providerRequestId: 'provider-request-1',
            providerRoute: 'Anthropic',
            rawModelOutput: JSON.stringify({ findings: [] }),
            requestedRoute: 'Anthropic',
            usage: {
              actualCostUsd: 0.001,
              costSource: 'ACTUAL',
              inputTokens: 100,
              reasoningTokens: 0,
              visibleOutputTokens: 10,
            },
          };
        },
      },
    });

    expect(result.attempts).toHaveLength(1);
    expect(result.stoppedReason).toBe('SEMANTIC_DISAGREEMENT');
    expect(result.forceNoGo).toBe(true);
    expect(events.indexOf('intent')).toBeLessThan(events.indexOf('network'));
    expect(events.indexOf('network')).toBeLessThan(events.indexOf('raw'));
    expect(result.ledger.map(({ event }) => event)).toEqual([
      'CALL_INTENT',
      'CALL_OUTCOME',
    ]);
  });

  it('continues all 20 panel cells after non-dangerous semantic defects', async () => {
    let calls = 0;
    const result = await runEvidenceAssistDevelopmentCampaign({
      authorization: verifiedAuthorization(panel),
      campaign: panel,
      compiled,
      corpus,
      executionIdentityFingerprint:
        executionIdentity.executionIdentityFingerprint,
      onAuthorizationConsumed: async () => undefined,
      onRawReceived: async () => undefined,
      provider: {
        async execute() {
          calls += 1;
          return {
            latencyMs: 1,
            modelSnapshot: panel.identity.catalogSnapshotId,
            observedProvider: 'Anthropic',
            output: { findings: [] },
            providerRequestId: `provider-request-${calls}`,
            providerRoute: 'Anthropic',
            rawModelOutput: JSON.stringify({ findings: [] }),
            requestedRoute: 'Anthropic',
            usage: {
              actualCostUsd: 0.001,
              costSource: 'ACTUAL',
              inputTokens: 100,
              reasoningTokens: 0,
              visibleOutputTokens: 10,
            },
          };
        },
      },
    });

    expect(calls).toBe(20);
    expect(result.attempts).toHaveLength(20);
    expect(result.forceNoGo).toBe(true);
    expect(result.stoppedReason).toBeNull();
  });

  it('stops immediately for an orphaned dispatch with unknown cost and request id', async () => {
    const result = await runEvidenceAssistDevelopmentCampaign({
      authorization: verifiedAuthorization(panel),
      campaign: panel,
      compiled,
      corpus,
      executionIdentityFingerprint:
        executionIdentity.executionIdentityFingerprint,
      onAuthorizationConsumed: async () => undefined,
      onRawReceived: async () => undefined,
      provider: {
        async execute() {
          throw new Error('PROVIDER_TIMEOUT_AFTER_DISPATCH');
        },
      },
    });

    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]).toMatchObject({
      actualCostUsd: null,
      dispatchState: 'ORPHANED',
      financialState: 'RECONCILIATION_REQUIRED',
      providerRequestId: null,
    });
    expect(result.stoppedReason).toBe('FINANCE');
  });
});
