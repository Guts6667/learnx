import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildEvidenceAssistCandidateRubricViewV2 } from '../../lib/evidence-assist-protocol-v2-adapter.ts';
import {
  buildWritingFrameworkGatePackage,
  FileWritingFrameworkGateStore,
  FrozenOracleWritingFrameworkGateProvider,
  InMemoryWritingFrameworkGateStore,
  runWritingFrameworkSelectionGatePreflight,
  type WritingFrameworkGatePackage,
} from './writing-framework-selection-gate-runner-v2.ts';

const root = process.cwd();
const dossierPath =
  'benchmarks/ai-correction/executable-rubric/writing-framework-selection-sonnet-5-freeze.v1.json';
const financePath =
  'benchmarks/ai-correction/executable-rubric/writing-framework-selection-sonnet-5-finance-envelope.v1.json';

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8');
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function loadPackage(): WritingFrameworkGatePackage {
  const dossierText = read(dossierPath);
  const dossier = JSON.parse(dossierText) as {
    authorities: Record<string, { path: string }>;
  };
  return buildWritingFrameworkGatePackage({
    authorityTexts: Object.fromEntries(
      Object.values(dossier.authorities).map(({ path }) => [path, read(path)]),
    ),
    dossierPath,
    dossierText,
    financeText: read(financePath),
  });
}

function deterministicCanary(caseId: string): string {
  return `lx-canary-${sha256(caseId).slice(0, 32)}`;
}

describe('V4-009C-S2 writing framework gate runner v2', () => {
  it('binds the published HARD_OFF preflight artifact', () => {
    const artifact = JSON.parse(
      read(
        'benchmarks/ai-correction/executable-rubric/writing-framework-selection-sonnet-5-runner-preflight.v1.json',
      ),
    ) as Record<string, unknown>;
    const { preflightFingerprint, ...core } = artifact;
    expect(preflightFingerprint).toBe(
      'ca81bfec01494d31356d6a3efde9bb7581c1a1ff601013f1c8c6df63ee582f16',
    );
    const canonicalize = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(canonicalize);
      if (!value || typeof value !== 'object') return value;
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, child]) => [key, canonicalize(child)]),
      );
    };
    expect(sha256(JSON.stringify(canonicalize(core)))).toBe(
      preflightFingerprint,
    );
    expect(artifact).toMatchObject({
      executionBoundary: {
        modelCallsPerformed: 0,
        networkCallsAllowed: false,
      },
      status: 'HARD_OFF_PREFLIGHT_GREEN',
    });
  });

  it('binds the frozen dossier, Finance envelope and executable rubric v2', () => {
    const packageInput = loadPackage();
    expect(packageInput.identityFingerprint).toBe(
      'cc3b1b52bc0f94198faab362905617a3143169e952a53c38eb37f1571eda5d31',
    );
    expect(packageInput.cases.map(({ caseId }) => caseId)).toEqual([
      'baseline-pico-spider-mastered',
      'fidelity-a-explicit-refusal',
      'fidelity-a-first-fact-removed',
      'injection-negative-base-remains-partial',
    ]);
    expect(packageInput.maximumPromptUtf8Bytes).toBe(65_536);
    expect(packageInput.compiled.compilationStatus).toBe('COMPILED_OFFLINE');
    const candidateView = buildEvidenceAssistCandidateRubricViewV2(
      packageInput.compiled,
    );
    const serialized = JSON.stringify(candidateView);
    for (const forbidden of [
      'evaluationOrder',
      'levels',
      'masteryEffect',
      'progressionEffect',
      'remediation',
      'scorePolicy',
      'templates',
    ]) {
      expect(serialized).not.toContain(`"${forbidden}"`);
    }
  });

  it('completes the four frozen cases through the offline fake provider', async () => {
    const packageInput = loadPackage();
    const provider = new FrozenOracleWritingFrameworkGateProvider(packageInput);
    const store = new InMemoryWritingFrameworkGateStore();
    const run = await runWritingFrameworkSelectionGatePreflight({
      canaryFactory: deterministicCanary,
      packageInput,
      provider,
      store,
    });

    expect(run).toMatchObject({
      forceNoGo: false,
      mode: 'OFFLINE_FAKE_ONLY',
      modelCallsPerformed: 0,
      networkCallsAllowed: false,
      providerExecutions: 4,
      stoppedReason: null,
      usableWorkflows: 4,
    });
    expect(provider.executions).toBe(4);
    expect(run.attempts).toHaveLength(4);
    expect(
      run.attempts.every(
        (attempt) =>
          attempt.status === 'VALID' &&
          attempt.rawPersistedBeforeValidation &&
          attempt.messageUtf8Bytes <= 65_536 &&
          attempt.financialState === 'OFFLINE_NOT_APPLICABLE' &&
          attempt.validation?.level === null &&
          attempt.validation?.score === null &&
          attempt.validation?.progressionEffect === 'NONE',
      ),
    ).toBe(true);
    expect(run.ledger.map(({ event }) => event)).toEqual([
      'CALL_INTENT',
      'RAW_RECEIVED',
      'CALL_OUTCOME',
      'CALL_INTENT',
      'RAW_RECEIVED',
      'CALL_OUTCOME',
      'CALL_INTENT',
      'RAW_RECEIVED',
      'CALL_OUTCOME',
      'CALL_INTENT',
      'RAW_RECEIVED',
      'CALL_OUTCOME',
    ]);
    run.ledger.forEach((event, index) => {
      expect(event.previousHash).toBe(
        index === 0 ? null : run.ledger[index - 1]?.recordHash,
      );
    });
  });

  it('reuses completed outcomes without a second provider execution', async () => {
    const packageInput = loadPackage();
    const store = new InMemoryWritingFrameworkGateStore();
    const firstProvider = new FrozenOracleWritingFrameworkGateProvider(
      packageInput,
    );
    await runWritingFrameworkSelectionGatePreflight({
      canaryFactory: deterministicCanary,
      packageInput,
      provider: firstProvider,
      store,
    });
    const replayProvider = new FrozenOracleWritingFrameworkGateProvider(
      packageInput,
    );
    const replay = await runWritingFrameworkSelectionGatePreflight({
      canaryFactory: deterministicCanary,
      packageInput,
      provider: replayProvider,
      store,
    });
    expect(replay.usableWorkflows).toBe(4);
    expect(replay.providerExecutions).toBe(0);
    expect(replayProvider.executions).toBe(0);
    expect(replay.ledger).toHaveLength(12);
  });

  it('persists the ledger and reuses outcomes after reopening durable storage', async () => {
    const directory = await mkdtemp(
      resolve(tmpdir(), 'learnx-writing-gate-preflight-'),
    );
    try {
      const packageInput = loadPackage();
      const provider = new FrozenOracleWritingFrameworkGateProvider(
        packageInput,
      );
      const store = await FileWritingFrameworkGateStore.open(directory);
      const first = await runWritingFrameworkSelectionGatePreflight({
        canaryFactory: deterministicCanary,
        packageInput,
        provider,
        store,
      });
      expect(first.usableWorkflows).toBe(4);
      const reopened = await FileWritingFrameworkGateStore.open(directory);
      const replayProvider = new FrozenOracleWritingFrameworkGateProvider(
        packageInput,
      );
      const replay = await runWritingFrameworkSelectionGatePreflight({
        canaryFactory: deterministicCanary,
        packageInput,
        provider: replayProvider,
        store: reopened,
      });
      expect(replay.usableWorkflows).toBe(4);
      expect(replayProvider.executions).toBe(0);
      expect(replay.ledger).toHaveLength(12);
      expect(
        (await readFile(resolve(directory, 'ledger.jsonl'), 'utf8'))
          .trim()
          .split('\n'),
      ).toHaveLength(12);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('fails closed when an outcome file exists without its ledger record', async () => {
    const directory = await mkdtemp(
      resolve(tmpdir(), 'learnx-writing-gate-interrupted-outcome-'),
    );
    try {
      const packageInput = loadPackage();
      const store = await FileWritingFrameworkGateStore.open(directory);
      await runWritingFrameworkSelectionGatePreflight({
        canaryFactory: deterministicCanary,
        packageInput,
        provider: new FrozenOracleWritingFrameworkGateProvider(packageInput),
        store,
      });
      const ledgerPath = resolve(directory, 'ledger.jsonl');
      const records = (await readFile(ledgerPath, 'utf8')).trim().split('\n');
      await writeFile(
        ledgerPath,
        `${records.slice(0, 2).join('\n')}\n`,
        'utf8',
      );
      const reopened = await FileWritingFrameworkGateStore.open(directory);
      const firstCaseId = packageInput.cases[0]?.caseId;
      if (!firstCaseId) throw new Error('TEST_GATE_CASE_MISSING');
      const key = sha256(
        `${packageInput.identityFingerprint}:FOUR_CASE_GATE:${firstCaseId}:1`,
      );
      await expect(reopened.findOutcome(key)).rejects.toThrow(
        'WRITING_GATE_OUTCOME_LEDGER_MISSING',
      );
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('fails before provider execution when serialized messages exceed Finance', async () => {
    const packageInput = loadPackage();
    const oversizedPackage = {
      ...packageInput,
      taskContext: 'x'.repeat(65_537),
    } satisfies WritingFrameworkGatePackage;
    const provider = new FrozenOracleWritingFrameworkGateProvider(
      oversizedPackage,
    );
    const run = await runWritingFrameworkSelectionGatePreflight({
      canaryFactory: deterministicCanary,
      packageInput: oversizedPackage,
      provider,
      store: new InMemoryWritingFrameworkGateStore(),
    });
    expect(run.stoppedReason).toBe('BUDGET');
    expect(run.providerExecutions).toBe(0);
    expect(provider.executions).toBe(0);
    expect(run.ledger).toHaveLength(0);
    expect(run.attempts[0]).toMatchObject({
      dispatchState: 'PENDING',
      financialState: 'OFFLINE_NOT_APPLICABLE',
    });
  });

  it('never treats a missing cost as zero and stops without retry', async () => {
    const packageInput = loadPackage();
    const provider = new FrozenOracleWritingFrameworkGateProvider(
      packageInput,
      {
        actualCostUsd: null,
      },
    );
    const run = await runWritingFrameworkSelectionGatePreflight({
      canaryFactory: deterministicCanary,
      packageInput,
      provider,
      store: new InMemoryWritingFrameworkGateStore(),
    });
    expect(provider.executions).toBe(1);
    expect(run.stoppedReason).toBe('FINANCE');
    expect(run.attempts).toHaveLength(1);
    expect(run.attempts[0]).toMatchObject({
      actualCostUsd: null,
      costSource: 'UNKNOWN',
      financialState: 'RECONCILIATION_REQUIRED',
      status: 'INVALID',
    });
  });

  it('does not call the provider when a prior intent has no outcome', async () => {
    const packageInput = loadPackage();
    const store = new InMemoryWritingFrameworkGateStore();
    const firstCaseId = packageInput.cases[0]?.caseId;
    if (!firstCaseId) throw new Error('TEST_GATE_CASE_MISSING');
    const key = sha256(
      `${packageInput.identityFingerprint}:FOUR_CASE_GATE:${firstCaseId}:1`,
    );
    await store.appendCallIntent({ caseId: firstCaseId, idempotencyKey: key });
    const provider = new FrozenOracleWritingFrameworkGateProvider(packageInput);
    const run = await runWritingFrameworkSelectionGatePreflight({
      canaryFactory: deterministicCanary,
      packageInput,
      provider,
      store,
    });
    expect(run.stoppedReason).toBe('FINANCE');
    expect(provider.executions).toBe(0);
    expect(run.attempts[0]).toMatchObject({
      financialState: 'RECONCILIATION_REQUIRED',
      status: 'INVALID',
    });
  });

  it('persists raw before rejecting a canary leak and stops on safety', async () => {
    const packageInput = loadPackage();
    const provider = new FrozenOracleWritingFrameworkGateProvider(
      packageInput,
      {
        rawOutput: ({ requestContext }) =>
          JSON.stringify({
            findings: [],
            leaked: requestContext.canary,
          }),
      },
    );
    const run = await runWritingFrameworkSelectionGatePreflight({
      canaryFactory: deterministicCanary,
      packageInput,
      provider,
      store: new InMemoryWritingFrameworkGateStore(),
    });
    expect(run.stoppedReason).toBe('SAFETY');
    expect(run.attempts[0]?.rawPersistedBeforeValidation).toBe(true);
    expect(run.ledger.map(({ event }) => event)).toEqual([
      'CALL_INTENT',
      'RAW_RECEIVED',
      'CALL_OUTCOME',
    ]);
  });

  it('fails closed when one bound authority byte changes', () => {
    const dossierText = read(dossierPath);
    const dossier = JSON.parse(dossierText) as {
      authorities: Record<string, { path: string }>;
    };
    const authorityTexts = Object.fromEntries(
      Object.values(dossier.authorities).map(({ path }) => [path, read(path)]),
    );
    const firstPath = Object.values(dossier.authorities)[0]?.path;
    if (!firstPath) throw new Error('TEST_AUTHORITY_MISSING');
    authorityTexts[firstPath] = `${authorityTexts[firstPath]} `;
    expect(() =>
      buildWritingFrameworkGatePackage({
        authorityTexts,
        dossierPath,
        dossierText,
        financeText: read(financePath),
      }),
    ).toThrow(`WRITING_GATE_AUTHORITY_MISMATCH:${firstPath}`);
  });
});
