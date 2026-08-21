import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8');
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

describe('V4-003D gate four finance envelope', () => {
  const path =
    'benchmarks/ai-correction/executable-rubric/writing-framework-selection-sonnet-5-finance-envelope.v1.json';
  const envelope = JSON.parse(read(path)) as Record<string, unknown>;

  it('binds the approved V4-003C dossier and current pricing snapshot', () => {
    const campaign = envelope.campaign as {
      dossierPath: string;
      dossierSha256: string;
      ownerDossierArbitration: string;
    };
    const pricing = envelope.pricingAuthority as {
      path: string;
      sha256: string;
    };
    expect(sha256(read(campaign.dossierPath))).toBe(campaign.dossierSha256);
    expect(campaign.ownerDossierArbitration).toBe(
      'GRANTED_RAYAN_C_2026_08_21',
    );
    expect(sha256(read(pricing.path))).toBe(pricing.sha256);
  });

  it('recomputes the pessimistic provider cap exactly', () => {
    const attempt = envelope.perAttemptBound as {
      inputTokenUpperBound: number;
      maximumCostUsd: number;
      maximumPromptUtf8Bytes: number;
      maximumVisibleOutputTokens: number;
      schemaUtf8Bytes: number;
      transportAllowanceTokens: number;
    };
    const pricing = envelope.pricingAuthority as {
      completionUsdPerToken: number;
      promptUsdPerToken: number;
    };
    const gate = envelope.gateBound as {
      maximumProviderAttempts: number;
      maximumProviderCostUsd: number;
    };
    expect(attempt.inputTokenUpperBound).toBe(
      attempt.maximumPromptUtf8Bytes +
        attempt.schemaUtf8Bytes +
        attempt.transportAllowanceTokens,
    );
    expect(attempt.maximumCostUsd).toBe(
      attempt.inputTokenUpperBound * pricing.promptUsdPerToken +
        attempt.maximumVisibleOutputTokens * pricing.completionUsdPerToken,
    );
    expect(gate.maximumProviderCostUsd).toBe(
      attempt.maximumCostUsd * gate.maximumProviderAttempts,
    );
  });

  it('binds the full envelope and keeps network, panel and holdout closed', () => {
    const { envelopeFingerprint, ...core } = envelope;
    expect(envelopeFingerprint).toBe(
      sha256(JSON.stringify(canonicalize(core))),
    );
    expect(envelope.authorizationBoundary).toEqual({
      financeArbitration: 'GRANTED_FOR_GATE4_ONLY',
      holdoutAccess: 'PROHIBITED',
      liveActivationAllowed: false,
      modelCallsAllowed: false,
      ownerNetworkAuthorization: 'NOT_GRANTED',
      panel10x2Included: false,
      runnerImplementationVerified: false,
    });
    expect(envelope.reconciliationPolicy).toMatchObject({
      missingActualCostMaySettleAsZero: false,
      missingActualCostState: 'RECONCILIATION_REQUIRED',
      resultPublicationBeforeReconciliationAllowed: false,
      settlementOrReleaseBeforeReconciliationAllowed: false,
    });
  });
});
