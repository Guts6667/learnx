import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { calculateQuotePrice } from './ai-pricing';

interface ArtifactReference {
  path: string;
  sha256: string;
}

interface PilotCalibration {
  activation: {
    catalogStatus: string;
    publicSaleAuthorized: boolean;
    runtimePromotionAuthorized: boolean;
  };
  ownerDecision: null | {
    creditsPerEuro: number;
    estimatedCredits: number;
    key: string;
    maximumInputChars: number;
    maximumReservedCredits: number;
    scope: string;
  };
  sample: {
    automaticSecondPassCalls: number;
    logicalRuns: number;
    primaryCalls: number;
  };
  sourceArtifacts: Record<string, ArtifactReference>;
  status: string;
  supplierCostUsdByLogicalRun: {
    median: number;
    p90: number;
    total: number;
  };
}

const artifactPath = resolve(
  process.cwd(),
  'benchmarks/ai-correction/pricing/writing-pilot-calibration-2026-08-24.json',
);
const activationMigrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260824192628_activate_bounded_writing_pilot_catalog/migration.sql',
);

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

describe('V4 Writing pilot pricing calibration', () => {
  const calibration = JSON.parse(
    readFileSync(artifactPath, 'utf8'),
  ) as PilotCalibration;

  it('records the immutable owner decision for the offered-credit pilot', () => {
    expect(calibration.status).toBe('OWNER_APPROVED_FOR_BOUNDED_PILOT');
    expect(calibration.ownerDecision).toEqual(
      expect.objectContaining({
        creditsPerEuro: 100,
        estimatedCredits: 3,
        key: 'BOUNDED_PRODUCT_PILOT',
        maximumInputChars: 1500,
        maximumReservedCredits: 6,
        scope: 'OFFERED_CREDITS_PILOT_ONLY',
      }),
    );
    expect(calibration.activation).toEqual(
      expect.objectContaining({
        catalogStatus: 'ACTIVE',
        publicSaleAuthorized: false,
        runtimePromotionAuthorized: true,
      }),
    );
  });

  it('calculates the approved three-credit estimate and six-credit ceiling', () => {
    expect(
      calculateQuotePrice({
        action: 'STANDARD',
        catalogVersionId: '40700000-0000-4000-8000-000000000001',
        feeCredits: 0n,
        floorCredits: 3n,
        id: '40700000-0000-4000-8000-000000000002',
        includesAutomaticSecondPass: true,
        includesTargetedVerification: false,
        inputSizeClass: 'SHORT',
        providerMedianCostCredits: 2n,
        providerMedianCostUsd: '0.01968000',
        providerP90CostCredits: 4n,
        providerP90CostUsd: '0.02303610',
        safetyCoefficientBasisPoints: 15_000n,
        targetMarginCredits: 0n,
      }),
    ).toEqual({
      ceilingCredits: 6n,
      estimatedCredits: 3n,
      floorCredits: 3n,
    });
  });

  it('materializes only the bounded standard offered-credit catalog', () => {
    const migration = readFileSync(activationMigrationPath, 'utf8');

    expect(migration).toContain(
      'DROP CONSTRAINT IF EXISTS "ai_pricing_catalog_version_format_check"',
    );
    expect(migration).toContain('"version" ~ \'^[0-9]+[.][0-9]+[.][0-9]+$\'');
    expect(migration).toContain("'4.0.0'");
    expect(migration).toContain("'standard'");
    expect(migration).toContain('  1500,');
    expect(migration).toContain('  100,');
    expect(migration).toContain('"offeredCreditsOnly": true');
    expect(migration).toContain('"publicSaleAuthorized": false');
    expect(migration).not.toContain("'detailed'");
    expect(migration).not.toContain("'reinforced'");
    expect(migration).not.toContain("'reconsideration'");
  });

  it('preserves the measured workflow and cost distribution', () => {
    expect(calibration.sample).toEqual(
      expect.objectContaining({
        automaticSecondPassCalls: 6,
        logicalRuns: 72,
        primaryCalls: 72,
      }),
    );
    expect(calibration.supplierCostUsdByLogicalRun).toEqual(
      expect.objectContaining({
        median: 0.01968,
        p90: 0.0230361,
        total: 1.551831,
      }),
    );
  });

  it('binds every source artifact by digest', () => {
    const artifactDirectory = resolve(artifactPath, '..');
    for (const source of Object.values(calibration.sourceArtifacts)) {
      expect(sha256(resolve(artifactDirectory, source.path))).toBe(
        source.sha256,
      );
    }
  });
});
