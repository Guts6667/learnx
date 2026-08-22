import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { compileExecutableRubric } from '../../lib/executable-rubric-engine.js';
import {
  createEvidenceAssistOrchestrator,
  EVIDENCE_ASSIST_HARD_OFF_GATE,
  EvidenceAssistOrchestrationError,
  type EvidenceAssistProviderPort,
  type EvidenceAssistProviderRequest,
  type EvidenceAssistProviderResponse,
} from './evidence-assist-orchestrator.js';

const rubricPath = resolve(
  process.cwd(),
  'benchmarks/ai-correction/executable-rubric/writing-recommendation-fr.v1.json',
);
const compiled = compileExecutableRubric(
  JSON.parse(readFileSync(rubricPath, 'utf8')) as unknown,
);
const baseInput = {
  compiled,
  idempotencyKey: 'evidence-assist:submission:1',
  responseText:
    'Je recommande les ordinateurs. Six personnes partageaient trois postes.',
  taskContext: 'Contexte fiable.',
  taskPrompt: 'Formulez une recommandation justifiée.',
};
const enabledGate = {
  enabled: true,
  mode: 'OFFLINE_FAKE_ONLY',
} as const;

function raw(findings: unknown[]): string {
  return JSON.stringify({ findings });
}

function fakeProvider(
  output: (request: EvidenceAssistProviderRequest) => string,
): EvidenceAssistProviderPort {
  return {
    execute: vi.fn(async (request) => ({
      rawModelOutput: output(request),
    })),
    kind: 'OFFLINE_FAKE',
  };
}

function expectCode(
  code: EvidenceAssistOrchestrationError['code'],
): (error: unknown) => boolean {
  return (error) =>
    error instanceof EvidenceAssistOrchestrationError && error.code === code;
}

describe('evidence assist product orchestrator', () => {
  it('is hard-off by default and never reaches the injected provider', async () => {
    const provider = fakeProvider(() => raw([]));
    const orchestrator = createEvidenceAssistOrchestrator({ provider });

    await expect(orchestrator.run(baseInput)).rejects.toSatisfy(
      expectCode('FEATURE_DISABLED'),
    );
    expect(provider.execute).not.toHaveBeenCalled();
    expect(EVIDENCE_ASSIST_HARD_OFF_GATE).toEqual({
      enabled: false,
      mode: 'HARD_OFF',
    });
    expect(compiled.rubric.lifecycle).toBe('DRAFT');
  });

  it('rejects a live provider shape even when the offline-only gate is enabled', async () => {
    const execute = vi.fn(async () => ({ rawModelOutput: raw([]) }));
    const liveProvider = {
      execute,
      kind: 'OPENROUTER',
    } as unknown as EvidenceAssistProviderPort;
    const orchestrator = createEvidenceAssistOrchestrator({
      gate: enabledGate,
      provider: liveProvider,
    });

    await expect(orchestrator.run(baseInput)).rejects.toSatisfy(
      expectCode('OFFLINE_FAKE_PROVIDER_REQUIRED'),
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it('executes a fake provider with server spans and publishes candidate-only partial evidence', async () => {
    const provider = fakeProvider((request) =>
      raw([
        {
          elementKey: 'explicit-recommendation',
          relation: 'EVIDENCE_FOR_ELEMENT',
          spanIds: [request.spanIds[0]],
        },
      ]),
    );
    const orchestrator = createEvidenceAssistOrchestrator({
      gate: enabledGate,
      provider,
    });

    const result = await orchestrator.run(baseInput);
    const request = vi.mocked(provider.execute).mock.calls[0]?.[0];

    expect(request?.messages.map(({ role }) => role)).toEqual([
      'system',
      'user',
    ]);
    expect(request?.spanIds[0]).toMatch(/^s[0-9]{4,}-[a-f0-9]{16}$/u);
    expect(request?.requestContextFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(result).toMatchObject({
      authority: 'CANDIDATE_ONLY',
      billingEffect: 'NONE',
      candidateOnly: true,
      indicativeScore: null,
      level: null,
      levelAuthority: 'NONE',
      masteryEffect: 'NONE',
      progressionEffect: 'NONE',
      score: null,
      scoreAuthority: 'NONE',
      state: 'PARTIAL',
    });
    expect(result.candidateFindings).toEqual([
      {
        candidateOnly: true,
        elementKey: 'explicit-recommendation',
        relation: 'EVIDENCE_FOR_ELEMENT',
        spanIds: [request?.spanIds[0]],
      },
    ]);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('maps complete candidates and empty evidence to explicit public states', async () => {
    const completeProvider = fakeProvider((request) =>
      raw(
        request.candidateElementKeys.map((elementKey) => ({
          elementKey,
          relation: 'EVIDENCE_FOR_ELEMENT',
          spanIds: [request.spanIds[0]],
        })),
      ),
    );
    const unresolvedProvider = fakeProvider(() => raw([]));

    await expect(
      createEvidenceAssistOrchestrator({
        gate: enabledGate,
        provider: completeProvider,
      }).run(baseInput),
    ).resolves.toMatchObject({
      state: 'CANDIDATE_ONLY',
      unresolvedElementKeys: [],
    });
    await expect(
      createEvidenceAssistOrchestrator({
        gate: enabledGate,
        provider: unresolvedProvider,
      }).run(baseInput),
    ).resolves.toMatchObject({
      candidateFindings: [],
      state: 'UNRESOLVED',
    });
  });

  it('collapses deterministic idempotent replays and rejects changed input', async () => {
    const provider = fakeProvider((request) =>
      raw([
        {
          elementKey: 'explicit-recommendation',
          relation: 'EVIDENCE_FOR_ELEMENT',
          spanIds: [request.spanIds[0]],
        },
      ]),
    );
    const orchestrator = createEvidenceAssistOrchestrator({
      gate: enabledGate,
      provider,
    });

    const [first, replay] = await Promise.all([
      orchestrator.run(baseInput),
      orchestrator.run(baseInput),
    ]);

    expect(replay).toBe(first);
    expect(provider.execute).toHaveBeenCalledOnce();
    const independentProvider = fakeProvider((request) =>
      raw([
        {
          elementKey: 'explicit-recommendation',
          relation: 'EVIDENCE_FOR_ELEMENT',
          spanIds: [request.spanIds[0]],
        },
      ]),
    );
    const independent = await createEvidenceAssistOrchestrator({
      gate: enabledGate,
      provider: independentProvider,
    }).run(baseInput);
    expect(independent).toEqual(first);
    expect(independent.operationFingerprint).toBe(first.operationFingerprint);
    await expect(
      orchestrator.run({
        ...baseInput,
        responseText: `${baseInput.responseText} Modification.`,
      }),
    ).rejects.toSatisfy(expectCode('IDEMPOTENCY_CONFLICT'));
    expect(provider.execute).toHaveBeenCalledOnce();
  });

  it('fails closed on invalid raw JSON and a canary leak', async () => {
    const invalidRaw = createEvidenceAssistOrchestrator({
      gate: enabledGate,
      provider: fakeProvider(() => 'not-json'),
    });
    const leaking = createEvidenceAssistOrchestrator({
      gate: enabledGate,
      provider: fakeProvider((request) => {
        const match = /CONFIDENTIAL_CANARY=("lx-canary-[a-f0-9]{32}")/u.exec(
          request.messages[0].content,
        );
        if (!match?.[1]) throw new Error('FAKE_CANARY_MISSING');
        return JSON.stringify({
          findings: [],
          leakedCanary: JSON.parse(match[1]) as string,
        });
      }),
    });

    await expect(invalidRaw.run(baseInput)).rejects.toSatisfy(
      expectCode('VALIDATION_FAILED'),
    );
    await expect(
      leaking.run({
        ...baseInput,
        idempotencyKey: 'evidence-assist:submission:canary',
      }),
    ).rejects.toSatisfy(expectCode('VALIDATION_FAILED'));
  });

  it('rejects provider attempts to add score or progression authority', async () => {
    const provider = fakeProvider(() =>
      JSON.stringify({
        findings: [],
        progressionEffect: 'ADVANCE',
        score: 100,
      }),
    );
    const orchestrator = createEvidenceAssistOrchestrator({
      gate: enabledGate,
      provider,
    });

    await expect(orchestrator.run(baseInput)).rejects.toSatisfy(
      expectCode('VALIDATION_FAILED'),
    );
  });

  it('rejects provider response side channels outside mandatory raw output', async () => {
    const provider: EvidenceAssistProviderPort = {
      async execute() {
        return {
          progressionEffect: 'ADVANCE',
          rawModelOutput: raw([]),
        } as EvidenceAssistProviderResponse;
      },
      kind: 'OFFLINE_FAKE',
    };
    const orchestrator = createEvidenceAssistOrchestrator({
      gate: enabledGate,
      provider,
    });

    await expect(orchestrator.run(baseInput)).rejects.toSatisfy(
      expectCode('PROVIDER_OUTPUT_INVALID'),
    );
  });
});
