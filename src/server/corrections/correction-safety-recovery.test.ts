import { correctionContractSchema } from '../../lib/ai-correction-contracts';
import {
  buildHarness,
  contractRaw,
  strictOutput,
} from './correction-orchestration.test-support';
import {
  buildCorrectionOutcome,
  withStoredConfidence,
} from './correction-outcome';
import { projectLearnerCorrection } from './learner-correction';
import { selectCorrectionTransport } from './correction-transport-mode';
import { CorrectionOrchestrationService } from './correction-orchestration';

const run = { quoteId: 'quote-1', userId: 'user-1' };
const storedResult = (confidence: 'HIGH' | 'LOW' = 'LOW') => ({
  correction: {
    id: 'correction-1',
    status: 'COMPLETED' as const,
    criteria: [
      {
        key: 'c',
        label: 'Criterion',
        weight: 100,
        confidence,
        levelKey: 'mastered',
        levelLabel: 'Mastered',
        feedback: 'Unverified advice',
        evidenceStatus: 'FOUND' as const,
        evidenceQuotes: ['Actual answer'],
      },
    ],
    unsureCriteria: [],
    unsureCriterionDetails: [],
    overallFeedback: 'Unverified global advice',
    overallConfidence: confidence,
    indicativeScore: 100,
    modelUsageCostUsd: 0.01,
    monitoringSignals: [],
  },
  settlement: {
    reservedCredits: '18',
    releasedCredits: '6',
    settledCredits: '12',
  },
  replay: true,
});

describe('learner delivery boundaries', () => {
  it('projects LOW as nullable claims while retaining the raw model artifact', () => {
    const source = storedResult();
    const delivered = projectLearnerCorrection(source);
    expect(delivered.correction.criteria[0]).toMatchObject({
      levelKey: null,
      levelLabel: null,
      feedback: null,
      evidenceQuotes: ['Actual answer'],
    });
    expect(delivered.correction).toMatchObject({
      indicativeScore: null,
      overallFeedback: null,
    });
    expect(source.correction.criteria[0]?.levelKey).toBe('mastered');
    expect(source.correction.overallFeedback).toBe('Unverified global advice');
    expect(delivered.correction).not.toHaveProperty('modelUsageCostUsd');
  });

  it('withdraws global advice on partial results even when delivered criteria are confident', () => {
    const source = storedResult('HIGH');
    const delivered = projectLearnerCorrection({
      ...source,
      correction: {
        ...source.correction,
        status: 'COMPLETED_PARTIAL',
        unsureCriteria: ['missing'],
      },
    });
    expect(delivered.correction.overallFeedback).toBeNull();
    expect(delivered.correction.indicativeScore).toBeNull();
  });

  it('removes an old numeric score when legacy confidence is missing', () => {
    const source = storedResult();
    const normalized = withStoredConfidence({
      ...source.correction,
      criteria: source.correction.criteria.map((criterion) => ({
        ...criterion,
        confidence: undefined,
      })),
      overallConfidence: undefined,
    });
    expect(normalized.indicativeScore).toBeNull();
    expect(
      projectLearnerCorrection({ ...source, correction: normalized }).correction
        .overallFeedback,
    ).toBeNull();
  });

  it('caps historical HIGH criteria outside the validated family', () => {
    const source = storedResult('HIGH');
    expect(
      withStoredConfidence(source.correction, {
        target: { activityType: 'practice' },
      }).criteria[0]?.confidence,
    ).toBe('MEDIUM');
    expect(
      withStoredConfidence(source.correction, {
        target: { activityType: 'writing' },
      }).criteria[0]?.confidence,
    ).toBe('HIGH');
  });

  it('applies a family ceiling to each new delivered criterion', () => {
    const contract = correctionContractSchema.parse({
      ...contractRaw,
      target: { ...contractRaw.target, activityType: 'practice' },
    });
    const result = buildCorrectionOutcome({
      contract,
      output: {
        contractKey: contract.contractKey,
        contractVersion: contract.version,
        criteria: [
          {
            criterionKey: 'decision-position',
            levelKey: 'mastered',
            confidence: 1,
            evidenceStatus: 'FOUND',
            evidenceQuotes: ['Actual answer'],
            feedback: 'Decision explicit',
          },
        ],
        overallConfidence: 1,
        overallFeedback: 'Advice',
        secondPass: { required: false, reasons: [] },
      },
      unsureCriteria: [],
      usageCost: 0.01,
      verdicts: { 'decision-position': 'AGREED' },
    });
    expect(result.criteria[0]?.confidence).toBe('MEDIUM');
    expect(result.overallConfidence).toBe('MEDIUM');
  });
});

describe('emergency dispatch stop', () => {
  it('refuses an accepted but unstarted quote before reserving credits', async () => {
    const harness = buildHarness({
      canDispatch: async () => false,
      transport: strictOutput,
    });
    await expect(harness.service.runAcceptedQuote(run)).rejects.toThrow(
      'CORRECTION_SUSPENDED',
    );
    expect(harness.credits.calls).toEqual([]);
    expect(harness.transport.execute).not.toHaveBeenCalled();
  });

  it.each(['READY', 'READY_TO_SETTLE'] as const)(
    'allows %s replay while dispatch is stopped',
    async (state) => {
      const harness = buildHarness({
        canDispatch: async () => false,
        transport: strictOutput,
        replayLookup:
          state === 'READY'
            ? { state, result: storedResult('HIGH') }
            : {
                state,
                result: storedResult('HIGH'),
                reservationId: 'reservation-1',
              },
      });
      expect((await harness.service.runAcceptedQuote(run)).replay).toBe(true);
      expect(harness.transport.execute).not.toHaveBeenCalled();
      expect(harness.credits.calls).toEqual(
        state === 'READY' ? [] : ['settle'],
      );
    },
  );

  it('blocks a retry after the first provider response and releases the reservation', async () => {
    let open = true;
    const harness = buildHarness({
      canDispatch: async () => open,
      transport: () => {
        open = false;
        return null;
      },
    });
    const result = await harness.service.runAcceptedQuote(run);
    expect(harness.transport.execute).toHaveBeenCalledTimes(1);
    expect(result.correction.status).toBe('FAILED');
    expect(harness.credits.calls).toEqual(['reserve', 'release']);
  });

  it('settles the in-flight primary but never starts its checker after a stop', async () => {
    let open = true;
    const verify = vi.fn();
    const harness = buildHarness({
      canDispatch: async () => open,
      checker: { verify },
      transport: () => {
        open = false;
        return strictOutput();
      },
    });
    const result = await harness.service.runAcceptedQuote(run);
    expect(verify).not.toHaveBeenCalled();
    expect(result.correction.overallConfidence).toBe('MEDIUM');
    expect(harness.credits.calls).toEqual(['reserve', 'settle']);
  });

  it('rechecks after storing call intent and records a known zero-cost cancellation', async () => {
    let open = true;
    const harness = buildHarness({
      canDispatch: async () => open,
      transport: strictOutput,
    });
    harness.corrections.recordAttemptIntent = vi.fn(async () => {
      open = false;
    });
    const result = await harness.service.runAcceptedQuote(run);
    expect(harness.transport.execute).not.toHaveBeenCalled();
    expect(harness.corrections.attemptOutcomes).toContainEqual(
      expect.objectContaining({
        errorCode: 'DISPATCH_BLOCKED',
        actualCostUsd: 0,
      }),
    );
    expect(result.settlement.settledCredits).toBe('0');
  });
});

it('executes the whole fake pipeline with zero provider network calls', async () => {
  const network = vi.fn(() => {
    throw new Error('Provider network forbidden');
  });
  vi.stubGlobal('fetch', network);
  try {
    const selection = selectCorrectionTransport({
      LEARNX_AI_TRANSPORT: 'fake',
      NODE_ENV: 'test',
    });
    const harness = buildHarness({ transport: strictOutput });
    const service = new CorrectionOrchestrationService(
      harness.quotes,
      harness.credits,
      { ...harness.corrections, findByQuote: async () => null },
      selection.transport,
      {
        apiKey: 'real-key-shaped-but-never-sent',
        now: () => new Date('2026-08-24T10:00:00Z'),
        checker: selection.createChecker({
          apiKey: 'real-key-shaped-but-never-sent',
          appUrl: 'https://example.test',
        }),
      },
    );
    const result = await service.runAcceptedQuote(run);
    expect(result.correction.status).toBe('COMPLETED');
    expect(network).not.toHaveBeenCalled();
    expect(harness.corrections.attemptOutcomes).toHaveLength(2);
    expect(result.correction.modelUsageCostUsd).toBe(0);
  } finally {
    vi.unstubAllGlobals();
  }
});
