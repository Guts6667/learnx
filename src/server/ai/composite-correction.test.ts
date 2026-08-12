import { describe, expect, it, vi } from 'vitest';

import type { CorrectionContract } from '@/lib/ai-correction-contracts';
import {
  assertCompositeTransition,
  buildCompositeRoleRequest,
  calculateIndicativeScore,
  confirmCompositeRelease,
  consolidateCompositeCorrection,
  createCompositePipelineFingerprint,
  executeCompositeWorkflow,
  shouldTriggerTargetedVerifier,
  type CompositePipelineIdentity,
  type RoleObservation,
} from '@/server/ai/composite-correction';

const contract: CorrectionContract = {
  authorizedReferences: [],
  contractKey: 'composite-test',
  criteria: [
    {
      acceptableVariants: [],
      calibratedExamples: [],
      commonErrors: [],
      expectedElements: ['A'],
      key: 'criterion-a',
      label: 'A',
      objective: 'A',
      performanceLevels: [
        { description: 'Low', key: 'low', label: 'Low', score: 0 },
        { description: 'Mid', key: 'mid', label: 'Mid', score: 50 },
        { description: 'High', key: 'high', label: 'High', score: 100 },
      ],
      weight: 100,
    },
  ],
  evidence: { acceptedKinds: ['TEXT'], primaryKind: 'TEXT' },
  lifecycle: { publishedAt: '2026-08-12T10:00:00Z', status: 'PUBLISHED' },
  objectives: ['Test'],
  passingScore: 70,
  schemaVersion: 1,
  secondPass: {
    confidenceThreshold: 0.6,
    enabled: true,
    maxPasses: 2,
    triggers: ['LOW_CONFIDENCE'],
  },
  target: { activityKey: 'test', activityType: 'writing', kind: 'EXERCISE' },
  version: '1.0.0',
};

function observation(
  levelKey: 'high' | 'low' | 'mid',
  confidence = 0.9,
): RoleObservation {
  return {
    criteria: [
      {
        confidence,
        criterionKey: 'criterion-a',
        evidenceQuotes: ['A'],
        feedback: 'Feedback',
        levelKey,
      },
    ],
    overallFeedback: 'Overall',
  };
}

const consolidator = {
  active: true,
  allowPrimaryWhenVerifierFails: false,
  materialLevelDistance: 1,
  materialScoreDistance: 25,
  version: '1.0.0',
};

describe('composite correction policy', () => {
  it('calculates the indicative score exclusively from the contract snapshot', () => {
    expect(
      calculateIndicativeScore({ contract, observation: observation('mid') }),
    ).toBe(50);
  });

  it('keeps inactive trigger parameters from silently calling a verifier', () => {
    expect(
      shouldTriggerTargetedVerifier({
        configuration: {
          active: false,
          confidenceThreshold: 1,
          randomSampleRate: 1,
          scoreBoundaryDistance: 100,
          sensitiveCriterionKeys: ['criterion-a'],
          version: '1.0.0',
        },
        contract,
        primary: observation('mid', 0.1),
        signals: { outputValidationWarning: true, randomSample: 0 },
      }),
    ).toBe(false);
  });

  it('uses explicit server signals rather than a model routing decision', () => {
    expect(
      shouldTriggerTargetedVerifier({
        configuration: {
          active: true,
          confidenceThreshold: 0.5,
          randomSampleRate: null,
          scoreBoundaryDistance: null,
          sensitiveCriterionKeys: [],
          version: '1.0.0',
        },
        contract,
        primary: observation('mid', 0.4),
        signals: { outputValidationWarning: false, randomSample: 1 },
      }),
    ).toBe(true);
  });

  it('returns UNCERTAIN without an exact score for a material disagreement', () => {
    expect(
      consolidateCompositeCorrection({
        configuration: consolidator,
        contract,
        primary: observation('high'),
        verifier: observation('low'),
        verifierTriggered: true,
      }),
    ).toMatchObject({ indicativeScore: null, state: 'UNCERTAIN' });
  });

  it('does not average role outputs when they materially disagree', () => {
    const result = consolidateCompositeCorrection({
      configuration: consolidator,
      contract,
      primary: observation('high'),
      verifier: observation('low'),
      verifierTriggered: true,
    });
    expect(result.indicativeScore).not.toBe(50);
  });

  it('treats a required verifier final failure conservatively', () => {
    expect(
      consolidateCompositeCorrection({
        configuration: consolidator,
        contract,
        primary: observation('high'),
        verifier: null,
        verifierTriggered: true,
      }),
    ).toMatchObject({ indicativeScore: null, state: 'UNUSABLE_RELEASED' });
  });

  it('builds verifier input without accepting a primary result', () => {
    const request = buildCompositeRoleRequest({
      contractSnapshot: contract,
      promptSnapshot: { messages: ['independent'] },
      role: 'TARGETED_VERIFIER',
      submissionSnapshot: { text: 'answer' },
    });
    expect(request).not.toHaveProperty('primary');
    expect(JSON.stringify(request)).not.toContain('Overall');
  });

  it('confirms ledger release before returning a released terminal state', async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const result = await confirmCompositeRelease({
      correctionId: 'correction-id',
      releasePort: { release },
      result: {
        indicativeScore: null,
        primary: null,
        state: 'UNUSABLE_RELEASED',
        verifier: null,
      },
    });
    expect(release).toHaveBeenCalledOnce();
    expect(result.state).toBe('UNUSABLE_RELEASED');
  });

  it('fingerprints every role and server policy version', () => {
    const profile = {
      adapter: 'OPENROUTER_CHAT' as const,
      allowFallbacks: false as const,
      maxOutputTokens: 1500,
      modelId: 'vendor/model-1',
      profileVersion: '1.0.0',
      promptVersion: '1.0.0',
      reasoning: 'OFF' as const,
      routeProviders: ['vendor'],
      temperature: 0,
      timeoutMs: 60_000,
    };
    const identity: CompositePipelineIdentity = {
      consolidatorVersion: '1.0.0',
      pipelineKey: 'pilot',
      pipelineVersion: '1.0.0',
      primary: profile,
      protocolVersion: '1.0.0',
      triggerVersion: '1.0.0',
      verifier: { ...profile, modelId: 'vendor/model-2' },
    };
    expect(createCompositePipelineFingerprint(identity)).not.toBe(
      createCompositePipelineFingerprint({
        ...identity,
        triggerVersion: '1.0.1',
      }),
    );
  });

  it('forbids dynamic aliases and unpinned routes', () => {
    const profile = {
      adapter: 'OPENROUTER_CHAT' as const,
      allowFallbacks: false as const,
      maxOutputTokens: 1500,
      modelId: 'vendor/model-latest',
      profileVersion: '1.0.0',
      promptVersion: '1.0.0',
      reasoning: 'OFF' as const,
      routeProviders: ['vendor'],
      temperature: 0,
      timeoutMs: 60_000,
    };
    expect(() =>
      createCompositePipelineFingerprint({
        consolidatorVersion: '1.0.0',
        pipelineKey: 'pilot',
        pipelineVersion: '1.0.0',
        primary: profile,
        protocolVersion: '1.0.0',
        triggerVersion: '1.0.0',
        verifier: profile,
      }),
    ).toThrow('COMPOSITE_PIPELINE_IDENTITY_INVALID');
  });

  it('keeps terminal states immutable and rejects invalid state jumps', () => {
    expect(() => assertCompositeTransition('RESERVED', 'VERIFYING')).toThrow(
      'COMPOSITE_TRANSITION_INVALID',
    );
    expect(() => assertCompositeTransition('UNCERTAIN', 'COMPLETED')).toThrow(
      'COMPOSITE_TRANSITION_INVALID',
    );
    expect(() =>
      assertCompositeTransition('VERIFYING', 'UNCERTAIN'),
    ).not.toThrow();
  });

  it('runs an independent verifier and preserves every technical attempt', async () => {
    const profile = {
      adapter: 'OPENROUTER_CHAT' as const,
      allowFallbacks: false as const,
      maxOutputTokens: 1500,
      modelId: 'vendor/model-primary',
      profileVersion: '1.0.0',
      promptVersion: '1.0.0',
      reasoning: 'OFF' as const,
      routeProviders: ['vendor'],
      temperature: 0,
      timeoutMs: 60_000,
    };
    const identity: CompositePipelineIdentity = {
      consolidatorVersion: '1.0.0',
      pipelineKey: 'pilot',
      pipelineVersion: '1.0.0',
      primary: profile,
      protocolVersion: '1.0.0',
      triggerVersion: '1.0.0',
      verifier: { ...profile, modelId: 'vendor/model-verifier' },
    };
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        attempts: [
          {
            attemptNumber: 1,
            errorCode: 'REQUEST_TIMEOUT',
            internalCostUsd: 0.01,
            observation: null,
            status: 'ERROR',
          },
          {
            attemptNumber: 2,
            errorCode: null,
            internalCostUsd: 0.02,
            observation: observation('high'),
            status: 'VALID',
          },
        ],
        observation: observation('high'),
        role: 'PRIMARY',
      })
      .mockResolvedValueOnce({
        attempts: [
          {
            attemptNumber: 1,
            errorCode: null,
            internalCostUsd: 0.02,
            observation: observation('high'),
            status: 'VALID',
          },
        ],
        observation: observation('high'),
        role: 'TARGETED_VERIFIER',
      });
    const repository = {
      complete: vi.fn().mockResolvedValue(undefined),
      recordRoleExecution: vi.fn().mockResolvedValue(undefined),
      start: vi.fn().mockResolvedValue(undefined),
    };
    const result = await executeCompositeWorkflow({
      consolidationConfiguration: consolidator,
      contract,
      correctionId: 'correction-id',
      generationPort: { execute },
      identity,
      primaryPromptSnapshot: { content: 'primary' },
      releasePort: { release: vi.fn().mockResolvedValue(undefined) },
      repository,
      submissionSnapshot: { text: 'answer' },
      triggerConfiguration: {
        active: true,
        confidenceThreshold: 1,
        randomSampleRate: null,
        scoreBoundaryDistance: null,
        sensitiveCriterionKeys: [],
        version: '1.0.0',
      },
      triggerSignals: { outputValidationWarning: false, randomSample: 1 },
      verifierPromptSnapshot: { content: 'verifier' },
    });
    expect(result.state).toBe('COMPLETED');
    expect(repository.recordRoleExecution).toHaveBeenCalledTimes(2);
    expect(
      repository.recordRoleExecution.mock.calls[0]?.[0].execution.attempts,
    ).toHaveLength(2);
    const verifierRequest = execute.mock.calls[1]?.[0].request;
    expect(verifierRequest).not.toHaveProperty('primary');
    expect(JSON.stringify(verifierRequest)).not.toContain('Overall');
  });

  it('releases only after a final unusable result and never exposes a score', async () => {
    const profile = {
      adapter: 'OPENROUTER_CHAT' as const,
      allowFallbacks: false as const,
      maxOutputTokens: 1500,
      modelId: 'vendor/model-primary',
      profileVersion: '1.0.0',
      promptVersion: '1.0.0',
      reasoning: 'OFF' as const,
      routeProviders: ['vendor'],
      temperature: 0,
      timeoutMs: 60_000,
    };
    const release = vi.fn().mockResolvedValue(undefined);
    const complete = vi.fn().mockResolvedValue(undefined);
    const result = await executeCompositeWorkflow({
      consolidationConfiguration: consolidator,
      contract,
      correctionId: 'correction-id',
      generationPort: {
        execute: vi.fn().mockResolvedValue({
          attempts: [
            {
              attemptNumber: 1,
              errorCode: 'PROVIDER_UNAVAILABLE',
              internalCostUsd: 0.01,
              observation: null,
              status: 'ERROR',
            },
          ],
          observation: null,
          role: 'PRIMARY',
        }),
      },
      identity: {
        consolidatorVersion: '1.0.0',
        pipelineKey: 'pilot',
        pipelineVersion: '1.0.0',
        primary: profile,
        protocolVersion: '1.0.0',
        triggerVersion: '1.0.0',
        verifier: { ...profile, modelId: 'vendor/model-verifier' },
      },
      primaryPromptSnapshot: {},
      releasePort: { release },
      repository: {
        complete,
        recordRoleExecution: vi.fn().mockResolvedValue(undefined),
        start: vi.fn().mockResolvedValue(undefined),
      },
      submissionSnapshot: {},
      triggerConfiguration: {
        active: false,
        confidenceThreshold: null,
        randomSampleRate: null,
        scoreBoundaryDistance: null,
        sensitiveCriterionKeys: [],
        version: '1.0.0',
      },
      triggerSignals: { outputValidationWarning: false, randomSample: 1 },
      verifierPromptSnapshot: {},
    });
    expect(release).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      indicativeScore: null,
      state: 'UNUSABLE_RELEASED',
    });
    expect(complete).toHaveBeenCalledAfter(release);
  });
});
