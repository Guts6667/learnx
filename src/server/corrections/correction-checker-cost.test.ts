import {
  buildHarness,
  strictOutput,
} from './correction-orchestration.test-support';
import { PROMOTED_CHECKER_IDENTITY } from './promoted-identity';

function run(checkerOutcome: unknown) {
  const harness = buildHarness({
    checker: { verify: vi.fn(async () => checkerOutcome) },
    transport: strictOutput,
  });
  return {
    harness,
    result: harness.service.runAcceptedQuote({
      quoteId: 'quote-1',
      userId: 'user-1',
    }),
  };
}

const agreed = {
  costUsd: 0.004,
  latencyMs: 900,
  providerRoute: 'Mistral',
  unavailableReason: null,
  verdicts: {
    'decision-position': 'AGREED',
    'evidence-selection': 'AGREED',
  },
};

describe('coût du vérificateur enregistré (défaut de V4.5-111)', () => {
  it('déclare l’appel sous son propre rôle et sa propre identité', async () => {
    // Not under the corrector's. V4.5-114 splits the ceiling by role, and a row
    // that lies about which model ran would corrupt the figure it needs.
    const { harness, result } = run(agreed);
    await result;

    expect(harness.corrections.attemptIntents).toContainEqual(
      expect.objectContaining({
        identity: {
          modelId: PROMOTED_CHECKER_IDENTITY.modelId,
          provider: PROMOTED_CHECKER_IDENTITY.provider,
          role: 'CORRECTION_CHECKER',
        },
      }),
    );
  });

  it('enregistre le coût et la latence au lieu de les jeter', async () => {
    const { harness, result } = run(agreed);
    await result;

    const checkerAttempt = harness.corrections.attemptOutcomes.find(
      (attempt) => attempt.modelSnapshot === PROMOTED_CHECKER_IDENTITY.modelId,
    );
    expect(checkerAttempt).toMatchObject({
      actualCostUsd: 0.004,
      latencyMs: 900,
      providerRoute: 'Mistral',
      status: 'SUCCEEDED',
    });
  });

  it('compte la dépense du vérificateur dans le coût de la correction', async () => {
    // The recorded cost used to understate what was actually spent, which is
    // also what left V4.5-114 without a figure to price a ceiling from.
    const { result } = run(agreed);
    const settled = await result;
    // 0.014 from the transport fixture plus the checker's 0.004.
    expect(settled.correction.modelUsageCostUsd).toBeCloseTo(0.018, 6);
  });

  it('enregistre quand même la tentative quand le vérificateur échoue', async () => {
    const { harness, result } = run({
      costUsd: null,
      latencyMs: null,
      providerRoute: null,
      unavailableReason: 'TIMEOUT',
      verdicts: {
        'decision-position': 'UNAVAILABLE',
        'evidence-selection': 'UNAVAILABLE',
      },
    });
    await result;

    const checkerAttempt = harness.corrections.attemptOutcomes.find(
      (attempt) => attempt.modelSnapshot === PROMOTED_CHECKER_IDENTITY.modelId,
    );
    expect(checkerAttempt).toMatchObject({
      errorCode: 'TIMEOUT',
      status: 'FAILED',
    });
    // A failed call with no cost is an unknown cost, which V4.5-142's audit
    // now sees. Dropping the attempt entirely would have hidden it.
    expect(checkerAttempt?.actualCostUsd).toBeUndefined();
  });

  it('n’enregistre aucune tentative quand aucun vérificateur n’est configuré', async () => {
    const harness = buildHarness({ transport: strictOutput });
    await harness.service.runAcceptedQuote({
      quoteId: 'quote-1',
      userId: 'user-1',
    });
    expect(
      harness.corrections.attemptOutcomes.filter(
        (attempt) =>
          attempt.modelSnapshot === PROMOTED_CHECKER_IDENTITY.modelId,
      ),
    ).toEqual([]);
  });
});
