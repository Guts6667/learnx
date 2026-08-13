import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  assertGeminiPanelCallAllowed,
  geminiPanelFingerprint,
  geminiPanelManifestSchema,
  geminiPanelOwnerGoToken,
  V4_009C_CASE_IDS,
} from './gemini-panel-validation';

const manifest = () =>
  geminiPanelManifestSchema.parse(
    JSON.parse(
      readFileSync(
        resolve('benchmarks/ai-correction/gemini/v4-009c-run-manifest.json'),
        'utf8',
      ),
    ),
  );

describe('V4-009C frozen manifest', () => {
  it('contains exactly ten cases and two repetitions without holdout', () => {
    const value = manifest();
    expect(value.cells).toHaveLength(20);
    expect(new Set(value.cells.map((cell) => cell.caseId))).toEqual(
      new Set(V4_009C_CASE_IDS),
    );
    expect(JSON.stringify(value)).not.toContain('holdout');
  });

  it('requires a distinct owner authorization and enforces both caps', () => {
    const value = manifest();
    expect(geminiPanelOwnerGoToken()).toContain('V4_009C');
    expect(() =>
      assertGeminiPanelCallAllowed({
        actualCostUsd: 0,
        attempts: 0,
        manifest: value,
        worstCaseNextUsd: 0.01,
      }),
    ).toThrow('GEMINI_PANEL_OWNER_GO_REQUIRED');
    const granted = { ...value, authorization: 'GRANTED' as const };
    expect(() =>
      assertGeminiPanelCallAllowed({
        actualCostUsd: 0.49,
        attempts: 20,
        manifest: granted,
        worstCaseNextUsd: 0.02,
      }),
    ).toThrow('BUDGET_PREFLIGHT_BLOCKED');
  });

  it('fingerprints every frozen identity field', () => {
    const value = manifest();
    expect(geminiPanelFingerprint(value)).toMatch(/^[a-f0-9]{64}$/u);
    expect(
      geminiPanelFingerprint({
        ...value,
        experimentVersion: '1.0.0',
        cells: value.cells.map((cell, index) =>
          index === 0 ? { ...cell, caseDigest: 'f'.repeat(64) } : cell,
        ),
      }),
    ).not.toBe(geminiPanelFingerprint(value));
  });
});
