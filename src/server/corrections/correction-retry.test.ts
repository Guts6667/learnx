import {
  buildHarness,
  partialOutput,
  undeliverableCriterionOutput,
  strictOutput,
} from './correction-orchestration.test-support';
import { PROMOTED_CORRECTION_IDENTITY } from './promoted-identity';

/** A response the contract cannot accept: an unknown level for a criterion. */
function unusableOutput() {
  const output = strictOutput();
  output.criteria['decision-position'].levelKey = 'niveau-inexistant';
  output.criteria['evidence-selection'].levelKey = 'niveau-inexistant';
  return output;
}

describe('reprise sur réponse inutilisable (V4.5-124)', () => {
  it('livre après une réponse inutilisable suivie d’une bonne', async () => {
    // The 29 August run showed ~5 % of cells failing this way: a response
    // arrived and could not be used. Asking again is what recovers them.
    const outputs = [unusableOutput(), strictOutput()];
    let call = 0;
    const harness = buildHarness({
      transport: () => outputs[call++] ?? strictOutput(),
    });

    const result = await harness.service.runAcceptedQuote({
      quoteId: 'quote-1',
      userId: 'user-1',
    });

    expect(result.correction.status).toBe('COMPLETED');
    expect(harness.transportOutputs).toHaveLength(2);
  });

  it('échoue et libère les crédits après deux réponses inutilisables', async () => {
    // One retry, not "some": a model that has refused twice to satisfy its own
    // contract is not going to on the third paid attempt.
    const harness = buildHarness({ transport: unusableOutput });

    const result = await harness.service.runAcceptedQuote({
      quoteId: 'quote-1',
      userId: 'user-1',
    });

    expect(result.correction.status).toBe('FAILED');
    // V4.5-101: nothing delivered, nothing charged.
    expect(result.settlement.settledCredits).toBe('0');
    expect(harness.credits.calls).toContain('release');
    expect(harness.transportOutputs).toHaveLength(2);
  });

  it('ne reprend jamais un appel qui a échoué de façon ambiguë', async () => {
    // A timeout or a 5xx may have been billed and may have produced a
    // generation we never saw. Repeating it without a provider idempotency key
    // would pay twice for two answers, one of them lost.
    const harness = buildHarness({
      transport: () => {
        throw new Error('socket hang up');
      },
    });

    const result = await harness.service.runAcceptedQuote({
      quoteId: 'quote-1',
      userId: 'user-1',
    });

    expect(result.correction.status).toBe('FAILED');
    expect(harness.corrections.attemptOutcomes).toHaveLength(1);
  });

  it('ne reprend pas une livraison partielle, qui est utilisable', async () => {
    // A criterion sent back as « à retravailler » is a delivered correction,
    // not a failed one. Retrying it would pay again for an answer we accepted.
    const harness = buildHarness({ transport: undeliverableCriterionOutput });

    const result = await harness.service.runAcceptedQuote({
      quoteId: 'quote-1',
      userId: 'user-1',
    });

    expect(result.correction.status).toBe('COMPLETED_PARTIAL');
    expect(harness.transportOutputs).toHaveLength(1);
  });

  it('ne reprend pas non plus une citation écartée pour provenance', async () => {
    // V4.5-177 : le critère est livré en « à vérifier ». La réponse a été
    // reçue et reste exploitable, donc la reprise paierait deux fois pour une
    // correction que nous avons acceptée.
    const harness = buildHarness({ transport: partialOutput });

    const result = await harness.service.runAcceptedQuote({
      quoteId: 'quote-1',
      userId: 'user-1',
    });

    expect(result.correction.status).toBe('COMPLETED');
    expect(harness.transportOutputs).toHaveLength(1);
  });

  it('enregistre la reprise comme sa propre tentative, avec son coût', async () => {
    // V4.5-119's rule: a call that is not recorded is spend that cannot be
    // reconciled.
    const outputs = [unusableOutput(), strictOutput()];
    let call = 0;
    const harness = buildHarness({
      transport: () => outputs[call++] ?? strictOutput(),
    });

    await harness.service.runAcceptedQuote({
      quoteId: 'quote-1',
      userId: 'user-1',
    });

    expect(harness.corrections.attemptOutcomes).toHaveLength(2);
    expect(
      harness.corrections.attemptOutcomes.map((attempt) => attempt.sequence),
    ).toEqual([1, 2]);
    for (const attempt of harness.corrections.attemptOutcomes) {
      expect(attempt.actualCostUsd).toBeGreaterThan(0);
    }
  });

  it('tient dans le plafond déjà réservé', async () => {
    // The catalogue prices two model calls, so a retry costs a call the quote
    // already reserved. Nothing here needed repricing.
    expect(PROMOTED_CORRECTION_IDENTITY.maxRetries).toBe(1);
  });
});
