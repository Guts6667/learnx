import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import {
  RECOVERY_RUBRIC,
  type RecoveryReference,
} from './ai-correction-recovery-contract';
import { prepareRecoveryPack } from './ai-correction-recovery-pack';
import {
  createRecoveryLock,
  evaluateRecoveryPilot,
  recoveryHash,
} from './ai-correction-recovery-evaluation';
import {
  executeRecoveryMeasurement,
  prepareRecoveryExecution,
  type RecoveryExecutionEvent,
} from './ai-correction-recovery-execution';
import { createGuardedResearchFetch } from './ai-correction-research-guarded-fetch';
import {
  PROMOTED_CORRECTION_IDENTITY,
  PROMOTED_CHECKER_IDENTITY,
} from '../server/corrections/promoted-identity';
import { openAtomBudget } from './ai-correction-atom-verifier-budget';

const directories: string[] = [];
function directory() {
  const dir = mkdtempSync(path.join(tmpdir(), 'learnx-writing-runner-test-'));
  directories.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of directories.splice(0))
    rmSync(dir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

function fixture() {
  // Synthetic instrument fixtures only: no empirical qualification claim.
  const pack = prepareRecoveryPack(
    Array.from({ length: 30 }, (_, i) => ({
      sourceAnswerId: `fixture-${i}`,
      provenance: 'Synthetic unit fixture',
      dossier: 'Dossier fermé.',
      instruction: 'Expliquer.',
      sentences: [{ id: 's1', text: `Fait ${i}, mécanisme et limite.` }],
      mutations: [
        {
          kind: 'FACT_INVERSION',
          targetCriterion: 'source-fidelity',
          description: 'Inverse',
          sentences: [{ id: 's1', text: `Inverse ${i}.` }],
        },
        {
          kind: 'EVIDENCE_DELETION',
          targetCriterion: 'mechanism-link',
          description: 'Supprime',
          sentences: [{ id: 's1', text: `Reste ${i}.` }],
        },
      ],
    })),
    'OWNER_SUPPLIED',
  );
  const labels = pack.cases.map((answer) => ({
    caseId: answer.caseId,
    criteria: RECOVERY_RUBRIC.criteria.map((criterion) => ({
      criterionKey: criterion.key,
      level: 'mastered' as const,
      roles: Object.fromEntries(criterion.roles.map((role) => [role, ['s1']])),
    })),
  }));
  const reference: RecoveryReference = {
    schemaVersion: 1,
    rubricVersion: RECOVERY_RUBRIC.version,
    packHash: recoveryHash(pack),
    reviewer: 'Rayan',
    reviewedAt: '2026-01-01T00:00:00.000Z',
    rubricApproved: true,
    independentSourcesConfirmed: true,
    labelsLockedBeforeModelOutputs: true,
    labels,
    retest: pack.retestCaseIds.map((id) => {
      const label = labels.find((row) => row.caseId === id);
      if (!label) throw new Error('Fixture missing label');
      return structuredClone(label);
    }),
  };
  const lock = createRecoveryLock(pack, reference, '2026-01-02T00:00:00.000Z');
  const price = {
    promptUsdPerToken: 0.000003,
    completionUsdPerToken: 0.000015,
    source: 'Synthetic unit price ceiling',
    recordedAt: '2026-01-01T00:00:00.000Z',
  };
  const input = {
    pack,
    reference,
    lock,
    safetyReport: { status: 'UNREVIEWED_FIXTURE', cases: [] },
    priceCaps: { primary: price, verifier: price },
    startedAt: '2026-01-03T00:00:00.000Z',
    identities: {
      primary: PROMOTED_CORRECTION_IDENTITY,
      verifier: PROMOTED_CHECKER_IDENTITY,
    },
  };
  return { input, plan: prepareRecoveryExecution(input) };
}

function provider(
  override?: (envelope: Record<string, unknown>, index: number) => void,
) {
  const requests: Record<string, unknown>[] = [];
  const fetcher = vi.fn<typeof fetch>(async (resource, init) => {
    const body = (await new Request(resource, init).json()) as {
      model: string;
      provider: { only: string[] };
      response_format: { json_schema: { name: string } };
    };
    requests.push(body);
    const primary = body.response_format.json_schema.name.endsWith('_primary');
    const payload = {
      criteria: Object.fromEntries(
        RECOVERY_RUBRIC.criteria.map((criterion) => [
          criterion.key,
          primary
            ? {
                proposedLevel: 'mastered',
                roles: Object.fromEntries(
                  criterion.roles.map((role) => [role, ['s1']]),
                ),
              }
            : {
                requirements: ['SATISFIED', 'SATISFIED', 'SATISFIED'],
                completeEvidence: true,
              },
        ]),
      ),
    };
    const envelope: Record<string, unknown> = {
      id: `fixture-request-${requests.length}`,
      model: body.model,
      provider: primary ? 'Anthropic' : 'Mistral',
      choices: [
        {
          finish_reason: 'stop',
          message: { content: JSON.stringify(payload) },
        },
      ],
      usage: {
        cost: 0.001,
        completion_tokens_details: { reasoning_tokens: 0 },
      },
    };
    override?.(envelope, requests.length);
    return new Response(JSON.stringify(envelope));
  });
  return { fetcher, requests };
}

it('plans without network, pins identities/prices, and refuses an unrelated actual lock', () => {
  const fetcher = vi.fn(() => {
    throw new Error('No network permitted');
  });
  vi.stubGlobal('fetch', fetcher);
  const { input, plan } = fixture();
  expect(plan).toMatchObject({
    expectedObservations: 540,
    maximumMeasurementCalls: 1080,
    smokeCalls: 2,
    safetyApplicability: 'UNREVIEWED_APPLICABILITY',
  });
  expect(plan.protocol.profiles.primary.modelId).toBe(
    'anthropic/claude-sonnet-4.6',
  );
  expect(plan.protocol.profiles.verifier.route).toEqual(['mistral/eu']);
  expect(fetcher).not.toHaveBeenCalled();
  expect(() =>
    prepareRecoveryExecution({
      ...input,
      lock: { ...input.lock, referenceHash: 'a'.repeat(64) },
    }),
  ).toThrow('LOCK_MISMATCH');
});

it('executes smoke before 540 cells, retains exact request provenance and blinds the verifier', async () => {
  const { input, plan } = fixture();
  const fake = provider();
  const events: RecoveryExecutionEvent[] = [];
  const measured = await executeRecoveryMeasurement({
    plan,
    apiKey: 'unit-only',
    fetcher: fake.fetcher,
    assertReconciled: () => {},
    persist: (event) => events.push(event),
  });
  expect(measured.stopped).toBeNull();
  expect(measured.responseAccounting.SMOKE.knownCostUsd).toBeCloseTo(0.002);
  expect(measured.responseAccounting.MEASUREMENT.knownCostUsd).toBeCloseTo(
    1.08,
  );
  expect(fake.requests).toHaveLength(1082);
  expect(measured.run.observations).toHaveLength(540);
  expect(
    measured.run.observations.filter((row) => row.arm === 'SUPPLIED_EVIDENCE'),
  ).toHaveLength(270);
  const calls = events.filter((event) => event.kind === 'CALL_INTENT');
  expect(calls.slice(0, 2).map((event) => event.phase)).toEqual([
    'SMOKE',
    'SMOKE',
  ]);
  expect(
    calls.every(
      (event, index) =>
        event.requestHash === recoveryHash(fake.requests[index]),
    ),
  ).toBe(true);
  for (const request of fake.requests.filter((_, index) => index % 2 === 1)) {
    const messages = request.messages as { content: string }[];
    const payload = JSON.parse(messages[1].content) as Record<string, unknown>;
    expect(payload).toHaveProperty('sentences');
    expect(payload).not.toHaveProperty('rubric');
    expect(JSON.stringify(payload)).not.toMatch(
      /proposedLevel|sourceAnswerId|FACT_INVERSION|EVIDENCE_DELETION/,
    );
  }
  const supplied = fake.requests.find((request) =>
    JSON.stringify(request).includes('providedEvidence'),
  );
  const suppliedMessages = supplied?.messages as { content: string }[];
  const suppliedPayload = JSON.parse(suppliedMessages[1].content) as {
    providedEvidence: unknown;
  };
  expect(JSON.stringify(suppliedPayload.providedEvidence)).not.toMatch(
    /level|mastered/,
  );
  expect(
    evaluateRecoveryPilot(input.pack, input.reference, input.lock, measured.run)
      .status,
  ).toBe('SAFETY_AND_RELEASE_REVIEW_REQUIRED');
});

it('stops at a failed schema smoke and preserves its known bill and request ID', async () => {
  const { plan } = fixture();
  const fake = provider((envelope) => {
    envelope.choices = [{ finish_reason: 'stop', message: { content: '{}' } }];
  });
  const events: RecoveryExecutionEvent[] = [];
  const result = await executeRecoveryMeasurement({
    plan,
    apiKey: 'unit-only',
    fetcher: fake.fetcher,
    assertReconciled: () => {},
    persist: (event) => events.push(event),
  });
  expect(result.stopped).toBe('RECOVERY_SMOKE_EXTRACTION_SCHEMA_INVALID');
  expect(fake.requests).toHaveLength(1);
  expect(result.run.observations).toHaveLength(0);
  expect(events).toContainEqual(
    expect.objectContaining({
      kind: 'CALL_RESULT',
      costUsd: 0.001,
      providerRequestId: 'fixture-request-1',
    }),
  );
});

it.each(['SUPPLIED_EVIDENCE', 'EXTRACTED_EVIDENCE'] as const)(
  'keeps malformed %s primary delivery withheld while testing supplied evidence independently',
  async (arm) => {
    const { input, plan } = fixture();
    const malformedCall = arm === 'SUPPLIED_EVIDENCE' ? 3 : 5;
    const fake = provider((envelope, index) => {
      if (index === malformedCall)
        envelope.choices = [
          { finish_reason: 'stop', message: { content: 'broken' } },
        ];
    });
    const abort = new AbortController();
    let observed = 0;
    const result = await executeRecoveryMeasurement({
      plan,
      apiKey: 'unit-only',
      fetcher: fake.fetcher,
      assertReconciled: () => {},
      signal: abort.signal,
      persist: (event) => {
        if (
          event.kind === 'OBSERVATION' &&
          ++observed === (arm === 'SUPPLIED_EVIDENCE' ? 1 : 2)
        )
          abort.abort();
      },
    });
    expect(fake.requests).toHaveLength(arm === 'SUPPLIED_EVIDENCE' ? 4 : 5);
    const row = result.run.observations.at(-1);
    expect(row?.extraction).toBeNull();
    if (arm === 'SUPPLIED_EVIDENCE') {
      expect(row?.verificationInputHash).toMatch(/^[a-f0-9]{64}$/u);
      expect(row?.verification).not.toBeNull();
      expect(row?.costUsd).toBe(0.002);
    } else
      expect(row).toMatchObject({
        verification: null,
        verificationInputHash: null,
        costUsd: 0.001,
      });
    expect(() =>
      evaluateRecoveryPilot(
        input.pack,
        input.reference,
        input.lock,
        result.run,
      ),
    ).not.toThrow();
  },
);

it.each(['unknown-cost', 'interrupted-network'])(
  'freezes the shared budget on %s, including before any completed observation',
  async (failure) => {
    const { plan } = fixture();
    const shared = directory();
    const settings = {
      directory: shared,
      decisionId: 'unit-decision',
      envelopeUsd: 10,
      keyHash: 'sha256:unit',
      providerUsageUsd: 0,
      runCapUsd: 10,
      runId: 'unit-run',
    };
    const budget = openAtomBudget(settings);
    const fake = provider((envelope, index) => {
      if (index === 3) {
        if (failure === 'interrupted-network')
          throw new Error('Network interrupted');
        envelope.usage = {};
      }
    });
    const guard = createGuardedResearchFetch({
      budget,
      models: Object.values(plan.protocol.profiles).map((p) => ({
        modelId: p.modelId,
        maxOutputTokens: p.maxOutputTokens,
        ...p.priceCap,
      })),
      readProviderUsage: async () => 0,
      fetcher: fake.fetcher,
    });
    const result = await executeRecoveryMeasurement({
      plan,
      apiKey: 'unit-only',
      fetcher: guard.fetch,
      assertReconciled: guard.assertReconciled,
      persist: () => {},
    });
    expect(result.stopped).not.toBeNull();
    expect(result.run.observations).toHaveLength(0);
    expect(fake.requests).toHaveLength(3);
    await expect(guard.finish()).rejects.toThrow('RECONCILIATION_REQUIRED');
    expect(budget.totals().unknownCalls).toBe(1);
    expect(() => openAtomBudget({ ...settings, runId: 'new-run' })).toThrow(
      'RECONCILIATION_REQUIRED',
    );
  },
);

it('CLI dry run remains offline even with a key present and emits no measured run', () => {
  const { input } = fixture();
  const dir = directory();
  const paths = Object.fromEntries(
    Object.entries({
      pack: input.pack,
      reference: input.reference,
      lock: input.lock,
      'safety-report': input.safetyReport,
      'price-caps': input.priceCaps,
    }).map(([key, value]) => {
      const file = path.join(dir, `${key}.json`);
      writeFileSync(file, JSON.stringify(value));
      return [key, file];
    }),
  );
  const preload = path.join(dir, 'forbid-network.cjs');
  writeFileSync(
    preload,
    'global.fetch = () => { throw new Error("NETWORK_FORBIDDEN"); };',
  );
  const out = path.join(dir, 'dry-plan');
  const stdout = execFileSync(
    process.execPath,
    [
      '--require',
      preload,
      'node_modules/tsx/dist/cli.mjs',
      'scripts/run-ai-correction-recovery.ts',
      ...Object.entries(paths).map(([key, file]) => `--${key}=${file}`),
      `--out=${out}`,
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, OPENROUTER_API_KEY: 'unit-sentinel-never-send' },
    },
  );
  expect(stdout).toContain('zero calls made');
  expect(existsSync(path.join(out, 'run.json'))).toBe(false);
  expect(
    JSON.parse(readFileSync(path.join(out, 'plan.json'), 'utf8')),
  ).toMatchObject({
    paidExecutionRequested: false,
    budget: null,
    safetyApplicability: 'UNREVIEWED_APPLICABILITY',
  });
});

it('preserves cost when request ID is missing and preserves ID when cost is unknown', async () => {
  for (const missing of ['id', 'cost']) {
    const { plan } = fixture();
    const fake = provider((envelope) => {
      if (missing === 'id') delete envelope.id;
      else envelope.usage = {};
    });
    const events: RecoveryExecutionEvent[] = [];
    const result = await executeRecoveryMeasurement({
      plan,
      apiKey: 'unit-only',
      fetcher: fake.fetcher,
      assertReconciled: () => {},
      persist: (event) => events.push(event),
    });
    expect(result.stopped).not.toBeNull();
    expect(events).toContainEqual(
      expect.objectContaining({
        kind: 'CALL_RESULT',
        costUsd: missing === 'cost' ? null : 0.001,
        providerRequestId: missing === 'id' ? null : 'fixture-request-1',
      }),
    );
  }
});

it('withholds the final observation on a known-cost overrun before a complete run can be evaluated', async () => {
  const { input, plan } = fixture();
  const fake = provider((envelope, index) => {
    if (index === 1082)
      envelope.usage = {
        cost: 100,
        completion_tokens_details: { reasoning_tokens: 0 },
      };
  });
  // The durable-ledger failure paths are exercised above; this isolates the final response admission fence.
  let reservedCalls = 0;
  let knownUsd = 0;
  const budget = {
    reserve: vi.fn(() => `call-${++reservedCalls}`),
    settle: vi.fn((_callId: string, cost: number | null) => {
      if (cost !== null) knownUsd += cost;
    }),
    totals: () => ({
      knownUsd,
      reservedUsd: 0,
      runUsd: knownUsd,
      unknownCalls: 0,
      runKnownUsd: knownUsd,
      runUnknownCalls: 0,
    }),
  };
  const guard = createGuardedResearchFetch({
    budget,
    models: Object.values(plan.protocol.profiles).map((p) => ({
      modelId: p.modelId,
      maxOutputTokens: p.maxOutputTokens,
      ...p.priceCap,
    })),
    readProviderUsage: async () => 0,
    fetcher: fake.fetcher,
  });
  const events: RecoveryExecutionEvent[] = [];
  const result = await executeRecoveryMeasurement({
    plan,
    apiKey: 'unit-only',
    fetcher: guard.fetch,
    assertReconciled: guard.assertReconciled,
    persist: (event) => events.push(event),
  });
  expect(result.stopped).toContain('RESERVATION_EXCEEDED');
  expect(result.run.observations).toHaveLength(539);
  expect(events).toContainEqual(
    expect.objectContaining({
      kind: 'CALL_RESULT',
      costUsd: 100,
      providerRequestId: 'fixture-request-1082',
    }),
  );
  await expect(guard.finish()).rejects.toThrow('RESERVATION_EXCEEDED');
  expect(
    evaluateRecoveryPilot(input.pack, input.reference, input.lock, result.run)
      .status,
  ).toBe('BLOCKED');
});

it.each(['array', 'extra-key', 'missing-role'])(
  'refuses %s wire output at smoke despite an apparently usable internal shape',
  async (kind) => {
    const { plan } = fixture();
    const fake = provider((envelope) => {
      const choices = envelope.choices as { message: { content: string } }[];
      const payload = JSON.parse(choices[0].message.content) as {
        criteria: Record<
          string,
          {
            proposedLevel: string;
            roles: Record<string, string[]>;
            criterionKey?: string;
          }
        >;
      };
      if (kind === 'extra-key')
        payload.criteria['source-fidelity'].criterionKey = 'source-fidelity';
      else if (kind === 'missing-role')
        payload.criteria['source-fidelity'].roles = {};
      choices[0].message.content = JSON.stringify(
        kind === 'array'
          ? {
              criteria: Object.entries(payload.criteria).map(
                ([criterionKey, row]) => ({ ...row, criterionKey }),
              ),
            }
          : payload,
      );
    });
    const result = await executeRecoveryMeasurement({
      plan,
      apiKey: 'unit-only',
      fetcher: fake.fetcher,
      assertReconciled: () => {},
      persist: () => {},
    });
    expect(result.stopped).toBe('RECOVERY_SMOKE_EXTRACTION_SCHEMA_INVALID');
    expect(fake.requests).toHaveLength(1);
  },
);
