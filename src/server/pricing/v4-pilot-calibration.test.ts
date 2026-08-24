import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

interface ArtifactReference {
  path: string;
  sha256: string;
}

interface PilotCalibration {
  activation: {
    catalogStatus: string;
    runtimePromotionAuthorized: boolean;
  };
  ownerDecision: null | string;
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

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

describe('V4 Writing pilot pricing calibration', () => {
  const calibration = JSON.parse(
    readFileSync(artifactPath, 'utf8'),
  ) as PilotCalibration;

  it('remains closed until the owner selects an option', () => {
    expect(calibration.status).toBe('READY_FOR_OWNER_ARBITRATION');
    expect(calibration.ownerDecision).toBeNull();
    expect(calibration.activation).toEqual(
      expect.objectContaining({
        catalogStatus: 'DRAFT',
        runtimePromotionAuthorized: false,
      }),
    );
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
