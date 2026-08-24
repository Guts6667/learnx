import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();
const dossierPath = resolve(
  root,
  'benchmarks/ai-correction/executable-rubric/writing-framework-selection-sonnet-5-freeze.v1.json',
);

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

function fingerprint(value: unknown): string {
  return sha256(JSON.stringify(canonicalize(value)));
}

type Artifact = { path: string; sha256: string };

describe('V4-003C frozen experiment dossier', () => {
  const dossier = JSON.parse(readFileSync(dossierPath, 'utf8')) as Record<
    string,
    unknown
  >;

  it('binds every authority to the exact repository bytes', () => {
    const authorities = dossier.authorities as Record<string, Artifact>;
    for (const authority of Object.values(authorities)) {
      expect(sha256(readFileSync(resolve(root, authority.path), 'utf8'))).toBe(
        authority.sha256,
      );
    }
  });

  it('binds identity, corpus, mapping, runner, telemetry and stop policy', () => {
    expect(dossier.identityFingerprint).toBe(
      fingerprint(dossier.identityCore),
    );
    expect(dossier.corpusFingerprint).toBe(fingerprint(dossier.corpus));
    expect(dossier.semanticMappingFingerprint).toBe(
      fingerprint(dossier.semanticMapping),
    );
    expect(dossier.runnerContractFingerprint).toBe(
      fingerprint(dossier.runnerContract),
    );
    expect(dossier.telemetryContractFingerprint).toBe(
      fingerprint(dossier.telemetryContract),
    );
    expect(dossier.stopPolicyFingerprint).toBe(
      fingerprint(dossier.stopPolicy),
    );
  });

  it('selects existing unique cases and freezes four then ten by two', () => {
    const oracle = JSON.parse(
      readFileSync(
        resolve(
          root,
          'benchmarks/ai-correction/executable-rubric/writing-framework-selection-fr.mechanical-oracle.v2.1.json',
        ),
        'utf8',
      ),
    ) as { cases: Array<{ caseId: string }> };
    const available = new Set(oracle.cases.map(({ caseId }) => caseId));
    const corpus = dossier.corpus as {
      conditionalPanel10x2: {
        caseIds: string[];
        freshLogicalWorkflows: number;
        repetitionsPerCase: number;
      };
      gateFour: Array<{ caseId: string }>;
    };
    const gateIds = corpus.gateFour.map(({ caseId }) => caseId);
    expect(gateIds).toHaveLength(4);
    expect(new Set(gateIds)).toHaveLength(4);
    expect(corpus.conditionalPanel10x2.caseIds).toHaveLength(10);
    expect(new Set(corpus.conditionalPanel10x2.caseIds)).toHaveLength(10);
    expect(corpus.conditionalPanel10x2.freshLogicalWorkflows).toBe(20);
    expect(corpus.conditionalPanel10x2.repetitionsPerCase).toBe(2);
    for (const caseId of [
      ...gateIds,
      ...corpus.conditionalPanel10x2.caseIds,
    ]) {
      expect(available.has(caseId)).toBe(true);
    }
  });

  it('keeps every execution authority hard-off before Rayan and Finance', () => {
    expect(dossier.status).toBe('FROZEN_OFFLINE_AWAITING_RAYAN_C');
    expect(dossier.scope).toMatchObject({
      historicalResultsReused: 0,
      holdoutAccess: 'PROHIBITED',
      liveActivationAllowed: false,
      modelCallsAllowed: false,
    });
    expect(dossier.blockers).toEqual({
      financeArbitration: 'NOT_GRANTED',
      holdoutAccess: 'PROHIBITED',
      liveExecution: 'BLOCKED',
      networkAuthorization: 'NOT_GRANTED',
      rayanCArbitration: 'NOT_GRANTED',
      runnerImplementationVerified: false,
    });
  });
});
