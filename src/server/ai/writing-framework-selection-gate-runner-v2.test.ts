import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildEvidenceAssistCandidateRubricViewV2,
  evidenceAssistJsonSchema,
  prepareEvidenceAssistRequestV2,
} from '../../lib/evidence-assist-protocol-v2-adapter.ts';
import {
  assertWritingGateLiveAuthorizationProof,
  buildWritingFrameworkGatePackage,
  createWritingGateLiveAuthorizationProof,
  createWritingGateRequestManifest,
  FileWritingFrameworkGateStore,
  FrozenOracleWritingFrameworkGateProvider,
  InMemoryWritingFrameworkGateStore,
  runWritingFrameworkSelectionGateLive,
  runWritingFrameworkSelectionGatePreflight,
  type WritingFrameworkGateLiveProvider,
  type WritingFrameworkGatePackage,
  type WritingFrameworkGateProviderRequestCore,
  type WritingFrameworkGateProviderRequest,
  type WritingFrameworkGateProviderResult,
  type WritingGateCostSource,
  type WritingGateFinancialState,
  type WritingGateLiveAuthorizationProof,
} from './writing-framework-selection-gate-runner-v2.ts';

const root = process.cwd();
const dossierPath =
  'benchmarks/ai-correction/executable-rubric/writing-framework-selection-sonnet-5-freeze.v1.json';
const financePath =
  'benchmarks/ai-correction/executable-rubric/writing-framework-selection-sonnet-5-finance-envelope.v1.json';
const geminiDossierPath =
  'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-freeze.v1.json';
const geminiFinancePath =
  'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-finance-envelope.draft.v1.json';
const geminiApprovedFinancePath =
  'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-finance-envelope.approved.v1.json';

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

function loadGeminiPackage(): WritingFrameworkGatePackage {
  const dossierText = read(geminiDossierPath);
  const dossier = JSON.parse(dossierText) as {
    authorities: Record<string, { path: string }>;
  };
  return buildWritingFrameworkGatePackage({
    authorityTexts: Object.fromEntries(
      Object.values(dossier.authorities).map(({ path }) => [path, read(path)]),
    ),
    dossierPath: geminiDossierPath,
    dossierText,
    financeText: read(geminiFinancePath),
  });
}

function loadApprovedGeminiPackage(): WritingFrameworkGatePackage {
  const dossierText = read(geminiDossierPath);
  const dossier = JSON.parse(dossierText) as {
    authorities: Record<string, { path: string }>;
  };
  return buildWritingFrameworkGatePackage({
    authorityTexts: Object.fromEntries(
      Object.values(dossier.authorities).map(({ path }) => [path, read(path)]),
    ),
    dossierPath: geminiDossierPath,
    dossierText,
    financeText: read(geminiApprovedFinancePath),
  });
}

function loadAuthorizedGeminiTestPackage(): WritingFrameworkGatePackage {
  return {
    ...loadApprovedGeminiPackage(),
    identityFingerprint: 'c'.repeat(64),
  };
}

function deterministicCanary(caseId: string): string {
  return `lx-canary-${sha256(caseId).slice(0, 32)}`;
}

function testLiveAuthorizationProof(
  packageInput: WritingFrameworkGatePackage,
  outputDirectory = resolve(
    tmpdir(),
    `learnx-writing-gate-${packageInput.identityFingerprint.slice(0, 12)}`,
  ),
): WritingGateLiveAuthorizationProof {
  return createWritingGateLiveAuthorizationProof({
    authorizationFingerprint: 'a'.repeat(64),
    identityFingerprint: packageInput.identityFingerprint,
    outputDirectory,
    runId: `test-run-${packageInput.identityFingerprint.slice(0, 12)}`,
  });
}

class DeterministicLiveProvider implements WritingFrameworkGateLiveProvider {
  public readonly authorizationProof: WritingGateLiveAuthorizationProof;
  public readonly kind = 'OPENROUTER_LIVE' as const;
  public readonly authorizedIdentityFingerprint: string;
  public executions = 0;

  public constructor(
    private readonly packageInput: WritingFrameworkGatePackage,
    private readonly overrides: Readonly<{
      actualCostUsd?: number | null;
      errorCode?: string;
      generationId?: string | null;
      observedProvider?: string | null;
      openRouterMetadata?: WritingFrameworkGateProviderResult['openRouterMetadata'];
      providerRequestId?: string | null;
      rawOutput?: string;
    }> = {},
    authorizationProof = testLiveAuthorizationProof(packageInput),
  ) {
    this.authorizationProof = authorizationProof;
    this.authorizedIdentityFingerprint = authorizationProof.identityFingerprint;
  }

  public prepare(
    request: WritingFrameworkGateProviderRequestCore,
  ): ReturnType<WritingFrameworkGateLiveProvider['prepare']> {
    return new FrozenOracleWritingFrameworkGateProvider(
      this.packageInput,
    ).prepare(request);
  }

  public async execute(
    request: WritingFrameworkGateProviderRequest,
  ): Promise<WritingFrameworkGateProviderResult> {
    this.executions += 1;
    const offline = await new FrozenOracleWritingFrameworkGateProvider(
      this.packageInput,
    ).execute(request);
    return {
      ...offline,
      actualCostUsd: Object.hasOwn(this.overrides, 'actualCostUsd')
        ? (this.overrides.actualCostUsd ?? null)
        : 0.01,
      costSource: this.overrides.actualCostUsd === null ? 'UNKNOWN' : 'ACTUAL',
      errorCode: this.overrides.errorCode,
      generationId: Object.hasOwn(this.overrides, 'generationId')
        ? (this.overrides.generationId ?? null)
        : offline.generationId,
      observedProvider: Object.hasOwn(this.overrides, 'observedProvider')
        ? (this.overrides.observedProvider ?? null)
        : this.packageInput.expectedObservedProvider,
      openRouterMetadata: Object.hasOwn(this.overrides, 'openRouterMetadata')
        ? (this.overrides.openRouterMetadata ?? null)
        : offline.openRouterMetadata,
      providerRequestId: Object.hasOwn(this.overrides, 'providerRequestId')
        ? (this.overrides.providerRequestId ?? null)
        : `live-test:${request.idempotencyKey}`,
      rawOutput: this.overrides.rawOutput ?? offline.rawOutput,
    };
  }
}

describe('V4-009C-S2 writing framework gate runner v2', () => {
  it('binds the live authorization proof to authorization, run and output directory', () => {
    const packageInput = loadAuthorizedGeminiTestPackage();
    const outputDirectory = resolve(
      tmpdir(),
      'learnx-writing-gate-proof-binding',
    );
    const proof = createWritingGateLiveAuthorizationProof({
      authorizationFingerprint: 'a'.repeat(64),
      identityFingerprint: packageInput.identityFingerprint,
      outputDirectory,
      runId: 'bound-run',
    });
    const otherRun = createWritingGateLiveAuthorizationProof({
      authorizationFingerprint: 'a'.repeat(64),
      identityFingerprint: packageInput.identityFingerprint,
      outputDirectory,
      runId: 'other-run',
    });
    const otherDirectory = createWritingGateLiveAuthorizationProof({
      authorizationFingerprint: 'a'.repeat(64),
      identityFingerprint: packageInput.identityFingerprint,
      outputDirectory: resolve(outputDirectory, 'other'),
      runId: 'bound-run',
    });

    expect(proof.proofSha256).not.toBe(otherRun.proofSha256);
    expect(proof.proofSha256).not.toBe(otherDirectory.proofSha256);
    expect(() =>
      assertWritingGateLiveAuthorizationProof({
        ...proof,
        authorizationFingerprint: 'b'.repeat(64),
      }),
    ).toThrow('WRITING_GATE_LIVE_AUTHORIZATION_PROOF_INVALID');
  });

  it('rejects normalized nested secrets and Bearer values in request manifests', () => {
    const base = {
      caseId: 'case-sensitive-manifest',
      idempotencyKey: 'd'.repeat(64),
      identityFingerprint: 'e'.repeat(64),
      requestContextFingerprint: 'f'.repeat(64),
      wireDialect: 'EVIDENCE_ASSIST_LOCAL_3_0_0' as const,
      wireDialectVersion: '3.0.0',
      wireSchemaSha256: 'a'.repeat(64),
    };

    expect(() =>
      createWritingGateRequestManifest({
        ...base,
        transportManifest: {
          manifestSha256: 'b'.repeat(64),
          nested: { request_body: 'must never persist' },
        },
      }),
    ).toThrow('WRITING_GATE_REQUEST_MANIFEST_SENSITIVE_FIELD');
    expect(() =>
      createWritingGateRequestManifest({
        ...base,
        transportManifest: {
          manifestSha256: 'b'.repeat(64),
          nested: { note: 'Bearer private-token' },
        },
      }),
    ).toThrow('WRITING_GATE_REQUEST_MANIFEST_BEARER_VALUE');
  });

  it('keeps conservative write-off explicit and never aliases unknown reconciliation', () => {
    const costSource: WritingGateCostSource = 'CONSERVATIVE_WRITE_OFF';
    const financialState: WritingGateFinancialState = 'CONSERVATIVE_WRITE_OFF';

    expect({ costSource, financialState }).toEqual({
      costSource: 'CONSERVATIVE_WRITE_OFF',
      financialState: 'CONSERVATIVE_WRITE_OFF',
    });
    expect(costSource).not.toBe('UNKNOWN');
    expect(financialState).not.toBe('RECONCILIATION_REQUIRED');
  });

  it('parameterizes Gemini 3.6 without inheriting the Sonnet identity or budget', async () => {
    const packageInput = loadGeminiPackage();
    const dossier = JSON.parse(read(geminiDossierPath)) as {
      identityCore: Record<string, unknown>;
      corpusFingerprint: string;
      semanticMappingFingerprint: string;
      runnerContractFingerprint: string;
      stopPolicyFingerprint: string;
      telemetryContractFingerprint: string;
    };
    const finance = JSON.parse(read(geminiFinancePath)) as {
      authorizationBoundary: Record<string, unknown>;
      gateBound: Record<string, unknown>;
      historicalDraftComparison: Record<string, unknown>;
    };
    expect(packageInput).toMatchObject({
      catalogSnapshotId: 'google/gemini-3.6-flash-20260721',
      expectedObservedProvider: 'Google',
      identityFingerprint:
        'ef88a8e3b1bfd57ddc4afe787d8a920ea4b329e3d83b28b3fc4029487e88e9ed',
      requestedRoute: 'google-vertex/global',
      wireModelId: 'google/gemini-3.6-flash',
      requestProfile: {
        maxOutputTokens: 2500,
        reasoningEffort: 'MINIMAL',
        reasoningMandatory: true,
        reasoningMode: 'EFFORT_ONLY',
        temperature: null,
        timeoutMs: 60000,
        visibleOutputTokenTarget: 1800,
      },
    });
    expect(dossier.identityCore).toMatchObject({
      catalogSnapshotId: 'google/gemini-3.6-flash-20260721',
      maxOutputTokens: 2500,
      reasoning: {
        effort: 'MINIMAL',
        mandatory: true,
        mode: 'EFFORT_ONLY',
      },
      temperature: null,
      visibleOutputTokenTarget: 1800,
    });
    expect({
      corpus: dossier.corpusFingerprint,
      mapping: dossier.semanticMappingFingerprint,
      runner: dossier.runnerContractFingerprint,
      stop: dossier.stopPolicyFingerprint,
      telemetry: dossier.telemetryContractFingerprint,
    }).toEqual({
      corpus:
        '12f0202d930b9f197532847c0125f5531a2b8d39502c8f1244e6049629828a4b',
      mapping:
        '4fbff2b975124bcd336c49e0d2dbfe42ebf3f4adcf9a048ca17c8c4e5a79bb85',
      runner:
        '891560b6712afc1f197aea8d016a3309d2d5c7db3ac7e519bda6968d4227eb0b',
      stop: '3416fd36324f0b29952dbb005c44ec2fc58520167d011fdf2698b1a04eabff4e',
      telemetry:
        'e8e4e16a18e4ad652f3b271847e156aedc66f0c8c934eae9c2291cbf1d519b56',
    });
    expect(finance.authorizationBoundary).toMatchObject({
      financeArbitration: 'NOT_GRANTED',
      modelCallsAllowed: false,
      ownerNetworkAuthorization: 'NOT_GRANTED',
    });
    expect(finance.gateBound).toMatchObject({
      maximumProviderAttempts: 4,
      maximumProviderCostUsd: 0.483366,
      proposedRoundedProviderCapUsd: 0.5,
    });
    expect(finance.historicalDraftComparison).toMatchObject({
      oldProposedProviderCapUsd: 0.075,
      reuseAllowed: false,
    });

    const provider = new FrozenOracleWritingFrameworkGateProvider(packageInput);
    const run = await runWritingFrameworkSelectionGatePreflight({
      canaryFactory: deterministicCanary,
      packageInput,
      provider,
      store: new InMemoryWritingFrameworkGateStore(),
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
    expect(
      run.attempts.every(
        ({ requestedRoute }) => requestedRoute === 'google-vertex/global',
      ),
    ).toBe(true);
    const artifact = JSON.parse(
      read(
        'benchmarks/ai-correction/executable-rubric/writing-framework-selection-gemini-3-6-runner-preflight.v1.json',
      ),
    ) as Record<string, unknown>;
    const { preflightFingerprint, ...core } = artifact;
    const canonicalize = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(canonicalize);
      if (!value || typeof value !== 'object') return value;
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, child]) => [key, canonicalize(child)]),
      );
    };
    expect(preflightFingerprint).toBe(
      '9d7dee2afcba338d3354b2d2478f42378307d0b281edfe400c8eb4723f87475e',
    );
    expect(sha256(JSON.stringify(canonicalize(core)))).toBe(
      preflightFingerprint,
    );
  });
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
      'REQUEST_MANIFEST',
      'CALL_INTENT',
      'RAW_RECEIVED',
      'CALL_OUTCOME',
      'REQUEST_MANIFEST',
      'CALL_INTENT',
      'RAW_RECEIVED',
      'CALL_OUTCOME',
      'REQUEST_MANIFEST',
      'CALL_INTENT',
      'RAW_RECEIVED',
      'CALL_OUTCOME',
      'REQUEST_MANIFEST',
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
    expect(replay.ledger).toHaveLength(16);
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
      expect(replay.ledger).toHaveLength(16);
      expect(
        (await readFile(resolve(directory, 'ledger.jsonl'), 'utf8'))
          .trim()
          .split('\n'),
      ).toHaveLength(16);
      const firstCase = packageInput.cases[0];
      if (!firstCase) throw new Error('TEST_GATE_CASE_MISSING');
      const firstKey = sha256(
        `${packageInput.identityFingerprint}:FOUR_CASE_GATE:${firstCase.caseId}:1`,
      );
      const persistedManifest = await readFile(
        resolve(directory, 'requests', `${firstKey}.json`),
        'utf8',
      );
      expect(persistedManifest).not.toContain(packageInput.taskPrompt);
      expect(persistedManifest).not.toContain(packageInput.taskContext);
      expect(persistedManifest).not.toContain(firstCase.responseText);
      expect(persistedManifest).not.toMatch(
        /"(?:apiKey|authorization|body|headers|messages|profile|prompt)"/iu,
      );
      expect(JSON.parse(persistedManifest)).toMatchObject({
        manifestSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
        transportManifest: {
          bodySha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
          messagesSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
          profileSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
          schemaSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
        },
      });
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
        `${records.slice(0, 3).join('\n')}\n`,
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
    const provider = new FrozenOracleWritingFrameworkGateProvider(packageInput);
    const caseItem = packageInput.cases[0];
    if (!caseItem) throw new Error('TEST_GATE_CASE_MISSING');
    const prepared = prepareEvidenceAssistRequestV2({
      canaryFactory: () => deterministicCanary(firstCaseId),
      compiled: packageInput.compiled,
      responseText: caseItem.responseText,
      taskContext: packageInput.taskContext,
      taskPrompt: packageInput.taskPrompt,
    });
    const requestCore: WritingFrameworkGateProviderRequestCore = {
      caseId: firstCaseId,
      idempotencyKey: key,
      jsonSchema: evidenceAssistJsonSchema(),
      messages: prepared.messages,
      requestContext: prepared.requestContext,
    };
    const manifest = provider.prepare(requestCore);
    await store.appendRequestManifest(manifest);
    await store.appendCallIntent({
      caseId: firstCaseId,
      idempotencyKey: key,
      requestManifestSha256: manifest.manifestSha256,
    });
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
      'REQUEST_MANIFEST',
      'CALL_INTENT',
      'RAW_RECEIVED',
      'CALL_OUTCOME',
    ]);
    expect(run.ledger.find(({ event }) => event === 'RAW_RECEIVED')).toEqual(
      expect.objectContaining({
        rawOutputSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      }),
    );
    expect(
      Object.hasOwn(
        run.ledger.find(({ event }) => event === 'RAW_RECEIVED') ?? {},
        'rawOutput',
      ),
    ).toBe(false);
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

  it('runs the live path sequentially with actual costs and durable outcomes', async () => {
    const packageInput = loadPackage();
    const provider = new DeterministicLiveProvider(packageInput);
    const store = new InMemoryWritingFrameworkGateStore();
    const run = await runWritingFrameworkSelectionGateLive({
      canaryFactory: deterministicCanary,
      packageInput,
      provider,
      store,
    });
    expect(run).toMatchObject({
      forceNoGo: false,
      mode: 'OPENROUTER_LIVE',
      modelCallsPerformed: 4,
      networkCallsAllowed: true,
      stoppedReason: null,
      usableWorkflows: 4,
    });
    expect(provider.executions).toBe(4);
    expect(run.attempts).toHaveLength(4);
    expect(
      run.attempts.every(
        ({ costSource, financialState, observedProvider, status }) =>
          costSource === 'ACTUAL' &&
          financialState === 'RECONCILED' &&
          observedProvider === 'Anthropic' &&
          status === 'VALID',
      ),
    ).toBe(true);
  });

  it('consumes a bound live authorization once and keeps raw outside the durable ledger', async () => {
    const directory = await mkdtemp(
      resolve(tmpdir(), 'learnx-writing-gate-live-authorization-'),
    );
    try {
      const packageInput = loadPackage();
      const proof = testLiveAuthorizationProof(packageInput, directory);
      const firstProvider = new DeterministicLiveProvider(
        packageInput,
        {},
        proof,
      );
      const store = await FileWritingFrameworkGateStore.open(directory);
      const first = await runWritingFrameworkSelectionGateLive({
        canaryFactory: deterministicCanary,
        packageInput,
        provider: firstProvider,
        store,
      });

      expect(firstProvider.executions).toBe(4);
      expect(first.ledger[0]).toMatchObject({
        authorizationFingerprint: proof.authorizationFingerprint,
        authorizationProofSha256: proof.proofSha256,
        event: 'LIVE_AUTHORIZATION_CONSUMED',
      });
      const ledgerText = await readFile(
        resolve(directory, 'ledger.jsonl'),
        'utf8',
      );
      expect(ledgerText).not.toContain('"rawOutput"');
      expect(
        ledgerText
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line) as { event: string })
          .filter(({ event }) => event === 'LIVE_AUTHORIZATION_CONSUMED'),
      ).toHaveLength(1);

      const firstCase = packageInput.cases[0];
      if (!firstCase) throw new Error('TEST_GATE_CASE_MISSING');
      const firstKey = sha256(
        `${packageInput.identityFingerprint}:FOUR_CASE_GATE:${firstCase.caseId}:1`,
      );
      const rawEnvelope = JSON.parse(
        await readFile(resolve(directory, 'raw', `${firstKey}.json`), 'utf8'),
      ) as { rawOutput: string; rawOutputSha256: string };
      expect(rawEnvelope.rawOutput).not.toHaveLength(0);
      expect(rawEnvelope.rawOutputSha256).toBe(sha256(rawEnvelope.rawOutput));

      const reopened = await FileWritingFrameworkGateStore.open(directory);
      const replayProvider = new DeterministicLiveProvider(
        packageInput,
        {},
        proof,
      );
      const replay = await runWritingFrameworkSelectionGateLive({
        canaryFactory: deterministicCanary,
        packageInput,
        provider: replayProvider,
        store: reopened,
      });
      expect(replayProvider.executions).toBe(0);
      expect(replay.usableWorkflows).toBe(4);
      expect(
        replay.ledger.filter(
          ({ event }) => event === 'LIVE_AUTHORIZATION_CONSUMED',
        ),
      ).toHaveLength(1);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('rejects an authorization bound to another output directory before dispatch', async () => {
    const directory = await mkdtemp(
      resolve(tmpdir(), 'learnx-writing-gate-live-proof-mismatch-'),
    );
    try {
      const packageInput = loadPackage();
      const provider = new DeterministicLiveProvider(
        packageInput,
        {},
        testLiveAuthorizationProof(
          packageInput,
          resolve(directory, 'different-output'),
        ),
      );
      const store = await FileWritingFrameworkGateStore.open(directory);
      await expect(
        runWritingFrameworkSelectionGateLive({
          canaryFactory: deterministicCanary,
          packageInput,
          provider,
          store,
        }),
      ).rejects.toThrow('WRITING_GATE_AUTHORIZED_OUTPUT_DIRECTORY_MISMATCH');
      expect(provider.executions).toBe(0);
      expect(store.ledger()).toHaveLength(0);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('stops the live path after one response with missing cost', async () => {
    const packageInput = loadPackage();
    const provider = new DeterministicLiveProvider(packageInput, {
      actualCostUsd: null,
    });
    const run = await runWritingFrameworkSelectionGateLive({
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
      financialState: 'RECONCILIATION_REQUIRED',
      status: 'INVALID',
    });
  });

  it('runs the approved Gemini package sequentially within the single-use cap', async () => {
    const packageInput = loadAuthorizedGeminiTestPackage();
    const provider = new DeterministicLiveProvider(packageInput, {
      actualCostUsd: 0.1,
      generationId: 'generation-live-test',
      openRouterMetadata: {
        endpoints: [
          {
            model: 'google/gemini-3.6-flash',
            provider: 'Google',
            selected: true,
          },
        ],
        requested: 'google-vertex/global',
      },
    });
    const run = await runWritingFrameworkSelectionGateLive({
      canaryFactory: deterministicCanary,
      packageInput,
      provider,
      store: new InMemoryWritingFrameworkGateStore(),
    });

    expect(run).toMatchObject({
      forceNoGo: false,
      modelCallsPerformed: 4,
      stoppedReason: null,
      usableWorkflows: 4,
    });
    expect(provider.executions).toBe(4);
    expect(
      run.attempts.every(
        ({
          generationId,
          observedProvider,
          openRouterMetadata,
          requestedRoute,
        }) =>
          generationId === 'generation-live-test' &&
          observedProvider === 'Google' &&
          openRouterMetadata?.requested === 'google-vertex/global' &&
          requestedRoute === 'google-vertex/global',
      ),
    ).toBe(true);
    expect(
      run.attempts.reduce(
        (total, { actualCostUsd }) => total + (actualCostUsd ?? 0),
        0,
      ),
    ).toBeCloseTo(0.4, 10);
  });

  it('rejects replay of the consumed Gemini Q1 identity before dispatch', async () => {
    const packageInput = loadApprovedGeminiPackage();
    const provider = new DeterministicLiveProvider(packageInput);
    const store = new InMemoryWritingFrameworkGateStore();

    await expect(
      runWritingFrameworkSelectionGateLive({
        canaryFactory: deterministicCanary,
        packageInput,
        provider,
        store,
      }),
    ).rejects.toThrow('WRITING_GATE_IDENTITY_CLOSED_NO_REPLAY');
    expect(provider.executions).toBe(0);
    expect(store.ledger()).toHaveLength(0);
  });

  it('persists the request manifest and CALL_INTENT before provider dispatch', async () => {
    const packageInput = loadAuthorizedGeminiTestPackage();
    const store = new InMemoryWritingFrameworkGateStore();
    const delegate = new DeterministicLiveProvider(packageInput);
    let observedIntentBeforeExecution = false;
    let observedAuthorizationBeforeExecution = false;
    const provider: WritingFrameworkGateLiveProvider = {
      authorizationProof: delegate.authorizationProof,
      authorizedIdentityFingerprint: packageInput.identityFingerprint,
      kind: 'OPENROUTER_LIVE',
      prepare(request) {
        return delegate.prepare(request);
      },
      async execute(request) {
        const ledger = store.ledger();
        observedAuthorizationBeforeExecution =
          ledger[0]?.event === 'LIVE_AUTHORIZATION_CONSUMED';
        observedIntentBeforeExecution =
          ledger.at(-1)?.event === 'CALL_INTENT' &&
          ledger.at(-2)?.event === 'REQUEST_MANIFEST' &&
          ledger.at(-1)?.requestManifestSha256 ===
            request.requestManifest.manifestSha256;
        return delegate.execute(request);
      },
    };

    const run = await runWritingFrameworkSelectionGateLive({
      canaryFactory: deterministicCanary,
      packageInput,
      provider,
      store,
    });

    expect(observedAuthorizationBeforeExecution).toBe(true);
    expect(observedIntentBeforeExecution).toBe(true);
    expect(run.usableWorkflows).toBe(4);
  });

  it('requires reconciliation when Gemini returns no actual cost', async () => {
    const packageInput = loadAuthorizedGeminiTestPackage();
    const provider = new DeterministicLiveProvider(packageInput, {
      actualCostUsd: null,
    });
    const run = await runWritingFrameworkSelectionGateLive({
      canaryFactory: deterministicCanary,
      packageInput,
      provider,
      store: new InMemoryWritingFrameworkGateStore(),
    });

    expect(provider.executions).toBe(1);
    expect(run.stoppedReason).toBe('FINANCE');
    expect(run.attempts[0]).toMatchObject({
      actualCostUsd: null,
      financialState: 'RECONCILIATION_REQUIRED',
      status: 'INVALID',
    });
  });

  it('fails traceability when Gemini returns neither generation nor request id', async () => {
    const packageInput = loadAuthorizedGeminiTestPackage();
    const provider = new DeterministicLiveProvider(packageInput, {
      generationId: null,
      providerRequestId: null,
    });
    const run = await runWritingFrameworkSelectionGateLive({
      canaryFactory: deterministicCanary,
      packageInput,
      provider,
      store: new InMemoryWritingFrameworkGateStore(),
    });

    expect(provider.executions).toBe(1);
    expect(run.stoppedReason).toBe('TRACEABILITY');
    expect(run.attempts[0]).toMatchObject({
      providerRequestId: null,
      rawPersistedBeforeValidation: true,
      status: 'INVALID',
    });
  });

  it('persists a generation id independently when request id is absent', async () => {
    const packageInput = loadAuthorizedGeminiTestPackage();
    const provider = new DeterministicLiveProvider(packageInput, {
      generationId: 'generation-only-id',
      providerRequestId: null,
    });
    const run = await runWritingFrameworkSelectionGateLive({
      canaryFactory: deterministicCanary,
      packageInput,
      provider,
      store: new InMemoryWritingFrameworkGateStore(),
    });

    expect(run.forceNoGo).toBe(false);
    expect(run.attempts).toHaveLength(4);
    expect(
      run.attempts.every(
        ({ generationId, providerRequestId, status }) =>
          generationId === 'generation-only-id' &&
          providerRequestId === null &&
          status === 'VALID',
      ),
    ).toBe(true);
  });

  it('marks a simulated post-dispatch timeout orphaned and stops', async () => {
    const packageInput = loadAuthorizedGeminiTestPackage();
    const provider = new DeterministicLiveProvider(packageInput, {
      actualCostUsd: null,
      errorCode: 'PROVIDER_TIMEOUT',
      providerRequestId: null,
      rawOutput: '',
    });
    const run = await runWritingFrameworkSelectionGateLive({
      canaryFactory: deterministicCanary,
      packageInput,
      provider,
      store: new InMemoryWritingFrameworkGateStore(),
    });

    expect(provider.executions).toBe(1);
    expect(run.stoppedReason).toBe('TRACEABILITY');
    expect(run.attempts[0]).toMatchObject({
      defectClasses: ['TRACEABILITY', 'FINANCE'],
      dispatchState: 'ORPHANED',
      errorCode: 'PROVIDER_TIMEOUT',
      financialState: 'RECONCILIATION_REQUIRED',
      rawPersistedBeforeValidation: true,
    });
    expect(run.ledger.map(({ event }) => event)).toEqual([
      'LIVE_AUTHORIZATION_CONSUMED',
      'REQUEST_MANIFEST',
      'CALL_INTENT',
      'RAW_RECEIVED',
      'CALL_OUTCOME',
    ]);
  });

  it('stops after one response whose actual cost exceeds the per-attempt bound', async () => {
    const packageInput = loadAuthorizedGeminiTestPackage();
    const provider = new DeterministicLiveProvider(packageInput, {
      actualCostUsd: 0.120_842,
    });
    const run = await runWritingFrameworkSelectionGateLive({
      canaryFactory: deterministicCanary,
      packageInput,
      provider,
      store: new InMemoryWritingFrameworkGateStore(),
    });

    expect(provider.executions).toBe(1);
    expect(run.stoppedReason).toBe('BUDGET');
  });

  it('prevents the next call when its worst-case bound would exceed the cap', async () => {
    const approved = loadAuthorizedGeminiTestPackage();
    const packageInput = {
      ...approved,
      finance: {
        ...approved.finance,
        gateBound: {
          ...approved.finance.gateBound,
          maximumProviderCostUsd: 0.2,
        },
      },
    } satisfies WritingFrameworkGatePackage;
    const provider = new DeterministicLiveProvider(packageInput, {
      actualCostUsd: 0.09,
    });
    const run = await runWritingFrameworkSelectionGateLive({
      canaryFactory: deterministicCanary,
      packageInput,
      provider,
      store: new InMemoryWritingFrameworkGateStore(),
    });

    expect(provider.executions).toBe(1);
    expect(run.stoppedReason).toBe('BUDGET');
    expect(run.attempts[1]).toMatchObject({
      dispatchState: 'PENDING',
      status: 'INVALID',
    });
  });

  it('stops on the first semantic defect after persisting raw', async () => {
    const packageInput = loadAuthorizedGeminiTestPackage();
    const provider = new DeterministicLiveProvider(packageInput, {
      rawOutput: JSON.stringify({ findings: [] }),
    });
    const run = await runWritingFrameworkSelectionGateLive({
      canaryFactory: deterministicCanary,
      packageInput,
      provider,
      store: new InMemoryWritingFrameworkGateStore(),
    });

    expect(provider.executions).toBe(1);
    expect(run.stoppedReason).toBe('SEMANTIC_DISAGREEMENT');
    expect(run.attempts[0]?.rawPersistedBeforeValidation).toBe(true);
  });

  it('resumes the completed Gemini gate without a second provider call', async () => {
    const packageInput = loadAuthorizedGeminiTestPackage();
    const store = new InMemoryWritingFrameworkGateStore();
    const firstProvider = new DeterministicLiveProvider(packageInput);
    await runWritingFrameworkSelectionGateLive({
      canaryFactory: deterministicCanary,
      packageInput,
      provider: firstProvider,
      store,
    });
    const replayProvider = new DeterministicLiveProvider(packageInput);
    const replay = await runWritingFrameworkSelectionGateLive({
      canaryFactory: deterministicCanary,
      packageInput,
      provider: replayProvider,
      store,
    });

    expect(firstProvider.executions).toBe(4);
    expect(replay.providerExecutions).toBe(0);
    expect(replayProvider.executions).toBe(0);
    expect(replay.usableWorkflows).toBe(4);
  });
});
