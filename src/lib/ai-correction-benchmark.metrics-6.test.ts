/// <reference types="node" />

import { describe, expect, it } from 'vitest';
import { benchmarkRegressed } from '@/lib/ai-correction-benchmark';
import {
  loadConfiguration,
  buildPassingMetrics,
} from './ai-correction-benchmark.test-support.js';

describe('correction benchmark metrics — part 6', () => {
  it('detects a regression against the last promoted baseline', () => {
    const configuration = loadConfiguration();
    const baseline = {
      ...buildPassingMetrics(configuration),
      estimatedCostUsd: 1,
      p75LatencyMs: 1200,
      p90LatencyMs: 1500,
    };

    expect(
      benchmarkRegressed({
        baseline,
        candidate: { ...baseline, criterionAgreement: 0.86 },
        limits: configuration.regressionLimits,
      }),
    ).toBe(true);
    expect(
      benchmarkRegressed({
        baseline,
        candidate: { ...baseline, criterionAgreement: 0.88 },
        limits: configuration.regressionLimits,
      }),
    ).toBe(false);
  });
});
